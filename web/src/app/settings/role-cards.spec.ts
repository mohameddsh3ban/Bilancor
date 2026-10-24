import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { GrantedRole } from '../domain/people';
import { RoleCards } from './role-cards';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

@Component({
  imports: [RoleCards],
  template: `<app-role-cards [(role)]="role" [readonly]="readonly()" />`,
})
class Host {
  readonly role = signal<GrantedRole | null>(null);
  readonly readonly = signal(false);
}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('RoleCards', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const radio = (role: string) =>
      el.querySelector<HTMLInputElement>(`[data-testid="role-${role}"] input`)!;
    return { fixture, el, radio, host: fixture.componentInstance };
  }

  it('offers the three roles, never the owner, as one group of radio buttons', () => {
    const { el, radio } = render();
    expect(el.querySelector('[role="radiogroup"]')!.getAttribute('aria-labelledby')).toBeTruthy();
    expect(text(el.querySelector('p'))).toBe('What can they do?');
    const names = ['full', 'receipts', 'advisor'].map((r) => radio(r).name);
    expect(new Set(names).size).toBe(1);
    expect(names[0]).not.toBe('');
    expect(el.querySelectorAll('input[type="radio"]')).toHaveLength(3);
    expect(['full', 'receipts', 'advisor'].map((r) => radio(r).checked)).toEqual([
      false,
      false,
      false,
    ]);
  });

  it('two groups on one page do not share their choice', () => {
    const first = render();
    const second = render();
    expect(first.radio('full').name).not.toBe(second.radio('full').name);
  });

  it('choosing a card sets the role, and a role set from outside checks its card', () => {
    const { fixture, radio, host } = render();
    radio('receipts').click();
    fixture.detectChanges();
    expect(host.role()).toBe('receipts');
    expect(radio('receipts').checked).toBe(true);
    host.role.set('advisor');
    fixture.detectChanges();
    expect(radio('advisor').checked).toBe(true);
    expect(radio('receipts').checked).toBe(false);
  });

  it('each card says what the role can (✓) and can not (✕) do, with words for a screen reader', () => {
    const { el } = render();
    const card = el.querySelector<HTMLElement>('[data-testid="role-receipts"]')!;
    expect(text(card.querySelector('[data-testid="role-can"]'))).toBe(
      'Can: Upload receipts and fix the ones they added',
    );
    expect(text(card.querySelector('[data-testid="role-cant"]'))).toBe(
      "Can't: Payments, bank balances, taxes, settings",
    );
    expect(card.querySelectorAll('ng-icon[aria-hidden="true"]')).toHaveLength(2);
    expect(card.querySelector('[data-testid="role-can"] .sr-only')).not.toBeNull();
  });

  it('read only, it shows the chosen role alone, with no choice to make', () => {
    const { fixture, el, host } = render();
    host.readonly.set(true);
    fixture.detectChanges();
    expect(el.querySelector('[data-testid="role-readonly"]')).toBeNull();
    host.role.set('full');
    fixture.detectChanges();
    expect(el.querySelectorAll('input')).toHaveLength(0);
    expect(text(el.querySelector('[data-testid="role-readonly"]'))).toBe(
      "Full access Can: Everything the owner can: payments, receipts, taxes, settings Can't: Invite or remove people, change the plan",
    );
  });

  it('speaks German and Arabic', () => {
    const { fixture, el, host } = render();
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(el.querySelector('[data-testid="role-full"]'))).toContain(de.roles.full.name);
    expect(text(el.querySelector('[data-testid="role-advisor"]'))).toContain(de.roles.advisor.can);
    TestBed.inject(LanguageService).setLang('ar');
    host.readonly.set(true);
    host.role.set('receipts');
    fixture.detectChanges();
    expect(text(el.querySelector('[data-testid="role-readonly"]'))).toContain(
      ar.roles.receipts.cant,
    );
  });
});
