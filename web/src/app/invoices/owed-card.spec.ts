import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceService } from '../state/invoice.service';
import { OwedCard } from './owed-card';

describe('OwedCard', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  function render(businessId?: string): HTMLElement {
    if (businessId) demo.setBusiness(businessId);
    const fixture = TestBed.createComponent(OwedCard);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (el: HTMLElement, testId: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  it('weber: €3,570.00 owed by 2 invoices, of which €1,190.00 is overdue (1 invoice)', () => {
    const el = render('weber-design');
    expect(text(el.querySelector('h2'))).toBe('Owed to you');
    expect(text(q(el, 'owed-total'))).toBe('€3,570.00 · 2 invoices');
    expect(text(q(el, 'owed-overdue'))).toBe('€1,190.00 overdue · 1 invoice');
    expect(text(q(el, 'owed-total'))).toContain(formatMoney(357000, 'en'));
  });

  it('each part is a link that sets the filter: the total opens Open, the overdue part opens Overdue', () => {
    const el = render('weber-design');
    expect(q(el, 'owed-total')!.getAttribute('href')).toBe('/invoices?filter=open');
    expect(q(el, 'owed-overdue')!.getAttribute('href')).toBe('/invoices?filter=overdue');
  });

  it('the overdue part is red', () => {
    const el = render('weber-design');
    expect(q(el, 'owed-overdue')!.className).toContain('text-negative');
    expect(q(el, 'owed-total')!.className).not.toContain('text-negative');
  });

  it('reads the open business: sara owes €300.00 and nothing is overdue, so there is no red part', () => {
    const el = render('sara-yoga');
    expect(text(q(el, 'owed-total'))).toBe('€300.00 · 1 invoice');
    expect(q(el, 'owed-overdue')).toBeNull();
  });

  it('café: everything owed is overdue', () => {
    const el = render('cafe-linde');
    expect(text(q(el, 'owed-total'))).toBe('€1,285.20 · 1 invoice');
    expect(text(q(el, 'owed-overdue'))).toBe('€1,285.20 overdue · 1 invoice');
  });

  it('follows the open business when it changes', () => {
    const fixture = TestBed.createComponent(OwedCard);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(q(el, 'owed-total'))).toContain('€3,570.00');
    demo.setBusiness('sara-yoga');
    fixture.detectChanges();
    expect(text(q(el, 'owed-total'))).toContain('€300.00');
  });

  it('is hidden before the bank is connected, when the sample invoices are not shown yet', () => {
    demo.setSetup('new');
    const el = render('weber-design');
    expect(q(el, 'owed-card')).toBeNull();
    expect(text(el)).toBe('');
  });

  it('is hidden when nothing is owed any more, and shows again when something is', () => {
    const fixture = TestBed.createComponent(OwedCard);
    demo.setBusiness('sara-yoga');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(q(el, 'owed-card')).not.toBeNull();

    TestBed.inject(InvoiceService).markPaidInCash('inv-sy-021', '2026-10-22');
    fixture.detectChanges();
    expect(q(el, 'owed-card')).toBeNull();
    expect(text(el)).toBe('');

    demo.setBusiness('weber-design');
    fixture.detectChanges();
    expect(q(el, 'owed-card')).not.toBeNull();
  });

  it('amounts keep their left-to-right order in Arabic, and the words are Arabic', () => {
    TestBed.inject(LanguageService).setLang('ar');
    const el = render('weber-design');
    for (const id of ['owed-total', 'owed-overdue']) {
      const amount = q(el, id)!.querySelector('bdi')!;
      expect(amount.getAttribute('dir'), id).toBe('ltr');
      expect(amount.textContent).toContain('€');
    }
    expect(text(el.querySelector('h2'))).not.toBe('Owed to you');
    expect(text(q(el, 'owed-total'))).not.toContain('invoices');
  });
});
