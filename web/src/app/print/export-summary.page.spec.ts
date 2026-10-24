import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import { PERSON } from '../data/sample-person';
import { exportPeriods, exportRows, exportSummary } from '../domain/exports';
import { DemoStateService } from '../state/demo-state.service';
import { ExportSummaryPage } from './export-summary.page';

describe('ExportSummaryPage', () => {
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
        provideRouter([{ path: 'print/export/:period', component: ExportSummaryPage }]),
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
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
    el = harness!.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="export-row"]'));
  const cell = (row: HTMLElement, testId: string) =>
    text(row.querySelector(`[data-testid="${testId}"]`));
  const rowOf = (counterparty: string, date: string) =>
    rows().find(
      (row) => cell(row, 'row-counterparty') === counterparty && cell(row, 'row-date') === date,
    )!;

  it("the summary page lists October's bookings with open ones marked, and prints once", async () => {
    await render('/print/export/2026-10');
    expect(text(q('print-business'))).toBe('Weber Design');
    expect(text(q('export-title'))).toBe('Export for your tax advisor');
    expect(text(q('export-period'))).toBe('October 2026');
    expect(text(q('export-range'))).toBe('1 Oct 2026 – 22 Oct 2026');
    expect(q('export-range')!.matches('bdi[dir="ltr"]')).toBe(true);
    expect(text(q('export-summary'))).toBe(
      'October: 12 bookings, 8 receipts · Running · 7 payments still need you',
    );

    // One row per booking, oldest first, as the rules calculate them.
    const business = demo.business();
    const october = exportPeriods(business, 'month', DEMO_TODAY)[0];
    const expected = exportRows(business, october);
    expect(expected).toHaveLength(12);
    expect(rows().map((row) => cell(row, 'row-counterparty'))).toEqual(
      expected.map((row) => row.counterparty),
    );
    expect(rows().map((row) => cell(row, 'row-status'))).toEqual(
      expected.map((row) => (row.open ? 'Open' : 'Booked')),
    );
    expect(rows().filter((row) => cell(row, 'row-status') === 'Open')).toHaveLength(7);
    expect(exportSummary(business, october, DEMO_TODAY).needsYou).toBe(7);

    // Kern Studio: booked, but its receipt is missing, so it is open.
    const kern = rowOf('Kern Studio Berlin', '21 Oct');
    expect(cell(kern, 'row-amount')).toBe(formatMoney(238000, 'en', { signed: true }));
    expect(cell(kern, 'row-account')).toBe('8400 Erlöse 19 % USt');
    expect(cell(kern, 'row-vat')).toBe('19%');
    expect(cell(kern, 'row-receipt')).toBe('No');
    expect(cell(kern, 'row-status')).toBe('Open');

    // An Amazon order with no category yet has no account or rate, though its receipt is there.
    const unclear = rowOf('Amazon', '2 Oct');
    expect(cell(unclear, 'row-account')).toBe('—');
    expect(cell(unclear, 'row-vat')).toBe('—');
    expect(cell(unclear, 'row-receipt')).toBe('Yes');
    expect(cell(unclear, 'row-status')).toBe('Open');

    // A booked payment says Booked, with its receipt.
    const booked = rows().find((row) => cell(row, 'row-status') === 'Booked')!;
    expect(cell(booked, 'row-receipt')).toBe('Yes');
    expect(text(q('export-open-note'))).toContain('Open');

    // Amounts and the account stay left to right; the counterparty follows its own text.
    expect(
      kern.querySelector('[data-testid="row-amount"]')!.closest('bdi[dir="ltr"]'),
    ).not.toBeNull();
    expect(
      kern.querySelector('[data-testid="row-account"]')!.closest('bdi[dir="ltr"]'),
    ).not.toBeNull();
    expect(kern.querySelector('[data-testid="row-counterparty"]')!.getAttribute('dir')).toBe(
      'auto',
    );

    // The print dialog opens once, and a later change to the payments does not open it again.
    expect(print).toHaveBeenCalledTimes(1);
    demo.updateTransaction('wd-t1', (tx) => ({ ...tx, confirmed: true }));
    await settle();
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('shows what the app shows now: a payment fixed after the export was asked for is booked', async () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    await render('/print/export/2026-10');
    expect(text(q('export-summary'))).toContain('6 payments still need you');
  });

  it('says Yes, No or Not needed for the receipt, so a payment that needs none is not a missing one', async () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' })); // Deutsche Bahn
    await render('/print/export/2026-10');
    expect(cell(rowOf('Deutsche Bahn', '17 Oct'), 'row-receipt')).toBe('Not needed');
    expect(cell(rowOf('Kern Studio Berlin', '21 Oct'), 'row-receipt')).toBe('No'); // missing
    expect(cell(rowOf('Amazon', '2 Oct'), 'row-receipt')).toBe('Yes'); // attached
    // The phone's line under the name says the same.
    const bahn = rowOf('Deutsche Bahn', '17 Oct');
    expect(text(bahn.querySelector('td:nth-child(2) span.block'))).toContain('Receipt: Not needed');
    // Not needed is not open: only the payments that need the person are.
    expect(cell(bahn, 'row-status')).toBe('Booked');
    // The summary line still counts attached receipts only.
    expect(text(q('export-summary'))).toBe(
      'October: 12 bookings, 8 receipts · Running · 6 payments still need you',
    );
  });

  it('says it in German too', async () => {
    TestBed.inject(LanguageService).setLang('de');
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    await render('/print/export/2026-10');
    expect(cell(rowOf('Deutsche Bahn', '17. Okt.'), 'row-receipt')).toBe('Nicht nötig');
  });

  it('a period without anything open has no note about open payments', async () => {
    await render('/print/export/2026-09');
    expect(text(q('export-summary'))).toBe('September: 4 bookings, 4 receipts · Closed');
    expect(q('export-open-note')).toBeNull();
    expect(rows().map((row) => cell(row, 'row-status'))).toEqual([
      'Booked',
      'Booked',
      'Booked',
      'Booked',
    ]);
    expect(text(q('export-range'))).toBe('1 Sept 2026 – 30 Sept 2026');
  });

  it('a quarter and the year are listed the same way, by their key', async () => {
    await render('/print/export/2026-Q3');
    expect(text(q('export-period'))).toBe('Q3 2026');
    expect(rows()).toHaveLength(7); // August and September at Weber Design: 3 + 4 payments
    await render('/print/export/2026');
    expect(text(q('export-period'))).toBe('2026');
    expect(rows().length).toBe(demo.business().transactions.filter((tx) => !tx.isPrivate).length);
  });

  it('a small business shows no VAT rate, whatever the category usually has', async () => {
    demo.setBusiness('sara-yoga');
    await render('/print/export/2026-09');
    expect(text(q('print-business'))).toBe('Sara Weber Yoga');
    const withBooking = rows().filter((row) => cell(row, 'row-account') !== '—');
    expect(withBooking.length).toBeGreaterThan(0);
    for (const row of withBooking) expect(cell(row, 'row-vat')).toBe('No VAT');
  });

  it('prints the business that is open', async () => {
    demo.setBusiness('cafe-linde');
    await render('/print/export/2026-Q3');
    expect(text(q('print-business'))).toBe('Café Linde GbR');
    expect(text(q('export-summary'))).toBe('Q3 2026: 12 bookings, 12 receipts · Not closed');
    expect(rows()).toHaveLength(12);
  });

  it('follows the language and direction of the app', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await render('/print/export/2026-10');
    expect(text(q('export-title'))).toBe('Export für deine Steuerberater:in');
    expect(text(q('export-period'))).toBe('Oktober 2026');
    expect(cell(rowOf('Kern Studio Berlin', '21. Okt.'), 'row-receipt')).toBe('Nein');
    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    expect(document.documentElement.dir).toBe('rtl');
    expect(q('export-summary')!.querySelector('bdi')).not.toBeNull();
  });

  describe('back link', () => {
    it('returns to Reports and is hidden when printing', async () => {
      await render('/print/export/2026-10');
      const back = q('print-back')!;
      expect(back.getAttribute('href')).toBe('/reports');
      expect(text(back)).toBe('Back');
      expect(back.classList).toContain('print:hidden');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
    });

    it('has nothing else that is interactive on the printed page', async () => {
      await render('/print/export/2026-10');
      const visible = Array.from(el.querySelectorAll('a, button, input, select')).filter(
        (node) => !node.classList.contains('print:hidden'),
      );
      expect(visible).toEqual([]);
    });
  });

  describe('when there is nothing to print', () => {
    it('an unknown period on the summary page says so and does not print', async () => {
      for (const url of [
        '/print/export/2026-05', // a month with no payments, so not one of the periods to export
        '/print/export/2025-10',
        '/print/export/nope',
        '/print/export/2026-Q2',
      ]) {
        await render(url);
        expect(text(q('export-unknown')), url).toBe(
          "This isn't a period you can export, so there is nothing to print.",
        );
        expect(q('export-article'), url).toBeNull();
        expect(q('print-back')!.getAttribute('href'), url).toBe('/reports');
      }
      expect(print).not.toHaveBeenCalled();
    });

    it('a period with no payments says there is nothing to export, and does not print', async () => {
      const id = demo.createBusiness(
        { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email },
        { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' },
      );
      demo.setBusiness(id);
      await render('/print/export/2026-10');
      expect(text(q('print-business'))).toBe('Atelier Neu');
      expect(text(q('export-nothing'))).toBe('Nothing to export yet');
      expect(q('export-table')).toBeNull();
      expect(print).not.toHaveBeenCalled();
    });
  });
});
