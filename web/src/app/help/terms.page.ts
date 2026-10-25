import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Signal,
  afterRenderEffect,
  computed,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { ViewportScroller } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch } from '@ng-icons/lucide';
import { TranslocoPipe, translateObjectSignal, translateSignal } from '@jsverse/transloco';
import { HlmButton } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { LanguageService } from '../core/i18n/language.service';
import { pluralKey } from '../core/i18n/plural-key';
import { TERM_KEYS, type TermKey } from '../core/i18n/term-keys';
import { TERM_PAGES, type HelpPage } from '../data/help';
import { normalizeForSearch, termsAZ } from '../domain/help';
import { HelpBackLink } from './help-back-link';

type TermTexts = Record<TermKey, { label: string; de: string; explain: string }>;

/**
 * German terms A–Z (`/help/terms`): a filter box, then every term the app explains, grouped by the first letter of the
 * German word (Ä with A, Ü with U, in German order). A term shows the German word (set left to right and marked as
 * German, so it reads right in Arabic), its translation, the explanation the app uses everywhere, and the pages it
 * appears on. The German page has no translation to show beside the word, only the word and its explanation.
 *
 * The filter looks in the German word, the translation and the explanation of the language of the page, ignoring case,
 * accents and the spelling of umlauts (the same search as Help's). With no match it says so and offers the whole list
 * again. Each term has its key as its `id`, so `/help/terms#<key>` (a term in Help's search results) scrolls there and puts
 * the focus on it; an address with a key that is not a term just shows the list. Nothing sticks to the top of the page, so
 * nothing covers a term that was scrolled to.
 */
@Component({
  selector: 'app-help-terms-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [HelpBackLink, HlmButton, HlmCardImports, NgIcon, TranslocoPipe],
  viewProviders: [provideIcons({ lucideSearch })],
  host: { class: 'mx-auto flex w-full max-w-2xl flex-col gap-4' },
  template: `
    <app-help-back-link testId="terms-back">
      {{ 'help.title' | transloco }}
    </app-help-back-link>

    <header class="flex flex-col gap-1">
      <h1 class="text-2xl font-semibold">{{ 'help.home.termsTitle' | transloco }}</h1>
      <p class="text-muted-foreground text-sm" data-testid="terms-intro">
        {{ 'help.home.termsBody' | transloco: { count: termCount } }}
      </p>
    </header>

    <div class="relative">
      <ng-icon
        name="lucideSearch"
        size="16"
        class="text-muted-foreground pointer-events-none absolute start-3 top-1/2 -translate-y-1/2"
        aria-hidden="true"
      />
      <input
        #search
        type="search"
        class="border-input bg-background placeholder:text-muted-foreground h-11 w-full rounded-md border ps-9 pe-3 text-base"
        data-testid="terms-search"
        [value]="query()"
        [attr.aria-label]="'help.terms.filterLabel' | transloco"
        [placeholder]="'help.terms.filterPlaceholder' | transloco"
        (input)="setQuery($event)"
      />
    </div>

    <p class="sr-only" role="status" data-testid="terms-found">
      {{ plural('help.home.found', count()) | transloco: { count: count() } }}
    </p>

    @for (group of groups(); track group.letter) {
      <section class="flex flex-col gap-2" data-testid="terms-group">
        <h2 class="text-primary px-1 text-lg font-semibold" data-testid="terms-letter">
          {{ group.letter }}
        </h2>
        <ul class="bg-card border-border divide-border divide-y overflow-hidden rounded-xl border">
          @for (key of group.keys; track key) {
            <!-- tabindex -1: the router puts the focus on a term it scrolled to, so a screen reader starts reading there. -->
            <li
              [id]="key"
              tabindex="-1"
              class="flex flex-col gap-1 px-4 py-3 outline-none"
              data-testid="term"
              [attr.data-term]="key"
            >
              <div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h3 class="font-semibold">
                  <bdi dir="ltr"
                    ><span lang="de" data-testid="term-de">{{ texts()[key].de }}</span></bdi
                  >
                </h3>
                @if (showTranslation()) {
                  <p class="text-muted-foreground text-sm" data-testid="term-label">
                    {{ texts()[key].label }}
                  </p>
                }
              </div>
              <p class="text-sm leading-relaxed" data-testid="term-explain">
                {{ texts()[key].explain }}
              </p>
              <p class="text-muted-foreground text-xs" data-testid="term-pages">
                {{ 'help.terms.appearsIn' | transloco: { pages: pagesOf(key) } }}
              </p>
            </li>
          }
        </ul>
      </section>
    }

    @if (none()) {
      <section hlmCard size="sm" data-testid="terms-none">
        <div hlmCardContent class="flex flex-col items-start gap-3">
          <h2 class="font-medium">{{ 'help.terms.noneTitle' | transloco }}</h2>
          <p class="text-muted-foreground text-sm">{{ 'help.terms.noneBody' | transloco }}</p>
          <button
            hlmBtn
            type="button"
            variant="outline"
            (click)="clear()"
            data-testid="terms-clear"
          >
            {{ 'help.terms.noneAction' | transloco }}
          </button>
        </div>
      </section>
    }
  `,
})
export class HelpTermsPage {
  private readonly route = inject(ActivatedRoute);
  private readonly scroller = inject(ViewportScroller);
  private readonly language = inject(LanguageService);

