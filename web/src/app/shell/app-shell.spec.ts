import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { presetOf } from '../domain/home-cards';
import { DemoStateService } from '../state/demo-state.service';
import { withConnection } from '../state/demo-state.testing';
import { NoticeService } from '../state/notice.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { AppShell } from './app-shell';
import { ComingSoonPage } from './coming-soon.page';

/** Stands in for the Taxes page, which the app gets later. */
@Component({ template: '' })
class TaxesStub {}

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
    // Weber Design: the terms, its calculated bank notice and the unreadable receipts.
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('3');
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
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('2');
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

  it('reset demo brings dismissed notices back', () => {
    const notices = TestBed.inject(NoticeService);
    notices.dismiss('wd-n3');
    notices.dismiss('bank-expiry-wd-qonto');
    harness.detectChanges();
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('1');
    q('[data-testid="demo-reset"]').click();
    harness.detectChanges();
    expect(q('[data-testid="demo-reset"]').textContent).toContain('Reset demo');
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('3');
  });

  it('Reset demo restores a changed payment', () => {
    const demo = TestBed.inject(DemoStateService);
    const find = () => demo.business().transactions.find((t) => t.id === 'wd-t3')!;
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(find().receipt).toBe('notNeeded');
    q('[data-testid="demo-reset"]').click();
    harness.detectChanges();
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

    it('Got it keeps it away for the rest of the session, and Reset demo brings it back', async () => {
      await expectReminder(true);
      press('tax-reminder-got-it');
      await expectReminder(false);
      q('[data-testid="demo-reset"]').click();
      await expectReminder(true);
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
