import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { AccountService } from '../state/account.service';
import { ForgotPasswordPage } from './forgot-password.page';

@Component({ template: '' })
class Stub {}

describe('ForgotPasswordPage', () => {
  let accounts: AccountService;
  let language: LanguageService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: '', pathMatch: 'full', component: Stub },
          { path: 'sign-in', component: Stub },
          { path: 'forgot-password', component: ForgotPasswordPage },
        ]),
      ],
    });
    accounts = TestBed.inject(AccountService);
    language = TestBed.inject(LanguageService);
    harness = await RouterTestingHarness.create('/forgot-password');
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
  const devices = () => accounts.persons().find((p) => p.id === 'p1')!.devices;

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  async function submit(formId: string): Promise<void> {
    q(formId)!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }

  async function sendLink(email: string): Promise<void> {
    await type('email', email);
    await submit('forgot-form');
  }

  it("asks for the email, Sara's filled in, and offers the way back to sign in", async () => {
    expect(text(q('forgot-title'))).toBe('Reset your password');
    expect(field('email').value).toBe('sara@example.com');
    expect(text(q('forgot-intro'))).toContain('It works for 1 hour');
    expect(text(q('forgot-submit'))).toBe('Send the link');
    expect(q('back-to-sign-in')!.getAttribute('href')).toBe('/sign-in');
  });

  it('an empty email says what is missing', async () => {
    await type('email', '  ');
    await submit('forgot-form');
    expect(text(q('error-email'))).toBe('Type your email.');
    expect(q('sent-title')).toBeNull();
    await type('email', 'sara@example.com');
    expect(q('error-email')).toBeNull();
  });

  it('a known email says a link was sent, with the email as a demo box, ignoring case and spaces', async () => {
    await sendLink(' SARA@Example.com ');
    expect(text(q('sent-title'))).toBe('Check your email');
    expect(text(q('sent-body'))).toContain('It works for 1 hour');
    expect(q('sent-body')!.querySelector('bdi[dir="ltr"]')!.textContent).toBe('SARA@Example.com');
    const mail = q('demo-email')!;
    expect(text(mail)).toContain('Demo: shown here instead of sent');
    expect(text(q('demo-email-action'))).toBe('Choose a new password');
    expect(q('back-to-sign-in')!.getAttribute('href')).toBe('/sign-in');
  });

  it('an unknown email still says a link was sent, with no demo email', async () => {
    await sendLink('nobody@example.org');
    expect(text(q('sent-title'))).toBe('Check your email');
    expect(text(q('sent-body'))).toContain('It works for 1 hour');
    expect(q('demo-email')).toBeNull();
    // Mia is invited to a business but has no login: the page does not tell her from a stranger.
    await settleBack();
    await sendLink('mia@example.com');
    expect(text(q('sent-title'))).toBe('Check your email');
    expect(q('demo-email')).toBeNull();
  });

  /** Back to the email step, from the "Check your email" screen. */
  async function settleBack(): Promise<void> {
    await click('sent-back');
    expect(q('forgot-form')).not.toBeNull();
  }

  it('a new password signs out the other devices', async () => {
    expect(devices().map((d) => d.id)).toEqual(['d1', 'd2']);
    await sendLink('sara@example.com');
    await click('demo-email-action');
    expect(text(q('new-title'))).toBe('Choose a new password');
    expect(q('demo-email')).toBeNull();

    await type('new-password', 'a long enough password');
    await submit('new-password-form');
    expect(text(q('done-title'))).toBe('Password changed');
    expect(text(q('done-body'))).toBe("You're signed out on your other devices.");
    expect(devices().map((d) => d.id)).toEqual(['d1']);
    // Choosing a password does not sign anybody in: the person signs in, and the code is still asked.
    expect(accounts.signedIn()).toBe(false);
    const signIn = q('done-sign-in')!;
    expect(signIn.getAttribute('href')).toBe('/sign-in');
    expect(text(signIn)).toBe('Sign in');
  });

  it('a password under 10 characters is refused', async () => {
    await sendLink('sara@example.com');
    await click('demo-email-action');
    await type('new-password', '123456789');
    await submit('new-password-form');
    expect(text(q('error-new-password'))).toBe('Use at least 10 characters.');
    expect(q('done-title')).toBeNull();
    expect(devices()).toHaveLength(2);

    await type('new-password', '1234567890');
    expect(q('error-new-password')).toBeNull();
    await submit('new-password-form');
    expect(q('done-title')).not.toBeNull();
    expect(devices()).toHaveLength(1);
  });

  it('the new password of an account made in the demo signs out that account, not Sara', async () => {
    const id = accounts.createPerson({
      firstName: 'Mia',
      lastName: 'Becker',
      email: 'mia.b@example.com',
      lang: 'en',
    });
    accounts.updatePerson(id, (p) => ({
      ...p,
      devices: [
        ...p.devices,
        {
          id: 'x1',
          browser: 'Safari',
          system: 'iPhone',
          place: 'Hamburg',
          lastSeen: '2026-10-20',
          current: false,
        },
      ],
    }));
    await sendLink('MIA.B@example.com');
    await click('demo-email-action');
    await type('new-password', 'a long enough password');
    await submit('new-password-form');
    expect(
      accounts
        .persons()
        .find((p) => p.id === id)!
        .devices.map((d) => d.id),
    ).toEqual([`${id}-d1`]);
    expect(devices()).toHaveLength(2);
  });
});
