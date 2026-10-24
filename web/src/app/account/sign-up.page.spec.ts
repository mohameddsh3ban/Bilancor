import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { ownerOf } from '../domain/people';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';

describe('SignUpPage', () => {
  let accounts: AccountService;
  let demo: DemoStateService;
  let language: LanguageService;
  let router: Router;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    accounts = TestBed.inject(AccountService);
    demo = TestBed.inject(DemoStateService);
    language = TestBed.inject(LanguageService);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create('/sign-up');
    await settle();
  });

  afterEach(() => {
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  /** Presses the button of a form the way a tap does: it submits the form. */
  async function submit(formId: string): Promise<void> {
    q(formId)!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }

  /** Chooses an answer of a choice card, which is a radio button or a checkbox under the card. */
  async function choose(testId: string): Promise<void> {
    q(testId)!.querySelector<HTMLInputElement>('input')!.click();
    await settle();
  }

  /** Step 1: the email and password, then Create account. */
  async function giveAccount(
    email = 'mia@example.com',
    password = 'a long enough password',
  ): Promise<void> {
    await type('email', email);
    await type('password', password);
    await submit('sign-up-form');
  }

  /** "Check your email": the button of the demo email. */
  async function confirmEmail(): Promise<void> {
    await click('demo-email-action');
  }

  /** Step 2: the names and the business, then Continue. */
  async function giveBusiness(
    business = { name: 'Studio Becker', kind: 'kind-freelance', form: 'form-sole' },
  ): Promise<void> {
    await type('first-name', 'Mia');
    await type('last-name', 'Becker');
    await type('business-name', business.name);
    await choose(business.kind);
    await choose(business.form);
    await submit('business-form');
  }

  /** Step 3: the terms and the code of the authenticator app. */
  async function protect(code = '123456'): Promise<void> {
    await choose('terms-accept');
    await type('two-step-code', code);
  }

  async function finish(): Promise<void> {
    await submit('finish-form');
  }

  /** The three steps, to the point where Finish is the only thing left. */
  async function reachFinish(): Promise<void> {
    await giveAccount();
    await confirmEmail();
    await giveBusiness();
  }

  it('the three steps lead to the New client homepage with its three setup steps', async () => {
    expect(text(q('step-label'))).toBe('Step 1 of 3');
    await giveAccount();
    expect(q('sign-up-form')).toBeNull();
    expect(text(q('check-email-title'))).toBe('Check your email');
    await confirmEmail();
    expect(text(q('step-label'))).toBe('Step 2 of 3');
    await giveBusiness();
    expect(text(q('step-label'))).toBe('Step 3 of 3');
    expect(accounts.persons()).toHaveLength(1);
    await protect();
    await finish();

    expect(router.url).toBe('/');
    expect(accounts.signedIn()).toBe(true);
    expect(accounts.person().firstName).toBe('Mia');
    expect(accounts.person().email).toBe('mia@example.com');
    // The business exists, belongs to Mia as its owner and starts as a new client.
    expect(demo.business().name).toBe('Studio Becker');
    expect(ownerOf(demo.business())).toMatchObject({
      personId: accounts.person().id,
      name: 'Mia Becker',
      email: 'mia@example.com',
    });
    expect(demo.setup()).toEqual({ bank: false, tax: false, receipt: false });
    expect(demo.business().taxProfile.businessKind).toBe('freelance');
    expect(demo.business().legalForm).toBe('sole');

    // The homepage: the checklist with its three steps, none of them done.
    expect(q('setup-checklist')).not.toBeNull();
    for (const step of ['bank', 'tax', 'receipt']) {
      expect(q(`step-${step}`)!.getAttribute('data-done')).toBe('false');
    }
    expect(text(q('business-switcher'))).toContain('Studio Becker');
    expect(text(el)).toContain('Mia');
  });

  it('keeps the trade and the partnership the person chose', async () => {
    await giveAccount();
    await confirmEmail();
    await giveBusiness({ name: 'Linde & Co', kind: 'kind-trade', form: 'form-gbr' });
    await protect();
    await finish();
    expect(demo.business().taxProfile.businessKind).toBe('trade');
    expect(demo.business().legalForm).toBe('gbr');
  });

  it('has the language buttons and the price box on the first screen', async () => {
    expect(q('lang-switcher')).not.toBeNull();
    expect(text(q('price-title'))).toBe('One price, everything included');
    expect(text(q('price-amount'))).toBe('€ — a month');
    expect(text(q('price-trial'))).toBe('First 30 days free, no card needed');
    // The price of a first account is for the one business made with it.
    expect(q('price-per-business')).toBeNull();
    expect(text(q('sign-in-link'))).toBe('Sign in');
    expect(q('sign-in-link')!.getAttribute('href')).toBe('/sign-in');
  });

  describe('step 1, the account', () => {
    it('a password under 10 characters is refused', async () => {
      await giveAccount('mia@example.com', '123456789');
      expect(q('sign-up-form')).not.toBeNull();
      expect(text(q('error-password'))).toBe('Use at least 10 characters.');
      expect(field('password').getAttribute('aria-invalid')).toBe('true');
      expect(accounts.persons()).toHaveLength(1);

      // The message goes as soon as the password is changed, and 10 characters are enough.
      await type('password', '1234567890');
      expect(q('error-password')).toBeNull();
      await submit('sign-up-form');
      expect(q('sign-up-form')).toBeNull();
    });

    it('counts a character that is more than one letter in a computer as one', async () => {
      // Ten emoji are 20 code units but ten characters.
      await giveAccount('mia@example.com', '😀'.repeat(10));
      expect(q('sign-up-form')).toBeNull();
    });

    it('no password at all is refused the same way', async () => {
      await type('email', 'mia@example.com');
      await submit('sign-up-form');
      expect(text(q('error-password'))).toBe('Use at least 10 characters.');
    });

    it('asks for an email, and for one that looks like an email', async () => {
      await submit('sign-up-form');
      expect(text(q('error-email'))).toBe('Type your email.');
      await type('email', 'mia at example');
      await type('password', 'a long enough password');
      await submit('sign-up-form');
      expect(text(q('error-email'))).toBe("This doesn't look like an email address.");
      expect(q('sign-up-form')).not.toBeNull();
    });

    it('an email that already has an account says so, whatever its case', async () => {
      await giveAccount(' SARA@Example.com ');
      expect(q('sign-up-form')).not.toBeNull();
      expect(text(q('error-email'))).toContain('There is already an account with this email.');
      expect(text(q('taken-sign-in'))).toBe('Sign in');
      expect(q('taken-sign-in')!.getAttribute('href')).toBe('/sign-in');
      expect(field('email').getAttribute('aria-invalid')).toBe('true');

      // Changing the email takes the message away.
      await type('email', 'someone.else@example.com');
      expect(q('error-email')).toBeNull();

      // An account made during the visit is found the same way, and it is not Sara's alone.
      accounts.createPerson({
        firstName: 'Jo',
        lastName: 'Lang',
        email: 'Jo.Lang@Example.com',
        lang: 'en',
      });
      await giveAccount('  jo.lang@EXAMPLE.com');
      expect(text(q('error-email'))).toContain('There is already an account with this email.');
      expect(accounts.persons()).toHaveLength(2);
    });
  });

  describe('Check your email', () => {
    beforeEach(async () => {
      await giveAccount('  Mia@Example.com ');
    });

    it('says where the link went and that it works for 24 hours', () => {
      expect(text(q('check-email-body'))).toBe(
        'We sent a link to Mia@Example.com. It works for 24 hours.',
      );
      expect(q('check-email-body')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(q('step-label'))).toBe('Step 1 of 3 · Confirm your email');
    });

    it('shows the email in a demo box with Confirm my email', () => {
      expect(text(q('demo-email-to'))).toBe('To: Mia@Example.com');
      expect(text(q('demo-email-action'))).toBe('Confirm my email');
      expect(text(q('demo-email-label'))).toBe('Demo: shown here instead of sent');
    });

    it('Send it again says Sent again', async () => {
      expect(q('resent')).toBeNull();
      await click('resend');
      expect(text(q('resent'))).toBe('Sent again');
      expect(q('check-email-title')).not.toBeNull();
    });

    it('Change it goes back with the fields kept', async () => {
      await click('change-email');
      expect(q('sign-up-form')).not.toBeNull();
      // An email field drops the spaces around what is typed.
      expect(field('email').value).toBe('Mia@Example.com');
      expect(field('password').value).toBe('a long enough password');

      // A new address is the one the next email goes to; "Sent again" is forgotten.
      await type('email', 'mia.becker@example.com');
      await submit('sign-up-form');
      expect(text(q('check-email-body'))).toContain('mia.becker@example.com');
      expect(q('resent')).toBeNull();
    });

    it('Confirm my email goes on to step 2', async () => {
      await confirmEmail();
      expect(q('business-form')).not.toBeNull();
      expect(accounts.persons()).toHaveLength(1);
    });
  });

  describe('step 2, you and your business', () => {
    beforeEach(async () => {
      await giveAccount();
      await confirmEmail();
    });

    it('asks for both names, the business name and the two answers', async () => {
      await submit('business-form');
      expect(q('business-form')).not.toBeNull();
      expect(text(q('error-first-name'))).toBe('Type your first name.');
      expect(text(q('error-last-name'))).toBe('Type your last name.');
      expect(text(q('error-business-name'))).toBe('Type the name of your business.');
      expect(text(q('error-kind'))).toBe('Choose the kind of work.');
      expect(text(q('error-legal-form'))).toBe('Choose one: just you, or with partners.');

      // Each message goes when its field is answered.
      await type('first-name', 'Mia');
      expect(q('error-first-name')).toBeNull();
      await choose('kind-trade');
      expect(q('error-kind')).toBeNull();
      expect(q('error-legal-form')).not.toBeNull();
    });

    it('there is no GmbH choice and the note says so', () => {
      expect(text(q('no-gmbh'))).toBe("A GmbH can't sign up yet.");
      const answers = Array.from(el.querySelectorAll('app-choice-card'));
      expect(answers).toHaveLength(4);
      expect(answers.some((card) => /gmbh/i.test(text(card)))).toBe(false);
    });

    it('offers Freelance and Trade, and Just me and Partners, each German term with its info button', () => {
      expect(text(q('kind-freelance'))).toContain('Freiberufler');
      expect(text(q('kind-trade'))).toContain('Gewerbe');
      expect(text(q('form-sole'))).toContain('Just me');
      expect(text(q('form-sole'))).toContain('Einzelunternehmen');
      expect(text(q('form-gbr'))).toContain('Partners');
      expect(text(q('form-gbr'))).toContain('GbR');
      for (const card of ['kind-freelance', 'kind-trade', 'form-sole', 'form-gbr']) {
        expect(q(card)!.querySelector('app-term-info button')).not.toBeNull();
      }
      expect(
        q('kind-freelance')!.querySelector('app-term-info button')!.getAttribute('aria-label'),
      ).toBe('What is Freelance work?');
    });

    it('Continue goes to step 3 with the names and the business kept for Finish', async () => {
      await giveBusiness();
      expect(q('finish-form')).not.toBeNull();
      expect(q('business-form')).toBeNull();
    });
  });

  describe('step 3, the terms and a safe login', () => {
    beforeEach(async () => {
      await reachFinish();
    });

    it('Finish needs the terms ticked and a 6-digit code', async () => {
      // Nothing yet: both are asked for, and nobody is made.
      await finish();
      expect(q('finish-form')).not.toBeNull();
      expect(text(q('terms-error'))).toBe('Tick the box to continue.');
      expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
      expect(accounts.persons()).toHaveLength(1);
      expect(accounts.signedIn()).toBe(false);

      // A code that is not 6 digits does not count, and the message stays under the field.
      await type('two-step-code', '12345');
      await finish();
      expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
      expect(accounts.persons()).toHaveLength(1);

      // 6 digits take the message away, but the code alone is not enough.
      await type('two-step-code', '123456');
      expect(q('two-step-error')).toBeNull();
      await finish();
      expect(accounts.persons()).toHaveLength(1);
      expect(q('terms-error')).not.toBeNull();

      // Ticking the terms takes their message away, and then Finish works.
      await choose('terms-accept');
      expect(q('terms-error')).toBeNull();
      await finish();
      expect(accounts.persons()).toHaveLength(2);
      expect(accounts.signedIn()).toBe(true);
      expect(router.url).toBe('/');
    });

    it('the terms alone are not enough: a 6-digit code is needed, and the cursor goes to its field', async () => {
      await choose('terms-accept');
      await finish();
      expect(accounts.persons()).toHaveLength(1);
      expect(q('terms-error')).toBeNull();
      expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
      await vi.waitFor(() => expect(document.activeElement).toBe(q('two-step-code')));
    });

    it('terms ticked and 6 digits typed: one tap on Finish lands on the homepage', async () => {
      await protect();
      expect(q('two-step-done')).toBeNull();
      await finish();
      expect(accounts.persons()).toHaveLength(2);
      expect(accounts.signedIn()).toBe(true);
      expect(accounts.person().email).toBe('mia@example.com');
      expect(router.url).toBe('/');
      expect(q('setup-checklist')).not.toBeNull();
    });

    it('shows the legal lines and the 8 backup codes from the start, with no button besides Finish', () => {
      expect(text(q('terms-binding'))).toBe(
        'The German version is binding; the others are for reading.',
      );
      expect(text(q('terms-books'))).toBe(
        'You keep your own books and send your own returns: the app does the work, you confirm.',
      );
      expect(el.querySelectorAll('[data-testid="two-step-backup"] li')).toHaveLength(8);
      expect(q('two-step-done')).toBeNull();
      expect(text(q('finish-submit'))).toBe('Finish');
    });

    it('the terms link opens the not-written-yet notice', async () => {
      expect(dialog()).toBeNull();
      await click('terms-link');
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
      });
      expect(text(dialog()!.querySelector('[data-testid="legal-notice-title"]'))).toBe(
        "The legal texts aren't written yet",
      );
      expect(dialog()!.getAttribute('aria-modal')).toBe('true');
      // The link did not tick the box.
      expect(q('terms-accept')!.querySelector<HTMLInputElement>('input')!.checked).toBe(false);

      dialog()!.querySelector<HTMLButtonElement>('[data-testid="legal-notice-close"]')!.click();
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).toBeNull();
      });
    });

    it('the links work from the keyboard, with Enter and with Space', async () => {
      expect(text(q('terms-accept'))).toBe(
        'I accept the Terms of use and the Data processing agreement (AVV)',
      );
      for (const key of ['Enter', ' ']) {
        const press = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
        q('terms-link')!.dispatchEvent(press);
        expect(press.defaultPrevented).toBe(true);
        await vi.waitFor(async () => {
          await settle();
          expect(dialog()).not.toBeNull();
        });
        dialog()!.querySelector<HTMLButtonElement>('[data-testid="legal-notice-close"]')!.click();
        await vi.waitFor(async () => {
          await settle();
          expect(dialog()).toBeNull();
        });
      }
    });

    it('the data processing agreement link opens the same notice, and the term has its info button', async () => {
      expect(text(q('avv-link'))).toContain('Data processing agreement');
      expect(q('terms-accept')!.querySelector('app-term-info button')).not.toBeNull();
      await click('avv-link');
      await vi.waitFor(async () => {
        await settle();
        expect(dialog()).not.toBeNull();
      });
      expect(text(dialog())).toContain("The legal texts aren't written yet");
    });

    it('Finish makes the person, the business and signs in, in this order, once', async () => {
      await protect();
      const order: string[] = [];
      const makePerson = accounts.createPerson.bind(accounts);
      const makeBusiness = demo.createBusiness.bind(demo);
      const signIn = accounts.signIn.bind(accounts);
      vi.spyOn(accounts, 'createPerson').mockImplementation((input) => {
        order.push('person');
        return makePerson(input);
      });
      vi.spyOn(demo, 'createBusiness').mockImplementation((owner, input) => {
        // The business is made before anybody is signed in: a signed-in person with no business has nothing open.
        expect(accounts.signedIn()).toBe(false);
        order.push('business');
        return makeBusiness(owner, input);
      });
      vi.spyOn(accounts, 'signIn').mockImplementation((id, trust) => {
        order.push('sign-in');
        expect(trust).toBe(false);
        signIn(id, trust);
      });
      // Two taps on Finish before the page has gone make one account.
      const form = q('finish-form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(order).toEqual(['person', 'business', 'sign-in']);
    });
  });

  describe('the language', () => {
    it("the new person's language is the one picked on the first screen", async () => {
      el.querySelector<HTMLButtonElement>(
        '[data-testid="lang-switcher"] button[lang="de"]',
      )!.click();
      await settle();
      expect(language.lang()).toBe('de');
      expect(text(q('sign-up-submit'))).toBe('Konto erstellen');

      await giveAccount();
      await confirmEmail();
      await giveBusiness();
      await protect();
      await finish();

      expect(accounts.person().firstName).toBe('Mia');
      expect(accounts.person().lang).toBe('de');
      // The app opens in the language the person picked.
      expect(language.lang()).toBe('de');
    });

    it('a person who picks no language gets the one the page is in', async () => {
      await reachFinish();
      await protect();
      await finish();
      expect(accounts.person().lang).toBe('en');
    });

    it('the language buttons work on every screen and keep what is typed', async () => {
      await giveAccount();
      await confirmEmail();
      await type('first-name', 'Mia');
      el.querySelector<HTMLButtonElement>(
        '[data-testid="lang-switcher"] button[lang="ar"]',
      )!.click();
      await settle();
      expect(language.lang()).toBe('ar');
      expect(field('first-name').value).toBe('Mia');
    });
  });

  describe('in German', () => {
    it('writes the messages in German', async () => {
      language.setLang('de');
      await settle();
      await giveAccount('mia@example.com', 'kurz');
      expect(text(q('error-password'))).toBe('Nimm mindestens 10 Zeichen.');
    });
  });
});
