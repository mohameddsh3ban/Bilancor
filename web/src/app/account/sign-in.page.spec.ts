import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { AccountService } from '../state/account.service';
import { ForgotPasswordPage } from './forgot-password.page';
import { SignInPage } from './sign-in.page';

@Component({ template: '' })
class Stub {}

describe('SignInPage', () => {
  let accounts: AccountService;
  let language: LanguageService;
  let router: Router;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: '', pathMatch: 'full', component: Stub },
          { path: 'payments', component: Stub },
          { path: 'sign-in', component: SignInPage },
          { path: 'sign-up', component: Stub },
          { path: 'forgot-password', component: ForgotPasswordPage },
        ]),
      ],
    });
    accounts = TestBed.inject(AccountService);
    language = TestBed.inject(LanguageService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Opens a page; the harness is made once per test, so a later call goes there from the page that is open. */
  async function render(url = '/sign-in'): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

  async function settle(): Promise<void> {
    const open = harness!;
    open.detectChanges();
    await open.fixture.whenStable();
    open.detectChanges();
    el = open.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;

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

  /** Fills in the password and asks for the code. */
  async function giveCredentials(email = 'sara@example.com'): Promise<void> {
    await type('email', email);
    await type('password', 'anything at all');
    await submit('sign-in-form');
  }

  async function giveCode(code = '123456'): Promise<void> {
    await type('code', code);
    await submit('code-form');
  }

  /** Ticks or unticks a choice card. */
  async function tick(testId: string): Promise<void> {
    q(testId)!.querySelector<HTMLInputElement>('input')!.click();
    await settle();
  }

  it("Sara's email is filled in and any password and any 6 digits sign her in", async () => {
    await render();
    expect(field('email').value).toBe('sara@example.com');
    expect(field('password').value).toBe('');
    expect(text(q('demo-note'))).toContain("Sara's email is filled in");
    expect(accounts.signedIn()).toBe(false);

    await type('password', 'x');
    await submit('sign-in-form');
    // The password is not enough: the code comes next.
    expect(accounts.signedIn()).toBe(false);
    expect(q('sign-in-form')).toBeNull();
    expect(text(q('code-title'))).toBe('Enter your code');

    await giveCode('000000');
    expect(accounts.signedIn()).toBe(true);
    expect(accounts.person().id).toBe('p1');
    expect(router.url).toBe('/');
  });

  it('has the links to Forgot password and Create an account', async () => {
    await render();
    expect(q('forgot-link')!.getAttribute('href')).toBe('/forgot-password');
    expect(text(q('forgot-link'))).toBe('Forgot password?');
    expect(q('create-account-link')!.getAttribute('href')).toBe('/sign-up');
    expect(text(q('create-account-link'))).toBe('Create an account');
  });

  it('sign-in ignores case and spaces', async () => {
    await render();
    await giveCredentials(' SARA@Example.com ');
    expect(q('code-form')).not.toBeNull();
    await giveCode();
    expect(accounts.person().id).toBe('p1');

    // An account made in the demo is found the same way, whatever it was typed as.
    accounts.signOut();
    const id = accounts.createPerson({
      firstName: 'Mia',
      lastName: 'Becker',
      email: 'Mia.Becker@Example.com',
      lang: 'en',
    });
    await render();
    await giveCredentials('  MIA.becker@EXAMPLE.com');
    await giveCode();
    expect(accounts.person().id).toBe(id);
  });

  it('empty email and password say what is missing', async () => {
    await render();
    await type('email', '   ');
    await submit('sign-in-form');
    expect(text(q('error-email'))).toBe('Type your email.');
    expect(text(q('error-password'))).toBe('Type your password.');
    expect(q('code-form')).toBeNull();
    expect(accounts.signedIn()).toBe(false);

    // A message goes as soon as its field is typed in.
    await type('password', 'x');
    expect(q('error-password')).toBeNull();
    expect(q('error-email')).not.toBeNull();
  });

  it('a 5-digit code says it needs 6 digits', async () => {
    await render();
    await giveCredentials();
    await giveCode('12345');
    expect(text(q('error-code'))).toBe('The code has 6 digits.');
    expect(accounts.signedIn()).toBe(false);
    await giveCode('12345a');
    expect(q('error-code')).not.toBeNull();
    expect(accounts.signedIn()).toBe(false);
    // Spaces, as an authenticator app shows its code, are fine.
    await giveCode('123 456');
    expect(accounts.signedIn()).toBe(true);
  });

  it('a trusted device skips the code the next time', async () => {
    await render();
    await giveCredentials();
    expect(text(q('trust'))).toBe("Don't ask again on this device for 30 days");
    await tick('trust');
    await giveCode();
    expect(accounts.isTrusted('p1')).toBe(true);

    accounts.signOut();
    await render('/sign-in?signedOut=1');
    await giveCredentials();
    expect(q('code-form')).toBeNull();
    expect(accounts.signedIn()).toBe(true);
    expect(router.url).toBe('/');
  });

  it('a new password after a forgotten one makes a trusted device ask for the code again', async () => {
    await render();
    await giveCredentials();
    await tick('trust');
    await giveCode();
    expect(accounts.isTrusted('p1')).toBe(true);

    accounts.signOut();
    await render('/forgot-password');
    await type('email', 'sara@example.com');
    await submit('forgot-form');
    await click('demo-email-action');
    await type('new-password', 'a long enough password');
    await submit('new-password-form');
    expect(q('done-title')).not.toBeNull();

    await render('/sign-in');
    await giveCredentials();
    expect(q('code-form')).not.toBeNull();
    expect(accounts.signedIn()).toBe(false);
  });

  it('without the tick the device is asked for the code every time', async () => {
    await render();
    await giveCredentials();
    await giveCode();
    expect(accounts.isTrusted('p1')).toBe(false);
    accounts.signOut();
    await render();
    await giveCredentials();
    expect(q('code-form')).not.toBeNull();
  });

  it("Mia's email says only Sara and new accounts can sign in", async () => {
    await render();
    for (const email of ['mia@example.com', ' Jana@Kanzlei-Hoffmann.example ']) {
      await giveCredentials(email);
      expect(text(q('error-account'))).toBe(
        "In this demo, only Sara's account and accounts you create can sign in. Seeing the app as someone else comes later.",
      );
      expect(q('unknown-create-link')).toBeNull();
      expect(q('code-form')).toBeNull();
      expect(accounts.signedIn()).toBe(false);
    }
  });

  it('an unknown email links to Create an account', async () => {
    await render();
    await giveCredentials('nobody@example.org');
    expect(text(q('error-account'))).toContain('There is no account with this email');
    const link = q('unknown-create-link')!;
    expect(link.getAttribute('href')).toBe('/sign-up');
    expect(text(link)).toBe('Create an account');
    expect(accounts.signedIn()).toBe(false);

    // Fixing the email takes the message away.
    await type('email', 'sara@example.com');
    expect(q('error-account')).toBeNull();
  });

  it('signing in goes back to the page asked for', async () => {
    await render('/sign-in?next=%2Fpayments');
    await giveCredentials();
    await giveCode();
    expect(router.url).toBe('/payments');
  });

  it('a next that leaves the app or loops back goes to the homepage', async () => {
    for (const next of ['//evil.example', 'https://evil.example', '/\\evil', '/sign-in']) {
      accounts.signOut();
      await render(`/sign-in?next=${encodeURIComponent(next)}`);
      await giveCredentials();
      await giveCode();
      expect(router.url, next).toBe('/');
    }
  });

  it('picking DE before signing in keeps German', async () => {
    await render();
    const german = Array.from(
      el.querySelectorAll<HTMLElement>('[data-testid="lang-switcher"] button'),
    ).find((b) => b.textContent?.trim() === 'DE')!;
    german.click();
    await settle();
    expect(language.lang()).toBe('de');
    expect(text(q('sign-in-submit'))).toBe('Anmelden');

    // Even a person with a language of their own gets the one picked here, and keeps it.
    accounts.updatePerson('p1', (p) => ({ ...p, lang: 'ar' }));
    await giveCredentials();
    await giveCode();
    expect(language.lang()).toBe('de');
    expect(accounts.person().lang).toBe('de');
  });

  it("without a pick the person's own language applies", async () => {
    accounts.updatePerson('p1', (p) => ({ ...p, lang: 'ar' }));
    await render();
    expect(language.lang()).toBe('en');
    await giveCredentials();
    await giveCode();
    expect(language.lang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
  });

  it('the signed-out note shows after Sign out', async () => {
    await render('/sign-in?signedOut=1');
    expect(text(q('signed-out-note'))).toBe("You're signed out.");
    await render('/sign-in');
    expect(q('signed-out-note')).toBeNull();
  });

  it('a backup code signs in and uses one up', async () => {
    await render();
    await giveCredentials();
    expect(accounts.person().backupCodesLeft).toBe(6);
    await click('use-backup');
    expect(text(q('code-title'))).toBe('Enter a backup code');
    await type('code', '1234-5678');
    await submit('code-form');
    expect(accounts.signedIn()).toBe(true);
    expect(accounts.person().backupCodesLeft).toBe(5);
    expect(router.url).toBe('/');
  });

  it('a backup code field left empty asks for one', async () => {
    await render();
    await giveCredentials();
    await click('use-backup');
    await submit('code-form');
    expect(text(q('error-code'))).toBe('Type one of your backup codes.');
    expect(accounts.signedIn()).toBe(false);
    expect(accounts.person().backupCodesLeft).toBe(6);
  });

  it('with no backup codes left it says so and offers the authenticator code', async () => {
    accounts.updatePerson('p1', (p) => ({ ...p, backupCodesLeft: 0 }));
    await render();
    await giveCredentials();
    await click('use-backup');
    await type('code', '1234-5678');
    await submit('code-form');
    expect(text(q('error-code'))).toContain('no backup codes left');
    expect(accounts.signedIn()).toBe(false);

    await click('use-app');
    expect(text(q('code-title'))).toBe('Enter your code');
    expect(q('error-code')).toBeNull();
    await giveCode();
    expect(accounts.signedIn()).toBe(true);
  });

  it('Back from the code goes to the email and password again', async () => {
    await render();
    await giveCredentials();
    await click('code-back');
    expect(q('code-form')).toBeNull();
    expect(field('email').value).toBe('sara@example.com');
  });
});
