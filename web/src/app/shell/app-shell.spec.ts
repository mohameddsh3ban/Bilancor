import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { NoticeService } from '../state/notice.service';
import { AppShell } from './app-shell';
import { ComingSoonPage } from './coming-soon.page';

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
            children: [{ path: 'soon/:feature', component: ComingSoonPage }],
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

  it('bell shows unread count', () => {
    expect(q('[data-testid="bell-badge"]').textContent?.trim()).toBe('3');
  });

  it('bell opens the history panel when bellOpen is set', async () => {
    expect(document.body.textContent).not.toContain('Notifications');
    TestBed.inject(NoticeService).bellOpen.set(true);
    await settle();
    expect(document.body.textContent).toContain('Notifications');
    expect(document.body.textContent).toContain('Your Qonto connection expires in 30 days');
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

  it('demo switch changes the setup state', () => {
    const demo = TestBed.inject(DemoStateService);
    const halfway = qa('[data-testid="demo-toolbar"] button').find((b) => b.textContent?.includes('Halfway'));
    halfway!.click();
    expect(demo.setup()).toBe('halfway');
  });

  it('has Upload receipt in the sidebar and the full menu', () => {
    const sidebar = q('aside');
    expect(sidebar.querySelector('a[href="/soon/upload"]')?.textContent).toContain('Upload receipt');
    const labels = Array.from(sidebar.querySelectorAll('nav a')).map((a) => a.textContent?.trim());
    expect(labels).toEqual(['Home', 'Payments', 'Documents', 'Invoices', 'Taxes', 'Reports', 'Settings', 'Help']);
  });

  it('has the bottom bar with the camera in the centre', () => {
    const slots = Array.from(q('[data-testid="bottom-bar"]').querySelectorAll<HTMLElement>('a, button'));
    expect(slots).toHaveLength(5);
    expect(slots[2].getAttribute('href')).toBe('/soon/upload');
  });

  it('more opens the remaining menu items', async () => {
    q('[data-testid="more-button"]').click();
    await settle();
    const labels = body('[hlmDropdownMenuItem]').map((i) => i.textContent?.trim());
    expect(labels).toEqual(['Documents', 'Taxes', 'Reports', 'Settings', 'Help']);
  });
});
