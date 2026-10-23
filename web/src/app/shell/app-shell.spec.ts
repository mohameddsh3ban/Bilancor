import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { presetOf } from '../domain/home-cards';
import { AccountService } from '../state/account.service';
import { signInAsSara } from '../state/account.testing';
import { DemoStateService } from '../state/demo-state.service';
import { withConnection } from '../state/demo-state.testing';
import { NoticeService } from '../state/notice.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { AppShell } from './app-shell';
import { ComingSoonPage } from './coming-soon.page';

/** Stands in for the Taxes page, which the app gets later. */
@Component({ template: '' })
class TaxesStub {}

/** Stands in for the sign-in page, where Reset demo ends. */
@Component({ template: '' })
class SignInStub {}

describe('AppShell', () => {
  let el: HTMLElement;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          {
            path: '',
            component: AppShell,
            children: [
              { path: 'soon/:feature', component: ComingSoonPage },
              { path: 'taxes', component: TaxesStub },
            ],
          },
          { path: 'sign-in', component: SignInStub },
        ]),
      ],
    });
    harness = await RouterTestingHarness.create('/soon/payments');
    harness.detectChanges();
    el = harness.routeNativeElement as HTMLElement;
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const q = (selector: string) => el.querySelector<HTMLElement>(selector)!;
  const qa = (selector: string) => Array.from(el.querySelectorAll<HTMLElement>(selector));
  const body = (selector: string) => Array.from(document.body.querySelectorAll<HTMLElement>(selector));

  async function settle() {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  it('renders the routed page inside the shell with a demo bar and greeting', () => {
    expect(q('[data-testid="demo-toolbar"]').textContent).toContain('Demo');
    expect(el.textContent).toContain('Sara');
    expect(q('main').textContent).toContain('Payments');
  });

  it('business switcher changes business', async () => {
    const demo = TestBed.inject(DemoStateService);
    q('[data-testid="business-switcher"]').click();
    await settle();
    const option = body('[hlmDropdownMenuItem]').find((i) => i.textContent?.includes('Café Linde GbR'));
    expect(option).toBeTruthy();
    option!.click();
    await settle();
    expect(demo.business().id).toBe('cafe-linde');
    expect(q('[data-testid="business-switcher"]').textContent).toContain('Café Linde GbR');
  });

  it('has the Needs you button in the top bar, right before the bell, linking to the review inbox', () => {
    const button = q('[data-testid="needs-you-button"]');
    expect(button.textContent?.replace(/\s+/g, ' ').trim()).toBe('Needs you · 7');
    expect(button.getAttribute('href')).toBe('/review');
    expect(q('header').contains(button)).toBe(true);
    expect(button.closest('app-needs-you-button')!.nextElementSibling).toBe(q('app-bell-panel'));
  });

  it('the Needs you button follows the business that is open', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setBusiness('cafe-linde');
    harness.detectChanges();
    expect(el.querySelector('[data-testid="needs-you-button"]')).toBeNull();
    demo.setBusiness('sara-yoga');
    harness.detectChanges();
    expect(q('[data-testid="needs-you-button"]').textContent).toContain('Needs you · 3');
  });

  it('bell shows unread count', () => {
    // Weber Design: the terms, its calculated bank notice, the invoice that is late and the unreadable receipts.
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('4');
  });

  it('bell opens the history panel when bellOpen is set', async () => {
    expect(document.body.textContent).not.toContain('Notifications');
    TestBed.inject(NoticeService).bellOpen.set(true);
    await settle();
    expect(document.body.textContent).toContain('Notifications');
    expect(document.body.textContent).toContain('Your Qonto connection expires in 30 days');
  });

  it('bell panel lists the open notices, then the earlier history', async () => {
    TestBed.inject(NoticeService).bellOpen.set(true);
    await settle();
    const text = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
    const open = text('bell-open');
    expect(open).toContain('Needs action');
    expect(open).toContain('New terms from our bank-connection provider need your review');
    expect(open).toContain('Receipts that could not be read: 1');
    expect(open).toContain('Your Qonto connection expires in 5 days');
    expect(open).toContain('Bäckerei Lange is 22 days late with RE-2026-039');
    const history = text('bell-history');
    expect(history).toContain('Earlier');
    expect(history).toContain('Your Qonto connection expires in 30 days');
    expect(history).toContain('Receipts that could not be read: 1');
    expect(history).not.toContain('in 5 days');
  });

  it('bell panel says "in 1 day" and "today", never "in 1 days" or "in 0 days"', async () => {
    const demo = TestBed.inject(DemoStateService);
    const consentEnds = (date: string): void => {
      withConnection(demo, 'wd-qonto', { consentUntil: date });
    };
    TestBed.inject(NoticeService).bellOpen.set(true);
    consentEnds('2026-10-23');
    await settle();
    const open = () => document.body.querySelector('[data-testid="bell-open"]')?.textContent ?? '';
    expect(open()).toContain('Your Qonto connection expires in 1 day');
    expect(open()).not.toContain('1 days');
    consentEnds('2026-10-22');
    await settle();
    expect(open()).toContain('Your Qonto connection expires today');
    expect(open()).not.toContain('0 days');
  });

  it('a dismissed bank notice moves from "Needs action" to "Earlier"', async () => {
    const notices = TestBed.inject(NoticeService);
    notices.dismiss('bank-expiry-wd-qonto');
    notices.bellOpen.set(true);
    await settle();
    const text = (id: string) => document.body.querySelector(`[data-testid="${id}"]`)?.textContent ?? '';
    expect(text('bell-open')).not.toContain('in 5 days');
    expect(text('bell-history')).toContain('Your Qonto connection expires in 5 days');
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('3');
  });

  it('bell panel omits the open section when nothing is open', async () => {
    const demo = TestBed.inject(DemoStateService);
    const notices = TestBed.inject(NoticeService);
    demo.setBusiness('cafe-linde');
    notices.bellOpen.set(true);
    await settle();
    expect(document.body.querySelector('[data-testid="bell-open"]')).toBeNull();
    expect(document.body.querySelector('[data-testid="bell-history"]')).not.toBeNull();
  });

  it('bell opens the history panel on tap', async () => {
    q('[data-testid="bell"]').click();
    await settle();
    expect(TestBed.inject(NoticeService).bellOpen()).toBe(true);
    expect(document.body.textContent).toContain('Notifications');
  });

  it('language switcher sets rtl', async () => {
    const arabic = qa('[data-testid="lang-switcher"] button').find((b) => b.textContent?.trim() === 'عربي');
    arabic!.click();
    await settle();
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });

  it('pop-ups follow the language direction after a switch', async () => {
    const pane = () => document.body.querySelector<HTMLElement>('.cdk-overlay-pane');
    const dirOf = () => pane()?.closest('[dir]')?.getAttribute('dir');
    const pick = (label: string) =>
      qa('[data-testid="lang-switcher"] button')
        .find((b) => b.textContent?.trim() === label)!
        .click();
    pick('عربي');
    await settle();
    q('[data-testid="bell"]').click();
    await settle();
    expect(pane()).not.toBeNull();
    expect(dirOf()).toBe('rtl');
    q('[data-testid="bell"]').click();
    await settle();
    pick('EN');
    await settle();
    q('[data-testid="bell"]').click();
    await settle();
    expect(pane()).not.toBeNull();
    expect(dirOf()).toBe('ltr');
  });

  it('demo switch changes the setup state', () => {
    const demo = TestBed.inject(DemoStateService);
    const halfway = qa('[data-testid="demo-toolbar"] button').find((b) => b.textContent?.includes('Halfway'));
    halfway!.click();
    expect(presetOf(demo.setup())).toBe('halfway');
  });

  it('the demo switch presses the choice that matches the open business', () => {
    const demo = TestBed.inject(DemoStateService);
    const pressed = () =>
      qa('[data-testid="demo-toolbar"] [aria-pressed="true"]').map((b) => b.textContent?.trim());
    expect(pressed()).toEqual(['Active client']);
    demo.setSetup('halfway');
    harness.detectChanges();
    expect(pressed()).toEqual(['Halfway']);
  });

  it('no choice is pressed for a mixed set', () => {
    const demo = TestBed.inject(DemoStateService);
    demo.setSetup('halfway');
    demo.completeStep('tax');
    harness.detectChanges();
    expect(qa('[data-testid="demo-toolbar"] [aria-pressed="true"]')).toEqual([]);
    expect(qa('[data-testid="demo-toolbar"] [aria-pressed="false"]')).toHaveLength(3);
  });

  it('reset demo brings dismissed notices back', async () => {
    const notices = TestBed.inject(NoticeService);
    notices.dismiss('wd-n3');
    notices.dismiss('bank-expiry-wd-qonto');
    harness.detectChanges();
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('2');
    expect(q('[data-testid="demo-reset"]').textContent).toContain('Reset demo');
    q('[data-testid="demo-reset"]').click();
    // Reset demo leaves the app for the sign-in page, so the count is read from the service.
    expect(notices.unreadCount()).toBe(4);
    await settle();
  });

  it('Reset demo restores a changed payment', async () => {
    const demo = TestBed.inject(DemoStateService);
    const find = () => demo.business().transactions.find((t) => t.id === 'wd-t3')!;
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(find().receipt).toBe('notNeeded');
    q('[data-testid="demo-reset"]').click();
    await settle();
    expect(find().receipt).toBe('missing');
  });

  describe('tax reminder', () => {
    const reminder = () => document.body.querySelector<HTMLElement>('[role="dialog"] [data-testid="tax-reminder-list"]');
    const press = (testId: string) => document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();

    /** The pop-up loads a moment after the first paint, and closes after its exit animation. */
    async function expectReminder(shown: boolean): Promise<void> {
      await vi.waitFor(async () => {
        await settle();
        expect(reminder() !== null).toBe(shown);
      });
    }

    it('pops up when the app opens, over the page that opened', async () => {
      await expectReminder(true);
      expect(document.body.querySelector('[role="dialog"] h2')?.textContent?.trim()).toBe('2 tax returns are coming up');
      expect(q('main').textContent).toContain('Payments');
    });

    it('Got it keeps it away for the rest of the session', async () => {
      await expectReminder(true);
      press('tax-reminder-got-it');
      await expectReminder(false);
    });

    it('Open taxes in the pop-up switches business and closes it', async () => {
      await expectReminder(true);
      press('tax-reminder-open');
      expect(TestBed.inject(DemoStateService).business().id).toBe('cafe-linde');
      await expectReminder(false);
    });
  });

  it('has Upload receipt in the sidebar and the full menu', () => {
    const sidebar = q('aside');
    expect(sidebar.querySelector('a[href="/documents?add=1"]')?.textContent).toContain('Upload receipt');
    const labels = Array.from(sidebar.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Home', 'Payments', 'Documents', 'Invoices', 'Taxes', 'Reports', 'Settings', 'Help']);
  });

  it('has the bottom bar with the camera in the centre', () => {
    const slots = Array.from(q('[data-testid="bottom-bar"]').querySelectorAll<HTMLElement>('a, button'));
    expect(slots).toHaveLength(5);
    expect(slots[2].getAttribute('href')).toBe('/documents?add=1');
  });

  it('more opens the remaining menu items', async () => {
    q('[data-testid="more-button"]').click();
    await settle();
    const labels = body('[hlmDropdownMenuItem]').map((i) => i.textContent?.trim());
    expect(labels).toEqual(['Documents', 'Taxes', 'Reports', 'Settings', 'Help']);
  });
});

