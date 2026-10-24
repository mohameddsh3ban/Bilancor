import { TestBed } from '@angular/core/testing';
import { OFFICE, TRAVEL } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Doc, Transaction } from '../data/models';
import { PERSON } from '../data/sample-person';
import { docStatus } from '../domain/document-status';
import { isClosedDate } from '../domain/months';
import { changeCategory } from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import type { SelfIssuedInput } from '../domain/self-issued';
import { undoBlockedBy } from '../domain/statement-import';
import { yearSummary } from '../domain/tax-year';
import { periodFor, vatReturnFor } from '../domain/vat-return';
import { DemoStateService } from './demo-state.service';
import { ReceiptService } from './receipt.service';
import { UNDO_MS } from './review.service';
import { IMPORT_MS, StatementImportService } from './statement-import.service';

const INPUT: SelfIssuedInput = { purpose: 'Parking at the client meeting', reason: 'machine', reasonText: null, address: null };

describe('ReceiptService', () => {
  let demo: DemoStateService;
  let service: ReceiptService;

  const payment = (id: string): Transaction => demo.business().transactions.find((tx) => tx.id === id)!;
  const doc = (id: string): Doc => demo.documents().find((d) => d.id === id)!;
  /** What a payment looked like when the sample data made it, to compare it with what it is now. */
  const original = (id: string): Transaction => structuredClone(payment(id));

  /** The payment as if its receipt had gone missing: no screen can say that for a payment that had one, so this edits the data directly. */
  function loseReceipt(id: string): void {
    demo.updateTransaction(id, (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
  }

  beforeEach(() => {
    localStorage.clear();
    demo = TestBed.inject(DemoStateService);
    service = TestBed.inject(ReceiptService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('createSelfIssued', () => {
    it('adds the receipt document with every field, 0 % VAT, linked to the payment', () => {
      const id = service.createSelfIssued(
        'wd-t20',
        { purpose: 'Parking at the client meeting', reason: 'other', reasonText: 'The machine ate the ticket', address: 'Parkstraße 1, 10115 Berlin' },
        'payment',
      );

      expect(id).toBe('doc-EB-2026-001');
      const receipt = doc(id!);
      expect(receipt).toMatchObject({
        fileName: 'EB-2026-001.pdf',
        name: 'APCOA Parking',
        direction: 'received',
        invoiceNo: 'EB-2026-001',
        date: '2026-10-20',
        amountCents: 650,
        vatRate: 0,
        booking: { ...TRAVEL, vatRate: 0 },
        paymentId: 'wd-t20',
        fromUpload: true,
        invoice: null,
        selfIssued: {
          number: 'EB-2026-001',
          reason: 'other',
          reasonText: 'The machine ate the ticket',
          purpose: 'Parking at the client meeting',
          address: 'Parkstraße 1, 10115 Berlin',
          confirmedBy: `${PERSON.firstName} ${PERSON.lastName}`,
          issuedOn: DEMO_TODAY,
        },
      });
      expect(docStatus(receipt)).toBe('done');
      // The person linked it, so it reads "You linked it", not "linked automatically".
      expect(receipt.history.map((line) => line.key)).toEqual(['linked', 'selfIssued']);
      expect(demo.documents()[0].id).toBe(id);
    });

    it('numbers EB-2026-001 then 002, each business on its own', () => {
      expect(service.createSelfIssued('wd-t20', INPUT, 'payment')).toBe('doc-EB-2026-001');
      expect(service.createSelfIssued('wd-t3', INPUT, 'payment')).toBe('doc-EB-2026-002');
      expect(doc('doc-EB-2026-002').selfIssued?.number).toBe('EB-2026-002');

      demo.setBusiness('cafe-linde');
      loseReceipt('cl-t3');
      expect(service.createSelfIssued('cl-t3', INPUT, 'payment')).toBe('doc-EB-2026-001');
    });

    it('the payment counts as booked and its VAT is 0', () => {
      expect(paymentStatus(payment('wd-t20'))).toBe('noReceipt');
      expect(payment('wd-t20').booking).toEqual({ ...TRAVEL, vatRate: 19 });

      service.createSelfIssued('wd-t20', INPUT, 'payment');

      const paid = payment('wd-t20');
      expect(paymentStatus(paid)).toBe('booked');
      expect(paid).toMatchObject({ receipt: 'attached', receiptFile: 'EB-2026-001.pdf', confirmed: true, booking: { ...TRAVEL, vatRate: 0 } });
      // Its category stays, only the VAT goes; a hand link and a line for the VAT are the newest lines.
      expect(paid.booking?.labelKey).toBe('travel');
      expect(paid.history.slice(0, 2).map((line) => line.key)).toEqual(['vatRemovedSelfIssued', 'receiptLinked']);
      expect(paid.history[1].params).toEqual({ name: 'APCOA Parking' });
    });

    it('Taxes: the October VAT paid drops by the parking VAT (against the same payment with an ordinary receipt)', () => {
      const october = periodFor('2026-10-15', 'monthly');
      const withOrdinaryReceipt = {
        ...demo.business(),
        transactions: demo.business().transactions.map((tx) =>
          tx.id === 'wd-t20' ? { ...tx, receipt: 'attached' as const, receiptFile: 'parkschein.pdf' } : tx,
        ),
      };
      const before = vatReturnFor(demo.business(), october);
      const claimed = vatReturnFor(withOrdinaryReceipt, october);

      service.createSelfIssued('wd-t20', INPUT, 'payment');
      const after = vatReturnFor(demo.business(), october);

      // 6,50 € at 19 % holds 1,04 € of VAT: an ordinary receipt claims it back, a self-issued one does not.
      expect(claimed.paidCents - after.paidCents).toBe(104);
      expect(claimed.purchasesCount).toBe(after.purchasesCount + 1);
      // Without a receipt the payment was left out of the return; now it is in, at no VAT, and it no longer needs the person.
      expect(after.paidCents).toBe(before.paidCents);
      expect(after.needsYouCount).toBe(before.needsYouCount - 1);
    });

    it('the year\'s costs count the whole amount, as no VAT is claimed back', () => {
      const costsBefore = yearSummary(demo.business()).paymentsCostsCents;

      service.createSelfIssued('wd-t20', INPUT, 'payment');

      expect(yearSummary(demo.business()).paymentsCostsCents).toBe(costsBefore + 650);
    });

    it('category change keeps 0 % VAT, and the rule of the counterparty keeps the category\'s usual VAT', () => {
      demo.addRule({ counterpartyKey: 'apcoa parking', booking: TRAVEL }, 'none');
      service.createSelfIssued('wd-t20', INPUT, 'payment');

      demo.updateTransaction('wd-t20', (tx) => changeCategory(tx, OFFICE));

      expect(payment('wd-t20').booking).toEqual({ ...OFFICE, vatRate: 0 });
      expect(payment('wd-t20').history[0].key).toBe('categoryChanged');
      expect(demo.business().categoryRules).toEqual([{ counterpartyKey: 'apcoa parking', booking: OFFICE }]);
      expect(demo.business().categoryRules[0].booking.vatRate).toBe(19);
    });

    it('keeps 0 % for a payment that had no category when the receipt was written', () => {
      demo.updateTransaction('wd-t20', (tx) => ({ ...tx, booking: null, confirmed: false }));
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      expect(payment('wd-t20').booking).toBeNull();
      expect(doc('doc-EB-2026-001').booking).toBeNull();

      demo.updateTransaction('wd-t20', (tx) => changeCategory(tx, OFFICE));

      expect(payment('wd-t20').booking).toEqual({ ...OFFICE, vatRate: 0 });
    });

    it('can\'t write one for money in, a private payment, a payment with a receipt, or in a closed month (payment page)', () => {
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, isPrivate: true }));
      loseReceipt('wd-t16'); // August: closed by its VAT return
      const refused: [string, string][] = [
        ['wd-t19', 'money in'], // Kern Studio, +2.380,00 €, no receipt
        ['wd-t3', 'private'],
        ['wd-t2', 'has a receipt'],
        ['wd-t16', 'closed month'],
        ['wd-nobody', 'unknown payment'],
      ];
      for (const [id, why] of refused) {
        const before = demo.business();
        expect(service.createSelfIssued(id, INPUT, 'payment'), why).toBeNull();
        expect(demo.business(), why).toBe(before);
      }
    });

    it('the inbox path ignores closed months', () => {
      loseReceipt('wd-t16');
      expect(isClosedDate(demo.business(), payment('wd-t16').date)).toBe(true);

      const id = service.createSelfIssued('wd-t16', INPUT, 'inbox');

      expect(id).toBe('doc-EB-2026-001');
      expect(payment('wd-t16')).toMatchObject({ receipt: 'attached', receiptFile: 'EB-2026-001.pdf' });
      expect(payment('wd-t16').booking?.vatRate).toBe(0);
    });

    it('the inbox path still refuses what no path can write: money in, private, a payment with a receipt', () => {
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, isPrivate: true }));
      for (const id of ['wd-t19', 'wd-t3', 'wd-t2']) {
        const before = demo.business();
        expect(service.createSelfIssued(id, INPUT, 'inbox'), id).toBeNull();
        expect(demo.business(), id).toBe(before);
      }
    });

    it('writes nothing for a purpose that is blank or a reason "something else" with no text', () => {
      const before = demo.business();
      expect(service.createSelfIssued('wd-t20', { ...INPUT, purpose: '  ' }, 'payment')).toBeNull();
      expect(service.createSelfIssued('wd-t20', { ...INPUT, reason: 'other', reasonText: ' ' }, 'payment')).toBeNull();
      expect(demo.business()).toBe(before);
    });

    it('writes the receipt once: a second receipt for the same payment is refused', () => {
      expect(service.createSelfIssued('wd-t20', INPUT, 'payment')).toBe('doc-EB-2026-001');
      const before = demo.business();
      expect(service.createSelfIssued('wd-t20', INPUT, 'payment')).toBeNull();
      expect(demo.business()).toBe(before);
    });

    it('undo via snapshot/restore removes the receipt and the 0 %', () => {
      const snapshot = demo.snapshot();
      const apcoa = original('wd-t20');

      service.createSelfIssued('wd-t20', INPUT, 'payment');
      expect(demo.documents().some((d) => d.selfIssued !== null)).toBe(true);
      demo.restore(snapshot);

      expect(demo.documents().some((d) => d.selfIssued !== null)).toBe(false);
      expect(demo.documents()).toHaveLength(snapshot.documents.length);
      expect(payment('wd-t20')).toEqual(apcoa);
      expect(payment('wd-t20').booking?.vatRate).toBe(19);
      // The number comes back with the receipt: the next one is 001 again, with no gap.
      expect(service.createSelfIssued('wd-t20', INPUT, 'payment')).toBe('doc-EB-2026-001');
    });

    it('a self-issued receipt on an imported payment counts as work: the import can no longer be undone', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      const imports = TestBed.inject(StatementImportService);
      const statement = imports.nextSample('cl-sparkasse');
      const done = imports.import('cl-sparkasse', statement, statement.mapping!);
      await vi.advanceTimersByTimeAsync(IMPORT_MS);
      await done;

      const imp = demo.business().imports[0];
      const isClosed = (month: string): boolean => isClosedDate(demo.business(), `${month}-01`);
      expect(undoBlockedBy(demo.business(), imp, isClosed)).toBeNull();
      expect(payment('imp-1-r1')).toMatchObject({ counterparty: 'Metro Großmarkt', receipt: 'missing' });

      expect(service.createSelfIssued('imp-1-r1', INPUT, 'payment')).toBe('doc-EB-2026-001');

      expect(undoBlockedBy(demo.business(), imp, isClosed)).toBe('worked');
      expect(demo.undoImport(imp.id)).toBe(false);
      expect(payment('imp-1-r1').receipt).toBe('attached');
    });
  });
  describe('the undo offer after a receipt written from the payment page', () => {
    it('is offered for UNDO_MS, and gone after that', () => {
      vi.useFakeTimers();
      expect(service.justWritten()).toBeNull();
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      expect(service.justWritten()).toEqual({ txId: 'wd-t20', docId: 'doc-EB-2026-001', number: 'EB-2026-001' });

      vi.advanceTimersByTime(UNDO_MS - 1);
      expect(service.justWritten()).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(service.justWritten()).toBeNull();
    });

    it('undoWritten takes the receipt, the 0 % VAT and the number back', () => {
      vi.useFakeTimers();
      const apcoa = original('wd-t20');
      service.createSelfIssued('wd-t20', INPUT, 'payment');

      service.undoWritten();

      expect(service.justWritten()).toBeNull();
      expect(demo.documents().some((d) => d.selfIssued !== null)).toBe(false);
      expect(payment('wd-t20')).toEqual(apcoa);
      expect(service.createSelfIssued('wd-t20', INPUT, 'payment')).toBe('doc-EB-2026-001');
    });

    it('does nothing once the time is over, and a second undo does nothing either', () => {
      vi.useFakeTimers();
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      vi.advanceTimersByTime(UNDO_MS);
      service.undoWritten();
      expect(payment('wd-t20').receipt).toBe('attached');

      loseReceipt('wd-t3');
      service.createSelfIssued('wd-t3', INPUT, 'payment');
      service.undoWritten();
      expect(payment('wd-t3').receipt).toBe('missing');
      const after = demo.business();
      service.undoWritten();
      expect(demo.business()).toBe(after);
    });

    it('is not offered when the receipt came from the review inbox (it has its own Undo) or was refused', () => {
      vi.useFakeTimers();
      service.createSelfIssued('wd-t20', INPUT, 'inbox');
      expect(service.justWritten()).toBeNull();
      expect(service.createSelfIssued('wd-t1', INPUT, 'payment')).toBeNull(); // money in
      expect(service.justWritten()).toBeNull();
    });

    it('goes with the data: a reset, or another business, ends the offer', () => {
      vi.useFakeTimers();
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      demo.resetData();
      expect(service.justWritten()).toBeNull();
      service.undoWritten();
      expect(demo.documents().some((d) => d.selfIssued !== null)).toBe(false);

      service.createSelfIssued('wd-t20', INPUT, 'payment');
      demo.setBusiness('sara-yoga');
      expect(service.justWritten()).toBeNull();
    });

    it('a newer receipt takes the offer over: undo takes back only the latest', () => {
      vi.useFakeTimers();
      loseReceipt('wd-t3');
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      vi.advanceTimersByTime(4000);
      service.createSelfIssued('wd-t3', INPUT, 'payment');
      expect(service.justWritten()?.txId).toBe('wd-t3');

      vi.advanceTimersByTime(4000); // the first timer would have run out by now
      expect(service.justWritten()?.txId).toBe('wd-t3');
      service.undoWritten();
      expect(payment('wd-t3').receipt).toBe('missing');
      expect(payment('wd-t20').receipt).toBe('attached');
    });
  });
});
