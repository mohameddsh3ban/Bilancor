import { Injectable, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Business, HistoryEntry, Invoice } from '../data/models';
import { newId, paymentFor } from '../domain/cash-payments';
import {
  canSendInvoice,
  effectiveTaxNote,
  effectiveVatRate,
  invoiceDocFor,
  invoiceMatch,
  invoiceStatus,
  leftCents,
  nextInvoiceNumber,
  receivingBank,
  reminderState,
  revenueBookingFor,
  sellerOf,
} from '../domain/invoices';
import { DemoStateService } from './demo-state.service';

/** How long sending an invoice or a reminder by email takes, as far as the demo is concerned. */
export const SEND_MS = 1500;

/** The email an invoice or a reminder goes out in, as the send step showed it. The mockup sends nothing; only the address is written to the history. */
export interface InvoiceEmail {
  to: string;
  subject: string;
  body: string;
}

/** The IBAN on a simulated payment: the usual example IBAN, because the customer's bank is not known. */
const CUSTOMER_IBAN = 'DE89370400440532013000';

/** An invoice or reminder on its way: the invoice it is for, and the data generation it started in (a reset ends it). */
interface OnItsWay {
  invoiceId: string;
  generation: number;
}

/** A new draft with nothing filled in: today's date, the current month, and the term, language and VAT rate a new invoice starts with. */
function blankDraft(business: Business, id: string): Invoice {
  const profile = business.invoiceProfile;
  return {
    id,
    number: null,
    customer: { name: '', street: '', postcode: '', city: '', country: 'DE', email: '', kind: 'business', vatId: null, leitwegId: null },
    lines: [],
    vatRate: 19,
    taxNote: null,
    seller: null,
    language: profile.language,
    issueDate: DEMO_TODAY,
    servicePeriod: { kind: 'month', month: DEMO_TODAY.slice(0, 7) },
    paymentTermDays: profile.paymentTermDays,
    sentOn: null,
    docId: null,
    paymentIds: [],
    reminders: [],
    cancelledBy: null,
    cancels: null,
    history: [{ date: DEMO_TODAY, key: 'invoiceCreated', params: {} }],
  };
}

/**
 * Simulates what happens to the invoices of the open business: sending (by email, taking `SEND_MS`), reminders, cancelling,
 * copying, and the money coming in. Nothing leaves the app. Every change goes through `DemoStateService`, so Documents,
 * Payments, the review inbox and the taxes follow, and Reset demo takes it all back.
 */
@Injectable({ providedIn: 'root' })
export class InvoiceService {
  private readonly demo = inject(DemoStateService);

  /** Every invoice id this service has handed out, also for a draft that is not saved yet, so that no two drafts, copies or cancellation invoices ever share one. */
  private readonly handedOut = new Set<string>();

  private readonly onItsWay = signal<OnItsWay | null>(null);
  /** The id of the invoice (or the one a reminder is for) on its way to the customer, or null. Reset demo drops it: it is null from then, not only when the time is up. */
  readonly sending = computed<string | null>(() => {
    const way = this.onItsWay();
    return way !== null && way.generation === this.demo.dataGeneration() ? way.invoiceId : null;
  });

  /**
   * A new draft of the open business, not saved yet: today's date, the current month, the term and language of the invoice
   * details, and 19 % VAT. Its id is reserved at once, so another draft, a copy or a cancellation invoice made before this one
   * is saved never gets the same.
   */
  newDraft(): Invoice {
    const business = this.demo.business();
    return blankDraft(business, this.newInvoiceId(business));
  }

  /** Saves a draft of the open business (a new one, or the next version of one saved before). A sent invoice is never replaced, and a draft on its way to the customer is not changed. */
  saveDraft(invoice: Invoice): void {
    if (invoice.sentOn !== null || this.sending() === invoice.id) return;
    const stored = this.demo.business().invoices.find((i) => i.id === invoice.id);
    if (stored && stored.sentOn !== null) return;
    this.demo.saveInvoice(invoice);
  }

