import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { SafeStorage } from '../core/storage/safe-storage';
import { editDocument } from '../domain/document-actions';
import { ALL_DONE } from '../domain/home-cards';
import { DemoStateService } from './demo-state.service';
import { InvoiceService } from './invoice.service';
import { NoticeService } from './notice.service';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
const terms = weber.notices.find((n) => n.kind === 'terms')!;
const unreadable = weber.notices.find((n) => n.kind === 'unreadable')!;
const revenueLimit = sara.notices.find((n) => n.kind === 'revenueLimit')!;
// The bank notices are calculated from the accounts, so their ids are not in the sample data.
const bankExpiryId = 'bank-expiry-wd-qonto';
const bankEndedId = 'bank-ended-sy-qonto';
// So is the notice for the invoice that is overdue: Weber Design's RE-2026-039 to Bäckerei Lange, not reminded.
const lateId = 'invoice-overdue-inv-wd-039';

/** Every open notice id, shown or in the overflow, in the order they come. */
const openIds = (service: NoticeService) => [...service.shown(), ...service.overflow()].map((n) => n.id);

/** A stand-in for the demo state with a business the test can change, every step done. */
function provideBusiness(business: () => Business, businesses: Business[]) {
  return {
    provide: DemoStateService,
    useValue: { business, setup: () => ALL_DONE, documents: () => [], businesses, person: { id: 'p1' } },
  };
}

describe('NoticeService', () => {
  beforeEach(() => localStorage.clear());

  it('shows the two most urgent notices of the current business and overflows the rest', () => {
    const service = TestBed.inject(NoticeService);
    // Weber Design: the terms (urgency 1), the calculated bank notice (2), the calculated late-invoice notice (2) and the unreadable receipts (3).
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiryId]);
    expect(service.overflow().map((n) => n.id)).toEqual([lateId, unreadable.id]);
    expect(service.unreadCount()).toBe(4);
  });

  it('dismiss moves a notice to history and the overflow moves up', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiryId);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, lateId]);
    expect(service.overflow().map((n) => n.id)).toEqual([unreadable.id]);
    expect(service.history()[0].id).toBe(bankExpiryId);
    expect(service.unreadCount()).toBe(3);
  });

  it('dismissing a notice in the overflow leaves what is shown as it is', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiryId]);
    expect(service.overflow().map((n) => n.id)).toEqual([lateId]);
    expect(service.history()[0].id).toBe(unreadable.id);
    expect(service.unreadCount()).toBe(3);
  });

  it('history is newest first and keeps the earlier history entries', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    service.dismiss(bankExpiryId);
    const ids = service.history().map((n) => n.id);
    // The bank notice is dated today, the unreadable one 18 Oct, then the stored history.
    expect(ids).toEqual([bankExpiryId, unreadable.id, ...weber.noticeHistory.map((n) => n.id)]);
  });

  it('ignores dismissing a blocking notice', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(terms.id);
    expect(service.shown().map((n) => n.id)).toContain(terms.id);
    expect(service.history().map((n) => n.id)).not.toContain(terms.id);
    expect(TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design')).toBeNull();
  });

  it('stores dismissed ids as a JSON array under the person and business key', () => {
    TestBed.inject(NoticeService).dismiss(bankExpiryId);
    const raw = TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design');
    expect(JSON.parse(raw!)).toEqual([bankExpiryId]);
  });

  it('dismissal is remembered by a new NoticeService', () => {
    TestBed.inject(NoticeService).dismiss(bankExpiryId);
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(second.shown().map((n) => n.id)).toEqual([terms.id, lateId]);
    expect(second.history()[0].id).toBe(bankExpiryId);
  });

  it('treats a corrupt stored value as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{not json');
    const service = TestBed.inject(NoticeService);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiryId]);
  });

  it('treats a stored non-array as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{"a":1}');
    expect(TestBed.inject(NoticeService).unreadCount()).toBe(4);
  });

  it('dismissal does not leak to another business', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiryId);
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    expect(service.shown().map((n) => n.id)).toEqual([bankEndedId, revenueLimit.id]);
    expect(service.history().map((n) => n.id)).toEqual(sara.noticeHistory.map((n) => n.id));
  });
});

