import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../../data/banks';
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

  it("each account opens Payments showing that account's payments", () => {
    TestBed.inject(DemoStateService).setBusiness('weber-design');
    const fixture = TestBed.createComponent(BalancesCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const href = (id: string) => el.querySelector(`[data-testid="account-${id}"]`)?.getAttribute('href');
    expect(href('wd-qonto')).toBe('/payments?account=wd-qonto');
    expect(href('wd-cash')).toBe('/payments?account=wd-cash');
  });

  it("does not list the Own money account: it holds nothing of the business's, so no balance of it is shown", () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('weber-design');
    demo.addOwnMoneyAccount();
    expect(demo.business().accounts.some((account) => account.kind === 'own')).toBe(true);
    const fixture = TestBed.createComponent(BalancesCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-testid="account-weber-design-own"]')).toBeNull();
    expect(el.textContent).not.toContain('Own money');
    expect(el.querySelectorAll('[data-testid^="account-w"]')).toHaveLength(2);
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

  it('names a connected savings account and credit card by the bank and the product in the language of the page', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('weber-design');
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    const language = TestBed.inject(LanguageService);
    const fixture = TestBed.createComponent(BalancesCard);
    const name = (id: string) =>
      (fixture.nativeElement as HTMLElement)
        .querySelector(`[data-testid="account-${id}"] .truncate`)
        ?.textContent?.replace(/\s+/g, ' ')
        .trim();
    fixture.detectChanges();
    expect(name('wd-qonto')).toBe('Qonto');
    expect(name('wd-savings')).toBe('Qonto · Savings');
    expect(name('wd-card')).toBe('Qonto · Credit card');
    language.setLang('de');
    fixture.detectChanges();
    expect(name('wd-qonto')).toBe('Qonto');
    expect(name('wd-savings')).toBe('Qonto · Sparkonto');
    expect(name('wd-card')).toBe('Qonto · Kreditkarte');
    expect(name('wd-cash')).toBe('Kasse');
    language.setLang('en');
  });
});
