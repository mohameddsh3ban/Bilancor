import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatDate, formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import type { Business, Lang, TaxProfile } from '../../data/models';
import { BUSINESSES } from '../../data/sample-data';
import { DemoStateService } from '../../state/demo-state.service';
import { TaxCard } from './tax-card';

describe('TaxCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

  function render(businessId: string): HTMLElement {
    TestBed.inject(DemoStateService).setBusiness(businessId);
    const fixture = TestBed.createComponent(TaxCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('weber-design shows 10 Nov and the amount its booked October payments give, €393.33', () => {
    const el = render('weber-design');
    expect(el.textContent).toContain('VAT return');
    expect(el.textContent).toContain('Due 10 Nov');
    expect(el.textContent).toContain('€393.33');
    expect(el.textContent).toContain(formatMoney(39333, 'en'));
    expect(el.textContent).toContain('Estimated to pay');
    expect(el.querySelector('[data-testid="tax-vat-due"]')!.className).not.toContain('text-negative');
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('cafe-linde shows its Q3 return as overdue since 10 Oct, in red, with the amount of its booked payments', () => {
    const el = render('cafe-linde');
    const due = el.querySelector('[data-testid="tax-vat-due"]')!;
    expect(due.textContent!.trim()).toBe('Overdue since 10 Oct');
    expect(due.className).toContain('text-negative');
    expect(el.textContent).not.toContain('Due ');
    expect(el.textContent).toContain('Estimated to pay');
    expect(el.textContent).toContain(formatMoney(78564, 'en'));
  });

  it('Kleinunternehmer gets the tracker', () => {
    const el = render('sara-yoga');
    expect(el.textContent).toContain('€21,300');
    expect(el.textContent).toContain('€25,000');
    expect(el.textContent).not.toContain('Due ');
    const bar = el.querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('85');
  });

  it('shows the income tax to set aside for both kinds of business', () => {
    expect(render('weber-design').textContent).toContain(formatMoney(320000, 'en'));
    expect(render('sara-yoga').textContent).toContain(formatMoney(210000, 'en'));
  });

  it('uses warning style on the tracker from 80 percent', () => {
    const indicator = render('sara-yoga').querySelector('[data-slot="progress-indicator"]')!;
    expect(indicator.className).toContain('bg-warning');
    expect(indicator.className).not.toContain('bg-primary');
  });


  function renderWithRevenue(cents: number): HTMLElement {
    const sara = TestBed.inject(DemoStateService).businesses.find((b) => b.id === 'sara-yoga')!;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        { provide: DemoStateService, useValue: { business: () => ({ ...sara, revenueThisYearCents: cents }) } },
      ],
    });
    const fixture = TestBed.createComponent(TaxCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the tracker amounts in whole euros', () => {
    const text = render('sara-yoga').querySelector('[data-testid="tax-tracker"]')!.textContent!;
    expect(text.replace(/\s+/g, ' ')).toContain('€21,300 of €25,000 this year');
    expect(text.replace(/\s+/g, ' ')).toContain('85% of your limit used');
  });

  it('uses the negative colour once revenue is over the hard limit', () => {
    const el = renderWithRevenue(11_000_000);
    const indicator = el.querySelector('[data-slot="progress-indicator"]')!;
    expect(indicator.className).toContain('bg-negative');
    expect(indicator.className).not.toContain('bg-warning');
    expect(el.querySelector('[data-testid="tax-tracker-percent"]')!.className).toContain('text-negative');
  });

  it('keeps the warning colour while over the limit but under the hard limit', () => {
    const el = renderWithRevenue(3_000_000);
    expect(el.querySelector('[data-slot="progress-indicator"]')!.className).toContain('bg-warning');
    expect(el.querySelector('[data-testid="tax-tracker-percent"]')!.className).toContain('text-warning');
  });

  it('links to the taxes page', () => {
    for (const id of ['weber-design', 'sara-yoga']) {
      const link = render(id).querySelector('[data-testid="tax-open"]');
      expect(link?.getAttribute('href')).toBe('/soon/taxes');
    }
  });

  it('clamps the progress bar at 100 when revenue is over the limit', () => {
    const sara = TestBed.inject(DemoStateService).businesses.find((b) => b.id === 'sara-yoga')!;
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        { provide: DemoStateService, useValue: { business: () => ({ ...sara, revenueThisYearCents: 3_000_000 }) } },
      ],
    });
    const fixture = TestBed.createComponent(TaxCard);
    fixture.detectChanges();
    const bar = (fixture.nativeElement as HTMLElement).querySelector('[role="progressbar"]')!;
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('120%');
  });
  /** Renders the card for a sample business whose tax answers (and, optionally, other fields) were changed. */
  function renderChanged(
    businessId: string,
    taxPatch: Partial<TaxProfile>,
    businessPatch: Partial<Business> = {},
    lang: Lang = 'en',
  ): HTMLElement {
    const business = BUSINESSES.find((b) => b.id === businessId)!;
    const changed = {
      ...business,
      ...businessPatch,
      taxProfile: { ...business.taxProfile, ...taxPatch },
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter([]), { provide: DemoStateService, useValue: { business: () => changed } }],
    });
    TestBed.inject(LanguageService).setLang(lang);
    const fixture = TestBed.createComponent(TaxCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const SWITCHED_TO_VAT: Partial<TaxProfile> = { kleinunternehmer: false, vatPeriod: 'monthly', vatBasis: 'ist' };

  it('a yearly profile shows Yearly VAT return only', () => {
    const el = renderChanged('weber-design', { vatPeriod: 'yearly' });
    const vat = el.querySelector('[data-testid="tax-vat"]')!;
    expect(vat.textContent).toContain('VAT return');
    expect(vat.textContent).toContain('Yearly VAT return only');
    expect(vat.textContent).not.toContain('Due ');
    expect(vat.textContent).not.toContain('Estimated to pay');
    expect(vat.textContent).not.toContain(formatMoney(184200, 'en'));
    expect(vat.textContent).not.toContain('€');
  });

  it('a business with no booked payment that carries VAT shows Amount not known yet', () => {
    const el = renderChanged('sara-yoga', SWITCHED_TO_VAT, { transactions: [] });
    const vat = el.querySelector('[data-testid="tax-vat"]')!;
    expect(vat.textContent).toContain('Due 10 Nov');
    expect(vat.textContent).toContain('Amount not known yet');
    expect(vat.textContent).not.toContain('Estimated to pay');
    expect(vat.textContent).not.toContain('€');
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows no amount-unknown line when the amount is known', () => {
    expect(render('weber-design').textContent).not.toContain('Amount not known yet');
    expect(render('cafe-linde').textContent).not.toContain('Amount not known yet');
  });

  it('a return with a negative result says You get back, with the amount as a positive number', () => {
    // Sara's booked October payments hold VAT on what she bought (€66.23) and none on what she charged.
    const vat = renderChanged('sara-yoga', SWITCHED_TO_VAT).querySelector('[data-testid="tax-vat"]')!;
    expect(vat.textContent).toContain('You get back');
    expect(vat.textContent).toContain('€66.23');
    expect(vat.textContent).not.toMatch(/-\s*€/);
    expect(vat.textContent).not.toContain('Estimated to pay');
    expect(vat.textContent).not.toContain('Amount not known yet');
    expect(vat.textContent).toContain('Due 10 Nov');
  });

  it('the date and the amount follow the answers: the period they give, with the date of its return', () => {
    const extended = renderChanged('weber-design', { permanentExtension: true });
    expect(extended.textContent).toContain('Due 10 Dec');
    expect(extended.textContent).toContain(formatMoney(39333, 'en'));
    const quarterly = renderChanged('weber-design', { vatPeriod: 'quarterly' });
    expect(quarterly.textContent).toContain('Due 10 Jan');
    expect(quarterly.textContent).toContain(formatMoney(39333, 'en'));
    expect(renderChanged('cafe-linde', {}).textContent).toContain('Overdue since 10 Oct');
    // With the extension Café's Q3 is due 10 Nov, so it is not late yet.
    const cafeExtended = renderChanged('cafe-linde', { permanentExtension: true });
    expect(cafeExtended.textContent).toContain('Due 10 Nov');
    expect(cafeExtended.textContent).not.toContain('Overdue');
    // Monthly: the month after its sent Q2 is July, which was due on 10 August.
    expect(renderChanged('cafe-linde', { vatPeriod: 'monthly' }).textContent).toContain('Overdue since 10 Aug');
  });

  it('calculates the amount from the payments, whatever the date', () => {
    const el = renderChanged('weber-design', { vatPeriod: 'quarterly', permanentExtension: true });
    expect(el.textContent).toContain('Due 10 Feb');
    expect(el.textContent).toContain(formatMoney(39333, 'en'));
  });

  it('shows no VAT block for a VAT business whose return period is not answered yet', () => {
    const el = renderChanged('weber-design', { vatPeriod: null });
    expect(el.querySelector('[data-testid="tax-vat"]')).toBeNull();
    expect(el.textContent).toContain(formatMoney(320000, 'en'));
  });

  it('shows the tracker and no VAT block for a business that turns into a Kleinunternehmer', () => {
    const el = renderChanged('weber-design', { kleinunternehmer: true, vatPeriod: null, vatBasis: null });
    expect(el.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="tax-vat"]')).toBeNull();
  });

  it('says the new lines in German and Arabic too', () => {
    const yearly = { vatPeriod: 'yearly' } as const;
    expect(renderChanged('weber-design', yearly, {}, 'de').textContent).toContain('Nur Umsatzsteuer-Jahreserklärung');
    expect(renderChanged('weber-design', yearly, {}, 'ar').textContent).toContain('إقرار ضريبة القيمة المضافة السنوي فقط');
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, { transactions: [] }, 'de').textContent).toContain('Betrag noch nicht bekannt');
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, { transactions: [] }, 'ar').textContent).toContain('المبلغ غير معروف بعد');
  });

  it('says overdue and the refund in German and Arabic too', () => {
    expect(renderChanged('cafe-linde', {}, {}, 'de').textContent).toContain(`Überfällig seit ${formatDate('2026-10-10', 'de')}`);
    expect(renderChanged('cafe-linde', {}, {}, 'ar').textContent).toContain('متأخرة منذ');
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, {}, 'de').textContent).toContain('Du bekommst zurück');
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, {}, 'ar').textContent).toContain('ستسترد');
  });
});
