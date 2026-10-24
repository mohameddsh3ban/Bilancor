import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { formatDate } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Member } from '../data/models';
import { AccountService } from '../state/account.service';
import { DemoStateService } from '../state/demo-state.service';
import { PeopleCard } from './people-card';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

@Component({ template: '' })
class JoinStub {}

/** The words of a node: the marks that set a name apart (and keep its direction) are not words, and the spaces are one. */
const text = (node: Element | null | undefined) =>
  node?.textContent?.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim() ?? '';
const body = (testId: string) =>
  document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
const dialog = () => document.body.querySelector<HTMLElement>('[role="dialog"]');
const inDialog = <T extends HTMLElement = HTMLElement>(testId: string) =>
  dialog()?.querySelector<T>(`[data-testid="${testId}"]`) ?? null;

describe('PeopleCard', () => {
  let fixture: ComponentFixture<PeopleCard>;
  let demo: DemoStateService;
  let language: LanguageService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'join/:businessId/:memberId', component: JoinStub }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    language = TestBed.inject(LanguageService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    fixture.destroy();
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  async function render(businessId = 'weber-design'): Promise<void> {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(PeopleCard);
    await settle();
  }

  const el = () => fixture.nativeElement as HTMLElement;
  const q = (testId: string) => el().querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const row = (id: string) => q(`people-row-${id}`);
  const rowIds = () =>
    Array.from(el().querySelectorAll('[data-testid^="people-row-"]')).map((r) =>
      r.getAttribute('data-testid')!.slice('people-row-'.length),
    );
  const name = (id: string) => text(q(`people-name-${id}`));
  const sub = (id: string) => text(q(`people-sub-${id}`));
  const role = (id: string) => text(q(`people-role-${id}`));
  const member = (id: string): Member | undefined =>
    demo.business().people.find((m) => m.id === id);
  const historyKeys = () => demo.business().history.map((line) => line.key);

  /** Waits until the page shows (or no longer shows) a dialog. */
  async function expectDialog(open: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(dialog() !== null).toBe(open);
    });
  }

  async function openMenu(id: string): Promise<void> {
    q(`people-menu-${id}`)!.click();
    await vi.waitFor(async () => {
      await settle();
      expect(document.body.querySelector('[role="menu"]')).not.toBeNull();
    });
  }

  const menuItems = () =>
    Array.from(
      document.body.querySelectorAll<HTMLElement>('[role="menu"] [data-testid^="menu-"]'),
    ).map((item) => item.getAttribute('data-testid'));

  /** Chooses an item of a person's ⋮ menu. */
  async function choose(id: string, item: string): Promise<void> {
    await openMenu(id);
    body(item)!.click();
    await settle();
  }

  async function type(input: HTMLInputElement, value: string): Promise<void> {
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** Opens the invitation form, fills it in and presses Send invitation. */
  async function invite(email: string, roleId: string | null): Promise<void> {
    q('people-invite')!.click();
    await expectDialog(true);
    await type(inDialog<HTMLInputElement>('invite-email')!, email);
    if (roleId) {
      inDialog<HTMLInputElement>(`role-${roleId}`)!.querySelector('input')!.click();
      await settle();
    }
    inDialog('invite-submit')!.click();
    await settle();
  }

  describe('the list', () => {
    it('Weber Design lists Sara as Owner, Jana as Tax advisor and Mia as Waiting', async () => {
      await render();
      expect(text(q('people-title'))).toBe('People with access');
      expect(text(q('people-intro'))).toBe(
        "Only these people can open Weber Design's books. Everyone is included in the price.",
      );
      expect(rowIds()).toEqual(['wd-m1', 'wd-m2', 'wd-m3']);
      expect(name('wd-m1')).toBe('Sara Weber (you)');
      expect(role('wd-m1')).toBe('Owner');
      expect(name('wd-m2')).toBe('Jana Hoffmann');
      expect(role('wd-m2')).toBe('Tax advisor');
      expect(name('wd-m3')).toBe('mia@example.com');
      expect(role('wd-m3')).toBe('Waiting');
    });

    it('says who joined when, and when an invitation was sent and how long its link works', async () => {
      await render();
      // The month's short name is the date format's (it differs between versions of the browser's language data).
      const day = (iso: string) => formatDate(iso, 'en', { year: true });
      expect(sub('wd-m1')).toBe(`sara@example.com · Joined ${day('2026-01-02')}`);
      expect(sub('wd-m2')).toBe(`jana@kanzlei-hoffmann.example · Joined ${day('2026-09-02')}`);
      expect(sub('wd-m3')).toBe('Invited 20 Oct · the link works until 27 Oct');
    });

    it('writes emails and dates left to right, so they keep their shape in an Arabic sentence', async () => {
      await render();
      for (const id of ['wd-m1', 'wd-m2']) {
        const email = q(`people-sub-${id}`)!.querySelector('bdi[dir="ltr"]')!;
        expect(email.textContent).toBe(member(id)!.email);
      }
      expect(q('people-name-wd-m3')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      const dates = Array.from(q('people-sub-wd-m3')!.querySelectorAll('bdi[dir="ltr"]')).map((d) =>
        text(d),
      );
      expect(dates).toEqual(['20 Oct', '27 Oct']);
    });

    it('shows the initials of a person, and an envelope for an invitation, which has no name yet', async () => {
      await render();
      expect(text(q('people-avatar-wd-m1'))).toBe('SW');
      expect(text(q('people-avatar-wd-m2'))).toBe('JH');
      expect(text(q('people-avatar-wd-m3'))).toBe('');
      expect(q('people-avatar-wd-m3')!.querySelector('ng-icon')).not.toBeNull();
    });

    it('every status is a word, in a colour of its own', async () => {
      await render();
      expect(q('people-role-wd-m1')!.className).toContain('text-primary');
      expect(q('people-role-wd-m3')!.className).toContain('text-warning');
      expect(q('people-role-wd-m2')!.className).toContain('text-muted-foreground');
    });

    it('follows the open business and the people it gains', async () => {
      await render();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(rowIds()).toEqual(['sy-m1']);
      expect(text(q('people-intro'))).toContain("Sara Weber Yoga's books");
    });

    it('shows the name and email a login has now: after Sara renames herself, her row does too, and the other rows stay', async () => {
      TestBed.inject(AccountService).updatePerson('p1', (p) => ({
        ...p,
        firstName: 'Mara',
        lastName: 'Klein',
        email: 'Mara.Klein@Example.com',
      }));
      await render();
      expect(name('wd-m1')).toBe('Mara Klein (you)');
      expect(text(q('people-avatar-wd-m1'))).toBe('MK');
      expect(sub('wd-m1')).toMatch(/^Mara.Klein@Example.com · Joined /);
      expect(name('wd-m2')).toBe('Jana Hoffmann');
      expect(sub('wd-m2')).toMatch(/^jana@kanzlei-hoffmann.example · /);
      expect(name('wd-m3')).toBe('mia@example.com');
    });

    it('also follows a person who made their own account and renamed themselves', async () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signOut();
      const id = accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia.b@example.com',
        lang: 'en',
      });
      const business = demo.createBusiness(
        { personId: id, name: 'Mia Becker', email: 'mia.b@example.com' },
        { name: 'Studio Becker', kind: 'freelance', legalForm: 'sole' },
      );
      accounts.signIn(id, false);
      accounts.updatePerson(id, (p) => ({ ...p, firstName: 'Mina', lastName: 'Berger' }));
      await render(business);
      expect(name(`${business}-m1`)).toBe('Mina Berger (you)');
      expect(text(q(`people-avatar-${business}-m1`))).toBe('MB');
    });

    it('is the card of the page: a section with the anchor people', async () => {
      await render();
      const card = el().querySelector('section')!;
      expect(card.id).toBe('people');
      expect(card.getAttribute('data-testid')).toBe('settings-people');
    });
  });

  describe('Invite someone', () => {
    it('opens a form with the email, the three roles with what each can and can not do, and Send invitation', async () => {
      await render();
      expect(text(q('people-invite'))).toBe('Invite someone');
      q('people-invite')!.click();
      await expectDialog(true);
      expect(text(inDialog('invite-title'))).toBe('Invite someone to Weber Design');
      expect(inDialog<HTMLInputElement>('invite-email')!.value).toBe('');
      expect(['full', 'receipts', 'advisor'].map((r) => text(inDialog(`role-${r}`)))).toEqual([
        "Full access e.g. a partner Can: Everything the owner can: payments, receipts, taxes, settings Can't: Invite or remove people, change the plan",
        "Receipts only e.g. an assistant Can: Upload receipts and fix the ones they added Can't: Payments, bank balances, taxes, settings",
        "Tax advisor (Steuerberater:in) Can: See everything, download receipts and exports Can't: Change bookings, connect banks, send returns",
      ]);
      expect(text(inDialog('invite-hint'))).toBe(
        'The link works for 7 days. They choose their own password.',
      );
      expect(text(inDialog('invite-submit'))).toBe('Send invitation');
    });

    it('inviting adds a waiting row with a link until 29 Oct and shows the email', async () => {
      await render();
      await invite('noah@example.com', 'advisor');
      await expectDialog(false);

      expect(rowIds()).toEqual(['wd-m1', 'wd-m2', 'wd-m3', 'weber-design-m4']);
      expect(name('weber-design-m4')).toBe('noah@example.com');
      expect(role('weber-design-m4')).toBe('Waiting');
      expect(sub('weber-design-m4')).toBe('Invited 22 Oct · the link works until 29 Oct');
      expect(member('weber-design-m4')).toMatchObject({ role: 'advisor', status: 'invited' });
      expect(historyKeys()).toEqual(['personInvited']);
      expect(demo.business().history[0].params).toMatchObject({
        email: 'noah@example.com',
        role: 'advisor',
        by: 'Sara Weber',
      });

      expect(text(q('demo-email-label'))).toBe('Demo: shown here instead of sent');
      expect(text(q('demo-email-to'))).toBe('To: noah@example.com');
      expect(text(q('demo-email-subject'))).toBe(
        'Sara Weber invited you to Weber Design, as Tax advisor',
      );
      expect(text(q('demo-email-body'))).toBe(
        'Accept the invitation and choose your own password. The link works for 7 days.',
      );
      expect(text(q('demo-email-action'))).toBe('Accept the invitation');
    });

    it('Accept the invitation opens the join page of that invitation', async () => {
      await render();
      await invite('noah@example.com', 'full');
      await expectDialog(false);
      q('demo-email-action')!.click();
      await vi.waitFor(() => expect(router.url).toBe('/join/weber-design/weber-design-m4'));
    });

    it('stores the email without capitals or spaces', async () => {
      await render();
      await invite('  Noah@Example.COM ', 'receipts');
      expect(member('weber-design-m4')!.email).toBe('noah@example.com');
    });

    it('an email already invited says so, whatever its case', async () => {
      await render();
      await invite('  MIA@Example.com ', 'full');
      expect(dialog()).not.toBeNull();
      expect(text(inDialog('invite-error-email'))).toBe(
        'This email is already invited. Use Send again in the list.',
      );
      expect(rowIds()).toHaveLength(3);
      expect(inDialog('invite-email')!.getAttribute('aria-invalid')).toBe('true');
      expect(historyKeys()).toEqual([]);
      expect(q('demo-email')).toBeNull();
    });

    it('an email that already has access says so', async () => {
      await render();
      await invite('Jana@Kanzlei-Hoffmann.example', 'full');
      expect(text(inDialog('invite-error-email'))).toBe('This person already has access.');
      expect(rowIds()).toHaveLength(3);
    });

    it('asks for an email, a real one, and a role, and puts the cursor on what is missing', async () => {
      await render();
      await invite('  ', null);
      expect(text(inDialog('invite-error-email'))).toBe('Type their email.');
      expect(text(inDialog('invite-error-role'))).toBe('Choose what they can do.');
      await vi.waitFor(() => expect(document.activeElement).toBe(inDialog('invite-email')));

      await type(inDialog<HTMLInputElement>('invite-email')!, 'not an email');
      expect(inDialog('invite-error-email')).toBeNull();
      inDialog('invite-submit')!.click();
      await settle();
      expect(text(inDialog('invite-error-email'))).toBe("This doesn't look like an email address.");

      await type(inDialog<HTMLInputElement>('invite-email')!, 'noah@example.com');
      inDialog('invite-submit')!.click();
      await settle();
      expect(inDialog('invite-error-email')).toBeNull();
      expect(text(inDialog('invite-error-role'))).toBe('Choose what they can do.');
      expect(rowIds()).toHaveLength(3);

      inDialog<HTMLInputElement>('role-receipts')!.querySelector('input')!.click();
      await settle();
      expect(inDialog('invite-error-role')).toBeNull();
    });

    it('Cancel closes it and sends nothing, and it opens empty the next time', async () => {
      await render();
      q('people-invite')!.click();
      await expectDialog(true);
      await type(inDialog<HTMLInputElement>('invite-email')!, 'noah@example.com');
      inDialog<HTMLInputElement>('role-full')!.querySelector('input')!.click();
      await settle();
      inDialog('invite-cancel')!.click();
      await expectDialog(false);
      expect(rowIds()).toHaveLength(3);

      q('people-invite')!.click();
      await expectDialog(true);
      expect(inDialog<HTMLInputElement>('invite-email')!.value).toBe('');
      expect(inDialog<HTMLInputElement>('role-full')!.querySelector('input')!.checked).toBe(false);
    });

    it('the Tax advisor card explains Steuerberater:in behind its info button', async () => {
      await render();
      q('people-invite')!.click();
      await expectDialog(true);
      const info = inDialog('role-advisor')!.querySelector('app-term-info button')!;
      expect(info.getAttribute('aria-label')).toBe('What is Tax advisor?');
    });
  });

  describe('Send again and Cancel invitation', () => {
    it('Send again moves the link to 29 Oct and shows the email again', async () => {
      await render();
      expect(q('demo-email')).toBeNull();
      await choose('wd-m3', 'menu-resend');
      expect(sub('wd-m3')).toBe('Invited 20 Oct · the link works until 29 Oct');
      expect(member('wd-m3')!.expiresOn).toBe('2026-10-29');
      expect(text(q('demo-email-to'))).toBe('To: mia@example.com');
      expect(text(q('demo-email-subject'))).toBe(
        'Sara Weber invited you to Weber Design, as Receipts only',
      );
      q('demo-email-action')!.click();
      await vi.waitFor(() => expect(router.url).toBe('/join/weber-design/wd-m3'));
    });

    it('Cancel invitation removes the row, and the email of it', async () => {
      await render();
      await choose('wd-m3', 'menu-resend');
      expect(q('demo-email')).not.toBeNull();
      await choose('wd-m3', 'menu-cancel');
      expect(rowIds()).toEqual(['wd-m1', 'wd-m2']);
      expect(q('demo-email')).toBeNull();
      expect(historyKeys()).toEqual(['invitationCancelled']);
    });

    it('a waiting invitation has these two actions and no more', async () => {
      await render();
      await openMenu('wd-m3');
      expect(menuItems()).toEqual(['menu-resend', 'menu-cancel']);
      expect(text(body('menu-resend'))).toBe('Send again');
      expect(text(body('menu-cancel'))).toBe('Cancel invitation');
    });

    it('the email goes when another business opens', async () => {
      await render();
      await choose('wd-m3', 'menu-resend');
      demo.setBusiness('sara-yoga');
      await settle();
      expect(q('demo-email')).toBeNull();
    });
  });

  describe('Change what they can do', () => {
    it('a person who joined has Change, Make owner (Full access only) and Remove', async () => {
      await render();
      await openMenu('wd-m2');
      expect(menuItems()).toEqual(['menu-change', 'menu-remove']);
      expect(text(body('menu-change'))).toBe('Change what they can do');
      expect(text(body('menu-remove'))).toBe('Remove');
    });

    it('the owner has no menu, and every menu says whose it is', async () => {
      await render();
      expect(q('people-menu-wd-m1')).toBeNull();
      expect(q('people-menu-wd-m2')!.getAttribute('aria-label')).toBe('Actions for Jana Hoffmann');
      expect(q('people-menu-wd-m3')!.getAttribute('aria-label')).toBe(
        'Actions for mia@example.com',
      );
    });

    it('changing Jana to Full access shows Full access', async () => {
      await render();
      await choose('wd-m2', 'menu-change');
      await expectDialog(true);
      expect(text(inDialog('dialog-title'))).toBe('What can Jana Hoffmann do?');
      const radio = (r: string) => inDialog(`role-${r}`)!.querySelector('input')!;
      expect(radio('advisor').checked).toBe(true);
      expect(radio('full').checked).toBe(false);
      radio('full').click();
      await settle();
      expect(role('wd-m2')).toBe('Tax advisor');
      inDialog('dialog-confirm')!.click();
      await expectDialog(false);

      expect(role('wd-m2')).toBe('Full access');
      expect(member('wd-m2')!.role).toBe('full');
      expect(historyKeys()).toEqual(['roleChanged']);
    });

    it('Cancel changes nothing', async () => {
      await render();
      await choose('wd-m2', 'menu-change');
      await expectDialog(true);
      inDialog<HTMLInputElement>('role-receipts')!.querySelector('input')!.click();
      await settle();
      inDialog('dialog-cancel')!.click();
      await expectDialog(false);
      expect(role('wd-m2')).toBe('Tax advisor');
      expect(historyKeys()).toEqual([]);
    });

    it('opens on the role the person has now, whoever was asked about before', async () => {
      await render();
      await choose('wd-m2', 'menu-change');
      await expectDialog(true);
      inDialog<HTMLInputElement>('role-full')!.querySelector('input')!.click();
      await settle();
      inDialog('dialog-cancel')!.click();
      await expectDialog(false);
      await choose('wd-m2', 'menu-change');
      await expectDialog(true);
      expect(inDialog<HTMLInputElement>('role-advisor')!.querySelector('input')!.checked).toBe(
        true,
      );
    });
  });

  describe('Remove', () => {
    it('asks first, then the row goes', async () => {
      await render();
      await choose('wd-m2', 'menu-remove');
      await expectDialog(true);
      expect(text(inDialog('dialog-title'))).toBe('Remove Jana Hoffmann?');
      expect(text(inDialog('dialog-body'))).toBe(
        "Jana Hoffmann can't open Weber Design any more. What they did stays in the history.",
      );
      expect(rowIds()).toContain('wd-m2');

      inDialog('dialog-cancel')!.click();
      await expectDialog(false);
      expect(rowIds()).toContain('wd-m2');
      expect(historyKeys()).toEqual([]);

      await choose('wd-m2', 'menu-remove');
      await expectDialog(true);
      inDialog('dialog-confirm')!.click();
      await expectDialog(false);
      expect(rowIds()).toEqual(['wd-m1', 'wd-m3']);
      expect(historyKeys()).toEqual(['personRemoved']);
    });
  });

  describe('Make owner', () => {
    it('is offered for a person with Full access only', async () => {
      await render();
      await openMenu('wd-m2');
      expect(menuItems()).not.toContain('menu-owner');
    });

    it('is in the menu of a person who has Full access, between Change and Remove', async () => {
      await render();
      demo.changeRole('wd-m2', 'full');
      await settle();
      await openMenu('wd-m2');
      expect(menuItems()).toEqual(['menu-change', 'menu-owner', 'menu-remove']);
      expect(text(body('menu-owner'))).toBe('Make owner');
    });

    it('Make owner hands over and hides the menus', async () => {
      await render();
      demo.changeRole('wd-m2', 'full');
      await settle();
      await choose('wd-m2', 'menu-owner');
      await expectDialog(true);
      expect(text(inDialog('dialog-title'))).toBe('Make Jana Hoffmann the owner?');
      expect(text(inDialog('dialog-body'))).toBe(
        "Jana Hoffmann will own Weber Design and decide who has access. You become Full access: you can't invite or remove people any more.",
      );
      expect(role('wd-m1')).toBe('Owner');
      inDialog('dialog-confirm')!.click();
      await expectDialog(false);

      expect(role('wd-m2')).toBe('Owner');
      expect(role('wd-m1')).toBe('Full access');
      expect(historyKeys()).toEqual(['ownerChanged', 'roleChanged']);
      expect(el().querySelectorAll('[data-testid^="people-menu-"]')).toHaveLength(0);
      expect(q('people-invite')).toBeNull();
      expect(q('support-allow')).toBeNull();
      expect(text(q('people-owner-note'))).toBe(
        'Only Jana Hoffmann (the owner) can invite or remove people.',
      );
    });

    it('takes the invitation email away: only the owner has a use for it', async () => {
      await render();
      await choose('wd-m3', 'menu-resend');
      expect(q('demo-email')).not.toBeNull();
      demo.changeRole('wd-m2', 'full');
      demo.makeOwner('wd-m2');
      await settle();
      expect(q('demo-email')).toBeNull();
    });

    it('asks first: Cancel hands nothing over', async () => {
      await render();
      demo.changeRole('wd-m2', 'full');
      await settle();
      await choose('wd-m2', 'menu-owner');
      await expectDialog(true);
      inDialog('dialog-cancel')!.click();
      await expectDialog(false);
      expect(role('wd-m1')).toBe('Owner');
      expect(role('wd-m2')).toBe('Full access');
    });
  });

  describe('somebody who is not the owner', () => {
    it('at Café Linde Sara sees the list without menus and that Jonas Linde is the owner', async () => {
      await render('cafe-linde');
      expect(rowIds()).toEqual(['cl-m1', 'cl-m2']);
      expect(name('cl-m1')).toBe('Jonas Linde');
      expect(role('cl-m1')).toBe('Owner');
      expect(name('cl-m2')).toBe('Sara Weber (you)');
      expect(role('cl-m2')).toBe('Full access');
      expect(el().querySelectorAll('[data-testid^="people-menu-"]')).toHaveLength(0);
      expect(q('people-invite')).toBeNull();
      expect(text(q('people-owner-note'))).toBe(
        'Only Jonas Linde (the owner) can invite or remove people.',
      );
      expect(text(q('people-intro'))).toBe(
        "Only these people can open Café Linde GbR's books. Everyone is included in the price.",
      );
    });

    it('the owner has no such line', async () => {
      await render();
      expect(q('people-owner-note')).toBeNull();
    });

    it('can still read what support may do, but not change it', async () => {
      await render('cafe-linde');
      expect(text(q('support-status'))).toContain('No access.');
      expect(q('support-allow')).toBeNull();

      // Sara lets support look at Weber Design, then hands it over: now she has Full access there.
      demo.setBusiness('weber-design');
      demo.setSupportAccess(true);
      demo.changeRole('wd-m2', 'full');
      demo.makeOwner('wd-m2');
      await settle();
      expect(role('wd-m1')).toBe('Full access');
      expect(text(q('support-status'))).toBe('Support can look until 29 Oct');
      expect(q('support-stop')).toBeNull();
      expect(q('support-allow')).toBeNull();
    });
  });

  describe('our support team', () => {
    it('Let support look shows until 29 Oct; Stop now shows No access', async () => {
      await render();
      expect(text(q('support-title'))).toBe('Our support team');
      expect(text(q('support-status'))).toBe(
        "No access. We can't see your books unless you let us in, for example when you ask us for help.",
      );
      expect(text(q('support-allow'))).toBe('Let support look for 7 days');
      expect(q('support-stop')).toBeNull();

      q('support-allow')!.click();
      await settle();
      expect(text(q('support-status'))).toBe('Support can look until 29 Oct');
      expect(q('support-status')!.querySelector('bdi[dir="ltr"]')!.textContent).toBe('29 Oct');
      expect(text(q('support-look-only'))).toBe("Looking only: support can't change anything.");
      expect(text(q('support-stop'))).toBe('Stop now');
      expect(q('support-allow')).toBeNull();
      expect(demo.business().supportUntil).toBe('2026-10-29');

      q('support-stop')!.click();
      await settle();
      expect(text(q('support-status'))).toContain('No access.');
      expect(text(q('support-allow'))).toBe('Let support look for 7 days');
      expect(demo.business().supportUntil).toBeNull();
      expect(historyKeys()).toEqual(['supportOff', 'supportOn']);
    });
  });

  describe('the invitation email', () => {
    const others = () =>
      Array.from(el().querySelectorAll<HTMLElement>('[data-testid="demo-email-other"]'));

    it('has one line in each of the other two languages', async () => {
      await render();
      await invite('noah@example.com', 'advisor');
      await vi.waitFor(() => expect(others()).toHaveLength(2));
      expect(others().map((line) => line.getAttribute('lang'))).toEqual(['de', 'ar']);
      expect(others().map((line) => line.getAttribute('dir'))).toEqual(['ltr', 'rtl']);
      expect(text(others()[0])).toBe(
        'Sara Weber hat dich zu Weber Design eingeladen (Rolle: Steuerberater:in). Öffne den Link, um beizutreten.',
      );
      expect(text(others()[1])).toBe(
        'دعاك Sara Weber إلى Weber Design بصلاحية مستشار ضرائب. افتح الرابط للانضمام.',
      );
      // The email itself is the inviter's: the page's language for a person with none of their own.
      expect(q('demo-email-text')!.getAttribute('lang')).toBe('en');
    });

    it("is written in the inviter's language, with the other two as its lines", async () => {
      TestBed.inject(AccountService).updatePerson('p1', (p) => ({ ...p, lang: 'de' }));
      await render();
      await choose('wd-m3', 'menu-resend');
      await vi.waitFor(() => expect(others()).toHaveLength(2));
      expect(text(q('demo-email-subject'))).toBe(
        'Sara Weber hat dich zu Weber Design eingeladen (Rolle: Nur Belege)',
      );
      expect(text(q('demo-email-action'))).toBe('Einladung annehmen');
      expect(q('demo-email-text')!.getAttribute('lang')).toBe('de');
      expect(others().map((line) => line.getAttribute('lang'))).toEqual(['en', 'ar']);
      expect(text(others()[0])).toBe(
        'Sara Weber invited you to Weber Design, as Receipts only. Open the link to join.',
      );
      // The page itself keeps the browser's language.
      expect(text(q('people-title'))).toBe('People with access');
    });
  });

  describe('in German and Arabic', () => {
    it('speaks German, with the roles in German', async () => {
      language.setLang('de');
      await render();
      expect(text(q('people-title'))).toBe(de.people.title);
      expect(role('wd-m1')).toBe(de.roles.owner.name);
      expect(role('wd-m2')).toBe(de.roles.advisor.name);
      expect(role('wd-m3')).toBe(de.people.row.waiting);
      expect(text(q('people-invite'))).toBe(de.people.invite.button);
      expect(sub('wd-m3')).toContain(de.people.row.invited);
    });

    it('mirrors in Arabic, keeping the emails and the dates left to right', async () => {
      language.setLang('ar');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('people-title'))).toBe(ar.people.title);
      expect(role('wd-m3')).toBe(ar.people.row.waiting);
      for (const bdi of Array.from(el().querySelectorAll('[data-testid^="people-sub-"] bdi'))) {
        expect(bdi.getAttribute('dir')).toBe('ltr');
      }
      q('people-invite')!.click();
      await expectDialog(true);
      expect(inDialog('invite-email')!.getAttribute('dir')).toBe('ltr');
    });
  });
});
