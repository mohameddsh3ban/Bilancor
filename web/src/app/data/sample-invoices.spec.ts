import { docStatus } from '../domain/document-status';
import { documentCandidates } from '../domain/document-matching';
import { presetSteps } from '../domain/home-cards';
import { decisionCount } from '../domain/home-figures';
import {
  dueDateOf,
  invoiceMatch,
  invoiceRows,
  invoiceStatus,
  invoiceTotals,
  leftCents,
  nextInvoiceNumber,
  owedSummary,
  paidCents,
  reminderState,
  sellerOf,
} from '../domain/invoices';
import { paymentStatus } from '../domain/payment-status';
import { yearSummary } from '../domain/tax-year';
import type { Business, Invoice } from './models';
import { BUSINESSES } from './sample-data';
import { INVOICE_PROFILES, SAMPLE_INVOICES } from './sample-invoices';

const business = (id: string): Business => BUSINESSES.find((b) => b.id === id)!;
const invoice = (b: Business, number: string): Invoice => b.invoices.find((i) => i.number === number)!;
const steps = presetSteps('active');

describe('sample invoices', () => {
  it('every business has its invoices and its invoice profile, and the profile follows the usual pattern', () => {
    for (const b of BUSINESSES) {
      expect(b.invoices, b.id).toBe(SAMPLE_INVOICES[b.id]);
      expect(b.invoiceProfile, b.id).toBe(INVOICE_PROFILES[b.id]);
      expect(b.invoices.length, b.id).toBeGreaterThan(0);
      expect(b.invoiceProfile).toMatchObject({
        name: b.name,
        numberPattern: 'RE-{YYYY}-{NNN}',
        paymentTermDays: 14,
        language: 'de',
        email: `${b.id}@invoices.example`,
      });
      for (const key of ['street', 'postcode', 'city'] as const) expect(b.invoiceProfile[key].trim(), `${b.id} ${key}`).not.toBe('');
    }
  });

  it("the profile's IBAN is the business's first bank account", () => {
    for (const b of BUSINESSES) expect(b.invoiceProfile.iban, b.id).toBe(b.accounts.find((a) => a.iban !== null)!.iban);
  });

  it("every sent invoice carries the seller's details of its business as they are in the sample; a draft has none", () => {
    for (const b of BUSINESSES) {
      for (const inv of b.invoices) {
        if (inv.sentOn === null) expect(inv.seller, `${b.id} ${inv.id}`).toBeNull();
        else expect(inv.seller, `${b.id} ${inv.number}`).toEqual(sellerOf(b));
      }
    }
  });

  it('the profile addresses are the ones in the plan', () => {
    expect(INVOICE_PROFILES['weber-design']).toMatchObject({ street: 'Lindenstr. 5', postcode: '10969', city: 'Berlin' });
    expect(INVOICE_PROFILES['cafe-linde']).toMatchObject({ name: 'Café Linde GbR', street: 'Lindenallee 4', postcode: '20259', city: 'Hamburg' });
    expect(INVOICE_PROFILES['sara-yoga']).toMatchObject({ name: 'Sara Weber Yoga', street: 'Kastanienallee 12', postcode: '10435', city: 'Berlin' });
  });

  it('every sent invoice has exactly one sent doc with the same number and amount', () => {
    for (const b of BUSINESSES) {
      for (const inv of b.invoices.filter((i) => i.sentOn !== null)) {
        const docs = b.documents.filter((d) => d.direction === 'sent' && d.invoiceNo === inv.number);
        expect(docs, `${b.id} ${inv.number}`).toHaveLength(1);
        expect(docs[0].id, `${b.id} ${inv.number}`).toBe(inv.docId);
        expect(docs[0].amountCents, `${b.id} ${inv.number}`).toBe(Math.abs(invoiceTotals(inv, b.taxProfile).grossCents));
        expect(docs[0].invoice, `${b.id} ${inv.number}`).toEqual({
          id: inv.id,
          role: inv.cancels !== null ? 'cancellation' : 'invoice',
          cancelled: inv.cancelledBy !== null,
        });
      }
    }
  });

  it('only the documents of sample invoices carry an invoice, and a draft has no document', () => {
    for (const b of BUSINESSES) {
      const docIds = b.invoices.map((i) => i.docId).filter((id) => id !== null);
      expect(b.documents.filter((d) => d.invoice !== null).map((d) => d.id).sort(), b.id).toEqual([...docIds].sort());
      for (const inv of b.invoices.filter((i) => i.sentOn === null)) {
        expect([inv.number, inv.docId, inv.paymentIds, inv.reminders], b.id).toEqual([null, null, [], []]);
      }
    }
  });

  it('invoice ids and numbers are unique per business, and a sent invoice keeps its frozen rate and note', () => {
    for (const b of BUSINESSES) {
      const ids = b.invoices.map((i) => i.id);
      expect(new Set(ids).size, b.id).toBe(ids.length);
      const numbers = b.invoices.map((i) => i.number).filter((n) => n !== null);
      expect(new Set(numbers).size, b.id).toBe(numbers.length);
      for (const inv of b.invoices.filter((i) => i.sentOn !== null)) {
        expect(inv.vatRate, inv.number!).toBe(b.taxProfile.kleinunternehmer ? 0 : 19);
        expect(inv.taxNote, inv.number!).toBe(b.taxProfile.kleinunternehmer ? 'kleinunternehmer' : null);
        expect(inv.language, inv.number!).toBe('de');
        expect(inv.sentOn, inv.number!).toBe(inv.issueDate);
      }
    }
  });

  it('every invoice has whole-cent lines and a history newest first, oldest line how it came to be', () => {
    for (const b of BUSINESSES) {
      for (const inv of b.invoices) {
        for (const line of inv.lines) expect(Number.isInteger(line.quantity * line.unitPriceCents), `${b.id} ${inv.id}`).toBe(true);
        const dates = inv.history.map((h) => h.date);
        expect([...dates].sort().reverse(), inv.id).toEqual(dates);
        expect(inv.history.at(-1)?.key, inv.id).toBe(inv.cancels !== null ? 'invoiceCancellation' : 'invoiceCreated');
        expect(inv.history.at(-1)?.date, inv.id).toBe(inv.issueDate);
      }
    }
  });

  it('the history of an invoice says what its fields say: sent, reminded, paid or part paid, cancelled', () => {
    for (const b of BUSINESSES) {
      for (const inv of b.invoices) {
        const lines = (key: string) => inv.history.filter((h) => h.key === key);
        expect(lines('invoiceSent').map((h) => h.params), inv.id).toEqual(inv.sentOn !== null && inv.cancels === null ? [{ email: inv.customer.email }] : []);
        expect(lines('invoiceReminded').map((h) => [h.date, h.params['level']]), inv.id).toEqual(inv.reminders.map((r) => [r.sentOn, String(r.level)]));
        const status = invoiceStatus(inv, b);
        expect(lines('invoicePaid'), inv.id).toHaveLength(status === 'paid' ? 1 : 0);
        expect(lines('invoicePartlyPaid'), inv.id).toHaveLength(status === 'partlyPaid' ? 1 : 0);
        for (const line of [...lines('invoicePaid'), ...lines('invoicePartlyPaid')]) {
          expect(line.date, inv.id).toBe(b.transactions.find((t) => t.id === inv.paymentIds[0])!.date);
        }
        const other = (id: string | null) => b.invoices.find((i) => i.id === id)?.number;
        expect(lines('invoiceCancelled').map((h) => h.params['number']), inv.id).toEqual(inv.cancelledBy !== null ? [other(inv.cancelledBy)] : []);
        expect(lines('invoiceCancellation').map((h) => h.params['number']), inv.id).toEqual(inv.cancels !== null ? [other(inv.cancels)] : []);
      }
    }
  });

  it('paid sample invoices total exactly their payments', () => {
    let paid = 0;
    for (const b of BUSINESSES) {
      for (const inv of b.invoices.filter((i) => invoiceStatus(i, b) === 'paid')) {
        paid += 1;
        expect(paidCents(inv, b), `${b.id} ${inv.number}`).toBe(invoiceTotals(inv, b.taxProfile).grossCents);
        expect(inv.paymentIds, `${b.id} ${inv.number}`).toHaveLength(1);
        const doc = b.documents.find((d) => d.id === inv.docId)!;
        expect(doc.paymentId, `${b.id} ${inv.number}`).toBe(inv.paymentIds[0]);
      }
    }
    expect(paid).toBe(5 + 3 + 5);
  });

  it('weber has every state: open, overdue, cancelled, cancellation, paid, draft', () => {
    const wd = business('weber-design');
    const statuses = new Set(wd.invoices.map((i) => invoiceStatus(i, wd)));
    expect([...statuses].sort()).toEqual(['cancellation', 'cancelled', 'draft', 'open', 'overdue', 'paid']);
  });

  it("weber's invoices are the ones in the plan", () => {
    const wd = business('weber-design');
    expect(wd.invoices.map((i) => i.number).filter((n) => n !== null).sort()).toEqual([
      'RE-2026-031', 'RE-2026-036', 'RE-2026-038', 'RE-2026-039', 'RE-2026-040', 'RE-2026-041', 'RE-2026-042', 'RE-2026-043', 'RE-2026-044',
    ]);
    const kern = invoice(wd, 'RE-2026-044');
    expect(kern).toMatchObject({ issueDate: '2026-10-16', paymentTermDays: 14, docId: 'wd-d2', paymentIds: [] });
    expect(dueDateOf(kern)).toBe('2026-10-30');
    expect(invoiceTotals(kern, wd.taxProfile).grossCents).toBe(238000);
    const lange = invoice(wd, 'RE-2026-039');
    expect(lange).toMatchObject({ issueDate: '2026-09-16', docId: 'wd-d3', reminders: [] });
    expect(dueDateOf(lange)).toBe('2026-09-30');
    expect(invoiceTotals(lange, wd.taxProfile).grossCents).toBe(119000);
    expect(invoiceStatus(lange, wd)).toBe('overdue');
  });

  it('weber: RE-2026-040 is cancelled by RE-2026-042, each with its sent document', () => {
    const wd = business('weber-design');
    const original = invoice(wd, 'RE-2026-040');
    const cancellation = invoice(wd, 'RE-2026-042');
    expect(original).toMatchObject({ issueDate: '2026-10-01', docId: 'wd-d5', cancelledBy: cancellation.id, cancels: null });
    expect(original.customer.name).toBe('Agentur Nord');
    expect(invoiceTotals(original, wd.taxProfile)).toMatchObject({ netCents: 50000, vatCents: 9500, grossCents: 59500 });
    expect(cancellation).toMatchObject({ issueDate: '2026-10-07', docId: 'wd-d6', cancels: original.id, cancelledBy: null });
    expect(invoiceTotals(cancellation, wd.taxProfile)).toMatchObject({ netCents: -50000, vatCents: -9500, grossCents: -59500 });
    expect(invoiceStatus(original, wd)).toBe('cancelled');
    expect(invoiceStatus(cancellation, wd)).toBe('cancellation');
  });

  it('weber: the draft goes to the Bezirksamt Pankow, a public office, with a Leitweg-ID and one flat line', () => {
    const draft = business('weber-design').invoices.find((i) => i.sentOn === null)!;
    expect(draft.customer).toMatchObject({ name: 'Bezirksamt Pankow', kind: 'public', country: 'DE', leitwegId: '11001-01234-56' });
    expect(draft.lines).toHaveLength(1);
    expect(draft.lines[0]).toMatchObject({ quantity: 1, unit: 'flat', unitPriceCents: 350000 });
    expect(invoiceTotals(draft, business('weber-design').taxProfile)).toMatchObject({ netCents: 350000, vatCents: 66500, grossCents: 416500 });
  });

  it('weber owed is 357000 with 119000 overdue', () => {
    expect(owedSummary(business('weber-design'), steps)).toEqual({ owedCents: 357000, owedCount: 2, overdueCents: 119000, overdueCount: 1 });
  });

  it('cafe RE-2026-053 is overdue and offers the formal reminder', () => {
    const cafe = business('cafe-linde');
    const inv = invoice(cafe, 'RE-2026-053');
    expect(inv.customer.name).toBe('Kanzlei Hoffmann');
    expect(inv).toMatchObject({ issueDate: '2026-09-25', docId: 'cl-d1', reminders: [{ level: 1, sentOn: '2026-10-12' }] });
    expect(invoiceTotals(inv, cafe.taxProfile)).toMatchObject({ netCents: 108000, vatCents: 20520, grossCents: 128520 });
    expect(dueDateOf(inv)).toBe('2026-10-09');
    expect(invoiceStatus(inv, cafe)).toBe('overdue');
    expect(reminderState(inv, cafe)).toEqual({ next: 2, availableFrom: null });
  });

  it("cafe's paid invoices are the Dittmar catering ones, and the Sommerfest doc is now called RE-2026-044", () => {
    const cafe = business('cafe-linde');
    expect(cafe.invoices.filter((i) => invoiceStatus(i, cafe) === 'paid').map((i) => i.number).sort()).toEqual(['RE-2026-044', 'RE-2026-049', 'RE-2026-052']);
    expect(cafe.documents.find((d) => d.id === 'doc-cl-t17')!.invoiceNo).toBe('RE-2026-044');
    expect(cafe.transactions.find((t) => t.id === 'cl-t17')!.reference).toBe('RE-2026-044, Sommerfest');
  });

  it('sara RE-2026-021 is partly paid with 30000 left and her year income is still 2130000', () => {
    const sara = business('sara-yoga');
    const inv = invoice(sara, 'RE-2026-021');
    expect(inv.customer.name).toBe('Physio Zentrum Mitte');
    expect(inv).toMatchObject({ issueDate: '2026-10-14', paymentTermDays: 30, docId: 'sy-d2', vatRate: 0, taxNote: 'kleinunternehmer' });
    expect(dueDateOf(inv)).toBe('2026-11-13');
    expect(invoiceTotals(inv, sara.taxProfile)).toMatchObject({ netCents: 60000, vatCents: 0, grossCents: 60000 });
    expect(invoiceStatus(inv, sara)).toBe('partlyPaid');
    expect(paidCents(inv, sara)).toBe(30000);
    expect(leftCents(inv, sara)).toBe(30000);
    expect(yearSummary(sara).incomeCents).toBe(2130000);
  });

  it("sara's part payment is a booked payment with the invoice attached, and no document of its own", () => {
    const sara = business('sara-yoga');
    const inv = invoice(sara, 'RE-2026-021');
    const payment = sara.transactions.find((t) => t.id === inv.paymentIds[0])!;
    expect(payment).toMatchObject({ date: '2026-10-21', amountCents: 30000, reference: 'RE-2026-021 Anzahlung', receipt: 'attached', receiptFile: 'RE-2026-021.pdf' });
    expect(paymentStatus(payment)).toBe('booked');
    expect(sara.documents.filter((d) => d.paymentId === payment.id)).toEqual([]);
  });

  it("weber's Kern payment is a not-certain match for RE-2026-044", () => {
    const wd = business('weber-design');
    const kern = wd.transactions.find((t) => t.id === 'wd-t19')!;
    expect(kern).toMatchObject({ date: '2026-10-21', counterparty: 'Kern Studio Berlin', amountCents: 238000, reference: 'Danke für die Zusammenarbeit', receipt: 'missing', confirmed: true });
    expect(kern.booking?.labelKey).toBe('revenue19');
    expect(paymentStatus(kern)).toBe('noReceipt');
    const match = invoiceMatch(wd, kern);
    expect(match?.invoice.number).toBe('RE-2026-044');
    expect(match?.certain).toBe(false);
  });

  it('no other sample payment matches an invoice', () => {
    for (const b of BUSINESSES) {
      const matches = b.transactions.filter((t) => invoiceMatch(b, t) !== null).map((t) => t.id);
      expect(matches, b.id).toEqual(b.id === 'weber-design' ? ['wd-t19'] : []);
    }
  });

  it('cash closings are not invoice rows', () => {
    const cafe = business('cafe-linde');
    const cash = new Set(cafe.transactions.filter((t) => t.accountId === 'cl-cash').map((t) => t.id));
    expect(cash.size).toBeGreaterThan(0);
    const closings = cafe.documents.filter((d) => d.paymentId !== null && cash.has(d.paymentId));
    expect(closings.length).toBeGreaterThan(0);
    const rows = invoiceRows(cafe, steps);
    for (const closing of closings) {
      expect(rows.some((r) => r.kind === 'file' && r.doc.id === closing.id), closing.id).toBe(false);
      expect(rows.some((r) => r.kind === 'invoice' && r.invoice.docId === closing.id), closing.id).toBe(false);
    }
  });

  it('every sample invoice with a sent document is one row, and a file row exists only for a document that is not an invoice', () => {
    for (const b of BUSINESSES) {
      const rows = invoiceRows(b, steps);
      for (const inv of b.invoices) {
        expect(rows.filter((r) => r.kind === 'invoice' && r.invoice.id === inv.id), `${b.id} ${inv.id}`).toHaveLength(1);
      }
      for (const row of rows.filter((r) => r.kind === 'file')) expect(row.kind === 'file' && row.doc.invoice, b.id).toBeNull();
    }
  });

  it('next numbers: weber RE-2026-045, cafe RE-2026-054, sara RE-2026-022', () => {
    expect(nextInvoiceNumber(business('weber-design'), '2026')).toBe('RE-2026-045');
    expect(nextInvoiceNumber(business('cafe-linde'), '2026')).toBe('RE-2026-054');
    expect(nextInvoiceNumber(business('sara-yoga'), '2026')).toBe('RE-2026-022');
  });

  it("a cancelled invoice's doc is done and not offered to payments", () => {
    const wd = business('weber-design');
    const cancelled = wd.documents.find((d) => d.id === 'wd-d5')!;
    const cancellation = wd.documents.find((d) => d.id === 'wd-d6')!;
    expect(docStatus(cancelled)).toBe('done');
    expect(docStatus(cancellation)).toBe('done');
    const offered = documentCandidates(wd.transactions.find((t) => t.id === 'wd-t19')!, wd.documents).map((d) => d.id);
    expect(offered).not.toContain('wd-d5');
    expect(offered).not.toContain('wd-d6');
    expect(offered.slice(0, 2)).toEqual(['wd-d2', 'wd-d3']);
  });

  it('the open and overdue invoice documents wait for a payment, as before', () => {
    const wd = business('weber-design');
    expect(docStatus(wd.documents.find((d) => d.id === 'wd-d2')!)).toBe('waiting');
    expect(docStatus(wd.documents.find((d) => d.id === 'wd-d3')!)).toBe('overdue');
    expect(docStatus(business('cafe-linde').documents.find((d) => d.id === 'cl-d1')!)).toBe('overdue');
    expect(docStatus(business('sara-yoga').documents.find((d) => d.id === 'sy-d2')!)).toBe('waiting');
  });

  it('decision counts become weber 7 / sara 3 / café 0', () => {
    expect(decisionCount(business('weber-design'), steps)).toBe(7);
    expect(decisionCount(business('sara-yoga'), steps)).toBe(3);
    expect(decisionCount(business('cafe-linde'), steps)).toBe(0);
  });
});
