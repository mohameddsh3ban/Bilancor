import { TestBed } from '@angular/core/testing';
import { BUSINESSES } from '../data/sample-data';
import { SafeStorage } from '../core/storage/safe-storage';
import { DemoStateService } from './demo-state.service';
import { NoticeService } from './notice.service';

const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
const cafe = BUSINESSES.find((b) => b.id === 'cafe-linde')!;
const [terms, bankExpiry, unreadable] = weber.notices;

describe('NoticeService', () => {
  beforeEach(() => localStorage.clear());

  it('shows the two most urgent notices of the current business', () => {
    const service = TestBed.inject(NoticeService);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
    expect(service.overflow().map((n) => n.id)).toEqual([unreadable.id]);
    expect(service.unreadCount()).toBe(3);
  });

  it('dismiss moves a notice to history', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiry.id);
    expect(service.shown().map((n) => n.id)).not.toContain(bankExpiry.id);
    expect(service.history()[0].id).toBe(bankExpiry.id);
    expect(service.unreadCount()).toBe(2);
  });

  it('history is newest first and keeps the earlier history entries', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiry.id);
    const ids = service.history().map((n) => n.id);
    expect(ids).toEqual([bankExpiry.id, ...weber.noticeHistory.map((n) => n.id)]);
  });

  it('ignores dismissing a blocking notice', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(terms.id);
    expect(service.shown().map((n) => n.id)).toContain(terms.id);
    expect(service.history().map((n) => n.id)).not.toContain(terms.id);
    expect(TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design')).toBeNull();
  });

  it('stores dismissed ids as a JSON array under the person and business key', () => {
    TestBed.inject(NoticeService).dismiss(bankExpiry.id);
    const raw = TestBed.inject(SafeStorage).get('mockup.dismissed.p1.weber-design');
    expect(JSON.parse(raw!)).toEqual([bankExpiry.id]);
  });

  it('dismissal is remembered by a new NoticeService', () => {
    TestBed.inject(NoticeService).dismiss(bankExpiry.id);
    const second = TestBed.runInInjectionContext(() => new NoticeService());
    expect(second.shown().map((n) => n.id)).not.toContain(bankExpiry.id);
    expect(second.history()[0].id).toBe(bankExpiry.id);
  });

  it('treats a corrupt stored value as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{not json');
    const service = TestBed.inject(NoticeService);
    expect(service.shown().map((n) => n.id)).toEqual([terms.id, bankExpiry.id]);
  });

  it('treats a stored non-array as nothing dismissed', () => {
    TestBed.inject(SafeStorage).set('mockup.dismissed.p1.weber-design', '{"a":1}');
    expect(TestBed.inject(NoticeService).unreadCount()).toBe(3);
  });

  it('dismissal does not leak to another business', () => {
    const service = TestBed.inject(NoticeService);
    service.dismiss(bankExpiry.id);
    TestBed.inject(DemoStateService).setBusiness('cafe-linde');
    expect(service.shown().map((n) => n.id)).toEqual([cafe.notices[0].id]);
    expect(service.history().map((n) => n.id)).toEqual(cafe.noticeHistory.map((n) => n.id));
  });
});
