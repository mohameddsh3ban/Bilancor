import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { canPayPrivately, paidFromReceiptFor, payDayAllowed } from '../domain/cash-payments';
import { linkDocument } from '../domain/document-actions';
import { isClosedDate } from '../domain/months';
import { canWriteSelfIssued, selfIssuedDocFor, selfIssuedProblems, withoutVat, type SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from './demo-state.service';
import { UNDO_MS } from './review.service';

/** Where the person writes a self-issued receipt from: the payment's own page (which respects closed months), or the review inbox (which does not). */
export type SelfIssuedFrom = 'payment' | 'inbox';

/** How a received receipt was paid without a bank: in cash from the cash box, or with the owner's own money. */
export type PaidHow = 'cash' | 'own';

/** A receipt that was just written from a payment's page and can still be taken back: the payment and the document, and the receipt's number. */
export interface WrittenReceipt {
  txId: string;
  docId: string;
  number: string;
}

/** A receipt that was just marked as paid and can still be taken back: the payment made from it, the receipt, and how it was paid. */
export interface PaidReceipt {
  txId: string;
  docId: string;
  how: PaidHow;
}

/** What Undo needs of the last thing done: the data as it was before it, and which business and data it belongs to. */
type UndoStep = { snapshot: Business; scope: string } & ({ kind: 'written'; written: WrittenReceipt } | { kind: 'paid'; paid: PaidReceipt });

/**
 * Writes the receipts a person makes, and the payments they say were made without a bank, for the open business. Every change goes
 * through `DemoStateService`, so Documents, Payments, the review inbox and the taxes follow, and Reset demo takes it all back.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly demo = inject(DemoStateService);

  /** The business and the data generation the data belongs to: a change made in other data is never taken back into this. */
  private readonly scope = computed(() => `${this.demo.business().id}:${this.demo.dataGeneration()}`);
  /** The one thing that can be taken back now: the newest receipt written or marked as paid. A newer one takes the offer over. */
  private readonly step = signal<UndoStep | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The receipt just written from a payment's page, while Undo is on offer (see `undoWritten`); null once the time is over or the data changed. */
  readonly justWritten = computed<WrittenReceipt | null>(() => {
    const step = this.step();
    return step?.kind === 'written' && step.scope === this.scope() ? { ...step.written } : null;
  });

  /** The receipt just marked as paid, while Undo is on offer (see `undoPaid`); null once the time is over or the data changed. */
  readonly justPaid = computed<PaidReceipt | null>(() => {
    const step = this.step();
    return step?.kind === 'paid' && step.scope === this.scope() ? { ...step.paid } : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /**
   * Writes a self-issued receipt (Eigenbeleg) for a payment of the open business, as the signed-in person who confirms it is true: the
   * receipt is added to Documents, linked to the payment by hand (so the payment counts as worked on, an imported one too), and the
   * payment keeps its category but at 0 % VAT, with a `vatRemovedSelfIssued` line (see `withoutVat`). Returns the id of the receipt's
   * document, or null, with nothing changed, for a payment that can't have one (see `canWriteSelfIssued`) and for input that is not
   * complete (see `selfIssuedProblems`: the caller asks for the tick before it calls this).
   *
   * From the payment's page a payment in a closed month can't have a receipt, and the receipt can be taken back for `UNDO_MS` (see
   * `justWritten` and `undoWritten`: the same snapshot and restore as the review inbox's Undo). From the review inbox the closed months
   * are not checked, as Documents does not check them either, and Undo is the inbox's own: it takes `snapshot()` before the answer and
   * `restore()`s it. Either way the receipt goes with its number, so none is ever left out.
   */
  createSelfIssued(txId: string, input: SelfIssuedInput, from: SelfIssuedFrom): string | null {
    const business = this.demo.business();
    const tx = business.transactions.find((t) => t.id === txId);
    if (!tx) return null;
    const isClosed = from === 'payment' ? (month: string) => isClosedDate(business, `${month}-01`) : () => false;
    if (!canWriteSelfIssued(tx, isClosed) || selfIssuedProblems(input, true).length > 0) return null;

    const snapshot = this.demo.snapshot();
    const person = this.demo.person;
    const doc = selfIssuedDocFor(business, tx, input, `${person.firstName} ${person.lastName}`, DEMO_TODAY);
    this.demo.addDocument(business.id, doc);
    this.demo.link(doc.id, txId, false, business.id);
    this.demo.updateTransaction(txId, (current) => withoutVat(current));
    if (from === 'payment') {
      this.offerUndo({ kind: 'written', written: { txId, docId: doc.id, number: doc.invoiceNo }, snapshot, scope: this.scope() });
    }
    return doc.id;
  }

  /** Takes back the receipt just written from a payment's page, with the 0 % VAT it took off and its number. Does nothing once the time is over. */
  undoWritten(): void {
    const step = this.takeStep('written');
    if (step) this.demo.restore(step.snapshot);
  }

  /**
   * The person says a received receipt of the open business was paid on `day` in cash, from the cash box (`how` is `cash`; the business
   * gets one when it has none), or with their own money (`own`; the business gets its Own money account when it has none). The money
   * out of the receipt's amount is added as a payment of that account, booked and confirmed with the receipt's category and VAT
   * (none for a Kleinunternehmer), and the receipt is linked to it, so the payment counts for the VAT return and the year like any
   * other. Neither way ticks the bank step, and the review inbox has no question about it. Returns the id of the payment, or null, with
   * nothing changed, for a document that is not a received receipt waiting for its payment (see `canPayPrivately`: an invoice written in
   * Invoices is paid in Invoices) and for a day that is not from the receipt's date up to today (see `payDayAllowed`). As Documents
   * doesn't check closed months, neither does this.
   *
   * The payment can be taken back for `UNDO_MS` (see `justPaid` and `undoPaid`), with the same offer as a self-issued receipt. Later it
   * is locked to its receipt (see `lockedToReceipt`). An account the call made stays when it is undone: it is only an account.
   */
  markPaid(docId: string, how: PaidHow, day: string): string | null {
    const business = this.demo.business();
    const doc = business.documents.find((d) => d.id === docId);
    if (!doc || !canPayPrivately(doc) || !payDayAllowed(doc, day, DEMO_TODAY)) return null;

    const snapshot = this.demo.snapshot();
    if (how === 'cash') this.demo.addCashBox();
    else this.demo.addOwnMoneyAccount();
    const kind = how === 'cash' ? 'cash' : 'own';
    const account = this.demo.business().accounts.find((a) => a.kind === kind);
    if (!account) return null;

    const tx = paidFromReceiptFor(doc, account, day, business.taxProfile.kleinunternehmer);
    this.demo.addTransaction(tx, business.id);
    // `link` wants a payment whose receipt is missing; this one is made with its receipt, so only the receipt's side of the link is written (see `linkDocument`).
    this.demo.updateDocument(doc.id, (d) => linkDocument(d, tx, false).doc, business.id);
    this.offerUndo({ kind: 'paid', paid: { txId: tx.id, docId: doc.id, how }, snapshot, scope: this.scope() });
    return tx.id;
  }

  /**
   * Takes back the payment just made from a receipt (see `markPaid`): the payment is gone and the receipt waits for its payment again.
   * Does nothing once the time is over, for another payment than the one on offer, and a second time.
   */
  undoPaid(txId: string): void {
    if (this.justPaid()?.txId !== txId) return;
    const step = this.takeStep('paid');
    if (step) this.demo.restore(step.snapshot);
  }

  /** The step on offer when it is of this kind and belongs to the data that is open now; the offer ends. Null otherwise, and nothing ends. */
  private takeStep(kind: UndoStep['kind']): UndoStep | null {
    const step = this.step();
    if (step === null || step.kind !== kind || step.scope !== this.scope()) return null;
    clearTimeout(this.timer);
    this.step.set(null);
    return step;
  }

  private offerUndo(step: UndoStep): void {
    clearTimeout(this.timer);
    this.step.set(step);
    this.timer = setTimeout(() => this.step.set(null), UNDO_MS);
  }
}
