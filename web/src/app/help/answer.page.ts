import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  linkedSignal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronLeft } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { map } from 'rxjs';
import { Term } from '../core/i18n/term';
import { HELP_ANSWERS } from '../data/help';

/**
 * One answer of Help (`/help/<id>`): "‹ Help · <topic>" (each part a link), the question as the title, the answer's
 * paragraphs, the German terms it uses as chips that explain on tap, a button to the page it talks about, and "Did this
 * answer your question?". Yes says "Thanks" in its place and keeps nothing; No opens Write to us with the topic chosen and
 * the answer named. An id with no answer says so and offers the way back to Help.
 *
 * The page is reused when only the id changes (the browser's back and forward), so the thanks are forgotten then.
 */
@Component({
  selector: 'app-help-answer-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RouterLink, Term, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronLeft })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    @if (answer(); as item) {
      <nav [attr.aria-label]="'help.answer.breadcrumb' | transloco" data-testid="answer-breadcrumb">
        <ol class="flex flex-wrap items-center gap-x-2 text-sm">
          <li>
            <a
              routerLink="/help"
              class="text-primary inline-flex min-h-11 items-center gap-1 font-medium"
              data-testid="answer-crumb-help"
            >
              <ng-icon
                name="lucideChevronLeft"
                size="16"
                class="rtl:rotate-180"
                aria-hidden="true"
              />
              {{ 'help.title' | transloco }}
            </a>
          </li>
          <li class="text-muted-foreground" aria-hidden="true">·</li>
          <li>
            <a
              routerLink="/help"
              [queryParams]="{ topic: item.topic }"
              class="text-primary inline-flex min-h-11 items-center font-medium"
              data-testid="answer-crumb-topic"
            >
              {{ 'help.topics.' + item.topic | transloco }}
            </a>
          </li>
        </ol>
      </nav>

      <h1 class="text-2xl font-semibold" data-testid="answer-title">
        {{ 'help.answers.' + item.id + '.q' | transloco }}
      </h1>

      @let body = 'help.answers.' + item.id + '.a' | transloco;
      <div class="flex flex-col gap-3 leading-relaxed">
        @for (paragraph of paragraphsOf(body); track $index) {
          <p data-testid="answer-paragraph">{{ paragraph }}</p>
        }
      </div>

      @if (item.terms.length > 0) {
        <div class="flex flex-col gap-2" data-testid="answer-terms">
          <h2 class="text-muted-foreground text-sm font-medium" data-testid="answer-terms-title">
            {{ 'help.answer.termsTitle' | transloco }}
          </h2>
          <ul class="flex flex-wrap gap-2">
            @for (key of item.terms; track key) {
              <li
                class="bg-muted inline-flex min-h-9 items-center rounded-full px-3 text-sm"
                data-testid="answer-term"
                [attr.data-term]="key"
              >
                <app-term [key]="key" />
              </li>
            }
          </ul>
        </div>
      }

      @if (item.link; as link) {
        <a
          hlmBtn
          size="lg"
          class="self-start"
          [routerLink]="link.route"
          [fragment]="link.fragment"
          data-testid="answer-open"
        >
          {{ 'help.answer.open' | transloco: { page: ('help.pages.' + link.page | transloco) } }}
        </a>
      }

      <section hlmCard size="sm" data-testid="answer-feedback">
        <div hlmCardContent class="flex flex-col gap-3">
          <h2 class="text-sm font-medium" data-testid="answer-feedback-title">
            {{ 'help.answer.feedbackTitle' | transloco }}
          </h2>
          <div class="flex flex-wrap items-center gap-2">
            @if (thanked()) {
              <p
                #thanks
                tabindex="-1"
                class="focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-md px-2.5 text-sm font-medium outline-none focus-visible:ring-3"
                data-testid="answer-thanks"
              >
                {{ 'help.answer.thanks' | transloco }}
              </p>
            } @else {
              <button
                hlmBtn
                type="button"
                variant="outline"
                (click)="thank()"
                data-testid="answer-yes"
              >
                {{ 'help.answer.yes' | transloco }}
              </button>
            }
            <a
              hlmBtn
              variant="outline"
              routerLink="/help/contact"
              [queryParams]="{ topic: item.topic, about: item.id }"
              data-testid="answer-no"
            >
              {{ 'help.answer.no' | transloco }}
            </a>
          </div>
        </div>
      </section>
    } @else {
      <div class="flex flex-col items-start gap-4" data-testid="answer-missing">
        <h1 class="text-2xl font-semibold">{{ 'help.answer.missingTitle' | transloco }}</h1>
        <p class="text-muted-foreground">{{ 'help.answer.missingBody' | transloco }}</p>
        <a hlmBtn routerLink="/help" data-testid="answer-missing-back">
          {{ 'help.answer.missingAction' | transloco }}
        </a>
      </div>
    }
  `,
})
export class HelpAnswerPage {
  private readonly route = inject(ActivatedRoute);

  private readonly id = toSignal(this.route.paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: this.route.snapshot.paramMap.get('id'),
  });
  /** The answer the address asks for, or none (then the page says it doesn't exist). */
  protected readonly answer = computed(
    () => HELP_ANSWERS.find((answer) => answer.id === this.id()) ?? null,
  );

  /** Whether Yes was chosen. Only for the answer shown: another answer asks the question again. Never stored. */
  protected readonly thanked = linkedSignal({ source: this.id, computation: () => false });
  private readonly thanks = viewChild<ElementRef<HTMLElement>>('thanks');

  constructor() {
    // Yes goes away when it is chosen; the focus moves to the thanks in its place, so the keyboard stays on the page.
    afterRenderEffect(() => this.thanks()?.nativeElement.focus());
  }

  /** The paragraphs of an answer's text: it keeps them apart with a blank line. */
  protected paragraphsOf(text: string): string[] {
    return text.split('\n\n');
  }

  protected thank(): void {
    this.thanked.set(true);
  }
}
