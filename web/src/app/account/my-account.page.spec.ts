import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { AccountService, demoBackupCodes } from '../state/account.service';
import { signInAsSara } from '../state/account.testing';
import { DemoStateService } from '../state/demo-state.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { MyAccountPage } from './my-account.page';

/** The words of a node: the marks that set a name apart (and keep its direction) are not words, and the spaces are one. */
const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
const body = <T extends HTMLElement = HTMLElement>(testId: string) =>
  document.body.querySelector<T>(`[data-testid="${testId}"]`);
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;

describe('MyAccountPage', () => {
  let fixture: ComponentFixture<MyAccountPage>;
  let accounts: AccountService;
  let demo: DemoStateService;
  let language: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    accounts = TestBed.inject(AccountService);
    demo = TestBed.inject(DemoStateService);
    language = TestBed.inject(LanguageService);
    signInAsSara();
  });

  afterEach(() => {
    fixture?.destroy();
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(): Promise<void> {
    fixture = TestBed.createComponent(MyAccountPage);
    await settle();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = <T extends HTMLElement = HTMLElement>(testId: string) =>
    el().querySelector<T>(`[data-testid="${testId}"]`);
  const qa = (selector: string) => Array.from(el().querySelectorAll<HTMLElement>(selector));
  const shown = (testId: string) => text(q(testId));

  async function click(node: HTMLElement | null): Promise<void> {
    node!.click();
    await settle();
  }

  async function type(input: HTMLInputElement | null, value: string): Promise<void> {
    input!.value = value;
    input!.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** Waits until the page shows (or no longer shows) a pop-up. */
  async function expectDialog(open: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog() !== null).toBe(open);
    });
  }

  /** The cursor, given a moment: it is moved after the next draw. */
  async function expectFocus(node: () => Element | null): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(node()).not.toBeNull();
      expect(document.activeElement).toBe(node());
    });
  }

  const rowIds = (prefix: string) =>
    qa(`[data-testid^="${prefix}-row-"]`).map((row) =>
      row.getAttribute('data-testid')!.slice(`${prefix}-row-`.length),
    );

  describe('the page', () => {
    it("the five cards show Sara's details", async () => {
      await render();
      expect(shown('account-title')).toBe('My account');
      expect(
        qa('section[data-testid$="-card"]').map((card) => card.getAttribute('data-testid')),
      ).toEqual([
        'you-card',
        'language-card',
        'signing-in-card',
        'devices-card',
        'businesses-card',
      ]);
      expect(qa('section[data-testid$="-card"] h2').map(text)).toEqual([
        'You',
        'Language',
        'Signing in',
        "Where you're signed in",
        'Your businesses',
      ]);

      // You
      expect(q<HTMLInputElement>('you-first-name')!.value).toBe('Sara');
      expect(q<HTMLInputElement>('you-last-name')!.value).toBe('Weber');
      expect(shown('you-email')).toBe('sara@example.com');
      expect(q('you-email')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(shown('you-email-hint')).toBe(
        'A new address is confirmed by email first; the old one is told.',
      );

      // Language
      expect(shown('language-hint')).toContain(
        'For the app and our emails to you. Tax returns, exports and invoices to German customers stay German.',
      );
      expect(qa('[data-testid="language-buttons"] button').map(text)).toEqual([
        'English',
        'Deutsch',
        'عربي',
      ]);

      // Signing in
      expect(shown('password-row')).toContain('Password');
      expect(shown('password-change')).toBe('Change');
      expect(shown('two-step-status')).toBe('On');
      expect(shown('two-step-hint')).toBe(
        'Authenticator app. Always on: your account holds bank and tax data.',
      );
      expect(shown('new-phone')).toBe('Use a new phone');
      expect(shown('backup-left')).toBe('6 of 8 left');
      expect(shown('new-codes')).toBe('Make new codes');

      // Where you're signed in
      expect(rowIds('device')).toEqual(['d1', 'd2']);
      expect(shown('device-name-d1')).toBe('Chrome on Windows');
      expect(shown('device-this-d1')).toBe('This device');
      expect(shown('device-sub-d1')).toBe('Berlin · now');
      expect(shown('device-name-d2')).toBe('Safari on iPhone');
      expect(q('device-this-d2')).toBeNull();
      expect(shown('device-sub-d2')).toBe(
        `Berlin · ${formatDate('2026-10-21', 'en', { year: true })}`,
      );
      expect(q('device-sign-out-d1')).toBeNull();
      expect(shown('device-sign-out-d2')).toBe('Sign out');
      expect(shown('sign-out-others')).toBe('Sign out everywhere else');

      // Your businesses
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      expect(shown('business-name-weber-design')).toBe('Weber Design');
      expect(shown('business-role-weber-design')).toBe('Owner');
      expect(shown('business-role-sara-yoga')).toBe('Owner');
      expect(shown('business-name-cafe-linde')).toBe('Café Linde GbR');
      expect(shown('business-role-cafe-linde')).toBe('Full access');
      expect(shown('businesses-owner-note')).toBe(
        "An owner can't leave: hand the business over in People with access first.",
      );
    });

    it('follows the person who is signed in, not Sara', async () => {
      accounts.signOut();
      const id = accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'Mia@Example.com',
        lang: 'en',
      });
      demo.createBusiness(
        { personId: id, name: 'Mia Becker', email: 'mia@example.com' },
        { name: 'Studio Becker', kind: 'freelance', legalForm: 'sole' },
      );
      accounts.signIn(id, false);
      await render();
      expect(q<HTMLInputElement>('you-first-name')!.value).toBe('Mia');
      expect(shown('you-email')).toBe('mia@example.com');
      expect(shown('backup-left')).toBe('8 of 8 left');
      expect(rowIds('device')).toEqual([`${id}-d1`]);
      expect(rowIds('business')).toEqual(['new-1']);
      expect(shown('business-role-new-1')).toBe('Owner');
    });
  });

  describe('the pop-ups', () => {
    it('the cross, Escape and a tap outside close each one like Cancel, and the cursor goes back to its button', async () => {
      await render();
      const closers = [
        () => dialog()!.querySelector<HTMLButtonElement>('[data-slot="dialog-close"]')!.click(),
        () =>
          dialog()!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })),
        () => document.body.querySelector<HTMLElement>('.cdk-overlay-backdrop')!.click(),
      ];
      for (const close of closers) {
        for (const opener of [
          'password-change',
          'new-phone',
          'new-codes',
          'business-leave-cafe-linde',
        ]) {
          await click(q(opener));
          await expectDialog(true);
          close();
          await expectDialog(false);
          await expectFocus(() => q(opener));
        }
      }
      // Nothing was changed by closing them: Leave did not leave, and Change did not change.
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      expect(accounts.person().devices).toHaveLength(2);
      expect(q('password-changed')).toBeNull();
      expect(q('businesses-left')).toBeNull();
    });
  });

  describe('You', () => {
    it('Save keeps the first and last name, without the spaces around them', async () => {
      await render();
      await type(q<HTMLInputElement>('you-first-name'), '  Sarah ');
      await type(q<HTMLInputElement>('you-last-name'), ' Weber-Klein ');
      expect(q('you-saved')).toBeNull();
      await click(q('you-save'));
      expect(accounts.person()).toMatchObject({ firstName: 'Sarah', lastName: 'Weber-Klein' });
      expect(q<HTMLInputElement>('you-first-name')!.value).toBe('Sarah');
      expect(shown('you-saved')).toBe('Saved.');
      // The person menu and the greeting follow: they read the same person.
      expect(demo.person.firstName).toBe('Sarah');
    });

    it('says which name is missing and saves nothing', async () => {
      await render();
      await type(q<HTMLInputElement>('you-first-name'), ' ');
      await type(q<HTMLInputElement>('you-last-name'), '');
      await click(q('you-save'));
      expect(shown('you-error-first-name')).toBe('Type your first name.');
      expect(shown('you-error-last-name')).toBe('Type your last name.');
      expect(q('you-first-name')!.getAttribute('aria-invalid')).toBe('true');
      expect(accounts.person()).toMatchObject({ firstName: 'Sara', lastName: 'Weber' });
      expect(q('you-saved')).toBeNull();
      await expectFocus(() => q('you-first-name'));

      // Typing again takes its message away.
      await type(q<HTMLInputElement>('you-first-name'), 'Sara');
      expect(q('you-error-first-name')).toBeNull();
      expect(q('you-error-last-name')).not.toBeNull();
    });

    it('changing the email waits for the confirmation', async () => {
      await render();
      expect(q('you-email-form')).toBeNull();
      await click(q('you-email-change'));
      await expectFocus(() => q('you-email-input'));

      await type(q<HTMLInputElement>('you-email-input'), ' New.Address@Example.com ');
      await click(q('you-email-send'));

      // The link is "sent": nothing has changed until its button is pressed.
      expect(accounts.person().email).toBe('sara@example.com');
      expect(shown('you-email')).toBe('sara@example.com');
      expect(shown('you-email-sent')).toBe(
        'We sent a link to new.address@example.com. It works for 24 hours. Your email stays the same until you confirm it.',
      );
      expect(q('you-email-sent')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(shown('demo-email-label')).toBe('Demo: shown here instead of sent');
      expect(shown('demo-email-to')).toBe('To: new.address@example.com');
      expect(shown('demo-email-subject')).toBe('Confirm your new email');
      expect(shown('demo-email-action')).toBe('Confirm my new email');
      await expectFocus(() => q('you-email-sent'));

      await click(q('demo-email-action'));
      expect(accounts.person().email).toBe('new.address@example.com');
      expect(shown('you-email')).toBe('new.address@example.com');
      expect(q('demo-email')).toBeNull();
      expect(shown('you-email-changed')).toBe('Email changed. The old address is told.');
      expect(shown('you-email-change')).toBe('Change');
      // The person is found by the new address now, and not by the old.
      expect(accounts.emailTaken('new.address@example.com')).toBe(true);
      expect(accounts.emailTaken('sara@example.com')).toBe(false);
    });

    it('Cancel leaves the email as it is, before and after the link is sent', async () => {
      await render();
      await click(q('you-email-change'));
      await type(q<HTMLInputElement>('you-email-input'), 'other@example.com');
      await click(q('you-email-cancel'));
      expect(q('you-email-form')).toBeNull();
      await expectFocus(() => q('you-email-change'));

      await click(q('you-email-change'));
      expect(q<HTMLInputElement>('you-email-input')!.value).toBe('');
      await type(q<HTMLInputElement>('you-email-input'), 'other@example.com');
      await click(q('you-email-send'));
      expect(q('demo-email')).not.toBeNull();
      await click(q('you-email-cancel'));
      expect(q('demo-email')).toBeNull();
      expect(q('you-email-sent')).toBeNull();
      expect(accounts.person().email).toBe('sara@example.com');
      await expectFocus(() => q('you-email-change'));
    });

    it('names an email that is missing, is not one, is her own or is taken by an account, whatever its case', async () => {
      accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia@example.com',
        lang: 'en',
      });
      await render();
      await click(q('you-email-change'));
      const attempt = async (value: string) => {
        await type(q<HTMLInputElement>('you-email-input'), value);
        await click(q('you-email-send'));
        return shown('you-email-error');
      };
      expect(await attempt('')).toBe('Type your email.');
      expect(await attempt('not an email')).toBe("This doesn't look like an email address.");
      expect(await attempt(' SARA@example.com ')).toBe('This is already your email.');
      expect(await attempt(' Mia@Example.COM ')).toBe(
        'There is already an account with this email.',
      );
      expect(q('you-email-input')!.getAttribute('aria-invalid')).toBe('true');
      expect(q('demo-email')).toBeNull();
      await expectFocus(() => q('you-email-input'));

      // Typing takes the message away.
      await type(q<HTMLInputElement>('you-email-input'), 'x');
      expect(q('you-email-error')).toBeNull();
    });
  });

  describe('Language', () => {
    it("the language card saves the person's language and the app follows", async () => {
      await render();
      expect(accounts.person().lang).toBeNull();
      const button = (lang: string) => q(`language-${lang}`)!;
      expect(button('en').getAttribute('aria-pressed')).toBe('true');
      expect(button('de').getAttribute('aria-pressed')).toBe('false');

      await click(button('de'));
      expect(accounts.person().lang).toBe('de');
      expect(language.lang()).toBe('de');
      expect(document.documentElement.lang).toBe('de');
      expect(shown('account-title')).toBe('Mein Konto');
      expect(button('de').getAttribute('aria-pressed')).toBe('true');
      expect(button('en').getAttribute('aria-pressed')).toBe('false');

      await click(button('ar'));
      expect(accounts.person().lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
      expect(button('ar').getAttribute('aria-pressed')).toBe('true');

      await click(button('en'));
      expect(accounts.person().lang).toBe('en');
      expect(shown('account-title')).toBe('My account');
    });

    it("the buttons are in their own language and the group has the card's name", async () => {
      await render();
      expect(
        qa('[data-testid="language-buttons"] button').map((b) => b.getAttribute('lang')),
      ).toEqual(['en', 'de', 'ar']);
      const group = q('language-buttons')!;
      expect(group.getAttribute('role')).toBe('group');
      const label = group.getAttribute('aria-labelledby')!;
      expect(text(document.getElementById(label))).toBe('Language');
    });

    it("changes only the signed-in person's language, never another person's", async () => {
      await render();
      const mia = accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia@example.com',
        lang: 'ar',
      });
      await click(q('language-de'));
      expect(accounts.persons().find((p) => p.id === mia)!.lang).toBe('ar');
      expect(accounts.person().id).toBe('p1');
    });
  });

  describe('Signing in', () => {
    async function openPasswordDialog(): Promise<void> {
      await click(q('password-change'));
      await expectDialog(true);
    }

    it('Change password signs out the other devices', async () => {
      await render();
      expect(rowIds('device')).toEqual(['d1', 'd2']);
      await openPasswordDialog();
      expect(text(inDialog('signing-dialog-title'))).toBe('Change your password');
      expect(inDialog<HTMLInputElement>('password-current')!.value).not.toBe('');
      expect(inDialog('password-current')!.getAttribute('type')).toBe('password');
      expect(inDialog('password-new')!.getAttribute('type')).toBe('password');
      expect(text(inDialog('password-hint'))).toBe('At least 10 characters.');
      expect(text(inDialog('password-demo'))).toMatch(/^Demo: /);
      expect(inDialog('password-demo')!.className).toContain('border-warning');
      expect(inDialog('password-demo')!.className).toContain('border-dashed');

      // Too short: nothing changes, and the message says why.
      await type(inDialog<HTMLInputElement>('password-new'), 'short');
      await click(inDialog('password-save'));
      expect(text(inDialog('password-error-new'))).toBe('Use at least 10 characters.');
      expect(inDialog('password-new')!.getAttribute('aria-invalid')).toBe('true');
      expect(accounts.person().devices).toHaveLength(2);
      expect(dialog()).not.toBeNull();

      await type(inDialog<HTMLInputElement>('password-new'), 'a long enough one');
      expect(inDialog('password-error-new')).toBeNull();
      await click(inDialog('password-save'));
      await expectDialog(false);

      expect(accounts.person().devices.map((d) => d.id)).toEqual(['d1']);
      expect(rowIds('device')).toEqual(['d1']);
      expect(shown('password-changed')).toBe(
        "Password changed. You're signed out on your other devices.",
      );
      expect(accounts.signedIn()).toBe(true);
      await expectFocus(() => q('password-changed'));
    });

    it('a password only needs the current one filled in, and counts characters not bytes', async () => {
      await render();
      await openPasswordDialog();
      await type(inDialog<HTMLInputElement>('password-current'), '');
      await type(inDialog<HTMLInputElement>('password-new'), 'a long enough one');
      await click(inDialog('password-save'));
      expect(text(inDialog('password-error-current'))).toBe('Type your current password.');
      expect(accounts.person().devices).toHaveLength(2);

      await type(inDialog<HTMLInputElement>('password-current'), 'anything');
      expect(inDialog('password-error-current')).toBeNull();
      // 10 characters of 2 bytes each.
      await type(inDialog<HTMLInputElement>('password-new'), 'ÄÖÜäöüßÄÖÜ');
      await click(inDialog('password-save'));
      await expectDialog(false);
      expect(accounts.person().devices).toHaveLength(1);
    });

    it('Cancel leaves the devices and forgets what was typed; it opens with the current password filled in again', async () => {
      await render();
      await openPasswordDialog();
      const filled = inDialog<HTMLInputElement>('password-current')!.value;
      await type(inDialog<HTMLInputElement>('password-current'), '');
      await type(inDialog<HTMLInputElement>('password-new'), 'draft');
      await click(inDialog('signing-cancel'));
      await expectDialog(false);
      expect(accounts.person().devices).toHaveLength(2);
      expect(q('password-changed')).toBeNull();
      await expectFocus(() => q('password-change'));

      await openPasswordDialog();
      expect(inDialog<HTMLInputElement>('password-current')!.value).toBe(filled);
      expect(inDialog<HTMLInputElement>('password-new')!.value).toBe('');
    });

    it('Use a new phone sets up two-step login again, with 8 new backup codes', async () => {
      await render();
      expect(shown('backup-left')).toBe('6 of 8 left');
      await click(q('new-phone'));
      await expectDialog(true);
      expect(text(inDialog('signing-dialog-title'))).toBe('Use a new phone');
      const codes = Array.from(
        dialog()!.querySelectorAll('[data-testid="two-step-backup"] li bdi'),
      ).map(text);
      expect(codes).toEqual(demoBackupCodes(1));
      expect(shown('backup-left')).toBe('8 of 8 left');

      // The block's own "I've saved them" needs the 6 digits.
      await click(inDialog('two-step-done'));
      expect(text(inDialog('two-step-error'))).toBe('The code has 6 digits.');
      expect(q('phone-done')).toBeNull();
      await type(inDialog<HTMLInputElement>('two-step-code'), '123456');
      await click(inDialog('two-step-done'));
      expect(text(inDialog('two-step-saved'))).toBe('Two-step login is set up.');

      await click(inDialog('signing-close'));
      await expectDialog(false);
      expect(shown('phone-done')).toBe('Your new phone is set up.');
      expect(shown('two-step-status')).toBe('On');
      await expectFocus(() => q('new-phone'));
    });

    it('Make new codes shows 8 codes and 8 of 8 left', async () => {
      await render();
      expect(accounts.person().backupCodesLeft).toBe(6);
      await click(q('new-codes'));
      await expectDialog(true);
      expect(text(inDialog('signing-dialog-title'))).toBe('Your new backup codes');
      const items = Array.from(dialog()!.querySelectorAll('[data-testid="codes-list"] li'));
      expect(items).toHaveLength(8);
      expect(items.map(text)).toEqual(demoBackupCodes(1));
      for (const item of items) expect(item.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(text(inDialog('codes-hint'))).toContain('Save these 8 codes somewhere safe.');
      expect(text(inDialog('codes-old'))).toBe("The old codes don't work any more.");
      expect(shown('backup-left')).toBe('8 of 8 left');
      expect(accounts.person().backupCodesLeft).toBe(8);

      // They are shown once: closing the pop-up is the end of them, and Make new codes makes a different set.
      await click(inDialog('signing-close'));
      await expectDialog(false);
      expect(el().textContent).not.toContain(demoBackupCodes(1)[0]);
      expect(document.body.textContent).not.toContain(demoBackupCodes(1)[0]);
      await expectFocus(() => q('new-codes'));
      await click(q('new-codes'));
      await expectDialog(true);
      expect(
        Array.from(dialog()!.querySelectorAll('[data-testid="codes-list"] li')).map(text),
      ).toEqual(demoBackupCodes(2));
    });

    it('says 0 of 8 left in a word, not a colour, and Make new codes brings it back to 8', async () => {
      for (let i = 0; i < 6; i++) accounts.useBackupCode('p1');
      await render();
      expect(shown('backup-left')).toBe('0 of 8 left');
      await click(q('new-codes'));
      expect(shown('backup-left')).toBe('8 of 8 left');
    });
  });

  describe("Where you're signed in", () => {
    it('signing out the iPhone leaves this device', async () => {
      await render();
      await click(q('device-sign-out-d2'));
      expect(accounts.person().devices.map((d) => d.id)).toEqual(['d1']);
      expect(rowIds('device')).toEqual(['d1']);
      expect(shown('device-name-d1')).toBe('Chrome on Windows');
      expect(shown('device-this-d1')).toBe('This device');
      expect(shown('devices-status')).toBe('Safari on iPhone is signed out.');
      // Nothing is left to sign out: the button gives way to a sentence, and the cursor goes there.
      expect(q('sign-out-others')).toBeNull();
      expect(shown('devices-none')).toBe("You're not signed in anywhere else.");
      await expectFocus(() => q('devices-status'));
      expect(accounts.signedIn()).toBe(true);
    });

    it('Sign out everywhere else keeps this device and says so', async () => {
      accounts.updatePerson('p1', (p) => ({
        ...p,
        devices: [
          ...p.devices,
          {
            id: 'd3',
            browser: 'Firefox',
            system: 'Linux',
            place: 'Hamburg',
            lastSeen: '2026-10-19',
            current: false,
          },
        ],
      }));
      await render();
      expect(rowIds('device')).toEqual(['d1', 'd2', 'd3']);
      await click(q('sign-out-others'));
      expect(rowIds('device')).toEqual(['d1']);
      expect(accounts.person().devices).toHaveLength(1);
      expect(shown('devices-status')).toBe('Signed out everywhere else.');
      expect(shown('devices-none')).toBe("You're not signed in anywhere else.");
      expect(q('sign-out-others')).toBeNull();
      await expectFocus(() => q('devices-status'));
    });

    it('with others left, signing one out keeps the button and says which one went', async () => {
      accounts.updatePerson('p1', (p) => ({
        ...p,
        devices: [
          ...p.devices,
          {
            id: 'd3',
            browser: 'Firefox',
            system: 'Linux',
            place: 'Hamburg',
            lastSeen: null,
            current: false,
          },
        ],
      }));
      await render();
      expect(shown('device-sub-d3')).toBe('Hamburg · now');
      await click(q('device-sign-out-d2'));
      expect(rowIds('device')).toEqual(['d1', 'd3']);
      expect(q('sign-out-others')).not.toBeNull();
      expect(q('devices-none')).toBeNull();
      expect(shown('devices-status')).toBe('Safari on iPhone is signed out.');
      await expectFocus(() => q('devices-status'));
    });

    it('names the device in the button, for a screen reader, and says the rows are samples', async () => {
      await render();
      expect(q('device-sign-out-d2')!.getAttribute('aria-label')).toBe('Sign out Safari on iPhone');
      expect(shown('devices-demo')).toMatch(/^Demo: /);
      expect(q('devices-demo')!.className).toContain('border-dashed');
    });

    it('reads its dates in the language of the page', async () => {
      await render();
      language.setLang('de');
      await settle();
      expect(shown('device-name-d2')).toBe('Safari auf iPhone');
      expect(shown('device-sub-d2')).toBe(
        `Berlin · ${formatDate('2026-10-21', 'de', { year: true })}`,
      );
      expect(shown('device-sub-d1')).toBe('Berlin · jetzt');
      expect(shown('device-this-d1')).toBe('Dieses Gerät');
    });
  });

  describe('Your businesses', () => {
    async function openLeave(id: string): Promise<void> {
      await click(q(`business-leave-${id}`));
      await expectDialog(true);
    }

    it('an owner has no Leave button', async () => {
      await render();
      expect(q('business-leave-weber-design')).toBeNull();
      expect(q('business-leave-sara-yoga')).toBeNull();
      expect(q('business-leave-cafe-linde')).not.toBeNull();
      expect(shown('business-leave-cafe-linde')).toBe('Leave');
      expect(q('business-leave-cafe-linde')!.getAttribute('aria-label')).toBe(
        'Leave Café Linde GbR',
      );
      expect(q('businesses-owner-note')).not.toBeNull();
    });

    it('the note about owners stays while the person still owns a business', async () => {
      await render();
      await openLeave('cafe-linde');
      await click(inDialog('leave-confirm'));
      await expectDialog(false);
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga']);
      expect(q('businesses-owner-note')).not.toBeNull();
    });

    it('after leaving the open business, another one opens and the page shows it', async () => {
      demo.setBusiness('cafe-linde');
      await render();
      expect(demo.business().id).toBe('cafe-linde');
      await openLeave('cafe-linde');
      await click(inDialog('leave-confirm'));
      await expectDialog(false);
      expect(demo.business().id).toBe('weber-design');
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga']);
    });

    it('Cancel and the cross leave the business, and the cursor goes back to the button', async () => {
      await render();
      await openLeave('cafe-linde');
      await click(inDialog('leave-cancel'));
      await expectDialog(false);
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      await expectFocus(() => q('business-leave-cafe-linde'));
    });

    it('after leaving, the cursor is on the line that says so, since the button it was on is gone', async () => {
      await render();
      await openLeave('cafe-linde');
      await click(inDialog('leave-confirm'));
      await expectDialog(false);
      expect(shown('businesses-left')).toBe('You left Café Linde GbR.');
      await expectFocus(() => q('businesses-left'));
    });

    it('says nothing about leaving when the state did not let the person go', async () => {
      vi.spyOn(demo, 'leaveBusiness').mockImplementation(() => undefined);
      await render();
      await openLeave('cafe-linde');
      await click(inDialog('leave-confirm'));
      await expectDialog(false);
      expect(q('businesses-left')).toBeNull();
      expect(rowIds('business')).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
      await expectFocus(() => q('business-leave-cafe-linde'));
    });

    it("hides Leave on the person's last business, which the state would not let go", async () => {
      const real = demo.businesses;
      const last = real.filter((b) => b.id === 'cafe-linde');
      vi.spyOn(demo, 'businesses', 'get').mockReturnValue(last);
      await render();
      expect(rowIds('business')).toEqual(['cafe-linde']);
      expect(q('business-leave-cafe-linde')).toBeNull();
      expect(shown('business-only-cafe-linde')).toBe(
        "This is your only business, so you can't leave it.",
      );
      expect(q('businesses-owner-note')).toBeNull();
    });
  });
});

