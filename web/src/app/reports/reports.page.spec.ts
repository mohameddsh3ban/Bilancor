import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { SUPPLIES } from '../data/categories';
import { DEMO_TODAY } from '../data/demo-date';
import type { SentVatReturn, Transaction } from '../data/models';
import { PERSON } from '../data/sample-person';
import { monthRows, yearTotals } from '../domain/months';
import { needsYouCount } from '../domain/payment-status';
import { yearSummary } from '../domain/tax-year';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { DemoStateService } from '../state/demo-state.service';
import { withRole } from '../state/demo-state.testing';
import { ReportsPage } from './reports.page';

/** Stands in for the pages the Reports page links to. */
@Component({ template: '' })
class Elsewhere {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
/** A sentence as it reads: the term button inside it ends with a space that a browser drops at the end of its line. */
const sentence = (node: Element | null | undefined) => text(node).replace(/\s+([,.])/g, '$1');
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = (testId: string) =>
  dialog()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;

describe('ReportsPage', () => {
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
          { path: 'reports', component: ReportsPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
          { path: 'review', component: Elsewhere },
          { path: 'documents', component: Elsewhere },
          { path: 'settings/tax', component: Elsewhere },
          { path: 'settings/bank/connect', component: Elsewhere },
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
  async function render(businessId: string, url = '/reports'): Promise<void> {
    demo.setBusiness(businessId);
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const router = () => TestBed.inject(Router);
  const money = (cents: number, lang: 'en' | 'ar' = 'en') => formatMoney(cents, lang);

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  /** Waits until the pop-up has opened (or, with `false`, is gone). */
  async function dialogIs(open: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog() === null).toBe(!open);
    });
  }

  /** Replaces one payment of the open business, as the screens that edit one do. */
  const edit = (id: string, change: (tx: Transaction) => Transaction) =>
    demo.updateTransaction(id, change);

  it('has a title, and shows the month table, the export and the audit card once the tax details and the bank are done', async () => {
    await render('weber-design');
    expect(text(el.querySelector('h1'))).toBe('Reports');
    expect(q('month-table')).not.toBeNull();
    expect(q('export-card')).not.toBeNull();
    expect(q('audit-card')).not.toBeNull();
    expect(q('reports-missing')).toBeNull();
    expect(q('reports-connect')).toBeNull();
  });

  it('before the tax step Reports shows the Taxes pointer; before the bank step it asks to connect the bank', async () => {
    demo.setBusiness('weber-design');
    demo.setSetup('new');
    await render('weber-design');
    expect(text(q('reports-missing'))).toBe(
      'Add your tax details to see your taxes Add your tax details',
    );
    expect(q('reports-missing-link')!.getAttribute('href')).toBe('/settings/tax');
    expect(q('month-table')).toBeNull();
    expect(q('export-card')).toBeNull();
    expect(q('audit-card')).toBeNull();
    expect(q('reports-needs')).toBeNull();
    expect(q('reports-connect')).toBeNull();

    // The bank is connected but the tax details are not: the tax pointer comes first.
    demo.setSetup('halfway');
    await settle();
    expect(q('reports-missing')).not.toBeNull();
    expect(q('reports-connect')).toBeNull();

    // The tax details are done but the bank is not.
    demo.setSetup('new');
    demo.completeStep('tax');
    await settle();
    expect(q('reports-missing')).toBeNull();
    expect(text(q('reports-connect'))).toContain('Connect your bank to see your months');
    expect(text(q('reports-connect'))).toContain(
      'Your months show up here as soon as your bank is connected.',
    );
    expect(q('reports-connect-link')!.getAttribute('href')).toBe('/settings/bank/connect');
    expect(text(q('reports-connect-link'))).toBe('Connect your bank');
    expect(q('month-table')).toBeNull();
    expect(q('export-card')).toBeNull();
    expect(q('audit-card')).toBeNull();

    demo.completeStep('bank');
    await settle();
    expect(q('reports-connect')).toBeNull();
    expect(q('month-table')).not.toBeNull();
  });

  it('a business made during the visit shows only its running October, once both steps are done', async () => {
    const id = demo.createBusiness(
      { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email },
      { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' },
    );
    await render(id);
    expect(q('month-table')).toBeNull();
    demo.completeStep('tax');
    demo.completeStep('bank');
    await settle();
    expect(
      Array.from(el.querySelectorAll('[data-testid^="month-2026"]')).map((row) =>
        row.getAttribute('data-testid'),
      ),
    ).toEqual(['month-2026-10']);
    expect(text(q('status-2026-10'))).toBe('Running');
    expect(text(q('month-total-income'))).toBe(money(0));
  });

  describe('Month by month', () => {
    it('Weber Design shows the earlier months, August and September closed, October running, and the year total of Taxes', async () => {
      await render('weber-design');
      const business = demo.business();

      expect(text(q('months-title'))).toContain('Month by month 2026');
      expect(text(q('months-title'))).toContain('Monthly business report (BWA)');
      expect(text(q('months-basis'))).toBe(
        'Income and costs without VAT, from the booked payments. Always up to date.',
      );

      // One row for the months before the first payment, then every month up to the running one.
      const rows = Array.from(
        el.querySelectorAll('[data-testid^="month-2026"], [data-testid="month-earlier"]'),
      );
      expect(rows.map((row) => row.getAttribute('data-testid'))).toEqual([
        'month-earlier',
        'month-2026-08',
        'month-2026-09',
        'month-2026-10',
      ]);
      expect(text(q('month-earlier'))).toContain('Jan–Jul');
      expect(text(q('month-earlier'))).toContain('earlier months');
      expect(q('month-link-earlier')).toBeNull(); // the earlier months open nothing
      expect(
        ['earlier', '2026-08', '2026-09', '2026-10'].map((key) => text(q(`status-${key}`))),
      ).toEqual(['Closed', 'Closed', 'Closed', 'Running']);
      expect(text(q('month-link-2026-09'))).toBe('September');
      expect(text(q('month-2026-10'))).toContain('until 31 Oct');

      // Every row's figures are the ones the rules calculate.
      const calculated = monthRows(business, DEMO_TODAY);
      const keyOf = (row: (typeof calculated)[number]) =>
        row.kind === 'opening' ? 'earlier' : row.from;
      for (const row of calculated) {
        expect(text(q(`income-${keyOf(row)}`)), keyOf(row)).toBe(money(row.incomeCents));
        expect(text(q(`costs-${keyOf(row)}`)), keyOf(row)).toBe(money(row.costsCents));
        expect(text(q(`profit-${keyOf(row)}`)), keyOf(row)).toBe(money(row.profitCents));
      }

      // Year so far is the year total of Taxes › Year.
      const year = yearSummary(business);
      expect(text(q('month-total'))).toContain('Year so far');
      expect(text(q('month-total-income'))).toBe(money(year.incomeCents));
      expect(text(q('month-total-costs'))).toBe(money(year.costsCents));
      expect(text(q('month-total-profit'))).toBe(money(year.profitCents));
      expect(yearTotals(calculated).incomeCents).toBe(year.incomeCents);

      // August and September were closed by their VAT returns.
      expect(text(q('months-by-return'))).toBe(
        'August and September closed by themselves when their VAT returns were sent',
      );
    });

    it('a Kleinunternehmer reads "as paid" and has no line about VAT returns when it closed by hand', async () => {
      await render('sara-yoga');
      expect(text(q('months-basis'))).toBe(
        'Income and costs as paid, from the booked payments. Always up to date.',
      );
      expect(
        ['earlier', '2026-08', '2026-09', '2026-10'].map((key) => text(q(`status-${key}`))),
      ).toEqual(['Closed', 'Closed', 'Not closed', 'Running']);
      expect(q('months-by-return')).toBeNull(); // August was closed by hand
    });

    /** A VAT return sent today for a period, as the Taxes page records it. */
    const sentFor = (periodStart: string, periodEnd: string): SentVatReturn => ({
      periodStart,
      periodEnd,
      sentOn: DEMO_TODAY,
      chargedCents: 0,
      paidCents: 0,
      resultCents: 0,
      ticket: 'ET-2026-1022-00001',
      taxOffice: null,
    });

    it('names the months a VAT return closed, one or several, the way the language lists them', async () => {
      await render('cafe-linde');
      expect(q('months-by-return')).toBeNull();

      demo.recordSentReturn(sentFor('2026-09-01', '2026-09-30'));
      await settle();
      expect(text(q('months-by-return'))).toBe(
        'September closed by itself when its VAT return was sent',
      );

      demo.recordSentReturn(sentFor('2026-07-01', '2026-08-31'));
      await settle();
      expect(text(q('months-by-return'))).toBe(
        'July, August and September closed by themselves when their VAT returns were sent',
      );
      expect(['2026-07', '2026-08', '2026-09'].map((key) => text(q(`status-${key}`)))).toEqual([
        'Closed',
        'Closed',
        'Closed',
      ]);
    });

    it('a month opens Payments on that month', async () => {
      await render('weber-design');
      expect(q('month-link-2026-09')!.getAttribute('href')).toBe('/payments?month=2026-09');
      await click('month-link-2026-09');
      expect(router().url).toBe('/payments');
      expect((q('filter-month') as HTMLSelectElement).value).toBe('2026-09');
      const groups = Array.from(el.querySelectorAll('[data-testid="month-group"]'));
      expect(groups.map((g) => text(g.querySelector('[data-testid="month-title"]')))).toEqual([
        'September 2026',
      ]);
    });

    it('the running month says when it can be closed, and has no Close', async () => {
      await render('weber-design');
      expect(text(q('month-2026-10'))).toContain('Ready to close from 1 Nov');
      expect(q('close-2026-10')).toBeNull();
      expect(text(q('status-2026-10'))).toBe('Running');
    });

    it('Close is only on a finished month that is not closed: Café Linde has three, Weber Design none', async () => {
      await render('cafe-linde');
      expect(['2026-07', '2026-08', '2026-09'].map((key) => text(q(`close-${key}`)))).toEqual([
        'Close',
        'Close',
        'Close',
      ]);
      expect(q('close-2026-10')).toBeNull();
      expect(q('close-earlier')).toBeNull();
      await render('weber-design');
      expect(el.querySelectorAll('[data-testid^="close-2026"]')).toHaveLength(0);
    });

    it('only the owner and people with full access can close a month', async () => {
      await render('sara-yoga');
      expect(q('close-2026-09')).not.toBeNull();
      expect(q('months-only-full')).toBeNull();

      withRole(demo, 'sara-yoga', 'full');
      await settle();
      expect(q('close-2026-09')).not.toBeNull();

      for (const role of ['receipts', 'advisor'] as const) {
        withRole(demo, 'sara-yoga', role);
        await settle();
        expect(q('close-2026-09'), role).toBeNull();
        expect(text(q('status-2026-09')), role).toBe('Not closed');
        expect(text(q('months-only-full')), role).toBe(
          'Only the owner and people with full access can close a month.',
        );
      }
    });

    it('follows another business and an edit: the year total stays the Taxes year', async () => {
      await render('weber-design');
      const before = text(q('month-total-income'));
      edit('wd-t1', (tx) => ({ ...tx, confirmed: true }));
      await settle();
      expect(text(q('month-total-income'))).toBe(money(yearSummary(demo.business()).incomeCents));
      expect(text(q('month-total-income'))).not.toBe(before);

      await render('cafe-linde');
      expect(text(q('month-earlier'))).toContain('Jan–Jun');
      expect(text(q('month-total-income'))).toBe(money(yearSummary(demo.business()).incomeCents));
    });
  });

  describe('the needs-you line', () => {
    it('counts the payments that need the person, missing receipts included, and Start opens the review inbox', async () => {
      await render('sara-yoga');
      // Sara has one payment to confirm, one with no category and one with no receipt.
      const count = needsYouCount(demo.business().transactions);
      expect(count).toBe(3);
      expect(text(q('reports-needs'))).toContain('3 payments still need you');
      expect(text(q('reports-needs'))).toContain("They aren't in these figures yet; an export marks them as open.");
      expect(text(q('reports-needs-start'))).toBe('Start');
      expect(q('reports-needs-start')!.getAttribute('href')).toBe('/review');

      // Only the missing receipt is left.
      edit('sy-t2', (tx) => ({ ...tx, confirmed: true }));
      edit('sy-t7', (tx) => ({ ...tx, booking: SUPPLIES }));
      await settle();
      expect(needsYouCount(demo.business().transactions)).toBe(1);
      expect(text(q('reports-needs'))).toContain('1 payment still needs you');
      expect(text(q('reports-needs'))).toContain("It isn't in these figures yet; an export marks it as open.");

      await click('reports-needs-start');
      expect(router().url).toBe('/review');
    });

    it('does not say the payments are left out of an export: the export has them, marked as open', async () => {
      await render('sara-yoga');
      expect(text(q('reports-needs'))).not.toMatch(/exports yet/);
      // The export card next to it offers exactly that, first and chosen.
      expect(text(q('export-choice-open'))).toBe('Export with them marked as open');
      expect(q('export-choice-open')!.querySelector('input')!.checked).toBe(true);
    });

    it('says it in German and Arabic too', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('sara-yoga');
      expect(text(q('reports-needs'))).toContain('Sie stecken noch nicht in diesen Zahlen; ein Export markiert sie als offen.');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(q('reports-needs'))).toContain('ليست بعد ضمن هذه الأرقام، ويُظهرها التصدير على أنها مفتوحة.');
    });

    it('is not there when nothing needs the person', async () => {
      await render('sara-yoga');
      for (const tx of demo.business().transactions) {
        edit(tx.id, (t) => ({
          ...t,
          confirmed: true,
          booking: t.booking ?? SUPPLIES,
          receipt: 'attached',
        }));
      }
      await settle();
      expect(needsYouCount(demo.business().transactions)).toBe(0);
      expect(q('reports-needs')).toBeNull();
      expect(q('month-table')).not.toBeNull();
    });
  });