  protected readonly plural = pluralKey;
  /** How many German terms the list holds. */
  protected readonly termCount = TERM_KEYS.length;

  /** What is in the filter box. Not in the address: a filter is not a page to come back to. */
  protected readonly query = signal('');
  private readonly search = viewChild<ElementRef<HTMLInputElement>>('search');

  /** The texts of every term in the current language; empty until the translation file has arrived. */
  protected readonly texts = translateObjectSignal('terms') as Signal<TermTexts>;
  private readonly pageNames = translateObjectSignal('help.pages') as Signal<
    Record<HelpPage, string>
  >;
  private readonly separator = translateSignal('help.terms.pagesSeparator');

  /** Whether the texts are here. The translation files load on their own, so on a cold start the first render has none. */
  private readonly loaded = computed(() =>
    TERM_KEYS.every((key) => this.texts()[key] !== undefined),
  );

  /** The translation is the German word's partner in English and Arabic; on the German page it would say the word twice. */
  protected readonly showTranslation = computed(() => this.language.lang() !== 'de');

  /** All terms by the letter of the German word; the same in every language, so it only waits for the words to be here. */
  private readonly allGroups = computed(() => (this.loaded() ? termsAZ(this.texts()) : []));

  /** The groups with the terms the filter keeps (all of them for an empty or all-spaces filter), without the empty groups. */
  protected readonly groups = computed(() => {
    const terms = this.texts();
    const needle = normalizeForSearch(this.query());
    const matches = (words: string) => normalizeForSearch(words).includes(needle);
    return this.allGroups()
      .map(({ letter, keys }) => ({
        letter,
        keys: keys.filter((key) =>
          [terms[key].de, terms[key].label, terms[key].explain].some(matches),
        ),
      }))
      .filter((group) => group.keys.length > 0);
  });
  protected readonly count = computed(() =>
    this.groups().reduce((total, group) => total + group.keys.length, 0),
  );
  /** Something was typed and no term has it. While the texts are on their way there is nothing to say yet. */
  protected readonly none = computed(
    () => this.loaded() && normalizeForSearch(this.query()) !== '' && this.count() === 0,
  );

  private readonly fragment = toSignal(this.route.fragment, {
    initialValue: this.route.snapshot.fragment,
  });

  constructor() {
    // The router scrolls to the term of the address as soon as the page is shown. After a reload the German words may
    // still be on their way then, and the list is not there yet: scroll again once it is.
    if (!this.loaded()) {
      const waiting = afterRenderEffect(() => {
        if (!this.loaded()) return;
        waiting.destroy();
        const fragment = untracked(this.fragment);
        if (fragment) this.scroller.scrollToAnchor(fragment);
      });
    }
  }

  /** The names of the pages a term appears on, as the line under it lists them. */
  protected pagesOf(key: TermKey): string {
    const names = this.pageNames();
    return TERM_PAGES[key].map((page) => names[page]).join(this.separator());
  }

  protected setQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  /** Shows the whole list again. The button goes away with the message, so the focus goes back to the box. */
  protected clear(): void {
    this.query.set('');
    this.search()?.nativeElement.focus();
  }
}
