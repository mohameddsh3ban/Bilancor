import { TestBed } from '@angular/core/testing';
import { OFFICE, REVENUE_19, REVENUE_7, REVENUE_EU_RC, SOFTWARE, TRAVEL } from '../data/categories';
import { BANKS, FOUND_ACCOUNTS, foundAccountsOf } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Booking, Doc, Invoice, SentVatReturn, StatementImport, TaxProfile, Transaction } from '../data/models';
import type { NewBusinessInput, NewOwner } from '../data/new-business-sample';
import { BUSINESSES } from '../data/sample-data';
import { PERSON } from '../data/sample-person';
import { counterpartyKey, type CategoryRule } from '../domain/category-rules';
import { docStatus, docsNeedingYouCount } from '../domain/document-status';
import { ALL_DONE, presetOf, presetSteps } from '../domain/home-cards';
import { invoiceStatus, leftCents } from '../domain/invoices';
import { changeCategory, confirmBooking, markNoReceiptNeeded, setPrivate } from '../domain/payment-actions';
import { needsYouCount, paymentStatus } from '../domain/payment-status';
import { reviewItems } from '../domain/review-queue';
import { undoBlockedBy } from '../domain/statement-import';
import { yearSummary } from '../domain/tax-year';
import { currentVatReturn, periodFor, vatReturnFor } from '../domain/vat-return';
import { AccountService } from './account.service';
import { DemoStateService } from './demo-state.service';
import { businessOf, withConnection as setConnection, withRole } from './demo-state.testing';

