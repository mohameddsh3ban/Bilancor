import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../core/format/format';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const has = (el: HTMLElement, testId: string) => el.querySelector(`[data-testid="${testId}"]`) !== null;

  it('new client sees only the checklist', () => {
    demo.setSetup('new');
    const el = render();
    expect(has(el, 'setup-checklist')).toBe(true);
    expect(has(el, 'transactions-card')).toBe(false);
    expect(has(el, 'balances-card')).toBe(false);
    expect(has(el, 'tax-card')).toBe(false);
    expect(has(el, 'decisions-card')).toBe(false);
  });

  it('halfway shows transactions and balances', () => {
    demo.setSetup('halfway');
    const el = render();
    expect(has(el, 'setup-checklist')).toBe(true);
    expect(has(el, 'transactions-card')).toBe(true);
    expect(has(el, 'balances-card')).toBe(true);
    expect(has(el, 'tax-card')).toBe(false);
    expect(has(el, 'decisions-card')).toBe(false);
  });

  it('active client sees everything except the checklist, in order', () => {
    const el = render();
    const order = Array.from(el.querySelectorAll('[data-testid$="-card"]')).map((c) => c.getAttribute('data-testid'));
    expect(order).toEqual(['notices-card', 'decisions-card', 'transactions-card', 'balances-card', 'tax-card']);
    expect(has(el, 'setup-checklist')).toBe(false);
  });

  it('balances total is the sum of the accounts', () => {
    const el = render();
    const total = el.querySelector('[data-testid="balances-total"]')!;
    expect(total.textContent?.trim()).toBe(formatMoney(1263020, 'en'));
  });

  it('zero decisions shows the all-clear text', () => {
    demo.setBusiness('cafe-linde');
    const el = render();
    const card = el.querySelector('[data-testid="decisions-card"]')!;
    expect(card.textContent).toContain('All clear');
    expect(card.textContent).not.toContain('0 things');
  });

  it('checklist steps link to their pages and tick the finished ones', () => {
    demo.setSetup('halfway');
    const el = render();
    const step = (id: string) => el.querySelector<HTMLElement>(`[data-testid="step-${id}"]`)!;
    expect(step('bank').getAttribute('data-done')).toBe('true');
    expect(step('tax').getAttribute('data-done')).toBe('false');
    for (const id of ['bank', 'tax', 'receipt']) {
      expect(step(id).querySelector('a')?.getAttribute('href')).toBe(`/soon/${id}`);
    }
  });

  it('shows the key-number tiles from lg while the phone cards for decisions, balances and tax hide', () => {
    const el = render();
    const tiles = el.querySelector('app-key-numbers')!;
    expect(tiles.classList).toContain('hidden');
    expect(tiles.classList).toContain('lg:grid');
    for (const id of ['decisions-card', 'balances-card', 'tax-card']) {
      expect(el.querySelector(`[data-testid="${id}"]`)!.parentElement!.classList).toContain('lg:hidden');
    }
    expect(el.querySelector('[data-testid="transactions-card"]')!.parentElement!.classList).not.toContain('lg:hidden');
  });

  it('places the tiles after the checklist and before the transactions card', () => {
    demo.setSetup('halfway');
    const el = render();
    const order = Array.from(
      el.querySelectorAll('[data-testid="setup-checklist"], app-key-numbers, [data-testid="transactions-card"]'),
    ).map((n) => n.getAttribute('data-testid') ?? n.tagName.toLowerCase());
    expect(order).toEqual(['setup-checklist', 'app-key-numbers', 'transactions-card']);
  });

  it('has no tiles for a new client', () => {
    demo.setSetup('new');
    expect(render().querySelector('app-key-numbers')).toBeNull();
  });
});
