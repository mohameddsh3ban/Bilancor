import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { pluralKey } from '../core/i18n/plural-key';
import { TermText } from '../core/i18n/term';
import type { HelpHit } from '../domain/help';

/**
 * What a search found: the answers (with their topic) and the German terms (marked "Term", they open German terms A–Z at
 * the term), in the order the search gave them. When there is none, "Nothing found" and Write to us, which carries what
 * was typed into the message. A line only a screen reader hears says how many there are, as the list changes.
 */
@Component({
  selector: 'app-help-results',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HlmButton, HlmCardImports, NgIcon, RouterLink, TermText, TranslocoPipe],
  viewProviders: [provideIcons({ lucideChevronRight })],
  host: { class: 'block' },
  template: `
    @if (hits().length > 0) {
      <p class="sr-only" role="status" data-testid="help-found">
        {{ plural('help.home.found', hits().length) | transloco: { count: hits().length } }}
      </p>
      <ul
        class="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border"
        [attr.aria-label]="'help.home.results' | transloco"
        data-testid="help-results"
      >
        @for (hit of hits(); track hit.kind === 'answer' ? 'answer:' + hit.id : 'term:' + hit.key) {
          <li>
            @if (hit.kind === 'answer') {
              <a
                class="hover:bg-muted flex min-h-11 items-center gap-3 px-4 py-2.5"
                [routerLink]="['/help', hit.id]"
                data-kind="answer"
                [attr.data-testid]="'help-result-' + hit.id"
              >
                <span
                  class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                >
                  <span class="min-w-0">{{ 'help.answers.' + hit.id + '.q' | transloco }}</span>
                  <span class="text-muted-foreground shrink-0 text-xs">{{
                    'help.topics.' + hit.topic | transloco
                  }}</span>
                </span>
                <ng-icon
                  name="lucideChevronRight"
                  size="16"
                  class="text-muted-foreground shrink-0 rtl:rotate-180"
                  aria-hidden="true"
                />
              </a>
            } @else {
              <a
                class="hover:bg-muted flex min-h-11 items-center gap-3 px-4 py-2.5"
                routerLink="/help/terms"
                [fragment]="hit.key"
                data-kind="term"
                [attr.data-testid]="'help-result-term-' + hit.key"
              >
                <span
                  class="flex min-w-0 flex-1 flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
                >
                  <span class="min-w-0"><app-term-text [key]="hit.key" /></span>
                  <span class="text-muted-foreground shrink-0 text-xs">{{
                    'help.home.term' | transloco
                  }}</span>
                </span>
                <ng-icon
                  name="lucideChevronRight"
                  size="16"
                  class="text-muted-foreground shrink-0 rtl:rotate-180"
                  aria-hidden="true"
                />
              </a>
            }
          </li>
        }
      </ul>
    } @else {
      <section hlmCard size="sm" data-testid="help-nothing">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <h2 class="font-medium">{{ 'help.home.nothingTitle' | transloco }}</h2>
          <p class="text-muted-foreground text-sm">{{ 'help.home.nothingBody' | transloco }}</p>
          <a
            hlmBtn
            routerLink="/help/contact"
            [queryParams]="{ q: typed() }"
            data-testid="help-nothing-write"
          >
            {{ 'help.home.nothingAction' | transloco }}
          </a>
        </div>
      </section>
    }
  `,
})
export class HelpResults {
  readonly hits = input.required<readonly HelpHit[]>();
  /** What the person typed, as it will be carried into Write to us. */
  readonly query = input.required<string>();

  protected readonly plural = pluralKey;
  protected readonly typed = computed(() => this.query().trim());
}
