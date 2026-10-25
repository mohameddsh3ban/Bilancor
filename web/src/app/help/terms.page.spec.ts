import { ViewportScroller } from '@angular/common';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { Subject, map, take } from 'rxjs';
import { LanguageService } from '../core/i18n/language.service';
import { TERM_KEYS, type TermKey } from '../core/i18n/term-keys';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { TERM_PAGES } from '../data/help';
import { normalizeForSearch, termsAZ } from '../domain/help';
import { signInAsSara } from '../state/account.testing';
import { HelpPage as HelpPageComponent } from './help.page';
import { HelpTermsPage } from './terms.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

/** Stands in for the pages Help links to (an answer, Write to us). */
@Component({ template: '' })
class Elsewhere {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const LANGS = { en, de, ar } as const;

describe('HelpTermsPage', () => {
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        // The routes of the app in their order: the fixed path of German terms A–Z comes above help/:id.
        provideRouter([
          { path: 'help', component: HelpPageComponent },
          { path: 'help/terms', component: HelpTermsPage },
          { path: 'help/:id', component: Elsewhere },
          { path: '**', component: Elsewhere },
        ]),
      ],
    });
    signInAsSara();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Lets the page and any navigation finish; `el` is the page that is showing then. */
  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
    el = harness!.routeNativeElement as HTMLElement;
  }

  /** Opens an address; a later call goes on in the same visit. */
  async function render(url = '/help/terms'): Promise<void> {
    if (harness) {
      await harness.navigateByUrl(url);
    } else {
      harness = await RouterTestingHarness.create(url);
    }
    await settle();
  }

  async function setLang(lang: 'en' | 'de' | 'ar'): Promise<void> {
    TestBed.inject(LanguageService).setLang(lang);
    await settle();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const router = () => TestBed.inject(Router);
  /** The term (the list item) of a key. */
  const termOf = (key: TermKey) => qa('term').find((item) => item.dataset['term'] === key)!;
  /** The keys of the terms showing, in the order of the page. */
  const shown = () => qa('term').map((item) => item.dataset['term'] as TermKey);
  /** The letters of the headings showing. */
  const letters = () =>
    qa('terms-group').map((group) => text(group.querySelector('[data-testid="terms-letter"]')));

  /** Types into the filter box, the way a person does. */
  async function filterBy(value: string): Promise<void> {
    const input = q('terms-search') as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  }

  /** The terms a filter keeps, in the order of the page, worked out here from the texts of a language. */
  function expected(query: string, lang: keyof typeof LANGS): TermKey[] {
    const terms = LANGS[lang].terms;
    const needle = normalizeForSearch(query);
    const inOrder = termsAZ(terms).flatMap((group) => group.keys);
    return inOrder.filter((key) =>
      [terms[key].de, terms[key].label, terms[key].explain].some((words) =>
        normalizeForSearch(words).includes(needle),
      ),
    );
  }

  it('lists every TERM_KEYS term once, grouped by letter', async () => {
    await render();
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(text(el.querySelector('h1'))).toBe('German terms A–Z');
    expect(text(q('terms-intro'))).toBe(
      `${TERM_KEYS.length} words from letters and forms, explained.`,
    );

    // Every term of the list, each once, each with its key as its address on the page.
    const keys = shown();
    expect(keys).toHaveLength(TERM_KEYS.length);
    expect([...keys].sort()).toEqual([...TERM_KEYS].sort());
    for (const item of qa('term')) expect(item.id).toBe(item.dataset['term']);

    // The letters are headings, once each, in German order.
    expect(letters()).toEqual(termsAZ(en.terms).map((group) => group.letter));
    expect(new Set(letters()).size).toBe(letters().length);
    expect(letters()).toEqual([...letters()].sort(new Intl.Collator('de').compare));
    expect(q('terms-letter')!.tagName).toBe('H2');

    // Each term stands under the first letter of its German word.
    for (const group of qa('terms-group')) {
      const letter = text(group.querySelector('[data-testid="terms-letter"]'));
      const items = Array.from(group.querySelectorAll<HTMLElement>('[data-testid="term"]'));
      expect(items.length, letter).toBeGreaterThan(0);
      for (const item of items) {
        const word = text(item.querySelector('[data-testid="term-de"]'));
        expect(word.normalize('NFD').charAt(0).toUpperCase(), word).toBe(letter);
      }
    }
  });

  it('each term shows its German word, its translation, its explanation and where it appears', async () => {
    await render();
    for (const key of TERM_KEYS) {
      const item = termOf(key);
      const word = item.querySelector<HTMLElement>('[data-testid="term-de"]')!;
      expect(text(word), key).toBe(en.terms[key].de);
      // The word is German, and stays left to right inside the page.
      expect(word.getAttribute('lang'), key).toBe('de');
      expect(word.closest('bdi')?.getAttribute('dir'), key).toBe('ltr');
      expect(word.closest('h3'), key).not.toBeNull();
      expect(text(item.querySelector('[data-testid="term-label"]')), key).toBe(en.terms[key].label);
      expect(text(item.querySelector('[data-testid="term-explain"]')), key).toBe(
        en.terms[key].explain,
      );
      expect(text(item.querySelector('[data-testid="term-pages"]')), key).toBe(
        `Appears in: ${TERM_PAGES[key].map((page) => en.help.pages[page]).join(', ')}`,
      );
    }
    expect(text(termOf('ustva').querySelector('[data-testid="term-pages"]'))).toBe(
      'Appears in: Home, Payments, Taxes, Settings',
    );
    expect(text(termOf('bwa').querySelector('[data-testid="term-pages"]'))).toBe(
      'Appears in: Reports',
    );
  });

  it('has a back link to Help', async () => {
    await render();
    const back = q('terms-back')!;
    expect(text(back)).toBe('Help');
    expect(back.getAttribute('href')).toBe('/help');
    expect(back.querySelector('ng-icon')).not.toBeNull();
    back.click();
    await settle();
    expect(router().url).toBe('/help');
    expect(q('help-topics')).not.toBeNull();
  });

  describe('the filter', () => {
    it('is a labelled search box that starts empty and shows the whole list', async () => {
      await render();
      const input = q('terms-search') as HTMLInputElement;
      expect(input.type).toBe('search');
      expect(input.value).toBe('');
      expect(input.getAttribute('aria-label')).toBe(en.help.terms.filterLabel);
      expect(input.getAttribute('placeholder')).toBe(en.help.terms.filterPlaceholder);
      expect(shown()).toHaveLength(TERM_KEYS.length);
      expect(q('terms-none')).toBeNull();
    });

    it('filters by German word, translation or explanation', async () => {
      await render();

      // The German word, whatever the case.
      await filterBy('Kleinunternehmer');
      expect(shown()).toEqual(expected('Kleinunternehmer', 'en'));
      expect(shown()).toContain('kleinunternehmer');
      await filterBy('USTVA');
      expect(shown()).toContain('ustva');
      expect(shown()).not.toContain('kasse');

      // The translation in the current language.
      await filterBy("owner's deposit");
      expect(shown()).toEqual(['privateinlage']);
      await filterBy('cash box');
      expect(shown()).toEqual(['kasse']);

      // The explanation in the current language.
      await filterBy('licensed professional');
      expect(shown()).toEqual(['steuerberater']);
      await filterBy('receipt');
      expect(shown()).toEqual(expected('receipt', 'en'));
      expect(shown().length).toBeGreaterThan(1);

      // The groups follow what is left: a letter with no term shows no heading.
      expect(letters()).toEqual(
        termsAZ(en.terms)
          .filter((group) => group.keys.some((key) => shown().includes(key)))
          .map((group) => group.letter),
      );
    });

    it('ignores accents, umlauts written out, case and extra spaces', async () => {
      await render();
      await filterBy('uebertragungsprotokoll');
      expect(shown()).toContain('uebertragungsprotokoll');
      await filterBy('UBERTRAGUNGSPROTOKOLL');
      expect(shown()).toContain('uebertragungsprotokoll');
      await filterBy('  dauerfristverlaengerung  ');
      expect(shown()).toContain('dauerfristverlaengerung');
      await filterBy('vat   return');
      expect(shown()).toEqual(expected('vat return', 'en'));
      expect(shown()).toContain('ustva');
    });

    it('an all-spaces filter shows the full list', async () => {
      await render();
      await filterBy('kasse');
      expect(shown()).toEqual(['kasse']);
      await filterBy('   ');
      expect(shown()).toHaveLength(TERM_KEYS.length);
      expect(q('terms-none')).toBeNull();
    });

    it('with no match says so, and one tap shows the full list again', async () => {
      await render();
      await filterBy('zzzz');
      expect(shown()).toEqual([]);
      expect(qa('terms-group')).toHaveLength(0);
      expect(text(q('terms-none'))).toContain('No term matches');
      const clear = q('terms-clear')!;
      expect(text(clear)).toBe('Show all terms');
      expect(clear.tagName).toBe('BUTTON');

      clear.click();
      await settle();
      expect(shown()).toHaveLength(TERM_KEYS.length);
      expect(q('terms-none')).toBeNull();
      const input = q('terms-search') as HTMLInputElement;
      expect(input.value).toBe('');
      // The button is gone, so the focus goes back to the box instead of getting lost.
      expect(document.activeElement).toBe(input);
    });

    it('a screen reader hears how many terms are left', async () => {
      await render();
      expect(q('terms-found')!.getAttribute('role')).toBe('status');
      expect(text(q('terms-found'))).toBe(`${TERM_KEYS.length} results`);
      await filterBy('kasse');
      expect(text(q('terms-found'))).toBe('1 result');
      await filterBy('zzzz');
      expect(text(q('terms-found'))).toBe('0 results');
    });

    it('reads the texts of the language of the page', async () => {
      await render();
      // German: the explanation.
      await setLang('de');
      await filterBy('Barzahlung');
      expect(shown()).toEqual(['kasse']);
      // The English translation is not a word of the German page.
      await filterBy('cash box');
      expect(shown()).toEqual([]);

      // Arabic: the translation.
      await setLang('ar');
      await filterBy(ar.terms.kasse.label);
      expect(shown()).toEqual(expected(ar.terms.kasse.label, 'ar'));
      expect(shown()).toContain('kasse');
      // The German word still finds its term in Arabic.
      await filterBy('Privateinlage');
      expect(shown()).toEqual(['privateinlage']);
    });
  });

  describe('an address with a term', () => {
    it('#<key> scrolls to that term', async () => {
      const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
      await render('/help/terms#kasse');
      expect(router().url).toBe('/help/terms#kasse');

      // The term is on the page, with its key as its id, when the router goes to the fragment.
      const target = document.getElementById('kasse');
      expect(target).not.toBeNull();
      expect(target).toBe(termOf('kasse'));
      expect(target!.closest('app-help-terms-page')).not.toBeNull();

      // The router finds the term by its id, scrolls there and puts the focus on it, so a screen reader starts reading
      // at the term. Nothing sticks to the top of the page, so nothing covers it.
      TestBed.inject(ViewportScroller).scrollToAnchor('kasse');
      expect(scrollTo).toHaveBeenCalled();
      expect(document.activeElement).toBe(target);
    });

    it('every term can be reached that way, from a term in the search results', async () => {
      for (const key of ['ustva', 'privateinlage', 'steuerberater']) {
        await render(`/help/terms#${key}`);
        expect(document.getElementById(key)?.dataset['term']).toBe(key);
      }
    });

    it('#nope just shows the list', async () => {
      await render('/help/terms#nope');
      expect(document.getElementById('nope')).toBeNull();
      expect(shown()).toHaveLength(TERM_KEYS.length);
      expect(q('terms-none')).toBeNull();
      expect(() => TestBed.inject(ViewportScroller).scrollToAnchor('nope')).not.toThrow();
    });
  });

  describe('in German', () => {
    it("the German page doesn't repeat the word as its translation", async () => {
      await render();
      // English gives a translation next to the word, for every term.
      expect(qa('term-label')).toHaveLength(TERM_KEYS.length);

      await setLang('de');
      expect(qa('term-label')).toHaveLength(0);
      for (const key of TERM_KEYS) {
        const item = termOf(key);
        // The word once, in its heading, and the explanation of the German texts.
        expect(text(item.querySelector('h3')), key).toBe(de.terms[key].de);
        expect(text(item.querySelector('[data-testid="term-explain"]')), key).toBe(
          de.terms[key].explain,
        );
        expect(text(item.querySelector('[data-testid="term-pages"]')), key).toBe(
          de.help.terms.appearsIn.replace(
            '{{pages}}',
            TERM_PAGES[key].map((page) => de.help.pages[page]).join(de.help.terms.pagesSeparator),
          ),
        );
      }
      // A German label that explains the word in other words (Ist-Versteuerung) is not set beside it either.
      expect(de.terms.istVersteuerung.label).not.toBe(de.terms.istVersteuerung.de);
      expect(text(el)).not.toContain(de.terms.istVersteuerung.label);
    });

    it('says everything else in German too', async () => {
      await render();
      await setLang('de');
      expect(text(el.querySelector('h1'))).toBe(de.help.home.termsTitle);
      expect(text(q('terms-back'))).toBe(de.help.title);
      expect(text(q('terms-intro'))).toBe(
        de.help.home.termsBody.replace('{{count}}', String(TERM_KEYS.length)),
      );
      expect((q('terms-search') as HTMLInputElement).placeholder).toBe(
        de.help.terms.filterPlaceholder,
      );
      await filterBy('zzzz');
      expect(text(q('terms-none'))).toContain(de.help.terms.noneTitle);
      expect(text(q('terms-clear'))).toBe(de.help.terms.noneAction);
    });
  });

  describe('reads in Arabic', () => {
    it('reads in Arabic, German words left to right', async () => {
      await render();
      await setLang('ar');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe(ar.help.home.termsTitle);
      expect(text(q('terms-back'))).toBe(ar.help.title);
      expect(q('terms-back')!.querySelector('ng-icon')!.classList.contains('rtl:rotate-180')).toBe(
        true,
      );
      expect(text(q('terms-intro'))).toBe(
        ar.help.home.termsBody.replace('{{count}}', String(TERM_KEYS.length)),
      );
      const input = q('terms-search') as HTMLInputElement;
      expect(input.getAttribute('aria-label')).toBe(ar.help.terms.filterLabel);
      expect(input.placeholder).toBe(ar.help.terms.filterPlaceholder);

      // The groups are the same as in English: they follow the German word, not the Arabic translation.
      expect(letters()).toEqual(termsAZ(en.terms).map((group) => group.letter));
      expect(shown()).toEqual(termsAZ(en.terms).flatMap((group) => group.keys));

      for (const key of TERM_KEYS) {
        const item = termOf(key);
        // The German word stays left to right in the right-to-left page, and is marked as German.
        const word = item.querySelector<HTMLElement>('[data-testid="term-de"]')!;
        expect(text(word), key).toBe(ar.terms[key].de);
        expect(word.getAttribute('lang'), key).toBe('de');
        expect(word.closest('bdi')?.getAttribute('dir'), key).toBe('ltr');
        // Next to it: the Arabic translation and explanation, and the Arabic names of the pages.
        expect(text(item.querySelector('[data-testid="term-label"]')), key).toBe(
          ar.terms[key].label,
        );
        expect(text(item.querySelector('[data-testid="term-explain"]')), key).toBe(
          ar.terms[key].explain,
        );
        expect(text(item.querySelector('[data-testid="term-pages"]')), key).toBe(
          ar.help.terms.appearsIn.replace(
            '{{pages}}',
            TERM_PAGES[key].map((page) => ar.help.pages[page]).join(ar.help.terms.pagesSeparator),
          ),
        );
      }
    });

    it('in Arabic the empty filter says so in Arabic', async () => {
      await render();
      await setLang('ar');
      await filterBy('zzzz');
      expect(text(q('terms-none'))).toContain(ar.help.terms.noneTitle);
      expect(text(q('terms-clear'))).toBe(ar.help.terms.noneAction);
    });
  });
});

