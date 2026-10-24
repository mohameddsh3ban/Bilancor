import { TestBed } from '@angular/core/testing';
import { REVENUE_19, REVENUE_KU } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Doc, Invoice, Transaction } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { connectionStatus } from '../domain/bank-connection';
import { paymentFor } from '../domain/cash-payments';
import { docStatus, visibleDocuments } from '../domain/document-status';
import {
  effectiveVatRate,
  invoiceTotals,
  invoiceStatus,
  leftCents,
  nextInvoiceNumber,
  owedSummary,
  reminderState,
  sellerOf,
} from '../domain/invoices';
import { paymentStatus } from '../domain/payment-status';
import { DemoStateService } from './demo-state.service';
import { InvoiceService, SEND_MS } from './invoice.service';

describe('InvoiceService', () => {
  let demo: DemoStateService;
  let invoices: InvoiceService;

  const EMAIL = { to: 'rechnungseingang@bezirksamt-pankow.example', subject: 'Rechnung', body: 'Guten Tag' };

  const sample = (id = 'weber-design'): Business => BUSINESSES.find((b) => b.id === id)!;
  const businessOf = (id = 'weber-design'): Business => demo.businesses.find((b) => b.id === id)!;
  const invoiceOf = (id: string, businessId = 'weber-design'): Invoice => businessOf(businessId).invoices.find((i) => i.id === id)!;
  const docOf = (id: string, businessId = 'weber-design'): Doc => businessOf(businessId).documents.find((d) => d.id === id)!;
  const paymentOf = (id: string, businessId = 'weber-design'): Transaction => businessOf(businessId).transactions.find((t) => t.id === id)!;
  const statusOf = (id: string, businessId = 'weber-design') => invoiceStatus(invoiceOf(id, businessId), businessOf(businessId));
  const keys = (history: readonly { key: string }[]) => history.map((h) => h.key);
  const numbersOf = (businessId = 'weber-design') =>
    businessOf(businessId).invoices.map((i) => i.number).filter((n): n is string => n !== null);

  /** Sends a draft and lets the sending time pass. */
  async function sendAndWait(id = 'inv-wd-draft'): Promise<boolean> {
    const result = invoices.send(id, EMAIL);
    await vi.advanceTimersByTimeAsync(SEND_MS);
    return result;
  }

  /** Sends a reminder and lets the sending time pass. */
  async function remindAndWait(id: string, level: 1 | 2): Promise<boolean> {
    const result = invoices.remind(id, level, EMAIL);
    await vi.advanceTimersByTimeAsync(SEND_MS);
    return result;
  }

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
    demo = TestBed.inject(DemoStateService);
    invoices = TestBed.inject(InvoiceService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('drafts', () => {
    it('newDraft is not saved, and takes its dates, term and language from the invoice details', () => {
      const draft = invoices.newDraft();
      expect(draft).toMatchObject({
        number: null,
        sentOn: null,
        docId: null,
        lines: [],
        vatRate: 19,
        taxNote: null,
        seller: null,
        language: 'de',
        issueDate: DEMO_TODAY,
        servicePeriod: { kind: 'month', month: '2026-10' },
        paymentTermDays: 14,
        paymentIds: [],
        reminders: [],
        cancelledBy: null,
        cancels: null,
        history: [{ date: DEMO_TODAY, key: 'invoiceCreated', params: {} }],
      });
      expect(draft.customer).toMatchObject({ name: '', country: 'DE', kind: 'business', email: '', vatId: null, leitwegId: null });
      expect(businessOf().invoices.some((i) => i.id === draft.id)).toBe(false);

      demo.saveInvoiceProfile({ ...businessOf().invoiceProfile, paymentTermDays: 30, language: 'en' });
      expect(invoices.newDraft()).toMatchObject({ paymentTermDays: 30, language: 'en' });
    });

    it('saveDraft saves a new draft, replaces it on the next save, and never touches a sent invoice', () => {
      const draft = invoices.newDraft();
      const count = businessOf().invoices.length;
      invoices.saveDraft(draft);
      expect(businessOf().invoices).toHaveLength(count + 1);
      expect(invoiceOf(draft.id)).toEqual(draft);

      const edited: Invoice = { ...draft, paymentTermDays: 7 };
      invoices.saveDraft(edited);
      expect(businessOf().invoices).toHaveLength(count + 1);
      expect(invoiceOf(draft.id).paymentTermDays).toBe(7);

      // Two new drafts never share an id.
      expect(invoices.newDraft().id).not.toBe(draft.id);

      // A sent invoice, or a draft that was sent meanwhile, is not replaced.
      const business = businessOf();
      invoices.saveDraft({ ...invoiceOf('inv-wd-044'), paymentTermDays: 99 });
      invoices.saveDraft({ ...invoiceOf('inv-wd-draft'), sentOn: DEMO_TODAY, number: 'RE-2026-999' });
      expect(businessOf()).toBe(business);
    });

    it('two new drafts in a row never share an id, saved or not', () => {
      const first = invoices.newDraft();
      const second = invoices.newDraft();
      expect(second.id).not.toBe(first.id);

      const count = businessOf().invoices.length;
      invoices.saveDraft(first);
      invoices.saveDraft(second);
      expect(businessOf().invoices).toHaveLength(count + 2);

      expect(new Set([first.id, second.id, invoices.newDraft().id]).size).toBe(3);
    });

    it('a draft that is not saved yet keeps its id when a copy or a cancellation invoice is made meanwhile', () => {
      const draft = invoices.newDraft();
      const copyId = invoices.duplicate('inv-wd-044');
      const cancellationId = invoices.cancel('inv-wd-044')!;
      expect(new Set([draft.id, copyId, cancellationId]).size).toBe(3);

      invoices.saveDraft(draft);
      expect(invoiceOf(draft.id).customer.name).toBe('');
      expect(invoiceOf(copyId).customer.name).toBe('Studio Kern');
      expect(invoiceOf(cancellationId).cancels).toBe('inv-wd-044');
    });

    it('a copy made before a new draft is saved does not share its id either', () => {
      const copyId = invoices.duplicate('inv-wd-044');
      const draft = invoices.newDraft();
      expect(draft.id).not.toBe(copyId);
      expect(invoices.newDraft().id).not.toBe(draft.id);
    });

    it('ids belong to the business that makes them', () => {
      demo.setBusiness('sara-yoga');
      expect(invoices.newDraft().id).toMatch(/^inv-sara-yoga-\d+$/);
    });
  });

  describe('send', () => {
    it('send gives RE-2026-045, freezes the rate and adds a visible sent doc', async () => {
      expect(invoices.sending()).toBeNull();
      const result = invoices.send('inv-wd-draft', EMAIL);
      expect(invoices.sending()).toBe('inv-wd-draft');

      await vi.advanceTimersByTimeAsync(SEND_MS - 1);
      expect(invoices.sending()).toBe('inv-wd-draft');
      expect(invoiceOf('inv-wd-draft').number).toBeNull();

      await vi.advanceTimersByTimeAsync(1);
      expect(await result).toBe(true);
      expect(invoices.sending()).toBeNull();

      const sent = invoiceOf('inv-wd-draft');
      expect(sent).toMatchObject({
        number: 'RE-2026-045',
        sentOn: DEMO_TODAY,
        issueDate: DEMO_TODAY,
        vatRate: 19,
        taxNote: null,
        docId: 'doc-inv-wd-draft',
      });
      expect(sent.history).toEqual([
        { date: DEMO_TODAY, key: 'invoiceSent', params: { email: EMAIL.to } },
        { date: DEMO_TODAY, key: 'invoiceCreated', params: {} },
      ]);
      expect(statusOf('inv-wd-draft')).toBe('open');

      const doc = docOf('doc-inv-wd-draft');
      expect(doc).toMatchObject({
        direction: 'sent',
        name: 'Bezirksamt Pankow',
        invoiceNo: 'RE-2026-045',
        fileName: 'RE-2026-045.pdf',
        amountCents: 416500,
        dueDate: '2026-11-05',
        paymentId: null,
        bookingConfirmed: true,
        invoice: { id: 'inv-wd-draft', role: 'invoice', cancelled: false },
      });
      expect(doc.history).toEqual([{ date: DEMO_TODAY, key: 'invoiceSent', params: { email: EMAIL.to } }]);
      expect(visibleDocuments(demo.documents(), demo.setup())).toContain(doc);
      expect(docStatus(doc)).toBe('waiting');
      expect(nextInvoiceNumber(businessOf(), '2026')).toBe('RE-2026-046');

      // The rate is frozen: a later change of the tax answers does not change what the customer was charged.
      demo.saveTaxProfile({ ...businessOf().taxProfile, kleinunternehmer: true, vatPeriod: null, vatBasis: null });
      expect(effectiveVatRate(invoiceOf('inv-wd-draft'), businessOf().taxProfile)).toBe(19);
      expect(invoiceTotals(invoiceOf('inv-wd-draft'), businessOf().taxProfile).grossCents).toBe(416500);
    });

    it("send freezes the seller's details with the invoice, and a draft has none until then", async () => {
      expect(invoiceOf('inv-wd-draft').seller).toBeNull();
      const atSending = sellerOf(businessOf());
      expect(atSending).toEqual({
        name: 'Weber Design',
        street: 'Lindenstr. 5',
        postcode: '10969',
        city: 'Berlin',
        email: 'weber-design@invoices.example',
        iban: 'DE08100101010482913650',
        taxNumber: '27/123/45678',
        vatId: null,
      });

      expect(await sendAndWait()).toBe(true);
      expect(invoiceOf('inv-wd-draft').seller).toEqual(atSending);

      // Changing Settings later leaves the sent invoice as it was sent.
      demo.saveInvoiceProfile({ ...businessOf().invoiceProfile, street: 'Neue Str. 9', iban: 'DE02120300000000202051' });
      demo.saveTaxProfile({ ...businessOf().taxProfile, taxNumber: '11/222/33333' });
      expect(invoiceOf('inv-wd-draft').seller).toEqual(atSending);
      expect(sellerOf(businessOf())).not.toEqual(atSending);
    });

    it("the seller's details are the ones of the moment the invoice is sent, as its number is", async () => {
      const result = invoices.send('inv-wd-draft', EMAIL);
      demo.saveInvoiceProfile({ ...businessOf().invoiceProfile, street: 'Neue Str. 9' });
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await result).toBe(true);
      expect(invoiceOf('inv-wd-draft').seller?.street).toBe('Neue Str. 9');
    });

    it('send freezes 0 % and the note for a business in another EU country (the seller needs a VAT ID of their own for that)', async () => {
      const draft = invoiceOf('inv-wd-draft');
      demo.saveTaxProfile({ ...businessOf().taxProfile, vatId: 'DE123456789' });
      demo.saveInvoice({
        ...draft,
        customer: { ...draft.customer, kind: 'business', country: 'AT', vatId: 'ATU12345678', leitwegId: null },
      });
      expect(await sendAndWait()).toBe(true);
      expect(invoiceOf('inv-wd-draft')).toMatchObject({ vatRate: 0, taxNote: 'reverseCharge' });
      expect(docOf('doc-inv-wd-draft')).toMatchObject({ amountCents: 350000, vatRate: 0 });
    });

    it("send is refused while the checklist isn't complete", async () => {
      const before = businessOf();
      const draft = invoiceOf('inv-wd-draft');

      // The customer's email is missing.
      demo.saveInvoice({ ...draft, customer: { ...draft.customer, email: '' } });
      expect(await invoices.send('inv-wd-draft', EMAIL)).toBe(false);
      expect(invoices.sending()).toBeNull();

      // The draft is complete, but the tax details are not done.
      demo.saveInvoice(draft);
      demo.setSetup('halfway');
      expect(await invoices.send('inv-wd-draft', EMAIL)).toBe(false);
      expect(invoices.sending()).toBeNull();

      // Sent already, or not there at all.
      demo.setSetup('active');
      expect(await invoices.send('inv-wd-044', EMAIL)).toBe(false);
      expect(await invoices.send('nope', EMAIL)).toBe(false);

      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(businessOf()).toEqual(before);
    });

    it("the document of an invoice dated earlier this year is dated with the invoice, and added on the day it was sent", async () => {
      demo.saveInvoice({ ...invoiceOf('inv-wd-draft'), issueDate: '2026-10-01' });
      expect(await sendAndWait()).toBe(true);

      expect(invoiceOf('inv-wd-draft')).toMatchObject({ issueDate: '2026-10-01', sentOn: DEMO_TODAY, number: 'RE-2026-045' });
      expect(docOf('doc-inv-wd-draft')).toMatchObject({
        date: '2026-10-01',
        addedOn: DEMO_TODAY,
        dueDate: '2026-10-15',
      });
      expect(docOf('doc-inv-wd-draft').history).toEqual([{ date: DEMO_TODAY, key: 'invoiceSent', params: { email: EMAIL.to } }]);
      expect(statusOf('inv-wd-draft')).toBe('overdue');
      expect(docStatus(docOf('doc-inv-wd-draft'))).toBe('overdue');
    });

    it('a draft dated before this year or after today is not sent', async () => {
      const before = businessOf();
      for (const issueDate of ['2025-11-03', '2025-12-31', '2026-10-23', '2027-01-05']) {
        demo.saveInvoice({ ...invoiceOf('inv-wd-draft'), issueDate });
        expect(await sendAndWait(), issueDate).toBe(false);
        expect(invoiceOf('inv-wd-draft').sentOn, issueDate).toBeNull();
      }
      demo.saveInvoice(before.invoices.find((i) => i.id === 'inv-wd-draft')!);
      expect(businessOf()).toEqual(before);

      // The first day of the year is fine.
      demo.saveInvoice({ ...invoiceOf('inv-wd-draft'), issueDate: '2026-01-01' });
      expect(await sendAndWait()).toBe(true);
    });

    it('a second send while one is on its way returns false and sends nothing twice', async () => {
      const copy = invoices.duplicate('inv-wd-041');
      const first = invoices.send('inv-wd-draft', EMAIL);
      await vi.advanceTimersByTimeAsync(SEND_MS - 100);
      expect(await invoices.send(copy, EMAIL)).toBe(false);
      expect(await invoices.remind('inv-wd-039', 1, EMAIL)).toBe(false);

      await vi.advanceTimersByTimeAsync(100);
      expect(await first).toBe(true);
      expect(invoiceOf(copy).number).toBeNull();
      expect(numbersOf()).toContain('RE-2026-045');
    });

    it('reset during sending sends nothing', async () => {
      const result = invoices.send('inv-wd-draft', EMAIL);
      await vi.advanceTimersByTimeAsync(SEND_MS - 100);
      demo.resetData();
      expect(invoices.sending()).toBeNull(); // at once, not when the time is up

      await vi.advanceTimersByTimeAsync(100);
      expect(await result).toBe(false);
      expect(invoices.sending()).toBeNull();
      expect(businessOf().invoices).toEqual(sample().invoices);
      expect(businessOf().documents).toEqual(sample().documents);
    });

    it('a send dropped by a reset lets the next one go ahead, and the dropped one ending does not cut it short', async () => {
      const dropped = invoices.send('inv-wd-draft', EMAIL);
      await vi.advanceTimersByTimeAsync(SEND_MS / 2);
      demo.resetData();

      const next = invoices.send('inv-wd-draft', EMAIL);
      expect(invoices.sending()).toBe('inv-wd-draft');

      await vi.advanceTimersByTimeAsync(SEND_MS / 2);
      expect(await dropped).toBe(false);
      expect(invoices.sending()).toBe('inv-wd-draft');

      await vi.advanceTimersByTimeAsync(SEND_MS / 2);
      expect(await next).toBe(true);
      expect(invoices.sending()).toBeNull();
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');
    });

    it('a draft removed or edited while it is being sent: removed sends nothing, edits are not saved', async () => {
      const removed = invoices.send('inv-wd-draft', EMAIL);
      demo.removeInvoice('inv-wd-draft');
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await removed).toBe(false);
      expect(docOf('doc-inv-wd-draft')).toBeUndefined();
      expect(invoices.sending()).toBeNull();

      demo.resetData();
      const edited = invoices.send('inv-wd-draft', EMAIL);
      invoices.saveDraft({ ...invoiceOf('inv-wd-draft'), paymentTermDays: 60 });
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await edited).toBe(true);
      expect(invoiceOf('inv-wd-draft').paymentTermDays).toBe(14);
    });

    it('is recorded for the business it was sent for, even when another one is open by then', async () => {
      const cafe = businessOf('cafe-linde');
      const result = invoices.send('inv-wd-draft', EMAIL);
      demo.setBusiness('cafe-linde');
      expect(invoices.sending()).toBe('inv-wd-draft');

      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await result).toBe(true);
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');
      expect(businessOf('cafe-linde')).toBe(cafe);
    });

    it('numbers stay unique through send, cancel and reset', async () => {
      expect(await sendAndWait()).toBe(true);
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');

      const cancellation = invoices.cancel('inv-wd-draft')!;
      expect(invoiceOf(cancellation).number).toBe('RE-2026-046');

      const copy = invoices.duplicate('inv-wd-draft');
      expect(await sendAndWait(copy)).toBe(true);
      expect(invoiceOf(copy).number).toBe('RE-2026-047');
      expect(new Set(numbersOf()).size).toBe(numbersOf().length);

      demo.resetData();
      expect(numbersOf()).toEqual(sample().invoices.map((i) => i.number).filter((n) => n !== null));
      expect(await sendAndWait()).toBe(true);
      expect(invoiceOf('inv-wd-draft').number).toBe('RE-2026-045');
    });
  });

  describe('remind', () => {
    it('remind level 1 then level 2 only after 7 days', async () => {
      // Bäckerei Lange: overdue and never reminded, so only the friendly reminder.
      expect(await remindAndWait('inv-wd-039', 2)).toBe(false);
      expect(invoiceOf('inv-wd-039').reminders).toEqual([]);

      const result = invoices.remind('inv-wd-039', 1, EMAIL);
      expect(invoices.sending()).toBe('inv-wd-039');
      await vi.advanceTimersByTimeAsync(SEND_MS);
      expect(await result).toBe(true);
      expect(invoices.sending()).toBeNull();
      expect(invoiceOf('inv-wd-039').reminders).toEqual([{ level: 1, sentOn: DEMO_TODAY }]);
      expect(invoiceOf('inv-wd-039').history[0]).toEqual({ date: DEMO_TODAY, key: 'invoiceReminded', params: { level: '1' } });
      expect(statusOf('inv-wd-039')).toBe('overdue'); // a reminder never changes the status

      // The formal reminder is possible 7 days later, not today, and the friendly one is not sent twice.
      expect(reminderState(invoiceOf('inv-wd-039'), businessOf())).toEqual({ next: null, availableFrom: '2026-10-29' });
      expect(await remindAndWait('inv-wd-039', 2)).toBe(false);
      expect(await remindAndWait('inv-wd-039', 1)).toBe(false);
      expect(invoiceOf('inv-wd-039').reminders).toHaveLength(1);

      // Café Linde's RE-2026-053 was reminded on 12 October: the formal reminder is possible, once.
      demo.setBusiness('cafe-linde');
      expect(await remindAndWait('inv-cl-053', 1)).toBe(false);
      expect(await remindAndWait('inv-cl-053', 2)).toBe(true);
      expect(invoiceOf('inv-cl-053', 'cafe-linde').reminders).toEqual([
        { level: 1, sentOn: '2026-10-12' },
        { level: 2, sentOn: DEMO_TODAY },
      ]);
      expect(invoiceOf('inv-cl-053', 'cafe-linde').history[0]).toEqual({ date: DEMO_TODAY, key: 'invoiceReminded', params: { level: '2' } });
      expect(await remindAndWait('inv-cl-053', 2)).toBe(false);
    });

    it('reminds only an invoice that is overdue', async () => {
      const before = businessOf();
      expect(await remindAndWait('inv-wd-044', 1)).toBe(false); // open, not due yet
      expect(await remindAndWait('inv-wd-041', 1)).toBe(false); // paid
      expect(await remindAndWait('inv-wd-040', 1)).toBe(false); // cancelled
      expect(await remindAndWait('inv-wd-draft', 1)).toBe(false);
      expect(await remindAndWait('nope', 1)).toBe(false);
      expect(businessOf()).toBe(before);
    });

    it('a reminder is dropped when the invoice was paid while it was on its way', async () => {
      const result = invoices.remind('inv-wd-039', 1, EMAIL);
      demo.addTransaction({ ...paymentOf('wd-t19'), id: 'wd-t90', amountCents: 119000, reference: 'Zahlung' });
      demo.linkInvoicePayment('inv-wd-039', 'wd-t90', false);
      await vi.advanceTimersByTimeAsync(SEND_MS);

      expect(await result).toBe(false);
      expect(invoiceOf('inv-wd-039').reminders).toEqual([]);
      expect(invoices.sending()).toBeNull();
    });

    it('reset during a reminder sends nothing', async () => {
      const result = invoices.remind('inv-wd-039', 1, EMAIL);
      await vi.advanceTimersByTimeAsync(SEND_MS - 100);
      demo.resetData();
      await vi.advanceTimersByTimeAsync(100);
      expect(await result).toBe(false);
      expect(businessOf().invoices).toEqual(sample().invoices);
    });
  });

  describe('cancel and duplicate', () => {
    it('cancel creates RE-2026-04x cancellation and marks the original cancelled', () => {
      const original = invoiceOf('inv-wd-044');
      expect(owedSummary(businessOf(), demo.setup()).owedCents).toBe(357000);

      const id = invoices.cancel('inv-wd-044');
      expect(id).not.toBeNull();
      expect(businessOf().invoices.filter((i) => i.id === id)).toHaveLength(1);

      const cancellation = invoiceOf(id!);
      expect(cancellation).toMatchObject({
        number: 'RE-2026-045',
        cancels: 'inv-wd-044',
        cancelledBy: null,
        customer: original.customer,
        vatRate: 19,
        taxNote: null,
        language: original.language,
        issueDate: DEMO_TODAY,
        sentOn: DEMO_TODAY,
        paymentIds: [],
        reminders: [],
      });
      expect(cancellation.lines).toEqual(original.lines.map((line) => ({ ...line, quantity: -line.quantity })));
      expect(invoiceTotals(cancellation, businessOf().taxProfile).grossCents).toBe(-238000);
      expect(statusOf(id!)).toBe('cancellation');
      expect(cancellation.history).toEqual([{ date: DEMO_TODAY, key: 'invoiceCancellation', params: { number: 'RE-2026-044' } }]);

      // Its document: sent, on record, done from the start.
      const cancellationDoc = docOf(cancellation.docId!);
      expect(cancellationDoc).toMatchObject({
        direction: 'sent',
        invoiceNo: 'RE-2026-045',
        amountCents: 238000,
        dueDate: null,
        paymentId: null,
        invoice: { id, role: 'cancellation', cancelled: false },
      });
      expect(cancellationDoc.history).toEqual([{ date: DEMO_TODAY, key: 'invoiceCancellation', params: { number: 'RE-2026-044' } }]);
      expect(docStatus(cancellationDoc)).toBe('done');

      // The original stays on record, cancelled.
      expect(invoiceOf('inv-wd-044').cancelledBy).toBe(id);
      expect(invoiceOf('inv-wd-044').history[0]).toEqual({ date: DEMO_TODAY, key: 'invoiceCancelled', params: { number: 'RE-2026-045' } });
      expect(statusOf('inv-wd-044')).toBe('cancelled');
      expect(docOf('wd-d2').invoice).toEqual({ id: 'inv-wd-044', role: 'invoice', cancelled: true });
      expect(docOf('wd-d2').history[0]).toEqual({ date: DEMO_TODAY, key: 'invoiceCancelled', params: { number: 'RE-2026-045' } });
      expect(docStatus(docOf('wd-d2'))).toBe('done');

      // What is owed no longer counts it.
      expect(owedSummary(businessOf(), demo.setup()).owedCents).toBe(119000);
    });

    it("a cancellation invoice has the seller's details of the original, also after Settings changed", () => {
      const original = invoiceOf('inv-wd-044');
      expect(original.seller).toEqual(sellerOf(businessOf()));
      demo.saveInvoiceProfile({ ...businessOf().invoiceProfile, street: 'Neue Str. 9' });

      const id = invoices.cancel('inv-wd-044')!;
      expect(invoiceOf(id).seller).toEqual(original.seller);
      expect(invoiceOf(id).seller?.street).toBe('Lindenstr. 5');
    });

    it('cancel works on an overdue invoice too', () => {
      expect(statusOf('inv-wd-039')).toBe('overdue');
      expect(invoices.cancel('inv-wd-039')).not.toBeNull();
      expect(statusOf('inv-wd-039')).toBe('cancelled');
    });

    it("a paid invoice can't be cancelled, nor a partly paid one, a draft, a cancelled one or a cancellation invoice", () => {
      const before = businessOf();
      expect(invoices.cancel('inv-wd-041')).toBeNull(); // paid
      expect(invoices.cancel('inv-wd-draft')).toBeNull();
      expect(invoices.cancel('inv-wd-040')).toBeNull(); // already cancelled
      expect(invoices.cancel('inv-wd-042')).toBeNull(); // a cancellation invoice
      expect(invoices.cancel('nope')).toBeNull();
      expect(businessOf()).toBe(before);

      demo.setBusiness('sara-yoga');
      const sara = businessOf('sara-yoga');
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('partlyPaid');
      expect(invoices.cancel('inv-sy-021')).toBeNull();
      expect(businessOf('sara-yoga')).toBe(sara);
    });

    it('a cancellation invoice for a Kleinunternehmer keeps the note and no VAT', async () => {
      demo.setBusiness('sara-yoga');
      // Every sample invoice of Sara's is paid or part paid, so she sends a copy first.
      const copy = invoices.duplicate('inv-sy-019');
      expect(await sendAndWait(copy)).toBe(true);
      expect(invoiceOf(copy, 'sara-yoga').number).toBe('RE-2026-022');

      const id = invoices.cancel(copy)!;
      const cancellation = invoiceOf(id, 'sara-yoga');
      expect(cancellation).toMatchObject({ vatRate: 0, taxNote: 'kleinunternehmer', number: 'RE-2026-023' });
      expect(invoiceTotals(cancellation, businessOf('sara-yoga').taxProfile).grossCents).toBe(-96000);
    });

    it("duplicate makes a draft with today's dates", () => {
      const original = invoiceOf('inv-wd-041');
      demo.saveInvoiceProfile({ ...businessOf().invoiceProfile, paymentTermDays: 30 });
      const count = businessOf().invoices.length;

      const id = invoices.duplicate('inv-wd-041');
      expect(businessOf().invoices).toHaveLength(count + 1);
      expect(id).not.toBe('inv-wd-041');
      expect(invoiceOf(id)).toEqual({
        id,
        number: null,
        customer: original.customer,
        lines: original.lines,
        vatRate: 19,
        taxNote: null,
        seller: null, // a copy is a draft: it follows Settings until it is sent
        language: 'de',
        issueDate: DEMO_TODAY,
        servicePeriod: { kind: 'month', month: '2026-10' },
        paymentTermDays: 30, // the term of the invoice details, not the original's
        sentOn: null,
        docId: null,
        paymentIds: [],
        reminders: [],
        cancelledBy: null,
        cancels: null,
        history: [{ date: DEMO_TODAY, key: 'invoiceDuplicated', params: { number: 'RE-2026-041' } }],
      });
      expect(invoiceOf(id).customer).not.toBe(original.customer);
      expect(statusOf(id)).toBe('draft');
      // The original did not change.
      expect(invoiceOf('inv-wd-041')).toBe(original);
    });

    it('a duplicate keeps the invoice language and the chosen rate, and starts again at 19 % when a note forced 0 %', () => {
      const english: Invoice = { ...invoiceOf('inv-wd-041'), id: 'inv-en', language: 'en', vatRate: 7 };
      demo.saveInvoice(english);
      expect(invoiceOf(invoices.duplicate('inv-en'))).toMatchObject({ language: 'en', vatRate: 7 });

      demo.setBusiness('sara-yoga');
      const copy = invoiceOf(invoices.duplicate('inv-sy-019'), 'sara-yoga');
      expect(copy.vatRate).toBe(19);
      expect(effectiveVatRate(copy, businessOf('sara-yoga').taxProfile)).toBe(0); // while she is a Kleinunternehmer
    });

    it('duplicate of an invoice that does not exist is an error', () => {
      expect(() => invoices.duplicate('nope')).toThrow();
    });
  });

  describe('getting paid', () => {
    it('mark paid in cash adds a cash box and a booked payment, invoice paid', () => {
      demo.setBusiness('sara-yoga');
      expect(businessOf('sara-yoga').accounts.some((a) => a.kind === 'cash')).toBe(false);
      expect(leftCents(invoiceOf('inv-sy-021', 'sara-yoga'), businessOf('sara-yoga'))).toBe(30000);

      invoices.markPaidInCash('inv-sy-021', '2026-10-21');

      const sara = businessOf('sara-yoga');
      const cash = sara.accounts.filter((a) => a.kind === 'cash');
      expect(cash).toHaveLength(1);
      expect(sara.history[0].key).toBe('cashAdded');

      const invoice = invoiceOf('inv-sy-021', 'sara-yoga');
      expect(invoice.paymentIds).toHaveLength(2);
      const tx = sara.transactions[0]; // newest first
      expect(tx.id).toBe(invoice.paymentIds[1]);
      expect(tx).toMatchObject({
        date: '2026-10-21',
        counterparty: 'Physio Zentrum Mitte',
        accountId: cash[0].id,
        amountCents: 30000,
        booking: REVENUE_KU,
        confirmed: true,
        isPrivate: false,
        receipt: 'attached',
        receiptFile: 'RE-2026-021.pdf',
        reference: 'RE-2026-021',
      });
      expect(keys(tx.history)).toEqual(['paysInvoice', 'paidInCash']);
      expect(paymentStatus(tx)).toBe('booked');

      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('paid');
      expect(keys(invoice.history).slice(0, 2)).toEqual(['invoicePaid', 'paidInCash']);
      expect(invoice.history[0]).toEqual({ date: '2026-10-21', key: 'invoicePaid', params: { paymentId: tx.id } });
      expect(docOf('sy-d2', 'sara-yoga').paymentId).toBe(tx.id); // the payment that completes it
      expect(docStatus(docOf('sy-d2', 'sara-yoga'))).toBe('done');
    });

    it('invoice mark-as-paid still works through the shared builder: the payment is what `paymentFor` builds, linked to the invoice', () => {
      const before = businessOf();
      const cash = before.accounts.find((a) => a.kind === 'cash')!;
      const paidLine = { date: '2026-10-20', key: 'paidInCash' as const, params: {} };
      const built = paymentFor(before, invoiceOf('inv-wd-044'), cash.id, '2026-10-20', '', [paidLine]);

      invoices.markPaidInCash('inv-wd-044', '2026-10-20');

      const made = businessOf().transactions[0];
      expect(made.id).toBe(built.id);
      // What the builder makes, and what linking the invoice adds: its receipt, and the line that says it pays the invoice.
      expect(made).toEqual({
        ...built,
        receipt: 'attached',
        receiptFile: 'RE-2026-044.pdf',
        history: [{ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-044' } }, paidLine],
      });
      expect(statusOf('inv-wd-044')).toBe('paid');
    });

    it('mark paid in cash uses the cash box a business has, and pays what is left', () => {
      const cashBoxes = businessOf().accounts.filter((a) => a.kind === 'cash');
      expect(cashBoxes).toHaveLength(1);

      invoices.markPaidInCash('inv-wd-044', DEMO_TODAY);

      const business = businessOf();
      expect(business.accounts.filter((a) => a.kind === 'cash')).toEqual(cashBoxes);
      expect(business.history).toEqual(sample().history);
      expect(business.transactions[0]).toMatchObject({ accountId: cashBoxes[0].id, amountCents: 238000, booking: REVENUE_19, date: DEMO_TODAY });
      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(docOf('wd-d2').paymentId).toBe(business.transactions[0].id);
    });

    it('mark paid in cash is refused for a paid invoice, a draft, a cancelled one, and a date that is not a past day', () => {
      demo.setBusiness('sara-yoga');
      const before = businessOf('sara-yoga');
      invoices.markPaidInCash('inv-sy-021', '2026-10-23'); // tomorrow
      invoices.markPaidInCash('inv-sy-021', 'yesterday');
      invoices.markPaidInCash('inv-sy-019', DEMO_TODAY); // paid
      invoices.markPaidInCash('nope', DEMO_TODAY);
      expect(businessOf('sara-yoga')).toBe(before); // no cash box either

      demo.setBusiness('weber-design');
      const weber = businessOf();
      invoices.markPaidInCash('inv-wd-draft', DEMO_TODAY);
      invoices.markPaidInCash('inv-wd-040', DEMO_TODAY);
      invoices.markPaidInCash('inv-wd-042', DEMO_TODAY);
      expect(businessOf()).toBe(weber);
    });

    it('simulate payment links automatically and the invoice is paid', () => {
      invoices.simulatePayment('inv-wd-044');

      const business = businessOf();
      const tx = business.transactions[0];
      expect(tx).toMatchObject({
        accountId: 'wd-qonto',
        date: DEMO_TODAY,
        counterparty: 'Studio Kern',
        amountCents: 238000,
        reference: 'RE-2026-044',
        booking: REVENUE_19,
        confirmed: true,
        receipt: 'attached',
        receiptFile: 'RE-2026-044.pdf',
      });
      expect(tx.id).toBe(invoiceOf('inv-wd-044').paymentIds[0]);
      expect(keys(tx.history)).toEqual(['paysInvoice', 'autoBooked', 'imported']);
      expect(paymentStatus(tx)).toBe('booked');
      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(invoiceOf('inv-wd-044').history[0]).toEqual({ date: DEMO_TODAY, key: 'invoicePaid', params: { paymentId: tx.id } });
      expect(docOf('wd-d2')).toMatchObject({ paymentId: tx.id });
      expect(docOf('wd-d2').history[0].key).toBe('linkedAuto');
      expect(owedSummary(business, demo.setup()).owedCents).toBe(119000);
    });

    it('simulate payment needs a connected bank, and an invoice that is open', () => {
      demo.setSetup('new'); // no bank yet
      const before = businessOf();
      invoices.simulatePayment('inv-wd-044');
      expect(businessOf()).toBe(before);

      demo.setSetup('active');
      invoices.simulatePayment('inv-wd-041'); // paid
      invoices.simulatePayment('inv-wd-draft');
      invoices.simulatePayment('inv-wd-040'); // cancelled
      invoices.simulatePayment('nope');
      expect(businessOf()).toBe(before);
    });

    it('simulate payment needs a bank that works: its sign-in ended means nothing arrives, and renewing it brings it back', () => {
      demo.setBusiness('sara-yoga');
      expect(invoices.canSimulatePayment('inv-sy-021')).toBe(false);
      const before = businessOf('sara-yoga');
      invoices.simulatePayment('inv-sy-021'); // Qonto's consent ended on 20 Oct
      expect(businessOf('sara-yoga')).toBe(before);

      demo.renewConnection('sy-qonto');
      expect(invoices.canSimulatePayment('inv-sy-021')).toBe(true);
      invoices.simulatePayment('inv-sy-021');
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('paid');
    });

    it('simulate payment also works when the consent of the bank ends soon (Weber, 27 Oct), and skips an account that does not work', () => {
      expect(connectionStatus(businessOf().accounts.find((a) => a.id === 'wd-qonto')!).kind).toBe('renewSoon');
      expect(invoices.canSimulatePayment('inv-wd-044')).toBe(true);

      // Café Linde's Sparkasse is a statement account and its Qonto works: the payment arrives on Qonto.
      demo.setBusiness('cafe-linde');
      invoices.simulatePayment('inv-cl-053');
      expect(businessOf('cafe-linde').transactions[0].accountId).toBe('cl-qonto');
    });

    it('canSimulatePayment is for an invoice with something left to pay, with a bank that works', () => {
      expect(invoices.canSimulatePayment('inv-wd-044')).toBe(true); // open
      expect(invoices.canSimulatePayment('inv-wd-039')).toBe(true); // overdue
      expect(invoices.canSimulatePayment('inv-wd-draft')).toBe(false);
      expect(invoices.canSimulatePayment('inv-wd-041')).toBe(false); // paid
      expect(invoices.canSimulatePayment('inv-wd-040')).toBe(false); // cancelled
      expect(invoices.canSimulatePayment('inv-wd-042')).toBe(false); // cancellation invoice
      expect(invoices.canSimulatePayment('nope')).toBe(false);
      demo.setSetup('new'); // no bank yet
      expect(invoices.canSimulatePayment('inv-wd-044')).toBe(false);
    });

    it('simulate payment pays an overdue reminded invoice on the first bank account', () => {
      demo.setBusiness('cafe-linde');
      invoices.simulatePayment('inv-cl-053');
      const tx = businessOf('cafe-linde').transactions[0];
      expect(tx).toMatchObject({ accountId: 'cl-qonto', amountCents: 128520, reference: 'RE-2026-053' });
      expect(statusOf('inv-cl-053', 'cafe-linde')).toBe('paid');
      expect(docOf('cl-d1', 'cafe-linde').paymentId).toBe(tx.id);
    });

    it("partial payment then the rest → paid, doc done", () => {
      demo.setBusiness('sara-yoga');
      demo.renewConnection('sy-qonto'); // the sign-in of the sample ended on 20 Oct, and a payment cannot arrive without it
      const part = paymentOf('sy-t15', 'sara-yoga');
      expect(part.amountCents).toBe(30000);

      // The part payment of the sample: partly paid, the document still waiting.
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('partlyPaid');
      expect(docStatus(docOf('sy-d2', 'sara-yoga'))).toBe('waiting');
      expect(docOf('sy-d2', 'sara-yoga').paymentId).toBeNull();

      // The rest comes in: paid, and the document is linked to that payment.
      invoices.simulatePayment('inv-sy-021');
      const rest = businessOf('sara-yoga').transactions[0];
      expect(rest.amountCents).toBe(30000);
      expect(invoiceOf('inv-sy-021', 'sara-yoga').paymentIds).toEqual(['sy-t15', rest.id]);
      expect(statusOf('inv-sy-021', 'sara-yoga')).toBe('paid');
      expect(docOf('sy-d2', 'sara-yoga').paymentId).toBe(rest.id);
      expect(docStatus(docOf('sy-d2', 'sara-yoga'))).toBe('done');
      expect(paymentOf('sy-t15', 'sara-yoga')).toBe(part);
    });

    it('confirm match pays RE-2026-044 from the Kern payment', () => {
      expect(statusOf('inv-wd-044')).toBe('open');
      invoices.confirmMatch('wd-t19', 'inv-wd-044');

      expect(statusOf('inv-wd-044')).toBe('paid');
      expect(invoiceOf('inv-wd-044').paymentIds).toEqual(['wd-t19']);
      expect(invoiceOf('inv-wd-044').history[0]).toEqual({ date: '2026-10-21', key: 'invoicePaid', params: { paymentId: 'wd-t19' } });
      expect(paymentOf('wd-t19')).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf' });
      expect(paymentOf('wd-t19').history[0]).toEqual({ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-044' } });
      expect(paymentStatus(paymentOf('wd-t19'))).toBe('booked');
      expect(docOf('wd-d2')).toMatchObject({ paymentId: 'wd-t19' });
      expect(docOf('wd-d2').history[0].key).toBe('linked'); // the person said yes: not automatic
      expect(owedSummary(businessOf(), demo.setup()).owedCents).toBe(119000);

      // Saying yes twice, or for another invoice, changes nothing more.
      const business = businessOf();
      invoices.confirmMatch('wd-t19', 'inv-wd-044');
      invoices.confirmMatch('wd-t19', 'inv-wd-039');
      expect(businessOf()).toBe(business);
    });

    it('reset takes every payment of an invoice back', () => {
      invoices.simulatePayment('inv-wd-044');
      invoices.markPaidInCash('inv-wd-039', DEMO_TODAY);
      demo.resetData();
      expect(businessOf().invoices).toEqual(sample().invoices);
      expect(businessOf().transactions).toEqual(sample().transactions);
      expect(businessOf().documents).toEqual(sample().documents);
    });
  });
});
