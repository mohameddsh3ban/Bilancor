import { Component, signal, viewChild } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { ReviewService } from '../state/review.service';
import { ReviewCard, SAVING_MS, TICK_MS, TICK_NOTE_MS, type TickNote } from './review-card';
import { ReviewStage } from './review-stage';

@Component({
  imports: [ReviewCard],
  template: `
    <app-review-card
      kindKey="review.kind.confirm"
      [amountCents]="amount()"
      [signed]="signed()"
      [name]="name()"
      [date]="date()"
    >
      <p data-testid="question">Is that right?</p>
      <button type="button" data-testid="answer">Yes</button>
    </app-review-card>
  `,
})
class Host {
  readonly frame = viewChild.required(ReviewCard);
  readonly amount = signal<number | null>(-12000);
  readonly signed = signal(true);
  readonly name = signal('Deutsche Bahn');
  readonly date = signal<string | null>('2026-10-17');
}

/** What the card needs from the review session; `total` and `answered` say how many cards are left. */
function fakeReview(left = 3) {
  return {
    skip: vi.fn(),
    pending: signal(false),
    answered: signal(0),
    total: signal(left),
  };
}

describe('ReviewCard', () => {
  let fixture: ComponentFixture<Host>;
  let host: Host;
  let review: ReturnType<typeof fakeReview>;
  let el: HTMLElement;

  function setUp(providers: object[] = []): void {
    localStorage.clear();
    review = fakeReview();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        { provide: ReviewService, useValue: review },
        ...providers,
      ],
    });
    fixture = TestBed.createComponent(Host);
    host = fixture.componentInstance;
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  }

  afterEach(() => {
    vi.useRealTimers();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const text = (node: Element | null) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** The part of the card with the question and the answers: this is what Skip and a tick lock. */
  const content = () => q('question')!.closest<HTMLElement>('[data-testid="card-content"]')!;
  const locked = () => content().hasAttribute('inert');

  describe('what it shows', () => {
    beforeEach(() => setUp());

    it('shows what the card is, who, when, and the projected question and answers', () => {
      expect(text(q('card-kind'))).toBe('Payment · please confirm');
      expect(text(q('card-name'))).toBe('Deutsche Bahn');
      expect(text(q('card-date'))).toBe(formatDate('2026-10-17', 'en'));
      expect(text(q('question'))).toBe('Is that right?');
      expect(text(q('answer'))).toBe('Yes');
    });

    it('shows a payment amount with its sign and colour, left to right', () => {
      const amount = q('card-amount')!;
      expect(text(amount)).toBe(formatMoney(-12000, 'en', { signed: true }));
      expect(amount.classList).toContain('text-negative');
      expect(amount.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');

      host.amount.set(150000);
      fixture.detectChanges();
      expect(text(q('card-amount'))).toBe(formatMoney(150000, 'en', { signed: true }));
      expect(q('card-amount')!.classList).toContain('text-positive');
    });

    it('shows a document amount plain', () => {
      host.signed.set(false);
      host.amount.set(5949);
      fixture.detectChanges();

      const amount = q('card-amount')!;
      expect(text(amount)).toBe(formatMoney(5949, 'en'));
      expect(amount.classList).not.toContain('text-positive');
      expect(amount.classList).not.toContain('text-negative');
    });

    it('leaves out an amount or a date that is not known', () => {
      host.amount.set(null);
      host.date.set(null);
      fixture.detectChanges();

      expect(q('card-amount')).toBeNull();
      expect(q('card-date')).toBeNull();
    });

    it('shows the name as the text it is, truncated, in its own direction', () => {
      const name = q('card-name')!;
      expect(name.getAttribute('dir')).toBe('auto');
      expect(name.classList).toContain('truncate');
    });

    it('is not locked while nothing happens', () => {
      expect(locked()).toBe(false);
      expect(q('card-tick')).toBeNull();
    });
  });

  describe('Skip for now', () => {
    it('moves the card to the end of the queue', () => {
      setUp();
      const skip = q('card-skip')!;
      expect(text(skip)).toBe('Skip for now');

      skip.click();
      expect(review.skip).toHaveBeenCalledTimes(1);
    });

    it('is not offered when this is the only card left, but keeps its space so the card does not shrink', () => {
      setUp();
      const hidden = () => q('card-skip')!.classList.contains('invisible');
      expect(hidden()).toBe(false);

      review.total.set(1);
      fixture.detectChanges();
      expect(q('card-skip')).not.toBeNull();
      expect(hidden()).toBe(true);

      review.total.set(3);
      review.answered.set(2);
      fixture.detectChanges();
      expect(hidden()).toBe(true);

      review.answered.set(1);
      fixture.detectChanges();
      expect(hidden()).toBe(false);
    });
  });

  describe('while an answer is being made (pending)', () => {
    it('locks the question, the answers and Skip, and says it is busy', () => {
      setUp();
      review.pending.set(true);
      fixture.detectChanges();

      expect(locked()).toBe(true);
      expect(content().contains(q('answer'))).toBe(true);
      expect(content().contains(q('card-skip'))).toBe(true);
      expect(q('review-card')!.getAttribute('aria-busy')).toBe('true');

      review.pending.set(false);
      fixture.detectChanges();
      expect(locked()).toBe(false);
      expect(q('review-card')!.hasAttribute('aria-busy')).toBe(false);
    });
  });

  describe('showTick', () => {
    beforeEach(() => {
      setUp();
      vi.useFakeTimers();
    });

    const tick = () => q('card-tick');
    const advance = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };

    it('shows Saving… first, then the tick with the result', () => {
      host.frame().showTick('review.kind.duplicate');
      fixture.detectChanges();

      expect(text(tick())).toBe('Saving…');
      expect(q('tick-check')).toBeNull();

      advance(SAVING_MS - 1);
      expect(text(tick())).toBe('Saving…');
      advance(1);

      expect(q('tick-check')).not.toBeNull();
      expect(text(q('tick-text'))).toBe('Document · possible duplicate');
    });

    it('translates the result with its values', () => {
      host.frame().showTick('review.finish.decisions.many', { count: '4' });
      advance(SAVING_MS);
      expect(text(q('tick-text'))).toBe('4 decisions');
    });

    it('is announced to screen readers and the check itself is only a picture', () => {
      host.frame().showTick('review.kind.confirm');
      fixture.detectChanges();
      expect(tick()!.getAttribute('role')).toBe('status');

      advance(SAVING_MS);
      expect(q('tick-check')!.getAttribute('aria-hidden')).toBe('true');
    });

    it('locks the question and the answers while it shows, so a second answer cannot be given', () => {
      host.frame().showTick('review.kind.confirm');
      fixture.detectChanges();
      expect(locked()).toBe(true);
      advance(SAVING_MS);
      expect(locked()).toBe(true);
    });

    it('goes away after the tick has been shown for TICK_MS when nothing else holds the card', () => {
      host.frame().showTick('review.kind.confirm');
      advance(SAVING_MS + TICK_MS - 1);
      expect(tick()).not.toBeNull();
      advance(1);

      expect(tick()).toBeNull();
      expect(locked()).toBe(false);
    });

    it('shows notes under the result, and stays longer so they can be read', () => {
      const notes: TickNote[] = [
        { key: 'review.finish.receipts.many', params: { count: '2' } },
        { key: 'review.finish.duplicates.one' },
      ];
      host.frame().showTick('review.kind.confirm', {}, notes);
      advance(SAVING_MS);

      const lines = Array.from(el.querySelectorAll('[data-testid="tick-note"]')).map(text);
      expect(lines).toEqual(['2 receipts added', '1 duplicate removed']);

      advance(TICK_MS);
      expect(tick()).not.toBeNull();
      advance(TICK_NOTE_MS - TICK_MS);
      expect(tick()).toBeNull();
    });

    it('showing another tick starts again', () => {
      host.frame().showTick('review.kind.confirm');
      advance(SAVING_MS);
      host.frame().showTick('review.kind.duplicate');
      fixture.detectChanges();

      expect(text(tick())).toBe('Saving…');
      advance(SAVING_MS);
      expect(text(q('tick-text'))).toBe('Document · possible duplicate');
      advance(TICK_MS);
      expect(tick()).toBeNull();
    });

    it('is cleared when the card goes while it shows', () => {
      host.frame().showTick('review.kind.confirm');
      fixture.destroy();
      expect(() => vi.advanceTimersByTime(SAVING_MS + TICK_MS)).not.toThrow();
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe('on a stage', () => {
    let stage: { beginTick: ReturnType<typeof vi.fn>; endTick: ReturnType<typeof vi.fn> };

    beforeEach(() => {
      stage = { beginTick: vi.fn(), endTick: vi.fn(() => false) };
      setUp([{ provide: ReviewStage, useValue: stage }]);
      vi.useFakeTimers();
    });

    const advance = (ms: number) => {
      vi.advanceTimersByTime(ms);
      fixture.detectChanges();
    };

    it('tells the stage when its tick starts and when it ends', () => {
      host.frame().showTick('review.kind.confirm');
      expect(stage.beginTick).toHaveBeenCalledTimes(1);
      expect(stage.endTick).not.toHaveBeenCalled();

      advance(SAVING_MS + TICK_MS);
      expect(stage.endTick).toHaveBeenCalledTimes(1);
    });

    it('takes its tick down when the card stays (its next question comes in place)', () => {
      stage.endTick.mockReturnValue(false);
      host.frame().showTick('review.kind.confirm');
      advance(SAVING_MS + TICK_MS);

      expect(q('card-tick')).toBeNull();
      expect(locked()).toBe(false);
    });

    it('keeps its tick up when the card goes, so the card slides away with the result on it', () => {
      stage.endTick.mockReturnValue(true);
      host.frame().showTick('review.kind.confirm');
      advance(SAVING_MS + TICK_MS);

      expect(q('card-tick')).not.toBeNull();
      expect(q('tick-check')).not.toBeNull();
      expect(locked()).toBe(true);
    });

    it('lets the stage go when the card is removed in the middle of a tick', () => {
      host.frame().showTick('review.kind.confirm');
      fixture.destroy();
      expect(stage.endTick).toHaveBeenCalledTimes(1);
    });

    it('does not talk to the stage when it never showed a tick', () => {
      fixture.destroy();
      expect(stage.endTick).not.toHaveBeenCalled();
    });
  });
});
