import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { DemoStateService } from '../../state/demo-state.service';
import { DecisionsCard } from './decisions-card';

describe('DecisionsCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  function render(businessId: string): HTMLElement {
    TestBed.inject(DemoStateService).setBusiness(businessId);
    const fixture = TestBed.createComponent(DecisionsCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the count, the minutes and a Start link', () => {
    const el = render('weber-design');
    expect(el.textContent).toContain('3 things need your decision');
    expect(el.textContent).toContain('about 3 minutes');
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/soon/decisions');
    expect(el.querySelector('a')?.textContent).toContain('Start');
  });

  it('uses the singular for one decision', () => {
    // The sample data is shared between tests, so put the payments back afterwards.
    const business = TestBed.inject(DemoStateService).businesses.find((b) => b.id === 'sara-yoga')!;
    const all = business.transactions;
    business.transactions = all.filter((t) => t.id !== 'sy-t7' && t.id !== 'sy-t8');
    try {
      const el = render('sara-yoga');
      expect(el.textContent).toContain('1 thing needs your decision');
      expect(el.textContent).toContain('about 1 minute');
      expect(el.textContent).not.toContain('1 minutes');
    } finally {
      business.transactions = all;
    }
  });

  it('shows the all-clear text and no Start link when nothing is open', () => {
    const el = render('cafe-linde');
    expect(el.textContent).toContain('All clear');
    expect(el.textContent).not.toContain('0 things');
    expect(el.querySelector('a')).toBeNull();
  });
});
