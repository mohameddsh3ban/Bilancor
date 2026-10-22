import { TestBed } from '@angular/core/testing';
import { OFFICE, SOFTWARE, TRAVEL } from '../data/categories';
import { FOUND_ACCOUNTS } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { Account, Booking, Doc, TaxProfile } from '../data/models';
import { BUSINESSES, PERSON } from '../data/sample-data';
import { counterpartyKey, type CategoryRule } from '../domain/category-rules';
import { docsNeedingYouCount } from '../domain/document-status';
import { ALL_DONE, presetOf, presetSteps } from '../domain/home-cards';
import { changeCategory, setPrivate } from '../domain/payment-actions';
import { needsYouCount, paymentStatus } from '../domain/payment-status';
import { DemoStateService } from './demo-state.service';

describe('DemoStateService', () => {
  it('starts with weber-design and every setup step done', () => {
    const state = TestBed.inject(DemoStateService);
    expect(state.person).toBe(PERSON);
    expect(state.businesses.map((b) => b.id)).toEqual(PERSON.businessIds);
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
      expect(state.business().accounts.some((a) => a.kind === 'cash')).toBe(false);
    });
  });
});
