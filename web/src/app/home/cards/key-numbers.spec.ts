import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../../core/format/format';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { decisionCount } from '../../domain/home-figures';
import { DemoStateService } from '../../state/demo-state.service';
import { KeyNumbers } from './key-numbers';

describe('KeyNumbers', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  function render(businessId = 'weber-design'): HTMLElement {
    demo.setBusiness(businessId);
    const fixture = TestBed.createComponent(KeyNumbers);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const tile = (el: HTMLElement, id: string) => el.querySelector<HTMLElement>(`[data-testid="tile-${id}"]`);

  it('shows three tiles for an active client, in order', () => {
    const el = render();
    const ids = Array.from(el.querySelectorAll('[data-testid^="tile-"]'))
      .map((t) => t.getAttribute('data-testid'))
      .filter((id) => ['tile-decisions', 'tile-balances', 'tile-tax'].includes(id!));
    expect(ids).toEqual(['tile-decisions', 'tile-balances', 'tile-tax']);
  });

  it('decisions tile shows the count and a Start button', () => {
    const el = render();
    const t = tile(el, 'decisions')!;
    expect(t.querySelector('p')?.textContent?.trim()).toBe('5');
    expect(t.textContent).toContain(String(decisionCount(demo.business(), demo.setup())));
    expect(t.textContent).toContain('about 5 minutes');
    const start = t.querySelector('a')!;
    expect(start.textContent).toContain('Start');
    expect(start.getAttribute('href')).toBe('/soon/decisions');
  });

  it('decisions tile shows all clear when nothing waits', () => {
    const t = tile(render('cafe-linde'), 'decisions')!;
    expect(t.textContent).toContain('All clear');
    expect(t.querySelector('a')).toBeNull();
  });

  it('total available tile shows the total with each account under it', () => {
    const t = tile(render(), 'balances')!;
    expect(t.querySelector('[data-testid="tile-balances-total"]')?.textContent?.trim()).toBe(
      formatMoney(1263020, 'en'),
    );
    expect(t.textContent).toContain('Qonto');
    expect(t.textContent).toContain(formatMoney(1248020, 'en'));
    expect(t.textContent).toContain('Cash box');
    expect(t.textContent).toContain(formatMoney(15000, 'en'));
  });

  it('third tile is VAT for a VAT business', () => {
    const t = tile(render('weber-design'), 'tax')!;
    expect(t.textContent).toContain(formatMoney(184200, 'en'));
    expect(t.textContent).toContain('Due 10 Nov');
    expect(t.textContent).toContain(formatMoney(320000, 'en'));
    expect(t.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('third tile is the tracker for a Kleinunternehmer', () => {
    const t = tile(render('sara-yoga'), 'tax')!;
    expect(t.textContent).toContain('€25,000');
    expect(t.textContent).not.toContain('Estimated to pay');
    expect(t.textContent).not.toContain('Due ');
    expect(t.querySelector('[role="progressbar"]')?.getAttribute('aria-valuenow')).toBe('85');
    expect(t.textContent).toContain(formatMoney(210000, 'en'));
  });

  it('third tile links to the taxes page', () => {
    expect(tile(render(), 'tax')!.querySelector('[data-testid="tile-tax-open"]')?.getAttribute('href')).toBe(
      '/soon/taxes',
    );
  });

  it('shows each tile only when its card would show', () => {
    demo.setSetup('halfway');
    const el = render();
    expect(tile(el, 'balances')).not.toBeNull();
    expect(tile(el, 'decisions')).toBeNull();
    expect(tile(el, 'tax')).toBeNull();

    demo.setSetup('new');
    const empty = render();
    expect(empty.querySelectorAll('[data-testid^="tile-"]')).toHaveLength(0);
  });
});