describe('MyAccountPage inside the app shell', () => {
  let harness: RouterTestingHarness;
  let shell: HTMLElement;
  let demo: DemoStateService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    demo = TestBed.inject(DemoStateService);
    signInAsSara();
    harness = await RouterTestingHarness.create('/account');
    shell = harness.routeNativeElement as HTMLElement;
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function sync(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const inShell = (testId: string) => shell.querySelector<HTMLElement>(`[data-testid="${testId}"]`);

  /** Opens the switcher in the top bar and reads its entries; the next tap on its button closes it. */
  async function readSwitcher(): Promise<string> {
    inShell('business-switcher')!.click();
    await sync();
    const names = Array.from(document.body.querySelectorAll<HTMLElement>('[hlmDropdownMenuItem]'))
      .map(text)
      .join(' | ');
    inShell('business-switcher')!.click();
    await sync();
    return names;
  }

  async function waitForDialog(open: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await sync();
      expect(dialog() !== null).toBe(open);
    });
  }

  it('opens inside the app shell, under the top bar', async () => {
    await vi.waitFor(async () => {
      await sync();
      expect(shell.querySelector('app-my-account-page')).not.toBeNull();
    });
    expect(shell.querySelector('app-top-bar')).not.toBeNull();
    expect(text(inShell('account-title'))).toBe('My account');
  });

  it('leaving Café Linde asks first and takes it out of the switcher', async () => {
    await vi.waitFor(async () => {
      await sync();
      expect(inShell('business-leave-cafe-linde')).not.toBeNull();
    });
    expect(await readSwitcher()).toContain('Café Linde GbR');
    expect(demo.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);

    // Leave asks first: nothing has happened while the question is open, and Cancel leaves everything as it was.
    inShell('business-leave-cafe-linde')!.click();
    await waitForDialog(true);
    expect(text(inDialog('leave-title'))).toBe('Leave Café Linde GbR?');
    expect(text(inDialog('leave-body'))).toBe(
      'You will no longer be able to open its books. The owner can invite you again.',
    );
    expect(demo.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
    inDialog('leave-cancel')!.click();
    await waitForDialog(false);
    expect(demo.businesses).toHaveLength(3);
    expect(inShell('business-row-cafe-linde')).not.toBeNull();

    // Leave takes it away from the list and from the switcher.
    inShell('business-leave-cafe-linde')!.click();
    await waitForDialog(true);
    inDialog('leave-confirm')!.click();
    await waitForDialog(false);
    expect(demo.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga']);
    expect(inShell('business-row-cafe-linde')).toBeNull();
    expect(text(inShell('businesses-left'))).toBe('You left Café Linde GbR.');
    const names = await readSwitcher();
    expect(names).toContain('Weber Design');
    expect(names).toContain('Sara Weber Yoga');
    expect(names).not.toContain('Café Linde');
  });
});