describe('AppShell and the review inbox', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    signInAsSara();
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('opened from the top bar, the review inbox closes back to the page the client was on', async () => {
    const harness = await RouterTestingHarness.create('/payments');
    harness.detectChanges();
    const shell = harness.routeNativeElement as HTMLElement;
    const settle = async () => {
      harness.detectChanges();
      await harness.fixture.whenStable();
      harness.detectChanges();
    };
    const router = TestBed.inject(Router);
    router.initialNavigation(); // the router follows the browser's history, as in the app
    expect(router.url).toBe('/payments');

    shell.querySelector<HTMLElement>('[data-testid="needs-you-button"]')!.click();
    await settle();
    expect(router.url).toBe('/review');
    expect(shell.querySelector('[data-testid="review-layer"]')).not.toBeNull();

    shell.querySelector<HTMLElement>('[data-testid="review-close"]')!.click();
    // Closing steps back in the browser history, which the router follows a moment later.
    await new Promise((resolve) => setTimeout(resolve));
    await settle();
    expect(router.url).toBe('/payments');
    expect(shell.querySelector('[data-testid="review-layer"]')).toBeNull();
  });
});

describe('AppShell, the person menu and the business switcher', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;
  let router: Router;
  let accounts: AccountService;
  let demo: DemoStateService;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    accounts = TestBed.inject(AccountService);
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
    signInAsSara();
    harness = await RouterTestingHarness.create('/');
    await settle();
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = (harness.routeNativeElement ?? document.body) as HTMLElement;
  }

  const text = (node: Element | null | undefined) => node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!;
  const body = (selector: string) => Array.from(document.body.querySelectorAll<HTMLElement>(selector));
  const items = () => body('[hlmDropdownMenuItem]');
  const item = (label: string) => items().find((i) => text(i).includes(label))!;
  const roleOf = (name: string) => text(item(name).querySelector('[data-testid="business-role"]'));
  const pickLanguage = (label: string) =>
    Array.from(el.querySelectorAll<HTMLElement>('[data-testid="lang-switcher"] button'))
      .find((b) => text(b) === label)!
      .click();

  async function openPersonMenu(): Promise<void> {
    q('person-menu').click();
    await settle();
  }

  async function openSwitcher(): Promise<void> {
    q('business-switcher').click();
    await settle();
  }

  /** Signs a person in who has made an account and a business of their own, as sign-up does. */
  function signInAsMia(): void {
    accounts.signOut();
    const id = accounts.createPerson({ firstName: 'Mia', lastName: 'Becker', email: 'mia@example.com', lang: 'en' });
    demo.createBusiness(
      { personId: id, name: 'Mia Becker', email: 'mia@example.com' },
      { name: 'Studio Becker', kind: 'freelance', legalForm: 'sole' },
    );
    accounts.signIn(id, false);
  }

  describe('the person menu', () => {
    it('is the last thing in the top bar, with the initials and a name for screen readers', () => {
      const button = q('person-menu');
      expect(text(button)).toBe('SW');
      expect(button.getAttribute('aria-label')).toBe('Account: Sara Weber');
      const follows = q('lang-switcher').compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING;
      expect(follows).toBeTruthy();
      expect(el.querySelector('header')!.contains(button)).toBe(true);
    });

    it('opens with the name and email, My account and Sign out', async () => {
      await openPersonMenu();
      const menu = document.body.querySelector<HTMLElement>('[data-testid="person-menu-panel"]')!;
      expect(text(menu.querySelector('[data-testid="person-menu-name"]'))).toBe('Sara Weber');
      expect(text(menu.querySelector('[data-testid="person-menu-email"]'))).toBe('sara@example.com');
      expect(menu.querySelector('[data-testid="person-menu-email"] bdi')!.getAttribute('dir')).toBe('ltr');
      expect(items().map(text)).toEqual(['My account', 'Sign out']);
      expect(item('My account').getAttribute('href')).toBe('/account');
    });

    it('follows the person who is signed in', async () => {
      signInAsMia();
      await settle();
      expect(text(q('person-menu'))).toBe('MB');
      expect(q('person-menu').getAttribute('aria-label')).toBe('Account: Mia Becker');
      await openPersonMenu();
      expect(text(document.body.querySelector('[data-testid="person-menu-name"]'))).toBe('Mia Becker');
      expect(text(document.body.querySelector('[data-testid="person-menu-email"]'))).toBe('mia@example.com');
    });

    it('Sign out opens the sign-in page with the signed-out note, and the shell stays closed', async () => {
      await openPersonMenu();
      item('Sign out').click();
      await settle();
      expect(accounts.signedIn()).toBe(false);
      expect(router.url).toBe('/sign-in?signedOut=1');
      expect(text(q('signed-out-note'))).toBe("You're signed out.");
      expect(document.querySelector('app-shell')).toBeNull();
      expect(localStorage.getItem('mockup.session')).toBeNull();

      // The pages of the app ask for signing in again.
      await harness.navigateByUrl('/payments');
      await settle();
      expect(router.url).toBe('/sign-in?next=%2Fpayments');
      expect(document.querySelector('app-shell')).toBeNull();
    });
  });

  describe('the business switcher', () => {
    it('shows Owner for Weber Design and Full access for Café Linde', async () => {
      await openSwitcher();
      expect(roleOf('Weber Design')).toBe('Owner');
      expect(roleOf('Sara Weber Yoga')).toBe('Owner');
      expect(roleOf('Café Linde GbR')).toBe('Full access');
    });

    it('shows a business of a new account with its owner role', async () => {
      signInAsMia();
      await settle();
      await openSwitcher();
      expect(items()).toHaveLength(2);
      expect(roleOf('Studio Becker')).toBe('Owner');
      expect(text(items()[1])).toBe('Add a business');
    });

    it('the role words follow the language', async () => {
      pickLanguage('DE');
      await settle();
      await openSwitcher();
      expect(roleOf('Café Linde GbR')).toBe('Voller Zugriff');
      expect(roleOf('Weber Design')).toBe('Inhaber:in');
    });

    it('ends with a separator and Add a business, which opens /businesses/new', async () => {
      await openSwitcher();
      const add = item('Add a business');
      expect(items().at(-1)).toBe(add);
      expect(add.previousElementSibling?.getAttribute('data-slot')).toBe('dropdown-menu-separator');
      expect(add.getAttribute('href')).toBe('/businesses/new');
      add.click();
      await settle();
      expect(router.url).toBe('/businesses/new');
      expect(text(q('add-business-title'))).toBe('Add a business');
    });

    it('still opens the business that is chosen', async () => {
      await openSwitcher();
      item('Café Linde GbR').click();
      await settle();
      expect(demo.business().id).toBe('cafe-linde');
    });
  });

  describe('the language buttons', () => {
    it("save the person's language", async () => {
      expect(accounts.person().lang).toBeNull();
      pickLanguage('DE');
      await settle();
      expect(accounts.person().lang).toBe('de');
      expect(document.documentElement.lang).toBe('de');
      pickLanguage('عربي');
      await settle();
      expect(accounts.person().lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
    });

    it('leave the language of another person alone', async () => {
      pickLanguage('DE');
      await settle();
      signInAsMia();
      await settle();
      expect(accounts.person().lang).toBe('en');
      expect(accounts.persons().find((p) => p.id === 'p1')!.lang).toBe('de');
    });
  });

  describe('Reset demo', () => {
    it("signs out, and the sign-in page has Sara's email", async () => {
      accounts.signIn('p1', true);
      expect(accounts.isTrusted('p1')).toBe(true);
      q('demo-reset').click();
      await settle();
      expect(accounts.signedIn()).toBe(false);
      expect(accounts.isTrusted('p1')).toBe(false);
      expect(localStorage.getItem('mockup.session')).toBeNull();
      expect(router.url).toBe('/sign-in');
      expect(document.querySelector('app-shell')).toBeNull();
      expect((q('email') as HTMLInputElement).value).toBe('sara@example.com');
    });

    it('drops an account and a business made during the visit', async () => {
      signInAsMia();
      await settle();
      q('demo-reset').click();
      await settle();
      expect(accounts.persons().map((p) => p.id)).toEqual(['p1']);
      expect(demo.businesses.map((b) => b.id)).toEqual(['weber-design', 'sara-yoga', 'cafe-linde']);
    });

    it("brings back Sara's dismissed notices, also when another person presses it", async () => {
      const notices = TestBed.inject(NoticeService);
      notices.dismiss('bank-expiry-wd-qonto');
      expect(notices.unreadCount()).toBe(3);
      signInAsMia();
      await settle();
      q('demo-reset').click();
      await settle();
      accounts.signIn('p1', false);
      expect(notices.unreadCount()).toBe(4);
    });
  });
});