describe('DemoStateService', () => {
  it('starts with weber-design and every setup step done', () => {
    const state = TestBed.inject(DemoStateService);
    expect(state.person).toBe(PERSON);
    expect(state.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
    expect(state.business().id).toBe('weber-design');
    expect(state.setup()).toEqual(ALL_DONE);
  });

  it('setBusiness switches data', () => {
    const state = TestBed.inject(DemoStateService);
    state.setBusiness('sara-yoga');
    expect(state.business().taxProfile.kleinunternehmer).toBe(true);
  });

  it('setBusiness ignores an unknown id', () => {
    const state = TestBed.inject(DemoStateService);
    state.setBusiness('nope');
    expect(state.business().id).toBe('weber-design');
  });

  it('setSetup changes the steps of the open business', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('new');
    expect(state.setup()).toEqual(presetSteps('new'));
    expect(presetOf(state.setup())).toBe('new');
  });

  it("a shortcut only sets the open business's steps", () => {
    const state = TestBed.inject(DemoStateService);
    const accounts = state.business().accounts;
    const taxProfile = state.business().taxProfile;
    state.setSetup('new');
    expect(state.setup()).toEqual(presetSteps('new'));
    state.setBusiness('cafe-linde');
    expect(state.setup()).toEqual(ALL_DONE);
    state.setBusiness('weber-design');
    expect(state.setup().bank).toBe(false);
    state.setSetup('active');
    expect(state.setup()).toEqual(ALL_DONE);
    expect(state.business().accounts).toBe(accounts);
    expect(state.business().taxProfile).toBe(taxProfile);
  });

  it('stepsOf reads the steps of any business: all done when it was never touched', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('new');
    expect(state.stepsOf('weber-design')).toEqual(presetSteps('new'));
    expect(state.stepsOf('cafe-linde')).toBe(ALL_DONE);
    state.setBusiness('cafe-linde');
    expect(state.stepsOf('weber-design')).toEqual(presetSteps('new'));
    expect(state.setup()).toBe(state.stepsOf('cafe-linde'));
  });

  it('completeStep ticks one step of one business', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('new');
    state.completeStep('tax');
    expect(state.setup()).toEqual({ bank: false, tax: true, receipt: false });
    state.setSetup('new');
    state.completeStep('receipt', 'weber-design');
    expect(state.setup()).toEqual({ bank: false, tax: false, receipt: true });
    state.setBusiness('sara-yoga');
    state.setSetup('halfway');
    state.completeStep('tax', 'weber-design');
    expect(state.setup()).toEqual(presetSteps('halfway'));
    state.setBusiness('weber-design');
    expect(state.setup()).toEqual({ bank: false, tax: true, receipt: true });
  });

  it('completeStep on a step that is done changes nothing', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('halfway');
    const steps = state.setup();
    state.completeStep('bank');
    expect(state.setup()).toBe(steps);
    state.completeStep('tax', 'cafe-linde'); // never touched, so all done already
    state.completeStep('tax', 'nope');
    state.setBusiness('cafe-linde');
    expect(state.setup()).toBe(ALL_DONE);
  });

  it('resetData sets every business back to all done', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('new');
    state.setBusiness('sara-yoga');
    state.setSetup('halfway');
    state.resetData();
    expect(state.setup()).toEqual(ALL_DONE);
    state.setBusiness('weber-design');
    expect(state.setup()).toEqual(ALL_DONE);
  });

  it('bankConnected follows the setup state: no bank yet in "new", connected in "halfway" and "active"', () => {
    const state = TestBed.inject(DemoStateService);
    expect(state.bankConnected()).toBe(true);
    state.setSetup('new');
    expect(state.bankConnected()).toBe(false);
    state.setSetup('halfway');
    expect(state.bankConnected()).toBe(true);
    state.setSetup('active');
    expect(state.bankConnected()).toBe(true);
  });

  it('updateTransaction changes what business() returns and needsYouCount drops', () => {
    const state = TestBed.inject(DemoStateService);
    const before = needsYouCount(state.business().transactions);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    const tx = state.business().transactions.find((t) => t.id === 'wd-t3')!;
    expect(paymentStatus(tx)).toBe('booked');
    expect(needsYouCount(state.business().transactions)).toBe(before - 1);
    expect(state.businesses.find((b) => b.id === 'weber-design')).toBe(state.business());
  });

  it('updateTransaction ignores an unknown payment id', () => {
    const state = TestBed.inject(DemoStateService);
    const business = state.business();
    state.updateTransaction('nope', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(state.business()).toBe(business);
  });

  it('updateTransaction only changes the open business', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    state.setBusiness('sara-yoga');
    const sara = state.businesses.find((b) => b.id === 'sara-yoga')!;
    expect(state.business()).toBe(sara);
    expect(state.businesses.find((b) => b.id === 'weber-design')!.transactions.find((t) => t.id === 'wd-t3')!.receipt).toBe('notNeeded');
  });

  it('editing never changes the shared sample data', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(BUSINESSES.find((b) => b.id === 'weber-design')!.transactions.find((t) => t.id === 'wd-t3')!.receipt).toBe('missing');
  });

  it('resetData restores the original sample data', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    state.resetData();
    const tx = state.business().transactions.find((t) => t.id === 'wd-t3')!;
    expect(tx.receipt).toBe('missing');
    expect(state.business().id).toBe('weber-design');
  });

  describe('documents', () => {
    const doc = (state: DemoStateService, id: string) => state.documents().find((d) => d.id === id)!;
    const payment = (state: DemoStateService, id: string) => state.business().transactions.find((t) => t.id === id)!;
    const historyKeys = (history: readonly { key: string }[]) => history.map((h) => h.key);

    /** A plain received document that is not linked to anything. */
    function newDoc(id: string): Doc {
      return { ...structuredClone(BUSINESSES[0].documents.find((d) => d.id === 'wd-d4')!), id };
    }

    it("documents are the open business's documents, whatever the setup state", () => {
      const state = TestBed.inject(DemoStateService);
      expect(state.documents()).toBe(state.business().documents);
      state.setSetup('new');
      expect(state.documents()).toBe(state.business().documents);
      state.setBusiness('sara-yoga');
      expect(state.documents().map((d) => d.id)).toContain('sy-d1');
    });

    it('link changes both and needsYouCount drops', () => {
      const state = TestBed.inject(DemoStateService);
      const before = needsYouCount(state.business().transactions);
      const docsBefore = docsNeedingYouCount(state.documents());
      state.link('wd-d4', 'wd-t17');
      const tx = payment(state, 'wd-t17');
      const d = doc(state, 'wd-d4');
      expect(d.paymentId).toBe('wd-t17');
      expect(tx.receipt).toBe('attached');
      expect(tx.receiptFile).toBe('boettcher-quittung.pdf');
      expect(paymentStatus(tx)).toBe('booked');
      expect(needsYouCount(state.business().transactions)).toBe(before - 1);
      expect(docsNeedingYouCount(state.documents())).toBe(docsBefore);
      expect(d.history[0].key).toBe('linked');
      expect(tx.history[0].key).toBe('receiptLinked');
    });

    it('link with auto writes the automatic history lines', () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d4', 'wd-t17', true);
      expect(doc(state, 'wd-d4').history[0].key).toBe('linkedAuto');
      expect(payment(state, 'wd-t17').history[0].key).toBe('receiptLinkedAuto');
    });

    it('link twice writes one history line', () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d4', 'wd-t17');
      const d = doc(state, 'wd-d4');
      const tx = payment(state, 'wd-t17');
      state.link('wd-d4', 'wd-t17');
      expect(doc(state, 'wd-d4')).toBe(d);
      expect(payment(state, 'wd-t17')).toBe(tx);
      expect(historyKeys(tx.history).filter((k) => k === 'receiptLinked')).toHaveLength(1);
      expect(historyKeys(d.history).filter((k) => k === 'linked')).toHaveLength(1);
    });

    it('link is ignored when the document is linked already or the payment has its receipt', () => {
      const state = TestBed.inject(DemoStateService);
      const business = state.business();
      state.link('wd-d4', 'wd-t2');
      expect(state.business()).toBe(business);
      state.link('doc-wd-t2', 'wd-t17');
      expect(state.business()).toBe(business);
      state.link('nope', 'wd-t17');
      state.link('wd-d4', 'nope');
      expect(state.business()).toBe(business);
    });

    it('link in another business changes that business and leaves the open one', () => {
      const state = TestBed.inject(DemoStateService);
      const open = state.business();
      state.link('sy-d1', 'sy-t8', true, 'sara-yoga');
      expect(state.business()).toBe(open);
      const sara = state.businesses.find((b) => b.id === 'sara-yoga')!;
      expect(sara.documents.find((d) => d.id === 'sy-d1')!.paymentId).toBe('sy-t8');
      expect(sara.transactions.find((t) => t.id === 'sy-t8')!.receipt).toBe('attached');
    });

    it('unlink restores the payment, and its needs-you count goes back up', () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d4', 'wd-t17');
      const linkedCount = needsYouCount(state.business().transactions);
      state.updateTransaction('wd-t17', (tx) => ({ ...tx, booking: TRAVEL }));
      state.unlink('wd-d4');
      const tx = payment(state, 'wd-t17');
      expect(tx.booking?.labelKey).toBe('office');
      expect(tx.receipt).toBe('missing');
      expect(doc(state, 'wd-d4').paymentId).toBeNull();
      expect(doc(state, 'wd-d4').booking?.labelKey).toBe('travel');
      expect(needsYouCount(state.business().transactions)).toBe(linkedCount + 1);
    });

    it('unlink twice writes one history line, and a document that is not linked is ignored', () => {
      const state = TestBed.inject(DemoStateService);
      state.unlink('doc-wd-t2');
      const d = doc(state, 'doc-wd-t2');
      const tx = payment(state, 'wd-t2');
      state.unlink('doc-wd-t2');
      expect(doc(state, 'doc-wd-t2')).toBe(d);
      expect(payment(state, 'wd-t2')).toBe(tx);
      expect(historyKeys(tx.history).filter((k) => k === 'receiptUnlinked')).toHaveLength(1);
      const business = state.business();
      state.unlink('wd-d4');
      state.unlink('nope');
      expect(state.business()).toBe(business);
    });

    it('addDocument adds to the business it names, at the front', () => {
      const state = TestBed.inject(DemoStateService);
      const first = newDoc('up-1');
      state.addDocument('sara-yoga', first);
      expect(state.documents().some((d) => d.id === 'up-1')).toBe(false);
      const sara = state.businesses.find((b) => b.id === 'sara-yoga')!;
      expect(sara.documents[0]).toBe(first);
      state.addDocument('weber-design', newDoc('up-2'));
      expect(state.documents()[0].id).toBe('up-2');
    });

    it('addDocument ignores an unknown business', () => {
      const state = TestBed.inject(DemoStateService);
      const all = state.businesses;
      state.addDocument('nope', newDoc('up-1'));
      expect(state.businesses).toBe(all);
    });

    it('updateDocument changes a document of the open business, or of the one named', () => {
      const state = TestBed.inject(DemoStateService);
      state.updateDocument('wd-d1', (d) => ({ ...d, amountCents: 1890 }));
      expect(doc(state, 'wd-d1').amountCents).toBe(1890);
      const open = state.business();
      state.updateDocument('sy-d1', (d) => ({ ...d, name: 'Changed' }), 'sara-yoga');
      expect(state.business()).toBe(open);
      expect(state.businesses.find((b) => b.id === 'sara-yoga')!.documents.find((d) => d.id === 'sy-d1')!.name).toBe('Changed');
    });

    it('updateDocument ignores an unknown id and a document of another business', () => {
      const state = TestBed.inject(DemoStateService);
      const business = state.business();
      state.updateDocument('nope', (d) => ({ ...d, name: 'x' }));
      state.updateDocument('sy-d1', (d) => ({ ...d, name: 'x' }));
      expect(state.business()).toBe(business);
    });

    it('removeDocument removes an unlinked document', () => {
      const state = TestBed.inject(DemoStateService);
      state.removeDocument('wd-d1');
      expect(state.documents().some((d) => d.id === 'wd-d1')).toBe(false);
    });

    it('removeDocument ignores a linked document', () => {
      const state = TestBed.inject(DemoStateService);
      const business = state.business();
      state.removeDocument('doc-wd-t2');
      expect(state.business()).toBe(business);
      expect(state.documents().some((d) => d.id === 'doc-wd-t2')).toBe(true);
      state.removeDocument('nope');
      expect(state.business()).toBe(business);
    });

    it("unlink refuses the document of an invoice, so the invoice never loses the payment that paid it", () => {
      const state = TestBed.inject(DemoStateService);
      expect(doc(state, 'doc-wd-t1').invoice).not.toBeNull();
      const business = state.business();
      state.unlink('doc-wd-t1'); // a paid invoice: its document is linked to the payment
      expect(state.business()).toBe(business);
      expect(doc(state, 'doc-wd-t1').paymentId).toBe('wd-t1');
      expect(payment(state, 'wd-t1').receipt).toBe('attached');
      expect(state.business().invoices.find((i) => i.id === 'inv-wd-041')!.paymentIds).toEqual(['wd-t1']);
    });

    it("removeDocument refuses the document of an invoice, whether it is linked or still waiting", () => {
      const state = TestBed.inject(DemoStateService);
      const business = state.business();
      for (const id of ['wd-d2', 'wd-d3', 'wd-d5', 'wd-d6', 'doc-wd-t1']) {
        expect(doc(state, id).invoice, id).not.toBeNull();
        state.removeDocument(id);
      }
      expect(state.business()).toBe(business);
      expect(state.documents().some((d) => d.id === 'wd-d2')).toBe(true);
    });

    it('editing documents never changes the shared sample data', () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d4', 'wd-t17');
      state.removeDocument('wd-d1');
      const sample = BUSINESSES.find((b) => b.id === 'weber-design')!;
      expect(sample.documents.find((d) => d.id === 'wd-d4')!.paymentId).toBeNull();
      expect(sample.documents.some((d) => d.id === 'wd-d1')).toBe(true);
    });

    it('dataGeneration starts at 0', () => {
      expect(TestBed.inject(DemoStateService).dataGeneration()).toBe(0);
    });

    it('resetData restores documents and raises dataGeneration', () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d4', 'wd-t17');
      state.removeDocument('wd-d1');
      state.addDocument('weber-design', newDoc('up-1'));
      state.resetData();
      expect(doc(state, 'wd-d4').paymentId).toBeNull();
      expect(payment(state, 'wd-t17').receipt).toBe('missing');
      expect(state.documents().some((d) => d.id === 'wd-d1')).toBe(true);
      expect(state.documents().some((d) => d.id === 'up-1')).toBe(false);
      expect(state.dataGeneration()).toBe(1);
      state.resetData();
      expect(state.dataGeneration()).toBe(2);
    });
  });

  describe('learned category rules', () => {
    const payment = (state: DemoStateService, id: string) => state.business().transactions.find((t) => t.id === id)!;
    const AMAZON_OFFICE: CategoryRule = { counterpartyKey: 'amazon', booking: OFFICE };

    /** The client answers the Amazon payment wd-t4 with a category, the way the review inbox will. */
    function answerAmazon(state: DemoStateService, booking: Booking): string[] {
      state.updateTransaction('wd-t4', (tx) => changeCategory(tx, booking));
      return state.addRule({ counterpartyKey: counterpartyKey('Amazon'), booking }, 'wd-t4');
    }

    it('every business starts with no rules', () => {
      const state = TestBed.inject(DemoStateService);
      expect(state.businesses.map((b) => b.categoryRules)).toEqual([[], [], []]);
    });

    it('addRule keeps the rule and books the other unclear payments of the counterparty, returning their ids', () => {
      const state = TestBed.inject(DemoStateService);
      const before = needsYouCount(state.business().transactions);
      expect(answerAmazon(state, OFFICE)).toEqual(['wd-t18']);
      expect(state.business().categoryRules).toEqual([AMAZON_OFFICE]);
      const booked = payment(state, 'wd-t18');
      expect(paymentStatus(booked)).toBe('booked');
      expect(booked.booking?.labelKey).toBe('office');
      expect(booked.history[0]).toEqual({ date: '2026-10-22', key: 'bookedByRule', params: { category: 'office' } });
      // Only one history line for the payment that was answered: the rule did not touch it again.
      expect(payment(state, 'wd-t4').history.map((h) => h.key)).toEqual(['categoryChanged', 'imported']);
      expect(needsYouCount(state.business().transactions)).toBe(before - 2);
    });

    it('addRule replaces the rule for the same counterparty instead of adding a second one', () => {
      const state = TestBed.inject(DemoStateService);
      state.addRule({ counterpartyKey: 'amazon', booking: OFFICE }, 'none');
      expect(state.addRule({ counterpartyKey: 'amazon', booking: SOFTWARE }, 'none')).toEqual([]);
      expect(state.business().categoryRules).toEqual([{ counterpartyKey: 'amazon', booking: SOFTWARE }]);
    });

    it('rules belong to the open business only', () => {
      const state = TestBed.inject(DemoStateService);
      answerAmazon(state, OFFICE);
      state.setBusiness('sara-yoga');
      expect(state.business().categoryRules).toEqual([]);
      expect(state.businesses.find((b) => b.id === 'weber-design')!.categoryRules).toEqual([AMAZON_OFFICE]);
    });

    it("a rule doesn't touch payments of other businesses", () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      expect(state.addRule({ counterpartyKey: 'amazon', booking: OFFICE }, 'none')).toEqual([]);
      const weber = state.businesses.find((b) => b.id === 'weber-design')!;
      expect(weber.categoryRules).toEqual([]);
      expect(paymentStatus(weber.transactions.find((t) => t.id === 'wd-t18')!)).toBe('unclear');
    });

    it("changing a payment's category updates its counterparty's rule", () => {
      const state = TestBed.inject(DemoStateService);
      answerAmazon(state, OFFICE);
      // Anywhere in the app: here a payment the rule booked.
      state.updateTransaction('wd-t18', (tx) => changeCategory(tx, SOFTWARE));
      expect(state.business().categoryRules).toEqual([{ counterpartyKey: 'amazon', booking: SOFTWARE }]);
      // And a payment of another counterparty leaves it alone.
      state.updateTransaction('wd-t2', (tx) => changeCategory(tx, TRAVEL));
      expect(state.business().categoryRules).toEqual([{ counterpartyKey: 'amazon', booking: SOFTWARE }]);
    });

    it("changing a category never makes a rule when there isn't one", () => {
      const state = TestBed.inject(DemoStateService);
      state.updateTransaction('wd-t18', (tx) => changeCategory(tx, SOFTWARE));
      expect(state.business().categoryRules).toEqual([]);
    });

    it("marking private doesn't change a rule", () => {
      const state = TestBed.inject(DemoStateService);
      answerAmazon(state, OFFICE);
      state.updateTransaction('wd-t18', (tx) => setPrivate(tx, true));
      expect(payment(state, 'wd-t18').booking?.labelKey).toBe('privateOut');
      expect(state.business().categoryRules).toEqual([AMAZON_OFFICE]);
      state.updateTransaction('wd-t18', (tx) => setPrivate(tx, false));
      expect(state.business().categoryRules).toEqual([AMAZON_OFFICE]);
    });

    it('a change that keeps the category leaves the rules as they are', () => {
      const state = TestBed.inject(DemoStateService);
      answerAmazon(state, OFFICE);
      const rules = state.business().categoryRules;
      state.updateTransaction('wd-t18', (tx) => ({ ...tx, confirmed: false }));
      expect(state.business().categoryRules).toBe(rules);
    });

    it('snapshot and restore bring back payments, documents and rules', () => {
      const state = TestBed.inject(DemoStateService);
      const snapshot = state.snapshot();
      const original = structuredClone(snapshot);
      const generation = state.dataGeneration();

      answerAmazon(state, OFFICE);
      state.link('wd-d4', 'wd-t17');
      state.removeDocument('wd-d1');
      state.addDocument('weber-design', { ...structuredClone(snapshot.documents.find((d) => d.id === 'wd-d4')!), id: 'up-1' });
      expect(state.business()).not.toEqual(original);

      state.restore(snapshot);

      expect(state.business()).toEqual(original);
      expect(state.business().categoryRules).toEqual([]);
      expect(paymentStatus(payment(state, 'wd-t18'))).toBe('unclear');
      expect(state.documents().some((d) => d.id === 'wd-d1')).toBe(true);
      expect(state.documents().some((d) => d.id === 'up-1')).toBe(false);
      expect(state.documents().find((d) => d.id === 'wd-d4')!.paymentId).toBeNull();
      expect(state.dataGeneration()).toBe(generation);
    });

    it('restore puts back payments, documents, invoices and rules only: tax answers, accounts and history stay as they are now', () => {
      const state = TestBed.inject(DemoStateService);
      const snapshot = state.snapshot();

      answerAmazon(state, OFFICE);
      const answers: TaxProfile = { ...state.business().taxProfile, vatPeriod: 'quarterly', taxNumber: '27/123/45679' };
      state.saveTaxProfile(answers);
      state.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
      const accounts = state.business().accounts;
      const history = state.business().history;
      expect(accounts.map((a) => a.id)).toContain('wd-savings');
      expect(history.map((line) => line.key)).toEqual(['bankConnected', 'bankConnected', 'taxChanged']);

      state.restore(snapshot);

      expect(state.business().taxProfile).toEqual(answers);
      expect(state.business().accounts).toBe(accounts);
      expect(state.business().history).toBe(history);
      // What the snapshot holds does come back.
      expect(state.business().categoryRules).toEqual([]);
      expect(paymentStatus(payment(state, 'wd-t18'))).toBe('unclear');
    });

    it('restore keeps the businesses other fields as the snapshot found them too', () => {
      const state = TestBed.inject(DemoStateService);
      const snapshot = state.snapshot();
      state.restore({ ...snapshot, name: 'Not my name', vatReturns: [] });
      expect(state.business().name).toBe(snapshot.name);
      expect(state.business().vatReturns).toEqual(snapshot.vatReturns);
      expect(snapshot.vatReturns.length).toBeGreaterThan(0);
    });

    it('a snapshot is a deep copy: later edits do not change it, and restoring brings back a new object', () => {
      const state = TestBed.inject(DemoStateService);
      const open = state.business();
      const snapshot = state.snapshot();
      expect(snapshot).toEqual(open);
      expect(snapshot).not.toBe(open);
      expect(snapshot.transactions[0]).not.toBe(open.transactions[0]);

      answerAmazon(state, OFFICE);
      expect(snapshot.categoryRules).toEqual([]);
      expect(paymentStatus(snapshot.transactions.find((t) => t.id === 'wd-t4')!)).toBe('unclear');

      state.restore(snapshot);
      expect(state.business()).not.toBe(open);
      expect(state.business()).not.toBe(snapshot);
      expect(state.businesses.find((b) => b.id === 'weber-design')).toBe(state.business());
    });

    it('restore only replaces the business it was taken from, and ignores an unknown one', () => {
      const state = TestBed.inject(DemoStateService);
      const snapshot = state.snapshot();
      state.setBusiness('sara-yoga');
      state.updateTransaction('sy-t8', (tx) => ({ ...tx, receipt: 'notNeeded' }));
      const sara = state.business();
      state.restore(snapshot);
      expect(state.business()).toBe(sara);
      expect(state.businesses.find((b) => b.id === 'weber-design')).toEqual(snapshot);
      state.restore({ ...snapshot, id: 'nope' });
      expect(state.business()).toBe(sara);
    });

    it('resetData clears rules', () => {
      const state = TestBed.inject(DemoStateService);
      answerAmazon(state, OFFICE);
      expect(state.business().categoryRules).toHaveLength(1);
      state.resetData();
      expect(state.business().categoryRules).toEqual([]);
      expect(paymentStatus(payment(state, 'wd-t18'))).toBe('unclear');
    });
  });

  describe('saveTaxProfile', () => {
    const quarterly = (state: DemoStateService): TaxProfile => ({
      ...state.business().taxProfile,
      vatPeriod: 'quarterly',
    });

    it('sets the profile of the open business, adds one history line and ticks the tax step', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const profile = quarterly(state);
      state.saveTaxProfile(profile);
      expect(state.business().taxProfile).toEqual(profile);
      expect(state.business().history).toEqual([{ date: DEMO_TODAY, key: 'taxChanged', params: {} }]);
      expect(state.setup()).toEqual({ bank: false, tax: true, receipt: false });
    });

    it('a save with the same answers changes nothing: no second line, the very same business', () => {
      const state = TestBed.inject(DemoStateService);
      const profile = quarterly(state);
      state.saveTaxProfile(profile);
      const business = state.business();
      state.saveTaxProfile({ ...profile });
      expect(state.business()).toBe(business);
      expect(state.business().history).toHaveLength(1);
    });

    it('a save with the answers the business already has writes no line, but still ticks the tax step', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const business = state.business();
      state.saveTaxProfile({ ...business.taxProfile });
      expect(state.business()).toBe(business);
      expect(state.setup().tax).toBe(true);
    });

    it('every field counts as a change: one different answer writes a line', () => {
      const state = TestBed.inject(DemoStateService);
      const base = state.business().taxProfile;
      const variants: TaxProfile[] = [
        { ...base, businessKind: 'trade' },
        { ...base, kleinunternehmer: true, vatPeriod: null, vatBasis: null },
        { ...base, vatPeriod: 'yearly' },
        { ...base, permanentExtension: true },
        { ...base, vatBasis: 'soll' },
        { ...base, taxState: 'hamburg' },
        { ...base, taxNumber: '21/456/78901' },
        { ...base, vatId: 'DE123456789' },
        { ...base, fiscalYearStart: '07-01' },
      ];
      for (const [index, variant] of variants.entries()) {
        state.resetData();
        state.saveTaxProfile(variant);
        expect(state.business().taxProfile, 'variant ' + index).toEqual(variant);
        expect(state.business().history, 'variant ' + index).toHaveLength(1);
      }
    });

    it('changes only the open business, and a second change puts its line in front', () => {
      const state = TestBed.inject(DemoStateService);
      const other = state.businesses.find((b) => b.id === 'cafe-linde')!;
      state.saveTaxProfile(quarterly(state));
      state.saveTaxProfile({ ...quarterly(state), vatPeriod: 'yearly' });
      expect(state.business().history.map((entry) => entry.key)).toEqual(['taxChanged', 'taxChanged']);
      expect(state.businesses.find((b) => b.id === 'cafe-linde')).toBe(other);
      expect(other.history).toEqual([]);
    });

    it('keeps its own copy of the profile it was given', () => {
      const state = TestBed.inject(DemoStateService);
      const profile = quarterly(state);
      state.saveTaxProfile(profile);
      profile.vatPeriod = 'yearly';
      expect(state.business().taxProfile.vatPeriod).toBe('quarterly');
    });

    it('resetData brings the sample answers back and clears the line', () => {
      const state = TestBed.inject(DemoStateService);
      const sample = state.business().taxProfile;
      state.saveTaxProfile(quarterly(state));
      state.resetData();
      expect(state.business().taxProfile).toEqual(sample);
      expect(state.business().history).toEqual([]);
    });
  });

  describe('connectAccounts', () => {
    const foundAt = (businessId: string, bankId: string): Account[] => FOUND_ACCOUNTS[businessId][bankId];
    const pick = (accounts: Account[], ...ids: string[]): Account[] => accounts.filter((a) => ids.includes(a.id));
    const accountIds = (state: DemoStateService): string[] => state.business().accounts.map((a) => a.id);
    const accountOf = (state: DemoStateService, id: string): Account =>
      state.business().accounts.find((a) => a.id === id)!;
    const lineKeys = (state: DemoStateService): string[] => state.business().history.map((entry) => entry.key);

    it('adds the chosen accounts that are new, before the cash box, with a consent of 180 days from the demo day', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-qonto', 'wd-savings'), '2026-01-01');
      expect(accountIds(state)).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(accountOf(state, 'wd-savings')).toMatchObject({
        product: 'savings',
        iban: 'DE07100101010482913668',
        connection: {
          kind: 'connected',
          consentUntil: '2027-04-20',
          lastFetched: `${DEMO_TODAY}T12:00`,
          fetchFrom: '2026-01-01',
          broken: false,
        },
      });
    });

    it('a sample account that is chosen in the new-client state gets the new connection too', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      expect(accountOf(state, 'wd-qonto').connection.consentUntil).toBe('2026-10-27');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-qonto'), '2025-01-01');
      expect(accountOf(state, 'wd-qonto').connection).toEqual({
        kind: 'connected',
        consentUntil: '2027-04-20',
        lastFetched: `${DEMO_TODAY}T12:00`,
        fetchFrom: '2025-01-01',
        broken: false,
      });
      expect(accountIds(state)).toEqual(['wd-qonto', 'wd-cash']);
    });

    it('ticks the bank step and no other', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-qonto'), '2026-01-01');
      expect(state.setup()).toEqual({ bank: true, tax: false, receipt: false });
      expect(state.bankConnected()).toBe(true);
    });

    it('writes one bankConnected line for each account it connects, with the bank and the account', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-qonto', 'wd-card'), '2026-01-01');
      const lines = state.business().history;
      expect(lines).toHaveLength(2);
      expect(lines.map((line) => line.key)).toEqual(['bankConnected', 'bankConnected']);
      expect(lines.map((line) => line.date)).toEqual([DEMO_TODAY, DEMO_TODAY]);
      expect(lines.map((line) => line.params).sort((a, b) => a['account'].localeCompare(b['account']))).toEqual([
        { bank: 'Qonto', account: 'Qonto' },
        { bank: 'Qonto', account: 'Qonto Credit card' },
      ]);
    });

    it('connecting twice adds the accounts once and writes the lines once', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const chosen = pick(foundAt('weber-design', 'qonto'), 'wd-qonto', 'wd-savings');
      state.connectAccounts('qonto', chosen, '2026-01-01');
      const business = state.business();
      state.connectAccounts('qonto', chosen, '2026-01-01');
      expect(state.business()).toBe(business);
      expect(accountIds(state)).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(lineKeys(state)).toEqual(['bankConnected', 'bankConnected']);
    });

    it('connecting an account again with another date does not renew it or write a line', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const chosen = pick(foundAt('weber-design', 'qonto'), 'wd-savings');
      state.connectAccounts('qonto', chosen, '2026-01-01');
      state.connectAccounts('qonto', chosen, '2025-01-01');
      expect(accountOf(state, 'wd-savings').connection.fetchFrom).toBe('2026-01-01');
      expect(lineKeys(state)).toEqual(['bankConnected']);
    });

    it('an account that is connected already, with the bank step done, stays as it is: no renewal, no line', () => {
      const state = TestBed.inject(DemoStateService);
      const before = accountOf(state, 'wd-qonto');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-qonto', 'wd-savings'), '2025-01-01');
      expect(accountOf(state, 'wd-qonto')).toBe(before);
      expect(accountOf(state, 'wd-qonto').connection.consentUntil).toBe('2026-10-27');
      expect(accountOf(state, 'wd-savings')).toBeDefined();
      expect(lineKeys(state)).toEqual(['bankConnected']);
    });

    it('a sample business account of the bank that is left out becomes a statement account, and keeps its payments', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const payments = state.business().transactions;
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      expect(accountOf(state, 'wd-qonto').connection).toEqual({
        kind: 'statement',
        consentUntil: null,
        lastFetched: null,
        fetchFrom: null,
        broken: false,
      });
      expect(accountOf(state, 'wd-qonto').iban).toBe('DE08100101010482913650');
      expect(state.business().transactions).toBe(payments);
      expect(lineKeys(state)).toEqual(['bankConnected']);
      expect(state.setup().bank).toBe(true);
    });

    it("leaving Café Linde's Sparkasse out keeps it a statement account, untouched", () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      state.setSetup('new');
      const sparkasse = accountOf(state, 'cl-sparkasse');
      expect(sparkasse.connection.kind).toBe('statement');
      state.connectAccounts('qonto', pick(foundAt('cafe-linde', 'qonto'), 'cl-qonto', 'cl-savings'), '2026-01-01');
      expect(accountOf(state, 'cl-sparkasse')).toBe(sparkasse);
      expect(accountOf(state, 'cl-qonto').connection.kind).toBe('connected');
      expect(accountIds(state)).toEqual(['cl-qonto', 'cl-sparkasse', 'cl-savings', 'cl-cash']);
    });

    it("choosing Café Linde's Sparkasse connects the account it already has, without adding it a second time", () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      state.connectAccounts('sparkasse', foundAt('cafe-linde', 'sparkasse'), '2026-01-01');
      expect(accountIds(state)).toEqual(['cl-qonto', 'cl-sparkasse', 'cl-cash']);
      expect(accountOf(state, 'cl-sparkasse').connection).toMatchObject({ kind: 'connected', consentUntil: '2027-04-20' });
      expect(state.business().history.map((line) => line.params)).toEqual([{ bank: 'Sparkasse', account: 'Sparkasse' }]);
    });

    it('an account the bank step already connected is not turned into a statement account when left out', () => {
      const state = TestBed.inject(DemoStateService);
      const before = accountOf(state, 'wd-qonto');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      expect(accountOf(state, 'wd-qonto')).toBe(before);
    });

    it('never changes the shared found accounts or the sample businesses', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const foundBefore = structuredClone(FOUND_ACCOUNTS);
      const samplesBefore = structuredClone(BUSINESSES.map((b) => b.accounts));
      const found = foundAt('weber-design', 'qonto');
      state.connectAccounts('qonto', pick(found, 'wd-savings', 'wd-card'), '2026-01-01');
      expect(FOUND_ACCOUNTS).toEqual(foundBefore);
      expect(BUSINESSES.map((b) => b.accounts)).toEqual(samplesBefore);
      expect(accountOf(state, 'wd-savings')).not.toBe(found.find((a) => a.id === 'wd-savings'));
      expect(accountOf(state, 'wd-qonto')).not.toBe(found.find((a) => a.id === 'wd-qonto'));
      expect(found.find((a) => a.id === 'wd-savings')!.connection.kind).toBe('statement');
    });

    it('changes only the open business', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      const other = state.businesses.find((b) => b.id === 'cafe-linde')!;
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      expect(state.businesses.find((b) => b.id === 'cafe-linde')).toBe(other);
      expect(state.stepsOf('cafe-linde')).toEqual(ALL_DONE);
    });

    it('names a bank it does not know by its id', () => {
      const state = TestBed.inject(DemoStateService);
      state.connectAccounts('nowhere', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      expect(state.business().history[0].params['bank']).toBe('nowhere');
    });

    it('resetData takes the connected accounts, the lines and the bank step back', () => {
      const state = TestBed.inject(DemoStateService);
      state.setSetup('new');
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      state.resetData();
      expect(accountIds(state)).toEqual(['wd-qonto', 'wd-cash']);
      expect(accountOf(state, 'wd-qonto').connection.kind).toBe('connected');
      expect(state.business().history).toEqual([]);
      expect(state.setup()).toEqual(ALL_DONE);
    });

    it('a toolbar shortcut keeps the connected accounts', () => {
      const state = TestBed.inject(DemoStateService);
      state.connectAccounts('qonto', pick(foundAt('weber-design', 'qonto'), 'wd-savings'), '2026-01-01');
      state.setSetup('new');
      state.setSetup('active');
      expect(accountIds(state)).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(accountOf(state, 'wd-savings').connection.kind).toBe('connected');
    });
  });

  describe('renewConnection', () => {
    const accountOf = (state: DemoStateService, id: string): Account =>
      state.business().accounts.find((a) => a.id === id)!;
    const lines = (state: DemoStateService) => state.business().history;
    /** Puts the open business's account back with another connection, as the bank would report it. */
    const withConnection = (state: DemoStateService, id: string, change: Partial<Account['connection']>): void =>
      setConnection(state, id, change);

    it('gives a connection that ends soon a consent of 180 days from the demo day, fetched just now', () => {
      const state = TestBed.inject(DemoStateService);
      state.renewConnection('wd-qonto');
      expect(accountOf(state, 'wd-qonto').connection).toEqual({
        kind: 'connected',
        consentUntil: '2027-04-20',
        lastFetched: `${DEMO_TODAY}T12:00`,
        fetchFrom: '2026-01-01',
        broken: false,
      });
    });

    it('writes one bankRenewed line with the bank, dated the demo day', () => {
      const state = TestBed.inject(DemoStateService);
      state.renewConnection('wd-qonto');
      expect(lines(state)).toEqual([{ date: DEMO_TODAY, key: 'bankRenewed', params: { bank: 'Qonto' } }]);
    });

    it('renewing twice writes one history line and changes nothing the second time', () => {
      const state = TestBed.inject(DemoStateService);
      state.renewConnection('wd-qonto');
      const business = state.business();
      state.renewConnection('wd-qonto');
      expect(state.business()).toBe(business);
      expect(lines(state).map((line) => line.key)).toEqual(['bankRenewed']);
    });

    it('a connection that ended is renewed too, and the bank step stays as it is', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      expect(accountOf(state, 'sy-qonto').connection.consentUntil).toBe('2026-10-20');
      state.renewConnection('sy-qonto');
      expect(accountOf(state, 'sy-qonto').connection.consentUntil).toBe('2027-04-20');
      expect(state.setup()).toEqual(ALL_DONE);
    });

    it('a connection the bank reports as broken is repaired, however long its consent still runs', () => {
      const state = TestBed.inject(DemoStateService);
      withConnection(state, 'wd-qonto', { consentUntil: '2027-04-20', broken: true });
      state.renewConnection('wd-qonto');
      expect(accountOf(state, 'wd-qonto').connection.broken).toBe(false);
      expect(lines(state).map((line) => line.key)).toEqual(['bankRenewed']);
    });

    it('a consent that already ends 180 days ahead or later, and works, is not renewed: no change, no line', () => {
      const state = TestBed.inject(DemoStateService);
      withConnection(state, 'wd-qonto', { consentUntil: '2027-04-20' });
      const business = state.business();
      state.renewConnection('wd-qonto');
      expect(state.business()).toBe(business);

      withConnection(state, 'wd-qonto', { consentUntil: '2027-06-01' });
      const later = state.business();
      state.renewConnection('wd-qonto');
      expect(state.business()).toBe(later);
      expect(lines(state)).toEqual([]);
    });

    it('a consent one day short of 180 days is renewed', () => {
      const state = TestBed.inject(DemoStateService);
      withConnection(state, 'wd-qonto', { consentUntil: '2027-04-19' });
      state.renewConnection('wd-qonto');
      expect(accountOf(state, 'wd-qonto').connection.consentUntil).toBe('2027-04-20');
      expect(lines(state)).toHaveLength(1);
    });

    it('names the bank, not the stored English name of a savings account', () => {
      const state = TestBed.inject(DemoStateService);
      state.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'].filter((a) => a.id === 'wd-savings'), '2026-01-01');
      withConnection(state, 'wd-savings', { consentUntil: '2026-10-25' });
      state.renewConnection('wd-savings');
      expect(lines(state)[0]).toEqual({ date: DEMO_TODAY, key: 'bankRenewed', params: { bank: 'Qonto' } });
    });

    it('is ignored for an account that is not connected: a statement account, the cash box, an unknown id', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      const business = state.business();
      state.renewConnection('cl-sparkasse');
      state.renewConnection('cl-cash');
      state.renewConnection('nope');
      expect(state.business()).toBe(business);
    });

    it('changes only the open business, and an account of another business is ignored', () => {
      const state = TestBed.inject(DemoStateService);
      const sara = state.businesses.find((b) => b.id === 'sara-yoga')!;
      const weber = state.businesses.find((b) => b.id === 'weber-design')!;
      state.renewConnection('sy-qonto');
      expect(state.businesses.find((b) => b.id === 'sara-yoga')).toBe(sara);
      expect(state.businesses.find((b) => b.id === 'weber-design')).toBe(weber);
    });

    it('never changes the shared sample data, and resetData brings the old connection back', () => {
      const state = TestBed.inject(DemoStateService);
      const sample = BUSINESSES.find((b) => b.id === 'weber-design')!.accounts[0];
      state.renewConnection('wd-qonto');
      expect(sample.connection.consentUntil).toBe('2026-10-27');
      state.resetData();
      expect(accountOf(state, 'wd-qonto').connection.consentUntil).toBe('2026-10-27');
      expect(lines(state)).toEqual([]);
    });

    it('keeps the date the payments were asked for from, and the other accounts', () => {
      const state = TestBed.inject(DemoStateService);
      withConnection(state, 'wd-qonto', { fetchFrom: '2025-01-01' });
      const cash = accountOf(state, 'wd-cash');
      state.renewConnection('wd-qonto');
      expect(accountOf(state, 'wd-qonto').connection.fetchFrom).toBe('2025-01-01');
      expect(accountOf(state, 'wd-cash')).toBe(cash);
    });
  });

  describe('addCashBox', () => {
    it('adds a cash box named Cash box to a business that has none, with one cashAdded line', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      expect(state.business().accounts.some((a) => a.kind === 'cash')).toBe(false);
      state.addCashBox();
      const cash = state.business().accounts.filter((a) => a.kind === 'cash');
      expect(cash).toHaveLength(1);
      expect(cash[0]).toEqual({
        id: 'sara-yoga-cash',
        kind: 'cash',
        name: 'Cash box',
        balanceCents: 0,
        lastUpdate: DEMO_TODAY,
        connection: { kind: 'cash', consentUntil: null, lastFetched: null, fetchFrom: null, broken: false },
        product: 'cash',
        iban: null,
      });
      expect(state.business().history).toEqual([{ date: DEMO_TODAY, key: 'cashAdded', params: {} }]);
    });

    it('is ignored when the business has a cash box already: nothing changes and no line is written', () => {
      const state = TestBed.inject(DemoStateService);
      const business = state.business();
      state.addCashBox();
      expect(state.business()).toBe(business);
    });

    it('twice adds one cash box and one line', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      state.addCashBox();
      state.addCashBox();
      expect(state.business().accounts.filter((a) => a.kind === 'cash')).toHaveLength(1);
      expect(state.business().history).toHaveLength(1);
    });

    it('does not count as the bank step, and changes no other business', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      state.setSetup('new');
      const other = state.businesses.find((b) => b.id === 'weber-design')!;
      state.addCashBox();
      expect(state.setup()).toEqual(presetSteps('new'));
      expect(state.businesses.find((b) => b.id === 'weber-design')).toBe(other);
    });

    it('resetData takes the cash box back', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      state.addCashBox();
      state.resetData();
      // Reset forgets which business was open, so it is opened again by name.
      state.setBusiness('sara-yoga');
      expect(state.business().accounts.some((a) => a.kind === 'cash')).toBe(false);
    });
  });

  describe('recordSentReturn', () => {
    const sent = (patch: Partial<SentVatReturn> = {}): SentVatReturn => ({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      sentOn: DEMO_TODAY,
      chargedCents: 100000,
      paidCents: 20000,
      resultCents: 80000,
      ticket: 'ET-2026-1022-12345',
      taxOffice: null,
      ...patch,
    });

    it('adds the return after the ones sent before, in the open business', () => {
      const state = TestBed.inject(DemoStateService);
      const before = state.business().vatReturns;
      state.recordSentReturn(sent());
      expect(state.business().vatReturns).toEqual([...before, sent()]);
    });

    it('moves the current return on to the period after it', () => {
      const state = TestBed.inject(DemoStateService);
      state.recordSentReturn(sent());
      const current = currentVatReturn(state.business());
      expect(current).toMatchObject({ kind: 'return', view: { period: { start: '2026-11-01', end: '2026-11-30' } } });
    });

    it('changes no other business', () => {
      const state = TestBed.inject(DemoStateService);
      const other = state.businesses.find((b) => b.id === 'cafe-linde')!;
      state.recordSentReturn(sent());
      expect(state.businesses.find((b) => b.id === 'cafe-linde')).toBe(other);
    });

    it('records for a business that is not open when it is named', () => {
      const state = TestBed.inject(DemoStateService);
      const weber = state.business();
      state.recordSentReturn(sent({ periodStart: '2026-07-01', periodEnd: '2026-09-30' }), 'cafe-linde');
      expect(state.business()).toBe(weber);
      expect(state.businesses.find((b) => b.id === 'cafe-linde')!.vatReturns.at(-1)).toMatchObject({
        periodEnd: '2026-09-30',
      });
    });

    it('is ignored for an unknown business', () => {
      const state = TestBed.inject(DemoStateService);
      const all = [...state.businesses];
      state.recordSentReturn(sent(), 'nope');
      expect(state.businesses).toEqual(all);
    });

    it('closes the months of its period, by nobody, with a line for each', () => {
      const state = TestBed.inject(DemoStateService);
      state.recordSentReturn(sent({ periodStart: '2026-07-01', periodEnd: '2026-09-30' }), 'cafe-linde');
      const cafe = businessOf(state, 'cafe-linde');
      expect(cafe.closedMonths).toEqual([
        { month: '2026-07', on: DEMO_TODAY, by: null },
        { month: '2026-08', on: DEMO_TODAY, by: null },
        { month: '2026-09', on: DEMO_TODAY, by: null },
      ]);
      expect(cafe.history.map((line) => [line.key, line.params])).toEqual([
        ['monthClosed', { month: '2026-09', byReturn: '1' }],
        ['monthClosed', { month: '2026-08', byReturn: '1' }],
        ['monthClosed', { month: '2026-07', byReturn: '1' }],
      ]);
    });

    it('leaves a month that is closed already as it was: one closed by hand keeps its person, and no line is added for it', () => {
      const state = TestBed.inject(DemoStateService);
      state.recordSentReturn(sent({ periodStart: '2026-08-01', periodEnd: '2026-09-30' }), 'sara-yoga');
      const sara = businessOf(state, 'sara-yoga');
      expect(sara.closedMonths).toEqual([
        { month: '2026-08', on: '2026-09-05', by: 'Sara Weber' },
        { month: '2026-09', on: DEMO_TODAY, by: null },
      ]);
      expect(sara.history).toEqual([{ date: DEMO_TODAY, key: 'monthClosed', params: { month: '2026-09', byReturn: '1' } }]);
    });

    it('never changes the shared sample data, and resetData takes the return back', () => {
      const state = TestBed.inject(DemoStateService);
      const sample = BUSINESSES.find((b) => b.id === 'weber-design')!.vatReturns.length;
      state.recordSentReturn(sent());
      expect(BUSINESSES.find((b) => b.id === 'weber-design')!.vatReturns).toHaveLength(sample);
      expect(state.business().vatReturns).toHaveLength(sample + 1);

      state.resetData();
      expect(state.business().vatReturns).toHaveLength(sample);
    });
  });

  describe('closing a month', () => {
    it('closing September at Sara Weber Yoga adds one closed month and one line by Sara Weber', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      const before = state.business();

      expect(state.closeMonth('2026-09')).toBe(true);
      expect(state.business().closedMonths).toEqual([...before.closedMonths, { month: '2026-09', on: DEMO_TODAY, by: 'Sara Weber' }]);
      expect(state.business().history).toEqual([
        { date: DEMO_TODAY, key: 'monthClosed', params: { month: '2026-09', by: 'Sara Weber' } },
        ...before.history,
      ]);
      expect(state.business().transactions).toBe(before.transactions);
    });

    it('closing again changes nothing and says so: false, with no second line', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      expect(state.closeMonth('2026-09')).toBe(true);
      const closed = state.business();
      expect(state.closeMonth('2026-09')).toBe(false);
      expect(state.business()).toBe(closed);
    });

    it('refuses the running, closed, blocked and opening months, and one still to come', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      state.updateTransaction('sy-t10', (tx) => ({ ...tx, confirmed: false })); // a September payment that still needs Sara
      const before = state.business();
      for (const month of ['2026-10', '2026-11', '2026-08', '2026-09', '2026-07', '2026-01']) {
        expect(state.closeMonth(month), month).toBe(false);
      }
      expect(state.business()).toBe(before);
    });

    it('works on the open business only, and the others stay as they are', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      const weber = businessOf(state, 'weber-design');
      const cafe = businessOf(state, 'cafe-linde');
      state.closeMonth('2026-09');
      expect(businessOf(state, 'weber-design')).toBe(weber);
      expect(businessOf(state, 'cafe-linde')).toBe(cafe);
    });

    it('someone with full access can close too: Sara at Café Linde, by her own name', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      expect(state.myRole()).toBe('full');
      expect(state.closeMonth('2026-08')).toBe(true);
      expect(state.business().closedMonths).toEqual([{ month: '2026-08', on: DEMO_TODAY, by: 'Sara Weber' }]);
    });

    it('a person with receipts-only or tax-advisor access cannot close a month', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      for (const role of ['receipts', 'advisor'] as const) {
        withRole(state, 'sara-yoga', role);
        const before = state.business();
        expect(state.myRole(), role).toBe(role);
        expect(state.closeMonth('2026-09'), role).toBe(false);
        expect(state.business(), role).toBe(before);
      }
    });

    it('never changes the shared sample data, and resetData brings back the sample closed months', () => {
      const state = TestBed.inject(DemoStateService);
      const sampleClosed = BUSINESSES.find((b) => b.id === 'sara-yoga')!.closedMonths;
      state.setBusiness('sara-yoga');
      state.closeMonth('2026-09');
      expect(sampleClosed).toHaveLength(1);
      expect(state.business().closedMonths).toHaveLength(2);

      state.resetData();
      expect(state.businesses.map((b) => [b.id, b.closedMonths.map((c) => c.month)])).toEqual([
        ['weber-design', ['2026-08', '2026-09']],
        ['sara-yoga', ['2026-08']],
        ['cafe-linde', []],
      ]);
      expect(state.businesses.find((b) => b.id === 'sara-yoga')!.history).toEqual([]);
    });

    it('a business made in the demo can close nothing yet: only its running October is there', () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      const id = state.createBusiness(
        { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email },
        { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' },
      );
      accounts.signIn(PERSON.id, false);
      state.setBusiness(id);
      expect(state.business().closedMonths).toEqual([]);
      expect(state.closeMonth('2026-10')).toBe(false);
      expect(state.closeMonth('2026-09')).toBe(false); // the opening line ends there
    });
  });

  describe('invoices', () => {
    const invoice = (state: DemoStateService, id: string) => state.business().invoices.find((i) => i.id === id)!;
    const doc = (state: DemoStateService, id: string) => state.documents().find((d) => d.id === id)!;
    const payment = (state: DemoStateService, id: string) => state.business().transactions.find((t) => t.id === id)!;

    /** An incoming payment of Weber Design with no receipt yet, like the Kern payment wd-t19 it is copied from. */
    function incoming(id: string, cents: number, patch: Partial<Transaction> = {}): Transaction {
      const copy = structuredClone(BUSINESSES[0].transactions.find((t) => t.id === 'wd-t19')!);
      return { ...copy, id, amountCents: cents, reference: 'Zahlung', ...patch };
    }

    it('saveInvoice adds a new invoice after the others and replaces one with the same id', () => {
      const state = TestBed.inject(DemoStateService);
      const draft = invoice(state, 'inv-wd-draft');
      const count = state.business().invoices.length;

      state.saveInvoice({ ...draft, id: 'inv-new' });
      expect(state.business().invoices).toHaveLength(count + 1);
      expect(state.business().invoices.at(-1)!.id).toBe('inv-new');

      const edited: Invoice = { ...draft, paymentTermDays: 30 };
      state.saveInvoice(edited);
      expect(state.business().invoices).toHaveLength(count + 1);
      expect(invoice(state, 'inv-wd-draft')).toBe(edited);
    });

    it('saveInvoice saves into a business that is not open when it is named, and ignores an unknown one', () => {
      const state = TestBed.inject(DemoStateService);
      const weber = state.business();
      const draft = invoice(state, 'inv-wd-draft');

      state.saveInvoice({ ...draft, id: 'inv-for-cafe' }, 'cafe-linde');
      expect(state.business()).toBe(weber);
      expect(state.businesses.find((b) => b.id === 'cafe-linde')!.invoices.at(-1)!.id).toBe('inv-for-cafe');

      const all = [...state.businesses];
      state.saveInvoice(draft, 'nope');
      expect(state.businesses).toEqual(all);
    });

    it('removeInvoice removes a draft and nothing else', () => {
      const state = TestBed.inject(DemoStateService);
      state.removeInvoice('inv-wd-draft');
      expect(state.business().invoices.some((i) => i.id === 'inv-wd-draft')).toBe(false);

      const business = state.business();
      state.removeInvoice('inv-wd-044'); // sent: stays on record
      state.removeInvoice('nope');
      expect(state.business()).toBe(business);
    });

    it("saveInvoiceProfile replaces the open business's invoice details only", () => {
      const state = TestBed.inject(DemoStateService);
      const cafe = state.businesses.find((b) => b.id === 'cafe-linde')!.invoiceProfile;
      const profile = { ...state.business().invoiceProfile, paymentTermDays: 30, language: 'en' as const };

      state.saveInvoiceProfile(profile);
      expect(state.business().invoiceProfile).toEqual(profile);
      expect(state.businesses.find((b) => b.id === 'cafe-linde')!.invoiceProfile).toBe(cafe);
    });

    it('addTransaction puts a payment first, in the named business, and ignores an id that exists', () => {
      const state = TestBed.inject(DemoStateService);
      const count = state.business().transactions.length;

      state.addTransaction(incoming('wd-t90', 5000));
      expect(state.business().transactions).toHaveLength(count + 1);
      expect(state.business().transactions[0].id).toBe('wd-t90');

      const business = state.business();
      state.addTransaction(incoming('wd-t90', 6000));
      state.addTransaction(incoming('wd-t1', 6000));
      expect(state.business()).toBe(business);

      state.addTransaction({ ...incoming('cl-t90', 5000), accountId: 'cl-qonto' }, 'cafe-linde');
      expect(state.business()).toBe(business);
      expect(state.businesses.find((b) => b.id === 'cafe-linde')!.transactions[0].id).toBe('cl-t90');
    });

    it('linkInvoicePayment pays an invoice in full: the payment gets the invoice as its receipt and the document is linked', () => {
      const state = TestBed.inject(DemoStateService);
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false);

      const paid = invoice(state, 'inv-wd-044');
      expect(paid.paymentIds).toEqual(['wd-t19']);
      expect(invoiceStatus(paid, state.business())).toBe('paid');
      expect(paid.history[0]).toEqual({ date: '2026-10-21', key: 'invoicePaid', params: { paymentId: 'wd-t19' } }); // the day the money came in, and the payment it was

      const tx = payment(state, 'wd-t19');
      expect(tx).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf', confirmed: true });
      expect(tx.booking).toEqual(REVENUE_19);
      expect(tx.history[0]).toEqual({ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-044' } });
      expect(paymentStatus(tx)).toBe('booked');

      expect(doc(state, 'wd-d2').paymentId).toBe('wd-t19');
      expect(doc(state, 'wd-d2').history[0]).toEqual({ date: DEMO_TODAY, key: 'linked', params: { name: 'Kern Studio Berlin' } });
      expect(docStatus(doc(state, 'wd-d2'))).toBe('done');
    });

    it("an automatic linkInvoicePayment marks the payment's line auto: 'true'; the person's own (auto false) writes it without", () => {
      const state = TestBed.inject(DemoStateService);
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', true);

      expect(payment(state, 'wd-t19').history[0]).toEqual({ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-044', auto: 'true' } });
      expect(doc(state, 'wd-d2').history[0].key).toBe('linkedAuto');

      state.resetData();
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false);
      expect(payment(state, 'wd-t19').history[0].params).toEqual({ number: 'RE-2026-044' });
    });

    it("a statement import's undo is blocked by an invoice match the person confirmed, and not by one made automatically", () => {
      const record = (paymentId: string): StatementImport => ({
        id: 'imp-1',
        accountId: 'wd-qonto',
        statementId: 'st-1',
        fileName: 'konto.csv',
        importedOn: DEMO_TODAY,
        paymentIds: [paymentId],
        skippedCount: 0,
      });
      const notClosed = (_month: string): boolean => false;

      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 119000));
      expect(undoBlockedBy(state.business(), record('wd-t90'), notClosed)).toBeNull();

      state.linkInvoicePayment('inv-wd-044', 'wd-t90', true);
      expect(undoBlockedBy(state.business(), record('wd-t90'), notClosed)).toBeNull();

      state.resetData();
      state.addTransaction(incoming('wd-t90', 119000));
      state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);
      expect(undoBlockedBy(state.business(), record('wd-t90'), notClosed)).toBe('worked');
    });

    describe('the booking of a payment that pays an invoice follows the invoice', () => {
      /** The invoice of Studio Kern (2,000.00 net) as a sale to a business in France: no German VAT, reverse charge. */
      function sendReverseCharge(state: DemoStateService): void {
        const kern = invoice(state, 'inv-wd-044');
        state.saveInvoice({
          ...kern,
          customer: { ...kern.customer, country: 'FR', vatId: 'FR12345678901' },
          vatRate: 0,
          taxNote: 'reverseCharge',
        });
      }
      const october = periodFor('2026-10-21', 'monthly');

      it('a payment booked at 19 % that pays a reverse-charge invoice is booked as reverse charge: no VAT in the return, and a line says why', () => {
        const state = TestBed.inject(DemoStateService);
        sendReverseCharge(state);
        const baseline = vatReturnFor(state.business(), october);
        state.addTransaction(incoming('wd-t90', 200000)); // arrived booked and confirmed at 19 %, but with no receipt yet, so the return leaves it out
        expect(vatReturnFor(state.business(), october).chargedCents).toBe(baseline.chargedCents);

        state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);

        const tx = payment(state, 'wd-t90');
        expect(tx.booking).toEqual(REVENUE_EU_RC);
        expect(tx).toMatchObject({ confirmed: true, receipt: 'attached' });
        expect(tx.history.slice(0, 3).map((h) => [h.key, h.params])).toEqual([
          ['bookedByInvoice', { category: REVENUE_EU_RC.labelKey }],
          ['paysInvoice', { number: 'RE-2026-044' }],
          ['autoBooked', { category: REVENUE_19.labelKey }],
        ]);
        expect(tx.history[0].date).toBe(DEMO_TODAY);

        // Taxes: the payment is in the return now, with no VAT. At 19 % it would have added 319.33 (2,000.00 gross) that was never charged.
        const after = vatReturnFor(state.business(), october);
        expect(after.chargedCents).toBe(baseline.chargedCents);
        expect(after.salesCount).toBe(baseline.salesCount);
        expect(after.needsYouCount).toBe(baseline.needsYouCount);
      });

      it("an automatic match of that payment marks both of its invoice lines auto: 'true'", () => {
        const state = TestBed.inject(DemoStateService);
        sendReverseCharge(state);
        state.addTransaction(incoming('wd-t90', 200000));

        state.linkInvoicePayment('inv-wd-044', 'wd-t90', true);

        expect(payment(state, 'wd-t90').history.slice(0, 3).map((h) => [h.key, h.params])).toEqual([
          ['bookedByInvoice', { category: REVENUE_EU_RC.labelKey, auto: 'true' }],
          ['paysInvoice', { number: 'RE-2026-044', auto: 'true' }],
          ['autoBooked', { category: REVENUE_19.labelKey }],
        ]);
      });

      it('a payment booked at 19 % that pays a 7 % invoice is booked at 7 %', () => {
        const state = TestBed.inject(DemoStateService);
        state.saveInvoice({ ...invoice(state, 'inv-wd-044'), vatRate: 7 }); // 2,140.00 gross
        const baseline = vatReturnFor(state.business(), october);
        state.addTransaction(incoming('wd-t90', 214000));

        state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);

        expect(payment(state, 'wd-t90').booking).toEqual(REVENUE_7);
        expect(payment(state, 'wd-t90').history[0]).toEqual({ date: DEMO_TODAY, key: 'bookedByInvoice', params: { category: REVENUE_7.labelKey } });
        // 140.00 of VAT at 7 % (not 341.68 at 19 %).
        expect(vatReturnFor(state.business(), october).chargedCents - baseline.chargedCents).toBe(14000);
      });

      it('a booking that still waits for its confirmation keeps waiting, with the invoice booking', () => {
        const state = TestBed.inject(DemoStateService);
        sendReverseCharge(state);
        state.addTransaction(incoming('wd-t90', 200000, { confirmed: false }));

        state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);

        expect(payment(state, 'wd-t90')).toMatchObject({ booking: REVENUE_EU_RC, confirmed: false });
        expect(paymentStatus(payment(state, 'wd-t90'))).toBe('confirm');
      });

      it('a payment that is booked as the invoice is, or has no booking yet, gets no extra line', () => {
        const state = TestBed.inject(DemoStateService);
        state.addTransaction(incoming('wd-t90', 100000)); // 19 %, as the invoice
        state.addTransaction(incoming('wd-t91', 138000, { booking: null, confirmed: false })); // not booked yet
        state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);
        state.linkInvoicePayment('inv-wd-044', 'wd-t91', false);

        for (const id of ['wd-t90', 'wd-t91']) {
          expect(payment(state, id).booking, id).toEqual(REVENUE_19);
          expect(payment(state, id).history.map((h) => h.key), id).not.toContain('bookedByInvoice');
          expect(payment(state, id).history[0].key, id).toBe('paysInvoice');
        }
        expect(payment(state, 'wd-t91').confirmed).toBe(true);
      });
    });

    it('linkInvoicePayment with auto writes the automatic line on the document', () => {
      const state = TestBed.inject(DemoStateService);
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', true);
      expect(doc(state, 'wd-d2').history[0].key).toBe('linkedAuto');
    });

    it('a part payment leaves the invoice partly paid and its document waiting, and the rest completes both', () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 100000));
      state.addTransaction(incoming('wd-t91', 138000));

      state.linkInvoicePayment('inv-wd-044', 'wd-t90', true);
      expect(invoiceStatus(invoice(state, 'inv-wd-044'), state.business())).toBe('partlyPaid');
      expect(leftCents(invoice(state, 'inv-wd-044'), state.business())).toBe(138000);
      expect(invoice(state, 'inv-wd-044').history[0]).toEqual({ date: '2026-10-21', key: 'invoicePartlyPaid', params: { paymentId: 'wd-t90' } });
      expect(payment(state, 'wd-t90')).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf' });
      expect(doc(state, 'wd-d2').paymentId).toBeNull();
      expect(docStatus(doc(state, 'wd-d2'))).toBe('waiting');

      state.linkInvoicePayment('inv-wd-044', 'wd-t91', true);
      expect(invoice(state, 'inv-wd-044').paymentIds).toEqual(['wd-t90', 'wd-t91']);
      expect(invoiceStatus(invoice(state, 'inv-wd-044'), state.business())).toBe('paid');
      expect(invoice(state, 'inv-wd-044').history[0]).toMatchObject({ key: 'invoicePaid', params: { paymentId: 'wd-t91' } });
      expect(doc(state, 'wd-d2').paymentId).toBe('wd-t91'); // only the payment that completes it
      expect(docStatus(doc(state, 'wd-d2'))).toBe('done');
    });

    it('a payment that pays an invoice cannot be made private, whether it pays all of it or a part', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('sara-yoga');
      const business = state.business();
      state.updateTransaction('sy-t15', (tx) => setPrivate(tx, true)); // a part payment of RE-2026-021
      state.updateTransaction('sy-t1', (tx) => setPrivate(tx, true)); // the whole of RE-2026-019
      expect(state.business()).toBe(business);
      expect(payment(state, 'sy-t15')).toMatchObject({ isPrivate: false, receipt: 'attached' });
      expect(payment(state, 'sy-t1').isPrivate).toBe(false);
      expect(state.business().invoices.find((i) => i.id === 'inv-sy-021')!.paymentIds).toEqual(['sy-t15']);

      // a payment of the same business that pays no invoice can still be made private
      state.updateTransaction('sy-t7', (tx) => setPrivate(tx, true));
      expect(payment(state, 'sy-t7').isPrivate).toBe(true);
    });

    it('everything else about a payment that pays an invoice can still change', () => {
      const state = TestBed.inject(DemoStateService);
      state.updateTransaction('wd-t1', (tx) => changeCategory(tx, SOFTWARE));
      expect(payment(state, 'wd-t1')).toMatchObject({ booking: SOFTWARE, confirmed: true });
    });

    it("a payment of the invoice that was sent from the app stays business too: link, then try to make it private", () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d2', 'wd-t19');
      const linked = payment(state, 'wd-t19');
      state.updateTransaction('wd-t19', (tx) => setPrivate(tx, true));
      expect(payment(state, 'wd-t19')).toBe(linked);
    });

    it("link of an invoice's document pays the invoice, as linkInvoicePayment does", () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d2', 'wd-t19');

      const paid = invoice(state, 'inv-wd-044');
      expect(paid.paymentIds).toEqual(['wd-t19']);
      expect(invoiceStatus(paid, state.business())).toBe('paid');
      expect(paid.history[0]).toEqual({ date: '2026-10-21', key: 'invoicePaid', params: { paymentId: 'wd-t19' } });
      expect(payment(state, 'wd-t19').history[0]).toEqual({ date: DEMO_TODAY, key: 'paysInvoice', params: { number: 'RE-2026-044' } });
      expect(payment(state, 'wd-t19')).toMatchObject({ receipt: 'attached', receiptFile: 'RE-2026-044.pdf' });
      expect(doc(state, 'wd-d2').paymentId).toBe('wd-t19');
      expect(doc(state, 'wd-d2').history[0].key).toBe('linked');
    });

    it("link of an invoice's document with auto writes the automatic line on the document", () => {
      const state = TestBed.inject(DemoStateService);
      state.link('wd-d2', 'wd-t19', true);
      expect(doc(state, 'wd-d2').history[0].key).toBe('linkedAuto');
    });

    it("part payments picked for an invoice's document add up, and the payment that completes it links the document", () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 100000));
      state.addTransaction(incoming('wd-t91', 138000));

      state.link('wd-d2', 'wd-t90');
      expect(invoiceStatus(invoice(state, 'inv-wd-044'), state.business())).toBe('partlyPaid');
      expect(leftCents(invoice(state, 'inv-wd-044'), state.business())).toBe(138000);
      expect(doc(state, 'wd-d2').paymentId).toBeNull();
      expect(docStatus(doc(state, 'wd-d2'))).toBe('waiting');
      expect(payment(state, 'wd-t90').receipt).toBe('attached');

      state.link('wd-d2', 'wd-t91');
      expect(invoice(state, 'inv-wd-044').paymentIds).toEqual(['wd-t90', 'wd-t91']);
      expect(invoiceStatus(invoice(state, 'inv-wd-044'), state.business())).toBe('paid');
      expect(doc(state, 'wd-d2').paymentId).toBe('wd-t91');
    });

    it("link of an invoice's document needs a payment in with its receipt missing, and an invoice that still has something to pay", () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 5000, { receipt: 'notNeeded' }));
      const business = state.business();
      state.link('wd-d2', 'wd-t3'); // money going out
      state.link('wd-d2', 'wd-t90'); // the payment needs no receipt
      state.link('wd-d2', 'wd-t1'); // a payment that has its receipt
      state.link('wd-d5', 'wd-t19'); // cancelled
      state.link('wd-d6', 'wd-t19'); // a cancellation invoice
      state.link('doc-wd-t1', 'wd-t19'); // paid already
      expect(state.business()).toBe(business);
    });

    it("link still links any other document the usual way: a received one, and a sent one that was added from a file", () => {
      const state = TestBed.inject(DemoStateService);
      state.updateDocument('wd-d2', (d) => ({ ...d, invoice: null })); // as if it came from a file
      state.link('wd-d2', 'wd-t19');
      expect(doc(state, 'wd-d2').paymentId).toBe('wd-t19');
      expect(invoice(state, 'inv-wd-044').paymentIds).toEqual([]);
      expect(payment(state, 'wd-t19').history[0].key).toBe('receiptLinked');
    });

    it('a payment without a booking takes the invoice revenue booking and is confirmed', () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 238000, { booking: null, confirmed: false }));
      state.linkInvoicePayment('inv-wd-044', 'wd-t90', false);
      expect(payment(state, 'wd-t90')).toMatchObject({ booking: REVENUE_19, confirmed: true });
    });

    it('a repeated link, and a link that makes no sense, change nothing', () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 5000));
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false);
      const business = state.business();

      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false); // the same again
      state.linkInvoicePayment('nope', 'wd-t90', false); // no such invoice
      state.linkInvoicePayment('inv-wd-039', 'nope', false); // no such payment
      state.linkInvoicePayment('inv-wd-039', 'wd-t2', false); // money going out
      state.linkInvoicePayment('inv-wd-draft', 'wd-t90', false); // a draft
      state.linkInvoicePayment('inv-wd-040', 'wd-t90', false); // cancelled
      state.linkInvoicePayment('inv-wd-042', 'wd-t90', false); // a cancellation invoice
      state.linkInvoicePayment('inv-wd-044', 'wd-t90', false); // paid already
      state.linkInvoicePayment('inv-wd-039', 'wd-t1', false); // a payment of another invoice
      state.linkInvoicePayment('inv-wd-039', 'wd-t19', false); // a payment of another invoice
      expect(state.business()).toBe(business);
    });

    it('a payment that has another document linked is not linked to an invoice', () => {
      const state = TestBed.inject(DemoStateService);
      state.addTransaction(incoming('wd-t90', 119000));
      state.addDocument('weber-design', { ...structuredClone(BUSINESSES[0].documents.find((d) => d.id === 'wd-d4')!), id: 'up-1', paymentId: 'wd-t90' });
      const business = state.business();
      state.linkInvoicePayment('inv-wd-039', 'wd-t90', false);
      expect(state.business()).toBe(business);
    });

    it('links in a business that is not open when it is named', () => {
      const state = TestBed.inject(DemoStateService);
      const weber = state.business();
      state.addTransaction({ ...incoming('cl-t90', 128520), accountId: 'cl-qonto' }, 'cafe-linde');

      state.linkInvoicePayment('inv-cl-053', 'cl-t90', true, 'cafe-linde');
      const cafe = state.businesses.find((b) => b.id === 'cafe-linde')!;
      expect(invoiceStatus(cafe.invoices.find((i) => i.id === 'inv-cl-053')!, cafe)).toBe('paid');
      expect(cafe.documents.find((d) => d.id === 'cl-d1')!.paymentId).toBe('cl-t90');
      expect(cafe.transactions.find((t) => t.id === 'cl-t90')!.receiptFile).toBe('RE-2026-053.pdf');
      expect(state.business()).toBe(weber);
    });

    it('restore also puts the invoices back, so Undo of a payment that paid one is whole', () => {
      const state = TestBed.inject(DemoStateService);
      const snapshot = state.snapshot();

      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false);
      state.saveInvoice({ ...invoice(state, 'inv-wd-draft'), id: 'inv-new' });
      state.removeInvoice('inv-wd-draft');
      state.restore(snapshot);

      expect(state.business()).toEqual(snapshot);
      expect(invoice(state, 'inv-wd-044').paymentIds).toEqual([]);
      expect(invoiceStatus(invoice(state, 'inv-wd-044'), state.business())).toBe('open');
      expect(state.business().invoices.some((i) => i.id === 'inv-new')).toBe(false);
    });

    it('resetData restores the invoices, their payments and the invoice details', () => {
      const state = TestBed.inject(DemoStateService);
      state.linkInvoicePayment('inv-wd-044', 'wd-t19', false);
      state.saveInvoice({ ...invoice(state, 'inv-wd-draft'), id: 'inv-new' });
      state.removeInvoice('inv-wd-draft');
      state.saveInvoiceProfile({ ...state.business().invoiceProfile, paymentTermDays: 30 });
      state.addTransaction(incoming('wd-t90', 5000));

      state.resetData();
      expect(state.business().invoices).toEqual(BUSINESSES[0].invoices);
      expect(state.business().invoiceProfile).toEqual(BUSINESSES[0].invoiceProfile);
      expect(state.business().transactions).toEqual(BUSINESSES[0].transactions);
      expect(state.documents()).toEqual(BUSINESSES[0].documents);
    });
  });

  describe('a business made during the visit', () => {
    const sara: NewOwner = { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email };
    const input: NewBusinessInput = { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' };
    const paymentIds = (id: string): string[] => ['t1', 't2', 't3', 't4', 't5', 't6', 't7', 't8'].map((t) => `${id}-${t}`);

    /** Makes a business for Sara and opens it, as the sign-up and Add a business do. */
    function made(state: DemoStateService, owner: NewOwner = sara): string {
      const id = state.createBusiness(owner, input);
      state.setBusiness(id);
      return id;
    }

    /** Connects the open business at a bank: the accounts the demo finds there, fetched from 1 January. */
    function connectAt(state: DemoStateService, bankId = 'qonto'): void {
      state.connectAccounts(bankId, foundAccountsOf(state.business().id, bankId), '2026-01-01');
    }

    it('a new business starts as a new client with no payments, documents or tax details, owned by the person', () => {
      const state = TestBed.inject(DemoStateService);
      const id = made(state);

      expect(id).toBe('new-1');
      expect(state.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde', 'new-1']);
      expect(state.business().id).toBe('new-1');
      expect(state.setup()).toEqual(presetSteps('new'));
      expect(presetOf(state.setup())).toBe('new');
      expect(state.bankConnected()).toBe(false);
      expect(state.business()).toMatchObject({
        name: 'Atelier Neu',
        accounts: [],
        transactions: [],
        documents: [],
        invoices: [],
        vatReturns: [],
        notices: [],
        categoryRules: [],
        history: [],
        legalForm: 'sole',
      });
      expect(state.documents()).toEqual([]);
      expect(state.business().taxProfile).toMatchObject({ businessKind: 'freelance', vatPeriod: null, taxNumber: null, taxState: null });
      expect(state.business().people).toMatchObject([{ personId: PERSON.id, role: 'owner', status: 'joined', name: 'Sara Weber' }]);
    });

    it('creating a business does not open it, and changes no other business', () => {
      const state = TestBed.inject(DemoStateService);
      const before = state.businesses;
      const id = state.createBusiness(sara, input);

      expect(state.business().id).toBe('weber-design');
      expect(state.stepsOf(id)).toEqual(presetSteps('new'));
      expect(state.stepsOf('weber-design')).toEqual(ALL_DONE);
      expect(state.businesses.slice(0, 3)).toEqual(before);
      state.setBusiness(id);
      expect(state.business().id).toBe(id);
    });

    it('every business gets an id of its own, and an id is never used twice in a visit, not even after Reset demo', () => {
      const state = TestBed.inject(DemoStateService);
      expect(state.createBusiness(sara, input)).toBe('new-1');
      expect(state.createBusiness(sara, { ...input, name: 'Zweites Büro' })).toBe('new-2');
      state.resetData();
      expect(state.createBusiness(sara, input)).toBe('new-3');
      expect(state.businesses.filter((b) => b.id.startsWith('new-')).map((b) => b.id)).toEqual(['new-3']);
    });

    it('connecting it at any bank adds its account named after that bank and the eight October payments', () => {
      for (const bank of BANKS) {
        TestBed.resetTestingModule();
        const state = TestBed.inject(DemoStateService);
        const id = made(state);
        connectAt(state, bank.id);

        const business = state.business();
        expect(business.accounts, bank.id).toHaveLength(1);
        expect(business.accounts[0], bank.id).toMatchObject({
          id: `${id}-main`,
          name: bank.name,
          product: 'business',
          iban: 'DE89370400440532013000',
          connection: { kind: 'connected', consentUntil: '2027-04-20', lastFetched: `${DEMO_TODAY}T12:00`, fetchFrom: '2026-01-01', broken: false },
        });
        expect(business.transactions.map((t) => t.id), bank.id).toEqual(paymentIds(id));
        expect(business.transactions.every((t) => t.accountId === `${id}-main`), bank.id).toBe(true);
        expect(business.transactions.every((t) => t.date.startsWith('2026-10')), bank.id).toBe(true);
        expect(business.transactions[0].history.at(-1), bank.id).toMatchObject({ key: 'imported', params: { account: bank.name } });
        expect(business.history, bank.id).toEqual([
          { date: DEMO_TODAY, key: 'bankConnected', params: { bank: bank.name, account: bank.name } },
        ]);
        expect(state.setup().bank, bank.id).toBe(true);
      }
    });

    it('the transfer to the private account carries the name of the owner', () => {
      const state = TestBed.inject(DemoStateService);
      const accounts = TestBed.inject(AccountService);
      const personId = accounts.createPerson({ firstName: 'Omar', lastName: 'Haddad', email: 'omar@example.com', lang: 'en' });
      accounts.signIn(personId, false);
      made(state, { personId, name: 'Omar Haddad', email: 'omar@example.com' });
      connectAt(state);
      expect(state.business().transactions.at(-1)).toMatchObject({ counterparty: 'Omar Haddad', amountCents: -50000 });
    });

    it('each business gets payments of its own, and the sample businesses keep theirs', () => {
      const state = TestBed.inject(DemoStateService);
      const first = made(state);
      connectAt(state);
      const second = made(state);
      connectAt(state, 'ing');

      const [one, two] = [first, second].map((id) => state.businesses.find((b) => b.id === id)!);
      expect(one.transactions.map((t) => t.id)).toEqual(paymentIds(first));
      expect(two.transactions.map((t) => t.id)).toEqual(paymentIds(second));
      expect(one.accounts[0].name).toBe('Qonto');
      expect(two.accounts[0].name).toBe('ING');
      expect(state.businesses[0].transactions).toEqual(BUSINESSES[0].transactions);
    });

    it('connecting twice adds the payments once', () => {
      const state = TestBed.inject(DemoStateService);
      const id = made(state);
      connectAt(state);
      const business = state.business();

      connectAt(state);
      expect(state.business()).toBe(business);
      expect(state.business().transactions.map((t) => t.id)).toEqual(paymentIds(id));
      expect(state.business().history).toHaveLength(1);

      // The same account at another bank, and then after the New client shortcut: still one set of payments.
      connectAt(state, 'commerzbank');
      state.setSetup('new');
      connectAt(state);
      expect(state.business().accounts.map((a) => a.id)).toEqual([`${id}-main`]);
      expect(state.business().transactions.map((t) => t.id)).toEqual(paymentIds(id));
    });

    it('keeps what the person did to a payment when the bank is connected again', () => {
      const state = TestBed.inject(DemoStateService);
      const id = made(state);
      connectAt(state);
      state.updateTransaction(`${id}-t3`, markNoReceiptNeeded);
      state.setSetup('new');
      connectAt(state);
      expect(state.business().transactions.find((t) => t.id === `${id}-t3`)!.receipt).toBe('notNeeded');
    });

    it('the payments wait until the bank step, then each one that needs the person is in the review inbox', () => {
      const state = TestBed.inject(DemoStateService);
      const id = made(state);
      expect(state.business().transactions).toEqual([]);
      expect(reviewItems(state.business(), state.setup()).filter((item) => item.kind === 'payment')).toEqual([]);

      connectAt(state);
      const waiting = state.business().transactions.filter((t) => paymentStatus(t) !== 'booked').map((t) => t.id);
      const inbox = reviewItems(state.business(), state.setup()).filter((item) => item.kind === 'payment');
      expect([...waiting].sort()).toEqual(paymentIds(id).sort());
      expect(inbox.map((item) => item.id).sort()).toEqual([...waiting].sort());
      // Oldest first: the private transfer and the Amazon order, the payment to confirm, then the five that lack a receipt.
      expect(inbox.map((item) => item.kind === 'payment' && item.problem)).toEqual([
        'unclear',
        'unclear',
        'confirm',
        'noReceipt',
        'noReceipt',
        'noReceipt',
        'noReceipt',
        'noReceipt',
      ]);
      expect(needsYouCount(state.business().transactions)).toBe(8);
    });

    it('once its tax details are saved the year shows only October', () => {
      const state = TestBed.inject(DemoStateService);
      const id = made(state);
      connectAt(state);
      state.saveTaxProfile({
        ...state.business().taxProfile,
        vatPeriod: 'monthly',
        vatBasis: 'ist',
        taxState: 'berlin',
        taxNumber: '27/123/45678',
      });

      // Nothing is booked yet, so nothing counts, but the year already starts with the first payment.
      expect(yearSummary(state.business())).toMatchObject({
        openingIncomeCents: 0,
        openingCostsCents: 0,
        incomeCents: 0,
        costsCents: 0,
        paymentsSince: '2026-10-02',
        byCategory: [],
      });
      expect(state.business().incomeTaxReserveCents).toBe(0);

      // The person decides every payment: all of it is October's, net of VAT, and the private transfer does not count.
      for (const t of paymentIds(id)) state.updateTransaction(t, markNoReceiptNeeded);
      state.updateTransaction(`${id}-t6`, confirmBooking);
      state.updateTransaction(`${id}-t7`, (tx) => changeCategory(tx, OFFICE));
      state.updateTransaction(`${id}-t8`, (tx) => setPrivate(tx, true));
      const year = yearSummary(state.business());
      expect(needsYouCount(state.business().transactions)).toBe(0);
      expect(year.incomeCents).toBe(300000);
      expect(year.costsCents).toBe(57422);
      expect(year.costsCents).toBe(year.byCategory.reduce((sum, c) => sum + c.cents, 0));
      expect(year.byCategory.map((c) => c.labelKey).sort()).toEqual(['office', 'phone', 'rent', 'software', 'travel']);
      expect(year.openingIncomeCents + year.openingCostsCents).toBe(0);
      expect(year.paymentsSince).toBe('2026-10-02');
    });

    it('resetData drops businesses made during the visit', () => {
      const state = TestBed.inject(DemoStateService);
      made(state);
      connectAt(state);
      const second = made(state);
      state.resetData();

      expect(state.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      expect(state.stepsOf('new-1')).toEqual(ALL_DONE);
      expect(state.stepsOf(second)).toEqual(ALL_DONE);
      state.setBusiness(second);
      expect(state.business().id).toBe('weber-design');
    });

    it('resetData opens a sample business again when the open one was made during the visit', () => {
      const state = TestBed.inject(DemoStateService);
      made(state);
      state.resetData();
      expect(state.business().id).toBe('weber-design');
      expect(state.setup()).toEqual(ALL_DONE);

      // What is done to the open business reaches the business that is shown, so the open id must name one that exists.
      state.setSetup('new');
      expect(state.stepsOf('weber-design')).toEqual(presetSteps('new'));
    });
  });

  describe('who is signed in, and the people of a business', () => {
    const newPerson = { firstName: 'Mia', lastName: 'Becker', email: 'mia@becker.example', lang: 'en' } as const;
    const input: NewBusinessInput = { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' };

    /** Makes a new account and a business of its own for it, signs it in, as sign-up does; returns the account's id and the business's. */
    function signUp(accounts: AccountService, state: DemoStateService): { personId: string; businessId: string } {
      const personId = accounts.createPerson(newPerson);
      const businessId = state.createBusiness({ personId, name: 'Mia Becker', email: 'mia@becker.example' }, input);
      accounts.signIn(personId, false);
      return { personId, businessId };
    }

    const idsOf = (state: DemoStateService) => state.businesses.map((b) => b.id);

    it('the person is the signed-in one, and the sample person while nobody is', () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      expect(state.person).toBe(PERSON);
      const { personId } = signUp(accounts, state);
      expect(state.person.id).toBe(personId);
      expect(state.person.firstName).toBe('Mia');
      accounts.signOut();
      expect(state.person).toBe(PERSON);
    });

    it("businesses lists only the person's joined memberships", () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      const { businessId } = signUp(accounts, state);
      expect(idsOf(state)).toEqual([businessId]);
      expect(state.business().id).toBe(businessId);

      accounts.signIn('p1', false);
      expect(idsOf(state)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
    });

    it("a waiting invitation, or a row with the person's email but no login, is not a membership", () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      // Weber Design has a waiting invitation for mia@example.com, and no login behind it.
      const personId = accounts.createPerson({ ...newPerson, email: 'mia@example.com' });
      accounts.signIn(personId, false);
      expect(idsOf(state)).toEqual([]);
      expect(state.isMemberEmail('mia@example.com')).toBe(true);
    });

    it('roleIn and myRole say what the person can do in each business, and a business left is not listed any more', () => {
      const state = TestBed.inject(DemoStateService);
      expect(state.myRole()).toBe('owner');
      expect(state.roleIn('weber-design')).toBe('owner');
      expect(state.roleIn('cafe-linde')).toBe('full');
      expect(state.roleIn('nope')).toBeNull();
      state.setBusiness('cafe-linde');
      expect(state.myRole()).toBe('full');
      state.leaveBusiness('cafe-linde');
      expect(idsOf(state)).toEqual(['weber-design', 'sara-yoga']);
      expect(state.roleIn('cafe-linde')).toBeNull();
      expect(state.myRole()).toBe('owner');
    });

    it('after leaving the open business, another one opens', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      state.leaveBusiness('cafe-linde');
      expect(state.business().id).toBe('weber-design');
      expect(state.setup()).toEqual(ALL_DONE);
      state.setBusiness('cafe-linde');
      expect(state.business().id).toBe('weber-design');
    });

    it('leaving leaves a line saying who left, and leaving again changes nothing', () => {
      const state = TestBed.inject(DemoStateService);
      state.leaveBusiness('cafe-linde');
      const cafe = businessOf(state, 'cafe-linde');
      expect(cafe.people.map((m) => m.id)).toEqual(['cl-m1']);
      expect(cafe.history[0]).toEqual({ date: DEMO_TODAY, key: 'personLeft', params: { name: 'Sara Weber', by: 'Sara Weber' } });
      state.leaveBusiness('cafe-linde');
      expect(businessOf(state, 'cafe-linde')).toBe(cafe);
    });

    it('an owner cannot leave', () => {
      const state = TestBed.inject(DemoStateService);
      state.leaveBusiness('weber-design');
      state.leaveBusiness('sara-yoga');
      expect(idsOf(state)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
    });

    it('a person keeps at least one business: the last one cannot be left', () => {
      const state = TestBed.inject(DemoStateService);
      // Sara hands Weber Design and Sara Weber Yoga over to people with full access and leaves them; Café Linde is her last.
      state.changeRole('wd-m2', 'full');
      state.makeOwner('wd-m2');
      state.leaveBusiness('weber-design');
      state.setBusiness('sara-yoga');
      state.invite('lena@roth.example', 'full');
      state.acceptInvite('sara-yoga', 'sara-yoga-m2', 'Lena Roth');
      state.makeOwner('sara-yoga-m2');
      state.leaveBusiness('sara-yoga');
      expect(idsOf(state)).toEqual(['cafe-linde']);

      state.leaveBusiness('cafe-linde');
      expect(idsOf(state)).toEqual(['cafe-linde']);
      expect(state.business().id).toBe('cafe-linde');
      expect(state.roleIn('cafe-linde')).toBe('full');
    });

    it("a business that is not the person's, or does not exist, is ignored when leaving it", () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      const { businessId } = signUp(accounts, state);
      accounts.signIn('p1', false);
      const before = businessOf(state, businessId);
      state.leaveBusiness(businessId);
      state.leaveBusiness('nope');
      expect(businessOf(state, businessId)).toBe(before);
    });

    it("setBusiness ignores a business that isn't the person's", () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      const { businessId } = signUp(accounts, state);
      state.setBusiness('weber-design');
      expect(state.business().id).toBe(businessId);
      accounts.signIn('p1', false);
      state.setBusiness(businessId);
      expect(state.business().id).toBe('weber-design');
    });

    it('each person reopens the business they had open last', () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      const { personId, businessId } = signUp(accounts, state);
      expect(state.business().id).toBe(businessId);

      accounts.signIn('p1', false);
      expect(state.business().id).toBe('cafe-linde');
      state.setBusiness('sara-yoga');
      accounts.signIn(personId, false);
      expect(state.business().id).toBe(businessId);
      accounts.signIn('p1', false);
      expect(state.business().id).toBe('sara-yoga');
    });

    it('a person with none remembered opens their first business', () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      expect(state.business().id).toBe('weber-design');
      const { businessId } = signUp(accounts, state);
      expect(state.business().id).toBe(businessId);
    });

    it('the setup steps of the open business are the ones of whoever is signed in', () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      const { businessId } = signUp(accounts, state);
      expect(state.setup()).toEqual(presetSteps('new'));
      state.completeStep('bank');
      expect(state.stepsOf(businessId).bank).toBe(true);
      expect(state.stepsOf('weber-design')).toBe(ALL_DONE);
    });

    describe('the owner changes who has access', () => {
      const weber = (state: DemoStateService) => businessOf(state, 'weber-design');

      it('invite adds a waiting row with a link until 29 Oct, one history line and the person who did it', () => {
        const state = TestBed.inject(DemoStateService);
        expect(state.invite('Lena@Roth.example ', 'full')).toBeNull();
        const row = weber(state).people.at(-1)!;
        expect(row).toEqual({
          id: 'weber-design-m4',
          personId: null,
          name: null,
          email: 'lena@roth.example',
          role: 'full',
          status: 'invited',
          invitedOn: DEMO_TODAY,
          expiresOn: '2026-10-29',
          joinedOn: null,
        });
        expect(weber(state).history[0]).toEqual({
          date: DEMO_TODAY,
          key: 'personInvited',
          params: { email: 'lena@roth.example', role: 'full', by: 'Sara Weber' },
        });
      });

      it('invite says why an email cannot be invited, whatever its case, and changes nothing', () => {
        const state = TestBed.inject(DemoStateService);
        const before = weber(state);
        expect(state.invite('not an email', 'full')).toBe('invalid');
        expect(state.invite(' SARA@example.com', 'full')).toBe('hasAccess');
        expect(state.invite('Mia@Example.com', 'advisor')).toBe('invited');
        expect(weber(state)).toBe(before);
      });

      it('invitation ids are never used twice, even after one is cancelled', () => {
        const state = TestBed.inject(DemoStateService);
        state.invite('a@example.com', 'full');
        expect(weber(state).people.at(-1)!.id).toBe('weber-design-m4');
        state.cancelInvite('weber-design-m4');
        state.invite('b@example.com', 'receipts');
        expect(weber(state).people.at(-1)!.id).toBe('weber-design-m5');
      });

      it('resendInvite moves the link to 29 Oct and adds no line', () => {
        const state = TestBed.inject(DemoStateService);
        state.resendInvite('wd-m3');
        const row = weber(state).people.find((m) => m.id === 'wd-m3')!;
        expect(row.expiresOn).toBe('2026-10-29');
        expect(weber(state).history).toEqual([]);
      });

      it('cancelInvite takes the waiting row away with one line', () => {
        const state = TestBed.inject(DemoStateService);
        state.cancelInvite('wd-m3');
        expect(weber(state).people.map((m) => m.id)).toEqual(['wd-m1', 'wd-m2']);
        expect(weber(state).history[0]).toEqual({
          date: DEMO_TODAY,
          key: 'invitationCancelled',
          params: { email: 'mia@example.com', by: 'Sara Weber' },
        });
      });

      it('changeRole and makeOwner follow the rules, with Sara as the one who did it', () => {
        const state = TestBed.inject(DemoStateService);
        state.changeRole('wd-m2', 'full');
        expect(weber(state).people.find((m) => m.id === 'wd-m2')!.role).toBe('full');
        expect(weber(state).history[0]).toMatchObject({ key: 'roleChanged', params: { name: 'Jana Hoffmann', role: 'full', by: 'Sara Weber' } });

        state.makeOwner('wd-m2');
        expect(state.myRole()).toBe('full');
        expect(weber(state).people.find((m) => m.id === 'wd-m2')!.role).toBe('owner');
        expect(weber(state).history[0]).toMatchObject({ key: 'ownerChanged', params: { name: 'Jana Hoffmann', by: 'Sara Weber' } });
      });

      it('removeMember takes a joined person out with one line', () => {
        const state = TestBed.inject(DemoStateService);
        state.removeMember('wd-m2');
        expect(weber(state).people.map((m) => m.id)).toEqual(['wd-m1', 'wd-m3']);
        expect(weber(state).history[0]).toMatchObject({ key: 'personRemoved', params: { name: 'Jana Hoffmann', by: 'Sara Weber' } });
      });

      it('after handing the business over, the former owner can no longer change anything', () => {
        const state = TestBed.inject(DemoStateService);
        state.changeRole('wd-m2', 'full');
        state.makeOwner('wd-m2');
        const before = weber(state);
        expect(state.invite('lena@roth.example', 'full')).toBeNull();
        state.removeMember('wd-m2');
        state.setSupportAccess(true);
        expect(weber(state)).toBe(before);
      });

      it('setSupportAccess lets support look until 29 Oct, and stops it', () => {
        const state = TestBed.inject(DemoStateService);
        state.setSupportAccess(true);
        expect(weber(state).supportUntil).toBe('2026-10-29');
        expect(weber(state).history[0]).toEqual({ date: DEMO_TODAY, key: 'supportOn', params: { until: '2026-10-29', by: 'Sara Weber' } });
        state.setSupportAccess(false);
        expect(weber(state).supportUntil).toBeNull();
        expect(weber(state).history[0]).toEqual({ date: DEMO_TODAY, key: 'supportOff', params: { by: 'Sara Weber' } });
      });

      it('in a business the person made themselves, their full name is the one who did it', () => {
        const accounts = TestBed.inject(AccountService);
        const state = TestBed.inject(DemoStateService);
        const { businessId } = signUp(accounts, state);
        expect(state.invite('lena@roth.example', 'advisor')).toBeNull();
        const business = businessOf(state, businessId);
        expect(business.people.at(-1)!.id).toBe(`${businessId}-m2`);
        expect(business.history[0].params).toMatchObject({ by: 'Mia Becker' });
      });

      it("at Café Linde Sara's invite, remove and support calls change nothing", () => {
        const state = TestBed.inject(DemoStateService);
        state.setBusiness('cafe-linde');
        const before = businessOf(state, 'cafe-linde');
        expect(state.invite('lena@roth.example', 'full')).toBeNull();
        state.resendInvite('cl-m1');
        state.cancelInvite('cl-m1');
        state.changeRole('cl-m1', 'advisor');
        state.removeMember('cl-m1');
        state.makeOwner('cl-m2');
        state.setSupportAccess(true);
        expect(businessOf(state, 'cafe-linde')).toBe(before);
        expect(before.history).toEqual([]);
      });

      it('only the open business changes', () => {
        const state = TestBed.inject(DemoStateService);
        state.setBusiness('sara-yoga');
        state.setSupportAccess(true);
        expect(businessOf(state, 'sara-yoga').supportUntil).toBe('2026-10-29');
        expect(weber(state).supportUntil).toBeNull();
      });
    });

    describe('acceptInvite', () => {
      it('joins the invited person under the name they gave, whichever business is open', () => {
        const state = TestBed.inject(DemoStateService);
        state.setBusiness('cafe-linde');
        expect(state.acceptInvite('weber-design', 'wd-m3', 'Mia Becker')).toBe(true);
        const business = businessOf(state, 'weber-design');
        expect(business.people.find((m) => m.id === 'wd-m3')).toMatchObject({
          name: 'Mia Becker',
          status: 'joined',
          joinedOn: DEMO_TODAY,
          expiresOn: null,
        });
        expect(business.history[0]).toMatchObject({ key: 'personJoined', params: { name: 'Mia Becker', role: 'receipts', by: 'Mia Becker' } });
      });

      it('says no for an unknown business or invitation, a joined row, and one that was accepted already', () => {
        const state = TestBed.inject(DemoStateService);
        const before = businessOf(state, 'weber-design');
        expect(state.acceptInvite('nope', 'wd-m3', 'Mia')).toBe(false);
        expect(state.acceptInvite('weber-design', 'nope', 'Mia')).toBe(false);
        expect(state.acceptInvite('weber-design', 'wd-m2', 'Mia')).toBe(false);
        expect(businessOf(state, 'weber-design')).toBe(before);
        expect(state.acceptInvite('weber-design', 'wd-m3', 'Mia')).toBe(true);
        expect(state.acceptInvite('weber-design', 'wd-m3', 'Mia')).toBe(false);
      });

      it('says no for a cancelled invitation', () => {
        const state = TestBed.inject(DemoStateService);
        state.cancelInvite('wd-m3');
        expect(state.acceptInvite('weber-design', 'wd-m3', 'Mia')).toBe(false);
      });
    });

    describe('updateLoginRows', () => {
      it("gives the login's row in every one of their businesses the new name and email, and no other row", () => {
        const state = TestBed.inject(DemoStateService);
        const others = state.businesses.flatMap((b) =>
          b.people.filter((m) => m.personId !== PERSON.id),
        );
        state.updateLoginRows(PERSON.id, 'Mara Klein', 'mara.klein@example.com');

        const own = state.businesses.flatMap((b) => b.people.filter((m) => m.personId === PERSON.id));
        expect(own).toHaveLength(3);
        for (const member of own) {
          expect(member).toMatchObject({ name: 'Mara Klein', email: 'mara.klein@example.com' });
        }
        expect(
          state.businesses.flatMap((b) => b.people.filter((m) => m.personId !== PERSON.id)),
        ).toEqual(others);
        // Not a change to the people of a business: no history line.
        expect(state.businesses.every((b) => b.history.length === 0)).toBe(true);
      });

      it('moves the invitation check and the member-email check to the new address', () => {
        const state = TestBed.inject(DemoStateService);
        expect(state.isMemberEmail('sara@example.com')).toBe(true);
        state.updateLoginRows(PERSON.id, 'Sara Weber', 'sara.klein@example.com');
        expect(state.isMemberEmail('sara@example.com')).toBe(false);
        expect(state.isMemberEmail(' Sara.Klein@example.com ')).toBe(true);

        const people = state.business().people;
        expect(state.invite('sara.klein@example.com', 'full')).toBe('hasAccess');
        expect(state.invite('SARA.KLEIN@example.com', 'full')).toBe('hasAccess');
        expect(state.business().people).toBe(people);
        // The old address is free to invite now.
        expect(state.invite('sara@example.com', 'full')).toBeNull();
        expect(state.business().people.at(-1)).toMatchObject({
          email: 'sara@example.com',
          status: 'invited',
        });
      });

      it('changes nothing for a login that has no rows, or when the rows already say this', () => {
        const state = TestBed.inject(DemoStateService);
        const before = state.businesses;
        state.updateLoginRows('p99', 'Nobody', 'nobody@example.com');
        state.updateLoginRows(PERSON.id, 'Sara Weber', 'sara@example.com');
        expect(state.businesses).toBe(before);
      });

      it('resetData puts the rows back as the sample has them', () => {
        const state = TestBed.inject(DemoStateService);
        state.updateLoginRows(PERSON.id, 'Mara Klein', 'mara.klein@example.com');
        state.resetData();
        expect(state.businesses[0].people).toEqual(BUSINESSES[0].people);
      });
    });

    describe('isMemberEmail', () => {
      it('is true for a row of any business, joined or invited, whatever the case', () => {
        const state = TestBed.inject(DemoStateService);
        expect(state.isMemberEmail('jana@kanzlei-hoffmann.example')).toBe(true);
        expect(state.isMemberEmail(' Mia@Example.COM')).toBe(true);
        expect(state.isMemberEmail('JONAS@cafe-linde.example')).toBe(true);
        expect(state.isMemberEmail('nobody@example.com')).toBe(false);
      });

      it('sees rows of businesses the signed-in person has no access to, and rows added by an invitation', () => {
        const accounts = TestBed.inject(AccountService);
        const state = TestBed.inject(DemoStateService);
        state.invite('lena@roth.example', 'full');
        signUp(accounts, state);
        expect(state.isMemberEmail('lena@roth.example')).toBe(true);
        expect(state.isMemberEmail('mia@becker.example')).toBe(true);
      });
    });

    it("resetData brings back Sara's memberships and Weber Design's people", () => {
      const state = TestBed.inject(DemoStateService);
      state.invite('lena@roth.example', 'full');
      state.removeMember('wd-m2');
      state.setSupportAccess(true);
      state.setBusiness('cafe-linde');
      state.leaveBusiness('cafe-linde');
      expect(idsOf(state)).toEqual(['weber-design', 'sara-yoga']);

      state.resetData();
      expect(idsOf(state)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      const weber = state.businesses[0];
      expect(weber.people).toEqual(BUSINESSES[0].people);
      expect(weber.supportUntil).toBeNull();
      expect(weber.history).toEqual([]);
      expect(state.businesses[2].people.map((m) => m.id)).toEqual(['cl-m1', 'cl-m2']);
    });

    it('resetData forgets the businesses people had open, so each opens their first again', () => {
      const state = TestBed.inject(DemoStateService);
      state.setBusiness('cafe-linde');
      state.resetData();
      expect(state.business().id).toBe('weber-design');
    });

    it("resetData does not sign anybody out: that is the account service's reset", () => {
      const accounts = TestBed.inject(AccountService);
      const state = TestBed.inject(DemoStateService);
      accounts.signIn('p1', false);
      state.resetData();
      expect(accounts.signedIn()).toBe(true);
    });
  });
});
