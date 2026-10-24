import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { BANKS, FOUND_ACCOUNTS } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { NewOwner } from '../data/new-business-sample';
import { BUSINESSES } from '../data/sample-data';
import { PERSON } from '../data/sample-person';
import { bankInitials, maskIban } from '../domain/bank-connection';
import { HomePage } from '../home/home.page';
import { PaymentDetailPage } from '../payments/payment-detail.page';
import { PaymentsPage } from '../payments/payments.page';
import { StatementImportPage } from '../payments/statement-import.page';
import { ComingSoonPage } from '../shell/coming-soon.page';
import { DemoStateService } from '../state/demo-state.service';
import { ConnectBankPage, FETCH_MS } from './connect-bank.page';

@Component({ template: '<p data-testid="settings-stub">Settings</p>' })
class SettingsStub {}

describe('ConnectBankPage', () => {
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
          { path: 'payments/import', component: StatementImportPage },
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
          { path: 'settings', component: SettingsStub },
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
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** Opens a page; the harness is made once per test, so a later call goes there from the page that is open. */
  async function render(url = '/settings/bank/connect'): Promise<void> {
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

  /** The text of a node, its pieces separated by one space (so a tile and a name, or a heading and a list, do not run together). */
  const text = (node: Element | null | undefined): string => {
    const pieces: string[] = [];
    const walk = (current: Node): void => {
      if (current.nodeType === Node.TEXT_NODE) pieces.push(current.textContent ?? '');
      else current.childNodes.forEach(walk);
    };
    if (node) walk(node);
    return pieces.join(' ').replace(/\s+/g, ' ').trim();
  };
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const step = () => q('flow')?.getAttribute('data-step');
  const title = () => text(q('step-title'));
  const input = (testId: string) => q(testId)!.querySelector<HTMLInputElement>('input')!;
  const ticked = (accountId: string) => input(`account-${accountId}`).checked;
  const rowIds = () =>
    Array.from(el.querySelectorAll('[data-testid^="account-"]')).map((row) =>
      row.getAttribute('data-testid')!.slice('account-'.length),
    );
  const accountIds = (businessId = demo.business().id) =>
    demo.businesses.find((b) => b.id === businessId)!.accounts.map((a) => a.id);
  const historyKeys = () => demo.business().history.map((line) => line.key);

  async function click(testId: string): Promise<void> {
    q(testId)!.click();
    await settle();
  }

  async function typeSearch(value: string): Promise<void> {
    const field = q('bank-search') as HTMLInputElement;
    field.value = value;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
  }

  /** Taps a bank, Continue, then Approve: the accounts screen. */
  async function toAccounts(bankId = 'qonto'): Promise<void> {
    await click(`bank-${bankId}`);
    await click('continue');
    await click('approve');
  }

  async function advance(ms: number): Promise<void> {
    await vi.advanceTimersByTimeAsync(ms);
    await settle();
  }

  describe('pick your bank', () => {
    it('has the title, the intro and a search box, and starts here', async () => {
      await render();
      expect(step()).toBe('pick');
      expect(el.querySelectorAll('h1')).toHaveLength(1);
      expect(title()).toBe('Connect your bank');
      expect(text(el)).toContain('Your payments then come in by themselves.');
      expect(q('bank-search')).not.toBeNull();
    });

    it('shows the twelve banks as initials tiles, never as pictures', async () => {
      await render();
      const tiles = Array.from(el.querySelectorAll('[data-testid^="bank-"]')).filter((node) =>
        BANKS.some((bank) => node.getAttribute('data-testid') === `bank-${bank.id}`),
      );
      expect(tiles.map((tile) => tile.getAttribute('data-testid'))).toEqual(BANKS.map((bank) => `bank-${bank.id}`));
      for (const bank of BANKS) {
        expect(text(q(`bank-${bank.id}`)), bank.id).toBe(`${bankInitials(bank.name)} ${bank.name}`);
      }
      expect(el.querySelectorAll('img, svg image, [style*="url("]')).toHaveLength(0);
    });

    it('the search keeps the banks whose name has the typed letters, whatever their case', async () => {
      await render();
      await typeSearch('BANK');
      expect(
        BANKS.filter((bank) => q(`bank-${bank.id}`) !== null).map((bank) => bank.id),
      ).toEqual(['volksbank', 'deutsche-bank', 'commerzbank', 'postbank', 'hypovereinsbank']);
      await typeSearch('  qon ');
      expect(BANKS.filter((bank) => q(`bank-${bank.id}`) !== null).map((bank) => bank.id)).toEqual(['qonto']);
      await typeSearch('');
      expect(BANKS.filter((bank) => q(`bank-${bank.id}`) !== null)).toHaveLength(BANKS.length);
    });

    it('says when no bank has that name, and still offers the other two ways', async () => {
      demo.setBusiness('sara-yoga');
      await render();
      await typeSearch('zzz');
      expect(text(q('no-banks'))).toBe('We couldn\'t find a bank called “zzz”.');
      expect(q('bank-qonto')).toBeNull();
      expect(q('not-listed')).not.toBeNull();
      expect(q('add-cash')).not.toBeNull();
    });

    it("My bank isn't listed leads to the new account for importing a statement, and back to where it was opened from", async () => {
      await render();
      expect(text(q('not-listed'))).toContain("My bank isn't listed");
      expect(text(q('not-listed'))).not.toContain('Coming soon');
      expect(q('not-listed')!.getAttribute('href')).toBe('/payments/import?new=1&from=settings');
      await click('not-listed');
      expect(router.url).toBe('/payments/import?new=1&from=settings');
      expect(text(el.querySelector('h1'))).toBe('Import a bank statement');
      await render('/settings/bank/connect?from=payments');
      expect(q('not-listed')!.getAttribute('href')).toBe('/payments/import?new=1&from=payments');
      await render('/settings/bank/connect?from=home');
      expect(q('not-listed')!.getAttribute('href')).toBe('/payments/import?new=1&from=home');
    });

    it('I also take cash shows only for a business without a cash box', async () => {
      await render(); // Weber Design has one
      expect(q('add-cash')).toBeNull();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(text(q('add-cash'))).toContain('I also take cash');
      demo.setBusiness('cafe-linde'); // has one
      await settle();
      expect(q('add-cash')).toBeNull();
    });

    it('I also take cash adds one cash box and shows it in Settings, without the bank flow and without the bank step', async () => {
      demo.setBusiness('sara-yoga');
      demo.setSetup('new');
      await render('/settings/bank/connect?from=payments');
      await click('add-cash');
      expect(accountIds().filter((id) => id.endsWith('-cash'))).toEqual(['sara-yoga-cash']);
      expect(historyKeys()).toEqual(['cashAdded']);
      expect(demo.setup().bank).toBe(false);
      expect(router.url).toBe('/settings');
      expect(q('settings-stub')).not.toBeNull();
    });

    it.each(['home', 'payments', 'settings'])(
      'I also take cash goes to Settings, replacing the flow in the history, whatever page it was opened from (%s)',
      async (from) => {
        demo.setBusiness('sara-yoga');
        await render(`/settings/bank/connect?from=${from}`);
        const navigate = vi.spyOn(router, 'navigateByUrl');
        await click('add-cash');
        expect(navigate).toHaveBeenCalledWith('/settings', { replaceUrl: true });
        expect(router.url).toBe('/settings');
      },
    );

    it('goes back to the page it was opened from, and to Settings when nothing is said', async () => {
      const links: Record<string, string> = {
        '/settings/bank/connect?from=home': '/',
        '/settings/bank/connect?from=payments': '/payments',
        '/settings/bank/connect?from=settings': '/settings',
        '/settings/bank/connect': '/settings',
        '/settings/bank/connect?from=nonsense': '/settings',
      };
      for (const [url, back] of Object.entries(links)) {
        await render(url);
        expect(q('back-link')!.getAttribute('href'), url).toBe(back);
      }
    });

    it('the back link says where it goes and turns round in Arabic', async () => {
      await render('/settings/bank/connect?from=payments');
      expect(text(q('back-link'))).toBe('Back to Payments');
      expect(q('back-link')!.querySelector('ng-icon')!.classList.contains('rtl:rotate-180')).toBe(true);
      await render('/settings/bank/connect?from=home');
      expect(text(q('back-link'))).toBe('Back to home');
    });
  });

  describe('what we can see', () => {
    it('names the bank, lists what we can and cannot do, and says when to renew', async () => {
      await render();
      await click('bank-qonto');
      expect(step()).toBe('see');
      expect(title()).toBe('Connect Qonto');
      expect(text(q('can-list'))).toBe('We can See your payments and balance Fetch new payments every day');
      expect(text(q('cannot-list'))).toBe("We can't Move money or make transfers See your bank password");
      expect(text(q('sign-in-note'))).toBe(
        "You sign in on Qonto's own page. Your bank asks you to renew this every 180 days; we remind you in time.",
      );
      expect(text(q('continue'))).toBe('Continue to Qonto');
    });

    it('Choose another bank goes back to the list', async () => {
      await render();
      await click('bank-qonto');
      await click('other-bank');
      expect(step()).toBe('pick');
      expect(q('bank-ing')).not.toBeNull();
    });

    it('moves the cursor to the new heading when the step changes, and not when the page opens', async () => {
      await render();
      expect(document.activeElement).not.toBe(q('step-title'));
      await click('bank-qonto');
      expect(document.activeElement).toBe(q('step-title'));
    });
  });

  describe('the sign-in screen', () => {
    it('is marked DEMO and shows the bank and what the app wants to read', async () => {
      await render();
      await click('bank-qonto');
      await click('continue');
      expect(step()).toBe('approve');
      expect(title()).toBe('Sign in at Qonto');
      expect(text(q('demo-label'))).toBe('DEMO · no real bank, no password');
      expect(text(q('approval-bank'))).toBe('Qonto');
      expect(text(q('bank-approval'))).toContain('Bookkeeping app wants to read your payments and balance.');
    });

    it('the sign-in screen has no input field', async () => {
      await render();
      await click('bank-qonto');
      await click('continue');
      expect(q('bank-approval')!.querySelectorAll('input, textarea, select, [type="password"]')).toHaveLength(0);
      expect(el.querySelectorAll('input, textarea, select, [contenteditable]')).toHaveLength(0);
    });

    it('Cancel goes back to the list of banks', async () => {
      await render();
      await click('bank-qonto');
      await click('continue');
      await click('cancel');
      expect(step()).toBe('pick');
      expect(demo.setup().bank).toBe(true);
      expect(accountIds()).toEqual(['wd-qonto', 'wd-cash']);
    });

    it('a bank the business uses shows no note', async () => {
      await render();
      await click('bank-qonto');
      await click('continue');
      expect(q('approval-note')).toBeNull();
    });

    it("a bank the business doesn't use shows the demo note", async () => {
      demo.setSetup('new');
      await render();
      await click('bank-commerzbank');
      expect(title()).toBe('Connect Commerzbank');
      await click('continue');
      expect(title()).toBe('Sign in at Commerzbank');
      expect(text(q('approval-bank'))).toBe('Commerzbank');
      expect(text(q('approval-note'))).toBe("Demo: this business banks with Qonto, so Qonto's accounts are shown.");
      await click('approve');
      expect(rowIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-card']);
    });

    it("Café Linde's second bank is its own, and so shows no note; a stranger shows the first one's accounts", async () => {
      demo.setBusiness('cafe-linde');
      await render();
      await click('bank-sparkasse');
      await click('continue');
      expect(q('approval-note')).toBeNull();
      await click('approve');
      expect(rowIds()).toEqual(['cl-sparkasse']);
      await click('other-bank');
      await click('bank-revolut');
      await click('continue');
      expect(text(q('approval-note'))).toBe("Demo: this business banks with Qonto, so Qonto's accounts are shown.");
      await click('approve');
      expect(rowIds()).toEqual(['cl-qonto', 'cl-savings', 'cl-card']);
    });
  });

  describe('which accounts are for the business', () => {
    it('picking Qonto and approving shows the business account ticked, the savings account and the credit card not', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      expect(step()).toBe('choose');
      expect(title()).toBe('Which accounts are for the business?');
      expect(text(q('private-hint'))).toBe('Private accounts stay out: leave them unticked.');
      expect(rowIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-card']);
      expect(ticked('wd-qonto')).toBe(true);
      expect(ticked('wd-savings')).toBe(false);
      expect(ticked('wd-card')).toBe(false);
      expect(input('account-wd-qonto').disabled).toBe(false);
      expect(text(q('account-wd-qonto'))).not.toContain('Already connected');
    });

    it('shows each account by its product, with a masked IBAN and its balance, never the full IBAN or the stored name', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      const rows = {
        'wd-qonto': ['Business account', 'DE08 … 3650', 1248020],
        'wd-savings': ['Savings', 'DE07 … 3668', 850000],
        'wd-card': ['Credit card', 'DE82 … 3676', -18940],
      } as const;
      for (const [id, [product, iban, cents]] of Object.entries(rows)) {
        const row = q(`account-${id}`)!;
        expect(text(row), id).toContain(product);
        expect(text(row), id).toContain('Qonto');
        expect(text(row), id).toContain(iban);
        expect(text(row), id).toContain(formatMoney(cents, 'en'));
        expect(row.querySelector('bdi[dir="ltr"]') !== null, id).toBe(true);
      }
      expect(text(el)).not.toMatch(/DE\d{20}/);
      expect(text(el)).not.toContain('DE08 1001');
      expect(text(el)).not.toContain('Qonto Savings');
      expect(text(el)).not.toContain('Qonto Credit card');
      for (const found of FOUND_ACCOUNTS['weber-design']['qonto']) {
        expect(text(q(`account-${found.id}`))).toContain(maskIban(found.iban!));
      }
    });

    it('an account that is connected already shows ticked, greyed and says so, and cannot be unticked', async () => {
      await render(); // Weber Design is all done: its Qonto account is connected
      await toAccounts();
      const row = q('account-wd-qonto')!;
      expect(ticked('wd-qonto')).toBe(true);
      expect(input('account-wd-qonto').disabled).toBe(true);
      expect(text(row)).toContain('Already connected');
      row.querySelector('input')!.click();
      await settle();
      expect(ticked('wd-qonto')).toBe(true);
      expect(text(q('account-wd-savings'))).not.toContain('Already connected');
      expect(input('account-wd-savings').disabled).toBe(false);
    });

    it('Connect N accounts counts only the accounts that are not connected yet', async () => {
      await render(); // Weber Design is all done: its Qonto account is connected
      await toAccounts();
      expect(text(q('connect'))).toBe('Connect accounts');
      input('account-wd-savings').click();
      await settle();
      expect(text(q('connect'))).toBe('Connect 1 account');
      input('account-wd-card').click();
      await settle();
      expect(text(q('connect'))).toBe('Connect 2 accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(false);
    });

    it('cannot connect when every ticked account is connected already, and says which to tick', async () => {
      await render();
      await toAccounts();
      expect(ticked('wd-qonto')).toBe(true);
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      expect(text(q('tick-one'))).toBe('Tick at least one account to connect.');
      expect(q('all-connected')).toBeNull();
      q('connect')!.click();
      await settle();
      expect(step()).toBe('choose');
    });

    it('says the accounts are connected already when there is nothing left to connect', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      input('account-wd-card').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      expect(rowIds().map((id) => text(q(`account-${id}`)).includes('Already connected'))).toEqual([true, true, true]);
      expect(text(q('connect'))).toBe('Connect accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      expect(text(q('all-connected'))).toBe('These accounts are connected already.');
      expect(q('tick-one')).toBeNull();
    });

    it('an account whose connection ended says so with a link to Settings, is greyed, and is not counted', async () => {
      demo.setBusiness('sara-yoga'); // its Qonto consent has ended
      await render();
      await toAccounts();
      const row = q('account-sy-qonto')!;
      expect(text(row)).toContain('Connection ended — sign in again in Settings');
      expect(text(row)).not.toContain('Already connected');
      const link = row.querySelector('a')!;
      expect(link.getAttribute('href')).toBe('/settings#bank-accounts');
      expect(row.querySelector('label')!.classList).toContain('opacity-70');
      expect(input('account-sy-qonto').disabled).toBe(true);
      expect(ticked('sy-qonto')).toBe(false);
      expect(text(q('connect'))).toBe('Connect accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      expect(text(q('tick-one'))).toBe('Tick at least one account to connect.');
      input('account-sy-savings').click();
      await settle();
      expect(text(q('connect'))).toBe('Connect 1 account');
      expect(text(q('account-sy-savings'))).not.toContain('Connection ended');
    });

    it('a connection that ended stays as it is when other accounts are connected', async () => {
      vi.useFakeTimers();
      demo.setBusiness('sara-yoga');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-sy-savings').click();
      await settle();
      const before = demo.business().accounts.find((a) => a.id === 'sy-qonto')!.connection;
      await click('connect');
      await advance(FETCH_MS);
      expect(demo.business().accounts.find((a) => a.id === 'sy-qonto')!.connection).toEqual(before);
      expect(demo.business().accounts.find((a) => a.id === 'sy-savings')!.connection.kind).toBe('connected');
    });

    it('Connect N accounts follows what is ticked, and cannot be tapped with nothing ticked', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      expect(text(q('connect'))).toBe('Connect 1 account');
      input('account-wd-savings').click();
      await settle();
      expect(text(q('connect'))).toBe('Connect 2 accounts');
      input('account-wd-card').click();
      await settle();
      expect(text(q('connect'))).toBe('Connect 3 accounts');
      for (const id of ['wd-qonto', 'wd-savings', 'wd-card']) input(`account-${id}`).click();
      await settle();
      expect(text(q('connect'))).toBe('Connect accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      expect(text(q('tick-one'))).toBe('Tick at least one account to connect.');
      q('connect')!.click();
      await settle();
      expect(step()).toBe('choose');
    });

    it('offers 1 January this year, 1 January last year and today, the first one chosen', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      expect(text(q('fetch-from'))).toContain('Fetch payments from');
      const options = ['thisYear', 'lastYear', 'today'];
      expect(options.map((id) => text(q(`fetch-${id}`)))).toEqual([
        '1 January this year 1 Jan 2026',
        '1 January last year 1 Jan 2025',
        'Today 22 Oct 2026',
      ]);
      expect(options.map((id) => input(`fetch-${id}`).checked)).toEqual([true, false, false]);
      input('fetch-lastYear').click();
      await settle();
      expect(options.map((id) => input(`fetch-${id}`).checked)).toEqual([false, true, false]);
    });

    it('does not offer a date when only accounts that are connected already are ticked', async () => {
      await render();
      await toAccounts();
      expect(q('fetch-from')).toBeNull();
      input('account-wd-savings').click();
      await settle();
      expect(q('fetch-from')).not.toBeNull();
    });

    it('a shortcut that makes an account connected while the screen is open ticks it and locks it', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      input('account-wd-qonto').click(); // the person unticked the business account
      await settle();
      expect(ticked('wd-qonto')).toBe(false);
      demo.setSetup('active'); // the demo toolbar: the account is connected already now
      await settle();
      expect(ticked('wd-qonto')).toBe(true);
      expect(input('account-wd-qonto').disabled).toBe(true);
      expect(text(q('connect'))).toBe('Connect accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
    });

    it('Choose another bank goes back to the list and forgets the ticks', async () => {
      demo.setSetup('new');
      await render();
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      await click('other-bank');
      expect(step()).toBe('pick');
      await toAccounts();
      expect(ticked('wd-savings')).toBe(false);
      expect(ticked('wd-qonto')).toBe(true);
    });
  });

  describe('connecting', () => {
    it("connecting in the new-client preset brings Weber Design's payments", async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=payments');
      await toAccounts();
      await click('connect');
      expect(step()).toBe('fetching');
      expect(title()).toBe('Fetching payments…');
      expect(q('back-link')).toBeNull();

      await advance(FETCH_MS - 1);
      expect(step()).toBe('fetching');
      expect(demo.setup().bank).toBe(false);
      expect(router.url).toContain('/settings/bank/connect');

      await advance(1);
      expect(demo.setup().bank).toBe(true);
      expect(router.url).toBe('/payments');
      expect(q('empty-new')).toBeNull();
      expect(el.querySelectorAll('[data-testid="payment-row"]').length).toBeGreaterThan(0);
      expect(accountIds()).toEqual(['wd-qonto', 'wd-cash']);
      expect(demo.business().accounts.find((a) => a.id === 'wd-qonto')!.connection).toEqual({
        kind: 'connected',
        consentUntil: '2027-04-20',
        lastFetched: `${DEMO_TODAY}T12:00`,
        fetchFrom: '2026-01-01',
        broken: false,
      });
    });

    it('goes back to the homepage when the flow was opened from there', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      await click('connect');
      await advance(FETCH_MS);
      expect(router.url).toBe('/');
      expect(q('setup-checklist')).not.toBeNull();
      expect(q('balances-card')).not.toBeNull();
    });

    it('stores the date that was chosen', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      input('fetch-today').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      const savings = demo.business().accounts.find((a) => a.id === 'wd-savings')!;
      expect(savings.connection.fetchFrom).toBe(DEMO_TODAY);
    });

    it('leaving a business account unticked makes it a statement account', async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      expect(rowIds()).toEqual(['cl-qonto', 'cl-savings', 'cl-card']);
      input('account-cl-qonto').click();
      input('account-cl-savings').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      const accounts = demo.business().accounts;
      expect(accounts.find((a) => a.id === 'cl-qonto')!.connection.kind).toBe('statement');
      expect(accounts.find((a) => a.id === 'cl-savings')!.connection.kind).toBe('connected');
      expect(accounts.find((a) => a.id === 'cl-sparkasse')!.connection.kind).toBe('statement');
      expect(historyKeys()).toEqual(['bankConnected']);
    });

    it("Café Linde's Sparkasse is a statement account, and stays one while Qonto is connected", async () => {
      vi.useFakeTimers();
      demo.setBusiness('cafe-linde');
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      await click('connect');
      await advance(FETCH_MS);
      const accounts = demo.business().accounts;
      expect(accounts.find((a) => a.id === 'cl-sparkasse')!.connection.kind).toBe('statement');
      expect(accounts.find((a) => a.id === 'cl-qonto')!.connection.kind).toBe('connected');
    });

    it('a connected savings account shows in the homepage balances and the Payments account filter', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      expect(router.url).toBe('/');
      expect(q('account-wd-savings')).not.toBeNull();
      expect(text(q('balances-total'))).toBe(formatMoney(1263020 + 850000, 'en'));
      await render('/payments');
      const options = Array.from((q('filter-account') as HTMLSelectElement).options).map((option) => option.value);
      expect(options).toContain('wd-savings');
      expect(options).not.toContain('wd-card');
    });

    it('connecting twice adds the accounts once: a double tap, and then the whole flow again', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      q('connect')!.click();
      q('connect')!.click();
      await settle();
      await advance(FETCH_MS * 3);
      expect(accountIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(historyKeys()).toEqual(['bankConnected']);

      // The whole flow once more, with the same accounts: the savings account is connected already.
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      expect(text(q('account-wd-savings'))).toContain('Already connected');
      expect(text(q('connect'))).toBe('Connect accounts');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      q('connect')!.click();
      await advance(FETCH_MS);
      expect(step()).toBe('choose');
      expect(accountIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(historyKeys()).toEqual(['bankConnected']);
    });

    it('a shortcut keeps connected accounts', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      const answers = { ...demo.business().taxProfile, vatPeriod: 'quarterly' as const };
      demo.saveTaxProfile(answers);
      demo.setSetup('new');
      demo.setSetup('active');
      expect(demo.business().taxProfile).toEqual(answers);
      expect(accountIds()).toEqual(['wd-qonto', 'wd-savings', 'wd-cash']);
      expect(demo.business().accounts.find((a) => a.id === 'wd-savings')!.connection.kind).toBe('connected');
      expect(demo.setup()).toEqual({ bank: true, tax: true, receipt: true });
    });

    it('never changes the shared found accounts or the sample businesses', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      const foundBefore = structuredClone(FOUND_ACCOUNTS);
      const samplesBefore = structuredClone(BUSINESSES.map((b) => b.accounts));
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      input('account-wd-qonto').click();
      await settle();
      await click('connect');
      await advance(FETCH_MS);
      expect(FOUND_ACCOUNTS).toEqual(foundBefore);
      expect(BUSINESSES.map((b) => b.accounts)).toEqual(samplesBefore);
      demo.resetData();
      expect(accountIds()).toEqual(['wd-qonto', 'wd-cash']);
    });
  });

  describe('when the business changes or the data is reset', () => {
    it('switching business restarts the flow', async () => {
      await render();
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      demo.setBusiness('cafe-linde');
      await settle();
      expect(step()).toBe('pick');
      expect((q('bank-search') as HTMLInputElement).value).toBe('');
      await toAccounts();
      expect(rowIds()).toEqual(['cl-qonto', 'cl-savings', 'cl-card']);
      expect(ticked('cl-savings')).toBe(false);
    });

    it('switching business while the accounts are being fetched connects nothing, to either business', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      await click('connect');
      expect(step()).toBe('fetching');

      demo.setBusiness('cafe-linde');
      await settle();
      expect(step()).toBe('pick');
      await advance(FETCH_MS * 2);

      expect(step()).toBe('pick');
      expect(router.url).toContain('/settings/bank/connect');
      expect(accountIds('weber-design')).toEqual(['wd-qonto', 'wd-cash']);
      expect(accountIds('cafe-linde')).toEqual(['cl-qonto', 'cl-sparkasse', 'cl-cash']);
      expect(demo.stepsOf('weber-design').bank).toBe(false);
      expect(demo.stepsOf('cafe-linde').bank).toBe(true);
      for (const business of demo.businesses) expect(business.history).toEqual([]);
    });

    it('switching business and back before the timer ends connects nothing either', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      await click('connect');
      demo.setBusiness('cafe-linde');
      await settle();
      demo.setBusiness('weber-design');
      await settle();
      expect(step()).toBe('pick');
      await advance(FETCH_MS * 2);
      expect(demo.stepsOf('weber-design').bank).toBe(false);
      expect(router.url).toContain('/settings/bank/connect');
    });

    it('a business switched without the page seeing it connects nothing', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      await click('connect');
      demo.setBusiness('cafe-linde');
      await vi.advanceTimersByTimeAsync(FETCH_MS * 2);
      expect(demo.stepsOf('weber-design').bank).toBe(false);
      expect(accountIds('cafe-linde')).toEqual(['cl-qonto', 'cl-sparkasse', 'cl-cash']);
    });

    it('Reset demo while the accounts are being fetched drops the result and restarts the flow', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      input('account-wd-savings').click();
      await settle();
      await click('connect');
      demo.resetData();
      await settle();
      expect(step()).toBe('pick');
      await advance(FETCH_MS * 2);
      expect(accountIds()).toEqual(['wd-qonto', 'wd-cash']);
      expect(demo.business().history).toEqual([]);
      expect(router.url).toContain('/settings/bank/connect');
    });

    it('leaving the page while the accounts are being fetched connects nothing and does not pull the person back', async () => {
      vi.useFakeTimers();
      demo.setSetup('new');
      await render('/settings/bank/connect?from=home');
      await toAccounts();
      await click('connect');
      await render('/payments');
      await advance(FETCH_MS * 2);
      expect(demo.stepsOf('weber-design').bank).toBe(false);
      expect(router.url).toBe('/payments');
    });
  });

  describe('languages', () => {
    it('is in German, with the German names for the products', async () => {
      TestBed.inject(LanguageService).setLang('de');
      demo.setSetup('new');
      await render();
      expect(title()).toBe('Verbinde deine Bank');
      await toAccounts();
      expect(title()).toBe('Welche Konten gehören zum Unternehmen?');
      expect(text(q('account-wd-qonto'))).toContain('Geschäftskonto');
      expect(text(q('account-wd-savings'))).toContain('Sparkonto');
      expect(text(q('account-wd-card'))).toContain('Kreditkarte');
      expect(text(q('connect'))).toBe('1 Konto verbinden');
    });

    it('is in Arabic, mirrored, with the IBANs and the amounts kept left to right', async () => {
      TestBed.inject(LanguageService).setLang('ar');
      demo.setSetup('new');
      await render();
      expect(document.documentElement.dir).toBe('rtl');
      expect(title()).toBe('اربط حسابك البنكي');
      expect(q('back-link')!.querySelector('ng-icon')!.classList.contains('rtl:rotate-180')).toBe(true);
      await toAccounts();
      expect(text(q('account-wd-qonto'))).toContain('حساب تجاري');
      const row = q('account-wd-savings')!;
      const direct = Array.from(row.querySelectorAll('bdi[dir="ltr"]')).map((node) => text(node));
      expect(direct).toContain('DE07 … 3668');
      expect(direct).toContain(formatMoney(850000, 'ar').replace(/\s+/g, ' '));
    });

    it.each(['de', 'ar'] as const)('shows the sign-in screen as DEMO in %s', async (lang) => {
      TestBed.inject(LanguageService).setLang(lang);
      await render();
      await click('bank-qonto');
      await click('continue');
      expect(text(q('demo-label'))).toContain('DEMO');
      expect(q('bank-approval')!.querySelectorAll('input')).toHaveLength(0);
    });
  });

  describe('a business made during the visit', () => {
    const sara: NewOwner = { personId: PERSON.id, name: 'Sara Weber', email: PERSON.email };
    let id: string;

    beforeEach(() => {
      id = demo.createBusiness(sara, { name: 'Atelier Neu', kind: 'freelance', legalForm: 'sole' });
      demo.setBusiness(id);
    });

    it('is at whatever bank is picked: no demo note, and the one business account there, ticked', async () => {
      await render();
      for (const [bankId, name] of [['commerzbank', 'Commerzbank'], ['revolut', 'Revolut'], ['qonto', 'Qonto']]) {
        await click(`bank-${bankId}`);
        await click('continue');
        expect(q('approval-note'), bankId).toBeNull();
        await click('approve');
        expect(rowIds(), bankId).toEqual([`${id}-main`]);
        expect(ticked(`${id}-main`), bankId).toBe(true);
        expect(text(q(`account-${id}-main`)), bankId).toContain(`Business account ${name} · DE89 … 3000`);
        expect(text(q('connect')), bankId).toBe('Connect 1 account');
        await click('other-bank');
        expect(step()).toBe('pick');
      }
    });

    it('connecting brings the account named after the bank and the eight October payments, then goes back', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=payments');
      await toAccounts('commerzbank');
      await click('connect');
      expect(step()).toBe('fetching');

      await advance(FETCH_MS);
      expect(router.url).toBe('/payments');
      expect(demo.setup().bank).toBe(true);
      expect(demo.business().accounts).toMatchObject([
        { id: `${id}-main`, name: 'Commerzbank', connection: { kind: 'connected', fetchFrom: '2026-01-01' } },
      ]);
      expect(demo.business().transactions.map((t) => t.id)).toEqual(
        [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `${id}-t${n}`),
      );
      expect(el.querySelectorAll('[data-testid="payment-row"]')).toHaveLength(8);
    });

    it('the whole flow once more connects nothing and adds no payment', async () => {
      vi.useFakeTimers();
      await render('/settings/bank/connect?from=home');
      await toAccounts('ing');
      await click('connect');
      await advance(FETCH_MS);
      const business = demo.business();

      await render('/settings/bank/connect?from=home');
      await toAccounts('ing');
      expect(text(q(`account-${id}-main`))).toContain('Already connected');
      expect((q('connect') as HTMLButtonElement).disabled).toBe(true);
      expect(demo.business()).toBe(business);
    });

    it('a sample business keeps showing the demo note for a bank it does not use', async () => {
      demo.setBusiness('weber-design');
      demo.setSetup('new');
      await render();
      await click('bank-commerzbank');
      await click('continue');
      expect(text(q('approval-note'))).toBe("Demo: this business banks with Qonto, so Qonto's accounts are shown.");
    });
  });
});
