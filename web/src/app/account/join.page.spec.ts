import { Component, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Business } from '../data/models';
import { PeopleCard } from '../settings/people-card';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { JoinPage } from './join.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

@Component({ imports: [PeopleCard], template: '<app-people-card />' })
class SettingsStub {}

const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';

describe('JoinPage', () => {
  let demo: DemoStateService;
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
          { path: 'join/:businessId/:memberId', component: JoinPage },
          { path: 'settings', component: SettingsStub },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    accounts = TestBed.inject(AccountService);
    language = TestBed.inject(LanguageService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    const page = harness!;
    page.detectChanges();
    await page.fixture.whenStable();
    page.detectChanges();
    el = page.routeNativeElement as HTMLElement;
  }

  /** Opens a join link; the harness is made once per test, so a later call goes there from the page that is open. */
  async function open(url = '/join/weber-design/wd-m3'): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

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

  async function submit(formId: string): Promise<void> {
    q(formId)!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }

  /** Fills in the joining form as a person with a good password and any 6 digits, but does not press Join. */
  async function fillIn(name = 'Mia'): Promise<void> {
    await type('join-name', name);
    await type('join-password', 'a long enough password');
    await type('two-step-code', '123456');
  }

  const member = (id: string) => demo.business().people.find((m) => m.id === id);
  const historyKeys = () => demo.business().history.map((line) => line.key);

  describe('an invitation that works', () => {
    it('says Join Weber Design, with the role and what it can and can not do', async () => {
      await open();
      expect(text(q('join-title'))).toBe('Join Weber Design');
      const card = q('role-readonly')!;
      expect(text(card)).toBe(
        "Receipts only Can: Upload receipts and fix the ones they added Can't: Payments, bank balances, taxes, settings",
      );
      expect(el.querySelectorAll('[data-testid^="role-"] input')).toHaveLength(0);
    });

    it('asks for a name, a language, a password and the authenticator step, and ends with Join', async () => {
      await open();
      expect(field('join-name').value).toBe('');
      expect(['en', 'de', 'ar'].map((l) => text(q(`join-lang-${l}`)))).toEqual([
        'English',
        'Deutsch',
        'عربي',
      ]);
      expect(field('join-password').getAttribute('type')).toBe('password');
      expect(text(q('join-password-hint'))).toBe('At least 10 characters.');
      expect(q('two-step-qr')).not.toBeNull();
      expect(q('two-step-done')).toBeNull();
      expect(el.querySelectorAll('[data-testid="two-step-backup"] li')).toHaveLength(8);
      expect(text(q('join-submit'))).toBe('Join');
      expect(el.querySelectorAll('button[type="submit"]')).toHaveLength(1);
      expect(text(q('join-have-login'))).toBe('Sign in');
    });

    it('says in a dashed box that joining is a preview', async () => {
      await open();
      const box = q('join-demo')!;
      expect(box.classList.contains('border-dashed')).toBe(true);
      expect(box.classList.contains('border-warning')).toBe(true);
      expect(text(box)).toContain('Demo: joining is a preview');
    });

    it('accepting and joining shows Mia as joined in Settings', async () => {
      await open();
      await fillIn('  Mia Becker ');
      await submit('join-form');

      expect(text(q('done-title'))).toBe('Mia Becker has joined Weber Design as Receipts only');
      expect(q('join-form')).toBeNull();
      const back = q('done-back') as HTMLAnchorElement;
      expect(text(back)).toBe('Back to Settings');
      expect(back.getAttribute('href')).toBe('/settings#people');
      expect(member('wd-m3')).toMatchObject({
        name: 'Mia Becker',
        status: 'joined',
        joinedOn: '2026-10-22',
        expiresOn: null,
        role: 'receipts',
      });
      expect(historyKeys()).toEqual(['personJoined']);
      expect(demo.business().history[0].params['by']).toBe('Mia Becker');

      await click('done-back');
      expect(router.url).toBe('/settings#people');
      const row = el.querySelector('[data-testid="people-row-wd-m3"]')!;
      expect(text(row.querySelector('[data-testid="people-name-wd-m3"]'))).toBe('Mia Becker');
      expect(text(row.querySelector('[data-testid="people-role-wd-m3"]'))).toBe('Receipts only');
      expect(text(row.querySelector('[data-testid="people-sub-wd-m3"]'))).toBe(
        'mia@example.com · Joined 22 Oct 2026',
      );
    });

    it('the person who is signed in stays signed in as themselves, and nothing is a login', async () => {
      await open();
      await fillIn();
      await submit('join-form');
      expect(accounts.person().id).toBe('p1');
      expect(accounts.persons().map((p) => p.id)).toEqual(['p1']);
      expect(member('wd-m3')!.personId).toBeNull();
      expect(text(q('done-note'))).toBe(
        'In this demo you stay signed in as yourself. Seeing the app as someone else comes later.',
      );
    });

    it('Join checks the name, the password and the 6-digit code, each message under its field', async () => {
      await open();
      await submit('join-form');
      expect(text(q('error-name'))).toBe('Type your name.');
      expect(text(q('error-password'))).toBe('Use at least 10 characters.');
      expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
      expect(field('join-name').getAttribute('aria-invalid')).toBe('true');
      expect(field('join-password').getAttribute('aria-invalid')).toBe('true');
      expect(field('two-step-code').getAttribute('aria-invalid')).toBe('true');
      expect(field('join-name').getAttribute('aria-describedby')).toContain('error-name');
      expect(member('wd-m3')!.status).toBe('invited');
      await vi.waitFor(() => expect(document.activeElement).toBe(field('join-name')));

      await type('join-name', 'Mia');
      expect(q('error-name')).toBeNull();
      await type('join-password', '123456789');
      await submit('join-form');
      expect(text(q('error-password'))).toBe('Use at least 10 characters.');
      expect(q('error-name')).toBeNull();
      await vi.waitFor(() => expect(document.activeElement).toBe(field('join-password')));

      await type('join-password', '1234567890');
      expect(q('error-password')).toBeNull();
      await type('two-step-code', '12345');
      await submit('join-form');
      expect(text(q('two-step-error'))).toBe('The code has 6 digits.');
      expect(member('wd-m3')!.status).toBe('invited');

      await type('two-step-code', '123 456');
      await submit('join-form');
      expect(q('done-title')).not.toBeNull();
    });

    it('a name of only spaces is not a name, so no joined row has an empty one', async () => {
      await open();
      await fillIn('    ');
      await submit('join-form');
      expect(text(q('error-name'))).toBe('Type your name.');
      expect(member('wd-m3')!.status).toBe('invited');
      expect(member('wd-m3')!.name).toBeNull();
    });

    it('a password counts its characters, not its bytes', async () => {
      await open();
      await fillIn();
      await type('join-password', '🙂'.repeat(10));
      await submit('join-form');
      expect(q('done-title')).not.toBeNull();
    });

    it('pressing Join twice makes one row, and one line of history', async () => {
      await open();
      await fillIn();
      // Two presses before the page has drawn the first answer.
      const form = q('join-form')!;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      await settle();
      expect(historyKeys()).toEqual(['personJoined']);
    });

    it('the language choice is part of the preview: it starts with the page, follows its buttons, and stores nothing', async () => {
      await open();
      const checked = (l: string) => q(`join-lang-${l}`)!.querySelector('input')!.checked;
      expect([checked('en'), checked('de'), checked('ar')]).toEqual([true, false, false]);
      q('join-lang-de')!.querySelector('input')!.click();
      await settle();
      expect([checked('en'), checked('de'), checked('ar')]).toEqual([false, true, false]);
      // Nothing is stored: not the browser's language, not a person's.
      expect(localStorage.getItem('mockup.lang')).toBeNull();
      expect(language.lang()).toBe('en');
      expect(accounts.person().lang).toBeNull();
      await fillIn();
      await submit('join-form');
      expect(localStorage.getItem('mockup.lang')).toBeNull();
      expect(member('wd-m3')).not.toHaveProperty('lang');
    });

    it('the language buttons above the page set the choice too', async () => {
      await open();
      const button = Array.from(
        el.querySelectorAll<HTMLButtonElement>('[data-testid="lang-switcher"] button'),
      ).find((b) => text(b) === 'DE')!;
      button.click();
      await settle();
      expect(q('join-lang-de')!.querySelector('input')!.checked).toBe(true);
      expect(text(q('join-title'))).toBe(
        de.people.join.title.replace('{{business}}', 'Weber Design'),
      );
    });

    it('the role of the invitation decides what the page says it can do, and Tax advisor explains its German word', async () => {
      expect(demo.invite('noah@example.com', 'advisor')).toBeNull();
      const id = demo.business().people.at(-1)!.id;
      await open(`/join/weber-design/${id}`);
      expect(text(q('role-readonly'))).toBe(
        "Tax advisor (Steuerberater:in) Can: See everything, download receipts and exports Can't: Change bookings, connect banks, send returns",
      );
      expect(q('role-readonly')!.querySelector('app-term button')).not.toBeNull();
      expect(field('join-signin-email')).toBeNull();
    });
  });

  describe('Already have a login? Sign in', () => {
    async function openSignIn(): Promise<void> {
      await open();
      await click('join-have-login');
    }

    it('asks for an email and a password, filled in, and nothing else', async () => {
      await openSignIn();
      expect(text(q('join-title'))).toBe('Sign in to join Weber Design');
      expect(q('join-form')).toBeNull();
      expect(field('join-signin-email').value).toBe('mia@example.com');
      expect(field('join-signin-password').value).toBe('');
      expect(q('two-step-qr')).toBeNull();
      const box = q('join-demo')!;
      expect(box.classList.contains('border-dashed')).toBe(true);
      expect(text(box)).toBe('Demo: any email and password work.');
      expect(text(q('join-new-login'))).toBe('Join with a new login');
    });

    it('Already have a login joins the same way', async () => {
      await openSignIn();
      await type('join-signin-email', 'anyone@example.org');
      await type('join-signin-password', 'x');
      await submit('join-signin-form');

      expect(text(q('done-title'))).toBe('Mia has joined Weber Design as Receipts only');
      expect(q('done-back')!.getAttribute('href')).toBe('/settings#people');
      expect(member('wd-m3')).toMatchObject({
        name: 'Mia',
        status: 'joined',
        joinedOn: '2026-10-22',
      });
      expect(historyKeys()).toEqual(['personJoined']);
      expect(accounts.persons().map((p) => p.id)).toEqual(['p1']);
    });

    it('says what is missing', async () => {
      await openSignIn();
      await type('join-signin-email', '  ');
      await submit('join-signin-form');
      expect(text(q('error-signin-email'))).toBe('Type your email.');
      expect(text(q('error-signin-password'))).toBe('Type your password.');
      expect(member('wd-m3')!.status).toBe('invited');
      await type('join-signin-email', 'a@b.c');
      expect(q('error-signin-email')).toBeNull();
    });

    it('goes back to joining with a new login, keeping what was typed', async () => {
      await open();
      await type('join-name', 'Mia');
      await click('join-have-login');
      await click('join-new-login');
      expect(text(q('join-title'))).toBe('Join Weber Design');
      expect(field('join-name').value).toBe('Mia');
    });
  });

  describe('a link that no longer works', () => {
    const gone = () => ({
      title: text(q('gone-title')),
      back: q('gone-back')?.getAttribute('href'),
    });

    it('a join link for a cancelled or unknown invitation says it no longer works', async () => {
      demo.cancelInvite('wd-m3');
      await open();
      expect(gone()).toEqual({
        title: 'This invitation no longer works',
        back: '/settings#people',
      });
      expect(text(q('gone-back'))).toBe('Back to Settings');
      expect(q('join-form')).toBeNull();

      // Made-up ids: no such row, no such business, and a row that belongs to another business.
      for (const url of [
        '/join/weber-design/not-a-row',
        '/join/not-a-business/wd-m3',
        '/join/cafe-linde/wd-m3',
      ]) {
        await open(url);
        expect(gone().title, url).toBe('This invitation no longer works');
      }
    });

    it('a made-up id says so, and offers the way back', async () => {
      await open('/join/weber-design/made-up');
      expect(gone().title).toBe('This invitation no longer works');
      expect(text(q('gone-body'))).toBe(
        'It was cancelled or used already, or its link ran out. Ask the owner to send it again.',
      );
      await click('gone-back');
      expect(router.url).toBe('/settings#people');
    });

    it('an invitation that was accepted already is no longer open', async () => {
      await open();
      await fillIn();
      await submit('join-form');
      // The link, opened again later.
      await open('/settings');
      await open();
      expect(gone().title).toBe('This invitation no longer works');
      // Jana joined long ago: her row is no invitation.
      await open('/join/weber-design/wd-m2');
      expect(gone().title).toBe('This invitation no longer works');
    });

    it('after Reset demo, the link of an invitation made before it is dead for good', async () => {
      expect(demo.invite('noah@example.com', 'full')).toBeNull();
      const old = demo.business().people.at(-1)!.id;
      await open(`/join/weber-design/${old}`);
      expect(text(q('join-title'))).toBe('Join Weber Design');

      demo.resetData();
      await open(`/join/weber-design/${old}`);
      expect(gone().title).toBe('This invitation no longer works');

      // A new invitation after the reset never gets the old id, so the old link stays dead.
      expect(demo.invite('noah@example.com', 'full')).toBeNull();
      const fresh = demo.business().people.at(-1)!.id;
      expect(fresh).not.toBe(old);
      await open(`/join/weber-design/${old}`);
      expect(gone().title).toBe('This invitation no longer works');
      await open(`/join/weber-design/${fresh}`);
      expect(text(q('join-title'))).toBe('Join Weber Design');
    });

    it("is not open to somebody who has no access to that business: the page can only read the signed-in person's own", async () => {
      const id = accounts.createPerson({
        firstName: 'Lena',
        lastName: 'Roth',
        email: 'lena@example.com',
        lang: 'en',
      });
      demo.createBusiness(
        { personId: id, name: 'Lena Roth', email: 'lena@example.com' },
        { name: 'Studio Roth', kind: 'freelance', legalForm: 'sole' },
      );
      accounts.signIn(id, false);
      await open();
      expect(gone().title).toBe('This invitation no longer works');
    });

    it('a link whose days have run out says so', async () => {
      const data = (demo as unknown as { data: WritableSignal<Business[]> }).data;
      data.update((all) =>
        all.map((b) =>
          b.id !== 'weber-design'
            ? b
            : {
                ...b,
                people: b.people.map((m) =>
                  m.id === 'wd-m3' ? { ...m, expiresOn: '2026-10-21' } : m,
                ),
              },
        ),
      );
      await open();
      expect(gone().title).toBe('This invitation no longer works');
      expect(member('wd-m3')!.status).toBe('invited');
    });

    it('stays on the page while the person who joined reads the message, even though the row is a person now', async () => {
      await open();
      await fillIn();
      await submit('join-form');
      expect(member('wd-m3')!.status).toBe('joined');
      expect(q('gone-title')).toBeNull();
      expect(q('done-title')).not.toBeNull();
    });

    it('moving to another invitation shows that one', async () => {
      await open();
      await open('/join/weber-design/nothing');
      expect(gone().title).toBe('This invitation no longer works');
      await open();
      expect(text(q('join-title'))).toBe('Join Weber Design');
    });
  });

  describe('in German and Arabic', () => {
    it('speaks German, with the role and the German term', async () => {
      language.setLang('de');
      await open();
      expect(text(q('join-title'))).toBe('Weber Design beitreten');
      expect(text(q('role-readonly'))).toContain(de.roles.receipts.name);
      expect(text(q('join-submit'))).toBe(de.people.join.submit);
      await fillIn();
      await submit('join-form');
      expect(text(q('done-title'))).toBe(
        de.people.join.done.title
          .replace('{{name}}', 'Mia')
          .replace('{{business}}', 'Weber Design')
          .replace('{{role}}', de.roles.receipts.name),
      );
    });

    it('mirrors in Arabic, keeping the password and the code left to right', async () => {
      language.setLang('ar');
      await open();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('join-title'))).toBe(
        ar.people.join.title.replace('{{business}}', 'Weber Design'),
      );
      expect(field('join-password').getAttribute('dir')).toBe('ltr');
      expect(field('two-step-code').getAttribute('dir')).toBe('ltr');
    });
  });
});