describe('NoticeService and the bank connections', () => {
  beforeEach(() => localStorage.clear());

  it('adds the bank notice that Weber Design needs: its Qonto connection expires in 5 days', () => {
    const service = TestBed.inject(NoticeService);
    const notice = service.shown().find((n) => n.kind === 'bankExpiry');
    expect(notice).toMatchObject({ id: bankExpiryId, params: { bank: 'Qonto', days: 5 }, blocking: false });
  });

  it('adds the "ended" notice that Sara Weber Yoga needs, above its revenue-limit notice', () => {
    const service = TestBed.inject(NoticeService);
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    expect(service.shown().map((n) => n.kind)).toEqual(['bankEnded', 'revenueLimit']);
    expect(service.shown()[0]).toMatchObject({ id: bankEndedId, params: { bank: 'Qonto' } });
    expect(service.unreadCount()).toBe(2);
  });

  it('Café Linde needs no bank notice: nothing of its connections ends soon', () => {
    const service = TestBed.inject(NoticeService);
    TestBed.inject(DemoStateService).setBusiness('cafe-linde');
    expect(openIds(service)).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('a dismissed bank notice goes to the history, dated today, and stays dismissed', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiryId);
    expect(openIds(service)).not.toContain(bankExpiryId);
    expect(service.history()[0]).toMatchObject({ id: bankExpiryId, kind: 'bankExpiry', date: DEMO_TODAY });
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(openIds(second)).not.toContain(bankExpiryId);
  });

  it('the bank notice goes when the connection is renewed, and it does not come to the history', () => {
    const renewed: Business = {
      ...weber,
      accounts: weber.accounts.map((a) =>
        a.id === 'wd-qonto' ? { ...a, connection: { ...a.connection, consentUntil: '2027-04-20', lastFetched: '2026-10-22T09:00' } } : a,
      ),
    };
    const business = signal<Business>(weber);
    TestBed.configureTestingModule({ providers: [provideBusiness(business, [weber])] });
    const service = TestBed.inject(NoticeService);
    expect(openIds(service)).toEqual([terms.id, bankExpiryId, lateId]);
    business.set(renewed);
    expect(openIds(service)).toEqual([terms.id, lateId]);
    expect(service.unreadCount()).toBe(2);
    expect(service.history().map((n) => n.id)).toEqual(weber.noticeHistory.map((n) => n.id));
  });

  it('the "ended" notice goes once the person has signed in again', () => {
    // Charging VAT, so the revenue-limit notice does not take part.
    const taxProfile = { ...sara.taxProfile, kleinunternehmer: false };
    const business = signal<Business>({ ...sara, taxProfile });
    TestBed.configureTestingModule({ providers: [provideBusiness(business, [sara])] });
    const service = TestBed.inject(NoticeService);
    expect(openIds(service)).toEqual([bankEndedId]);
    business.set({
      ...sara,
      taxProfile,
      accounts: sara.accounts.map((a) => ({ ...a, connection: { ...a.connection, consentUntil: '2027-04-20', broken: false } })),
    });
    expect(openIds(service)).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('a connection the bank reports as broken gets the "ended" notice even with months of consent left', () => {
    const broken: Business = {
      ...weber,
      accounts: weber.accounts.map((a) =>
        a.id === 'wd-qonto' ? { ...a, connection: { ...a.connection, consentUntil: '2027-04-20', broken: true } } : a,
      ),
    };
    TestBed.configureTestingModule({ providers: [provideBusiness(() => broken, [broken])] });
    expect(openIds(TestBed.inject(NoticeService))).toEqual([terms.id, 'bank-ended-wd-qonto', lateId]);
  });
});

describe('NoticeService and the setup state', () => {
  beforeEach(() => localStorage.clear());

  it('shows no notices and a zero badge for Weber Design while setup is new', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    // Weber Design has open notices and earlier ones, so it is the setup that hides them.
    expect(service.unreadCount()).toBe(4);
    expect(service.history()).not.toEqual([]);
    demo.setSetup('new');
    expect(service.shown()).toEqual([]);
    expect(service.overflow()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(service.history()).toEqual([]);
  });

  it('hides the earlier notices of Café Linde while setup is new', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('cafe-linde');
    expect(service.history().map((n) => n.id)).toEqual(['cl-h1']);
    demo.setSetup('new');
    expect(service.history()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('shows the terms, the bank notice and the late invoice but not the receipt notice for Weber Design when halfway', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('halfway');
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiryId]);
    expect(service.overflow().map((n) => n.id)).toEqual([lateId]);
    expect(service.unreadCount()).toBe(3);
    expect(service.history().map((n) => n.kind)).toEqual(['bankExpiry']);
  });

  it('shows no bank notice before the bank step is done, whatever the connections say', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('sara-yoga');
    expect(openIds(service)).toContain(bankEndedId);
    demo.setSetup('new');
    expect(openIds(service)).toEqual([]);
    expect(service.unreadCount()).toBe(0);
  });

  it('hides the revenue limit notice for sara-yoga when halfway, but not the bank notice', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('sara-yoga');
    demo.setSetup('halfway');
    expect(service.shown().map((n) => n.kind)).toEqual(['bankEnded']);
    expect(service.unreadCount()).toBe(1);
    expect(service.history()).toEqual([]);
  });

  it('leaves the active state unchanged', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('active');
    expect(service.unreadCount()).toBe(4);
  });

  it('hides the revenue limit notice, open and earlier, once the business charges VAT', () => {
    const open = TestBed.inject(NoticeService);
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    expect(open.shown().map((n) => n.kind)).toEqual(['bankEnded', 'revenueLimit']);
    expect(open.history().map((n) => n.kind)).toEqual(['revenueLimit']);

    TestBed.resetTestingModule();
    // No accounts either, so the bank notice cannot make up for a revenue-limit notice that is wrongly still there.
    const business = { ...sara, accounts: [], taxProfile: { ...sara.taxProfile, kleinunternehmer: false } };
    TestBed.configureTestingModule({ providers: [provideBusiness(() => business, [business])] });
    const service = TestBed.inject(NoticeService);
    expect(service.shown()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(service.history()).toEqual([]);
  });
});