  /**
   * Sends a draft of the open business by email: after `SEND_MS` it becomes a sent invoice with the next number, today as the
   * day it was sent, the VAT rate, note and seller details it has then (kept from there on), and its document on Documents. Resolves true when
   * it was sent.
   *
   * Resolves false, and sends nothing, when the invoice is not a draft that has everything it needs (see `canSendInvoice`),
   * or another invoice is on its way (a second tap changes nothing). Also false when Reset demo came in meanwhile (the data
   * it speaks of is gone) or the draft was removed or stopped being sendable while it was on its way. The number is given
   * when the time is up, so it is the next free one whatever happened in between. It is recorded for the business it was
   * sent for, whichever is open by then.
   */
  send(id: string, email: InvoiceEmail): Promise<boolean> {
    const business = this.demo.business();
    const draft = business.invoices.find((i) => i.id === id);
    if (!draft || this.sending() !== null || !canSendInvoice(draft, business, this.demo.setup())) return Promise.resolve(false);
    return this.afterSendTime(id, () => this.recordSent(business.id, id, email));
  }

  /**
   * Sends reminder `level` for an overdue invoice of the open business by email: after `SEND_MS` the reminder is on the
   * invoice, with a line in its history. Resolves true when it was sent. Only the reminder `reminderState` offers now can be
   * sent, so the formal one (level 2) only once the friendly one is 7 days old. A reminder never changes the invoice's
   * status or due date. Resolves false when it is not offered, another one is on its way, Reset demo came in meanwhile,
   * or the invoice was paid or cancelled while it was on its way. `email` is what the send step showed; the mockup keeps no copy of it.
   */
  remind(id: string, level: 1 | 2, email: InvoiceEmail): Promise<boolean> {
    const business = this.demo.business();
    const invoice = business.invoices.find((i) => i.id === id);
    if (!invoice || this.sending() !== null || reminderState(invoice, business).next !== level) return Promise.resolve(false);
    return this.afterSendTime(id, () => this.recordReminder(business.id, id, level));
  }

  /**
   * Cancels a sent invoice of the open business that nothing was paid on (open or overdue) with a cancellation invoice
   * (Stornorechnung): the next number, the same customer, lines and seller details with the amounts negated, sent today, and its own
   * document. The original stays on record as cancelled, and so does its document. Returns the id of the cancellation
   * invoice, or null (and changes nothing) for a draft, a paid or partly paid invoice, one that is cancelled already, a
   * cancellation invoice, and an unknown id.
   */
  cancel(id: string): string | null {
    const business = this.demo.business();
    const original = business.invoices.find((i) => i.id === id);
    if (!original) return null;
    const status = invoiceStatus(original, business);
    if (status !== 'open' && status !== 'overdue') return null;

    const cancellationId = this.newInvoiceId(business);
    const number = nextInvoiceNumber(business, DEMO_TODAY.slice(0, 4));
    const cancellation: Invoice = {
      ...original,
      id: cancellationId,
      number,
      customer: { ...original.customer },
      lines: original.lines.map((line) => ({ ...line, quantity: -line.quantity })),
      issueDate: DEMO_TODAY,
      sentOn: DEMO_TODAY,
      docId: `doc-${cancellationId}`,
      paymentIds: [],
      reminders: [],
      seller: original.seller,
      cancelledBy: null,
      cancels: original.id,
      history: [{ date: DEMO_TODAY, key: 'invoiceCancellation', params: { number: original.number ?? '' } }],
    };
    const cancelledLine: HistoryEntry = { date: DEMO_TODAY, key: 'invoiceCancelled', params: { number } };

    this.demo.addDocument(business.id, { ...invoiceDocFor(cancellation, business), history: cancellation.history });
    this.demo.saveInvoice(cancellation);
    this.demo.saveInvoice({ ...original, cancelledBy: cancellationId, history: [cancelledLine, ...original.history] });
    if (original.docId !== null) {
      this.demo.updateDocument(original.docId, (doc) => ({
        ...doc,
        invoice: doc.invoice && { ...doc.invoice, cancelled: true },
        history: [cancelledLine, ...doc.history],
      }));
    }
    return cancellationId;
  }

