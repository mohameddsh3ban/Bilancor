import { TestBed } from '@angular/core/testing';
import { OFFICE, SOFTWARE, TRAVEL } from '../data/categories';
import type { Booking, Doc } from '../data/models';
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
});
