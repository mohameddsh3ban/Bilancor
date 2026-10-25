import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { SafeStorage } from '../core/storage/safe-storage';
import { HELP_ANSWERS, HELP_TOPICS } from '../data/help';
import { PERSON } from '../data/sample-person';
import { AccountService } from '../state/account.service';
import { signInAsSara } from '../state/account.testing';
import { HelpAnswerPage } from './answer.page';
import { HelpContactPage } from './contact.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

/** Stands in for the pages Write to us links to (Help, Settings). */
@Component({ template: '' })
class Elsewhere {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';

const LANGS = { en, de, ar } as const;

describe('HelpContactPage', () => {
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    harness = undefined;
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        // The routes of the app in their order: the fixed path of Write to us comes above help/:id.
        provideRouter([
          { path: 'help/contact', component: HelpContactPage },
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

  /** Opens an address; a later call goes on in the same visit (the same page when the path is the same). */
  async function render(url = '/help/contact'): Promise<void> {
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
  const router = () => TestBed.inject(Router);
  const topic = () => q('contact-topic') as HTMLSelectElement;
  const message = () => q('contact-message') as HTMLTextAreaElement;

  async function pickTopic(value: string): Promise<void> {
    topic().value = value;
    topic().dispatchEvent(new Event('change'));
    await settle();
  }

  /** Types into the message, the way a person does. */
  async function typeMessage(value: string): Promise<void> {
    message().value = value;
    message().dispatchEvent(new Event('input'));
    await settle();
  }

  async function send(): Promise<void> {
    q('contact-send')!.click();
    await settle();
  }

  it('shows an empty form: a topic still to choose, an empty message, Send, the demo box and the support line', async () => {
    await render();
    expect(el.querySelectorAll('h1')).toHaveLength(1);
    expect(text(q('contact-title'))).toBe('Write to us');
    expect(text(q('contact-back'))).toBe('Help');
    expect(q('contact-back')!.getAttribute('href')).toBe('/help');

    // The topic: nothing chosen, then the seven topics in Help's order, then Something else.
    expect(text(el.querySelector('label:has([data-testid="contact-topic"]) > span'))).toBe('Topic');
    expect(topic().value).toBe('');
    const options = Array.from(topic().options);
    expect(options.map((option) => option.value)).toEqual(['', ...HELP_TOPICS, 'other']);
    expect(options.map((option) => option.textContent!.trim())).toEqual([
      'Choose a topic',
      ...HELP_TOPICS.map((id) => en.help.topics[id]),
      'Something else',
    ]);

    expect(text(el.querySelector('label:has([data-testid="contact-message"]) > span'))).toBe(
      'Your message',
    );
    expect(message().value).toBe('');
    expect(message().getAttribute('aria-required')).toBe('true');
    expect(q('contact-error-message')).toBeNull();
    expect(text(q('contact-send'))).toBe('Send');
    expect(q('contact-send')!.getAttribute('type')).toBe('submit');
    expect(q('contact-sent')).toBeNull();

    // The demo box says nothing is sent, and sits after the form.
    expect(text(q('contact-demo'))).toBe('Demo Nothing is really sent in this demo.');
    expect(
      q('contact-form')!.compareDocumentPosition(q('contact-demo')!) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    // The support line names the app's own pages and links to the People card.
    expect(text(q('contact-support'))).toBe(
      'To let us look at your books while we help: Settings › People with access › Let support look',
    );
    expect(q('contact-support-link')!.getAttribute('href')).toBe('/settings#people');
  });

  describe("the form starts with the topic and question from an answer's No", () => {
    it('chooses the topic and fills in "About: <question>" with a blank line after it', async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      expect(topic().value).toBe('taxes');
      expect(topic().selectedOptions[0].textContent!.trim()).toBe('Taxes and year-end');
      expect(message().value).toBe('About: When is my VAT return due?\n\n');
      // Nothing is asked of the person yet: no message about what's missing.
      expect(q('contact-error-message')).toBeNull();
    });

    it('is what the real answer page opens: No, write to us', async () => {
      harness = await RouterTestingHarness.create('/help/connect-bank');
      await settle();
      q('answer-no')!.click();
      await settle();
      expect(router().url).toBe('/help/contact?topic=payments&about=connect-bank');
      expect(el.tagName.toLowerCase()).toBe('app-help-contact-page');
      expect(topic().value).toBe('payments');
      expect(message().value).toBe('About: How do I connect my bank?\n\n');
    });

    it('accepts every topic of Help and Something else', async () => {
      for (const id of [...HELP_TOPICS, 'other']) {
        await render(`/help/contact?topic=${id}`);
        expect(topic().value, id).toBe(id);
      }
    });

    it('leaves the topic to the person for one that does not exist, and ignores an answer that does not exist', async () => {
      await render('/help/contact?topic=astrology&about=no-such-answer');
      expect(topic().value).toBe('');
      expect(message().value).toBe('');
      await render('/help/contact?about=vat-due');
      expect(topic().value).toBe('');
      expect(message().value).toBe('About: When is my VAT return due?\n\n');
    });

    it('writes the question in the language of the page, German and Arabic too', async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      await setLang('de');
      expect(message().value).toBe(
        `${de.help.contact.about.replace('{{question}}', de.help.answers['vat-due'].q)}\n\n`,
      );
      expect(message().value.startsWith('Betrifft: ')).toBe(true);
      await setLang('ar');
      expect(message().value).toBe(
        `${ar.help.contact.about.replace('{{question}}', ar.help.answers['vat-due'].q)}\n\n`,
      );
    });

    it('every answer is one the form can start from', async () => {
      for (const answer of HELP_ANSWERS) {
        await render(`/help/contact?topic=${answer.topic}&about=${answer.id}`);
        expect(topic().value, answer.id).toBe(answer.topic);
        expect(message().value, answer.id).toBe(
          `About: ${en.help.answers[answer.id as keyof typeof en.help.answers].q}\n\n`,
        );
      }
    });
  });

  describe("a search's text carries into the message", () => {
    it('puts what was typed in the search into the message', async () => {
      await render('/help/contact?q=xyzzy%20plugh');
      expect(message().value).toBe('xyzzy plugh');
      expect(topic().value).toBe('');
    });

    it('goes after the answer line when both come with the address', async () => {
      await render('/help/contact?topic=taxes&about=vat-due&q=Is%20it%20the%2010th%3F');
      expect(message().value).toBe('About: When is my VAT return due?\n\nIs it the 10th?');
    });

    it('keeps the text as typed: no markup, no trimming', async () => {
      await render('/help/contact?q=%3Cb%3Ebold%3C%2Fb%3E%20%26%20%20two%20spaces');
      expect(message().value).toBe('<b>bold</b> &  two spaces');
    });

    it('an empty search text adds nothing', async () => {
      await render('/help/contact?q=');
      expect(message().value).toBe('');
    });
  });

  describe('what the person typed stays', () => {
    it('is kept when the language changes, while a text nobody touched follows the language', async () => {
      await render('/help/contact?about=vat-due');
      await typeMessage('My own words about the VAT return.');
      await setLang('de');
      expect(message().value).toBe('My own words about the VAT return.');
    });

    it("is forgotten when another address opens the form (the browser's back and forward)", async () => {
      await render('/help/contact?q=first');
      await typeMessage('something I wrote');
      await pickTopic('invoices');
      await render('/help/contact?q=second');
      expect(message().value).toBe('second');
      expect(topic().value).toBe('');
    });
  });

  describe("an empty or too short message says what's missing", () => {
    it('says the message is needed when it is empty, and puts the cursor there', async () => {
      await render();
      await send();
      const error = q('contact-error-message')!;
      expect(text(error)).toBe('Write your message.');
      expect(error.getAttribute('role')).toBe('alert');
      expect(message().getAttribute('aria-invalid')).toBe('true');
      expect(message().getAttribute('aria-describedby')).toBe(error.id);
      expect(document.activeElement).toBe(message());
      // Nothing was sent.
      expect(q('contact-sent')).toBeNull();
      expect(q('contact-form')).not.toBeNull();
    });

    it('treats a message of only spaces and blank lines as empty', async () => {
      await render();
      await typeMessage('   \n\n  ');
      await send();
      expect(text(q('contact-error-message'))).toBe('Write your message.');
    });

    it('says how many characters it needs when it is shorter than 10 after trimming', async () => {
      await render();
      await typeMessage('  too short ');
      await send();
      expect(text(q('contact-error-message'))).toBe('Write at least 10 characters.');
      expect(message().getAttribute('aria-invalid')).toBe('true');
      expect(q('contact-sent')).toBeNull();

      // Nine characters between the spaces: still too short.
      await typeMessage('   123456789   ');
      await send();
      expect(text(q('contact-error-message'))).toBe('Write at least 10 characters.');
    });

    it('goes as soon as the person types, and asks again on the next Send', async () => {
      await render();
      await send();
      expect(q('contact-error-message')).not.toBeNull();
      await typeMessage('h');
      expect(q('contact-error-message')).toBeNull();
      expect(message().getAttribute('aria-invalid')).toBeNull();
      expect(message().getAttribute('aria-describedby')).toBeNull();
      await send();
      expect(text(q('contact-error-message'))).toBe('Write at least 10 characters.');
    });

    it('sends a message of exactly 10 characters once trimmed', async () => {
      await render();
      await typeMessage('  1234567890  ');
      await send();
      expect(q('contact-error-message')).toBeNull();
      expect(q('contact-sent')).not.toBeNull();
    });

    it('does not count the topic: a chosen topic with no message still asks for the message', async () => {
      await render('/help/contact?topic=taxes');
      await send();
      expect(text(q('contact-error-message'))).toBe('Write your message.');
    });

    it('says it in German and Arabic', async () => {
      await render();
      await setLang('de');
      await send();
      expect(text(q('contact-error-message'))).toBe(de.help.contact.error.missing);
      await typeMessage('kurz');
      await send();
      expect(text(q('contact-error-message'))).toBe(
        de.help.contact.error.short.replace('{{min}}', '10'),
      );
      await setLang('ar');
      // The language changed under the message: it is asked again in Arabic.
      await send();
      expect(text(q('contact-error-message'))).toBe(
        ar.help.contact.error.short.replace('{{min}}', '10'),
      );
    });
  });

  describe('Send shows Sent and stores nothing', () => {
    it('shows Sent and a way back to Help in place of the form, and the demo box stays', async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      await typeMessage('About: When is my VAT return due?\n\nIs it the 10th even on a Sunday?');
      await send();

      expect(text(q('contact-sent'))).toBe("Sent. You'll find our answer in your email.");
      expect(q('contact-form')).toBeNull();
      expect(q('contact-send')).toBeNull();
      expect(q('contact-message')).toBeNull();
      const back = q('contact-sent-back')!;
      expect(text(back)).toBe('Back to Help');
      expect(back.getAttribute('href')).toBe('/help');
      // The cursor goes to what happened, so the keyboard stays on the page.
      expect(document.activeElement).toBe(q('contact-sent'));
      // Still a demo: the box and the support line stay.
      expect(q('contact-demo')).not.toBeNull();
      expect(q('contact-support-link')).not.toBeNull();

      back.click();
      await settle();
      expect(router().url).toBe('/help');
    });

    it("sends straight from an answer's No without typing: the About line counts as the message", async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      expect(message().value).toBe('About: When is my VAT return due?\n\n');
      await send();
      expect(text(q('contact-sent'))).toBe("Sent. You'll find our answer in your email.");
      expect(q('contact-form')).toBeNull();
      expect(q('contact-error-message')).toBeNull();
    });

    it('sends without a topic: only the message is needed', async () => {
      await render();
      await typeMessage('I cannot find where to change my phone number.');
      await send();
      expect(text(q('contact-sent'))).toBe("Sent. You'll find our answer in your email.");
    });

    it('stores nothing and sends nothing: no browser storage, no SafeStorage write, no request', async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      await pickTopic('invoices');
      await typeMessage('A message that must go nowhere at all.');

      const setItem = vi.spyOn(Storage.prototype, 'setItem');
      const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
      const safeSet = vi.spyOn(SafeStorage.prototype, 'set');
      const safeRemove = vi.spyOn(SafeStorage.prototype, 'remove');
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      const xhrSend = vi.spyOn(XMLHttpRequest.prototype, 'send');
      const beacon =
        typeof navigator.sendBeacon === 'function' ? vi.spyOn(navigator, 'sendBeacon') : null;
      const before = { local: { ...localStorage }, session: { ...sessionStorage } };

      await send();
      expect(q('contact-sent')).not.toBeNull();

      expect(setItem).not.toHaveBeenCalled();
      expect(removeItem).not.toHaveBeenCalled();
      expect(safeSet).not.toHaveBeenCalled();
      expect(safeRemove).not.toHaveBeenCalled();
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(xhrSend).not.toHaveBeenCalled();
      expect(beacon?.mock.calls ?? []).toEqual([]);
      expect({ local: { ...localStorage }, session: { ...sessionStorage } }).toEqual(before);
      // The address did not change either: the message is not in it.
      expect(router().url).toBe('/help/contact?topic=taxes&about=vat-due');
    });

    it('reloading the page shows the empty form again', async () => {
      await render();
      await typeMessage('A message sent just before the reload.');
      await send();
      expect(q('contact-sent')).not.toBeNull();

      // A reload: the page is built again from the address alone.
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          provideTranslocoTesting(),
          provideRouter([{ path: 'help/contact', component: HelpContactPage }]),
        ],
      });
      signInAsSara();
      harness = undefined;
      await render();
      expect(q('contact-sent')).toBeNull();
      expect(q('contact-form')).not.toBeNull();
      expect(message().value).toBe('');
      expect(topic().value).toBe('');
    });

