import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { groupByMonth } from '../domain/payment-filters';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';

describe('PaymentsPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
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

  async function render(url = '/payments'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  async function type(value: string): Promise<void> {
    const input = q('payment-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  async function pick(testId: string, value: string): Promise<void> {
    const select = q(testId) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  it('list groups by month with totals', async () => {
    await render();
    const groups = groupByMonth(demo.business().transactions);
    expect(groups.map((g) => g.month)).toEqual(['2026-10', '2026-09', '2026-08']);
    const sections = qa('month-group');
    expect(sections).toHaveLength(3);
    expect(text(sections[0].querySelector('[data-testid="month-title"]'))).toBe('October 2026');
    expect(text(sections[2].querySelector('[data-testid="month-title"]'))).toBe('August 2026');
    groups.forEach((group, i) => {
      expect(text(sections[i].querySelector('[data-testid="month-in"]'))).toContain(
        formatMoney(group.inCents, 'en', { signed: true }),
      );
      expect(text(sections[i].querySelector('[data-testid="month-out"]'))).toContain(
        formatMoney(group.outCents, 'en', { signed: true }),
      );
      expect(sections[i].querySelectorAll('[data-testid="payment-row"]')).toHaveLength(
        group.payments.length,
      );
    });
  });

  it('shows every payment in both the phone list and the computer table', async () => {
    await render();
    const total = demo.business().transactions.length;
    expect(qa('payment-row')).toHaveLength(total);
    expect(qa('payment-table-row')).toHaveLength(total);
    expect(q('payment-table')!.parentElement!.classList).toContain('lg:block');
    expect(q('payment-table')!.parentElement!.classList).toContain('hidden');
    expect(qa('payment-row')[0].closest('app-payment-list')!.classList).toContain('lg:hidden');
  });

  it('rows open their payment', async () => {
    await render();
    const row = qa('payment-row').find((r) => r.textContent?.includes('Deutsche Bahn'))!;
    expect(row.getAttribute('href')).toBe('/payments/wd-t3');
    const link = qa('payment-table-counterparty').find((r) =>
      r.textContent?.includes('Deutsche Bahn'),
    )!;
    expect(link.getAttribute('href')).toBe('/payments/wd-t3');
    expect(link.classList).toContain('after:absolute');
    expect(link.closest('tr')!.classList).toContain('relative');
  });

  it('quick filter Needs you shows 4 for weber-design', async () => {
    await render();
    expect(text(q('quick-needsYou'))).toContain('4');
    expect(q('quick-all')!.getAttribute('aria-pressed')).toBe('true');
    await click('quick-needsYou');
    expect(q('quick-needsYou')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('quick-all')!.getAttribute('aria-pressed')).toBe('false');
    expect(qa('payment-row')).toHaveLength(4);
    expect(qa('payment-table-row')).toHaveLength(4);
    expect(
      qa('payment-row').map((r) => text(r.querySelector('[data-testid="tx-status"]'))),
    ).toEqual(['Please confirm', 'Receipt missing', 'Unclear', 'Receipt missing']);
  });

  it('Money in and Money out narrow the list', async () => {
    await render();
    await click('quick-in');
    expect(qa('payment-row').length).toBeGreaterThan(0);
    for (const amount of qa('payment-amount')) expect(amount.textContent).toContain('+');
    await click('quick-out');
    expect(qa('payment-row').length).toBeGreaterThan(0);
    for (const amount of qa('payment-amount')) expect(amount.textContent).not.toContain('+');
  });

  it('search filters as you type and shows a removable chip', async () => {
    await render();
    await type('telekom');
    expect(qa('payment-row')).toHaveLength(3);
    expect(text(q('chip-search'))).toContain('telekom');
    await click('chip-search-remove');
    expect(q('chip-search')).toBeNull();
    expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
    expect((q('payment-search') as HTMLInputElement).value).toBe('');
  });

  it('account and month filters narrow the list and show removable chips', async () => {
    await render();
    await pick('filter-account', 'wd-cash');
    expect(qa('payment-row')).toHaveLength(1);
    expect(text(q('chip-account'))).toContain('Cash box');
    await pick('filter-month', '2026-09');
    expect(qa('payment-row')).toHaveLength(0);
    expect(text(q('chip-month'))).toContain('September 2026');
    await click('chip-account-remove');
    expect(q('chip-account')).toBeNull();
    expect(qa('payment-row')).toHaveLength(4);
    await click('chip-month-remove');
    expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
  });

  it('only offers the open business accounts and its months', async () => {
    await render();
    const accounts = Array.from((q('filter-account') as HTMLSelectElement).options).map(
      (o) => o.value,
    );
    expect(accounts).toEqual(['', 'wd-qonto', 'wd-cash']);
    const months = Array.from((q('filter-month') as HTMLSelectElement).options).map((o) => o.value);
    expect(months).toEqual(['', '2026-10', '2026-09', '2026-08']);
  });

  it('clear all appears only when a filter is set', async () => {
    await render();
    expect(q('clear-all')).toBeNull();
    await click('quick-in');
    expect(q('clear-all')).not.toBeNull();
    await click('clear-all');
    expect(q('clear-all')).toBeNull();
    expect(q('quick-all')!.getAttribute('aria-pressed')).toBe('true');
  });

  it('empty result lists active filters and clears them', async () => {
    await render();
    await click('quick-in');
    await type('zzzz');
    expect(qa('payment-row')).toHaveLength(0);
    const empty = q('empty-no-match')!;
    expect(text(empty)).toContain('No payments match');
    expect(text(empty.querySelector('[data-testid="chip-search"]'))).toContain('zzzz');
    expect(text(empty.querySelector('[data-testid="chip-quick"]'))).toContain('Money in');
    empty.querySelector<HTMLElement>('[data-testid="clear-all"]')!.click();
    await settle();
    expect(q('empty-no-match')).toBeNull();
    expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
    expect((q('payment-search') as HTMLInputElement).value).toBe('');
  });

  it('needs-you with nothing left shows the all-clear', async () => {
    demo.setBusiness('cafe-linde');
    await render();
    expect(text(q('quick-needsYou'))).toContain('0');
    await click('quick-needsYou');
    expect(qa('payment-row')).toHaveLength(0);
    expect(q('empty-no-match')).toBeNull();
    expect(text(q('empty-all-clear'))).toContain('Nothing needs you');
    await click('show-all');
    expect(q('empty-all-clear')).toBeNull();
    expect(qa('payment-row').length).toBeGreaterThan(0);
  });

  it('needs-you with a search that matches nothing explains the filters, not an all-clear', async () => {
    await render();
    await click('quick-needsYou');
    await type('zzzz');
    expect(q('empty-all-clear')).toBeNull();
    expect(q('empty-no-match')).not.toBeNull();
    expect(text(q('empty-no-match')!.querySelector('[data-testid="chip-quick"]'))).toContain(
      'Needs you',
    );
  });

  it('new client sees connect-your-bank', async () => {
    demo.setSetup('new');
    await render();
    expect(text(q('empty-new'))).toContain('Connect your bank to see your payments');
    expect(q('empty-new-action')!.getAttribute('href')).toBe('/soon/bank');
    expect(qa('payment-row')).toHaveLength(0);
    expect(qa('payment-table-row')).toHaveLength(0);
    expect(text(q('quick-needsYou'))).toContain('0');
    expect(q('empty-no-match')).toBeNull();
  });

  it('halfway client sees the payments', async () => {
    demo.setSetup('halfway');
    await render();
    expect(q('empty-new')).toBeNull();
    expect(qa('payment-row').length).toBeGreaterThan(0);
  });

  it('counterparty truncates with dir auto and amounts are ltr bdi', async () => {
    await render();
    const names = qa('payment-counterparty');
    expect(names).toHaveLength(demo.business().transactions.length);
    for (const name of names) {
      expect(name.classList).toContain('truncate');
      expect(name.getAttribute('dir')).toBe('auto');
      expect(name.parentElement?.classList).toContain('min-w-0');
    }
    for (const name of qa('payment-table-counterparty')) {
      expect(name.classList).toContain('truncate');
      expect(name.getAttribute('dir')).toBe('auto');
    }
    for (const amount of [...qa('payment-amount'), ...qa('payment-table-amount')]) {
      expect(amount.closest('bdi[dir="ltr"]')).not.toBeNull();
    }
    for (const total of [...qa('month-in'), ...qa('month-out')]) {
      expect(total.querySelector('bdi[dir="ltr"]')).not.toBeNull();
    }
  });

  it('signs and colours amounts', async () => {
    await render();
    const amounts = qa('payment-amount');
    const income = amounts.find((a) => a.textContent?.includes('+'))!;
    const expense = amounts.find((a) => !a.textContent?.includes('+'))!;
    expect(income.className).toContain('text-positive');
    expect(expense.className).toContain('text-negative');
  });

  it('table booking cell is label plus SKR03 in English and SKR03 only in German', async () => {
    await render();
    const bookingOf = () =>
      text(
        qa('payment-table-row')
          .find((r) => r.textContent?.includes('Telekom'))!
          .querySelector('[data-testid="payment-table-booking"]'),
      );
    expect(bookingOf()).toBe('Phone & internet · 4920 Telefon');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(bookingOf()).toBe('4920 Telefon');
  });

  it('table has the six columns', async () => {
    await render();
    const heads = Array.from(
      el.querySelectorAll('[data-testid="payment-table"] th[scope="col"]'),
    ).map((h) => h.textContent?.trim());
    expect(heads).toEqual(['Date', 'Counterparty', 'Account', 'Booking', 'Status', 'Amount']);
  });

  it('month names follow the language', async () => {
    await render();
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(text(qa('month-title')[0])).toBe('Oktober 2026');
  });

  it('download month links to the print view of the filtered month, or the newest', async () => {
    await render();
    const link = () => q('download-month')!.getAttribute('href');
    expect(link()).toBe('/print/month?month=2026-10');
    await pick('filter-month', '2026-09');
    expect(link()).toBe('/print/month?month=2026-09');
    await pick('filter-account', 'wd-qonto');
    expect(link()).toBe('/print/month?month=2026-09&account=wd-qonto');
    expect(q('download-month')!.classList).toContain('hidden');
    expect(q('download-month')!.classList).toContain('lg:inline-flex');
  });

  it('switching business resets filters that belong to the other business', async () => {
    await render();
    await pick('filter-account', 'wd-cash');
    demo.setBusiness('cafe-linde');
    await settle();
    expect(q('chip-account')).toBeNull();
    expect(qa('payment-row').length).toBeGreaterThan(0);
  });

  describe('opened payment', () => {
    it('highlights the selected row in list and table and hides the list below lg', async () => {
      await render('/payments/wd-t3');
      const selected = [...qa('payment-row'), ...qa('payment-table-row')].filter(
        (r) => r.getAttribute('aria-current') === 'true',
      );
      expect(selected).toHaveLength(2);
      for (const row of selected) expect(row.textContent).toContain('Deutsche Bahn');
      expect(q('payments-list')!.classList).toContain('hidden');
      expect(q('payments-list')!.classList).toContain('lg:flex');
    });

    it('keeps the list visible when no payment is open', async () => {
      await render();
      expect(
        [...qa('payment-row'), ...qa('payment-table-row')].some((r) =>
          r.hasAttribute('aria-current'),
        ),
      ).toBe(false);
      expect(q('payments-list')!.classList).not.toContain('hidden');
      expect(q('payments-detail')!.classList).toContain('hidden');
    });

    it('keeps the filters while a payment is open and after going back to the list', async () => {
      await render();
      await click('quick-needsYou');
      await type('bahn');
      expect(qa('payment-row')).toHaveLength(1);

      qa('payment-row')[0].click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/payments/wd-t3');
      expect(q('payment-detail')).not.toBeNull();
      expect(q('quick-needsYou')!.getAttribute('aria-pressed')).toBe('true');
      expect((q('payment-search') as HTMLInputElement).value).toBe('bahn');

      q('back-link')!.click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/payments');
      expect(q('payment-detail')).toBeNull();
      expect(q('quick-needsYou')!.getAttribute('aria-pressed')).toBe('true');
      expect((q('payment-search') as HTMLInputElement).value).toBe('bahn');
      expect(text(q('chip-search'))).toContain('bahn');
      expect(qa('payment-row')).toHaveLength(1);
    });

    it('keeps the detail panel in view on computers: sticky, and scrolling on its own when taller than the screen', async () => {
      await render('/payments/wd-t3');
      const panel = q('payments-detail')!.classList;
      for (const name of [
        'lg:sticky',
        'lg:top-6',
        'lg:max-h-[calc(100dvh-3rem)]',
        'lg:overflow-y-auto',
      ]) {
        expect(panel, name).toContain(name);
      }
    });

    it('moves the highlight when another payment opens', async () => {
      await render('/payments/wd-t3');
      await harness.navigateByUrl('/payments/wd-t4');
      await settle();
      const selected = qa('payment-row').filter((r) => r.getAttribute('aria-current') === 'true');
      expect(selected).toHaveLength(1);
      expect(selected[0].textContent).toContain('Amazon');
      expect(q('payments-detail')!.classList).not.toContain('hidden');
    });
  });

  describe('scrolling when a payment opens', () => {
    const root = () => document.documentElement;
    let originalMatchMedia: PropertyDescriptor | undefined;

    /** jsdom has no media queries; a computer is a screen where `(min-width: 64rem)` (Tailwind's lg) matches. */
    function screenIs(computer: boolean): void {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        writable: true,
        value: (query: string) => ({
          matches: computer && query === '(min-width: 64rem)',
          media: query,
        }),
      });
    }

    beforeEach(() => {
      originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
      root().scrollTop = 600;
    });

    afterEach(() => {
      root().scrollTop = 0;
      if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
      else delete (window as { matchMedia?: unknown }).matchMedia;
    });

    it('on a phone, a payment opens at the top of the page, not where the list was scrolled to', async () => {
      screenIs(false);
      await render('/payments/wd-t3');
      await settle();
      expect(root().scrollTop).toBe(0);
    });

    it('on a phone, tapping a row of the list opens the payment at the top', async () => {
      screenIs(false);
      await render();
      await settle();
      expect(root().scrollTop).toBe(600);
      qa('payment-row')
        .find((r) => r.textContent?.includes('Deutsche Bahn'))!
        .click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/payments/wd-t3');
      expect(root().scrollTop).toBe(0);
    });

    it('on a computer, the page stays where it is when a payment opens or another one opens', async () => {
      screenIs(true);
      await render('/payments/wd-t3');
      await settle();
      expect(root().scrollTop).toBe(600);
      await harness.navigateByUrl('/payments/wd-t4');
      await settle();
      expect(root().scrollTop).toBe(600);
    });

    it('does not scroll when the list opens without a payment', async () => {
      screenIs(false);
      await render();
      await settle();
      expect(root().scrollTop).toBe(600);
    });
  });
});