describe('AppShell and the tax reminder after Reset demo', () => {
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes)],
    });
    signInAsSara();
    harness = await RouterTestingHarness.create('/');
    await settle();
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
    el = (harness.routeNativeElement ?? document.body) as HTMLElement;
  }

  const reminder = () => document.body.querySelector<HTMLElement>('[role="dialog"] [data-testid="tax-reminder-list"]');
  const press = (testId: string) => document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`)!.click();

  /** The pop-up loads a moment after the shell starts, and closes after its exit animation. */
  async function expectReminder(shown: boolean): Promise<void> {
    await vi.waitFor(async () => {
      await settle();
      expect(reminder() !== null).toBe(shown);
    });
  }

  async function type(testId: string, value: string): Promise<void> {
    const field = el.querySelector<HTMLInputElement>(`[data-testid="${testId}"]`)!;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function submit(formId: string): Promise<void> {
    el.querySelector(`[data-testid="${formId}"]`)!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await settle();
  }

  it('after Reset and signing in, the tax reminder shows again', async () => {
    await expectReminder(true);
    press('tax-reminder-got-it');
    await expectReminder(false);

    el.querySelector<HTMLElement>('[data-testid="demo-reset"]')!.click();
    await settle();
    expect(TestBed.inject(Router).url).toBe('/sign-in');
    expect(reminder()).toBeNull();

    // Signing in is what opens the app again: the pop-up comes with it.
    await type('password', 'anything at all');
    await submit('sign-in-form');
    await type('code', '123456');
    await submit('code-form');
    expect(TestBed.inject(Router).url).toBe('/');
    await expectReminder(true);
  });
});
