import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../../core/format/format';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../../data/banks';
import type { Business, TaxProfile } from '../../data/models';
import { BUSINESSES } from '../../data/sample-data';
import { ALL_DONE } from '../../domain/home-cards';
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

  afterEach(() => TestBed.inject(LanguageService).setLang('en'));

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

  it('decisions tile shows the count and a Start button to the review inbox', () => {
    const el = render();
    const t = tile(el, 'decisions')!;
    const count = decisionCount(demo.business(), demo.setup());
    expect(count).toBe(6);
    expect(t.querySelector('p')?.textContent?.trim()).toBe(String(count));
    expect(t.textContent).toContain('about 6 minutes');
    const start = t.querySelector('a')!;
    expect(start.textContent).toContain('Start');
    expect(start.getAttribute('href')).toBe('/review');
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

  it('names a connected savings account by the bank and the product in the language of the page', () => {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    const t = tile(render(), 'balances')!;
    expect(t.textContent).toContain('Qonto · Savings');
    expect(t.textContent).toContain('Qonto · Credit card');
    expect(t.textContent).not.toContain('Qonto Savings');
    TestBed.inject(LanguageService).setLang('de');
    const german = tile(render(), 'balances')!;
    expect(german.textContent).toContain('Qonto · Sparkonto');
    expect(german.textContent).toContain('Qonto · Kreditkarte');
    expect(german.textContent).toContain('Kasse');
  });

  it('third tile is VAT for a VAT business, with the amount its booked October payments give', () => {
    const t = tile(render('weber-design'), 'tax')!;
    expect(t.textContent).toContain(formatMoney(39333, 'en'));
    expect(t.textContent).toContain('Estimated to pay');
    expect(t.textContent).toContain('Due 10 Nov');
    expect(t.querySelector('[data-testid="tile-tax-due"]')!.className).not.toContain('text-negative');
    expect(t.textContent).toContain(formatMoney(320000, 'en'));
    expect(t.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('third tile shows cafe-linde Q3 as overdue since 10 Oct, in red, with the amount of its booked payments', () => {
    const t = tile(render('cafe-linde'), 'tax')!;
    const due = t.querySelector('[data-testid="tile-tax-due"]')!;
    expect(due.textContent!.trim()).toBe('Overdue since 10 Oct');
    expect(due.className).toContain('text-negative');
    expect(t.textContent).not.toContain('Due ');
    expect(t.textContent).toContain(formatMoney(78564, 'en'));
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
      '/taxes',
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

  /** Renders the tiles for a sample business whose tax answers (and, optionally, other fields) were changed. */
  function renderChanged(businessId: string, taxPatch: Partial<TaxProfile>, businessPatch: Partial<Business> = {}): HTMLElement {
    const business = BUSINESSES.find((b) => b.id === businessId)!;
    const changed = { ...business, ...businessPatch, taxProfile: { ...business.taxProfile, ...taxPatch } };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        { provide: DemoStateService, useValue: { business: () => changed, setup: () => ALL_DONE } },
      ],
    });
    const fixture = TestBed.createComponent(KeyNumbers);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const SWITCHED_TO_VAT: Partial<TaxProfile> = { kleinunternehmer: false, vatPeriod: 'monthly', vatBasis: 'ist' };

  it('third tile follows the answers: the period they give, the date of its return and the amount of its payments', () => {
    const extended = tile(renderChanged('weber-design', { permanentExtension: true }), 'tax')!;
    expect(extended.textContent).toContain('Due 10 Dec');
    expect(extended.textContent).toContain(formatMoney(39333, 'en'));
    const quarterly = tile(renderChanged('weber-design', { vatPeriod: 'quarterly' }), 'tax')!;
    expect(quarterly.textContent).toContain('Due 10 Jan');
    expect(quarterly.textContent).toContain(formatMoney(39333, 'en'));
    expect(tile(renderChanged('cafe-linde', {}), 'tax')!.textContent).toContain('Overdue since 10 Oct');
    // With the extension Café's Q3 is due 10 Nov, so it is not late yet.
    const cafeExtended = tile(renderChanged('cafe-linde', { permanentExtension: true }), 'tax')!;
    expect(cafeExtended.textContent).toContain('Due 10 Nov');
    expect(cafeExtended.textContent).not.toContain('Overdue');
  });

  it('third tile shows Yearly VAT return only, with no date and no amount, for a yearly profile', () => {
    const t = tile(renderChanged('weber-design', { vatPeriod: 'yearly' }), 'tax')!;
    expect(t.textContent).toContain('Yearly VAT return only');
    expect(t.textContent).not.toContain('Due ');
    expect(t.textContent).not.toContain('Estimated to pay');
    expect(t.textContent).not.toContain(formatMoney(39333, 'en'));
    expect(t.textContent).toContain(formatMoney(320000, 'en'));
  });

  it('third tile shows Amount not known yet for a business switched to VAT with no booked payment that carries VAT', () => {
    const t = tile(renderChanged('sara-yoga', SWITCHED_TO_VAT, { transactions: [] }), 'tax')!;
    expect(t.textContent).toContain('Amount not known yet');
    expect(t.textContent).toContain('Due 10 Nov');
    expect(t.textContent).not.toContain('Estimated to pay');
    expect(t.querySelector('[role="progressbar"]')).toBeNull();
  });

  it('third tile says You get back, with a positive amount, when the result is negative', () => {
    // Sara's booked October payments hold VAT on what she bought (€66.23) and none on what she charged.
    const t = tile(renderChanged('sara-yoga', SWITCHED_TO_VAT), 'tax')!;
    expect(t.textContent).toContain('You get back');
    expect(t.textContent).toContain('€66.23');
    expect(t.textContent).not.toMatch(/-\s*€/);
    expect(t.textContent).not.toContain('Estimated to pay');
    expect(t.textContent).not.toContain('Amount not known yet');
  });
});
