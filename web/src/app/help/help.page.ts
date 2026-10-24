import {
  ChangeDetectionStrategy,
  Component,
  Signal,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideChevronRight, lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe, translateObjectSignal, translateSignal } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { map } from 'rxjs';
import { pluralKey } from '../core/i18n/plural-key';
import { TERM_KEYS, type TermKey } from '../core/i18n/term-keys';
import { HELP_ANSWERS, HELP_TOPICS, type HelpPage as HelpPageName } from '../data/help';
import { helpPageOf, normalizeForSearch, pageQuestions, searchHelp } from '../domain/help';
import { DemoStateService } from '../state/demo-state.service';
import { HelpContextService } from '../state/help-context.service';
import { HelpBackLink } from './help-back-link';
import { HelpQuestions } from './help-questions';
import { HelpResults } from './help-results';

/** Stands where the German word goes in a translated sentence, so the word can be set left to right inside it. */
const TERM_MARK = '\u0001';

/** Each topic with how many answers it holds. */
const TOPICS = HELP_TOPICS.map((id) => ({
  id,
  count: HELP_ANSWERS.filter((answer) => answer.topic === id).length,
}));

/**
 * Help (`/help`): a search box, then the questions for the page the person came from, the seven topics, German terms A–Z,
 * Write to us and a plain line about tax advice. One column on a phone; two from `lg`.
 *
 * The page is the last one opened before Help (`HelpContextService`), so the menu's Help works from anywhere; from the
 * homepage, or when Help is opened first, the section is Getting started. A Kleinunternehmer's Help with Taxes starts
 * with the limit. A topic opens its questions in place of the topics, at `?topic=<id>`. While there is something in the
 * search box, its results take the place of all of that; the search reads the texts of the language of the page.
 */
@Component({
  selector: 'app-help-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    HelpBackLink,
    HelpQuestions,
    HelpResults,
    HlmButton,
    HlmCardImports,
    NgIcon,
    RouterLink,
    TranslocoPipe,
  ],
  viewProviders: [provideIcons({ lucideChevronRight, lucideSearch })],
  host: { class: 'flex flex-col gap-4' },
  template: `
    <h1 class="text-2xl font-semibold">{{ 'help.title' | transloco }}</h1>

    <div class="relative">
      <ng-icon
        name="lucideSearch"
        size="16"
        class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        type="search"
        class="border-input bg-background placeholder:text-muted-foreground h-11 w-full rounded-md border ps-9 pe-3 text-base"
        data-testid="help-search"
        [value]="query()"
        [attr.aria-label]="'help.home.searchLabel' | transloco"
        [placeholder]="'help.home.searchPlaceholder' | transloco"
        (input)="setQuery($event)"
      />
    </div>

    @if (searching()) {
      <app-help-results [hits]="hits()" [query]="query()" />
    } @else {
      <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div class="flex min-w-0 flex-col gap-4">
          <section hlmCard size="sm" data-testid="help-for-page">
            <header hlmCardHeader>
              <h2 hlmCardTitle data-testid="help-for-page-title">
                @if (page() === 'start') {
                  {{ 'help.topics.start' | transloco }}
                } @else {
                  {{ 'help.home.forPage' | transloco: { page: pageName() } }}
                }
              </h2>
              @if (page() !== 'start') {
                <p hlmCardDescription data-testid="help-because">
                  {{ 'help.home.because' | transloco: { page: pageName() } }}
                </p>
              }
            </header>
            <div hlmCardContent>
              <app-help-questions [ids]="questions()" testId="help-for-page-question" />
            </div>
          </section>

          @if (topic(); as topic) {
            <section hlmCard size="sm" data-testid="help-topic">
              <header hlmCardHeader>
                <app-help-back-link testId="help-all-topics">
                  {{ 'help.home.allTopics' | transloco }}
                </app-help-back-link>
                <h2 hlmCardTitle>{{ 'help.topics.' + topic | transloco }}</h2>
              </header>
              <div hlmCardContent>
                <app-help-questions [ids]="topicQuestions()" testId="help-topic-question" />
              </div>
            </section>
          } @else {
            <section hlmCard size="sm" data-testid="help-topics">
              <header hlmCardHeader>
                <h2 hlmCardTitle>{{ 'help.home.topics' | transloco }}</h2>
              </header>
              <div hlmCardContent>
                <ul class="flex flex-col">
                  @for (item of topics; track item.id) {
                    <li class="border-border border-t first:border-t-0">
                      <a
                        class="hover:bg-muted flex min-h-11 items-center justify-between gap-3 py-2.5"
                        routerLink="/help"
                        [queryParams]="{ topic: item.id }"
                        data-testid="help-topic-link"
                        [attr.data-topic]="item.id"
                      >
                        <span class="min-w-0" data-testid="help-topic-name">{{
                          'help.topics.' + item.id | transloco
                        }}</span>
                        <span
                          class="text-muted-foreground flex shrink-0 items-center gap-2 text-sm"
                        >
                          <span aria-hidden="true" data-testid="help-topic-count">{{
                            item.count
                          }}</span>
                          <span class="sr-only">{{
                            plural('help.home.answers', item.count)
                              | transloco: { count: item.count }
                          }}</span>
                          <ng-icon
                            name="lucideChevronRight"
                            size="16"
                            class="rtl:rotate-180"
                            aria-hidden="true"
                          />
                        </span>
                      </a>
                    </li>
                  }
                </ul>
              </div>
            </section>
          }
        </div>

        <div class="flex min-w-0 flex-col gap-4">
          <section hlmCard size="sm" data-testid="help-terms-card">
            <header hlmCardHeader>
              <h2 hlmCardTitle>{{ 'help.home.termsTitle' | transloco }}</h2>
            </header>
            <div hlmCardContent class="flex flex-col items-start gap-3">
              <p class="text-muted-foreground text-sm" data-testid="help-terms-body">
                {{ 'help.home.termsBody' | transloco: { count: termCount } }}
              </p>
              <a
                hlmBtn
                variant="outline"
                size="sm"
                routerLink="/help/terms"
                data-testid="help-terms-link"
              >
                {{ 'help.home.termsAction' | transloco }}
              </a>
            </div>
          </section>

          <section hlmCard size="sm" data-testid="help-contact-card">
            <header hlmCardHeader>
              <h2 hlmCardTitle>{{ 'help.home.contactTitle' | transloco }}</h2>
            </header>
            <div hlmCardContent class="flex flex-col items-start gap-3">
              <p class="text-muted-foreground text-sm">
                {{ 'help.home.contactBody' | transloco }}
              </p>
              <a
                hlmBtn
                variant="outline"
                size="sm"
                routerLink="/help/contact"
                data-testid="help-contact-link"
              >
                {{ 'help.home.contactAction' | transloco }}
              </a>
            </div>
          </section>

          <div
            role="note"
            class="border-primary bg-muted/50 flex flex-col items-start gap-3 rounded-lg border-s-4 p-3 text-sm"
            data-testid="help-note"
          >
            @let note = ('help.home.taxNote' | transloco: { term: termMark }).split(termMark);
            <p>
              {{ note[0] }}<bdi dir="ltr">{{ advisor() }}</bdi
              >{{ note[1] }}
            </p>
            <a
              hlmBtn
              variant="outline"
              size="sm"
              routerLink="/settings"
              fragment="people"
              data-testid="help-invite-advisor"
            >
              {{ 'help.home.taxAction' | transloco }}
            </a>
          </div>
        </div>
      </div>
    }
  `,
})
export class HelpPage {
  private readonly demo = inject(DemoStateService);
  private readonly context = inject(HelpContextService);
  private readonly route = inject(ActivatedRoute);

