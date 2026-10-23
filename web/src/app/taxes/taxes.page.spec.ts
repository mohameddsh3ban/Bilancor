import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { confirmBooking } from '../domain/payment-actions';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { DemoStateService } from '../state/demo-state.service';
import { TaxesPage } from './taxes.page';

/** Stands in for the pages the Taxes page links to. */
@Component({ template: '' })
class Elsewhere {}

describe('TaxesPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'taxes', component: TaxesPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
          { path: 'review', component: Elsewhere },
          { path: 'settings/tax', component: Elsewhere },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Lets the page and any navigation finish; `el` is the page that is showing then (the one a link led to, say). */
  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
    el = harness!.routeNativeElement as HTMLElement;
  }

  /** Opens an address as a business (the first call of a test creates the harness; later calls navigate it). */
  async function render(businessId: string, url = '/taxes'): Promise<void> {
    demo.setBusiness(businessId);
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const router = () => TestBed.inject(Router);

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  it('has a title and two tabs for a business that charges VAT, the VAT return first', async () => {
    await render('weber-design');
    expect(text(el.querySelector('h1'))).toBe('Taxes');
    const tabs = Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'));
    expect(tabs.map(text)).toEqual(['VAT return', 'Year (EÜR)']);
    expect(tabs.map((t) => t.getAttribute('aria-selected'))).toEqual(['true', 'false']);
    expect(q('vat-deadline')).not.toBeNull();
    expect(q('year-total-income')).toBeNull();
  });

  it('the Year tab is ?tab=year', async () => {
    await render('weber-design');
    await click('tab-year');
    expect(router().url).toBe('/taxes?tab=year');
    expect(q('year-total-income')).not.toBeNull();
    expect(q('vat-deadline')).toBeNull();
    expect(
      el.querySelector<HTMLElement>('[data-testid="tab-year"]')!.getAttribute('aria-selected'),
    ).toBe('true');

    await click('tab-vat');
    expect(router().url).toBe('/taxes');
    expect(q('vat-deadline')).not.toBeNull();
    expect(q('year-total-income')).toBeNull();
  });

  it('opens on the Year tab from the address', async () => {
    await render('weber-design', '/taxes?tab=year');
    expect(q('year-total-income')).not.toBeNull();
    expect(q('vat-deadline')).toBeNull();
  });

  it('the tabs and the panel belong together', async () => {
    await render('weber-design');
    const panel = el.querySelector<HTMLElement>('[role="tabpanel"]')!;
    expect(panel).not.toBeNull();
    for (const tab of Array.from(el.querySelectorAll<HTMLElement>('[role="tab"]'))) {
      expect(tab.getAttribute('aria-controls')).toBe(panel.id);
    }
    expect(el.querySelector('[role="tablist"]')!.getAttribute('aria-label')).toBe('Taxes');
  });

  it('only the open tab is in the tab order, and the arrow keys move between them (mirrored in Arabic)', async () => {
    await render('weber-design');
    const tab = (name: string) => q(`tab-${name}`)!;
    const press = async (key: string) => {
      tab('vat').dispatchEvent(
        new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }),
      );
      await settle();
    };
    expect([tab('vat').tabIndex, tab('year').tabIndex]).toEqual([0, -1]);

    await press('ArrowRight');
    expect(router().url).toBe('/taxes?tab=year');
    expect(document.activeElement).toBe(tab('year'));
    expect([tab('vat').tabIndex, tab('year').tabIndex]).toEqual([-1, 0]);

    await press('ArrowRight'); // there is no tab after the last one
    expect(router().url).toBe('/taxes?tab=year');
    await press('ArrowLeft');
    expect(router().url).toBe('/taxes');
    expect(document.activeElement).toBe(tab('vat'));

    await press('End');
    expect(router().url).toBe('/taxes?tab=year');
    await press('Home');
    expect(router().url).toBe('/taxes');

    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    await press('ArrowLeft');
    expect(router().url).toBe('/taxes?tab=year');
    await press('ArrowRight');
    expect(router().url).toBe('/taxes');
  });

  it('see the payments opens /payments with the month filter set', async () => {
    await render('weber-design');
    await click('vat-see-payments');
    expect(router().url).toBe('/payments');
    expect((q('filter-month') as HTMLSelectElement).value).toBe('2026-10');
    const groups = Array.from(el.querySelectorAll('[data-testid="month-group"]'));
    expect(groups.map((g) => text(g.querySelector('[data-testid="month-title"]')))).toEqual([
      'October 2026',
    ]);
  });

  it('for a quarter, see the payments opens its first month', async () => {
    await render('cafe-linde');
    await click('vat-see-payments');
    expect((q('filter-month') as HTMLSelectElement).value).toBe('2026-07');
  });

  it('needs-you card starts the review', async () => {
    await render('weber-design');
    await click('vat-needs-start');
    expect(router().url).toBe('/review');
  });

  it('Fix payments first opens the review too', async () => {
    demo.setBusiness('cafe-linde');
    demo.updateTransaction('cl-t12', (tx) => ({ ...tx, confirmed: false }));
    await render('cafe-linde');
    await click('vat-send-button');
    expect(router().url).toBe('/review');
  });

  it('sara shows the tracker, no tabs, year figures', async () => {
    await render('sara-yoga');
    expect(q('tab-vat')).toBeNull();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(q('tax-tracker')).not.toBeNull();
    expect(el.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('85');
    expect(text(q('taxes-no-vat'))).toBe('No VAT return needed');
    expect(q('vat-deadline')).toBeNull();
    expect(text(q('year-total-income'))).toBe(formatMoney(2130000, 'en'));
    expect(q('year-return')).not.toBeNull();
  });

  it('confirming a payment moves the tracker and the year income together', async () => {
    await render('sara-yoga');
    expect(text(q('tax-tracker'))).toContain('€21,300 of €25,000');
    expect(text(q('year-total-income'))).toBe(formatMoney(2130000, 'en'));

    // Sara's €185 course payment waits for her answer; once confirmed it counts as income in both.
    demo.updateTransaction('sy-t2', confirmBooking);
    await settle();
    expect(text(q('tax-tracker'))).toContain('€21,485 of €25,000');
    expect(text(q('year-total-income'))).toBe(formatMoney(2148500, 'en'));
  });

  it('a Kleinunternehmer ignores ?tab=year: there is nothing else to switch to', async () => {
    await render('sara-yoga', '/taxes?tab=year');
    expect(q('tax-tracker')).not.toBeNull();
    expect(q('year-total-income')).not.toBeNull();
  });

  it('without tax details there are no figures, only a way to add them', async () => {
    demo.setBusiness('weber-design');
    demo.setSetup('new');
    await render('weber-design');
    expect(text(q('taxes-missing'))).toContain('Add your tax details to see your taxes');
    const link = q('taxes-missing-link')!;
    expect(text(link)).toBe('Add your tax details');
    expect(link.getAttribute('href')).toBe('/settings/tax');
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(q('vat-deadline')).toBeNull();
    expect(q('year-total-income')).toBeNull();
    expect(q('tax-tracker')).toBeNull();
    expect(el.textContent).not.toContain('€');
  });

  it('a business that charges VAT but has no return period yet is asked for its tax details too', async () => {
    demo.setBusiness('weber-design');
    demo.saveTaxProfile({ ...demo.business().taxProfile, vatPeriod: null });
    await render('weber-design');
    expect(q('taxes-missing')).not.toBeNull();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(q('year-total-income')).toBeNull();
  });

  it('shows the figures once the tax details are saved', async () => {
    demo.setBusiness('weber-design');
    demo.setSetup('new');
    await render('weber-design');
    expect(q('taxes-missing')).not.toBeNull();
    demo.saveTaxProfile({ ...demo.business().taxProfile });
    await settle();
    expect(q('taxes-missing')).toBeNull();
    expect(q('vat-deadline')).not.toBeNull();
  });

  it('taxes page follows a profile change', async () => {
    await render('weber-design');
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();

    // The business turns into a Kleinunternehmer: no tabs, the tracker and the year.
    demo.saveTaxProfile({
      ...demo.business().taxProfile,
      kleinunternehmer: true,
      vatPeriod: null,
      vatBasis: null,
    });
    await settle();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
    expect(q('tax-tracker')).not.toBeNull();
    expect(text(q('taxes-no-vat'))).toBe('No VAT return needed');
    expect(q('vat-deadline')).toBeNull();

    // And back to charging VAT, now every quarter.
    demo.saveTaxProfile({
      ...demo.business().taxProfile,
      kleinunternehmer: false,
      vatPeriod: 'quarterly',
      vatBasis: 'ist',
    });
    await settle();
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(q('tax-tracker')).toBeNull();
    expect(text(q('vat-deadline'))).toContain('Q4 2026');
  });

  it('follows the business that is open', async () => {
    await render('weber-design');
    expect(text(q('vat-deadline'))).toContain('October 2026');
    demo.setBusiness('cafe-linde');
    await settle();
    expect(text(q('vat-deadline'))).toContain('Q3 2026');
    demo.setBusiness('sara-yoga');
    await settle();
    expect(el.querySelector('[role="tablist"]')).toBeNull();
  });

  it('amounts are ltr in Arabic', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    for (const [business, url] of [
      ['weber-design', '/taxes'],
      ['weber-design', '/taxes?tab=year'],
      ['cafe-linde', '/taxes'],
      ['sara-yoga', '/taxes'],
    ]) {
      await render(business, url);
      expect(document.documentElement.dir).toBe('rtl');
      const isolated = Array.from(el.querySelectorAll('bdi[dir="ltr"]')).map(text);
      expect(
        isolated.some((t) => t.includes('€')),
        `${business} ${url}`,
      ).toBe(true);
      // Every amount sits in its own left-to-right element: none is left in the running text.
      const clone = el.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('bdi').forEach((node) => node.remove());
      expect(clone.textContent, `${business} ${url}`).not.toContain('€');
    }
  });

  it('dates and ticket numbers are left to right too', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render('weber-design');
    const deadline = q('vat-deadline')!;
    expect(deadline.querySelector('bdi[dir="ltr"]')?.textContent).toBeTruthy();
    for (const node of Array.from(el.querySelectorAll('[data-testid="vat-sent-on"]'))) {
      expect(node.querySelector('bdi[dir="ltr"]')).not.toBeNull();
    }
  });
});
