import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { DemoStateService } from '../../state/demo-state.service';
import { BalancesCard } from './balances-card';

describe('BalancesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  it('shows each account with its last update', () => {
    TestBed.inject(DemoStateService).setBusiness('weber-design');
    const fixture = TestBed.createComponent(BalancesCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const updated = (id: string) =>
      el.querySelector(`[data-testid="account-${id}"] [data-testid="account-updated"]`)?.textContent?.trim();
    expect(updated('wd-qonto')).toBe('Updated 21 Oct');
    expect(updated('wd-cash')).toBe('Updated 14 Oct');
  });
});
