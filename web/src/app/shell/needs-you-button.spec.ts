import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { CATEGORIES } from '../data/categories';
import type { Doc } from '../data/models';
import { settleItem } from '../review/review-testing';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService } from '../state/review.service';
import { NeedsYouButton } from './needs-you-button';

describe('NeedsYouButton', () => {
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

  function render() {
    const fixture = TestBed.createComponent(NeedsYouButton);
    fixture.detectChanges();
    return fixture;
  }

  const button = (el: HTMLElement) =>
    el.querySelector<HTMLAnchorElement>('[data-testid="needs-you-button"]');
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

  /** An uploaded document that waits for the person: nothing says whether it was received or sent. */
  const addedDocument = (): Doc => ({
    id: 'up-1',
    fileName: 'beleg.pdf',
    source: 'file',
    addedOn: '2026-10-20',
    fromUpload: true,
    reading: false,
    name: 'Krause & Partner',
    direction: null,
    invoiceNo: 'B-1',
    date: '2026-10-20',
    dueDate: null,
    amountCents: 1000,
    vatRate: 19,
    duplicateOf: null,
    booking: CATEGORIES[0],
    bookingConfirmed: false,
    paymentId: null,
    history: [],
  });

  it('shows "Needs you · 6" for weber-design and links to /review', () => {
    demo.setBusiness('weber-design');
    const el = render().nativeElement as HTMLElement;

    const link = button(el)!;
    expect(text(link)).toBe('Needs you · 6');
    expect(link.tagName).toBe('A');
    expect(link.getAttribute('href')).toBe('/review');
  });

  it('keeps the count left to right inside the text', () => {
    demo.setBusiness('weber-design');
    const link = button(render().nativeElement as HTMLElement)!;

    const count = link.querySelector('bdi');
    expect(count?.getAttribute('dir')).toBe('ltr');
    expect(count?.textContent).toBe('6');
    expect(text(link)).toBe('Needs you · 6');
  });

  it('is at least 40 px tall to tap, and uses the warning colours', () => {
    const link = button(render().nativeElement as HTMLElement)!;
    expect(link.classList).toContain('h-10');
    expect(link.classList).toContain('bg-warning');
    expect(link.classList).toContain('text-warning-foreground');
  });

  it('is hidden at 0 (cafe-linde)', () => {
    demo.setBusiness('cafe-linde');
    const el = render().nativeElement as HTMLElement;

    expect(button(el)).toBeNull();
    expect(text(el)).toBe('');
  });

  it('is shown in halfway when something needs you', () => {
    demo.setBusiness('weber-design');
    demo.setSetup('halfway');
    expect(text(button(render().nativeElement as HTMLElement))).toBe('Needs you · 6');
  });

  it('is hidden in the new-client state, until an added document needs the person', () => {
    demo.setBusiness('weber-design');
    demo.setSetup('new');
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(button(el)).toBeNull();

    demo.addDocument('weber-design', addedDocument());
    fixture.detectChanges();
    expect(text(button(el))).toBe('Needs you · 1');
  });

  it('follows the data: the count drops after an answer', async () => {
    demo.setBusiness('weber-design');
    const review = TestBed.inject(ReviewService);
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(button(el))).toBe('Needs you · 6');

    await review.answer(() => settleItem(demo, review.current()!), {
      labelKey: 'home.status.booked',
    });
    fixture.detectChanges();
    expect(text(button(el))).toBe('Needs you · 5');

    review.undo();
    fixture.detectChanges();
    expect(text(button(el))).toBe('Needs you · 6');
  });

  it('disappears when the last decision is made', () => {
    demo.setBusiness('sara-yoga');
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;
    expect(text(button(el))).toBe('Needs you · 3');

    demo.setBusiness('cafe-linde');
    fixture.detectChanges();
    expect(button(el)).toBeNull();
  });

  it('reads in German and in Arabic', () => {
    demo.setBusiness('weber-design');
    const fixture = render();
    const el = fixture.nativeElement as HTMLElement;

    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(button(el))).toBe('Braucht dich · 6');

    TestBed.inject(LanguageService).setLang('ar');
    fixture.detectChanges();
    expect(text(button(el))).toBe('يحتاج إليك · 6');
    expect(button(el)!.querySelector('bdi')?.getAttribute('dir')).toBe('ltr');
  });
});