    it('the Sent state belongs to the address: another address asks the form again', async () => {
      await render('/help/contact?q=one');
      await typeMessage('A message long enough to send.');
      await send();
      expect(q('contact-sent')).not.toBeNull();
      await render('/help/contact?q=two');
      expect(q('contact-sent')).toBeNull();
      expect(message().value).toBe('two');
    });
  });

  describe("the reply line uses the signed-in person's email", () => {
    it('says where the answer goes, with the email set left to right', async () => {
      await render();
      const line = q('contact-reply')!;
      expect(text(line)).toBe('We answer to sara@example.com, usually within 1 working day.');
      const email = line.querySelector('bdi');
      expect(email?.getAttribute('dir')).toBe('ltr');
      expect(text(email)).toBe(PERSON.email);
      // The reply line sits between the message and Send.
      expect(
        q('contact-message')!.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        line.compareDocumentPosition(q('contact-send')!) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it('follows the email of the person who is signed in, also after it changes', async () => {
      const account = TestBed.inject(AccountService);
      await render();
      account.updatePerson(PERSON.id, (person) => ({ ...person, email: 'sara.new@example.org' }));
      await settle();
      expect(text(q('contact-reply'))).toBe(
        'We answer to sara.new@example.org, usually within 1 working day.',
      );
      expect(text(q('contact-reply')!.querySelector('bdi'))).toBe('sara.new@example.org');
    });

    it("does not offer a field for the email: the answer goes to the account's email", async () => {
      await render();
      expect(el.querySelector('input')).toBeNull();
      expect(el.querySelectorAll('select, textarea')).toHaveLength(2);
    });
  });

  describe('reads in Arabic', () => {
    it('reads in Arabic: the labels, the topics, the email left to right and the mirrored arrow', async () => {
      await render('/help/contact?topic=taxes&about=vat-due');
      await setLang('ar');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('contact-title'))).toBe(ar.help.contact.title);
      expect(text(q('contact-back'))).toBe(ar.help.title);
      expect(
        q('contact-back')!.querySelector('ng-icon')!.classList.contains('rtl:rotate-180'),
      ).toBe(true);
      expect(text(el.querySelector('label:has([data-testid="contact-topic"]) > span'))).toBe(
        ar.help.contact.topic.label,
      );
      expect(text(el.querySelector('label:has([data-testid="contact-message"]) > span'))).toBe(
        ar.help.contact.message.label,
      );
      expect(Array.from(topic().options).map((option) => option.textContent!.trim())).toEqual([
        ar.help.contact.topic.placeholder,
        ...HELP_TOPICS.map((id) => ar.help.topics[id]),
        ar.help.contact.topic.other,
      ]);
      expect(topic().value).toBe('taxes');
      expect(message().value).toBe(
        `${ar.help.contact.about.replace('{{question}}', ar.help.answers['vat-due'].q)}\n\n`,
      );
      // The message takes the direction of what is written, so Arabic reads from the right and English from the left.
      expect(message().getAttribute('dir')).toBe('auto');

      const reply = q('contact-reply')!;
      const [before, after] = ar.help.contact.reply.split('{{email}}');
      expect(text(reply)).toBe(`${before}${PERSON.email}${after}`);
      expect(reply.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');

      expect(text(q('contact-send'))).toBe(ar.help.contact.send);
      expect(text(q('contact-demo'))).toBe(
        `${ar.help.contact.demo.label} ${ar.help.contact.demo.text}`,
      );
      expect(text(q('contact-support'))).toBe(
        `${ar.help.contact.support.text} ${ar.help.contact.support.path
          .replace('{{settings}}', ar.settings.title)
          .replace('{{people}}', ar.people.title)}`,
      );
      expect(q('contact-support-link')!.getAttribute('href')).toBe('/settings#people');
    });

    it('an empty message follows the page, so it starts on the right; once there is text it follows the text', async () => {
      await render();
      await setLang('ar');
      // Empty: no direction of its own, so the placeholder and the cursor start on the right.
      expect(message().value).toBe('');
      expect(message().hasAttribute('dir')).toBe(false);
      expect(message().placeholder).toBe(ar.help.contact.message.placeholder);
      await typeMessage('   ');
      expect(message().hasAttribute('dir')).toBe(false);
      await typeMessage('Hello');
      expect(message().getAttribute('dir')).toBe('auto');
      await typeMessage('');
      expect(message().hasAttribute('dir')).toBe(false);
    });

    it('sends and shows Sent in Arabic', async () => {
      await render();
      await setLang('ar');
      await typeMessage('رسالة طويلة بما يكفي للإرسال.');
      await send();
      expect(text(q('contact-sent'))).toBe(ar.help.contact.sent);
      expect(text(q('contact-sent-back'))).toBe(ar.help.contact.back);
    });

    it('uses no physical left or right, so the form mirrors', async () => {
      // A utility without its variants ("sm:", "rtl:"), so "sm:ml-2" counts and "ms-2" does not.
      const physical =
        /^-?(ml|mr|pl|pr|left|right|text-left|text-right|border-l|border-r|rounded-l|rounded-r)(-|$)/;
      // The page's own classes: an element of the spartan library (an `hlm…` attribute) brings classes of its own.
      const own = (node: Element) =>
        !node.getAttributeNames().some((name) => name.startsWith('hlm'));
      const physicalClasses = () =>
        Array.from(el.querySelectorAll<HTMLElement>('[class]'))
          .filter(own)
          .flatMap((node) =>
            node
              .getAttribute('class')!
              .split(/\s+/)
              .filter((name) => physical.test(name.split(':').pop()!))
              .map((name) => `${node.tagName} .${name}`),
          );

      await render();
      expect(Array.from(el.querySelectorAll('[class]')).filter(own).length).toBeGreaterThan(10);
      expect(physicalClasses()).toEqual([]);
      // The same after Send: the Sent card and the way back.
      await typeMessage('A message long enough to send.');
      await send();
      expect(q('contact-sent')).not.toBeNull();
      expect(physicalClasses()).toEqual([]);
    });
  });

  it("says it in German as the app does: informal du, the app's own page names", async () => {
    await render('/help/contact?topic=taxes');
    await setLang('de');
    expect(text(q('contact-title'))).toBe(de.help.contact.title);
    expect(text(q('contact-reply'))).toBe(de.help.contact.reply.replace('{{email}}', PERSON.email));
    expect(text(q('contact-support-link'))).toBe(
      de.help.contact.support.path
        .replace('{{settings}}', de.settings.title)
        .replace('{{people}}', de.people.title),
    );
    expect(text(q('contact-support-link'))).toContain(de.people.title);
    expect(text(q('contact-send'))).toBe(de.help.contact.send);
  });

  it('has the same texts in all three languages', () => {
    const keys = (value: unknown, prefix = ''): string[] =>
      typeof value === 'object' && value !== null
        ? Object.entries(value).flatMap(([key, child]) => keys(child, `${prefix}${key}.`))
        : [prefix];
    const english = keys(en.help.contact);
    expect(english.length).toBeGreaterThan(10);
    for (const lang of ['de', 'ar'] as const) {
      expect(keys(LANGS[lang].help.contact), lang).toEqual(english);
    }
    // Each text is its own and not left in English, except the one word that is the same in two languages.
    const walk = (value: unknown, other: unknown, path: string): void => {
      if (typeof value === 'string') {
        if (value !== 'Demo') expect(other, path).not.toBe(value);
        expect(String(other).trim(), path).not.toBe('');
        return;
      }
      for (const [key, child] of Object.entries(value as object)) {
        walk(child, (other as Record<string, unknown>)[key], `${path}.${key}`);
      }
    };
    walk(en.help.contact, de.help.contact, 'de');
    walk(en.help.contact, ar.help.contact, 'ar');
  });
});
