import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from '../app.routes';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import type { AccountConnection, InvoiceProfile, TaxProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { maskIban } from '../domain/bank-connection';
import { HomePage } from '../home/home.page';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { ComingSoonPage } from '../shell/coming-soon.page';
import { DemoStateService } from '../state/demo-state.service';
import { withConnection as setConnection } from '../state/demo-state.testing';
import { signInAsSara } from '../state/account.testing';
import { provideNoTaxReminder } from '../state/tax-reminder.testing';
import { ConnectBankPage, FETCH_MS } from './connect-bank.page';
import { InvoiceDetailsPage } from './invoice-details.page';
import { SettingsPage } from './settings.page';
import { TaxDetailsPage } from './tax-details.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';

describe('SettingsPage', () => {
  let demo: DemoStateService;
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
          { path: '', pathMatch: 'full', component: HomePage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
          { path: 'settings', component: SettingsPage },
          { path: 'settings/tax', component: TaxDetailsPage },
          { path: 'settings/invoice', component: InvoiceDetailsPage },
          { path: 'settings/bank/connect', component: ConnectBankPage },
          { path: 'soon/:feature', component: ComingSoonPage },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(navigator, 'clipboard');
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Opens a page; the harness is made once per test, so a later call goes there from the page that is open. */
  async function render(url = '/settings'): Promise<void> {
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
  }

  async function settle(): Promise<void> {
    const open = harness!;
    open.detectChanges();
    await open.fixture.whenStable();
    open.detectChanges();
    el = open.routeNativeElement as HTMLElement;
  }

  const text = (node: Element | null | undefined): string =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  /** The label and the value of a row of the tax answers. */
  const label = (row: string) => text(q(row)?.querySelector('dt'));
  const value = (row: string) => text(q(row)?.querySelector('dd'));
  const rowIds = () =>
    Array.from(el.querySelectorAll('[data-testid^="bank-row-"]')).map((row) =>
      row.getAttribute('data-testid')!.slice('bank-row-'.length),
    );
  const status = (id: string) => text(q(`bank-status-${id}`));
  const action = (id: string) => q(`bank-action-${id}`);
  const historyKeys = () => demo.business().history.map((line) => line.key);
  const taxRows = () =>
    Array.from(el.querySelectorAll('[data-testid="settings-tax"] dl > div')).map((row) =>
      row.getAttribute('data-testid'),
    );

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  /** Puts the open business's account back with another connection, as the bank would report it. */
  function withConnection(accountId: string, change: Partial<AccountConnection>): void {
    setConnection(demo, accountId, change);
  }

  describe('the page', () => {
    it('has the title and four cards: Business and tax, Invoice details, Bank accounts, Documents inbox', async () => {
      await render();
      expect(text(el.querySelector('h1'))).toBe('Settings');
      const cards = Array.from(el.querySelectorAll('section[data-testid^="settings-"]'));
      expect(cards.map((card) => card.getAttribute('data-testid'))).toEqual([
        'settings-tax',
        'settings-invoice',
        'settings-banks',
        'settings-inbox',
      ]);
      expect(cards.map((card) => text(card.querySelector('h2')))).toEqual([
        'Business and tax',
        'Invoice details',
        'Bank accounts',
        'Documents inbox',
      ]);
    });

    it('gives the Bank accounts card the anchor bank-accounts, so links can open Settings at it', async () => {
      await render();
      const card = el.querySelector('#bank-accounts')!;
      expect(card).not.toBeNull();
      expect(card.getAttribute('data-testid')).toBe('settings-banks');
      expect(el.querySelectorAll('#bank-accounts')).toHaveLength(1);
    });

    it('stacks the cards in one column and uses the width of the main area', async () => {
      await render();
      const host = el.querySelector('app-settings-page') ?? el;
      expect(host.classList.contains('flex-col')).toBe(true);
      expect(Array.from(host.classList).some((name) => name.startsWith('max-w-'))).toBe(false);
    });

    it('is a lazy page inside the shell', async () => {
      const shell = routes.find((route) => route.path === '' && route.children)!;
      const route = shell.children!.find((child) => child.path === 'settings')!;
      expect(route).toBeDefined();
      expect(route.loadComponent).toBeTypeOf('function');
      expect(route.component).toBeUndefined();
      expect(await route.loadComponent!()).toBe(SettingsPage);
    });
  });

  describe('Business and tax', () => {
    it("shows Weber Design's answers in plain words, each German term next to its translation", async () => {
      await render();
      expect(taxRows()).toEqual([
        'tax-kind',
        'tax-vat',
        'tax-returns',
        'tax-basis',
        'tax-number',
        'tax-office',
        'tax-vat-id',
        'tax-year',
      ]);
      expect(label('tax-kind')).toBe('Kind of business');
      expect(value('tax-kind')).toBe('Freelance work (Freiberufler)');
      expect(label('tax-vat')).toBe('VAT');
      expect(value('tax-vat')).toBe('Yes, I charge VAT');
      expect(label('tax-returns')).toBe('VAT return (UStVA)');
      expect(value('tax-returns')).toBe('Monthly');
      expect(label('tax-basis')).toBe('VAT is due');
      expect(value('tax-basis')).toBe('When my customer pays (Ist-Versteuerung)');
      expect(label('tax-number')).toBe('Tax number (Steuernummer)');
      expect(value('tax-number')).toBe('27/123/45678');
      expect(label('tax-office')).toBe('Tax office (Finanzamt)');
      expect(value('tax-office')).toBe('Berlin Friedrichshain-Kreuzberg');
      expect(label('tax-vat-id')).toBe('VAT ID (USt-IdNr.)');
      expect(value('tax-vat-id')).toBe('Not given');
      expect(label('tax-year')).toBe('Financial year');
      expect(value('tax-year')).toBe('Calendar year');
    });

    it('every German term opens its explanation', async () => {
      await render();
      const terms = Array.from(el.querySelectorAll('[data-testid="settings-tax"] app-term'));
      expect(terms.length).toBeGreaterThanOrEqual(5);
      for (const term of terms) expect(term.querySelector('button'), text(term)).not.toBeNull();
    });

    it('a Kleinunternehmer has no VAT return, extension or due date to show', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(taxRows()).toEqual([
        'tax-kind',
        'tax-vat',
        'tax-number',
        'tax-office',
        'tax-vat-id',
        'tax-year',
      ]);
      expect(value('tax-vat')).toBe('No · Small business, no VAT (Kleinunternehmer)');
      expect(value('tax-office')).toBe('Berlin Mitte');
    });

    it('Café Linde is a trade with quarterly returns, VAT due when the invoice is sent, and the Hamburg office', async () => {
      demo.setBusiness('cafe-linde');
      await render();
      expect(value('tax-kind')).toBe('A trade (Gewerbe)');
      expect(value('tax-returns')).toBe('Quarterly');
      expect(value('tax-basis')).toBe('When I send the invoice (Soll-Versteuerung)');
      expect(value('tax-office')).toBe('Hamburg-Altona');
    });

    it('shows a permanent extension, a VAT ID and another financial year when the answers have them', async () => {
      const profile: TaxProfile = {
        ...demo.business().taxProfile,
        permanentExtension: true,
        vatId: 'DE123456789',
        fiscalYearStart: '07-01',
      };
      demo.saveTaxProfile(profile);
      await render();
      expect(value('tax-returns')).toBe('Monthly · Permanent extension (Dauerfristverlängerung)');
      expect(value('tax-vat-id')).toBe('DE123456789');
      expect(value('tax-year')).toBe('Starts on 1 Jul');
    });

    it('writes the tax number and the VAT ID left to right, also in an Arabic page', async () => {
      demo.saveTaxProfile({ ...demo.business().taxProfile, vatId: 'DE123456789' });
      TestBed.inject(LanguageService).setLang('ar');
      await render();
      const number = q('tax-number')!.querySelector('dd bdi')!;
      expect(number.getAttribute('dir')).toBe('ltr');
      expect(text(number)).toBe('27/123/45678');
      const vatId = q('tax-vat-id')!.querySelector('dd bdi')!;
      expect(vatId.getAttribute('dir')).toBe('ltr');
      expect(text(vatId)).toBe('DE123456789');
    });

    it('a tax number the table has no office for shows without one', async () => {
      demo.saveTaxProfile({ ...demo.business().taxProfile, taxNumber: '99/999/99999' });
      await render();
      expect(value('tax-number')).toBe('99/999/99999');
      expect(q('tax-office')).toBeNull();
    });

    it('a business that gave no tax number shows that it is not given', async () => {
      demo.saveTaxProfile({ ...demo.business().taxProfile, taxState: null, taxNumber: null });
      await render();
      expect(value('tax-number')).toBe('Not given');
      expect(q('tax-office')).toBeNull();
    });

    it('before the tax step is done it says so and offers Add your tax details, with no answers and no Edit', async () => {
      demo.setSetup('new');
      await render();
      expect(text(q('tax-empty'))).toBe(
        "You haven't added your tax details yet. They help us book and file the right way.",
      );
      expect(text(q('tax-add'))).toBe('Add your tax details');
      expect(q('tax-add')!.getAttribute('href')).toBe('/settings/tax?from=settings');
      expect(q('tax-edit')).toBeNull();
      expect(taxRows()).toEqual([]);
      expect(text(q('settings-tax'))).not.toContain('Freiberufler');
    });

    it('Edit opens the tax page and Save comes back to Settings', async () => {
      await render();
      expect(text(q('tax-edit'))).toBe('Edit');
      expect(q('tax-edit')!.getAttribute('href')).toBe('/settings/tax?from=settings');
      expect(q('tax-add')).toBeNull();
      await click('tax-edit');
      expect(router.url).toBe('/settings/tax?from=settings');
      expect(text(el.querySelector('h1'))).toBe('Your tax details');
      await click('save');
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
      expect(historyKeys()).toEqual([]);
    });

    it('a changed answer shows on the page it comes back to', async () => {
      await render();
      await click('tax-edit');
      el.querySelector<HTMLInputElement>('[data-testid="vat-no"] input')!.click();
      await settle();
      await click('save');
      expect(router.url).toBe('/settings');
      expect(value('tax-vat')).toBe('No · Small business, no VAT (Kleinunternehmer)');
      expect(q('tax-returns')).toBeNull();
      expect(historyKeys()).toEqual(['taxChanged']);
    });

    it('Add your tax details opens the same page, and Save then shows the answers here', async () => {
      demo.setSetup('new');
      await render();
      await click('tax-add');
      expect(router.url).toBe('/settings/tax?from=settings');
      const choose = async (testId: string) => {
        el.querySelector<HTMLInputElement>(`[data-testid="${testId}"] input`)!.click();
        await settle();
      };
      await choose('kind-trade');
      await choose('vat-yes');
      await choose('period-quarterly');
      await choose('basis-soll');
      const state = q('state') as HTMLSelectElement;
      state.value = 'berlin';
      state.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      const number = q('number') as HTMLInputElement;
      number.value = '21/123/45678';
      number.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
      await click('save');
      expect(router.url).toBe('/settings');
      expect(demo.setup().tax).toBe(true);
      expect(q('tax-add')).toBeNull();
      expect(value('tax-kind')).toBe('A trade (Gewerbe)');
      expect(value('tax-returns')).toBe('Quarterly');
      expect(value('tax-office')).toBe('Berlin Mitte');
    });

    it('the tax page goes back to Settings by its back link', async () => {
      await render('/settings/tax?from=settings');
      expect(q('back-link')!.getAttribute('href')).toBe('/settings');
      await click('back-link');
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
    });

    it('follows the open business', async () => {
      await render();
      expect(value('tax-kind')).toBe('Freelance work (Freiberufler)');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(value('tax-kind')).toBe('A trade (Gewerbe)');
    });
  });

  describe('Invoice details', () => {
    const invoiceRows = () =>
      Array.from(el.querySelectorAll('[data-testid="settings-invoice"] dl > div')).map((row) =>
        row.getAttribute('data-testid'),
      );
    const lines = () =>
      Array.from(q('invoice-address')!.querySelectorAll('dd bdi')).map((line) => text(line));
    const saveProfile = (change: Partial<InvoiceProfile>) =>
      demo.saveInvoiceProfile({ ...demo.business().invoiceProfile, ...change });

    it('settings shows the invoice details card with the next number', async () => {
      await render();
      expect(invoiceRows()).toEqual([
        'invoice-address',
        'invoice-iban',
        'invoice-numbers',
        'invoice-term',
        'invoice-language',
      ]);
      expect(text(q('settings-invoice')!.querySelector('h2'))).toBe('Invoice details');
      expect(label('invoice-address')).toBe('Name and address');
      expect(lines()).toEqual(['Weber Design', 'Lindenstr. 5', '10969 Berlin']);
      expect(label('invoice-iban')).toBe('Bank account (IBAN)');
      expect(value('invoice-iban')).toBe('DE08 1001 0101 0482 9136 50');
      expect(label('invoice-numbers')).toBe('Invoice numbers');
      expect(text(q('invoice-pattern'))).toBe('RE-{YYYY}-{NNN}');
      expect(text(q('invoice-next'))).toBe('Next number: RE-2026-045');
      expect(label('invoice-term')).toBe('Payment term');
      expect(value('invoice-term')).toBe('14 days');
      expect(label('invoice-language')).toBe('Invoice language');
      expect(value('invoice-language')).toBe('German');
    });

    it('sits right after the tax details', async () => {
      await render();
      const tax = q('settings-tax')!;
      expect(tax.closest('app-tax-answers')!.nextElementSibling).toBe(
        q('settings-invoice')!.closest('app-invoice-details'),
      );
    });

    it('shows the next number of each business, from its own numbers so far', async () => {
      for (const [businessId, next] of [
        ['weber-design', 'RE-2026-045'],
        ['cafe-linde', 'RE-2026-054'],
        ['sara-yoga', 'RE-2026-022'],
      ]) {
        demo.setBusiness(businessId);
        await render();
        expect(text(q('invoice-next')), businessId).toBe(`Next number: ${next}`);
      }
    });

    it('follows the open business', async () => {
      await render();
      demo.setBusiness('cafe-linde');
      await settle();
      expect(lines()).toEqual(['Café Linde GbR', 'Lindenallee 4', '20259 Hamburg']);
      expect(value('invoice-iban')).toBe('DE44 1001 0101 0637 1852 94');
    });

    it('writes the IBAN, the pattern and the next number left to right, also in an Arabic page', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(q('settings-invoice')!.querySelector('h2'))).toBe(ar.settings.invoice.title);
      const iban = q('invoice-iban')!.querySelector('dd bdi')!;
      expect(iban.getAttribute('dir')).toBe('ltr');
      expect(text(iban)).toBe('DE08 1001 0101 0482 9136 50');
      expect(q('invoice-pattern')!.getAttribute('dir')).toBe('ltr');
      expect(q('invoice-next')!.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('speaks German', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render();
      expect(text(q('settings-invoice')!.querySelector('h2'))).toBe(de.settings.invoice.title);
      expect(value('invoice-term')).toBe(de.invoiceDetails.term.d14);
      expect(value('invoice-language')).toBe(de.invoiceDetails.language.de);
      expect(text(q('invoice-next'))).toBe(`${de.invoiceDetails.pattern.next} RE-2026-045`);
    });

    it('says what is not given: no IBAN, no address', async () => {
      saveProfile({ iban: null, name: '', street: '', postcode: '', city: '' });
      await render();
      expect(value('invoice-iban')).toBe('Not given');
      expect(value('invoice-address')).toBe('Not given');
      expect(lines()).toEqual([]);
    });

    it('shows only what is given of the address', async () => {
      saveProfile({ name: 'Weber Design', street: '', postcode: '10969', city: '' });
      await render();
      expect(lines()).toEqual(['Weber Design', '10969']);
    });

    it('says a term of its own in general words', async () => {
      saveProfile({ paymentTermDays: 21 });
      await render();
      expect(value('invoice-term')).toBe('21 days');
    });

    it('Edit opens the invoice details page and Save comes back to Settings', async () => {
      await render();
      expect(text(q('invoice-edit'))).toBe('Edit');
      expect(q('invoice-edit')!.getAttribute('href')).toBe('/settings/invoice?from=settings');
      expect(q('invoice-edit')!.getAttribute('aria-label')).toBe('Edit your invoice details');
      await click('invoice-edit');
      expect(router.url).toBe('/settings/invoice?from=settings');
      expect(text(el.querySelector('h1'))).toBe('Invoice details');
      await click('save');
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
    });

    it('a changed address, term and pattern show on the card it comes back to, with the next number following', async () => {
      await render('/settings/invoice?from=settings');
      const type = async (testId: string, typed: string) => {
        const input = q(testId) as HTMLInputElement;
        input.value = typed;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await settle();
      };
      await type('street', 'Kastanienallee 12');
      await type('pattern', 'R{YYYY}/{NNN}');
      el.querySelector<HTMLInputElement>('[data-testid="term-30"] input')!.click();
      await settle();
      el.querySelector<HTMLInputElement>('[data-testid="lang-en"] input')!.click();
      await settle();
      await click('save');
      expect(router.url).toBe('/settings');
      expect(lines()).toEqual(['Weber Design', 'Kastanienallee 12', '10969 Berlin']);
      expect(text(q('invoice-pattern'))).toBe('R{YYYY}/{NNN}');
      expect(text(q('invoice-next'))).toBe('Next number: R2026/001');
      expect(value('invoice-term')).toBe('30 days');
      expect(value('invoice-language')).toBe('English');
    });

    it('the invoice details page goes back to Settings by its back link', async () => {
      await render('/settings/invoice?from=settings');
      await click('back-link');
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
    });
  });

  describe('Bank accounts', () => {
    it("Weber Design's Qonto shows Renew in 5 days", async () => {
      await render();
      expect(rowIds()).toEqual(['wd-qonto', 'wd-cash']);
      const row = q('bank-row-wd-qonto')!;
      expect(text(q('bank-name-wd-qonto'))).toBe('Qonto · Business account');
      expect(text(q('bank-iban-wd-qonto'))).toBe('DE08 … 3650');
      expect(text(q('bank-fetched-wd-qonto'))).toBe('last fetched today, 06:12');
      expect(status('wd-qonto')).toBe('Renew in 5 days');
      expect(text(action('wd-qonto'))).toBe('Renew');
      expect(row.querySelector('app-bank-tile')).not.toBeNull();
    });

    it("Café Linde's Sparkasse shows Statement import", async () => {
      demo.setBusiness('cafe-linde');
      await render();
      expect(rowIds()).toEqual(['cl-qonto', 'cl-sparkasse', 'cl-cash']);
      expect(status('cl-qonto')).toBe('Connected');
      expect(action('cl-qonto')).toBeNull();
      expect(text(q('bank-fetched-cl-qonto'))).toBe('last fetched today, 06:15');

      expect(text(q('bank-name-cl-sparkasse'))).toBe('Sparkasse · Business account');
      expect(status('cl-sparkasse')).toBe('Statement import');
      expect(text(action('cl-sparkasse'))).toBe('Import statement');
      expect(action('cl-sparkasse')!.getAttribute('href')).toBe('/soon/statementImport');
      expect(text(q('bank-line-cl-sparkasse'))).toContain('Payments come from imported statements');
      expect(q('bank-fetched-cl-sparkasse')).toBeNull();
    });

    it("Sara's Qonto shows Sign in again", async () => {
      demo.setBusiness('sara-yoga');
      await render();
      expect(rowIds()).toEqual(['sy-qonto']);
      expect(status('sy-qonto')).toBe('Sign in again');
      expect(text(action('sy-qonto'))).toBe('Sign in again');
      expect(text(q('bank-fetched-sy-qonto'))).toBe('last fetched 20 Oct, 06:10');
    });

    it('a connection the bank reports as broken shows Sign in again whatever its consent says', async () => {
      withConnection('wd-qonto', { consentUntil: '2027-04-01', broken: true });
      await render();
      expect(status('wd-qonto')).toBe('Sign in again');
    });

    it('the cash box says where its payments come from, with no status button and no last fetch', async () => {
      await render();
      expect(text(q('bank-name-wd-cash'))).toBe('Cash box');
      expect(text(q('bank-line-wd-cash'))).toBe('Payments come from your receipts');
      expect(status('wd-cash')).toBe('Cash');
      expect(action('wd-cash')).toBeNull();
      expect(q('bank-iban-wd-cash')).toBeNull();
      expect(q('bank-fetched-wd-cash')).toBeNull();
      expect(q('bank-row-wd-cash')!.querySelector('app-bank-tile')).toBeNull();
    });

    it('IBANs are masked', async () => {
      for (const businessId of ['weber-design', 'sara-yoga', 'cafe-linde']) {
        demo.setBusiness(businessId);
        await render();
        expect(text(el)).not.toMatch(/DE\d{20}/);
        const banks = BUSINESSES.find((b) => b.id === businessId)!.accounts.filter(
          (a) => a.iban !== null,
        );
        for (const account of banks) {
          const iban = q(`bank-iban-${account.id}`)!;
          expect(text(iban), account.id).toBe(maskIban(account.iban!));
          expect(iban.tagName, account.id).toBe('BDI');
          expect(iban.getAttribute('dir'), account.id).toBe('ltr');
        }
      }
      expect(maskIban('DE08100101010482913650')).toBe('DE08 … 3650');
    });

    it('says the last fetch of the demo day as "today", and of another day by its date', async () => {
      await render();
      expect(text(q('bank-fetched-wd-qonto'))).toBe('last fetched today, 06:12');
      withConnection('wd-qonto', { lastFetched: '2026-10-19T23:05' });
      await settle();
      expect(text(q('bank-fetched-wd-qonto'))).toBe('last fetched 19 Oct, 23:05');
    });

    it('says days with the right word: 14 days, 1 day, today', async () => {
      await render();
      const expectations: Record<string, string> = {
        '2026-11-05': 'Renew in 14 days',
        '2026-10-24': 'Renew in 2 days',
        '2026-10-23': 'Renew in 1 day',
        '2026-10-22': 'Renew today',
      };
      for (const [consentUntil, words] of Object.entries(expectations)) {
        withConnection('wd-qonto', { consentUntil });
        await settle();
        expect(status('wd-qonto'), consentUntil).toBe(words);
        expect(text(action('wd-qonto')), consentUntil).toBe('Renew');
      }
      withConnection('wd-qonto', { consentUntil: '2026-11-06' });
      await settle();
      expect(status('wd-qonto')).toBe('Connected');
    });

    it('every status is a word, in a colour of its own: green, amber, red, grey', async () => {
      demo.setBusiness('cafe-linde');
      withConnection('cl-qonto', { consentUntil: '2026-10-25' });
      await render();
      const classes = (id: string) => q(`bank-status-${id}`)!.className;
      expect(classes('cl-qonto')).toContain('text-warning');
      expect(classes('cl-sparkasse')).toContain('text-muted-foreground');
      expect(classes('cl-cash')).toContain('text-muted-foreground');
      withConnection('cl-qonto', { consentUntil: '2027-04-20' });
      await settle();
      expect(classes('cl-qonto')).toContain('text-positive');
      withConnection('cl-qonto', { broken: true });
      await settle();
      expect(classes('cl-qonto')).toContain('text-negative');
    });

    it('a connected savings account shows with its bank and product, never the stored English name', async () => {
      demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
      await render();
      expect(rowIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-card', 'wd-cash']);
      expect(text(q('bank-name-wd-savings'))).toBe('Qonto · Savings');
      expect(text(q('bank-name-wd-card'))).toBe('Qonto · Credit card');
      expect(text(q('bank-iban-wd-savings'))).toBe('DE07 … 3668');
      expect(status('wd-savings')).toBe('Connected');
      expect(text(q('bank-fetched-wd-savings'))).toBe('last fetched today, 12:00');
      expect(text(el)).not.toContain('Qonto Savings');
      expect(text(el)).not.toContain('Qonto Credit card');
    });

    it('names the accounts by product in German and Arabic', async () => {
      demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
      const language = TestBed.inject(LanguageService);
      language.setLang('de');
      await render();
      expect(text(q('bank-name-wd-savings'))).toBe('Qonto · Sparkonto');
      expect(text(q('bank-name-wd-qonto'))).toBe('Qonto · Geschäftskonto');
      expect(text(q('bank-name-wd-cash'))).toBe('Kasse');
      language.setLang('ar');
      await settle();
      expect(text(q('bank-name-wd-savings'))).toBe(`Qonto · ${ar.settings.bank.product.savings}`);
      expect(text(q('bank-name-wd-cash'))).toBe(ar.settings.bank.product.cash);
    });

    it('+ Connect a bank opens the bank flow and comes back to Settings', async () => {
      await render();
      expect(text(q('bank-connect'))).toBe('Connect a bank');
      expect(q('bank-connect')!.getAttribute('href')).toBe('/settings/bank/connect?from=settings');
      expect(q('bank-connect-first')).toBeNull();
      await click('bank-connect');
      expect(router.url).toBe('/settings/bank/connect?from=settings');
    });

    it('lists the accounts of the open business only', async () => {
      await render();
      expect(rowIds()).toEqual(['wd-qonto', 'wd-cash']);
      demo.setBusiness('sara-yoga');
      await settle();
      expect(rowIds()).toEqual(['sy-qonto']);
    });
  });

  describe('Renew and Sign in again', () => {
    const approval = () => q('bank-approval');

    it("Renew opens the bank's sign-in in the row, marked DEMO, with no field and the cursor on it", async () => {
      await render();
      expect(approval()).toBeNull();
      await click('bank-action-wd-qonto');
      expect(q('bank-row-wd-qonto')!.contains(approval())).toBe(true);
      expect(text(q('demo-label'))).toBe('DEMO · no real bank, no password');
      expect(text(q('approval-bank'))).toBe('Qonto');
      expect(approval()!.querySelectorAll('input, textarea, select')).toHaveLength(0);
      const region = q('bank-approval-wd-qonto')!;
      expect(region.getAttribute('aria-label')).toBe('Sign in at Qonto');
      expect(document.activeElement).toBe(region);
      expect(historyKeys()).toEqual([]);
      expect(status('wd-qonto')).toBe('Renew in 5 days');
    });

    it('renewing shows Connected and the homepage notice goes', async () => {
      await render('/');
      expect(q('notice-bank-expiry-wd-qonto')).not.toBeNull();
      await render('/settings');
      await click('bank-action-wd-qonto');
      await click('approve');
      expect(approval()).toBeNull();
      expect(status('wd-qonto')).toBe('Connected');
      expect(action('wd-qonto')).toBeNull();
      expect(text(q('bank-fetched-wd-qonto'))).toBe('last fetched today, 12:00');
      expect(demo.business().accounts[0].connection).toMatchObject({
        consentUntil: '2027-04-20',
        broken: false,
      });
      await render('/');
      expect(q('notice-bank-expiry-wd-qonto')).toBeNull();
      expect(text(q('notices-card'))).not.toContain('Qonto connection');
    });

    it('moves the cursor to the new status once it is approved, or cancelled', async () => {
      await render();
      await click('bank-action-wd-qonto');
      await click('approve');
      expect(document.activeElement).toBe(q('bank-status-wd-qonto'));

      withConnection('wd-qonto', { consentUntil: '2026-10-25' });
      await settle();
      await click('bank-action-wd-qonto');
      expect(document.activeElement).toBe(q('bank-approval-wd-qonto'));
      await click('cancel');
      expect(document.activeElement).toBe(q('bank-status-wd-qonto'));
    });

    it('renewing twice writes one history line', async () => {
      await render();
      await click('bank-action-wd-qonto');
      const approve = q('approve')!;
      approve.click();
      approve.click();
      await settle();
      expect(historyKeys()).toEqual(['bankRenewed']);
      expect(demo.business().history[0].params).toEqual({ bank: 'Qonto' });

      demo.renewConnection('wd-qonto');
      await settle();
      expect(historyKeys()).toEqual(['bankRenewed']);
      expect(status('wd-qonto')).toBe('Connected');
    });

    it('Cancel closes the sign-in and changes nothing', async () => {
      await render();
      const business = demo.business();
      await click('bank-action-wd-qonto');
      await click('cancel');
      expect(approval()).toBeNull();
      expect(demo.business()).toBe(business);
      expect(status('wd-qonto')).toBe('Renew in 5 days');
      await click('bank-action-wd-qonto');
      expect(approval()).not.toBeNull();
    });

    it("Sara's Sign in again repairs her connection, and the homepage notice goes", async () => {
      demo.setBusiness('sara-yoga');
      await render('/');
      expect(q('notice-bank-ended-sy-qonto')).not.toBeNull();
      await render('/settings');
      await click('bank-action-sy-qonto');
      expect(text(q('approval-bank'))).toBe('Qonto');
      await click('approve');
      expect(status('sy-qonto')).toBe('Connected');
      expect(historyKeys()).toEqual(['bankRenewed']);
      await render('/');
      expect(q('notice-bank-ended-sy-qonto')).toBeNull();
    });

    it('a broken connection that is signed in again works again', async () => {
      withConnection('wd-qonto', { consentUntil: '2027-04-01', broken: true });
      await render();
      await click('bank-action-wd-qonto');
      await click('approve');
      expect(status('wd-qonto')).toBe('Connected');
      expect(demo.business().accounts[0].connection.broken).toBe(false);
    });

    it('only one sign-in is open at a time, each in its own row and for its own bank', async () => {
      demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
      withConnection('wd-savings', { consentUntil: '2026-10-24' });
      await render();
      await click('bank-action-wd-qonto');
      expect(q('bank-row-wd-qonto')!.contains(approval())).toBe(true);
      await click('bank-action-wd-savings');
      expect(document.querySelectorAll('[data-testid="bank-approval"]')).toHaveLength(1);
      expect(q('bank-row-wd-savings')!.contains(approval())).toBe(true);
      expect(text(q('approval-bank'))).toBe('Qonto');
      await click('approve');
      expect(status('wd-savings')).toBe('Connected');
      expect(status('wd-qonto')).toBe('Renew in 5 days');
      expect(demo.business().history[0].params).toEqual({ bank: 'Qonto' });
    });

    it('closes when another business opens, and when the demo is reset', async () => {
      await render();
      await click('bank-action-wd-qonto');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(approval()).toBeNull();
      demo.setBusiness('weber-design');
      await settle();
      expect(approval()).toBeNull();

      await click('bank-action-wd-qonto');
      demo.resetData();
      await settle();
      expect(approval()).toBeNull();
      expect(status('wd-qonto')).toBe('Renew in 5 days');
    });

    it('closes when the account no longer needs it', async () => {
      await render();
      await click('bank-action-wd-qonto');
      demo.renewConnection('wd-qonto');
      await settle();
      expect(approval()).toBeNull();
      expect(status('wd-qonto')).toBe('Connected');
    });

    it('each button says which account it is for', async () => {
      await render();
      const named = (id: string) =>
        action(id)!
          .getAttribute('aria-labelledby')!
          .split(' ')
          .map((ref) => text(el.querySelector(`[id="${ref}"]`)))
          .join(' ');
      expect(named('wd-qonto')).toBe('Renew Qonto · Business account');
    });
  });

  describe('before the bank step', () => {
    it('before the bank step Settings offers Connect your bank and still lists the cash box', async () => {
      demo.setSetup('new');
      await render();
      expect(text(q('bank-before'))).toBe(
        'Connect your bank and your accounts show up here, with their payments.',
      );
      expect(text(q('bank-connect-first'))).toBe('Connect your bank');
      expect(q('bank-connect-first')!.getAttribute('href')).toBe(
        '/settings/bank/connect?from=settings',
      );
      expect(q('bank-connect')).toBeNull();
      expect(rowIds()).toEqual(['wd-cash']);
      expect(status('wd-cash')).toBe('Cash');
      expect(text(q('settings-banks'))).not.toContain('Qonto');
    });

    it('a business with no cash box lists nothing under it', async () => {
      demo.setBusiness('sara-yoga');
      demo.setSetup('new');
      await render();
      expect(q('bank-connect-first')).not.toBeNull();
      expect(rowIds()).toEqual([]);
    });

    it('the bank step makes the accounts appear, and + Connect a bank take the place of the button', async () => {
      demo.setSetup('new');
      await render();
      demo.setSetup('active');
      await settle();
      expect(rowIds()).toEqual(['wd-qonto', 'wd-cash']);
      expect(q('bank-connect-first')).toBeNull();
      expect(q('bank-before')).toBeNull();
      expect(q('bank-connect')).not.toBeNull();
    });

    it('opens the bank flow, and the flow ends back in Settings with the accounts listed', async () => {
      demo.setSetup('new');
      await render();
      await click('bank-connect-first');
      expect(router.url).toBe('/settings/bank/connect?from=settings');
      await click('bank-qonto');
      await click('continue');
      await click('approve');
      // The fetch takes two seconds of timer, not of waiting.
      vi.useFakeTimers();
      await click('connect');
      await vi.advanceTimersByTimeAsync(FETCH_MS);
      vi.useRealTimers();
      await settle();
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
      expect(rowIds()).toEqual(['wd-qonto', 'wd-cash']);
      expect(status('wd-qonto')).toBe('Connected');
    });

    it('I also take cash adds the cash box to a business that has none, and lands in Settings', async () => {
      demo.setBusiness('sara-yoga');
      demo.setSetup('new');
      await render('/settings/bank/connect?from=settings');
      await click('add-cash');
      expect(router.url).toBe('/settings');
      expect(rowIds()).toEqual(['sara-yoga-cash']);
      expect(q('bank-connect-first')).not.toBeNull();
    });

    it("the connect flow's back link lands in Settings", async () => {
      await render('/settings/bank/connect?from=settings');
      await click('back-link');
      expect(router.url).toBe('/settings');
      expect(text(el.querySelector('h1'))).toBe('Settings');
    });
  });

  describe('Documents inbox', () => {
    it('shows the address of the open business, left to right, with Copy and what we do with it', async () => {
      await render();
      expect(text(q('settings-inbox')!.querySelector('p'))).toContain(
        'Forward receipts and invoices to',
      );
      const address = q('inbox-email')!;
      expect(text(address)).toBe('weber-design@inbox.example');
      expect(address.tagName).toBe('BDI');
      expect(address.getAttribute('dir')).toBe('ltr');
      expect(text(q('inbox-sorted'))).toBe('We work out whether each one is received or sent.');
      expect(text(q('copy-button'))).toBe('Copy');
      demo.setBusiness('cafe-linde');
      await settle();
      expect(text(q('inbox-email'))).toBe('cafe-linde@inbox.example');
    });

    it('Copy puts the address on the clipboard and says Copied', async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
      await render();
      q('copy-button')!.click();
      await new Promise((resolve) => setTimeout(resolve));
      await settle();
      expect(writeText).toHaveBeenCalledWith('weber-design@inbox.example');
      expect(text(q('copy-button'))).toBe('Copied');
    });
  });

  describe('in German and Arabic', () => {
    it('speaks German, with the terms in German once', async () => {
      TestBed.inject(LanguageService).setLang('de');
      await render();
      expect(text(el.querySelector('h1'))).toBe(de.settings.title);
      expect(text(q('settings-tax')!.querySelector('h2'))).toBe(de.settings.tax.title);
      expect(value('tax-kind')).toBe('Freiberufler');
      expect(status('wd-qonto')).toBe('Erneuern in 5 Tagen');
      expect(text(action('wd-qonto'))).toBe('Erneuern');
      expect(text(q('bank-connect'))).toBe(de.settings.bank.connect);
      expect(text(q('bank-fetched-wd-qonto'))).toBe('zuletzt abgerufen heute, 06:12');
      expect(text(q('copy-button'))).toBe('Kopieren');
    });

    it('mirrors in Arabic, keeping the IBAN, the tax number and the address left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(text(el.querySelector('h1'))).toBe(ar.settings.title);
      expect(status('wd-qonto')).toBe('التجديد خلال 5 أيام');
      for (const testId of ['bank-iban-wd-qonto', 'inbox-email']) {
        expect(q(testId)!.getAttribute('dir'), testId).toBe('ltr');
      }
      expect(q('tax-number')!.querySelector('dd bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('is the same page when the language changes with a sign-in open', async () => {
      await render();
      await click('bank-action-wd-qonto');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(q('bank-approval')).not.toBeNull();
      expect(q('bank-approval-wd-qonto')!.getAttribute('aria-label')).toBe('Bei Qonto anmelden');
    });
  });
});

describe('Settings in the app', () => {
  let harness: RouterTestingHarness;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), provideRouter(routes), provideNoTaxReminder()],
    });
    signInAsSara();
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('menu Settings opens the page with four sections', async () => {
    harness = await RouterTestingHarness.create('/');
    await harness.fixture.whenStable();
    harness.detectChanges();
    const shell = harness.routeNativeElement as HTMLElement;
    const link = shell.querySelector<HTMLAnchorElement>('app-sidebar a[href="/settings"]')!;
    expect(link).not.toBeNull();
    link.click();
    // The page is a lazy chunk: wait until it has been loaded and drawn.
    for (
      let tries = 0;
      tries < 50 && !shell.querySelector('main h1')?.textContent?.includes('Settings');
      tries++
    ) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      await harness.fixture.whenStable();
      harness.detectChanges();
    }
    expect(TestBed.inject(Router).url).toBe('/settings');
    const main = shell.querySelector('main')!;
    expect(main.querySelector('h1')?.textContent?.trim()).toBe('Settings');
    expect(
      Array.from(main.querySelectorAll('section[data-testid^="settings-"] h2')).map((h) =>
        h.textContent?.trim(),
      ),
    ).toEqual(['Business and tax', 'Invoice details', 'Bank accounts', 'Documents inbox']);
  });
});
