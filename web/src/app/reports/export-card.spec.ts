import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DEMO_TODAY } from '../data/demo-date';
import type { Transaction } from '../data/models';
import { PERSON } from '../data/sample-person';
import { exportPeriods, exportSummary } from '../domain/exports';
import { paymentStatus } from '../domain/payment-status';
import { signInAsSara } from '../state/account.testing';
import { DemoStateService } from '../state/demo-state.service';
import { ExportCard } from './export-card';

/** Stands in for the pages the card links to. */
@Component({ template: '' })
class Elsewhere {}

describe('ExportCard', () => {
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
          { path: 'export', component: ExportCard },
          { path: 'review', component: Elsewhere },
          { path: 'settings', component: Elsewhere },
          { path: 'print/export/:period', component: Elsewhere },
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

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const router = () => TestBed.inject(Router);

  /** Lets the card and any navigation finish; `el` is the page that is showing then. */
  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
    el = harness!.routeNativeElement as HTMLElement;
  }

  /** Opens the card as a business (the first call of a test creates the harness; later calls navigate it). */
  async function render(businessId: string): Promise<void> {
    demo.setBusiness(businessId);
    if (harness) await harness.navigateByUrl('/export');
    else harness = await RouterTestingHarness.create('/export');
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  /** Chooses one of the two choices: the radio inside its card. */
  async function choose(testId: string): Promise<void> {
    q(testId)!.querySelector<HTMLInputElement>('input')!.click();
    await settle();
  }

  async function pick(key: string): Promise<void> {
    const select = q('export-period') as HTMLSelectElement;
    select.value = key;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  const options = () =>
    Array.from(el.querySelectorAll<HTMLOptionElement>('[data-testid="export-period"] option')).map(
      (option) => text(option),
    );
  const isChecked = (testId: string) =>
    q(testId)!.querySelector<HTMLInputElement>('input')!.checked;
  const disabled = (testId: string) => (q(testId) as HTMLButtonElement).disabled;

  /** The open business's payments of a month that still need the person. */
  const openIn = (month: string) =>
    demo
      .business()
      .transactions.filter((tx) => tx.date.startsWith(month) && paymentStatus(tx) !== 'booked');

  /** Settles payments the way the review inbox does: a booking (the first one the business has), confirmed, with no receipt needed. */
  function fix(payments: readonly Transaction[]): void {
    const booking = demo.business().transactions.find((tx) => tx.booking)!.booking!;
    for (const tx of payments) {
      demo.updateTransaction(tx.id, (t) => ({
        ...t,
        booking: t.booking ?? booking,
        confirmed: true,
        receipt: t.receipt === 'missing' ? 'notNeeded' : t.receipt,
      }));
    }
  }

  it("Weber Design's October export shows its summary and the two choices", async () => {
    await render('weber-design');
    expect(text(q('export-title'))).toBe('Export for your tax advisor');
    expect(text(q('export-body'))).toBe(
      'Your bookings and receipts in the format tax advisors read (DATEV), or as a spreadsheet.',
    );

    // Month is chosen, and the select lists the months with payments, newest first.
    expect(q('export-kind-month')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('export-kind-quarter')!.getAttribute('aria-pressed')).toBe('false');
    expect(q('export-kind-year')!.getAttribute('aria-pressed')).toBe('false');
    expect((q('export-period') as HTMLSelectElement).value).toBe('2026-10');
    expect(options()).toEqual(['October 2026', 'September 2026', 'August 2026']);

    // The summary is the one the rules calculate: 11 bookings, 8 receipts, running, 6 payments need Sara.
    const october = exportPeriods(demo.business(), 'month', DEMO_TODAY)[0];
    expect(exportSummary(demo.business(), october, DEMO_TODAY)).toMatchObject({
      bookings: 11,
      receipts: 8,
      needsYou: 6,
    });
    expect(text(q('export-summary'))).toBe(
      'October: 11 bookings, 8 receipts · Running · 6 payments still need you',
    );
    expect(text(q('export-state'))).toBe('Running');

    // Two choices, the first one chosen, and Start for fixing them.
    expect(text(q('export-choices'))).toContain('Export with them marked as open');
    expect(text(q('export-choice-open'))).toBe('Export with them marked as open');
    expect(text(q('export-choice-fix'))).toBe('Fix them first');
    expect(isChecked('export-choice-open')).toBe(true);
    expect(isChecked('export-choice-fix')).toBe(false);
    expect(q('export-choices')!.getAttribute('role')).toBe('radiogroup');
    expect(q('export-choices')!.getAttribute('aria-labelledby')).toBe('export-needs');
    expect(q('export-start')!.getAttribute('href')).toBe('/review');

    // Both downloads are on, and nothing is shown until one is asked for.
    expect(text(q('export-download-datev'))).toBe('Download DATEV (ZIP)');
    expect(text(q('export-download-csv'))).toBe('Spreadsheet (CSV)');
    expect(disabled('export-download-datev')).toBe(false);
    expect(disabled('export-download-csv')).toBe(false);
    expect(q('export-demo')).toBeNull();
    expect(q('export-fix-off')).toBeNull();
  });

  it('a payment that needs no receipt is a booking and not a receipt in the summary, and it no longer needs the person', async () => {
    await render('weber-design');
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' })); // Deutsche Bahn
    await settle();
    expect(text(q('export-summary'))).toBe(
      'October: 11 bookings, 8 receipts · Running · 5 payments still need you',
    );
  });

  it('a period with nothing that needs the person has no choices', async () => {
    await render('weber-design');
    await pick('2026-09');
    expect(text(q('export-summary'))).toBe('September: 4 bookings, 4 receipts · Closed');
    expect(text(q('export-state'))).toBe('Closed');
    expect(q('export-needs')).toBeNull();
    expect(q('export-choices')).toBeNull();
    expect(q('export-start')).toBeNull();
    expect(disabled('export-download-datev')).toBe(false);
    expect(disabled('export-download-csv')).toBe(false);
  });

  it('one payment that needs the person reads in the singular', async () => {
    await render('weber-design');
    fix(openIn('2026-10').slice(1));
    await settle();
    expect(text(q('export-needs'))).toBe('1 payment still needs you');
    expect(q('export-choices')).not.toBeNull();
  });

  it('Fix them first turns the downloads off and Start opens the review inbox', async () => {
    await render('weber-design');
    await click('export-download-datev');
    expect(q('export-demo')).not.toBeNull();

    await choose('export-choice-fix');
    expect(isChecked('export-choice-fix')).toBe(true);
    expect(isChecked('export-choice-open')).toBe(false);
    expect(disabled('export-download-datev')).toBe(true);
    expect(disabled('export-download-csv')).toBe(true);
    expect(text(q('export-fix-off'))).toBe('Downloads are off while you fix them first.');
    expect(q('export-download-datev')!.getAttribute('aria-describedby')).toBe('export-fix-off');
    // What was shown for the first choice goes with it.
    expect(q('export-demo')).toBeNull();

    // Back to the first choice: the downloads are on again.
    await choose('export-choice-open');
    expect(disabled('export-download-datev')).toBe(false);
    expect(disabled('export-download-csv')).toBe(false);
    expect(q('export-fix-off')).toBeNull();

    await choose('export-choice-fix');
    await click('export-start');
    await vi.waitFor(() => expect(router().url).toBe('/review'));
  });

  it('choosing Fix them first does not trap the downloads off once nothing needs the person any more', async () => {
    await render('sara-yoga');
    await choose('export-choice-fix');
    expect(disabled('export-download-datev')).toBe(true);
    fix(openIn('2026-10'));
    await settle();
    expect(q('export-choices')).toBeNull();
    expect(q('export-needs')).toBeNull();
    expect(disabled('export-download-datev')).toBe(false);
    expect(disabled('export-download-csv')).toBe(false);
  });

  it('the choice and the file start over with another period', async () => {
    await render('weber-design');
    await choose('export-choice-fix');
    await pick('2026-09');
    await pick('2026-10');
    expect(isChecked('export-choice-open')).toBe(true);
    expect(disabled('export-download-datev')).toBe(false);

    await click('export-download-csv');
    expect(q('export-demo')).not.toBeNull();
    await pick('2026-09');
    expect(q('export-demo')).toBeNull();
  });

  it('Download DATEV shows weber-design_DATEV_2026-10.zip and Print summary', async () => {
    await render('weber-design');
    await click('export-download-datev');

    const box = q('export-demo')!;
    expect(box.className).toContain('border-dashed');
    expect(box.className).toContain('border-warning');
    expect(box.getAttribute('role')).toBe('group');
    expect(text(box)).toContain('Demo');
    expect(text(box)).toContain('No file is made in the demo. Its name would be');
    expect(text(q('export-file'))).toBe('weber-design_DATEV_2026-10.zip');
    expect(q('export-file')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(text(q('export-print'))).toBe('Print summary');
    expect(q('export-print')!.getAttribute('href')).toBe('/print/export/2026-10');

    // The spreadsheet has the same name with .csv, in the same box.
    await click('export-download-csv');
    expect(text(q('export-file'))).toBe('weber-design_DATEV_2026-10.csv');
    expect(el.querySelectorAll('[data-testid="export-demo"]')).toHaveLength(1);

    await click('export-print');
    await vi.waitFor(() => expect(router().url).toBe('/print/export/2026-10'));
  });

  it('the file box goes when another business opens', async () => {
    await render('weber-design');
    await click('export-download-datev');
    expect(q('export-demo')).not.toBeNull();
    demo.setBusiness('sara-yoga');
    await settle();
    expect(q('export-demo')).toBeNull();
  });

  it('Quarter lists Q4 and Q3 2026; Q3 at Café Linde is not closed', async () => {
    await render('cafe-linde');
    await click('export-kind-quarter');
    expect(q('export-kind-quarter')!.getAttribute('aria-pressed')).toBe('true');
    expect(q('export-kind-month')!.getAttribute('aria-pressed')).toBe('false');
    expect(options()).toEqual(['Q4 2026', 'Q3 2026']);
    expect(q('export-period')!.getAttribute('aria-label')).toBe('Choose a quarter');
    expect(text(q('export-summary'))).toContain('Q4 2026:');
    expect(text(q('export-state'))).toBe('Running');

    await pick('2026-Q3');
    expect(text(q('export-summary'))).toBe('Q3 2026: 12 bookings, 12 receipts · Not closed');
    expect(text(q('export-state'))).toBe('Not closed');
    await click('export-download-datev');
    expect(text(q('export-file'))).toBe('cafe-linde_DATEV_2026-Q3.zip');
    expect(q('export-print')!.getAttribute('href')).toBe('/print/export/2026-Q3');
  });

  it('a quarter with closed and open months is partly closed', async () => {
    await render('sara-yoga');
    await click('export-kind-quarter');
    await pick('2026-Q3');
    expect(text(q('export-state'))).toBe('Partly closed');
    expect(text(q('export-summary'))).toContain('Q3 2026:');
  });

  it('Year is the year of today, as one period', async () => {
    await render('weber-design');
    await click('export-kind-year');
    expect(options()).toEqual(['2026']);
    expect(q('export-period')!.getAttribute('aria-label')).toBe('Choose a year');
    const year = exportPeriods(demo.business(), 'year', DEMO_TODAY)[0];
    const summary = exportSummary(demo.business(), year, DEMO_TODAY);
    expect(text(q('export-summary'))).toContain(
      `2026: ${summary.bookings} bookings, ${summary.receipts} receipts`,
    );
    await click('export-download-csv');
    expect(text(q('export-file'))).toBe('weber-design_DATEV_2026.csv');
    expect(q('export-print')!.getAttribute('href')).toBe('/print/export/2026');

    // Back to Month: the newest month is shown again.
    await click('export-kind-month');
    expect((q('export-period') as HTMLSelectElement).value).toBe('2026-10');
  });

  it('a period with no payments says there is nothing to export, with no downloads', async () => {
    const id = demo.createBusiness(
      { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email },
      { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' },
    );
    await render(id);
    expect(options()).toEqual(['October 2026']);
    expect(text(q('export-nothing'))).toBe('Nothing to export yet');
    expect(q('export-summary')).toBeNull();
    expect(q('export-choices')).toBeNull();
    expect(q('export-download-datev')).toBeNull();
    expect(q('export-download-csv')).toBeNull();
    expect(q('export-demo')).toBeNull();
    // The advisor line stays: it does not depend on the period.
    expect(q('export-invite')).not.toBeNull();
  });

  describe('the tax advisor', () => {
    it('names Jana Hoffmann at Weber Design and points to People with access at Sara Weber Yoga', async () => {
      await render('weber-design');
      expect(el.querySelectorAll('[data-testid="export-advisor"]')).toHaveLength(1);
      expect(text(q('export-advisor'))).toBe(
        'Your tax advisor Jana Hoffmann can download it too, with their own login.',
      );
      expect(q('export-advisor')!.querySelector('bdi')!.textContent).toBe('Jana Hoffmann');
      expect(q('export-invite')).toBeNull();

      demo.setBusiness('sara-yoga');
      await settle();
      expect(q('export-advisor')).toBeNull();
      expect(text(q('export-invite'))).toBe(
        'Invite your tax advisor in Settings › People with access',
      );
      expect(text(q('export-invite-link'))).toBe('Settings › People with access');
      expect(q('export-invite-link')!.getAttribute('href')).toBe('/settings#people');
    });

    it('a tax advisor who has only been invited does not count', async () => {
      signInAsSara();
      await render('sara-yoga');
      demo.invite('mia@kanzlei.example', 'advisor');
      await settle();
      expect(q('export-advisor')).toBeNull();
      expect(q('export-invite')).not.toBeNull();
    });
  });

  describe('languages', () => {
    it('reads in German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('weber-design');
      expect(text(q('export-title'))).toBe('Export für deine Steuerberater:in');
      expect(text(q('export-summary'))).toBe(
        'Oktober: 11 Buchungen, 8 Belege · Läuft · 6 Zahlungen brauchen dich noch',
      );
      expect(text(q('export-kind-quarter'))).toBe('Quartal');
      expect(options()[0]).toBe('Oktober 2026');
      expect(text(q('export-advisor'))).toContain('Jana Hoffmann');
    });

    it('reads in Arabic, with the period, the file name and the advisor in their own direction', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('weber-design');
      expect(document.documentElement.dir).toBe('rtl');
      expect(q('export-summary')!.querySelector('bdi')).not.toBeNull();
      expect(text(q('export-state'))).toBe('جارٍ');
      await click('export-download-datev');
      expect(q('export-file')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(text(q('export-file'))).toBe('weber-design_DATEV_2026-10.zip');
      expect(q('export-advisor')!.querySelector('bdi')!.textContent).toBe('Jana Hoffmann');
    });

    it('names the invitation link by the menu and the card of the same words in every language', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('sara-yoga');
      expect(text(q('export-invite-link'))).toBe('Einstellungen › Personen mit Zugriff');
    });
  });
});
