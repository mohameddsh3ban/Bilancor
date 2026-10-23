import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { provideTranslocoTesting } from './core/i18n/transloco-testing';
import { signInAsSara } from './state/account.testing';
import { provideNoTaxReminder } from './state/tax-reminder.testing';

describe('the routes', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const nextOf = () => router.parseUrl(router.url).queryParams['next'];

  it('the app shell and every other page are lazy routes, so none of them is in the first load', () => {
    for (const route of routes) {
      expect(route.component, `/${route.path}`).toBeUndefined();
      expect(route.loadComponent, `/${route.path}`).toBeDefined();
    }
  });

  it('a signed-out visit to /payments goes to /sign-in with next', async () => {
    const harness = await RouterTestingHarness.create('/payments');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fpayments');
    expect(nextOf()).toBe('/payments');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('[data-testid="sign-in-form"]')).not.toBeNull();
    expect(document.querySelector('app-shell')).toBeNull();
  });

  it('the print pages need signing in too', async () => {
    const harness = await RouterTestingHarness.create('/sign-in');
    const pages = [
      '/print/payment/wd-t3',
      '/print/month',
      '/print/vat-return/2026-09-01',
      '/print/invoice/wd-i1',
    ];
    for (const url of pages) {
      await harness.navigateByUrl(url);
      expect(router.url, url).toBe(`/sign-in?next=${encodeURIComponent(url)}`);
    }
  });

  it('signed in, /sign-in goes to the homepage', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/sign-in');
    harness.detectChanges();
    expect(router.url).toBe('/');
  });

  it('signed in, /forgot-password goes to the homepage too', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/forgot-password');
    harness.detectChanges();
    expect(router.url).toBe('/');
  });

  it('signed out, /sign-up opens the sign-up page outside the app shell', async () => {
    const harness = await RouterTestingHarness.create('/sign-up');
    harness.detectChanges();
    expect(router.url).toBe('/sign-up');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('[data-testid="sign-up-form"]')).not.toBeNull();
    expect(document.querySelector('app-shell')).toBeNull();
  });

  it('signed in, /sign-up goes to the homepage too', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/sign-up');
    harness.detectChanges();
    expect(router.url).toBe('/');
  });

  it('Add a business is inside the app shell: signed out it asks for signing in first', async () => {
    const harness = await RouterTestingHarness.create('/businesses/new');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fbusinesses%2Fnew');
    expect(nextOf()).toBe('/businesses/new');

    signInAsSara();
    await harness.navigateByUrl('/businesses/new');
    harness.detectChanges();
    expect(router.url).toBe('/businesses/new');
    const page = harness.routeNativeElement as HTMLElement;
    expect(page.querySelector('app-top-bar')).not.toBeNull();
    expect(page.querySelector('app-add-business-page')).not.toBeNull();
  });

  it('signed in, the pages of the app open', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/payments');
    harness.detectChanges();
    expect(router.url).toBe('/payments');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
  });
});
