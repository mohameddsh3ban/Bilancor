import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import { groupByMonth } from '../domain/payment-filters';
import { DemoStateService } from '../state/demo-state.service';
import { ReceiptService } from '../state/receipt.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

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

  it('quick filter Needs you shows 7 for weber-design', async () => {
    await render();
    expect(text(q('quick-needsYou'))).toContain('7');
    expect(q('quick-all')!.getAttribute('aria-pressed')).toBe('true');
    await click('quick-needsYou');
    expect(q('quick-needsYou')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('quick-all')!.getAttribute('aria-pressed')).toBe('false');
    expect(qa('payment-row')).toHaveLength(7);
    expect(qa('payment-table-row')).toHaveLength(7);
    expect(
      qa('payment-row').map((r) => text(r.querySelector('[data-testid="tx-status"]'))),
    ).toEqual(['Receipt missing', 'Please confirm', 'Receipt missing', 'Receipt missing', 'Unclear', 'Receipt missing', 'Unclear']);
  });

  it('"Review them" next to the Needs you quick filter opens the review inbox', async () => {
    await render();
    const start = q('needs-you-start')!;
    // Named on its own, so it never reads as a bare "Start" on a line by itself on a phone.
    expect(text(start)).toBe('Review them');
    expect(start.tagName).toBe('A');
    expect(start.getAttribute('href')).toBe('/review');
    // Right after the quick filters, not inside one of their buttons.
    expect(start.closest('button')).toBeNull();
    expect(start.previousElementSibling).toBe(q('quick-needsYou')!.closest('[role="group"]'));
  });

  it('names the review link in German and in Arabic', async () => {
    await render();
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(text(q('needs-you-start'))).toBe('Jetzt durchgehen');

    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    expect(text(q('needs-you-start'))).toBe('راجعها الآن');
  });

  it('has no review link when nothing needs you', async () => {
    demo.setBusiness('cafe-linde');
    await render();
    expect(text(q('quick-needsYou'))).toContain('0');
    expect(q('needs-you-start')).toBeNull();
  });

  it('has no review link before a bank is connected', async () => {
    demo.setSetup('new');
    await render();
    expect(q('needs-you-start')).toBeNull();
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

  it('names a connected savings account by the bank and the product, in the filter and in its chip', async () => {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    await render();
    const labels = () =>
      Array.from((q('filter-account') as HTMLSelectElement).options).map((o) => o.textContent?.trim());
    expect(labels()).toEqual(['All accounts', 'Qonto', 'Qonto · Savings', 'Qonto · Credit card', 'Cash box']);
    await pick('filter-account', 'wd-savings');
    expect(text(q('chip-account'))).toContain('Qonto · Savings');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(labels()).toEqual(['Alle Konten', 'Qonto', 'Qonto · Sparkonto', 'Qonto · Kreditkarte', 'Kasse']);
    expect(text(q('chip-account'))).toContain('Qonto · Sparkonto');
  });

  it('payments filter lists Own money, and filtering by it shows the payment paid with own money, named by the account in every language', async () => {
    TestBed.inject(ReceiptService).markPaid('wd-d7', 'own', '2026-10-19');
    await render();
    const labels = () =>
      Array.from((q('filter-account') as HTMLSelectElement).options).map((o) => o.textContent?.trim());
    expect(labels()).toEqual(['All accounts', 'Qonto', 'Own money', 'Cash box']);

    await pick('filter-account', 'weber-design-own');
    expect(qa('payment-row')).toHaveLength(1);
    expect(text(q('chip-account'))).toContain('Own money');
    expect(text(qa('payment-table-row')[0])).toContain('Copyshop Kreuzberg');
    expect(text(qa('payment-table-row')[0])).toContain('Own money');

    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(labels()).toEqual(['Alle Konten', 'Qonto', 'Eigenes Geld', 'Kasse']);
    expect(text(q('chip-account'))).toContain('Eigenes Geld');
    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    expect(labels()).toContain(ar.settings.bank.product.own);
  });

  it('names the account of a payment in the table by its bank and product, like the filter does', async () => {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    demo.updateTransaction('wd-t1', (t) => ({ ...t, accountId: 'wd-savings' }));
    await render();
    const accountCell = (name: string) =>
      text(
        qa('payment-table-row')
          .find((row) => row.textContent?.includes(name))!
          .querySelectorAll('td')[2],
      );
    expect(accountCell('Müller GmbH')).toBe('Qonto · Savings');
    expect(accountCell('Telekom')).toBe('Qonto');
    expect(accountCell('Edeka')).toBe('Cash box');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(accountCell('Müller GmbH')).toBe('Qonto · Sparkonto');
    expect(accountCell('Edeka')).toBe('Kasse');
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
    expect(q('empty-new-action')!.getAttribute('href')).toBe('/settings/bank/connect?from=payments');
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

  describe('a closed month', () => {
    /** The month headings of the phone list, with the word Closed where there is one. */
    const listHeadings = () =>
      qa('month-group').map((g) => [
        text(g.querySelector('[data-testid="month-title"]')),
        text(g.querySelector('[data-testid="month-closed"]')),
      ]);
    const tableHeadings = () =>
      qa('table-month-group').map((g) => [
        text(g.querySelector('[data-testid="table-month-title"]')),
        text(g.querySelector('[data-testid="table-month-closed"]')),
      ]);

    it('the August and September headings say Closed', async () => {
      await render();
      const expected = [
        ['October 2026', ''],
        ['September 2026', 'Closed'],
        ['August 2026', 'Closed'],
      ];
      expect(listHeadings()).toEqual(expected);
      expect(tableHeadings()).toEqual(expected);
    });

    it('closing September at Sara Weber Yoga adds Closed to its heading', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(listHeadings().map(([title, closed]) => `${title}: ${closed}`)).toEqual([
        'October 2026: ',
        'September 2026: ',
        'August 2026: Closed',
      ]);
      expect(demo.closeMonth('2026-09')).toBe(true);
      await settle();
      expect(listHeadings()[1]).toEqual(['September 2026', 'Closed']);
      expect(tableHeadings()[1]).toEqual(['September 2026', 'Closed']);
      expect(listHeadings()[0]).toEqual(['October 2026', '']);
    });

    it('a month inside the earlier months says Closed when a payment is dated there', async () => {
      demo.updateTransaction('wd-t14', (tx) => ({ ...tx, date: '2026-07-10' }));
      await render();
      expect(listHeadings().map(([title]) => title)).toEqual([
        'October 2026',
        'September 2026',
        'August 2026',
        'July 2026',
      ]);
      expect(listHeadings()[3]).toEqual(['July 2026', 'Closed']);
      expect(tableHeadings()[3]).toEqual(['July 2026', 'Closed']);
    });

    it('says Closed in a word in every language, and shows nothing extra on a row', async () => {
      await render();
      const lang = TestBed.inject(LanguageService);
      lang.setLang('de');
      await settle();
      expect(listHeadings()[1][1]).toBe(de.payments.closed);
      lang.setLang('ar');
      await settle();
      expect(listHeadings()[1][1]).toBe(ar.payments.closed);
      lang.setLang('en');
      await settle();
      const septemberRows = qa('month-group')[1].querySelectorAll('[data-testid="payment-row"]');
      const octoberRows = qa('month-group')[0].querySelectorAll('[data-testid="payment-row"]');
      expect(septemberRows.length).toBeGreaterThan(0);
      // A row of a closed month has the same parts as a row of an open one.
      expect(septemberRows[0].children.length).toBe(octoberRows[0].children.length);
      expect(septemberRows[0].textContent).not.toContain('Closed');
    });
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

  describe('the month in the address', () => {
    it('?month= starts the list on that month, with its chip, and leaves it out of the address', async () => {
      await render('/payments?month=2026-09');
      await settle();
      expect((q('filter-month') as HTMLSelectElement).value).toBe('2026-09');
      expect(text(q('chip-month'))).toContain('September 2026');
      const groups = qa('month-group');
      expect(groups.map((g) => text(g.querySelector('[data-testid="month-title"]')))).toEqual(['September 2026']);
      expect(qa('payment-row')).toHaveLength(4);
      expect(TestBed.inject(Router).url).toBe('/payments');
    });

    it('keeps the other filters as they are and lets the month go again', async () => {
      await render('/payments?month=2026-10');
      await settle();
      await click('chip-month-remove');
      expect(q('chip-month')).toBeNull();
      expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
    });

    it('ignores a month that is not a month', async () => {
      await render('/payments?month=soon');
      await settle();
      expect((q('filter-month') as HTMLSelectElement).value).toBe('');
      expect(q('chip-month')).toBeNull();
      expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
      expect(TestBed.inject(Router).url).toBe('/payments');
    });

    it('starts over when another business opens', async () => {
      await render('/payments?month=2026-10');
      await settle();
      demo.setBusiness('cafe-linde');
      await settle();
      expect(q('chip-month')).toBeNull();
    });
  });

  describe('the account in the address', () => {
    it('?account= starts the list on that account, with its chip, and leaves it out of the address', async () => {
      await render('/payments?account=wd-cash');
      await settle();
      expect((q('filter-account') as HTMLSelectElement).value).toBe('wd-cash');
      expect(text(q('chip-account'))).toContain('Cash box');
      const rows = qa('payment-row');
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBe(demo.business().transactions.filter((t) => t.accountId === 'wd-cash').length);
      expect(TestBed.inject(Router).url).toBe('/payments');
    });

    it('keeps the other filters as they are and lets the account go again', async () => {
      await render('/payments?account=wd-qonto');
      await settle();
      await click('chip-account-remove');
      expect(q('chip-account')).toBeNull();
      expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
    });

    it('ignores an account the business does not have', async () => {
      await render('/payments?account=cl-sparkasse');
      await settle();
      expect((q('filter-account') as HTMLSelectElement).value).toBe('');
      expect(q('chip-account')).toBeNull();
      expect(qa('payment-row')).toHaveLength(demo.business().transactions.length);
      expect(TestBed.inject(Router).url).toBe('/payments');
    });
  });

  describe('importing a statement', () => {
    it('payments offers Import statement', async () => {
      await render();
      // A computer has the button in the toolbar, next to Download month.
      const link = q('import-statement')!;
      expect(text(link)).toBe('Import statement');
      expect(link.getAttribute('href')).toBe('/payments/import?from=payments');
      expect(link.classList).toContain('hidden');
      expect(link.classList).toContain('lg:inline-flex');

      // A phone has it in a ⋯ menu.
      const more = q('more-actions')!;
      expect(more.getAttribute('aria-label')).toBe('More actions');
      expect(more.classList).toContain('lg:hidden');
      more.click();
      await settle();
      const item = document.body.querySelector<HTMLElement>('[data-testid="menu-import-statement"]')!;
      expect(text(item)).toBe('Import statement');
      expect(item.getAttribute('href')).toBe('/payments/import?from=payments');
    });

    it('is offered before the bank is connected too: a statement is a way to get payments in', async () => {
      demo.setSetup('new');
      await render();
      expect(q('import-statement')).not.toBeNull();
      expect(q('more-actions')).not.toBeNull();
    });

    it('says Import statement in German and Arabic', async () => {
      await render();
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(q('import-statement'))).toBe(de.payments.import);
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(q('import-statement'))).toBe(ar.payments.import);
      expect(q('more-actions')!.getAttribute('aria-label')).toBe(ar.payments.more);
    });
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
