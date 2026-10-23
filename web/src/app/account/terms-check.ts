import { ChangeDetectionStrategy, Component, computed, input, model, signal } from '@angular/core';
import { TranslocoPipe, translateSignal } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmDialogImports } from '@spartan-ng/helm/dialog';
import { TermText } from '../core/i18n/term';
import { DialogCard } from '../core/layout/dialog-card';
import { ChoiceCard, FieldError } from '../settings/form-parts';

/** Stand where the two links go in the translated sentence, so each link is a button of its own wherever a language puts it. */
const TERMS_MARK = '\u0001';
const AVV_MARK = '\u0002';

/**
 * The look of a link in a sentence. It sits above the card's invisible input, so tapping it opens the notice instead of
 * ticking the box. It is an inline element (not a button, which stays one box and so can't wrap with the words around it).
 */
const LINK_CLASS =
  'text-primary focus-visible:ring-ring/50 relative z-10 cursor-pointer rounded-sm font-medium underline underline-offset-4 hover:no-underline focus-visible:ring-[3px] focus-visible:outline-none';

/**
 * The tick for the terms of use and the data processing agreement (AVV), with what they mean in one line each: the
 * German version is binding, and the client keeps their own books and sends their own returns. The two links open a
 * notice that the legal texts are not written yet. Sign-up and Add a business both end with it.
 *
 * What is ticked belongs to the page (`accepted`, two-way), and so does the message to show (`error`, a translation key
 * or null): the page decides when the box is asked for.
 */
@Component({
  selector: 'app-terms-check',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ChoiceCard,
    DialogCard,
    FieldError,
    HlmButton,
    HlmDialogImports,
    TermText,
    TranslocoPipe,
  ],
  host: { class: 'flex flex-col gap-2' },
  template: `
    <app-choice-card
      type="checkbox"
      name="terms"
      data-testid="terms-accept"
      [checked]="accepted()"
      (changed)="accepted.set($event)"
    >
      @for (part of parts(); track $index) {
        @switch (part) {
          @case (termsMark) {
            <a
              role="button"
              tabindex="0"
              [class]="linkClass"
              data-testid="terms-link"
              (click)="open($event)"
              (keydown.enter)="open($event)"
              (keydown.space)="open($event)"
              >{{ 'auth.terms.termsLink' | transloco }}</a
            >
          }
          @case (avvMark) {
            <a
              role="button"
              tabindex="0"
              [class]="linkClass"
              data-testid="avv-link"
              (click)="open($event)"
              (keydown.enter)="open($event)"
              (keydown.space)="open($event)"
              ><app-term-text key="avv"
            /></a>
          }
          @default {
            <span class="font-normal">{{ part }}</span>
          }
        }
      }
    </app-choice-card>
    @if (error(); as key) {
      <p [appFieldError]="key" data-testid="terms-error"></p>
    }
    <p class="text-muted-foreground text-sm" data-testid="terms-binding">
      {{ 'auth.terms.binding' | transloco }}
    </p>
    <p class="text-muted-foreground text-sm" data-testid="terms-books">
      {{ 'auth.terms.books' | transloco }}
    </p>

    <!-- The notice shows in the overlay, so nothing of this element belongs in the column. -->
    <div hidden>
      <hlm-dialog
        [state]="notice() ? 'open' : 'closed'"
        autoFocus="dialog"
        (stateChanged)="onStateChanged($event)"
      >
        <hlm-dialog-content
          *hlmDialogPortal
          appDialogCard
          data-testid="legal-notice"
          [closeLabel]="'auth.terms.notice.close' | transloco"
        >
          <hlm-dialog-header class="pe-8">
            <h2
              hlmDialogTitle
              class="text-lg leading-snug font-semibold"
              data-testid="legal-notice-title"
            >
              {{ 'auth.terms.notice.title' | transloco }}
            </h2>
          </hlm-dialog-header>
          <p class="text-sm" data-testid="legal-notice-body">
            {{ 'auth.terms.notice.body' | transloco }}
          </p>
          <hlm-dialog-footer>
            <button
              hlmBtn
              type="button"
              class="min-h-10"
              data-testid="legal-notice-close"
              (click)="notice.set(false)"
            >
              {{ 'auth.terms.notice.close' | transloco }}
            </button>
          </hlm-dialog-footer>
        </hlm-dialog-content>
      </hlm-dialog>
    </div>
  `,
})
export class TermsCheck {
  /** Whether the terms are ticked. */
  readonly accepted = model(false);
  /** The message (a translation key) under the tick, or null for none. */
  readonly error = input<string | null>(null);

  protected readonly notice = signal(false);
  protected readonly termsMark = TERMS_MARK;
  protected readonly avvMark = AVV_MARK;
  protected readonly linkClass = LINK_CLASS;

  private readonly sentence = translateSignal('auth.terms.accept', {
    terms: TERMS_MARK,
    avv: AVV_MARK,
  });
  /** The sentence in pieces: its words, and the two marks where the links go. */
  protected readonly parts = computed(() =>
    this.sentence()
      .split(/([\u0001\u0002])/)
      .filter((part) => part !== ''),
  );

  /** A link of the sentence was used (tap, Enter or Space): the page does not scroll or the box tick, the notice opens. */
  protected open(event: Event): void {
    event.preventDefault();
    this.notice.set(true);
  }

  /** The cross, Escape and a tap outside close the notice by themselves; it follows. */
  protected onStateChanged(state: 'open' | 'closed'): void {
    if (state === 'closed') this.notice.set(false);
  }
}
