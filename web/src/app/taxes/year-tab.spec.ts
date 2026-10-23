import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import en from '../../../public/i18n/en.json';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { BUSINESSES } from '../data/sample-data';
import { yearSummary } from '../domain/tax-year';
import { DemoStateService } from '../state/demo-state.service';
import { YearTab } from './year-tab';

describe('YearTab', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<YearTab>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        `[data-testid="${testId}"]`,
      ),
    );
  const euro = (cents: number) => formatMoney(cents, 'en');

  function render(businessId = 'weber-design'): void {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(YearTab);
    fixture.detectChanges();
  }

  it('names the months before the first payment, from the first payment, and does not link them', () => {
    render('weber-design');
    const summary = yearSummary(demo.business());
    const earlier = q('year-earlier')!;
    expect(text(q('year-earlier-label'))).toBe('January–July (earlier months)');
    expect(text(q('year-earlier-income'))).toBe(euro(summary.openingIncomeCents));
    expect(text(q('year-earlier-costs'))).toBe(euro(summary.openingCostsCents));
    expect(earlier.querySelector('a')).toBeNull();
  });

  it('the months before the first payment follow the first payment of the business', () => {
    render('cafe-linde');
    expect(text(q('year-earlier-label'))).toBe('January–June (earlier months)');
    render('sara-yoga');
    expect(text(q('year-earlier-label'))).toBe('January–July (earlier months)');
  });

  /** Renders the tab for Sara Weber Yoga with her first payment moved to another date. */
  function renderFirstPaymentOn(date: string): void {
    const sara = BUSINESSES.find((b) => b.id === 'sara-yoga')!;
    const first = sara.transactions.reduce((a, b) => (a.date <= b.date ? a : b));
    const business = {
      ...sara,
      transactions: sara.transactions.map((tx) => (tx === first ? { ...tx, date } : tx)),
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        { provide: DemoStateService, useValue: { business: () => business } },
      ],
    });
    fixture = TestBed.createComponent(YearTab);
    fixture.detectChanges();
  }

  it('names a single earlier month by its name, and has no earlier months line when the first payment is in January', () => {
    renderFirstPaymentOn('2026-02-03');
    expect(text(q('year-earlier-label'))).toBe('January (earlier months)');
    expect(text(q('year-since-label'))).toBe('From 3 Feb');
    renderFirstPaymentOn('2026-01-05');
    expect(q('year-earlier')).toBeNull();
    expect(text(q('year-since-label'))).toBe('From 5 Jan');
  });

  it('shows income and costs from the first payment, each linked to Payments', () => {
    render('weber-design');
    const summary = yearSummary(demo.business());
    expect(summary.paymentsSince).toBe('2026-08-05');
    expect(text(q('year-since-label'))).toBe('From 5 Aug');
    const income = q('year-income-link')!;
    const costs = q('year-costs-link')!;
    expect(text(income)).toBe(euro(summary.paymentsIncomeCents));
    expect(text(costs)).toBe(euro(summary.paymentsCostsCents));
    expect(income.getAttribute('href')).toBe('/payments');
    expect(costs.getAttribute('href')).toBe('/payments');
  });

  it('adds up income, costs and profit for the year', () => {
    render('weber-design');
    const summary = yearSummary(demo.business());
    expect(text(q('year-total-income'))).toBe(euro(summary.incomeCents));
    expect(text(q('year-total-costs'))).toBe(euro(summary.costsCents));
    expect(text(q('year-profit'))).toBe(euro(summary.profitCents));
    expect(summary.profitCents).toBe(summary.incomeCents - summary.costsCents);
  });

  it('says whether the amounts have the VAT taken out', () => {
    render('weber-design');
    expect(text(q('year-basis'))).toBe('Amounts without VAT');
    render('sara-yoga');
    expect(text(q('year-basis'))).toBe('Amounts as paid, you charge no VAT');
  });

  it('lists the costs by category, largest first, each with its SKR03 account', () => {
    render('weber-design');
    const rows = qa('year-category');
    const summary = yearSummary(demo.business());
    expect(rows).toHaveLength(summary.byCategory.length);
    summary.byCategory.forEach((category, i) => {
      const label = (en.booking as Record<string, string>)[category.labelKey];
      expect(text(rows[i].querySelector('[data-testid="year-category-name"]'))).toBe(
        `${label} · ${category.skr03} ${category.nameDe}`,
      );
      expect(text(rows[i].querySelector('[data-testid="year-category-amount"]'))).toBe(
        euro(category.cents),
      );
    });
    // The account number and its German name stay left to right.
    expect(rows[0].querySelector('bdi[dir="ltr"]')).not.toBeNull();
    // The categories add up to the costs.
    expect(summary.byCategory.reduce((sum, c) => sum + c.cents, 0)).toBe(summary.costsCents);
  });

  it('shows the income tax to set aside', () => {
    render('weber-design');
    expect(text(q('year-income-tax'))).toContain('Income tax to set aside');
    expect(text(q('year-income-tax-amount'))).toBe(euro(320000));
    render('sara-yoga');
    expect(text(q('year-income-tax-amount'))).toBe(euro(210000));
  });

  it('year tab lists the returns with German terms', () => {
    render('weber-design');
    const returns = qa('year-return');
    expect(returns.map((r) => r.getAttribute('data-return'))).toEqual([
      'euer',
      'einkommensteuererklaerung',
      'umsatzsteuererklaerung',
    ]);
    expect(returns.map((r) => text(r.querySelector('button')))).toEqual([
      'Annual profit report (EÜR)',
      'Income tax return (Einkommensteuererklärung)',
      'Annual VAT return (Umsatzsteuererklärung)',
    ]);
    for (const row of returns)
      expect(text(row.querySelector('[data-testid="year-return-due"]'))).toBe('due 31 Jul 2027');
    expect(text(q('year-prepared'))).toBe('These are prepared at the end of the year.');
  });

  it('a partnership files the partnership return instead of an income tax return', () => {
    render('cafe-linde');
    expect(qa('year-return').map((r) => r.getAttribute('data-return'))).toEqual([
      'euer',
      'feststellungserklaerung',
      'umsatzsteuererklaerung',
    ]);
    expect(text(qa('year-return')[1].querySelector('button'))).toBe(
      'Partnership profit return (Feststellungserklärung)',
    );
  });

  it('a Kleinunternehmer has no annual VAT return', () => {
    render('sara-yoga');
    expect(qa('year-return').map((r) => r.getAttribute('data-return'))).toEqual([
      'euer',
      'einkommensteuererklaerung',
    ]);
  });

  it('a Kleinunternehmer’s income is the revenue figure of the year', () => {
    render('sara-yoga');
    expect(text(q('year-total-income'))).toBe(euro(2130000));
  });

  it('explains each German term on tap', () => {
    render('weber-design');
    const buttons = qa('year-return').map((r) => r.querySelector('button')!);
    expect(buttons).toHaveLength(3);
    for (const button of buttons) expect(button.getAttribute('aria-haspopup')).toBe('dialog');
  });

  it('says the same in German', () => {
    TestBed.inject(LanguageService).setLang('de');
    render('cafe-linde');
    expect(text(q('year-earlier-label'))).toBe('Januar–Juni (frühere Monate)');
    expect(text(q('year-since-label'))).toBe('Ab 10. Juli');
    expect(text(qa('year-return')[1].querySelector('button'))).toBe('Feststellungserklärung');
    expect(text(qa('year-return')[0].querySelector('[data-testid="year-return-due"]'))).toBe(
      'fällig am 31. Juli 2027',
    );
    expect(text(q('year-prepared'))).toBe('Diese werden am Jahresende vorbereitet.');
  });

  it('says the same in Arabic, with the amounts left to right', () => {
    TestBed.inject(LanguageService).setLang('ar');
    render('weber-design');
    const summary = yearSummary(demo.business());
    expect(q('year-total-income')!.querySelector('bdi[dir="ltr"]')?.textContent).toBe(
      formatMoney(summary.incomeCents, 'ar'),
    );
    expect(text(q('year-earlier-label'))).toContain('يناير');
  });

  it('follows another business', () => {
    render('weber-design');
    const before = text(q('year-total-income'));
    demo.setBusiness('cafe-linde');
    fixture.detectChanges();
    expect(text(q('year-total-income'))).not.toBe(before);
    expect(text(q('year-earlier-label'))).toBe('January–June (earlier months)');
  });
});