  protected readonly plural = pluralKey;
  protected readonly topics = TOPICS;
  protected readonly termMark = TERM_MARK;
  /** How many German terms the list holds. */
  protected readonly termCount = TERM_KEYS.length;
  /** The German word for a tax advisor, which the tax-advice note names in its own sentence. */
  protected readonly advisor = translateSignal('terms.steuerberater.de');

  /** What is in the search box. Not in the address: a search is not a page to come back to. */
  protected readonly query = signal('');
  protected readonly searching = computed(() => normalizeForSearch(this.query()) !== '');

  /** The texts of the current language the search reads; they follow the language of the page. */
  private readonly answerTexts = translateObjectSignal('help.answers') as Signal<
    Record<string, { q: string; a: string }>
  >;
  private readonly termTexts = translateObjectSignal('terms') as Signal<
    Record<TermKey, { label: string; de: string; explain: string }>
  >;
  protected readonly hits = computed(() =>
    searchHelp(this.query(), { answers: this.answerTexts(), terms: this.termTexts() }),
  );

  /** The page Help has questions for, from the last page opened before Help (Getting started when there is none). */
  protected readonly page = computed<HelpPageName>(() => helpPageOf(this.context.lastPage()));
  protected readonly pageName = translateSignal(computed(() => `help.pages.${this.page()}`));
  protected readonly questions = computed(() =>
    pageQuestions(this.page(), this.demo.business().taxProfile.kleinunternehmer),
  );

  private readonly topicParam = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('topic'))),
    { initialValue: this.route.snapshot.queryParamMap.get('topic') },
  );
  /** The topic the address asks for (`?topic=`), or none, also for a topic that does not exist: then all topics show. */
  protected readonly topic = computed(
    () => HELP_TOPICS.find((topic) => topic === this.topicParam()) ?? null,
  );
  protected readonly topicQuestions = computed(() =>
    HELP_ANSWERS.filter((answer) => answer.topic === this.topic()).map((answer) => answer.id),
  );

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }
}
