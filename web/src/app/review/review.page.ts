import { DOCUMENT, Location } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideX } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmProgressImports } from '@spartan-ng/helm/progress';
import { LanguageService } from '../core/i18n/language.service';
import { ReviewService } from '../state/review.service';
import { DocumentCard } from './document-card';
import { ReviewFinish } from './finish';
import { PaymentCard } from './payment-card';
import { ReviewStage } from './review-stage';

/**
 * The review inbox (`/review`): the person's decisions one card at a time. A full-screen layer over the app on a phone;
 * on a computer the same cards in a column over a dimmed page, at a fixed distance from the top so that ✕ and the progress
 * bar stay where they are from one card to the next. Top: ✕, a progress bar and how far along and how long it takes. Then
 * the current card (or the finish screen when nothing is left), and Undo for a few seconds after each answer: the bottom
 * row of the column on a phone, floating at the bottom of the screen on a computer so that it never moves the card.
 * ✕ and Back return to the page the person came from; what was answered is already saved.
 */
@Component({
  selector: 'app-review-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DocumentCard, HlmProgressImports, NgIcon, PaymentCard, ReviewFinish, TranslocoPipe],
  providers: [ReviewStage],
  viewProviders: [provideIcons({ lucideX })],
  // Escape is heard on the document, after the layer and the overlays: a list that is open (the category picker, the
  // document picker) takes the key and marks it handled, so it closes the list and not the page.
  host: { class: 'contents', '(document:keydown.escape)': 'onEscape($event)' },
  template: `
    <div
      #layer
      class="bg-surface lg:bg-foreground/40 fixed inset-0 z-50 flex flex-col items-center overflow-y-auto overscroll-contain outline-none lg:p-6"
      role="dialog"
      aria-modal="true"
      tabindex="-1"
      data-testid="review-layer"
      [attr.dir]="language.dir()"
      [attr.aria-label]="'review.title' | transloco"
    >
      <div
        class="lg:bg-surface flex w-full flex-1 flex-col gap-3 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] lg:mt-[6vh] lg:mb-auto lg:max-w-md lg:flex-none lg:rounded-2xl lg:p-5 lg:shadow-xl"
        data-testid="review-column"
      >
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="text-muted-foreground hover:bg-muted focus-visible:ring-ring/50 -ms-2 inline-flex size-9 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-3"
            data-testid="review-close"
            [disabled]="review.pending()"
            [attr.aria-label]="'review.close' | transloco"
            (click)="close()"
          >
            <ng-icon name="lucideX" size="20" aria-hidden="true" />
          </button>
          <hlm-progress
            class="h-2 flex-1"
            data-testid="review-progress"
            [value]="percent()"
            [attr.aria-label]="'review.progressLabel' | transloco"
          >
            <hlm-progress-indicator class="duration-300 ease-out motion-reduce:transition-none" />
          </hlm-progress>
        </div>

        @if (stage.shown()) {
          <p class="text-muted-foreground text-xs" data-testid="review-meta">
            {{
              'review.progress'
                | transloco
                  : {
                      position: review.position(),
                      total: review.total(),
                      minutes: review.minutesLeft(),
                    }
            }}
          </p>
        }

        <div class="flex flex-1 flex-col overflow-x-clip py-1" data-testid="review-stage">
          @for (card of cards(); track card.id) {
            <div
              class="transition duration-300 ease-out motion-reduce:transition-none"
              data-testid="review-card-host"
              [class]="motionClass()"
              [attr.inert]="stage.leaving() ? '' : null"
            >
              @let item = card.item;
              @if (item.kind === 'payment') {
                <app-payment-card [item]="item" />
              } @else {
                <app-document-card [item]="item" />
              }
            </div>
          } @empty {
            <app-review-finish (back)="close()" />
          }
        </div>

        <div
          class="sticky bottom-0 mt-auto lg:fixed lg:inset-x-0 lg:bottom-6 lg:mx-auto lg:max-w-md lg:px-5"
          role="status"
          data-testid="review-toast-area"
        >
          @if (review.canUndo()) {
            @let answer = review.lastAnswer();
            @if (answer) {
              <div
                class="bg-foreground text-background flex items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm shadow-lg transition duration-300 starting:translate-y-4 starting:opacity-0 motion-reduce:transition-none"
                data-testid="undo-toast"
              >
                <span class="min-w-0" data-testid="undo-text">
                  {{ answer.labelKey | transloco: answer.params ?? {} }}
                </span>
                <button
                  type="button"
                  class="focus-visible:ring-background/50 shrink-0 rounded-sm font-semibold underline underline-offset-4 outline-none focus-visible:ring-3 disabled:opacity-50"
                  data-testid="undo-button"
                  [disabled]="review.pending()"
                  (click)="review.undo()"
                >
                  {{ 'review.undo' | transloco }}
                </button>
              </div>
            }
          }
        </div>
      </div>
    </div>
  `,
})
export class ReviewPage {
  protected readonly review = inject(ReviewService);
  protected readonly stage = inject(ReviewStage);
  protected readonly language = inject(LanguageService);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly doc = inject(DOCUMENT);

  private readonly layer = viewChild.required<ElementRef<HTMLElement>>('layer');

  /** The card on screen as a list of at most one, so that a new card is a new element (and slides in). */
  protected readonly cards = computed(() => {
    const shown = this.stage.shown();
    return shown === null ? [] : [shown];
  });

  /** How much is done, as the share of the cards answered: empty at the start, full when nothing is left. */
  protected readonly percent = computed(() => {
    const total = this.review.total();
    return total === 0 ? 100 : Math.round((this.review.answered() / total) * 100);
  });

  /** The classes that slide the card out, or in: the other way round when the page reads right to left. */
  protected readonly motionClass = computed(() => {
    const rtl = this.language.dir() === 'rtl';
    if (this.stage.leaving()) {
      return rtl ? 'translate-x-[110%] opacity-0' : '-translate-x-[110%] opacity-0';
    }
    if (this.stage.slidesIn()) {
      return rtl
        ? 'starting:-translate-x-[110%] starting:opacity-0'
        : 'starting:translate-x-[110%] starting:opacity-0';
    }
    return '';
  });

  constructor() {
    // The focus starts on the layer, and comes back to it when the card that had it is gone (a new card slid in), so a
    // keyboard starts again from the top of the page and not from the app underneath.
    afterRenderEffect(() => {
      this.stage.shown();
      const layer = this.layer().nativeElement;
      if (!layer.contains(this.doc.activeElement)) layer.focus();
    });
  }

  /** Escape closes the page, unless a list or tooltip that is open took the key first. */
  protected onEscape(event: Event): void {
    if (!event.defaultPrevented) this.close();
  }

  /** Going back has been asked for and the browser has not answered yet. */
  private leaving = false;

  /**
   * Leaves for the page the person came from. Not while an answer is being made: it would be lost half way.
   *
   * The page was opened on top of the one it returns to, so leaving steps back in the browser history: then the phone's
   * back gesture goes on to the page before it, and does not open the inbox again. A direct load has nothing under it:
   * there the page is swapped for the return page in place, with the same result.
   */
  protected close(): void {
    if (this.review.pending() || this.leaving) return;
    if (this.review.cameFromReturnUrl()) {
      // A second tap before the browser has moved would step back past the page we want.
      this.leaving = true;
      this.location.back();
    } else {
      void this.router.navigateByUrl(this.review.returnUrl(), { replaceUrl: true });
    }
  }
}