describe('NoticeService.resetDismissals', () => {
  beforeEach(() => localStorage.clear());

  it('brings a dismissed notice back and empties the history entry', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiryId);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, lateId]);
    service.resetDismissals();
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiryId]);
    expect(service.overflow().map((n) => n.id)).toEqual([lateId, unreadable.id]);
    expect(service.unreadCount()).toBe(4);
    expect(service.history().map((n) => n.id)).toEqual(weber.noticeHistory.map((n) => n.id));
  });

  it('clears the stored dismissals of every business of the person', () => {
    const storage = TestBed.inject(SafeStorage);
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiryId);
    demo.setBusiness('sara-yoga');
    service.dismiss(revenueLimit.id);
    service.resetDismissals();
    expect(JSON.parse(storage.get('mockup.dismissed.p1.weber-design')!)).toEqual([]);
    expect(JSON.parse(storage.get('mockup.dismissed.p1.sara-yoga')!)).toEqual([]);
    expect(service.shown().map((n) => n.id)).toEqual([bankEndedId, revenueLimit.id]);
  });

  it('a new NoticeService sees nothing dismissed after a reset', () => {
    TestBed.inject(NoticeService).dismiss(bankExpiryId);
    TestBed.inject(NoticeService).resetDismissals();
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(second.unreadCount()).toBe(4);
  });
});

