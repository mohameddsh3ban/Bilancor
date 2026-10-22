import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { confirmBooking } from '../domain/payment-actions';
import { DemoStateService } from '../state/demo-state.service';
import { ReviewService, UNDO_MS, type ReviewAnswerResult } from '../state/review.service';
import { ReviewCard, SAVING_MS, TICK_MS } from './review-card';
import { SLIDE_MS } from './review-stage';
import { settleItem } from './review-testing';

/** The text of the answer the tests give ("Booked"). */
const BOOKED = 'home.status.booked';
/** From the click on an answer to the moment the card is let go. */
const TICKED = SAVING_MS + TICK_MS;

describe('ReviewPage', () => {
  let demo: DemoStateService;
  let review: ReviewService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let originalMatchMedia: PropertyDescriptor | undefined;

  beforeEach(() => {
    localStorage.clear();
    originalMatchMedia = Object.getOwnPropertyDescriptor(window, 'matchMedia');
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes)],
    });
    demo = TestBed.inject(DemoStateService);
    // The shell's "Needs you" button starts the session early; here the test does.
    review = TestBed.inject(ReviewService);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalMatchMedia) Object.defineProperty(window, 'matchMedia', originalMatchMedia);
    else delete (window as { matchMedia?: unknown }).matchMedia;
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** jsdom has no media queries; this is a screen where the person asked for less motion (or did not). */
  function reducedMotion(reduced: boolean): void {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: (query: string) => ({
        matches: reduced && query === '(prefers-reduced-motion: reduce)',
        media: query,
      }),
    });
  }

  async function render(url = '/review'): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
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
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const name = () => text(q('card-name'));
  const host = () => q('review-card-host');
  const classes = (node: Element | null) => Array.from(node?.classList ?? []);

  /** The card frame that is on screen, to ask for its tick the way a card does. */
  const frame = (): ReviewCard =>
    harness.fixture.debugElement.query(By.directive(ReviewCard)).componentInstance;

  /**
   * Answers the current card the way a real card does: the answer changes the data, and the frame shows its tick in the
   * same breath.
   */
  function answer(counts?: ReviewAnswerResult['counts']): void {
    const item = review.current()!;
    void review.answer(() => settleItem(demo, item), { labelKey: BOOKED, counts });
    frame().showTick(BOOKED);
    harness.detectChanges();
  }

  /** Answers a card and waits until the next one has slid in. */
  function answerAndWait(counts?: ReviewAnswerResult['counts']): void {
    answer(counts);
    play(TICKED);
    play(SLIDE_MS);
  }

  describe('the layer', () => {
    it('opening /review shows the first card directly', async () => {
      await render();

      expect(el.querySelector('main app-review-page')).not.toBeNull();
      const layer = q('review-layer')!;
      expect(classes(layer)).toEqual(expect.arrayContaining(['fixed', 'inset-0', 'z-50']));
      expect(text(q('card-kind'))).toBe('Payment · what was this for?');
      expect(name()).toBe('Amazon');
      expect(text(q('card-amount'))).toBe(formatMoney(-2390, 'en', { signed: true }));
      expect(text(q('card-date'))).toBe(formatDate('2026-10-02', 'en'));
      expect(q('review-finish')).toBeNull();
      // Nothing slides in for the first card.
      expect(classes(host()).some((c) => c.includes('translate') || c.includes('opacity-0'))).toBe(
        false,
      );
    });

    it('covers the app on a phone and dims it behind a centred column on a computer', async () => {
      await render();
      const layer = q('review-layer')!;
      expect(classes(layer)).toEqual(expect.arrayContaining(['bg-surface', 'lg:bg-foreground/40']));
      expect(classes(q('review-column'))).toEqual(expect.arrayContaining(['lg:max-w-md']));
    });

    it('is a dialog with a name, and the focus goes into it', async () => {
      await render();
      const layer = q('review-layer')!;
      expect(layer.getAttribute('role')).toBe('dialog');
      expect(layer.getAttribute('aria-modal')).toBe('true');
      expect(layer.getAttribute('aria-label')).toBe('Review your decisions');
      expect(document.activeElement).toBe(layer);
    });

    it('takes the focus back when the card that had it is gone', async () => {
      await render();
      vi.useFakeTimers();
      const skip = q('card-skip')!;
      skip.focus();
      expect(document.activeElement).toBe(skip);

      skip.click();
      harness.detectChanges();
      play(SLIDE_MS);

      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(document.activeElement).toBe(q('review-layer'));
    });

    const barValue = () => el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow');

    it('progress reads 1 of 6 for weber-design', async () => {
      await render();

      expect(demo.business().id).toBe('weber-design');
      expect(text(q('review-meta'))).toBe('1 of 6 · about 6 min left');
      expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-label')).toBe('Progress');
    });

    it('the bar is empty at the start and fills with the answers given, not the card number', async () => {
      await render();
      vi.useFakeTimers();
      expect(barValue()).toBe('0');

      const values = [barValue()];
      for (let i = 0; i < 6; i++) {
        answerAndWait();
        values.push(barValue());
      }
      // The text says which card it is on; the bar says how much is done.
      expect(values).toEqual(['0', '17', '33', '50', '67', '83', '100']);
    });

    it('the bar moves when the answer is given, while its card still shows the tick', async () => {
      await render();
      vi.useFakeTimers();

      answer();
      expect(barValue()).toBe('17');
      expect(name()).toBe('Amazon');
    });

    it('the bar is full when there is nothing to review', async () => {
      demo.setBusiness('cafe-linde');
      await render();
      expect(barValue()).toBe('100');
    });
  });

  describe('closing', () => {
    it('close returns to the page you came from', async () => {
      harness = await RouterTestingHarness.create('/payments');
      await harness.navigateByUrl('/review');
      el = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();
      expect(TestBed.inject(Router).url).toBe('/review');

      const close = q('review-close')!;
      expect(close.getAttribute('aria-label')).toBe('Close');
      close.click();
      await settle();

      expect(TestBed.inject(Router).url).toBe('/payments');
      expect(q('review-layer')).toBeNull();
    });

    describe('while an answer is being made (a photo being read)', () => {
      beforeEach(async () => {
        harness = await RouterTestingHarness.create('/documents');
        await harness.navigateByUrl('/review');
        el = harness.routeNativeElement as HTMLElement;
        harness.detectChanges();
        void review.answer(() => new Promise<void>(() => undefined), { labelKey: BOOKED });
        harness.detectChanges();
      });

      it('close is disabled and does nothing', async () => {
        const close = q('review-close')!;
        expect(review.pending()).toBe(true);
        expect(close.hasAttribute('disabled')).toBe(true);

        close.click();
        await settle();
        expect(TestBed.inject(Router).url).toBe('/review');
      });

      it('Escape does nothing either', async () => {
        q('review-layer')!.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
        );
        await settle();
        expect(TestBed.inject(Router).url).toBe('/review');
      });
    });

    it('close is enabled when nothing is going on', async () => {
      await render();
      expect(q('review-close')!.hasAttribute('disabled')).toBe(false);
    });

    it('goes home when there was no page before', async () => {
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [provideTranslocoTesting(), provideRouter(routes)],
      });
      TestBed.inject(ReviewService);
      await render();

      q('review-close')!.click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/');
    });

    it('Escape closes it too', async () => {
      harness = await RouterTestingHarness.create('/documents');
      await harness.navigateByUrl('/review');
      el = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();

      q('review-layer')!.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
      await settle();

      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('keeps what was answered for the next time it opens', async () => {
      harness = await RouterTestingHarness.create('/payments');
      await harness.navigateByUrl('/review');
      el = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();
      vi.useFakeTimers();
      answerAndWait();
      vi.useRealTimers();

      q('review-close')!.click();
      await settle();
      await harness.navigateByUrl('/review');
      el = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();

      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(text(q('review-meta'))).toBe('2 of 6 · about 5 min left');
    });
  });

  describe('answering', () => {
    beforeEach(async () => {
      await render();
      vi.useFakeTimers();
    });

    it('keeps the card on screen with Saving…, then the tick and the result, and lets it go after that', () => {
      answer();

      // The data has moved on, the card has not.
      expect(review.current()!.id).toBe('wd-t17');
      expect(name()).toBe('Amazon');
      expect(text(q('card-tick'))).toBe('Saving…');

      play(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Booked');
      expect(name()).toBe('Amazon');
      expect(classes(host())).not.toContain('opacity-0');

      play(TICK_MS - 1);
      expect(name()).toBe('Amazon');
      expect(classes(host())).not.toContain('opacity-0');
    });

    it('then slides it out, and the next card in, in 300 ms each', () => {
      answer();
      play(TICKED);
      const first = host()!;

      expect(SLIDE_MS).toBe(300);
      expect(classes(first)).toEqual(expect.arrayContaining(['-translate-x-[110%]', 'opacity-0']));
      expect(first.getAttribute('inert')).toBe('');
      expect(q('tick-check')).not.toBeNull(); // the card slides away with its result on it
      play(SLIDE_MS - 1);
      expect(name()).toBe('Amazon');

      play(1);
      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(host()).not.toBe(first);
      expect(host()!.hasAttribute('inert')).toBe(false);
      expect(classes(host())).toEqual(
        expect.arrayContaining(['starting:translate-x-[110%]', 'starting:opacity-0']),
      );
      expect(classes(host())).not.toContain('opacity-0');
      expect(q('card-tick')).toBeNull();
    });

    it('each animation stays under half a second and has a reduced-motion switch', () => {
      expect(SLIDE_MS).toBeLessThanOrEqual(500);
      expect(SAVING_MS + TICK_MS).toBeLessThanOrEqual(500);
      const wrapper = host()!;
      expect(classes(wrapper)).toEqual(
        expect.arrayContaining(['duration-300', 'motion-reduce:transition-none']),
      );
    });

    it('a card with a next problem stays where it is and asks its next question in place', () => {
      // wd-t3 needs a confirmation as well as a receipt.
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
      answerAndWait();
      answerAndWait();
      answerAndWait();
      expect(name()).toBe('Deutsche Bahn');
      expect(text(q('card-kind'))).toBe('Payment · please confirm');
      const card = host()!;

      const item = review.current()!;
      void review.answer(() => demo.updateTransaction(item.id, confirmBooking), {
        labelKey: BOOKED,
      });
      frame().showTick(BOOKED);
      harness.detectChanges();
      expect(review.current()).toMatchObject({ id: 'wd-t3', problem: 'noReceipt' });
      expect(text(q('card-kind'))).toBe('Payment · please confirm'); // still the first question under the tick

      play(TICKED);

      expect(host()).toBe(card); // the same card, no slide
      expect(classes(host())).not.toContain('opacity-0');
      expect(
        classes(host()).some((c) => c.includes('translate-x') && !c.startsWith('starting:')),
      ).toBe(false);
      expect(text(q('card-kind'))).toBe('Payment · receipt missing');
      expect(q('card-tick')).toBeNull();
      expect(name()).toBe('Deutsche Bahn');
      // It counts as one card, so the progress did not move.
      expect(text(q('review-meta'))).toBe('4 of 6 · about 3 min left');
    });

    it('Skip for now slides the card away and brings the next one in; the skipped one comes back last', () => {
      q('card-skip')!.click();
      harness.detectChanges();

      expect(classes(host())).toContain('opacity-0');
      expect(host()!.getAttribute('inert')).toBe('');
      play(SLIDE_MS);
      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(text(q('review-meta'))).toBe('1 of 6 · about 6 min left');

      for (let i = 0; i < 5; i++) answerAndWait();
      expect(name()).toBe('Amazon');
      expect(review.current()!.id).toBe('wd-t18');
    });

    it('nothing in the card can be used while it slides away', () => {
      answer();
      play(TICKED);

      expect(host()!.getAttribute('inert')).toBe('');
      expect(q('card-content')!.getAttribute('inert')).toBe('');
    });
  });

  describe('Undo', () => {
    beforeEach(async () => {
      await render();
      vi.useFakeTimers();
    });

    it('undo toast appears after an answer and undo brings the card back', () => {
      expect(q('undo-toast')).toBeNull();

      answerAndWait();
      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(text(q('undo-text'))).toBe('Booked');
      expect(text(q('undo-button'))).toBe('Undo');
      expect(q('undo-toast')!.closest('[role="status"]')).not.toBeNull(); // announced when it shows
      expect(classes(q('undo-toast'))).toContain('starting:translate-y-4');

      q('undo-button')!.click();
      harness.detectChanges();
      play(SLIDE_MS);

      expect(q('undo-toast')).toBeNull();
      expect(review.current()!.id).toBe('wd-t18');
      expect(name()).toBe('Amazon');
      expect(text(q('review-meta'))).toBe('1 of 6 · about 6 min left');
    });

    it('goes away after 5 seconds', () => {
      answerAndWait();
      expect(q('undo-toast')).not.toBeNull();

      play(UNDO_MS);
      expect(q('undo-toast')).toBeNull();
    });

    it('can be used while the tick is still showing, and the card stays', () => {
      answer();
      expect(q('undo-toast')).not.toBeNull();

      q('undo-button')!.click();
      harness.detectChanges();
      const card = host()!;
      play(TICKED);

      expect(host()).toBe(card);
      expect(name()).toBe('Amazon');
      expect(q('card-tick')).toBeNull();
      expect(review.current()!.id).toBe('wd-t18');
    });

    it('the card that comes back slides in from the other side, even if undo came while the last one left', () => {
      answer();
      play(TICKED); // the card is sliding out
      q('undo-button')!.click();
      harness.detectChanges();
      play(SLIDE_MS);

      expect(name()).toBe('Amazon');
      expect(q('card-tick')).toBeNull();
      expect(classes(host())).toContain('starting:translate-x-[110%]');
    });

    it('is not offered while a photo is being read', () => {
      answerAndWait();
      expect(q('undo-button')!.hasAttribute('disabled')).toBe(false);

      void review.answer(() => new Promise<void>(() => undefined), { labelKey: BOOKED });
      harness.detectChanges();
      expect(q('undo-button')!.hasAttribute('disabled')).toBe(true);
    });
  });

  describe('the finish screen', () => {
    it('a business without anything to review opens on the finish screen', async () => {
      demo.setBusiness('cafe-linde');
      await render();

      expect(q('review-card')).toBeNull();
      expect(q('review-finish')).not.toBeNull();
    });

    it('finish shows after the last answer with the summary and VAT line', async () => {
      await render();
      vi.useFakeTimers();

      for (let i = 0; i < 5; i++) answerAndWait(i === 1 ? 'receipt' : undefined);
      expect(q('review-finish')).toBeNull();
      expect(name()).toBe('Bürobedarf Schulz');

      answer('duplicateRemoved');
      play(TICKED);
      expect(q('review-finish')).toBeNull(); // the last card is still on its way out
      play(SLIDE_MS);

      expect(q('review-card')).toBeNull();
      expect(text(q('finish-title'))).toBe('All done — your books are up to date');
      expect(text(q('finish-summary'))).toBe('6 decisions · 1 receipt added · 1 duplicate removed');
      expect(text(q('finish-vat'))).toBe('VAT return (UStVA) · next due 10 Nov');
      expect(q('review-meta')).toBeNull();
      expect(el.querySelector('[role="progressbar"]')!.getAttribute('aria-valuenow')).toBe('100');
    });

    it('Back goes to the page the person came from', async () => {
      reducedMotion(true);
      harness = await RouterTestingHarness.create('/documents');
      await harness.navigateByUrl('/review');
      el = harness.routeNativeElement as HTMLElement;
      harness.detectChanges();
      for (let item = review.current(); item !== null; item = review.current()) {
        settleItem(demo, item);
      }
      harness.detectChanges();

      expect(q('review-finish')).not.toBeNull();
      q('finish-back')!.click();
      await settle();
      expect(TestBed.inject(Router).url).toBe('/documents');
    });

    it('Undo from the finish screen brings the last card back', async () => {
      await render();
      vi.useFakeTimers();
      for (let i = 0; i < 6; i++) answerAndWait();
      expect(q('review-finish')).not.toBeNull();
      expect(q('undo-toast')).not.toBeNull();

      q('undo-button')!.click();
      harness.detectChanges();

      expect(q('review-finish')).toBeNull();
      expect(review.current()!.kind).toBe('document');
      expect(q('review-card')).not.toBeNull();
      expect(classes(host())).toContain('starting:translate-x-[110%]');
    });
  });

  describe('switching business while reviewing', () => {
    it('switching business while reviewing restarts the queue for that business', async () => {
      await render();
      vi.useFakeTimers();
      answerAndWait();
      expect(text(q('review-meta'))).toBe('2 of 6 · about 5 min left');

      demo.setBusiness('sara-yoga');
      harness.detectChanges();
      play(SLIDE_MS);

      expect(name()).toBe('Druckerei Kiezdruck');
      expect(text(q('review-meta'))).toBe(
        `1 of ${review.total()} · about ${review.minutesLeft()} min left`,
      );
      expect(review.answered()).toBe(0);
      expect(q('undo-toast')).toBeNull();
    });

    it('goes to the finish screen when the other business has nothing to review', async () => {
      await render();
      vi.useFakeTimers();

      demo.setBusiness('cafe-linde');
      harness.detectChanges();
      play(SLIDE_MS);

      expect(q('review-card')).toBeNull();
      expect(q('review-finish')).not.toBeNull();
    });

    it('reset demo while reviewing starts over', async () => {
      await render();
      vi.useFakeTimers();
      answerAndWait();
      expect(name()).toBe('SCHREIBWAREN BOETTCHER');

      demo.resetData();
      harness.detectChanges();
      play(SLIDE_MS);

      expect(name()).toBe('Amazon');
      expect(text(q('review-meta'))).toBe('1 of 6 · about 6 min left');
    });
  });

  describe('motion', () => {
    it('reduced motion swaps cards without sliding', async () => {
      reducedMotion(true);
      await render();
      vi.useFakeTimers();

      answer();
      expect(text(q('card-tick'))).toBe('Saving…'); // the tick is still shown for its time
      play(TICKED);

      // No leave delay: the next card is there at once, with nothing to slide in from.
      expect(name()).toBe('SCHREIBWAREN BOETTCHER');
      expect(classes(host()).some((c) => c.includes('translate') || c.includes('opacity-0'))).toBe(
        false,
      );

      q('card-skip')!.click();
      harness.detectChanges();
      expect(name()).toBe('Amazon'); // wd-t4
      expect(review.current()!.id).toBe('wd-t4');
      expect(classes(host()).some((c) => c.includes('translate') || c.includes('opacity-0'))).toBe(
        false,
      );
      expect(host()!.hasAttribute('inert')).toBe(false);
    });

    it('with motion on the same steps take their time', async () => {
      reducedMotion(false);
      await render();
      vi.useFakeTimers();

      answer();
      play(TICKED);
      expect(name()).toBe('Amazon');
      expect(classes(host())).toContain('opacity-0');
    });

    it('reduced motion goes straight to the finish screen', async () => {
      reducedMotion(true);
      await render();
      vi.useFakeTimers();

      for (let i = 0; i < 6; i++) {
        answer();
        play(TICKED);
      }
      expect(q('review-card')).toBeNull();
      expect(q('review-finish')).not.toBeNull();
    });
  });

  describe('in Arabic', () => {
    beforeEach(() => {
      TestBed.inject(LanguageService).setLang('ar');
    });

    it('in Arabic the layer is rtl and the slide direction is reversed (class check)', async () => {
      await render();
      vi.useFakeTimers();

      expect(q('review-layer')!.getAttribute('dir')).toBe('rtl');
      expect(text(q('card-kind'))).toBe('دفعة · لماذا كانت؟');

      answer();
      play(TICKED);
      // The card leaves to the right and the next one comes from the left.
      expect(classes(host())).toContain('translate-x-[110%]');
      expect(classes(host())).not.toContain('-translate-x-[110%]');

      play(SLIDE_MS);
      expect(classes(host())).toContain('starting:-translate-x-[110%]');
      expect(classes(host())).not.toContain('starting:translate-x-[110%]');
    });

    it('amounts stay left to right', async () => {
      await render();
      expect(q('card-amount')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(q('review-meta'))).toBe('1 من 6 · متبقي نحو 6 د');
    });

    it('English goes the other way', async () => {
      TestBed.inject(LanguageService).setLang('en');
      await render();
      vi.useFakeTimers();

      expect(q('review-layer')!.getAttribute('dir')).toBe('ltr');
      answer();
      play(TICKED);
      expect(classes(host())).toContain('-translate-x-[110%]');
    });
  });
});
