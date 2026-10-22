import { TestBed } from '@angular/core/testing';
import { BUSINESSES } from '../data/sample-data';
import { SafeStorage } from '../core/storage/safe-storage';
import { editDocument } from '../domain/document-actions';
import { ALL_DONE } from '../domain/home-cards';
import { DemoStateService } from './demo-state.service';
import { NoticeService } from './notice.service';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
const [terms, unreadable] = weber.notices;

describe('NoticeService', () => {
  beforeEach(() => localStorage.clear());

  it('shows the open notices of the current business, most urgent first', () => {
    const service = TestBed.inject(NoticeService);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, unreadable.id]);
    expect(service.overflow()).toEqual([]);
    expect(service.unreadCount()).toBe(2);
  });

  it('dismiss moves a notice to history', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    expect(service.shown().map((n) => n.id)).not.toContain(unreadable.id);
    expect(service.history()[0].id).toBe(unreadable.id);
    expect(service.unreadCount()).toBe(1);
  });

  it('history is newest first and keeps the earlier history entries', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    const ids = service.history().map((n) => n.id);
    expect(ids).toEqual([unreadable.id, ...weber.noticeHistory.map((n) => n.id)]);
  });

  it('ignores dismissing a blocking notice', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(terms.id);
    expect(service.shown().map((n) => n.id)).toContain(terms.id);
    expect(service.history().map((n) => n.id)).not.toContain(terms.id);
    expect(TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design')).toBeNull();
  });

  it('stores dismissed ids as a JSON array under the person and business key', () => {
    TestBed.inject(NoticeService).dismiss(unreadable.id);
    const raw = TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design');
    expect(JSON.parse(raw!)).toEqual([unreadable.id]);
  });

  it('dismissal is remembered by a new NoticeService', () => {
    TestBed.inject(NoticeService).dismiss(unreadable.id);
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(second.shown().map((n) => n.id)).not.toContain(unreadable.id);
    expect(second.history()[0].id).toBe(unreadable.id);
  });

  it('treats a corrupt stored value as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{not json');
    const service = TestBed.inject(NoticeService);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, unreadable.id]);
  });

  it('treats a stored non-array as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{"a":1}');
    expect(TestBed.inject(NoticeService).unreadCount()).toBe(2);
  });

  it('dismissal does not leak to another business', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    expect(service.shown().map((n) => n.id)).toEqual([sara.notices[0].id]);
    expect(service.history().map((n) => n.id)).toEqual(sara.noticeHistory.map((n) => n.id));
  });
});

describe('NoticeService and the setup state', () => {
  beforeEach(() => localStorage.clear());

  it('shows no bank notice and a zero badge for Café Linde while setup is new', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('cafe-linde');
    demo.setSetup('new');
    expect(service.shown()).toEqual([]);
    expect(service.unreadCount()).toBe(0);
    expect(service.history()).toEqual([]);
  });

  it('shows the bank notices but not the receipt notice for weber-design when halfway', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('halfway');
    expect(service.shown().map((n) => n.id)).toEqual([terms.id]);
    expect(service.overflow()).toEqual([]);
    expect(service.unreadCount()).toBe(1);
    expect(service.history().map((n) => n.kind)).toEqual(['bankExpiry']);
  });

  it('hides the revenue limit notice for sara-yoga when halfway', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setBusiness('sara-yoga');
    demo.setSetup('halfway');
    expect(service.unreadCount()).toBe(0);
    expect(service.history()).toEqual([]);
  });

  it('leaves the active state unchanged', () => {
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    demo.setSetup('active');
    expect(service.unreadCount()).toBe(2);
  });

  it('hides the revenue limit notice, open and earlier, once the business charges VAT', () => {
    const open = TestBed.inject(NoticeService);
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    expect(open.shown().map((n) => n.kind)).toEqual(['revenueLimit']);
    expect(open.history().map((n) => n.kind)).toEqual(['revenueLimit']);

    TestBed.resetTestingModule();
    const business = { ...sara, taxProfile: { ...sara.taxProfile, kleinunternehmer: false } };
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DemoStateService,
          useValue: { business: () => business, setup: () => ALL_DONE, documents: () => [], businesses: [business], person: { id: 'p1' } },
        },
      ],
    });
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
    service.dismiss(unreadable.id);
    expect(service.shown().map((n) => n.id)).not.toContain(unreadable.id);
    service.resetDismissals();
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, unreadable.id]);
    expect(service.unreadCount()).toBe(2);
    expect(service.history().map((n) => n.id)).toEqual(weber.noticeHistory.map((n) => n.id));
  });

  it('clears the stored dismissals of every business of the person', () => {
    const storage = TestBed.inject(SafeStorage);
    const demo = TestBed.inject(DemoStateService);
    const service = TestBed.inject(NoticeService);
    service.dismiss(unreadable.id);
    demo.setBusiness('sara-yoga');
    service.dismiss(sara.notices[0].id);
    service.resetDismissals();
    expect(JSON.parse(storage.get('mockup.dismissed.p1.weber-design')!)).toEqual([]);
    expect(JSON.parse(storage.get('mockup.dismissed.p1.sara-yoga')!)).toEqual([]);
    expect(service.shown().map((n) => n.id)).toEqual([sara.notices[0].id]);
  });

  it('a new NoticeService sees nothing dismissed after a reset', () => {
    TestBed.inject(NoticeService).dismiss(unreadable.id);
    TestBed.inject(NoticeService).resetDismissals();
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(second.unreadCount()).toBe(2);
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
    expect(service.unreadCount()).toBe(2);

    demo.updateDocument('wd-d1', (doc) => editDocument(doc, { amountCents: 4200 }));
    expect([...service.shown(), ...service.overflow()].map((n) => n.id)).toEqual([terms.id]);
    expect(service.unreadCount()).toBe(1);
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
