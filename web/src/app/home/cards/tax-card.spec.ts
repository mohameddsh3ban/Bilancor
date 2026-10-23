import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../../core/format/format';
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

  it('weber-design shows 10 Nov and €1,842.00', () => {
    const el = render('weber-design');
    expect(el.textContent).toContain('VAT return');
    expect(el.textContent).toContain('Due 10 Nov');
    expect(el.textContent).toContain('€1,842.00');
    expect(el.textContent).toContain(formatMoney(184200, 'en'));
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
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

  it('sara-yoga switched to VAT shows Amount not known yet', () => {
    const el = renderChanged('sara-yoga', SWITCHED_TO_VAT);
    const vat = el.querySelector('[data-testid="tax-vat"]')!;
    expect(vat.textContent).toContain('Due 10 Nov');
    expect(vat.textContent).toContain('Amount not known yet');
    expect(vat.textContent).not.toContain('Estimated to pay');
    expect(vat.textContent).not.toContain('€');
    expect(el.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('shows no amount-unknown line when the amount is known', () => {
    expect(render('weber-design').textContent).not.toContain('Amount not known yet');
  });

  it('shows the amount again when a business with a known amount has a date', () => {
    const el = renderChanged('sara-yoga', SWITCHED_TO_VAT, { vatDue: { dueDate: '2026-11-10', amountCents: 50000 } });
    expect(el.textContent).toContain(formatMoney(50000, 'en'));
    expect(el.textContent).not.toContain('Amount not known yet');
  });

  it('the due date follows the answers and not the stored date', () => {
    expect(renderChanged('weber-design', { permanentExtension: true }).textContent).toContain('Due 10 Nov');
    expect(renderChanged('weber-design', { vatPeriod: 'quarterly' }).textContent).toContain('Due 11 Jan');
    expect(renderChanged('cafe-linde', {}).textContent).toContain('Due 11 Jan');
    expect(renderChanged('cafe-linde', { permanentExtension: true }).textContent).toContain('Due 10 Nov');
    expect(renderChanged('cafe-linde', { vatPeriod: 'monthly' }).textContent).toContain('Due 10 Nov');
  });

  it('keeps the stored amount whatever the date', () => {
    const el = renderChanged('weber-design', { vatPeriod: 'quarterly', permanentExtension: true });
    expect(el.textContent).toContain('Due 10 Nov');
    expect(el.textContent).toContain(formatMoney(184200, 'en'));
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
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, {}, 'de').textContent).toContain('Betrag noch nicht bekannt');
    expect(renderChanged('sara-yoga', SWITCHED_TO_VAT, {}, 'ar').textContent).toContain('المبلغ غير معروف بعد');
  });
});