  /**
   * Makes a new draft in the open business from an invoice (a corrected copy, or the same job again): the same customer,
   * lines, language and VAT rate, today as the invoice date, the current month as the service period, and the term of the
   * invoice details. The rate an invoice was forced to 0 % by a note is not copied: the copy starts at 19 % and follows the
   * tax details again. Returns the new draft's id. An id with no invoice is a mistake of the caller: it throws.
   */
  duplicate(id: string): string {
    const business = this.demo.business();
    const source = business.invoices.find((i) => i.id === id);
    if (!source) throw new Error(`There is no invoice ${id} to duplicate`);
    const copy: Invoice = {
      ...blankDraft(business, this.newInvoiceId(business)),
      customer: { ...source.customer },
      lines: source.lines.map((line) => ({ ...line })),
      vatRate: source.sentOn !== null && source.taxNote !== null ? 19 : source.vatRate,
      language: source.language,
      history: [{ date: DEMO_TODAY, key: 'invoiceDuplicated', params: { number: source.number ?? '' } }],
    };
    this.demo.saveInvoice(copy);
    return copy.id;
  }

  /**
   * The customer paid what is left of an invoice of the open business in cash, on `date` (a day up to today): a booked
   * incoming payment on the cash box (which the business gets when it has none) that pays the invoice. Ignored for an
   * invoice that has nothing left to pay (a draft, a cancelled or paid one), an unknown id, and a date that is not a day up to today.
   */
  markPaidInCash(id: string, date: string): void {
    const found = this.payable(id);
    if (!found || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > DEMO_TODAY) return;
    this.demo.addCashBox();
    const business = this.demo.business();
    const cash = business.accounts.find((account) => account.kind === 'cash');
    if (!cash) return;
    const paidInCash: HistoryEntry = { date, key: 'paidInCash', params: {} };
    const tx = paymentFor(business, found.invoice, cash.id, date, '', [paidInCash]);
    this.demo.addTransaction(tx);
    this.demo.saveInvoice({ ...found.invoice, history: [paidInCash, ...found.invoice.history] });
    this.demo.linkInvoicePayment(id, tx.id, false);
  }

  /** Whether the demo can let the customer pay an invoice of the open business: it has something left to pay, and a bank that works (see `receivingBank`) is connected to receive the money. */
  canSimulatePayment(id: string): boolean {
    return this.simulation(id) !== null;
  }

  /**
   * Demo only: the customer pays what is left of an invoice of the open business. An incoming payment of that amount, with
   * the invoice's number as its reference, arrives on the first bank account whose connection works today, booked and
   * confirmed; the system matches it to the invoice at once (the reference names it, so it is certain), so the invoice
   * turns paid or stays partly paid, in front of the person. Ignored while no bank works (not connected yet, or its
   * sign-in ended), and for an invoice with nothing left to pay (see `canSimulatePayment`).
   */
  simulatePayment(id: string): void {
    const found = this.simulation(id);
    if (!found) return;
    const { bank } = found;
    const booking = revenueBookingFor(found.invoice, found.business.taxProfile);
    const tx = paymentFor(found.business, found.invoice, bank.id, DEMO_TODAY, CUSTOMER_IBAN, [
      { date: DEMO_TODAY, key: 'autoBooked', params: { category: booking.labelKey } },
      { date: DEMO_TODAY, key: 'imported', params: { account: bank.name } },
    ]);
    this.demo.addTransaction(tx);
    const match = invoiceMatch(this.demo.business(), tx);
    if (match?.certain) this.demo.linkInvoicePayment(match.invoice.id, tx.id, true);
  }

  /** The person says yes to "Is this the payment for this invoice?" in the review inbox: the payment pays the invoice (see `DemoStateService.linkInvoicePayment`). */
  confirmMatch(txId: string, invoiceId: string): void {
    this.demo.linkInvoicePayment(invoiceId, txId, false);
  }

