import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideLoaderCircle } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { AppDatePipe } from '../core/format/date.pipe';
import { MoneyPipe } from '../core/format/money.pipe';
import { ReviewService } from '../state/review.service';
import { ReviewStage } from './review-stage';

/** How long "Saving…" shows before the tick. */
export const SAVING_MS = 150;
/** How long the tick shows with the result. */
export const TICK_MS = 300;
/** How long it shows when there are notes under it (such as what the app learned): long enough to read them. */
export const TICK_NOTE_MS = 1500;

/**
 * The classes of the group of answers of a card: one under the other, every button (the pickers' too) as wide as the
 * card and tall enough to tap, wrapping when a label is long.
 */
export const ANSWERS_CLASS =
  'flex flex-col gap-2 [&_button]:h-auto [&_button]:min-h-10 [&_button]:w-full [&_button]:whitespace-normal [&_button]:py-2';

/** One more line under the result of a tick: a translation key and its values. */
export interface TickNote {
  key: string;
  params?: Record<string, string>;
}

type Tick =
  | { phase: 'saving' }
  | { phase: 'done'; labelKey: string; params: Record<string, string>; notes: readonly TickNote[] };

/**
 * The frame every review card sits in: what the card is, its amount, who and when, then the card's own question and
 * answers (projected), and "Skip for now". After an answer the card calls `showTick()`: "Saving…" for a moment, then a
 * green tick with what happened. While the tick shows, or while an answer is still being made, the question and answers
 * (and Skip) are locked, so a second tap cannot answer the next card by mistake.
 *
 * A card must call `showTick()` in the same breath as its answer: the page keeps the card on screen from then until the
 * tick is over (see `ReviewStage`).
 */
@Component({
  selector: 'app-review-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AppDatePipe, MoneyPipe, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideCheck, lucideLoaderCircle })],
  host: { class: 'block' },
  template: `
    <article
      class="bg-card border-border relative overflow-hidden rounded-2xl border p-5 shadow-sm"
      data-testid="review-card"
      [attr.aria-busy]="review.pending() ? 'true' : null"
    >
      <div
        class="flex flex-col gap-3 transition-opacity motion-reduce:transition-none"
        data-testid="card-content"
        [class.opacity-60]="review.pending()"
        [attr.inert]="locked() ? '' : null"
      >
        <p
          class="text-muted-foreground text-xs font-medium tracking-wide uppercase"
          data-testid="card-kind"
        >
          {{ kindKey() | transloco }}
        </p>
        <div class="flex min-w-0 flex-col gap-0.5">
          @let amount = amountCents();
          @if (amount !== null) {
            <p
              class="text-3xl leading-tight font-bold"
              data-testid="card-amount"
              [class]="amountClass()"
            >
              <bdi dir="ltr">{{ amount | money: { signed: signed() } }}</bdi>
            </p>
          }
          <p class="truncate font-semibold" dir="auto" data-testid="card-name">{{ name() }}</p>
          @if (date(); as date) {
            <p class="text-muted-foreground text-sm" data-testid="card-date">
              {{ date | appDate }}
            </p>
          }
        </div>

        <ng-content />

        <button
          type="button"
          class="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mx-auto rounded-sm text-sm underline underline-offset-4 outline-none focus-visible:ring-3"
          data-testid="card-skip"
          [class.invisible]="!canSkip()"
          (click)="review.skip()"
        >
          {{ 'review.skip' | transloco }}
        </button>
      </div>

      @if (tick(); as state) {
        <div
          class="bg-card/95 absolute inset-0 flex flex-col items-center justify-center gap-2 p-5 text-center"
          role="status"
          data-testid="card-tick"
        >
          @if (state.phase === 'saving') {
            <ng-icon
              name="lucideLoaderCircle"
              size="28"
              class="text-muted-foreground animate-spin motion-reduce:animate-none"
              aria-hidden="true"
            />
            <p class="text-muted-foreground font-medium">{{ 'review.saving' | transloco }}</p>
          } @else {
            <span
              class="bg-positive text-positive-foreground flex size-14 items-center justify-center rounded-full transition-transform duration-250 ease-[cubic-bezier(0.3,1.6,0.6,1)] starting:scale-40 motion-reduce:transition-none"
              data-testid="tick-check"
              aria-hidden="true"
            >
              <ng-icon name="lucideCheck" size="30" />
            </span>
            <p class="text-positive font-semibold" data-testid="tick-text">
              {{ state.labelKey | transloco: state.params }}
            </p>
            @for (note of state.notes; track note.key) {
              <p class="text-muted-foreground text-sm" data-testid="tick-note">
                {{ note.key | transloco: note.params ?? {} }}
              </p>
            }
          }
        </div>
      }
    </article>
  `,
})
export class ReviewCard {
  protected readonly review = inject(ReviewService);
  private readonly stage = inject(ReviewStage, { optional: true });

  /** Translation key of what the card is, such as "Payment · please confirm". */
  readonly kindKey = input.required<string>();
  /** The amount in cents; null when it is not known (a document whose amount could not be read). */
  readonly amountCents = input<number | null>(null);
  /** Show the amount with its sign and colour (a payment); off for a document's plain amount. */
  readonly signed = input(false);
  readonly name = input.required<string>();
  /** ISO date; null when it is not known. */
  readonly date = input<string | null>(null);

  protected readonly tick = signal<Tick | null>(null);
  /** The question and answers cannot be used: a tick is showing, or an answer is still being made. */
  protected readonly locked = computed(() => this.tick() !== null || this.review.pending());
  /**
   * Skip moves the card behind the others, so it needs another card to move behind. Without one it is hidden but keeps
   * its space, so a card that ticks as the second to last does not shrink.
   */
  protected readonly canSkip = computed(() => this.review.total() - this.review.answered() > 1);
  protected readonly amountClass = computed(() => {
    const cents = this.amountCents();
    if (!this.signed() || cents === null) return '';
    return cents >= 0 ? 'text-positive' : 'text-negative';
  });

  private timer: ReturnType<typeof setTimeout> | undefined;
  /** This card has told the stage that a tick is on, and has not said it is over. */
  private ticking = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      clearTimeout(this.timer);
      if (this.ticking) this.stage?.endTick();
    });
  }

  /**
   * Shows "Saving…" for a moment, then the tick with the result (`labelKey` and `params` translated) and any notes under
   * it. Call it in the same breath as the answer. Showing another tick starts again.
   */
  showTick(
    labelKey: string,
    params: Record<string, string> = {},
    notes: readonly TickNote[] = [],
  ): void {
    clearTimeout(this.timer);
    this.ticking = true;
    this.stage?.beginTick();
    this.tick.set({ phase: 'saving' });
    this.timer = setTimeout(() => {
      this.tick.set({ phase: 'done', labelKey, params, notes });
      this.timer = setTimeout(() => this.endTick(), notes.length > 0 ? TICK_NOTE_MS : TICK_MS);
    }, SAVING_MS);
  }

  private endTick(): void {
    this.ticking = false;
    // A card that goes keeps its tick up while it slides out; one that stays takes it down for its next question.
    const leaves = this.stage?.endTick() ?? false;
    if (!leaves) this.tick.set(null);
  }
}
