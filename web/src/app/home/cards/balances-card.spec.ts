import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { DemoStateService } from '../../state/demo-state.service';
import { BalancesCard } from './balances-card';

describe('BalancesCard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
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

  it('translates the cash account name and leaves bank names alone', () => {
    TestBed.inject(DemoStateService).setBusiness('weber-design');
    const language = TestBed.inject(LanguageService);
    const fixture = TestBed.createComponent(BalancesCard);
    const text = (id: string) =>
      (fixture.nativeElement as HTMLElement).querySelector(`[data-testid="account-${id}"]`)?.textContent ?? '';
    fixture.detectChanges();
    expect(text('wd-cash')).toContain('Cash box');
    language.setLang('de');
    fixture.detectChanges();
    expect(text('wd-cash')).toContain('Kasse');
    expect(text('wd-cash')).not.toContain('Cash box');
    expect(text('wd-qonto')).toContain('Qonto');
  });
});