  /** An invoice id of the business that neither one of its invoices nor anything this service handed out before has. */
  private newInvoiceId(business: Business): string {
    const prefix = `inv-${business.id}`;
    const reserved = [...this.handedOut].filter((id) => id.startsWith(`${prefix}-`));
    const id = newId(prefix, [...business.invoices.map((i) => i.id), ...reserved]);
    this.handedOut.add(id);
    return id;
  }

  /** The open business with its invoice of this id, when the invoice is sent, not cancelled, and has something left to pay. */
  private payable(id: string): { business: Business; invoice: Invoice } | null {
    const business = this.demo.business();
    const invoice = business.invoices.find((i) => i.id === id);
    if (!invoice) return null;
    const status = invoiceStatus(invoice, business);
    const open = status === 'open' || status === 'overdue' || status === 'partlyPaid';
    return open && leftCents(invoice, business) > 0 ? { business, invoice } : null;
  }

  /** What a simulated payment needs: an invoice with something left to pay, the bank that receives it, and the bank step done. */
  private simulation(id: string): { business: Business; invoice: Invoice; bank: Account } | null {
    const found = this.payable(id);
    const bank = found && this.demo.bankConnected() ? receivingBank(found.business) : null;
    return found && bank ? { ...found, bank } : null;
  }

  /** Marks an invoice as on its way for `SEND_MS`, then resolves with what `complete` says, unless Reset demo came in meanwhile. */
  private afterSendTime(invoiceId: string, complete: () => boolean): Promise<boolean> {
    const generation = this.demo.dataGeneration();
    const way: OnItsWay = { invoiceId, generation };
    this.onItsWay.set(way);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Only its own mark: after a reset another send may be on its way by now.
        if (this.onItsWay() === way) this.onItsWay.set(null);
        resolve(this.demo.dataGeneration() === generation && complete());
      }, SEND_MS);
    });
  }

  private invoiceOf(businessId: string, id: string): { business: Business; invoice: Invoice } | null {
    const business = this.demo.businesses.find((b) => b.id === businessId);
    const invoice = business?.invoices.find((i) => i.id === id);
    return business && invoice ? { business, invoice } : null;
  }

  /** The draft is sent now: it gets its number, keeps the rate, note and seller details it has now, and its document appears. */
  private recordSent(businessId: string, id: string, email: InvoiceEmail): boolean {
    const found = this.invoiceOf(businessId, id);
    if (!found || !canSendInvoice(found.invoice, found.business, this.demo.stepsOf(businessId))) return false;
    const { business, invoice: draft } = found;
    const sentLine: HistoryEntry = { date: DEMO_TODAY, key: 'invoiceSent', params: { email: email.to } };
    const sent: Invoice = {
      ...draft,
      number: nextInvoiceNumber(business, DEMO_TODAY.slice(0, 4)),
      vatRate: effectiveVatRate(draft, business.taxProfile),
      taxNote: effectiveTaxNote(draft, business.taxProfile),
      seller: sellerOf(business),
      sentOn: DEMO_TODAY,
      docId: `doc-${draft.id}`,
      history: [sentLine, ...draft.history],
    };
    this.demo.addDocument(businessId, { ...invoiceDocFor(sent, business), history: [sentLine] });
    this.demo.saveInvoice(sent, businessId);
    return true;
  }

  /** The reminder is sent now, if it is still the one on offer. */
  private recordReminder(businessId: string, id: string, level: 1 | 2): boolean {
    const found = this.invoiceOf(businessId, id);
    if (!found || reminderState(found.invoice, found.business).next !== level) return false;
    this.demo.saveInvoice(
      {
        ...found.invoice,
        reminders: [...found.invoice.reminders, { level, sentOn: DEMO_TODAY }],
        history: [{ date: DEMO_TODAY, key: 'invoiceReminded', params: { level: String(level) } }, ...found.invoice.history],
      },
      businessId,
    );
    return true;
  }
}
