import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { LanguageService } from './core/i18n/language.service';
import { provideTranslocoTesting } from './core/i18n/transloco-testing';
import { AccountService } from './state/account.service';
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
      '/print/self-issued/doc-EB-2026-001',
      '/print/export/2026-10',
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

  it('My account is inside the app shell: signed out it asks for signing in first', async () => {
    const harness = await RouterTestingHarness.create('/account');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Faccount');
    expect(nextOf()).toBe('/account');

    signInAsSara();
    await harness.navigateByUrl('/account');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect(
        (harness.routeNativeElement as HTMLElement).querySelector('app-my-account-page'),
      ).not.toBeNull();
    });
    expect(router.url).toBe('/account');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
  });

  it('Reports is inside the app shell: signed out it asks for signing in first, signed in it opens the page', async () => {
    const harness = await RouterTestingHarness.create('/reports');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Freports');

    signInAsSara();
    await harness.navigateByUrl('/reports');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-reports-page')).not.toBeNull();
    });
    expect(router.url).toBe('/reports');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
  });

  it('Help is inside the app shell: signed out it asks for signing in first, signed in it opens the page', async () => {
    const harness = await RouterTestingHarness.create('/help');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fhelp');

    signInAsSara();
    await harness.navigateByUrl('/help');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-page')).not.toBeNull();
    });
    expect(router.url).toBe('/help');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
  });

  it('German terms A–Z (help/terms) is inside the app shell, between Help and an answer, so :id never takes its address', async () => {
    const shell = routes.find((route) => route.path === '')!;
    const paths = shell.children!.map((route) => route.path);
    expect(paths.indexOf('help/terms')).toBeGreaterThan(paths.indexOf('help'));
    expect(paths.indexOf('help/terms')).toBeLessThan(paths.indexOf('help/:id'));

    const harness = await RouterTestingHarness.create('/help/terms');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fhelp%2Fterms');

    signInAsSara();
    await harness.navigateByUrl('/help/terms#kasse');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-terms-page')).not.toBeNull();
    });
    expect(router.url).toBe('/help/terms#kasse');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-answer-page')).toBeNull();
  });

  it('Write to us (help/contact) is inside the app shell, after German terms A–Z and above an answer, so :id never takes its address', async () => {
    const shell = routes.find((route) => route.path === '')!;
    const paths = shell.children!.map((route) => route.path);
    expect(paths.indexOf('help/contact')).toBeGreaterThan(paths.indexOf('help/terms'));
    expect(paths.indexOf('help/contact')).toBeLessThan(paths.indexOf('help/:id'));
    // The order Help's pages are in: Help, German terms A–Z, Write to us, then one answer.
    expect(paths.filter((path) => path?.startsWith('help'))).toEqual([
      'help',
      'help/terms',
      'help/contact',
      'help/:id',
    ]);

    const harness = await RouterTestingHarness.create('/help/contact?topic=taxes&about=vat-due');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fhelp%2Fcontact%3Ftopic%3Dtaxes%26about%3Dvat-due');

    signInAsSara();
    await harness.navigateByUrl('/help/contact?topic=taxes&about=vat-due');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-contact-page')).not.toBeNull();
    });
    expect(router.url).toBe('/help/contact?topic=taxes&about=vat-due');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-answer-page')).toBeNull();
  });

  it('An answer of Help (help/:id) is inside the app shell, right after Help, and no fixed path of Help comes below it', async () => {
    const shell = routes.find((route) => route.path === '')!;
    const paths = shell.children!.map((route) => route.path);
    const answerAt = paths.indexOf('help/:id');
    expect(answerAt).toBeGreaterThan(paths.indexOf('help'));
    expect(paths.slice(answerAt + 1).filter((path) => path?.startsWith('help'))).toEqual([]);

    const harness = await RouterTestingHarness.create('/help/vat-due');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fhelp%2Fvat-due');

    signInAsSara();
    await harness.navigateByUrl('/help/vat-due');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-answer-page')).not.toBeNull();
    });
    expect(router.url).toBe('/help/vat-due');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-help-page')).toBeNull();
  });

  it('Import a bank statement is inside the app shell, and is not a payment called "import": signed out it asks for signing in first', async () => {
    const harness = await RouterTestingHarness.create('/payments/import');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fpayments%2Fimport');

    signInAsSara();
    await harness.navigateByUrl('/payments/import');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-statement-import-page')).not.toBeNull();
    });
    expect(router.url).toBe('/payments/import');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-payment-detail-page')).toBeNull();

    // A payment still opens under Payments.
    await harness.navigateByUrl('/payments/wd-t3');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-payment-detail-page')).not.toBeNull();
    });
  });

  it('Write a self-issued receipt is inside the app shell, and is not a payment: signed out it asks for signing in first', async () => {
    const harness = await RouterTestingHarness.create('/payments/wd-t20/self-issued');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fpayments%2Fwd-t20%2Fself-issued');

    signInAsSara();
    await harness.navigateByUrl('/payments/wd-t20/self-issued');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).querySelector('app-self-issued-page')).not.toBeNull();
    });
    expect(router.url).toBe('/payments/wd-t20/self-issued');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-payment-detail-page')).toBeNull();
  });

  it('the print page of a self-issued receipt opens outside the app shell for a signed-in person', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/print/self-issued/nope');
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).tagName).toBe('APP-SELF-ISSUED-PRINT-PAGE');
    });
    expect(document.querySelector('app-shell')).toBeNull();
  });

  it('signed in, the pages of the app open', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/payments');
    harness.detectChanges();
    expect(router.url).toBe('/payments');
    expect((harness.routeNativeElement as HTMLElement).querySelector('app-top-bar')).not.toBeNull();
  });

  it('signed out while the app shell is open (the sign-in page is still loading), the next link in it goes to sign-in', async () => {
    signInAsSara();
    const harness = await RouterTestingHarness.create('/payments');
    harness.detectChanges();
    expect(router.url).toBe('/payments');
    expect(document.querySelector('app-shell')).not.toBeNull();

    // The shell route is already active, so its own guard is not asked again: its children's guard must be.
    TestBed.inject(AccountService).signOut();
    await harness.navigateByUrl('/documents');
    expect(router.url).toBe('/sign-in?next=%2Fdocuments');
    expect(nextOf()).toBe('/documents');

    // A page inside a page of the shell (a payment's details) is a child navigation as well.
    signInAsSara();
    await harness.navigateByUrl('/payments');
    TestBed.inject(AccountService).signOut();
    await harness.navigateByUrl('/payments/wd-t3');
    expect(router.url).toBe('/sign-in?next=%2Fpayments%2Fwd-t3');
  });

  it('the join page sits outside the app shell: signed out it asks for signing in first, then opens with no top bar', async () => {
    const harness = await RouterTestingHarness.create('/join/weber-design/wd-m3');
    harness.detectChanges();
    expect(router.url).toBe('/sign-in?next=%2Fjoin%2Fweber-design%2Fwd-m3');
    expect(nextOf()).toBe('/join/weber-design/wd-m3');

    signInAsSara();
    await harness.navigateByUrl('/join/weber-design/wd-m3');
    // The page itself is the route's element: there is no shell around it.
    await vi.waitFor(() => {
      harness.detectChanges();
      expect((harness.routeNativeElement as HTMLElement).tagName).toBe('APP-JOIN-PAGE');
    });
    expect(router.url).toBe('/join/weber-design/wd-m3');
    expect(document.querySelector('app-shell')).toBeNull();
    expect(document.querySelector('app-top-bar')).toBeNull();
  });
});
