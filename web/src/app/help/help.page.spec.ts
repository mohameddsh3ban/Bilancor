import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { TERM_KEYS } from '../core/i18n/term-keys';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { HELP_ANSWERS, HELP_TOPICS, PAGE_QUESTIONS, type HelpPage } from '../data/help';
import { DemoStateService } from '../state/demo-state.service';
import { signInAsSara } from '../state/account.testing';
import { HelpContextService } from '../state/help-context.service';
import { HelpPage as HelpPageComponent } from './help.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

/** Stands in for every page Help links to, and for the pages a visit starts on. */
@Component({ template: '' })
class Elsewhere {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

describe('HelpPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: 'help', component: HelpPageComponent },
          { path: '**', component: Elsewhere },
        ]),
      ],
    });
    signInAsSara();
    demo = TestBed.inject(DemoStateService);
    // The app shell starts it, so it has seen the page before Help; do the same here, before the first navigation.
    TestBed.inject(HelpContextService);
  });

  afterEach(() => {
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

  /** Opens Help (`url`), coming from the page `from` (a visit that starts on it), or as the first page of the visit. A later call goes on in the same visit. */
  async function render(url = '/help', from: string | null = null): Promise<void> {
    if (harness) {
      await harness.navigateByUrl(url);
    } else if (from === null) {
      harness = await RouterTestingHarness.create(url);
    } else {
      harness = await RouterTestingHarness.create(from);
      await harness.navigateByUrl(url);
    }
    await settle();
  }

  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const router = () => TestBed.inject(Router);
  /** The title and the questions of the "Help with …" card, as they read. */
  const forPage = () => ({
    title: text(q('help-for-page-title')),
    because: q('help-because') ? text(q('help-because')) : null,
    hrefs: qa('help-for-page-question').map((a) => a.getAttribute('href')),
    questions: qa('help-for-page-question').map((a) => text(a)),
  });

  /** Every row of the search results, answers and terms. */
  const resultRows = () =>
    Array.from(el.querySelectorAll<HTMLElement>('[data-testid="help-results"] a'));

  async function search(query: string): Promise<void> {
    const input = q('help-search') as HTMLInputElement;
    input.value = query;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function setLang(lang: 'en' | 'de' | 'ar'): Promise<void> {
    TestBed.inject(LanguageService).setLang(lang);
    await settle();
  }

  const topicLink = (topic: string) =>
    qa('help-topic-link').find((a) => a.dataset['topic'] === topic)!;

  it('has a title and a search box, and shows the page, the topics, German terms A–Z, Write to us and the tax-advice note', async () => {
    await render();
    expect(text(el.querySelector('h1'))).toBe('Help');
    const input = q('help-search') as HTMLInputElement;
    expect(input.getAttribute('aria-label')).toBe('Search help');
    expect(input.placeholder).toBe('What do you need help with?');
    for (const id of [
      'help-for-page',
      'help-topics',
      'help-terms-card',
      'help-contact-card',
      'help-note',
    ]) {
      expect(q(id), id).not.toBeNull();
    }
    expect(q('help-results')).toBeNull();
    expect(q('help-nothing')).toBeNull();
  });

  describe('help for the page the person came from', () => {
    it('coming from Taxes shows Help with Taxes and its three questions', async () => {
      await render('/help', '/taxes');
      expect(forPage()).toEqual({
        title: 'Help with Taxes',
        because: 'Because you came from Taxes.',
        hrefs: ['/help/vat-due', '/help/send-return', '/help/payment-blocks-send'],
        questions: [
          'When is my VAT return due?',
          'What happens when I send my VAT return?',
          'Why does a payment stop me sending my VAT return?',
        ],
      });
    });

    it('a Kleinunternehmer coming from Taxes sees the limit first', async () => {
      demo.setBusiness('sara-yoga');
      expect(demo.business().taxProfile.kleinunternehmer).toBe(true);
      await render('/help', '/taxes');
      const help = forPage();
      expect(help.title).toBe('Help with Taxes');
      expect(help.hrefs).toEqual([
        '/help/klein-limit',
        '/help/close-month',
        '/help/export-advisor',
      ]);
      expect(help.questions[0]).toBe('What is the Kleinunternehmer limit?');
    });

    it('a business that charges VAT gets the VAT return questions, and the list follows the business that is open', async () => {
      demo.setBusiness('sara-yoga');
      await render('/help', '/taxes');
      expect(forPage().hrefs[0]).toBe('/help/klein-limit');
      demo.setBusiness('weber-design');
      await settle();
      expect(forPage().hrefs[0]).toBe('/help/vat-due');
    });

    // One test for each page the visit can come from, so each one starts a visit of its own.
    const comingFrom: [string, HelpPage, string][] = [
      ['/payments', 'payments', 'Payments'],
      ['/payments/wd-t3', 'payments', 'Payments'],
      ['/review', 'payments', 'Payments'],
      ['/documents', 'documents', 'Documents'],
      ['/invoices/new', 'invoices', 'Invoices'],
      ['/reports', 'reports', 'Reports'],
      ['/settings/tax', 'settings', 'Settings'],
      // My account belongs to Settings, so it gets Help with Settings (Your account and people).
      ['/account', 'settings', 'Settings'],
    ];
    for (const [url, page, name] of comingFrom) {
      it(`coming from ${url} shows Help with ${name} and the questions of its list`, async () => {
        await render('/help', url);
        const help = forPage();
        expect(help.title).toBe(`Help with ${name}`);
        expect(help.because).toBe(`Because you came from ${name}.`);
        expect(help.hrefs.map((href) => href!.replace('/help/', ''))).toEqual(PAGE_QUESTIONS[page]);
      });
    }

    // Help is the first page of the visit (null), the homepage, a printout, and pages Help has no questions for.
    const unknownPages: (string | null)[] = [
      null,
      '/',
      '/print/month',
      '/businesses/new',
      '/soon/anything',
    ];
    for (const from of unknownPages) {
      it(`an unknown or missing last page shows Getting started (${from ?? 'no page before Help'})`, async () => {
        await render('/help', from);
        const help = forPage();
        expect(help.title).toBe('Getting started');
        expect(help.because).toBeNull();
        expect(help.hrefs).toEqual([
          '/help/setup-steps',
          '/help/switch-business',
          '/help/change-language',
        ]);
        expect(help.questions).toEqual([
          'What are the three setup steps?',
          'How do I switch between my businesses?',
          "How do I change the app's language?",
        ]);
      });
    }

    it("Help's own pages do not change the page: going around Help and coming back still shows where the visit began", async () => {
      await render('/help', '/taxes');
      await harness!.navigateByUrl('/help?topic=payments');
      await settle();
      expect(forPage().title).toBe('Help with Taxes');
      await harness!.navigateByUrl('/help/terms');
      await harness!.navigateByUrl('/help');
      await settle();
      expect(forPage().title).toBe('Help with Taxes');
    });
  });

  describe('topics', () => {
    it('lists the seven topics, each with how many answers it holds, and the counts add up to every answer', async () => {
      await render();
      const rows = qa('help-topic-link');
      expect(rows.map((a) => a.getAttribute('data-topic'))).toEqual([...HELP_TOPICS]);
      expect(
        rows.map((a) => a.querySelector('[data-testid="help-topic-name"]')?.textContent?.trim()),
      ).toEqual(HELP_TOPICS.map((topic) => en.help.topics[topic]));
      const counts = rows.map((a) =>
        Number(text(a.querySelector('[data-testid="help-topic-count"]'))),
      );
      expect(counts).toEqual(
        HELP_TOPICS.map((topic) => HELP_ANSWERS.filter((a) => a.topic === topic).length),
      );
      expect(counts.reduce((sum, n) => sum + n, 0)).toBe(HELP_ANSWERS.length);
      expect(rows[0].getAttribute('href')).toBe('/help?topic=start');
      // The number also reads as words for a screen reader.
      expect(text(rows[1])).toContain('4 answers');
    });

    it('a topic shows its questions at ?topic= and back to all topics', async () => {
      await render();
      topicLink('payments').click();
      await settle();
      expect(router().url).toBe('/help?topic=payments');
      expect(q('help-topics')).toBeNull();
      const topic = q('help-topic')!;
      expect(text(topic.querySelector('h2'))).toBe('Bank and payments');
      const links = Array.from(topic.querySelectorAll('[data-testid="help-topic-question"]'));
      expect(links.map((a) => a.getAttribute('href'))).toEqual([
        '/help/connect-bank',
        '/help/renew-bank',
        '/help/payment-needs',
        '/help/private-payment',
      ]);
      expect(links.map((a) => text(a))).toEqual([
        'How do I connect my bank?',
        'What does Renew mean on a bank connection?',
        'What does a payment need from me?',
        'What if a payment was private?',
      ]);
      // The other cards stay.
      expect(q('help-terms-card')).not.toBeNull();

      const back = q('help-all-topics')!;
      expect(text(back)).toBe('All topics');
      expect(back.getAttribute('href')).toBe('/help');
      back.click();
      await settle();
      expect(router().url).toBe('/help');
      expect(q('help-topic')).toBeNull();
      expect(qa('help-topic-link')).toHaveLength(HELP_TOPICS.length);
    });

    it('opens every topic with exactly its answers', async () => {
      for (const topic of HELP_TOPICS) {
        await render(`/help?topic=${topic}`);
        expect(text(q('help-topic')!.querySelector('h2')), topic).toBe(en.help.topics[topic]);
        expect(
          qa('help-topic-question').map((a) => a.getAttribute('href')!.replace('/help/', '')),
          topic,
        ).toEqual(HELP_ANSWERS.filter((a) => a.topic === topic).map((a) => a.id));
      }
    });

    it('an unknown topic shows all topics', async () => {
      await render('/help?topic=nope');
      expect(q('help-topic')).toBeNull();
      expect(q('help-topics')).not.toBeNull();
      expect(qa('help-topic-link')).toHaveLength(HELP_TOPICS.length);
      await render('/help?topic=');
      expect(q('help-topic')).toBeNull();
      expect(qa('help-topic-link')).toHaveLength(HELP_TOPICS.length);
    });
  });

  describe('search', () => {
    it('search shows answers and terms, and a term opens A–Z at it', async () => {
      await render();
      await search('Eigenbeleg');
      // While there is a search, the page's own help and the cards give way to the results.
      for (const id of [
        'help-for-page',
        'help-topics',
        'help-terms-card',
        'help-contact-card',
        'help-note',
      ]) {
        expect(q(id), id).toBeNull();
      }
      const rows = resultRows();
      const kinds = rows.map((r) => r.getAttribute('data-kind'));
      expect(kinds).toContain('answer');
      expect(kinds).toContain('term');
      // Answers come before terms.
      expect(kinds.lastIndexOf('answer')).toBeLessThan(kinds.indexOf('term'));

      const answer = q('help-result-self-issued')!;
      expect(answer.getAttribute('href')).toBe('/help/self-issued');
      expect(text(answer)).toContain('What is a self-issued receipt (Eigenbeleg)?');
      expect(text(answer)).toContain('Receipts and documents');

      const term = q('help-result-term-eigenbeleg')!;
      expect(term.getAttribute('href')).toBe('/help/terms#eigenbeleg');
      expect(text(term)).toContain('Self-issued receipt (Eigenbeleg)');
      expect(text(term)).toContain('Term');
      expect(term.querySelector('bdi[dir="ltr"]')?.textContent).toBe('Eigenbeleg');

      expect(text(q('help-found'))).toBe(`${rows.length} results`);
    });

    it('finds a German word however it is spelled: with an umlaut, spelled out or without it', async () => {
      await render();
      for (const query of [
        'Übertragungsprotokoll',
        'uebertragungsprotokoll',
        'ubertragung',
        '  ÜBERTRAGUNG ',
      ]) {
        await search(query);
        expect(q('help-result-term-uebertragungsprotokoll'), query).not.toBeNull();
      }
    });

    it('says how many results there are, in the singular too', async () => {
      await render();
      await search('Leitweg-ID');
      const rows = resultRows();
      expect(rows.length).toBeGreaterThan(0);
      expect(text(q('help-found'))).toBe(rows.length === 1 ? '1 result' : `${rows.length} results`);
    });

    it('a blank search is no search: all spaces, or cleared, show the normal page and never Nothing found', async () => {
      await render();
      await search('   ');
      expect(q('help-nothing')).toBeNull();
      expect(q('help-results')).toBeNull();
      expect(q('help-for-page')).not.toBeNull();
      expect(q('help-topics')).not.toBeNull();

      await search('invoice');
      expect(q('help-for-page')).toBeNull();
      await search('');
      expect(q('help-for-page')).not.toBeNull();
      expect(q('help-topics')).not.toBeNull();
    });

    it('nothing found offers Write to us with the query', async () => {
      await render();
      await search('  xyzzy plugh ');
      expect(q('help-results')).toBeNull();
      const nothing = q('help-nothing')!;
      expect(text(nothing.querySelector('h2'))).toBe('Nothing found');
      expect(q('help-for-page')).toBeNull();
      const write = q('help-nothing-write')!;
      expect(text(write)).toBe('Write to us');
      // What was typed goes on, without the spaces around it.
      expect(write.getAttribute('href')).toBe('/help/contact?q=xyzzy%20plugh');
      expect(q('help-found')).toBeNull();
    });

    it('opens an answer from the results', async () => {
      await render();
      await search('vat return due');
      const hit = q('help-result-vat-due')!;
      expect(hit.getAttribute('href')).toBe('/help/vat-due');
      hit.click();
      await settle();
      expect(router().url).toBe('/help/vat-due');
    });

    it('searches the language of the page, and starts again when the language changes', async () => {
      await render();
      await search('connect my bank');
      expect(q('help-result-connect-bank')).not.toBeNull();

      await setLang('de');
      expect(q('help-result-connect-bank')).toBeNull();
      expect(q('help-nothing')).not.toBeNull();

      await search('verbinde');
      expect(q('help-result-connect-bank')).not.toBeNull();
      expect(text(q('help-result-connect-bank'))).toContain('Wie verbinde ich meine Bank?');
      expect(text(q('help-result-connect-bank'))).toContain('Bank und Zahlungen');

      await setLang('en');
      expect(q('help-result-connect-bank')).toBeNull();
      expect(q('help-nothing')).not.toBeNull();
    });

    it('a search while a topic is open shows the results, and clearing it brings the topic back', async () => {
      await render('/help?topic=taxes');
      expect(q('help-topic')).not.toBeNull();
      await search('limit');
      expect(q('help-topic')).toBeNull();
      expect(q('help-result-klein-limit')).not.toBeNull();
      await search('');
      expect(q('help-topic')).not.toBeNull();
    });
  });

  it('the A–Z card counts TERM_KEYS and opens the list', async () => {
    await render();
    const card = q('help-terms-card')!;
    expect(text(card.querySelector('h2'))).toBe('German terms A–Z');
    expect(text(q('help-terms-body'))).toBe(
      `${TERM_KEYS.length} words from letters and forms, explained.`,
    );
    const link = q('help-terms-link')!;
    expect(text(link)).toBe('Open the list');
    expect(link.getAttribute('href')).toBe('/help/terms');
  });

  it('the Write to us card says which languages we answer in and opens the form', async () => {
    await render();
    const card = q('help-contact-card')!;
    expect(text(card.querySelector('h2'))).toBe('Write to us');
    expect(text(card)).toContain('We answer in English, German or Arabic.');
    const link = q('help-contact-link')!;
    expect(text(link)).toBe('Write a message');
    expect(link.getAttribute('href')).toBe('/help/contact');
  });

  it('the tax-advice note links to People with access', async () => {
    await render();
    const note = q('help-note')!;
    expect(text(note)).toContain(
      'We explain how the app works and what German terms mean. For advice on your own taxes, ask a tax advisor (Steuerberater:in).',
    );
    // The German word stays left to right inside the sentence.
    expect(note.querySelector('bdi[dir="ltr"]')?.textContent).toBe('Steuerberater:in');
    const invite = q('help-invite-advisor')!;
    expect(text(invite)).toBe('Invite your tax advisor');
    expect(invite.getAttribute('href')).toBe('/settings#people');
    invite.click();
    await settle();
    expect(router().url).toBe('/settings#people');
  });

  it('every link on the page goes to an address of Help or of the app', async () => {
    await render('/help', '/taxes');
    const hrefs = Array.from(el.querySelectorAll('a')).map((a) => a.getAttribute('href')!);
    expect(hrefs.length).toBeGreaterThan(10);
    for (const href of hrefs) expect(href, href).toMatch(/^\/(help|settings)/);
  });

  describe('reads in Arabic', () => {
    it('in Arabic: the page, the topics and the cards are Arabic, and the layout runs right to left', async () => {
      await render('/help', '/taxes');
      await setLang('ar');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe(ar.help.title);
      expect((q('help-search') as HTMLInputElement).placeholder).toBe(
        ar.help.home.searchPlaceholder,
      );
      expect(text(q('help-for-page-title'))).toBe(
        ar.help.home.forPage.replace('{{page}}', ar.help.pages.taxes),
      );
      expect(text(q('help-because'))).toBe(
        ar.help.home.because.replace('{{page}}', ar.help.pages.taxes),
      );
      expect(qa('help-for-page-question').map((a) => text(a))).toEqual(
        ['vat-due', 'send-return', 'payment-blocks-send'].map(
          (id) => ar.help.answers[id as 'vat-due'].q,
        ),
      );
      expect(qa('help-topic-name').map((n) => text(n))).toEqual(
        HELP_TOPICS.map((t) => ar.help.topics[t]),
      );
      expect(text(q('help-terms-body'))).toBe(
        ar.help.home.termsBody.replace('{{count}}', String(TERM_KEYS.length)),
      );
      // Arrows that point along the text turn round.
      const arrows = Array.from(
        el.querySelectorAll(
          'ng-icon[name="lucideChevronRight"], ng-icon[name="lucideChevronLeft"]',
        ),
      );
      expect(arrows.length).toBeGreaterThan(5);
      for (const arrow of arrows) {
        expect(arrow.classList.contains('rtl:rotate-180'), arrow.getAttribute('name')!).toBe(true);
      }
    });

    it('in Arabic an open topic is in Arabic too, and its way back turns round', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/help?topic=payments');
      expect(text(q('help-topic')!.querySelector('h2'))).toBe(ar.help.topics.payments);
      expect(text(q('help-all-topics'))).toBe(ar.help.home.allTopics);
      expect(
        q('help-all-topics')!.querySelector('ng-icon')!.classList.contains('rtl:rotate-180'),
      ).toBe(true);
      expect(qa('help-topic-question').map((a) => text(a))).toEqual(
        ['connect-bank', 'renew-bank', 'payment-needs', 'private-payment'].map(
          (id) => ar.help.answers[id as 'connect-bank'].q,
        ),
      );
    });

    it('in Arabic the German word of the tax-advice note and of a term in the results stay left to right', async () => {
      await render();
      await setLang('ar');
      expect(q('help-note')!.querySelector('bdi[dir="ltr"]')?.textContent).toBe('Steuerberater:in');
      expect(text(q('help-note'))).toContain(ar.help.home.taxNote.split('.')[0]);
      expect(q('help-invite-advisor')!.textContent?.trim()).toBe(ar.help.home.taxAction);

      await search('eigenbeleg');
      const term = q('help-result-term-eigenbeleg')!;
      expect(term.querySelector('bdi[dir="ltr"]')?.textContent).toBe('Eigenbeleg');
      expect(text(term)).toContain(ar.help.home.term);
      expect(text(q('help-found'))).toMatch(/\d+ نتائج|نتيجة واحدة/);

      await search('xyzzy');
      expect(text(q('help-nothing')!.querySelector('h2'))).toBe(ar.help.home.nothingTitle);
    });
  });

  it('names every page Help knows, with the words of the menu', () => {
    const pages: Record<HelpPage, keyof typeof en.menu> = {
      start: 'home',
      payments: 'payments',
      documents: 'documents',
      invoices: 'invoices',
      taxes: 'taxes',
      reports: 'reports',
      settings: 'settings',
    };
    for (const lang of [en, de, ar]) {
      for (const [page, menu] of Object.entries(pages)) {
        expect(lang.help.pages[page as HelpPage], `${page}`).toBe(lang.menu[menu]);
      }
    }
  });
});
