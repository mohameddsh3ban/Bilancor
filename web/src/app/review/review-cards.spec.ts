import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { READING_MS } from '../domain/document-upload';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService } from '../state/review.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { SAVING_MS, TICK_MS, TICK_NOTE_MS } from './review-card';
import { SLIDE_MS } from './review-stage';
import { settleItem } from './review-testing';

/**
 * The cards as the person meets them: on the review page, answered through real taps, with the tick, the slide to the
 * next card and the progress around them. What each card does with the data is in the specs of the cards.
 */
describe('the review cards on the page', () => {
  let demo: DemoStateService;
  let review: ReviewService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    demo = TestBed.inject(DemoStateService);
    review = TestBed.inject(ReviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(): Promise<void> {
    harness = await RouterTestingHarness.create('/payments');
    await harness.navigateByUrl('/review');
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Lets time pass, then draws what the page made of it. */
  function play(ms: number): void {
    vi.advanceTimersByTime(ms);
    harness.detectChanges();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const all = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const name = () => text(q('card-name'));
  const url = () => TestBed.inject(Router).url;

  function click(testId: string): void {
    const node = q(testId);
    expect(node, testId).not.toBeNull();
    node!.click();
    harness.detectChanges();
  }

  /** Lets the tick (with its notes, when it has them) and the slide to the next card go by. */
  function nextCard(tickMs = TICK_MS): void {
    play(SAVING_MS + tickMs);
    play(SLIDE_MS);
  }

  it('all answers keep the card on the review page (no navigation)', async () => {
    await render();
    vi.useFakeTimers();
    const seen: string[] = [];

    // wd-t18: Amazon, what was it for? (the rule books the other Amazon payment too)
    expect(name()).toBe('Amazon');
    click('answer-suggestion');
    nextCard(TICK_NOTE_MS);
    seen.push(url());

    // wd-t17: no receipt needed (wd-t4, the other Amazon payment, is booked already)
    expect(name()).toBe('SCHREIBWAREN BOETTCHER');
    click('answer-no-receipt');
    nextCard();
    seen.push(url());

    // wd-t3: a photo of the receipt
    expect(name()).toBe('Deutsche Bahn');
    click('answer-photo');
    await vi.advanceTimersByTimeAsync(READING_MS);
    harness.detectChanges();
    nextCard();
    seen.push(url());

    // wd-t1: confirm the booking
    expect(name()).toBe('Müller GmbH');
    click('answer-confirm');
    nextCard();
    seen.push(url());

    // wd-d1: type in the amount
    expect(name()).toBe('Bürobedarf Schulz');
    const field = q('field-amount') as HTMLInputElement;
    field.value = '12,50';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
    click('answer-save');
    nextCard();
    seen.push(url());

    // wd-t19: Kern Studio Berlin's payment has no receipt; is it the payment for RE-2026-044? Yes
    expect(name()).toBe('Kern Studio Berlin');
    expect(text(q('card-question'))).toBe(
      'Is this the payment for invoice RE-2026-044 from Studio Kern?',
    );
    click('answer-invoice-yes');
    nextCard();
    seen.push(url());

    expect(seen).toEqual(['/review', '/review', '/review', '/review', '/review', '/review']);
    expect(url()).toBe('/review');
    expect(q('review-card')).toBeNull();
    // The photo and the invoice are the two receipts added.
    expect(text(q('finish-summary'))).toBe('6 decisions · 2 receipts added');
    expect(demo.business().invoices.find((i) => i.id === 'inv-wd-044')!.paymentIds).toEqual(['wd-t19']);
  });

  it("the invoice question stays on the card while its answer shows, until the card slides away", async () => {
    // Settle what is in front of the Kern payment, so it is the card on the page (and the last one).
    for (
      let item = review.current();
      item !== null && item.id !== 'wd-t19';
      item = review.current()
    ) {
      settleItem(demo, item);
    }
    await render();
    vi.useFakeTimers();
    const question = 'Is this the payment for invoice RE-2026-044 from Studio Kern?';
    const card = q('review-card-host')!;
    expect(text(q('card-question'))).toBe(question);

    click('answer-invoice-yes');
    play(SAVING_MS);

    // The payment is linked to the invoice now, but the card still shows what it was asked and answered.
    expect(text(q('tick-text'))).toBe('Invoice paid');
    expect(q('review-card-host')).toBe(card);
    expect(text(q('card-question'))).toBe(question);
    expect(text(q('answer-invoice-yes'))).toBe('Yes');
    expect(text(q('pick-document'))).toBe('Pick another');
    expect(q('answer-photo')).toBeNull();

    play(TICK_MS); // the card slides out with its tick still up
    expect(text(q('card-question'))).toBe(question);
    expect(q('answer-photo')).toBeNull();
    play(SLIDE_MS);
    expect(q('review-finish')).not.toBeNull();
  });

  it('learning shows under the tick, the other Amazon payment leaves the queue, and the card slides on', async () => {
    await render();
    vi.useFakeTimers();
    expect(text(q('review-meta'))).toBe('1 of 7 · about 7 min left');

    click('answer-suggestion');
    play(SAVING_MS);

    expect(text(q('card-tick'))).toContain(
      'Got it — Amazon will be booked as Office supplies automatically from now on.',
    );
    expect(text(q('card-tick'))).toContain('…and 1 more Amazon payment booked.');
    // The other Amazon payment (wd-t4) was booked by the rule, so it is not a decision any more.
    expect(review.total()).toBe(6);
    expect(review.current()!.id).toBe('wd-t17');
    expect(name()).toBe('Amazon'); // the card is held for the tick, then slides away
    play(TICK_NOTE_MS - TICK_MS + TICK_MS); // the tick has time to be read
    play(SLIDE_MS);
    expect(name()).toBe('SCHREIBWAREN BOETTCHER');
  });

  it('a payment with two problems stays on one card and asks the second question in place', async () => {
    demo.unlink('doc-wd-t18'); // wd-t18 is unclear and has no receipt now
    await render();
    vi.useFakeTimers();
    const card = q('review-card-host')!;
    expect(name()).toBe('Amazon');
    expect(text(q('card-question'))).toBe('What was this for?');
    expect(text(q('review-meta'))).toBe('1 of 7 · about 7 min left');

    click('answer-suggestion');
    play(SAVING_MS + TICK_NOTE_MS);

    // The same card, no slide; it asks about the receipt now.
    expect(q('review-card-host')).toBe(card);
    expect(name()).toBe('Amazon');
    expect(text(q('card-kind'))).toBe('Payment · receipt missing');
    expect(text(q('card-question'))).toBe("There's no receipt for this payment yet.");
    expect(q('card-tick')).toBeNull();
    expect(review.answered()).toBe(0); // one card: counted when it is done

    click('answer-no-receipt');
    nextCard();

    expect(review.answered()).toBe(1);
    expect(name()).toBe('SCHREIBWAREN BOETTCHER');
  });

  it('a document with two problems stays on one card too, and what was typed is not carried over', async () => {
    demo.updateDocument('wd-d1', (d) => ({ ...d, direction: null })); // no direction, and no amount
    // Settle the payments in front of it, and the one behind it (Kern Studio Berlin's), so the document is the one decision.
    for (
      let item = review.current();
      item !== null && item.id !== 'wd-d1';
      item = review.current()
    ) {
      settleItem(demo, item);
    }
    settleItem(demo, { kind: 'payment', id: 'wd-t19', date: '2026-10-21', problem: 'noReceipt' });
    await render();
    vi.useFakeTimers();
    const card = q('review-card-host')!;
    expect(text(q('card-kind'))).toBe('Document · type unknown');
    expect(text(q('review-meta'))).toBe('1 of 1 · about 1 min left');

    click('answer-received');
    play(SAVING_MS + TICK_MS);

    expect(q('review-card-host')).toBe(card);
    expect(text(q('card-kind'))).toBe('Document · check the amount');
    expect(text(q('card-question'))).toBe("We couldn't read the amount.");
    expect((q('field-amount') as HTMLInputElement).value).toBe('');
    expect(q('document-paper')).not.toBeNull();
    expect(review.answered()).toBe(0);

    const field = q('field-amount') as HTMLInputElement;
    field.value = '12,50';
    field.dispatchEvent(new Event('input'));
    harness.detectChanges();
    click('answer-save');
    nextCard();

    expect(review.answered()).toBe(1);
    expect(q('review-finish')).not.toBeNull();
  });

  it('Other category… opens the list over the card, and Escape in it closes only the list', async () => {
    await render();
    click('change-category');
    await settle();
    const search = document.body.querySelector<HTMLInputElement>('[data-testid="category-search"]');
    expect(search).not.toBeNull();

    search!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await settle();

    expect(document.body.querySelector('[data-testid="category-search"]')).toBeNull();
    expect(url()).toBe('/review');
    expect(q('review-layer')).not.toBeNull();
    expect(name()).toBe('Amazon');
  });

  it('Escape on the button that opened the list closes only the list as well', async () => {
    await render();
    const trigger = q('change-category')!;
    trigger.focus();
    click('change-category');
    await settle();
    expect(document.body.querySelector('[data-testid="category-search"]')).not.toBeNull();

    trigger.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    );
    await settle();

    expect(document.body.querySelector('[data-testid="category-search"]')).toBeNull();
    expect(url()).toBe('/review');
    expect(q('review-layer')).not.toBeNull();
  });

  it('Escape closes the page once no list is open', async () => {
    await render();
    TestBed.inject(Router).initialNavigation(); // the router follows the browser's history, as in the app
    q('review-layer')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await new Promise((resolve) => setTimeout(resolve)); // the step back in history arrives a moment later
    await settle();
    expect(url()).toBe('/payments');
  });

  it('choosing from the list answers the card and slides on', async () => {
    await render();
    click('change-category');
    await settle();
    const travel = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-testid="category-option"]'),
    ).find((option) => text(option).startsWith('Travel'))!;
    vi.useFakeTimers();
    travel.click();
    harness.detectChanges();

    expect(demo.business().categoryRules).toEqual([
      { counterpartyKey: 'amazon', booking: expect.objectContaining({ labelKey: 'travel' }) },
    ]);
    nextCard(TICK_NOTE_MS);
    expect(name()).toBe('SCHREIBWAREN BOETTCHER');
    expect(url()).toBe('/review');
  });

  it('the card cannot be closed or skipped while a photo is being read, and the way out is open after', async () => {
    await render();
    vi.useFakeTimers();
    review.skip();
    play(SLIDE_MS);
    review.skip();
    play(SLIDE_MS);
    review.skip();
    play(SLIDE_MS);
    expect(name()).toBe('Deutsche Bahn');

    click('answer-photo');
    expect(q('review-close')!.hasAttribute('disabled')).toBe(true);
    expect(text(q('answer-photo'))).toBe('Reading…');

    await vi.advanceTimersByTimeAsync(READING_MS);
    harness.detectChanges();
    expect(q('review-close')!.hasAttribute('disabled')).toBe(false);
    expect(text(q('card-tick'))).toContain('Saving');
  });

  it('works in Arabic: right to left, the name set apart in the learned line', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render();
    vi.useFakeTimers();
    expect(q('review-layer')!.getAttribute('dir')).toBe('rtl');
    expect(text(q('card-question'))).toBe('ما سبب هذه الدفعة؟');

    click('answer-suggestion');
    play(SAVING_MS);

    const note = all('tick-note').map(text)[0];
    expect(note).toBe('تم — سيتم ترحيل ⁨Amazon⁩ تلقائيًا كـ مستلزمات مكتبية من الآن فصاعدًا.');
    expect(text(q('tick-text'))).toBe('تم الترحيل');
    expect(demo.business().categoryRules[0].booking.labelKey).toBe('office');
  });
});
