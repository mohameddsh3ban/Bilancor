import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { HELP_ANSWERS, HELP_TOPICS, type HelpPage } from '../data/help';
import { signInAsSara } from '../state/account.testing';
import { HelpAnswerPage } from './answer.page';
import { HelpPage as HelpPageComponent } from './help.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

/** Stands in for the pages an answer links to, and for Write to us (built later). */
@Component({ template: '' })
class Elsewhere {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

/** The paragraphs of an answer as the translation files hold them: one text, split by a blank line. */
const paragraphsOf = (answer: string) => answer.split('\n\n');

/**
 * The name a page button gives where it goes: the menu's name of the page, except for My account and the review inbox,
 * which the menu has no name for. Written out here on purpose, so the page's own rule is checked against it.
 */
const destination = (lang: typeof en, route: string, page: HelpPage): string =>
  route === '/account'
    ? lang.account.title
    : route === '/review'
      ? lang.payments.quick.needsYou
      : lang.help.pages[page];

describe('HelpAnswerPage', () => {
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        // The routes of the app in their order: the fixed path of Help's own page comes above help/:id.
        provideRouter([
          { path: 'help', component: HelpPageComponent },
          { path: 'help/contact', component: Elsewhere },
          { path: 'help/:id', component: HelpAnswerPage },
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

  /** Opens an address; a later call goes on in the same visit (the same page, so a new answer reuses it). */
  async function render(url: string): Promise<void> {
    if (harness) {
      await harness.navigateByUrl(url);
    } else {
      harness = await RouterTestingHarness.create(url);
    }
    await settle();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const router = () => TestBed.inject(Router);
  const paragraphs = () => qa('answer-paragraph').map((p) => text(p));

  async function setLang(lang: 'en' | 'de' | 'ar'): Promise<void> {
    TestBed.inject(LanguageService).setLang(lang);
    await settle();
  }

  it('an answer shows its question, paragraphs, term chips and page button', async () => {
    await render('/help/vat-due');
    expect(qa('answer-title')).toHaveLength(1);
    expect(q('answer-title')!.tagName).toBe('H1');
    expect(text(q('answer-title'))).toBe('When is my VAT return due?');
    expect(text(el.querySelector('h1'))).toBe('When is my VAT return due?');

    // One paragraph for each blank line of the text.
    expect(paragraphs()).toEqual(paragraphsOf(en.help.answers['vat-due'].a));
    expect(paragraphs()).toHaveLength(3);

    // The terms are chips that explain on tap: the translation with the German original beside it.
    const chips = qa('answer-term');
    expect(chips.map((chip) => chip.dataset['term'])).toEqual([
      'ustva',
      'dauerfristverlaengerung',
      'kleinunternehmer',
    ]);
    expect(chips.map((chip) => text(chip))).toEqual([
      'VAT return (UStVA)',
      'Permanent extension (Dauerfristverlängerung)',
      'Small business, no VAT (Kleinunternehmer)',
    ]);
    expect(q('answer-terms-title') && text(q('answer-terms-title'))).toBe(
      'German words in this answer',
    );
    for (const chip of chips) expect(chip.querySelector('app-term button')).not.toBeNull();
    // Tapping a chip explains it.
    chips[0].querySelector('button')!.click();
    await settle();
    expect(document.body.textContent).toContain(en.terms.ustva.explain);

    const open = q('answer-open')!;
    expect(text(open)).toBe('Open Taxes');
    expect(open.getAttribute('href')).toBe('/taxes');
    expect(q('answer-missing')).toBeNull();
  });

  it('every answer opens with its question, all its paragraphs, its terms and its page button', async () => {
    for (const answer of HELP_ANSWERS) {
      await render(`/help/${answer.id}`);
      const entry = en.help.answers[answer.id as keyof typeof en.help.answers];
      expect(text(q('answer-title')), answer.id).toBe(entry.q);
      expect(paragraphs(), answer.id).toEqual(paragraphsOf(entry.a));
      expect(
        qa('answer-term').map((chip) => chip.dataset['term']),
        answer.id,
      ).toEqual(answer.terms);
      if (answer.link) {
        const open = q('answer-open')!;
        expect(text(open), answer.id).toBe(
          `Open ${destination(en, answer.link.route, answer.link.page)}`,
        );
        const href = open.getAttribute('href')!;
        expect(href, answer.id).toBe(
          answer.link.route + (answer.link.fragment ? `#${answer.link.fragment}` : ''),
        );
      } else {
        expect(q('answer-open'), answer.id).toBeNull();
      }
      expect(q('answer-missing'), answer.id).toBeNull();
    }
  });

  it('a page button keeps the fragment of its link, and opens that page', async () => {
    await render('/help/invite-advisor');
    expect(q('answer-open')!.getAttribute('href')).toBe('/settings#people');
    expect(text(q('answer-open'))).toBe('Open Settings');
    await render('/help/renew-bank');
    expect(q('answer-open')!.getAttribute('href')).toBe('/settings#bank-accounts');
    q('answer-open')!.click();
    await settle();
    expect(router().url).toBe('/settings#bank-accounts');
  });

  describe('the page button names where it really goes', () => {
    it('My account and the review inbox are named as the app names them, not as the page they belong to', async () => {
      // Change language and the 6-digit code link to My account, which Help files under Settings.
      for (const id of ['change-language', 'six-digit-code']) {
        await render(`/help/${id}`);
        expect(text(q('answer-open')), id).toBe('Open My account');
        expect(q('answer-open')!.getAttribute('href'), id).toBe('/account');
      }
      // What a payment needs links to the review inbox, which the top bar calls Needs you (Help files it under Payments).
      await render('/help/payment-needs');
      expect(text(q('answer-open'))).toBe('Open Needs you');
      expect(q('answer-open')!.getAttribute('href')).toBe('/review');
      q('answer-open')!.click();
      await settle();
      expect(router().url).toBe('/review');
    });

    it('says the same in German and Arabic, with the words the app uses there', async () => {
      for (const [lang, file] of [
        ['de', de],
        ['ar', ar],
      ] as const) {
        TestBed.inject(LanguageService).setLang(lang);
        await render('/help/change-language');
        expect(text(q('answer-open')), lang).toBe(
          file.help.answer.open.replace('{{page}}', file.account.title),
        );
        expect(file.account.title, lang).not.toBe(file.help.pages.settings);
        await render('/help/payment-needs');
        expect(text(q('answer-open')), lang).toBe(
          file.help.answer.open.replace('{{page}}', file.payments.quick.needsYou),
        );
        expect(file.payments.quick.needsYou, lang).not.toBe(file.help.pages.payments);
      }
    });

    it('the button reads as a sentence in German and Arabic, whatever the name is: it stands in quotes', async () => {
      // Some names are verb phrases ("Braucht dich", "يحتاج إليك"), so the name is set off from the word for "open".
      const wording = {
        de: {
          'payment-needs': '„Braucht dich“ öffnen',
          'change-language': '„Mein Konto“ öffnen',
          'vat-due': '„Steuern“ öffnen',
        },
        ar: {
          'payment-needs': 'فتح «يحتاج إليك»',
          'change-language': 'فتح «حسابي»',
          'vat-due': 'فتح «الضرائب»',
        },
      } as const;
      for (const lang of ['de', 'ar'] as const) {
        TestBed.inject(LanguageService).setLang(lang);
        for (const [id, button] of Object.entries(wording[lang])) {
          await render(`/help/${id}`);
          expect(text(q('answer-open')), `${lang} ${id}`).toBe(button);
        }
      }
      // Every button of every answer reads the same way: each name of a page, and of My account and Needs you, in quotes.
      const quoted = {
        de: (name: string) => `„${name}“ öffnen`,
        ar: (name: string) => `فتح «${name}»`,
      };
      for (const [lang, file] of [
        ['de', de],
        ['ar', ar],
      ] as const) {
        TestBed.inject(LanguageService).setLang(lang);
        for (const answer of HELP_ANSWERS.filter((a) => a.link)) {
          const link = answer.link!;
          await render(`/help/${answer.id}`);
          expect(text(q('answer-open')), `${lang} ${answer.id}`).toBe(
            quoted[lang](destination(file, link.route, link.page)),
          );
        }
      }
      // English has no such problem and stays plain.
      TestBed.inject(LanguageService).setLang('en');
      await render('/help/payment-needs');
      expect(text(q('answer-open'))).toBe('Open Needs you');
    });

    it('every other link keeps the name of its Help page', async () => {
      for (const answer of HELP_ANSWERS) {
        if (!answer.link || answer.link.route === '/account' || answer.link.route === '/review')
          continue;
        await render(`/help/${answer.id}`);
        expect(text(q('answer-open')), answer.id).toBe(`Open ${en.help.pages[answer.link.page]}`);
      }
    });
  });

  it('an answer with no page to open shows no page button, and no empty list of terms', async () => {
    await render('/help/records-kept');
    expect(text(q('answer-title'))).toBe('How long are my records kept?');
    expect(q('answer-open')).toBeNull();
    // It does name terms (Eigenbeleg, Festschreibung), so the chips stay; one without terms shows neither the chips nor
    // their title.
    expect(qa('answer-term').map((chip) => chip.dataset['term'])).toEqual([
      'eigenbeleg',
      'festschreibung',
    ]);
    await render('/help/setup-steps');
    expect(qa('answer-term')).toHaveLength(0);
    expect(q('answer-terms-title')).toBeNull();
    expect(q('answer-open')).not.toBeNull();
  });

  describe('Did this answer your question?', () => {
    it('asks with Yes and No, write to us', async () => {
      await render('/help/vat-due');
      expect(text(q('answer-feedback-title'))).toBe('Did this answer your question?');
      expect(text(q('answer-yes'))).toBe('Yes');
      expect(text(q('answer-no'))).toBe('No, write to us');
      expect(q('answer-thanks')).toBeNull();
    });

    it('Yes says thanks and stores nothing', async () => {
      await render('/help/vat-due');
      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
      const before = { local: { ...localStorage }, session: { ...sessionStorage } };

      q('answer-yes')!.click();
      await settle();

      // "Thanks" stands where Yes was; the way to write to us stays, and nothing else changes.
      expect(q('answer-yes')).toBeNull();
      expect(text(q('answer-thanks'))).toBe('Thanks');
      expect(q('answer-no')).not.toBeNull();
      expect(router().url).toBe('/help/vat-due');
      expect(text(q('answer-title'))).toBe('When is my VAT return due?');
      // Whoever uses the keyboard stays where they were: the focus goes to the thanks, not to the top of the page.
      expect(document.activeElement).toBe(q('answer-thanks'));

      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect({ local: { ...localStorage }, session: { ...sessionStorage } }).toEqual(before);
    });

    it('the thanks belong to the answer shown: another answer asks the question again', async () => {
      await render('/help/vat-due');
      q('answer-yes')!.click();
      await settle();
      expect(q('answer-thanks')).not.toBeNull();

      // The same page shows the next answer (the address changes, as it does with the browser's back and forward).
      await render('/help/send-return');
      expect(text(q('answer-title'))).toBe('What happens when I send my VAT return?');
      expect(q('answer-thanks')).toBeNull();
      expect(text(q('answer-yes'))).toBe('Yes');

      // Coming back to the first one asks again too: nothing was kept.
      await render('/help/vat-due');
      expect(q('answer-thanks')).toBeNull();
      expect(q('answer-yes')).not.toBeNull();
    });

    it('No opens Write to us with the topic and the question', async () => {
      await render('/help/vat-due');
      const no = q('answer-no')!;
      expect(no.getAttribute('href')).toBe('/help/contact?topic=taxes&about=vat-due');
      no.click();
      await settle();
      expect(router().url).toBe('/help/contact?topic=taxes&about=vat-due');

      // The topic is the answer's own topic.
      const answer = HELP_ANSWERS.find((a) => a.id === 'connect-bank')!;
      await render('/help/connect-bank');
      expect(q('answer-no')!.getAttribute('href')).toBe(
        `/help/contact?topic=${answer.topic}&about=connect-bank`,
      );
    });
  });

  describe('the way back', () => {
    it('the breadcrumb returns to Help and to the topic', async () => {
      await render('/help/vat-due');
      const crumbs = q('answer-breadcrumb')!;
      expect(crumbs.tagName).toBe('NAV');
      expect(crumbs.getAttribute('aria-label')).toBe('Breadcrumb');
      expect(text(crumbs)).toBe('Help · Taxes and year-end');

      const help = q('answer-crumb-help')!;
      const topic = q('answer-crumb-topic')!;
      expect(text(help)).toBe('Help');
      expect(help.getAttribute('href')).toBe('/help');
      expect(text(topic)).toBe('Taxes and year-end');
      expect(topic.getAttribute('href')).toBe('/help?topic=taxes');

      topic.click();
      await settle();
      expect(router().url).toBe('/help?topic=taxes');
      expect(q('help-topic')).not.toBeNull();
      expect(text(q('help-topic')!.querySelector('h2'))).toBe('Taxes and year-end');

      // And the browser's back brings the answer again.
      await render('/help/vat-due');
      q('answer-crumb-help')!.click();
      await settle();
      expect(router().url).toBe('/help');
      expect(q('help-topics')).not.toBeNull();
    });

    it('names the topic of each answer', async () => {
      for (const answer of HELP_ANSWERS) {
        await render(`/help/${answer.id}`);
        expect(text(q('answer-crumb-topic')), answer.id).toBe(en.help.topics[answer.topic]);
        expect(q('answer-crumb-topic')!.getAttribute('href'), answer.id).toBe(
          `/help?topic=${answer.topic}`,
        );
      }
      expect(HELP_TOPICS.length).toBe(7);
    });
  });

  describe('an answer that does not exist', () => {
    it("an unknown answer says it doesn't exist and offers the way back", async () => {
      await render('/help/nope');
      expect(text(el.querySelector('h1'))).toBe("This answer doesn't exist");
      const missing = q('answer-missing')!;
      expect(text(missing)).toContain('Go back to Help to search or browse the topics.');
      const back = q('answer-missing-back')!;
      expect(text(back)).toBe('Back to Help');
      expect(back.getAttribute('href')).toBe('/help');

      // Nothing of an answer is left, and no topic is named.
      for (const id of [
        'answer-title',
        'answer-paragraph',
        'answer-term',
        'answer-open',
        'answer-feedback-title',
        'answer-yes',
        'answer-no',
        'answer-crumb-topic',
      ]) {
        expect(q(id), id).toBeNull();
      }

      back.click();
      await settle();
      expect(router().url).toBe('/help');
    });

    it('an answer opened after an unknown one shows normally, and the other way round', async () => {
      await render('/help/nope');
      expect(q('answer-missing')).not.toBeNull();
      await render('/help/vat-due');
      expect(q('answer-missing')).toBeNull();
      expect(text(q('answer-title'))).toBe('When is my VAT return due?');
      await render('/help/nope');
      expect(q('answer-title')).toBeNull();
      expect(q('answer-missing')).not.toBeNull();
    });

    it('an id that is a built-in property name is unknown too', async () => {
      await render('/help/constructor');
      expect(q('answer-missing')).not.toBeNull();
      await render('/help/__proto__');
      expect(q('answer-missing')).not.toBeNull();
    });
  });

  describe('reads in Arabic', () => {
    it('in Arabic: the question, the paragraphs and the buttons are Arabic, and the layout runs right to left', async () => {
      await render('/help/vat-due');
      await setLang('ar');
      const entry = ar.help.answers['vat-due'];
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe(entry.q);
      expect(paragraphs()).toEqual(paragraphsOf(entry.a));
      // German words in the text are plain text inside the Arabic sentence.
      expect(paragraphs()[0]).toContain('Dauerfristverlängerung');

      // The chips use the Arabic label, with the German original beside it left to right.
      const chip = qa('answer-term')[0];
      expect(text(chip)).toBe(`${ar.terms.ustva.label} (UStVA)`);
      expect(chip.querySelector('bdi')?.getAttribute('dir')).toBe('ltr');
      expect(text(q('answer-terms-title'))).toBe(ar.help.answer.termsTitle);

      expect(text(q('answer-open'))).toBe(
        ar.help.answer.open.replace('{{page}}', ar.help.pages.taxes),
      );
      expect(text(q('answer-feedback-title'))).toBe(ar.help.answer.feedbackTitle);
      expect(text(q('answer-yes'))).toBe(ar.help.answer.yes);
      expect(text(q('answer-no'))).toBe(ar.help.answer.no);
      expect(q('answer-breadcrumb')!.getAttribute('aria-label')).toBe(ar.help.answer.breadcrumb);
      expect(text(q('answer-crumb-help'))).toBe(ar.help.title);
      expect(text(q('answer-crumb-topic'))).toBe(ar.help.topics.taxes);

      q('answer-yes')!.click();
      await settle();
      expect(text(q('answer-thanks'))).toBe(ar.help.answer.thanks);
    });

    it('in Arabic the arrow of the way back turns round, and so does every arrow along the text', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/help/vat-due');
      const arrows = Array.from(
        el.querySelectorAll(
          'ng-icon[name="lucideChevronRight"], ng-icon[name="lucideChevronLeft"]',
        ),
      );
      expect(arrows.length).toBeGreaterThan(0);
      for (const arrow of arrows) {
        expect(arrow.classList.contains('rtl:rotate-180'), arrow.getAttribute('name')!).toBe(true);
      }
      expect(q('answer-crumb-help')!.querySelector('ng-icon')).not.toBeNull();
    });

    it('in Arabic an answer that does not exist says so in Arabic', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/help/nope');
      expect(text(el.querySelector('h1'))).toBe(ar.help.answer.missingTitle);
      expect(text(q('answer-missing-back'))).toBe(ar.help.answer.missingAction);
    });

    it('the language of an open answer can change, to German and back', async () => {
      await render('/help/connect-bank');
      await setLang('de');
      expect(text(el.querySelector('h1'))).toBe(de.help.answers['connect-bank'].q);
      expect(paragraphs()).toEqual(paragraphsOf(de.help.answers['connect-bank'].a));
      expect(text(q('answer-open'))).toBe(
        de.help.answer.open.replace('{{page}}', de.help.pages.settings),
      );
      expect(text(q('answer-yes'))).toBe(de.help.answer.yes);
      // In German a term is the German word alone.
      expect(qa('answer-term').map((chip) => text(chip))).toEqual(['Kontoauszug', 'CAMT']);
      await setLang('en');
      expect(text(el.querySelector('h1'))).toBe('How do I connect my bank?');
    });
  });

  it('the texts of the page exist in all three languages', () => {
    for (const lang of [en, de, ar]) {
      for (const [key, value] of Object.entries(lang.help.answer)) {
        expect(value, key).not.toBe('');
      }
    }
    expect(Object.keys(de.help.answer).sort()).toEqual(Object.keys(en.help.answer).sort());
    expect(Object.keys(ar.help.answer).sort()).toEqual(Object.keys(en.help.answer).sort());
  });
});
