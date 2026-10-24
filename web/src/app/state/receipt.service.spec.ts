import { TestBed } from '@angular/core/testing';
import { OFFICE, SUPPLIES, TRAVEL } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { Doc, Transaction } from '../data/models';
import { PERSON } from '../data/sample-person';
import { docStatus } from '../domain/document-status';
import { isClosedDate } from '../domain/months';
import { changeCategory } from '../domain/payment-actions';
import { paymentStatus } from '../domain/payment-status';
import { reviewItems } from '../domain/review-queue';
import type { SelfIssuedInput } from '../domain/self-issued';
import { undoBlockedBy } from '../domain/statement-import';
import { vatRateShown } from '../domain/tax-rules';
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
  describe('markPaid', () => {
    const accountOf = (id: string) => demo.business().accounts.find((a) => a.id === id)!;

    it('paid in cash adds a cash-box payment, linked and booked, and its VAT counts', () => {
      const october = periodFor('2026-10-15', 'monthly');
      const before = vatReturnFor(demo.business(), october);
      const cashBox = demo.business().accounts.find((a) => a.kind === 'cash')!;

      const id = service.markPaid('wd-d7', 'cash', '2026-10-20');

      expect(id).toBe('paid-wd-d7');
      expect(demo.business().accounts.filter((a) => a.kind === 'cash')).toEqual([cashBox]);
      expect(payment(id!)).toEqual({
        id: 'paid-wd-d7',
        date: '2026-10-20',
        counterparty: 'Copyshop Kreuzberg',
        accountId: cashBox.id,
        amountCents: -1850,
        booking: OFFICE,
        confirmed: true,
        isPrivate: false,
        receipt: 'attached',
        receiptFile: 'IMG_2049.jpg',
        counterpartyIban: '',
        reference: 'B-7731',
        history: [{ date: '2026-10-20', key: 'paidInCash', params: {} }],
        beforePrivate: null,
        beforeLink: null,
      });
      expect(demo.business().transactions[0].id).toBe(id);
      expect(paymentStatus(payment(id!))).toBe('booked');

      // The receipt is linked to it by hand and is done; the person is not asked about either.
      expect(doc('wd-d7')).toMatchObject({ paymentId: id });
      expect(doc('wd-d7').history[0]).toEqual({ date: DEMO_TODAY, key: 'linked', params: { name: 'Copyshop Kreuzberg' } });
      expect(docStatus(doc('wd-d7'))).toBe('done');

      // 18,50 € at 19 % holds 2,95 € of VAT, which the October return now claims back.
      const after = vatReturnFor(demo.business(), october);
      expect(after.paidCents - before.paidCents).toBe(295);
      expect(after.purchasesCount).toBe(before.purchasesCount + 1);
      expect(after.needsYouCount).toBe(before.needsYouCount);
    });

    it('the year\'s costs count the net amount of a payment made from a receipt, the VAT being claimed back', () => {
      const costs = yearSummary(demo.business()).paymentsCostsCents;
      service.markPaid('wd-d7', 'cash', '2026-10-20');
      expect(yearSummary(demo.business()).paymentsCostsCents).toBe(costs + 1850 - 295);
    });

    it('paid with own money creates the Own money account and a linked payment on it', () => {
      expect(demo.business().accounts.some((a) => a.kind === 'own')).toBe(false);

      const id = service.markPaid('wd-d7', 'own', '2026-10-19');

      const own = demo.business().accounts.filter((a) => a.kind === 'own');
      expect(own.map((a) => a.id)).toEqual(['weber-design-own']);
      expect(demo.business().history[0]).toEqual({ date: DEMO_TODAY, key: 'ownMoneyAdded', params: {} });
      expect(payment(id!)).toMatchObject({
        accountId: 'weber-design-own',
        amountCents: -1850,
        booking: OFFICE,
        confirmed: true,
        receipt: 'attached',
        history: [{ date: '2026-10-19', key: 'paidWithOwnMoney', params: {} }],
      });
      expect(doc('wd-d7').paymentId).toBe(id);
      // The receipt's VAT counts whoever paid it: a proper invoice still allows it.
      const october = periodFor('2026-10-15', 'monthly');
      expect(vatReturnFor(demo.business(), october).paidCents).toBeGreaterThanOrEqual(295);
    });

    it('a second receipt paid with own money goes to the same Own money account', () => {
      service.markPaid('wd-d7', 'own', '2026-10-19');
      demo.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 3000 }));
      const id = service.markPaid('wd-d1', 'own', '2026-10-20');

      expect(id).toBe('paid-wd-d1');
      expect(demo.business().accounts.filter((a) => a.kind === 'own')).toHaveLength(1);
      expect(demo.business().history.filter((h) => h.key === 'ownMoneyAdded')).toHaveLength(1);
      expect(payment(id!).accountId).toBe('weber-design-own');
    });

    it('own money for a Kleinunternehmer has no VAT, and the whole amount is a cost', () => {
      demo.setBusiness('sara-yoga');
      expect(demo.business().taxProfile.kleinunternehmer).toBe(true);
      const costs = yearSummary(demo.business()).paymentsCostsCents;

      const id = service.markPaid('sy-d3', 'own', '2026-10-12');

      expect(payment(id!)).toMatchObject({
        accountId: 'sara-yoga-own',
        amountCents: -8900,
        counterparty: 'Yogamatten-Shop',
        confirmed: true,
        receipt: 'attached',
      });
      expect(payment(id!).booking).toEqual({ ...SUPPLIES, vatRate: 0 });
      expect(vatRateShown(demo.business().taxProfile, payment(id!).booking!)).toBeNull();
      expect(yearSummary(demo.business()).paymentsCostsCents).toBe(costs + 8900);
    });

    it('neither way of paying ticks the bank step', () => {
      demo.setSetup('new');
      const steps = demo.setup();
      demo.updateDocument('wd-d7', (d) => ({ ...d, fromUpload: true }));
      demo.updateDocument('wd-d1', (d) => ({ ...d, fromUpload: true, amountCents: 3000 }));

      expect(service.markPaid('wd-d7', 'cash', '2026-10-19')).not.toBeNull();
      expect(service.markPaid('wd-d1', 'own', '2026-10-20')).not.toBeNull();

      expect(demo.setup()).toEqual(steps);
      expect(demo.setup().bank).toBe(false);
    });

    it('is dated the day it was paid, from the receipt\'s date up to today', () => {
      for (const day of ['2026-10-19', '2026-10-21', DEMO_TODAY]) {
        demo.resetData();
        expect(service.markPaid('wd-d7', 'cash', day), day).toBe('paid-wd-d7');
        expect(payment('paid-wd-d7').date).toBe(day);
      }
    });

    it('paid on must be between the receipt date and today: nothing changes for another day', () => {
      for (const day of ['2026-10-18', '2026-10-23', '2027-01-01', '', 'yesterday']) {
        const before = demo.business();
        expect(service.markPaid('wd-d7', 'cash', day), day).toBeNull();
        expect(service.markPaid('wd-d7', 'own', day), day).toBeNull();
        expect(demo.business(), day).toBe(before);
      }
    });

    it('is refused, with nothing changed, for what is not a received receipt waiting for its payment', () => {
      demo.updateDocument('wd-d1', (d) => ({ ...d, reading: true }));
      const refused: [string, string][] = [
        ['wd-nobody', 'unknown document'],
        ['wd-d2', 'a sent invoice (it is paid in Invoices)'],
        ['wd-d3', 'a sent document'],
        ['doc-wd-t2', 'a receipt that has its payment'],
        ['wd-d1', 'a document that is still being read'],
        ['wd-d5', 'a cancelled invoice'],
      ];
      for (const [id, why] of refused) {
        const before = demo.business();
        expect(service.markPaid(id, 'cash', DEMO_TODAY), why).toBeNull();
        expect(demo.business(), why).toBe(before);
      }
    });

    it('is refused for a self-issued receipt and for a document whose amount is not read yet', () => {
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      demo.updateDocument('wd-d7', (d) => ({ ...d, amountCents: null }));
      const before = demo.business();

      expect(service.markPaid('doc-EB-2026-001', 'cash', DEMO_TODAY)).toBeNull();
      expect(service.markPaid('wd-d7', 'cash', DEMO_TODAY)).toBeNull();
      expect(demo.business()).toBe(before);
    });

    it('marks a receipt once: asked again, nothing is added', () => {
      service.markPaid('wd-d7', 'cash', '2026-10-19');
      const before = demo.business();
      expect(service.markPaid('wd-d7', 'cash', '2026-10-19')).toBeNull();
      expect(service.markPaid('wd-d7', 'own', '2026-10-19')).toBeNull();
      expect(demo.business()).toBe(before);
    });

    it('a receipt with no category yet gives a payment with none, which still asks for one', () => {
      demo.updateDocument('wd-d7', (d) => ({ ...d, booking: null, bookingConfirmed: false }));
      const id = service.markPaid('wd-d7', 'cash', '2026-10-19');
      expect(payment(id!)).toMatchObject({ booking: null, confirmed: false });
      expect(paymentStatus(payment(id!))).toBe('unclear');
    });

    it('is no question for the review inbox: the payment is booked, and the account it goes to is not a bank', () => {
      const queue = reviewItems(demo.business(), demo.setup()).length;
      service.markPaid('wd-d7', 'own', '2026-10-19');
      expect(reviewItems(demo.business(), demo.setup())).toHaveLength(queue);
      expect(accountOf('weber-design-own').connection.kind).toBe('own');
    });

    it('the payment is locked to its receipt: unlink refuses it', () => {
      const id = service.markPaid('wd-d7', 'cash', '2026-10-19')!;
      demo.unlink('wd-d7');
      expect(doc('wd-d7').paymentId).toBe(id);
      expect(payment(id).receipt).toBe('attached');
    });

    it('works in a business with no cash box: it gets one, with one cashAdded line', () => {
      demo.setBusiness('sara-yoga');
      expect(demo.business().accounts.some((a) => a.kind === 'cash')).toBe(false);

      const id = service.markPaid('sy-d3', 'cash', '2026-10-13');

      expect(payment(id!).accountId).toBe('sara-yoga-cash');
      expect(demo.business().history[0].key).toBe('cashAdded');
    });
  });

  describe('the undo offer after a receipt was marked as paid', () => {
    it('is offered for UNDO_MS, and gone after that', () => {
      vi.useFakeTimers();
      expect(service.justPaid()).toBeNull();
      service.markPaid('wd-d7', 'cash', '2026-10-19');
      expect(service.justPaid()).toEqual({ txId: 'paid-wd-d7', docId: 'wd-d7', how: 'cash' });

      vi.advanceTimersByTime(UNDO_MS - 1);
      expect(service.justPaid()).not.toBeNull();
      vi.advanceTimersByTime(1);
      expect(service.justPaid()).toBeNull();
    });

    it('undo within 5 seconds removes the payment and unlinks the receipt', () => {
      vi.useFakeTimers();
      const copyshop = structuredClone(doc('wd-d7'));
      const payments = demo.business().transactions.length;
      service.markPaid('wd-d7', 'own', '2026-10-19');

      service.undoPaid('paid-wd-d7');

      expect(service.justPaid()).toBeNull();
      expect(demo.business().transactions).toHaveLength(payments);
      expect(demo.business().transactions.some((tx) => tx.id === 'paid-wd-d7')).toBe(false);
      expect(doc('wd-d7')).toEqual(copyshop);
      expect(docStatus(doc('wd-d7'))).toBe('waiting');
      // The receipt can be paid again, and now says the same as before.
      expect(service.markPaid('wd-d7', 'cash', '2026-10-20')).toBe('paid-wd-d7');
    });

    it('does nothing once the 5 seconds are over, or for another payment, or a second time', () => {
      vi.useFakeTimers();
      service.markPaid('wd-d7', 'cash', '2026-10-19');
      service.undoPaid('wd-t2');
      expect(payment('paid-wd-d7')).toBeDefined();

      vi.advanceTimersByTime(UNDO_MS);
      service.undoPaid('paid-wd-d7');
      expect(payment('paid-wd-d7')).toBeDefined();
      expect(doc('wd-d7').paymentId).toBe('paid-wd-d7');

      demo.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 3000 }));
      service.markPaid('wd-d1', 'cash', '2026-10-20');
      service.undoPaid('paid-wd-d1');
      const after = demo.business();
      service.undoPaid('paid-wd-d1');
      expect(demo.business()).toBe(after);
    });

    it('a refused markPaid offers nothing', () => {
      vi.useFakeTimers();
      service.markPaid('wd-d7', 'cash', '2026-10-18');
      expect(service.justPaid()).toBeNull();
    });

    it('goes with the data: a reset, or another business, ends the offer', () => {
      vi.useFakeTimers();
      service.markPaid('wd-d7', 'cash', '2026-10-19');
      demo.resetData();
      expect(service.justPaid()).toBeNull();
      service.undoPaid('paid-wd-d7');
      expect(demo.business().transactions.some((tx) => tx.id === 'paid-wd-d7')).toBe(false);

      service.markPaid('wd-d7', 'cash', '2026-10-19');
      demo.setBusiness('sara-yoga');
      expect(service.justPaid()).toBeNull();
    });

    it('shares the one offer with the self-issued receipt: the newer one takes it over and the older is not on offer', () => {
      vi.useFakeTimers();
      service.markPaid('wd-d7', 'cash', '2026-10-19');
      vi.advanceTimersByTime(3000);
      service.createSelfIssued('wd-t20', INPUT, 'payment');
      expect(service.justPaid()).toBeNull();
      expect(service.justWritten()?.txId).toBe('wd-t20');

      vi.advanceTimersByTime(3000); // the first timer would have run out by now
      expect(service.justWritten()).not.toBeNull();
      service.undoPaid('paid-wd-d7');
      expect(payment('paid-wd-d7')).toBeDefined();

      service.markPaid('wd-d1', 'cash', '2026-10-20'); // not complete: refused, offer stays
      service.undoWritten();
      expect(demo.documents().some((d) => d.selfIssued !== null)).toBe(false);
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
