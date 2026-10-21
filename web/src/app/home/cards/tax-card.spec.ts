import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../../core/format/format';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { DemoStateService } from '../../state/demo-state.service';
import { TaxCard } from './tax-card';

describe('TaxCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  function render(businessId: string): HTMLElement {
    TestBed.inject(DemoStateService).setBusiness(businessId);
    const fixture = TestBed.createComponent(TaxCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('VAT business shows the VAT return with due date and estimated amount', () => {
    const el = render('weber-design');
    expect(el.textContent).toContain('VAT return');
    expect(el.textContent).toContain('Due 10 Nov');
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
});
