import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal, untracked } from '@angular/core';
import { prefersReducedMotion } from '../core/layout/reduced-motion';
import type { ReviewItem } from '../domain/review-queue';
import { ReviewService } from '../state/review.service';

/** How long a card takes to slide out, and the next one to slide in. */
export const SLIDE_MS = 300;

/** The card on screen. `id` is new for every card that comes in, so a card that comes back is a new element. */
export interface ShownCard {
  id: number;
  item: ReviewItem;
}

const sameCard = (a: ReviewItem, b: ReviewItem | null): boolean =>
  b !== null && a.kind === b.kind && a.id === b.id;

/**
 * Which card the review page shows, and when it changes. The session moves on the moment an answer is given, but the card
 * stays on screen until its tick is over, then slides out and the next one slides in. A card that has a next problem is
 * not replaced: it stays and asks its next question in place. The page provides one of these to itself, and the card
 * frame tells it when a tick starts and ends.
 */
@Injectable()
export class ReviewStage {
  private readonly review = inject(ReviewService);
  private readonly doc = inject(DOCUMENT);

  private cardCount = 0;
  private slideTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly shownSignal = signal<ShownCard | null>(this.enter(this.review.current()));
  private readonly leavingSignal = signal(false);
  private readonly slidesInSignal = signal(false);
  private readonly tickingSignal = signal(false);

  /** The card on screen; null once nothing is left (the finish screen). */
  readonly shown = this.shownSignal.asReadonly();
  /** The card on screen is sliding out. */
  readonly leaving = this.leavingSignal.asReadonly();
  /** The card on screen came in sliding (not the first one, and not when the person asked for less motion). */
  readonly slidesIn = this.slidesInSignal.asReadonly();

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.slideTimer));
    effect(() => {
      const target = this.review.current();
      this.tickingSignal();
      untracked(() => this.follow(target));
    });
  }

  /** A card frame shows its tick: the card stays on screen until `endTick`. */
  beginTick(): void {
    this.tickingSignal.set(true);
  }

  /**
   * The tick is over, so the card may go. Says whether it will: a card that goes keeps its tick up while it slides
   * out, a card that stays takes it down and shows its next question.
   */
  endTick(): boolean {
    const shown = this.shownSignal();
    const leaves = shown !== null && !sameCard(shown.item, this.review.current());
    this.tickingSignal.set(false);
    return leaves;
  }

  /** Brings the card on screen in line with the session's current one. */
  private follow(target: ReviewItem | null): void {
    if (this.tickingSignal() || this.leavingSignal()) return;
    const shown = this.shownSignal();
    if (shown === null && target === null) return;
    if (shown !== null && target !== null && sameCard(shown.item, target)) {
      if (shown.item.problem !== target.problem || shown.item.date !== target.date) {
        this.shownSignal.set({ id: shown.id, item: target });
      }
      return;
    }
    if (shown !== null && !prefersReducedMotion(this.doc)) {
      this.leavingSignal.set(true);
      this.slideTimer = setTimeout(() => this.swap(), SLIDE_MS);
    } else {
      this.swap();
    }
  }

  /** The card on screen is gone: whatever is current now comes in. */
  private swap(): void {
    this.leavingSignal.set(false);
    this.slidesInSignal.set(!prefersReducedMotion(this.doc));
    this.shownSignal.set(this.enter(this.review.current()));
  }

  private enter(item: ReviewItem | null): ShownCard | null {
    return item === null ? null : { id: ++this.cardCount, item };
  }
}