describe('HelpTermsPage on a cold start', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('waits for the translation file without a word of complaint, then shows the list and scrolls to the term of the address', async () => {
    // A reload at /help/terms#kasse: the page is there before the German words are.
    const arrive = new Subject<void>();
    class LateLoader implements TranslocoLoader {
      getTranslation(lang: string) {
        return arrive.pipe(
          take(1),
          map(() => LANGS[lang as keyof typeof LANGS] as unknown as Translation),
        );
      }
    }
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTransloco({
          config: {
            availableLangs: ['en', 'de', 'ar'],
            defaultLang: 'en',
            reRenderOnLangChange: true,
          },
          loader: LateLoader,
        }),
        provideRouter([
          { path: 'help/terms', component: HelpTermsPage },
          { path: '**', component: Elsewhere },
        ]),
      ],
    });
    TestBed.inject(LanguageService);
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);

    const harness = await RouterTestingHarness.create('/help/terms#kasse');
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;
    expect(el.tagName).toBe('APP-HELP-TERMS-PAGE');
    // Nothing to list yet, and nothing said about a missing term.
    expect(el.querySelectorAll('[data-testid="term"]')).toHaveLength(0);
    expect(el.querySelector('[data-testid="terms-none"]')).toBeNull();
    expect(scrollTo).not.toHaveBeenCalled();

    arrive.next();
    await harness.fixture.whenStable();
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    expect(el.querySelectorAll('[data-testid="term"]')).toHaveLength(TERM_KEYS.length);
    expect(el.querySelector('[data-testid="terms-none"]')).toBeNull();
    // The list was not there when the router went to the term, so the page goes there itself.
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(document.getElementById('kasse'));
  });
});
