import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { InvoiceProfile } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { InvoiceDetailsPage } from './invoice-details.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

@Component({ template: '' })
class Stub {}

describe('InvoiceDetailsPage', () => {
  let demo: DemoStateService;
  let router: Router;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          { path: '', pathMatch: 'full', component: Stub },
          { path: 'settings', component: Stub },
          { path: 'settings/invoice', component: InvoiceDetailsPage },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function navigate(url: string): Promise<void> {
    await harness.navigateByUrl(url);
    await settle();
    el = harness.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const field = (testId: string) => q(testId) as HTMLInputElement;
  const select = (testId: string) => q(testId) as HTMLSelectElement;
  /** The radio inside an option card. */
  const box = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  const isChecked = (testId: string) => box(testId).checked;
  const questions = () =>
    Array.from(el.querySelectorAll('[data-testid^="q-"]')).map((card) =>
      card.getAttribute('data-testid'),
    );
  const profile = (): InvoiceProfile => demo.business().invoiceProfile;

  async function choose(testId: string): Promise<void> {
    box(testId).click();
    await settle();
  }

  async function type(testId: string, value: string): Promise<void> {
    field(testId).value = value;
    field(testId).dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  async function pickAccount(accountId: string): Promise<void> {
    select('iban-account').value = accountId;
    select('iban-account').dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
  }

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  const optionValues = (testId: string) =>
    Array.from(select(testId).options).map((option) => option.value);

  describe('the page', () => {
    it('has the title, the intro and the questions in order', async () => {
      await render('/settings/invoice');
      expect(text(el.querySelector('h1'))).toBe('Invoice details');
      expect(text(q('intro'))).toBe(en.invoiceDetails.intro);
      expect(questions()).toEqual([
        'q-address',
        'q-iban',
        'q-email',
        'q-numbering',
        'q-term',
        'q-language',
      ]);
      expect(text(q('save'))).toBe('Save');
    });

    it("opens with the open business's saved details", async () => {
      await render('/settings/invoice');
      expect(field('name').value).toBe('Weber Design');
      expect(field('street').value).toBe('Lindenstr. 5');
      expect(field('postcode').value).toBe('10969');
      expect(field('city').value).toBe('Berlin');
      expect(field('iban').value).toBe('DE08 1001 0101 0482 9136 50');
      expect(field('pattern').value).toBe('RE-{YYYY}-{NNN}');
      expect(isChecked('term-14')).toBe(true);
      expect(isChecked('term-7')).toBe(false);
      expect(isChecked('term-30')).toBe(false);
      expect(isChecked('lang-de')).toBe(true);
      expect(isChecked('lang-en')).toBe(false);
    });

    it('names every field, and the choices in words', async () => {
      await render('/settings/invoice');
      const labelOf = (testId: string) => text(field(testId).closest('label'));
      expect(labelOf('name')).toBe('Name of your business');
      expect(labelOf('street')).toBe('Street and number');
      expect(labelOf('postcode')).toBe('Postcode');
      expect(labelOf('city')).toBe('Town');
      expect(labelOf('iban')).toBe('IBAN');
      expect(labelOf('pattern')).toBe('Pattern');
      expect(text(q('term-7'))).toBe('7 days');
      expect(text(q('term-14'))).toBe('14 days');
      expect(text(q('term-30'))).toBe('30 days');
      expect(text(q('lang-de'))).toBe('German');
      expect(text(q('lang-en'))).toBe('English');
    });

    it('shows the sender email as plain text, left to right, with no field to change it', async () => {
      await render('/settings/invoice');
      const email = q('sender-email')!;
      expect(text(email)).toBe('weber-design@invoices.example');
      expect(email.tagName).toBe('BDI');
      expect(email.getAttribute('dir')).toBe('ltr');
      const values = Array.from(el.querySelectorAll('input')).map((input) => input.value);
      expect(values).not.toContain('weber-design@invoices.example');
      expect(q('q-email')!.querySelectorAll('input, select, textarea')).toHaveLength(0);
    });

    it('belongs to the open business: another business shows its own details, with what was typed gone', async () => {
      await render('/settings/invoice');
      await type('street', 'Typed Street 1');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(field('name').value).toBe('Café Linde GbR');
      expect(field('street').value).toBe('Lindenallee 4');
      expect(field('city').value).toBe('Hamburg');
      expect(text(q('sender-email'))).toBe('cafe-linde@invoices.example');
    });

    it('starts over when the demo is reset', async () => {
      await render('/settings/invoice');
      await type('street', 'Typed Street 1');
      demo.resetData();
      await settle();
      expect(field('street').value).toBe('Lindenstr. 5');
    });
  });

  describe('the bank account', () => {
    it("offers the business's connected accounts, with the one on the invoices chosen", async () => {
      await render('/settings/invoice');
      expect(optionValues('iban-account')).toEqual(['wd-qonto', '']);
      expect(select('iban-account').value).toBe('wd-qonto');
      expect(text(select('iban-account').options[0])).toBe('Qonto · DE08 … 3650');
      expect(text(select('iban-account').options[1])).toBe('Another account (type it below)');
    });

    it('picking an account puts its IBAN in the field', async () => {
      demo.setBusiness('cafe-linde');
      await render('/settings/invoice');
      expect(optionValues('iban-account')).toEqual(['cl-qonto', 'cl-sparkasse', '']);
      expect(select('iban-account').value).toBe('cl-qonto');
      await pickAccount('cl-sparkasse');
      expect(field('iban').value).toBe('DE23 2005 0550 0847 3192 56');
      await click('save');
      expect(profile().iban).toBe('DE23200505500847319256');
    });

    it('typing another IBAN switches the choice to "another account", and typing an account IBAN back switches it', async () => {
      await render('/settings/invoice');
      await type('iban', 'DE89 3704 0044 0532 0130 00');
      expect(select('iban-account').value).toBe('');
      await type('iban', 'de08100101010482913650');
      expect(select('iban-account').value).toBe('wd-qonto');
    });

    it('choosing "another account" empties the field and puts the cursor in it', async () => {
      await render('/settings/invoice');
      await pickAccount('');
      expect(field('iban').value).toBe('');
      expect(document.activeElement).toBe(field('iban'));
      await click('save');
      expect(profile().iban).toBeNull();
    });

    it('offers no accounts before the bank step, only the field', async () => {
      demo.setSetup('new');
      await render('/settings/invoice');
      expect(q('iban-account')).toBeNull();
      expect(field('iban').value).toBe('DE08 1001 0101 0482 9136 50');
    });

    it('stores a typed IBAN without spaces, upper-cased', async () => {
      await render('/settings/invoice');
      await type('iban', ' de89 3704 0044 0532 0130 00 ');
      await click('save');
      expect(profile().iban).toBe('DE89370400440532013000');
    });

    it('stores no IBAN when the field is empty', async () => {
      await render('/settings/invoice');
      await type('iban', '');
      await click('save');
      expect(router.url).toBe('/settings');
      expect(profile().iban).toBeNull();
    });

    it("an IBAN that is not shaped like one can't be saved: the message is next to the field, with the cursor in it", async () => {
      await render('/settings/invoice');
      const before = profile();
      await type('iban', 'DE08 1001 0101');
      await click('save');
      expect(router.url).toBe('/settings/invoice');
      expect(profile()).toBe(before);
      expect(text(q('error-iban'))).toBe(en.invoiceDetails.iban.error);
      expect(q('q-iban')!.contains(q('error-iban'))).toBe(true);
      expect(field('iban').getAttribute('aria-invalid')).toBe('true');
      expect(field('iban').getAttribute('aria-describedby')).toContain('error-iban');
      expect(document.activeElement).toBe(field('iban'));
    });

    it('the message goes when the IBAN is typed again', async () => {
      await render('/settings/invoice');
      await type('iban', 'DE08');
      await click('save');
      expect(q('error-iban')).not.toBeNull();
      await type('iban', 'DE08 1001 0101 0482 9136 50');
      expect(q('error-iban')).toBeNull();
      expect(field('iban').getAttribute('aria-invalid')).toBeNull();
    });
  });

  describe('the number pattern', () => {
    it('shows the next number as it will be, in a left-to-right block', async () => {
      await render('/settings/invoice');
      expect(text(q('next-number'))).toBe('Next number: RE-2026-045');
      const number = q('next-number')!.querySelector('bdi')!;
      expect(number.getAttribute('dir')).toBe('ltr');
      expect(text(number)).toBe('RE-2026-045');
    });

    it('follows the pattern as it is typed', async () => {
      await render('/settings/invoice');
      await type('pattern', 'R{YYYY}/{NNN}.x');
      expect(text(q('next-number'))).toBe('Next number: R2026/001.x');
      await type('pattern', 'R{NNN}');
      expect(text(q('next-number'))).toBe('Next number: R001');
    });

    it("a pattern without {NNN} can't be saved", async () => {
      await render('/settings/invoice');
      const before = profile();
      await type('pattern', 'RE-{YYYY}');
      expect(text(q('next-number'))).toBe('');
      await click('save');
      expect(router.url).toBe('/settings/invoice');
      expect(profile()).toBe(before);
      expect(text(q('error-pattern'))).toBe(en.invoiceDetails.pattern.errorNumber);
      expect(q('q-numbering')!.contains(q('error-pattern'))).toBe(true);
      expect(field('pattern').getAttribute('aria-invalid')).toBe('true');
      expect(field('pattern').getAttribute('aria-describedby')).toContain('error-pattern');
      expect(document.activeElement).toBe(field('pattern'));

      await type('pattern', 'RE-{YYYY}-{NNN}');
      expect(q('error-pattern')).toBeNull();
      await click('save');
      expect(router.url).toBe('/settings');
    });

    it("an empty pattern can't be saved either", async () => {
      await render('/settings/invoice');
      await type('pattern', '   ');
      await click('save');
      expect(router.url).toBe('/settings/invoice');
      expect(text(q('error-pattern'))).toBe(en.invoiceDetails.pattern.errorNumber);
    });

    it("something else in curly brackets can't be saved: it would be printed as it is", async () => {
      await render('/settings/invoice');
      await type('pattern', 'RE-{YY}-{NNN}');
      await click('save');
      expect(router.url).toBe('/settings/invoice');
      expect(text(q('error-pattern'))).toBe(en.invoiceDetails.pattern.errorBraces);
      expect(text(q('next-number'))).toBe('');
    });

    it('both messages can show at once, each next to its own field', async () => {
      await render('/settings/invoice');
      await type('iban', 'nope');
      await type('pattern', 'RE-2026');
      await click('save');
      expect(q('q-iban')!.contains(q('error-iban'))).toBe(true);
      expect(q('q-numbering')!.contains(q('error-pattern'))).toBe(true);
      expect(document.activeElement).toBe(field('iban'));
    });
  });

  describe('Save', () => {
    it('edit and save changes the address and term', async () => {
      await render('/settings/invoice?from=settings');
      const before = profile();
      await type('name', 'Weber Design Studio');
      await type('street', 'Kastanienallee 12');
      await type('postcode', '10435');
      await type('city', 'Berlin Prenzlauer Berg');
      await choose('term-30');
      await choose('lang-en');
      await click('save');
      expect(router.url).toBe('/settings');
      expect(profile()).toEqual({
        ...before,
        name: 'Weber Design Studio',
        street: 'Kastanienallee 12',
        postcode: '10435',
        city: 'Berlin Prenzlauer Berg',
        paymentTermDays: 30,
        language: 'en',
      });
    });

    it('saves a new pattern, and the next invoice number follows it', async () => {
      await render('/settings/invoice');
      await type('pattern', ' R{YYYY}/{NNN} ');
      await click('save');
      expect(profile().numberPattern).toBe('R{YYYY}/{NNN}');
    });

    it('keeps the sender email and changes the open business only', async () => {
      await render('/settings/invoice');
      const cafe = demo.businesses.find((b) => b.id === 'cafe-linde')!.invoiceProfile;
      await choose('term-7');
      await click('save');
      expect(profile().email).toBe('weber-design@invoices.example');
      expect(demo.businesses.find((b) => b.id === 'cafe-linde')!.invoiceProfile).toBe(cafe);
    });

    it('saves without changes as the same details', async () => {
      await render('/settings/invoice');
      const before = { ...profile() };
      await click('save');
      expect(router.url).toBe('/settings');
      expect(profile()).toEqual(before);
    });

    it('a second tap saves nothing more', async () => {
      await render('/settings/invoice');
      vi.spyOn(router, 'navigateByUrl').mockReturnValue(new Promise(() => undefined));
      const save = vi.spyOn(demo, 'saveInvoiceProfile');
      q('save')!.click();
      q('save')!.click();
      await settle();
      expect(save).toHaveBeenCalledTimes(1);
    });

    it('goes back with replaceUrl, so the browser Back button does not return to the form', async () => {
      await render('/settings/invoice?from=settings');
      const go = vi.spyOn(router, 'navigateByUrl');
      await click('save');
      expect(go).toHaveBeenCalledWith('/settings', { replaceUrl: true });
    });

    it('opened from an invoice, Save goes back to that invoice, and to the new invoice when none is named', async () => {
      await render('/settings/invoice?from=invoice&invoice=inv-weber-design-9');
      const go = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      await click('save');
      expect(go).toHaveBeenCalledWith('/invoices/inv-weber-design-9/edit', { replaceUrl: true });
      go.mockRestore();

      await navigate('/settings/invoice?from=invoice');
      const goNew = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
      await click('save');
      expect(goNew).toHaveBeenCalledWith('/invoices/new', { replaceUrl: true });
    });

    it('a refused form goes nowhere', async () => {
      await render('/settings/invoice?from=invoice&invoice=inv-1');
      const go = vi.spyOn(router, 'navigateByUrl');
      await type('pattern', 'nope');
      await click('save');
      expect(go).not.toHaveBeenCalled();
    });
  });

  describe('going back', () => {
    it('back returns to where it came from', async () => {
      await render('/settings/invoice?from=settings');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      expect(text(q('back-link'))).toBe('Back to Settings');
      expect(q('back-link')!.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');

      await navigate('/settings/invoice?from=invoice&invoice=inv-weber-design-9');
      expect(q('back-link')!.getAttribute('href')).toBe('/invoices/inv-weber-design-9/edit');
      expect(text(q('back-link'))).toBe('Back to your invoice');

      await navigate('/settings/invoice?from=invoice');
      expect(q('back-link')!.getAttribute('href')).toBe('/invoices/new');
      expect(text(q('back-link'))).toBe('Back to your invoice');
    });

    it('goes to Settings when nothing is said, or something this page cannot come from', async () => {
      await render('/settings/invoice');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      await navigate('/settings/invoice?from=home');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      await navigate('/settings/invoice?from=somewhere&invoice=inv-1');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
    });

    it('the back link leaves without saving', async () => {
      await render('/settings/invoice?from=settings');
      const before = profile();
      await type('street', 'Typed Street 1');
      await click('back-link');
      expect(router.url).toBe('/settings');
      expect(profile()).toBe(before);
    });
  });

  describe('languages', () => {
    it('speaks German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render('/settings/invoice');
      expect(text(el.querySelector('h1'))).toBe(de.invoiceDetails.title);
      expect(text(q('term-14'))).toBe(de.invoiceDetails.term.d14);
      expect(text(q('lang-en'))).toBe(de.invoiceDetails.language.en);
      expect(text(q('back-link'))).toBe(de.invoiceDetails.back.settings);
      expect(text(q('next-number'))).toBe(`${de.invoiceDetails.pattern.next} RE-2026-045`);
    });

    it('Arabic page is rtl with ltr IBAN', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render('/settings/invoice');
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe(ar.invoiceDetails.title);
      expect(q('back-link')!.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
      for (const testId of ['iban', 'pattern', 'postcode']) {
        expect(field(testId).getAttribute('dir'), testId).toBe('ltr');
      }
      expect(q('sender-email')!.getAttribute('dir')).toBe('ltr');
      expect(q('next-number')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
      expect(field('iban').value).toBe('DE08 1001 0101 0482 9136 50');
    });

    it('the text a person types keeps its own direction', async () => {
      await render('/settings/invoice');
      for (const testId of ['name', 'street', 'city']) {
        expect(field(testId).getAttribute('dir'), testId).toBe('auto');
      }
    });
  });

  describe('the route', () => {
    it('settings/invoice is a lazy page inside the shell', () => {
      const shell = routes.find((route) => route.path === '' && route.children)!;
      const route = shell.children!.find((child) => child.path === 'settings/invoice')!;
      expect(route).toBeDefined();
      expect(route.loadComponent).toBeTypeOf('function');
      expect(route.component).toBeUndefined();
    });

    it('loads the page', async () => {
      const loaded = await routes
        .find((route) => route.path === '' && route.children)!
        .children!.find((child) => child.path === 'settings/invoice')!
        .loadComponent!();
      expect(loaded).toBe(InvoiceDetailsPage);
    });
  });
});
