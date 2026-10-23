import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { ownerOf } from '../domain/people';
import { AccountService } from '../state/account.service';
import { signInAsSara } from '../state/account.testing';
import { DemoStateService } from '../state/demo-state.service';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';

describe('AddBusinessPage', () => {
  let accounts: AccountService;
  let demo: DemoStateService;
  let router: Router;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    accounts = TestBed.inject(AccountService);
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
    signInAsSara();
    harness = await RouterTestingHarness.create('/businesses/new');
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
    el = harness.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const body = (selector: string) =>
    Array.from(document.body.querySelectorAll<HTMLElement>(selector));

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function choose(testId: string): Promise<void> {
    q(testId)!.querySelector<HTMLInputElement>('input')!.click();
    await settle();
  }

  async function submit(): Promise<void> {
    q('add-business-form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
  }

  /** Answers every question and ticks the terms. */
  async function fillIn(name = 'Studio Becker'): Promise<void> {
    await type('business-name', name);
    await choose('kind-trade');
    await choose('form-gbr');
    await choose('terms-accept');
  }

  it('shows the price for this business, the business questions and the terms inside the app shell', () => {
    expect(el.querySelector('app-top-bar')).not.toBeNull();
    expect(text(q('add-business-title'))).toBe('Add a business');
    expect(text(q('price-title'))).toBe('One price, everything included');
    expect(text(q('price-amount'))).toBe('€ — a month');
    expect(text(q('price-trial'))).toBe('First 30 days free, no card needed');
    expect(text(q('price-per-business'))).toBe('Each business has its own plan');
    expect(q('business-name')).not.toBeNull();
    expect(text(q('no-gmbh'))).toBe("A GmbH can't sign up yet.");
    expect(q('terms-accept')).not.toBeNull();
    expect(text(q('add-business-submit'))).toBe('Add the business');
    // Nobody is asked for a name or an email again: the person is signed in.
    expect(q('first-name')).toBeNull();
    expect(q('email')).toBeNull();
  });

  it('Add a business opens the new business as a new client, owned by Sara, and the switcher lists it', async () => {
    const before = demo.businesses.map((b) => b.id);
    await fillIn();
    await submit();

    expect(router.url).toBe('/');
    expect(demo.businesses).toHaveLength(before.length + 1);
    const added = demo.business();
    expect(before).not.toContain(added.id);
    expect(added.name).toBe('Studio Becker');
    expect(ownerOf(added)).toMatchObject({
      personId: 'p1',
      name: 'Sara Weber',
      email: 'sara@example.com',
    });
    expect(demo.myRole()).toBe('owner');
    expect(added.taxProfile.businessKind).toBe('trade');
    expect(added.legalForm).toBe('gbr');

    // It opens as a new client: the checklist with its three steps open.
    expect(demo.setup()).toEqual({ bank: false, tax: false, receipt: false });
    expect(q('setup-checklist')).not.toBeNull();
    expect(q('step-bank')!.getAttribute('data-done')).toBe('false');

    // The top bar shows it as the open business, and the switcher lists it with the others.
    expect(text(q('business-switcher'))).toContain('Studio Becker');
    q('business-switcher')!.click();
    await settle();
    const names = body('[hlmDropdownMenuItem]').map((item) => text(item));
    expect(names).toContain('Studio Becker Owner');
    expect(names).toContain('Weber Design Owner');
    expect(names).toContain('Café Linde GbR Full access');
  });

  it('keeps the other businesses and Sara as they were', async () => {
    const sara = accounts.person();
    await fillIn();
    await submit();
    expect(accounts.person()).toBe(sara);
    expect(accounts.persons()).toHaveLength(1);
    // The business Sara had open before is still hers, one step away in the switcher.
    demo.setBusiness('weber-design');
    expect(demo.business().name).toBe('Weber Design');
  });

  it('asks for every answer and the terms, and makes nothing until they are there', async () => {
    const count = demo.businesses.length;
    await submit();
    expect(router.url).toBe('/businesses/new');
    expect(text(q('error-business-name'))).toBe('Type the name of your business.');
    expect(text(q('error-kind'))).toBe('Choose the kind of work.');
    expect(text(q('error-legal-form'))).toBe('Choose one: just you, or with partners.');
    expect(text(q('terms-error'))).toBe('Tick the box to continue.');
    expect(demo.businesses).toHaveLength(count);

    // The answers alone are not enough.
    await type('business-name', 'Studio Becker');
    await choose('kind-freelance');
    await choose('form-sole');
    await submit();
    expect(demo.businesses).toHaveLength(count);
    expect(q('error-business-name')).toBeNull();
    expect(q('terms-error')).not.toBeNull();

    await choose('terms-accept');
    expect(q('terms-error')).toBeNull();
    await submit();
    expect(demo.businesses).toHaveLength(count + 1);
  });

  it('makes one business however many times Add the business is pressed', async () => {
    const count = demo.businesses.length;
    await fillIn();
    const form = q('add-business-form')!;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await settle();
    expect(demo.businesses).toHaveLength(count + 1);
  });

  it('has a way back to the homepage that adds nothing', async () => {
    expect(q('back-link')!.getAttribute('href')).toBe('/');
    expect(text(q('back-link'))).toBe('Back to the homepage');
  });

  it('the terms link opens the not-written-yet notice here too', async () => {
    q('terms-link')!.click();
    await vi.waitFor(async () => {
      await settle();
      expect(document.body.querySelector('[role="dialog"]')).not.toBeNull();
    });
    expect(text(document.body.querySelector('[data-testid="legal-notice-title"]'))).toBe(
      "The legal texts aren't written yet",
    );
  });
});