  describe('closing a month', () => {
    it('closing September at Sara Weber Yoga shows the passed check, then Closed', async () => {
      await render('sara-yoga');
      expect(text(q('status-2026-09'))).toBe('Not closed');
      await click('close-2026-09');
      await dialogIs(true);

      // The check: every payment is booked with its receipt, nothing is doubled, and the bank delivered after September ended
      // (the consent ended on 20 Oct, the last delivery was that day), so every line passes.
      expect(text(inDialog('close-title'))).toBe('Close September 2026?');
      expect(sentence(inDialog('close-locks'))).toBe(
        "Closing locks its bookings: they can't be changed any more. This is called Locking the books (Festschreibung).",
      );
      expect(text(inDialog('close-check-payments'))).toBe(
        'Every payment is booked and has its receipt',
      );
      expect(text(inDialog('close-check-duplicates'))).toBe('Nothing looks like a duplicate');
      expect(text(inDialog('close-check-account-sy-qonto'))).toBe('Qonto: Matches the bank');
      expect(text(inDialog('close-confirm'))).toBe('Close September');
      expect((inDialog('close-confirm') as HTMLButtonElement).disabled).toBe(false);
      expect(text(inDialog('close-not-yet'))).toBe('Not yet');

      inDialog('close-confirm')!.click();
      await dialogIs(false);

      expect(text(q('status-2026-09'))).toBe('Closed');
      expect(q('close-2026-09')).toBeNull();
      expect(demo.business().closedMonths.at(-1)).toEqual({
        month: '2026-09',
        on: DEMO_TODAY,
        by: 'Sara Weber',
      });
      expect(demo.business().history[0]).toEqual({
        date: DEMO_TODAY,
        key: 'monthClosed',
        params: { month: '2026-09', by: 'Sara Weber' },
      });
      // Close went away, so the cursor is on what replaced it: the word Closed.
      expect(document.activeElement).toBe(q('status-2026-09'));
    });

    it('when its VAT return closes the month under the open pop-up, the pop-up goes and the cursor is on Closed', async () => {
      await render('cafe-linde');
      await click('close-2026-09');
      await dialogIs(true);

      demo.recordSentReturn({
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        sentOn: DEMO_TODAY,
        chargedCents: 0,
        paidCents: 0,
        resultCents: 0,
        ticket: 'ET-2026-1022-00001',
        taxOffice: null,
      });
      await dialogIs(false);

      expect(text(q('status-2026-09'))).toBe('Closed');
      expect(q('close-2026-09')).toBeNull();
      expect(document.activeElement).toBe(q('status-2026-09'));
    });

    it('the figures and the year total do not change when a month is closed', async () => {
      await render('sara-yoga');
      const before = ['income', 'costs', 'profit'].map((kind) => text(q(`${kind}-2026-09`)));
      const total = text(q('month-total-income'));
      await click('close-2026-09');
      await dialogIs(true);
      inDialog('close-confirm')!.click();
      await dialogIs(false);
      expect(['income', 'costs', 'profit'].map((kind) => text(q(`${kind}-2026-09`)))).toEqual(
        before,
      );
      expect(text(q('month-total-income'))).toBe(total);
    });

    it('Not yet closes the pop-up, changes nothing and puts the cursor back on Close', async () => {
      await render('sara-yoga');
      await click('close-2026-09');
      await dialogIs(true);
      inDialog('close-not-yet')!.click();
      await dialogIs(false);
      expect(text(q('status-2026-09'))).toBe('Not closed');
      expect(demo.business().closedMonths).toHaveLength(1);
      expect(document.activeElement).toBe(q('close-2026-09'));
    });

    it('Escape closes the pop-up the same way', async () => {
      await render('sara-yoga');
      await click('close-2026-09');
      await dialogIs(true);
      dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      await dialogIs(false);
      expect(text(q('status-2026-09'))).toBe('Not closed');
      expect(document.activeElement).toBe(q('close-2026-09'));
    });

    it('opening another business closes the pop-up', async () => {
      await render('sara-yoga');
      await click('close-2026-09');
      await dialogIs(true);
      demo.setBusiness('weber-design');
      await dialogIs(false);
      expect(demo.businesses.find((b) => b.id === 'sara-yoga')!.closedMonths).toHaveLength(1);
    });

    it('a blocked month says what is missing, and Close is off', async () => {
      await render('sara-yoga');
      edit('sy-t10', (tx) => ({ ...tx, confirmed: false })); // a payment to confirm
      edit('sy-t11', (tx) => ({ ...tx, confirmed: false })); // and another
      edit('sy-t9', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null })); // and one with no receipt
      await settle();
      await click('close-2026-09');
      await dialogIs(true);

      expect(text(inDialog('close-check-payments'))).toBe('2 to confirm, 1 receipt missing Start');
      expect(inDialog('close-check-start')!.getAttribute('href')).toBe('/review');
      const close = inDialog('close-confirm') as HTMLButtonElement;
      expect(close.disabled).toBe(true);
      close.click();
      await settle();
      expect(dialog()).not.toBeNull();
      expect(demo.business().closedMonths).toHaveLength(1);

      // Starting the review leaves the pop-up behind.
      inDialog('close-check-start')!.click();
      await dialogIs(false);
      expect(router().url).toBe('/review');
    });
  });

  describe('the audit card', () => {
    it('the audit download shows weber-design_GDPdU_2026.zip', async () => {
      await render('weber-design');
      expect(text(q('audit-title'))).toContain('For a tax audit');
      expect(text(q('audit-title'))).toContain('Tax audit data format (GDPdU)');
      expect(text(q('audit-text'))).toBe(
        'If the tax office audits you, it may ask for your books in a set format. Ask your tax advisor first: usually their export is enough.',
      );
      expect(text(q('audit-download'))).toBe('Download the audit export (ZIP)');
      expect(q('audit-demo')).toBeNull(); // nothing is made until it is asked for

      await click('audit-download');
      expect(text(q('audit-demo'))).toContain('Demo');
      expect(text(q('audit-file'))).toBe('weber-design_GDPdU_2026.zip');
      expect(q('audit-file')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(q('audit-file')!.classList.contains('wrap-anywhere')).toBe(true);
      expect(q('audit-file')!.classList.contains('break-all')).toBe(false);
    });

    it('names the file of the open business, and forgets the box when another business opens', async () => {
      await render('sara-yoga');
      await click('audit-download');
      expect(text(q('audit-file'))).toBe('sara-yoga_GDPdU_2026.zip');
      await render('cafe-linde');
      expect(q('audit-demo')).toBeNull();
      await click('audit-download');
      expect(text(q('audit-file'))).toBe('cafe-linde_GDPdU_2026.zip');
    });
  });

  describe('in German and Arabic', () => {
    it('speaks German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('sara-yoga');
      expect(text(el.querySelector('h1'))).toBe('Auswertungen');
      expect(text(q('months-title'))).toContain('Monat für Monat 2026');
      expect(text(q('status-2026-09'))).toBe('Nicht abgeschlossen');
      expect(text(q('close-2026-09'))).toBe('Abschließen');
      expect(text(q('month-2026-10'))).toContain(
        `Abschließen ab ${formatDate('2026-11-01', 'de')} möglich`,
      );
      expect(text(q('audit-title'))).toContain('Für eine Betriebsprüfung');
    });

    it('Arabic mirrors the table and keeps amounts left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('weber-design');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe('التقارير');
      expect(text(q('status-2026-09'))).toBe('مغلق');
      expect(text(q('month-link-2026-09'))).toBe('سبتمبر');
      expect(text(q('month-earlier'))).toContain('يناير–يوليو');

      // Amounts, the year and the file name stay left to right inside the right-to-left text.
      const year = yearSummary(demo.business());
      for (const [testId, cents] of [
        ['month-total-income', year.incomeCents],
        ['month-total-costs', year.costsCents],
        ['month-total-profit', year.profitCents],
        ['income-2026-09', monthRows(demo.business(), DEMO_TODAY)[2].incomeCents],
      ] as const) {
        const amount = q(testId)!.querySelector('bdi[dir="ltr"]');
        expect(amount?.textContent, testId).toBe(money(cents, 'ar'));
      }
      expect(q('months-title')!.querySelector('bdi[dir="ltr"]')?.textContent).toBe('2026');
      await click('audit-download');
      expect(q('audit-file')!.closest('bdi[dir="ltr"]')).not.toBeNull();

      // Only logical spacing and alignment: nothing the page itself writes is tied to the left or the right (the
      // design system's own pieces, marked data-slot, keep their classes).
      const physical =
        /(^|:)(ml|mr|pl|pr|left|right|text-left|text-right|rounded-l|rounded-r|border-l|border-r)(-|$)/;
      const offenders = Array.from(el.querySelectorAll('*:not([data-slot])')).filter((node) =>
        Array.from(node.classList).some((name) => physical.test(name)),
      );
      expect(offenders.map((node) => node.outerHTML.slice(0, 80))).toEqual([]);
    });
  });
});
