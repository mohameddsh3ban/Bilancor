import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { formatMonth, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import { DemoStateService } from '../state/demo-state.service';
import { MonthPrintPage } from './month-print.page';

describe('MonthPrintPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;
  let print: MockInstance<() => void>;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'print/month', component: MonthPrintPage }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    print.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    // A test may open several pages; the harness can be created only once, so it navigates after that.
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness!.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="print-row"]'));
  const cell = (row: HTMLElement, testId: string) =>
    text(row.querySelector(`[data-testid="${testId}"]`));

  it('month print lists every payment of the month with totals', async () => {
    await render('/print/month?month=2026-10');
    expect(text(q('print-business'))).toBe('Weber Design');
    expect(text(q('print-month'))).toBe('October 2026');
    expect(q('print-account-filter')).toBeNull();

    expect(rows().map((row) => cell(row, 'print-counterparty'))).toEqual([
      'Müller GmbH',
      'Telekom',
      'Deutsche Bahn',
      'Amazon',
      'Rundfunk ARD, ZDF und Deutschlandradio Beitragsservice',
      'Adobe',
      'Atelier Sommer GmbH',
      'SCHREIBWAREN BOETTCHER',
      'Coworking Mitte',
      'Amazon',
    ]);
    expect(text(q('print-total-in'))).toBe(formatMoney(447500, 'en', { signed: true }));
    expect(text(q('print-total-out'))).toBe(formatMoney(-72822, 'en', { signed: true }));
    expect(q('print-total-in')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(q('print-total-out')!.closest('bdi[dir="ltr"]')).not.toBeNull();
  });

  it('shows date, account, booking, status and signed amount in each row', async () => {
    await render('/print/month?month=2026-10');
    const [first, , third, fourth] = rows();
    expect(cell(first, 'print-date')).toBe('20 Oct');
    expect(cell(first, 'print-account')).toBe('Qonto');
    expect(cell(first, 'print-booking')).toBe('Revenue (19% VAT) · 8400 Erlöse 19 % USt');
    expect(cell(first, 'tx-status')).toBe('Please confirm');
    expect(cell(first, 'print-amount')).toBe(formatMoney(150000, 'en', { signed: true }));
    expect(
      first.querySelector('[data-testid="print-amount"]')!.closest('bdi[dir="ltr"]'),
    ).not.toBeNull();
    expect(cell(third, 'tx-status')).toBe('Receipt missing');
    expect(cell(third, 'print-amount')).toBe(formatMoney(-12000, 'en', { signed: true }));
    expect(cell(fourth, 'print-booking')).toBe('—');
    expect(cell(fourth, 'tx-status')).toBe('Unclear');
    expect(first.querySelector('[data-testid="print-counterparty"]')!.getAttribute('dir')).toBe(
      'auto',
    );
  });

  it('names the account of a payment and of the account filter by its bank and product, in every language', async () => {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    demo.updateTransaction('wd-t1', (t) => ({ ...t, accountId: 'wd-savings' }));
    await render('/print/month?month=2026-10&account=wd-savings');
    expect(rows().map((row) => cell(row, 'print-account'))).toEqual(['Qonto · Savings']);
    expect(text(q('print-account-filter'))).toBe('Account: Qonto · Savings');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(rows().map((row) => cell(row, 'print-account'))).toEqual(['Qonto · Sparkonto']);
    expect(text(q('print-account-filter'))).toContain('Qonto · Sparkonto');
  });

  it('month print respects the account param', async () => {
    await render('/print/month?month=2026-08');
    expect(rows()).toHaveLength(4);
    expect(q('print-account-filter')).toBeNull();

    await render('/print/month?month=2026-08&account=wd-cash');
    expect(rows().map((row) => cell(row, 'print-counterparty'))).toEqual([
      'Edeka Markt Prenzlauer Berg',
    ]);
    expect(cell(rows()[0], 'print-account')).toBe('Cash box');
    expect(text(q('print-account-filter'))).toBe('Account: Cash box');
    expect(text(q('print-total-in'))).toBe(formatMoney(0, 'en', { signed: true }));
    expect(text(q('print-total-out'))).toBe(formatMoney(-6430, 'en', { signed: true }));

    await render('/print/month?month=2026-08&account=wd-qonto');
    expect(rows()).toHaveLength(3);
    expect(text(q('print-account-filter'))).toBe('Account: Qonto');
    expect(text(q('print-total-out'))).toBe(formatMoney(-(3995 + 35700), 'en', { signed: true }));
  });

  it('ignores the quick filter and the search, so it is always the whole month', async () => {
    await render('/print/month?month=2026-10&quick=needsYou&search=Telekom');
    expect(rows()).toHaveLength(10);
  });

  it('prints the edits made in the app, since the business is the one the demo state holds', async () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    await render('/print/month?month=2026-10');
    expect(cell(rows()[2], 'tx-status')).toBe('Booked');
  });

  it('prints the month of the business that is open', async () => {
    demo.setBusiness('sara-yoga');
    await render('/print/month?month=2026-09');
    expect(text(q('print-business'))).toBe('Sara Weber Yoga');
    expect(rows().length).toBeGreaterThan(0);
    expect(rows().map((row) => cell(row, 'print-counterparty'))).not.toContain('Müller GmbH');
  });

  it('follows the language and direction of the app', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await render('/print/month?month=2026-10');
    expect(text(q('print-month'))).toBe(formatMonth('2026-10', 'de'));
    expect(text(q('print-total-in'))).toBe(
      formatMoney(447500, 'de', { signed: true }).replace(/\s+/g, ' '),
    );
    expect(cell(rows()[0], 'tx-status')).toBe('Bitte bestätigen');
    expect(cell(rows()[0], 'print-booking')).toBe('8400 Erlöse 19 % USt');
    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    expect(document.documentElement.dir).toBe('rtl');
    expect(text(q('print-month'))).toBe(formatMonth('2026-10', 'ar'));
  });

  describe('back link', () => {
    it('returns to the payments list and is hidden when printing', async () => {
      await render('/print/month?month=2026-10');
      const back = q('print-back')!;
      expect(back.getAttribute('href')).toBe('/payments');
      expect(text(back)).toBe('Back');
      expect(back.classList).toContain('print:hidden');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
    });

    it('has nothing else that is interactive on the printed page', async () => {
      await render('/print/month?month=2026-10');
      const visible = Array.from(el.querySelectorAll('a, button, input, select')).filter(
        (node) => !node.classList.contains('print:hidden'),
      );
      expect(visible).toEqual([]);
    });
  });

  describe('when there is nothing to print', () => {
    const expectNothing = () => {
      expect(text(q('print-nothing'))).toBe('Nothing to print here.');
      expect(q('print-article')).toBeNull();
      expect(q('print-back')!.getAttribute('href')).toBe('/payments');
      expect(print).not.toHaveBeenCalled();
    };

    it('a month without payments', async () => {
      await render('/print/month?month=2026-07');
      expectNothing();
    });

    it('an account without payments in that month', async () => {
      await render('/print/month?month=2026-10&account=wd-cash');
      expectNothing();
    });

    it('an unknown account', async () => {
      await render('/print/month?month=2026-10&account=nope');
      expectNothing();
    });

    it('no month in the address', async () => {
      await render('/print/month');
      expectNothing();
    });

    it('a client who has not connected a bank yet', async () => {
      demo.setSetup('new');
      await render('/print/month?month=2026-10');
      expectNothing();
    });
  });

  it('print opens the dialog once', async () => {
    await render('/print/month?month=2026-10');
    expect(print).toHaveBeenCalledTimes(1);
    demo.updateTransaction('wd-t1', (tx) => ({ ...tx, confirmed: true }));
    await settle();
    await settle();
    expect(cell(rows()[0], 'tx-status')).toBe('Booked');
    expect(print).toHaveBeenCalledTimes(1);
  });
});
