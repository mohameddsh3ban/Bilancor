import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { TaxProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import type { ReviewItem } from '../domain/review-queue';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService, type ReviewAnswerResult } from '../state/review.service';
import { ReviewFinish } from './finish';
import { settleItem } from './review-testing';

@Component({
  imports: [ReviewFinish],
  template: `<app-review-finish (back)="backs = backs + 1" />`,
})
class Host {
  backs = 0;
}

const DONE: ReviewAnswerResult = { labelKey: 'home.status.booked' };

describe('ReviewFinish', () => {
  let fixture: ComponentFixture<Host>;
  let demo: DemoStateService;
  let review: ReviewService;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter([])],
    });
    demo = TestBed.inject(DemoStateService);
    review = TestBed.inject(ReviewService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const settle = (item: ReviewItem): void => settleItem(demo, item);
  /** Answers every card of the open business; `counts` says which answers add to the summary, by place in the queue. */
  const answerAll = (counts: Record<number, ReviewAnswerResult['counts']> = {}): void => {
    for (let i = 0; review.current() !== null && i < 20; i++) {
      const item = review.current()!;
      void review.answer(() => settle(item), { ...DONE, counts: counts[i] });
    }
  };

  function render(): void {
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  it('says everything is done, with a check and a Back button', () => {
    answerAll();
    render();

    expect(text(q('finish-title'))).toBe('All done — your books are up to date');
    expect(q('finish-check')).not.toBeNull();
    expect(text(q('finish-back'))).toBe('Back');
  });

  it('sums up the decisions, and the receipts and duplicates when there are any', () => {
    answerAll({ 1: 'receipt', 5: 'duplicateRemoved' });
    render();

    expect(text(q('finish-summary'))).toBe('6 decisions · 1 receipt added · 1 duplicate removed');
  });

  it('counts in the plural', () => {
    answerAll({ 0: 'receipt', 1: 'receipt', 4: 'duplicateRemoved', 5: 'duplicateRemoved' });
    render();

    expect(text(q('finish-summary'))).toBe('6 decisions · 2 receipts added · 2 duplicates removed');
  });

  it('leaves out the receipts when there are none', () => {
    answerAll({ 2: 'duplicateRemoved' });
    render();
    expect(text(q('finish-summary'))).toBe('6 decisions · 1 duplicate removed');
  });

  it('leaves out the duplicates when there are none', () => {
    answerAll({ 3: 'receipt' });
    render();
    expect(text(q('finish-summary'))).toBe('6 decisions · 1 receipt added');
  });

  it('says one decision in the singular', () => {
    // Everything but the last card is settled elsewhere, so only one answer is given here.
    while (review.total() - review.answered() > 1) settle(review.current()!);
    answerAll();
    render();

    expect(review.summary().decisions).toBe(1);
    expect(text(q('finish-summary'))).toBe('1 decision');
  });

  it('adds nothing about the decisions when none were made', () => {
    demo.setBusiness('cafe-linde');
    expect(review.current()).toBeNull();
    render();

    expect(q('finish-title')).not.toBeNull();
    expect(q('finish-summary')).toBeNull();
  });

  describe('the next VAT return', () => {
    it('is named for a business that charges VAT', () => {
      answerAll();
      render();

      expect(text(q('finish-vat'))).toBe(
        `VAT return (UStVA) · next due ${formatDate('2026-11-10', 'en')}`,
      );
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Nov');
    });

    it('names the tax term with its German original and an explanation, like the tax card', () => {
      answerAll();
      render();

      const term = q('finish-vat')!.querySelector('app-term');
      expect(term).not.toBeNull();
      expect(text(term!.querySelector('button'))).toBe('VAT return (UStVA)');
      expect(term!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('is left out for a business that does not', () => {
      demo.setBusiness('sara-yoga');
      expect(demo.business().taxProfile.kleinunternehmer).toBe(true);
      answerAll();
      render();

      expect(q('finish-summary')).not.toBeNull();
      expect(q('finish-vat')).toBeNull();
    });

    /** Shows the finish screen of a sample business whose tax answers were changed (the review itself is not needed). */
    function renderWithTax(businessId: string, taxPatch: Partial<TaxProfile>): void {
      const business = BUSINESSES.find((b) => b.id === businessId)!;
      const changed = { ...business, taxProfile: { ...business.taxProfile, ...taxPatch } };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideTranslocoTesting(),
          provideRouter([]),
          { provide: DemoStateService, useValue: { business: () => changed } },
          {
            provide: ReviewService,
            useValue: { summary: () => ({ decisions: 0, receiptsAdded: 0, duplicatesRemoved: 0 }) },
          },
        ],
      });
      render();
    }

    it('follows the VAT return date of the answers', () => {
      renderWithTax('weber-design', {});
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Nov');
      renderWithTax('weber-design', { permanentExtension: true });
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Dec');
      // A quarterly answer gives the quarter, whose return is due after the quarter ends.
      renderWithTax('weber-design', { vatPeriod: 'quarterly' });
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Jan');
      // With the extension Café's Q3 is due 10 Nov, so it is not late yet.
      renderWithTax('cafe-linde', { permanentExtension: true });
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Nov');
    });

    it('says a return that is late is overdue since its date, in red, and names no amount', () => {
      renderWithTax('cafe-linde', {});
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · overdue since 10 Oct');
      expect(text(q('finish-vat'))).not.toContain('€');
      expect(q('finish-vat')!.querySelector('.text-negative')!.textContent!.trim()).toBe('overdue since 10 Oct');
      renderWithTax('weber-design', {});
      expect(q('finish-vat')!.querySelector('.text-negative')).toBeNull();
    });

    it('names a date for a business switched to VAT that has no sample amount', () => {
      renderWithTax('sara-yoga', { kleinunternehmer: false, vatPeriod: 'monthly', vatBasis: 'ist' });
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Nov');
    });

    it('is left out for a yearly return', () => {
      renderWithTax('weber-design', { vatPeriod: 'yearly' });
      expect(q('finish-title')).not.toBeNull();
      expect(q('finish-vat')).toBeNull();
    });

    it('is left out for a business that turns into a Kleinunternehmer, whatever amount it stores', () => {
      renderWithTax('weber-design', { kleinunternehmer: true, vatPeriod: null, vatBasis: null });
      expect(q('finish-title')).not.toBeNull();
      expect(q('finish-vat')).toBeNull();
    });

    it('follows the business that is open', () => {
      demo.setBusiness('cafe-linde');
      render();
      expect(text(q('finish-vat'))).toBe(
        `VAT return (UStVA) · overdue since ${formatDate('2026-10-10', 'en')}`,
      );

      demo.setBusiness('sara-yoga');
      fixture.detectChanges();
      expect(q('finish-vat')).toBeNull();
    });
  });

  it('Back says so', () => {
    render();
    q('finish-back')!.click();
    expect(fixture.componentInstance.backs).toBe(1);
  });

  it('reads in German and Arabic', () => {
    answerAll({ 1: 'receipt' });
    render();

    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(q('finish-title'))).toBe(
      'Alles erledigt — deine Buchhaltung ist auf dem neuesten Stand',
    );
    expect(text(q('finish-summary'))).toBe('6 Entscheidungen · 1 Beleg hinzugefügt');
    expect(text(q('finish-vat'))).toBe(
      `UStVA · als Nächstes fällig am ${formatDate('2026-11-10', 'de')}`,
    );
    expect(text(q('finish-back'))).toBe('Zurück');

    TestBed.inject(LanguageService).setLang('ar');
    fixture.detectChanges();
    expect(text(q('finish-back'))).toBe('رجوع');
    expect(text(q('finish-vat'))).toBe(
      `إقرار ضريبة القيمة المضافة (UStVA) · الموعد القادم: ${formatDate('2026-11-10', 'ar')}`,
    );
    expect(text(q('finish-summary'))).toContain('6 قرارات');
  });

  it('says a late return in German and Arabic', () => {
    demo.setBusiness('cafe-linde');
    render();

    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(q('finish-vat'))).toBe(`UStVA · überfällig seit ${formatDate('2026-10-10', 'de')}`);

    TestBed.inject(LanguageService).setLang('ar');
    fixture.detectChanges();
    expect(text(q('finish-vat'))).toBe(
      `إقرار ضريبة القيمة المضافة (UStVA) · متأخر منذ ${formatDate('2026-10-10', 'ar')}`,
    );
  });

  it('draws the check without a bounce when the person asked for less motion', () => {
    render();
    const check = q('finish-check')!;
    expect(check.classList).toContain('motion-reduce:transition-none');
    expect(check.classList).toContain('starting:scale-20');
  });
});
