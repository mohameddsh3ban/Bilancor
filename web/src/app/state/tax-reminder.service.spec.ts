import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SafeStorage } from '../core/storage/safe-storage';
import { DEMO_TODAY } from '../data/demo-date';
import type { SentVatReturn } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { DemoStateService } from './demo-state.service';
import { TaxReminderService } from './tax-reminder.service';

/** Stands in for the Taxes page, which the app gets later. */
@Component({ template: '' })
class TaxesStub {}

const cafeKey = 'mockup.taxReminder.p1.cafe-linde.2026-10-10';
const weberKey = 'mockup.taxReminder.p1.weber-design.2026-11-10';

/** A return sent today for a period, as the demo would record it. */
function sentFor(periodStart: string, periodEnd: string): SentVatReturn {
  return { periodStart, periodEnd, sentOn: DEMO_TODAY, chargedCents: 0, paidCents: 0, resultCents: 0, ticket: 'ET-TEST', taxOffice: null };
}

describe('TaxReminderService', () => {
  let demo: DemoStateService;
  let storage: SafeStorage;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: 'taxes', component: TaxesStub }])] });
    demo = TestBed.inject(DemoStateService);
    storage = TestBed.inject(SafeStorage);
  });

  /** A new app start: a fresh service on the same storage. */
  const restart = () => TestBed.runInInjectionContext(() => new TaxReminderService());
  const ids = (service: TaxReminderService) => service.due().map((item) => item.businessId);

  it('on start weber (due in 19 days) and cafe (overdue) are listed, cafe first', () => {
    const service = TestBed.inject(TaxReminderService);
    expect(service.due().map((item) => [item.businessId, item.name, item.view.dueDate, item.view.daysLeft])).toEqual([
      ['cafe-linde', 'Café Linde GbR', '2026-10-10', -12],
      ['weber-design', 'Weber Design', '2026-11-10', 19],
    ]);
    expect(service.due()[0].view.period).toMatchObject({ start: '2026-07-01', end: '2026-09-30', kind: 'quarterly' });
    expect(service.due()[1].view.period).toMatchObject({ start: '2026-10-01', end: '2026-10-31', kind: 'monthly' });
    expect(service.open()).toBe(true);
  });

  it('got it hides them for good (new service instance, same storage)', () => {
    const service = TestBed.inject(TaxReminderService);
    service.gotIt();
    expect(service.due()).toEqual([]);
    expect(service.open()).toBe(false);
    expect(storage.get(cafeKey)).not.toBeNull();
    expect(storage.get(weberKey)).not.toBeNull();
    expect(localStorage.getItem(cafeKey)).not.toBeNull();

    const next = restart();
    expect(next.due()).toEqual([]);
    expect(next.open()).toBe(false);
  });

  it('not now shows them again on the next start', () => {
    const service = TestBed.inject(TaxReminderService);
    service.notNow();
    expect(service.open()).toBe(false);
    expect(ids(service)).toEqual(['cafe-linde', 'weber-design']);
    expect(storage.get(cafeKey)).toBeNull();
    expect(storage.get(weberKey)).toBeNull();

    const next = restart();
    expect(next.open()).toBe(true);
    expect(ids(next)).toEqual(['cafe-linde', 'weber-design']);
  });

  it('a new deadline reminds again', () => {
    const service = TestBed.inject(TaxReminderService);
    service.gotIt();
    expect(service.due()).toEqual([]);
    // Café gets the one-month extension: its overdue return (10 Oct) is now due 10 Nov, a deadline nobody acknowledged.
    demo.setBusiness('cafe-linde');
    demo.saveTaxProfile({ ...demo.business().taxProfile, permanentExtension: true });
    expect(service.due().map((item) => [item.businessId, item.view.dueDate])).toEqual([['cafe-linde', '2026-11-10']]);
    expect(restart().open()).toBe(true);
  });

  it('an acknowledgement of an earlier deadline does not hide the current one', () => {
    // Café Q2 was due 10 Jul and Weber September 10 Oct; their current returns are due 10 Oct and 10 Nov.
    storage.set('mockup.taxReminder.p1.cafe-linde.2026-07-10', '1');
    storage.set('mockup.taxReminder.p1.weber-design.2026-10-10', '1');
    const service = TestBed.inject(TaxReminderService);
    expect(ids(service)).toEqual(['cafe-linde', 'weber-design']);
    expect(service.open()).toBe(true);
  });

  it('an acknowledged deadline stays hidden while the other business still reminds', () => {
    storage.set(weberKey, '1');
    const service = TestBed.inject(TaxReminderService);
    expect(ids(service)).toEqual(['cafe-linde']);
    expect(service.open()).toBe(true);
  });

  it('open taxes switches business and goes to /taxes', async () => {
    const service = TestBed.inject(TaxReminderService);
    expect(demo.business().id).toBe('weber-design');
    service.openTaxes('cafe-linde');
    expect(demo.business().id).toBe('cafe-linde');
    await vi.waitFor(() => expect(TestBed.inject(Router).url).toBe('/taxes'));
  });

  it('open taxes closes the pop-up as not now: nothing is acknowledged and it comes back next time', () => {
    const service = TestBed.inject(TaxReminderService);
    service.openTaxes('weber-design');
    expect(service.open()).toBe(false);
    expect(storage.get(weberKey)).toBeNull();
    expect(storage.get(cafeKey)).toBeNull();
    expect(restart().open()).toBe(true);
  });

  it('kleinunternehmer gets no reminder', () => {
    const sara = demo.businesses.find((b) => b.id === 'sara-yoga')!;
    expect(sara.taxProfile.kleinunternehmer).toBe(true);
    expect(ids(TestBed.inject(TaxReminderService))).not.toContain('sara-yoga');
  });

  it('a business with a yearly VAT return only gets no reminder: it has no monthly or quarterly date', () => {
    demo.setBusiness('sara-yoga');
    demo.saveTaxProfile({ ...demo.business().taxProfile, kleinunternehmer: false, vatPeriod: 'yearly' });
    expect(ids(TestBed.inject(TaxReminderService))).toEqual(['cafe-linde', 'weber-design']);
  });

  it("no reminder while the tax step isn't done", () => {
    const service = TestBed.inject(TaxReminderService);
    // The "new client" setup of Weber Design: no tax details yet, so its return is not known. Café Linde keeps its own steps.
    demo.setSetup('new');
    expect(ids(service)).toEqual(['cafe-linde']);
    // "Halfway" has the bank but not the tax step either.
    demo.setSetup('halfway');
    expect(ids(service)).toEqual(['cafe-linde']);
    // Café Linde too, then back to "active" for Café Linde only.
    demo.setBusiness('cafe-linde');
    demo.setSetup('halfway');
    expect(service.due()).toEqual([]);
    demo.setSetup('active');
    expect(ids(service)).toEqual(['cafe-linde']);
  });

  it('the reminder appears once the tax step is done', () => {
    demo.setSetup('new');
    demo.setBusiness('cafe-linde');
    demo.setSetup('new');
    const service = TestBed.inject(TaxReminderService);
    expect(service.due()).toEqual([]);
    expect(service.open()).toBe(false);

    demo.completeStep('tax', 'weber-design');
    expect(ids(service)).toEqual(['weber-design']);
    demo.completeStep('tax', 'cafe-linde');
    expect(ids(service)).toEqual(['cafe-linde', 'weber-design']);
    // It only opens when the app starts or after a reset, not at the moment the tax details are saved.
    expect(service.open()).toBe(false);
  });

  it('a return that is more than 21 days away is not listed yet', () => {
    // Weber's October return is due 10 Nov (19 days); with the one-month extension it is due 10 Dec (49 days).
    demo.saveTaxProfile({ ...demo.business().taxProfile, permanentExtension: true });
    expect(ids(TestBed.inject(TaxReminderService))).toEqual(['cafe-linde']);
  });

  it('no pop-up when nothing is due', () => {
    demo.recordSentReturn(sentFor('2026-07-01', '2026-09-30'), 'cafe-linde');
    demo.recordSentReturn(sentFor('2026-10-01', '2026-10-31'), 'weber-design');
    const service = TestBed.inject(TaxReminderService);
    expect(service.due()).toEqual([]);
    expect(service.open()).toBe(false);
  });

  it('a business that becomes due later does not open the pop-up by itself', () => {
    demo.recordSentReturn(sentFor('2026-07-01', '2026-09-30'), 'cafe-linde');
    demo.recordSentReturn(sentFor('2026-10-01', '2026-10-31'), 'weber-design');
    const service = TestBed.inject(TaxReminderService);
    expect(service.open()).toBe(false);
    // Café now files monthly: its next return is October, due 10 Nov, so it is listed, but the app was opened before.
    demo.setBusiness('cafe-linde');
    demo.saveTaxProfile({ ...demo.business().taxProfile, vatPeriod: 'monthly' });
    expect(ids(service)).toEqual(['cafe-linde']);
    expect(service.open()).toBe(false);
  });

  it('reset brings reminders back', () => {
    const service = TestBed.inject(TaxReminderService);
    service.gotIt();
    expect(service.open()).toBe(false);
    expect(storage.get(cafeKey)).not.toBeNull();

    demo.resetData();
    TestBed.tick();
    expect(ids(service)).toEqual(['cafe-linde', 'weber-design']);
    expect(service.open()).toBe(true);
    expect(storage.get(cafeKey)).toBeNull();
    expect(storage.get(weberKey)).toBeNull();
    expect(localStorage.getItem(cafeKey)).toBeNull();
  });

  it('reset clears every tax reminder acknowledgement, and nothing else', () => {
    storage.set('mockup.taxReminder.p1.cafe-linde.2026-07-10', '1');
    storage.set('mockup.taxReminder.p1.old-business.2025-01-10', '1');
    storage.set('mockup.dismissed.p1.weber-design', '["x"]');
    const service = TestBed.inject(TaxReminderService);
    service.gotIt();
    demo.resetData();
    TestBed.tick();
    expect(storage.get('mockup.taxReminder.p1.cafe-linde.2026-07-10')).toBeNull();
    expect(storage.get('mockup.taxReminder.p1.old-business.2025-01-10')).toBeNull();
    expect(storage.get('mockup.dismissed.p1.weber-design')).toBe('["x"]');
  });

  it('reset reopens the pop-up after Not now, too', () => {
    const service = TestBed.inject(TaxReminderService);
    service.notNow();
    expect(service.open()).toBe(false);
    demo.resetData();
    TestBed.tick();
    expect(service.open()).toBe(true);
  });
});