describe('NoticeService and the unreadable receipts', () => {
  beforeEach(() => localStorage.clear());

  const countOf = (service: NoticeService) =>
    [...service.shown(), ...service.overflow()].find((n) => n.kind === 'unreadable')?.params['count'];

  it('the unreadable notice counts 1 for weber-design and disappears once the amount is typed', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    // The stored count (2) is only a sample; the notice counts the documents that need a check now.
    expect(countOf(service)).toBe(1);
    expect(service.unreadCount()).toBe(4);

    demo.updateDocument('wd-d1', (doc) => editDocument(doc, { amountCents: 4200 }));
    expect(openIds(service)).toEqual([terms.id, bankExpiryId, lateId]);
    expect(service.unreadCount()).toBe(3);
  });

  it('counts a missing date or name as well, and the notice comes back with the next one', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.updateDocument('wd-d4', (doc) => ({ ...doc, date: null }));
    demo.updateDocument('wd-d2', (doc) => ({ ...doc, name: null }));
    expect(countOf(service)).toBe(3);
    demo.updateDocument('wd-d1', (doc) => editDocument(doc, { amountCents: 4200 }));
    demo.updateDocument('wd-d4', (doc) => editDocument(doc, { date: '2026-10-08' }));
    demo.updateDocument('wd-d2', (doc) => editDocument(doc, { name: 'Studio Kern' }));
    expect(countOf(service)).toBeUndefined();
    demo.updateDocument('wd-d3', (doc) => ({ ...doc, amountCents: null }));
    expect(countOf(service)).toBe(1);
  });

  it('keeps the counts of the earlier notices', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.updateDocument('wd-d1', (doc) => editDocument(doc, { amountCents: 4200 }));
    expect(service.history().map((n) => [n.id, n.params['count']])).toEqual(
      weber.noticeHistory.map((n) => [n.id, n.params['count']]),
    );
  });

  it('a dismissed unreadable notice goes to the history with its live count', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    expect(service.history()[0]).toMatchObject({ id: unreadable.id, params: { count: 1 } });
  });

  it('counts only what is visible: nothing before the receipt step is done', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('halfway');
    expect(countOf(service)).toBeUndefined();
  });

  it('a business without an unreadable notice gets none, whatever its documents', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('sara-yoga');
    demo.updateDocument('sy-d1', (doc) => ({ ...doc, amountCents: null }));
    expect(countOf(service)).toBeUndefined();
  });
});

describe('NoticeService and the invoices', () => {
  beforeEach(() => localStorage.clear());

  it('adds a notice for the overdue invoice nobody was reminded about, after the bank notice of the same urgency', () => {
    const service = TestBed.inject(NoticeService);
    expect(openIds(service)).toEqual([terms.id, bankExpiryId, lateId, unreadable.id]);
    expect(service.overflow().map((n) => n.id)).toEqual([lateId, unreadable.id]);
    expect(service.unreadCount()).toBe(4);
    expect([...service.shown(), ...service.overflow()].find((n) => n.id === lateId)).toMatchObject({
      kind: 'invoiceOverdue',
      urgency: 2,
      params: { name: 'Bäckerei Lange', number: 'RE-2026-039', days: 22, id: 'inv-wd-039' },
    });
  });

  it('no invoice notice before the bank step', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('new');
    expect(openIds(service)).toEqual([]);
    expect(service.history()).toEqual([]);
    demo.setSetup('halfway');
    expect(openIds(service)).toEqual([terms.id, bankExpiryId, lateId]);
  });

  it('goes away once the invoice is reminded, also from the history', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    service.dismiss(lateId);
    expect(service.history()[0].id).toBe(lateId);
    service.resetDismissals();
    const lange = demo.business().invoices.find((i) => i.id === 'inv-wd-039')!;

    demo.saveInvoice({ ...lange, reminders: [{ level: 1, sentOn: DEMO_TODAY }] });

    expect(openIds(service)).toEqual([terms.id, bankExpiryId, unreadable.id]);
    expect(service.history().map((n) => n.id)).not.toContain(lateId);
  });

  it('goes away once the invoice is paid', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);

    TestBed.inject(InvoiceService).simulatePayment('inv-wd-039');

    expect(demo.business().invoices.find((i) => i.id === 'inv-wd-039')!.paymentIds).toHaveLength(1);
    expect(openIds(service)).toEqual([terms.id, bankExpiryId, unreadable.id]);
  });
});
