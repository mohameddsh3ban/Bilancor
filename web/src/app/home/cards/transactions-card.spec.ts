import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../../data/banks';
import { DemoStateService } from '../../state/demo-state.service';
import { TransactionsCard } from './transactions-card';

describe('TransactionsCard', () => {
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    const fixture = TestBed.createComponent(TransactionsCard);
    fixture.detectChanges();
    el = fixture.nativeElement as HTMLElement;
  });

  const rows = () => Array.from(el.querySelectorAll<HTMLElement>('[data-testid="tx-row"]'));

  it('shows the 5 newest transactions', () => {
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Kern Studio Berlin');
    expect(rows()[1].textContent).toContain('Müller GmbH');
    expect(el.textContent).not.toContain('Adobe');
  });

  it('homepage rows link to their payment, and See all to the payments page', () => {
    expect(rows().map((r) => r.getAttribute('href'))).toEqual([
      '/payments/wd-t19',
      '/payments/wd-t1',
      '/payments/wd-t20', // the APCOA parking, of the same day as Müller's payment
      '/payments/wd-t2',
      '/payments/wd-t3',
    ]);
    expect(el.querySelector('[data-testid="tx-see-all"]')?.getAttribute('href')).toBe('/payments');
  });

  it('shows a status chip for each row', () => {
    const chips = rows().map((r) => r.querySelector('[data-testid="tx-status"]')?.textContent?.trim());
    expect(chips).toEqual(['Receipt missing', 'Please confirm', 'Receipt missing', 'Booked', 'Receipt missing']);
  });

  it('amount is wrapped in ltr bdi', () => {
    const amounts = Array.from(el.querySelectorAll('[data-testid="tx-amount"]'));
    expect(amounts).toHaveLength(5);
    for (const amount of amounts) expect(amount.closest('bdi[dir="ltr"]')).not.toBeNull();
  });

  it('signs and colours amounts', () => {
    const [income, , expense] = rows().map((r) => r.querySelector<HTMLElement>('[data-testid="tx-amount"]')!);
    expect(income.textContent).toContain('+');
    expect(income.className).toContain('text-positive');
    expect(expense.textContent).toMatch(/[-−]/);
    expect(expense.className).toContain('text-negative');
  });

  it('counterparty cell truncates at its own end and its row still contains the amount', () => {
    // Any row does: the long name of the Rundfunk payment is no longer among the five newest.
    const name = rows()
      .map((r) => r.querySelector<HTMLElement>('[data-testid="tx-counterparty"]')!)
      .find((n) => n.textContent?.includes('Kern Studio Berlin'))!;
    expect(name.classList).toContain('truncate');
    expect(name.parentElement?.classList).toContain('min-w-0');
    const amount = name.closest('[data-testid="tx-row"]')!.querySelector('[data-testid="tx-amount"]')!;
    expect(amount.closest('bdi')?.classList).toContain('shrink-0');
  });

  it('counterparty has dir="auto" so a Latin name truncates at its end in right-to-left pages', () => {
    for (const name of Array.from(el.querySelectorAll('[data-testid="tx-counterparty"]'))) {
      expect(name.getAttribute('dir')).toBe('auto');
    }
  });

  describe('table (computer layout)', () => {
    function renderTable(
      lang: 'en' | 'de' | 'ar' = 'en',
      prepare: (demo: DemoStateService) => void = () => undefined,
    ): HTMLElement {
      TestBed.resetTestingModule();
      localStorage.clear();
      TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
      TestBed.inject(LanguageService).setLang(lang);
      prepare(TestBed.inject(DemoStateService));
      const fixture = TestBed.createComponent(TransactionsCard);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    /** A payment with no category among the five newest: the Amazon order that showed one is no longer among them, so the parking payment loses its category. */
    const withoutBooking = (demo: DemoStateService) => demo.updateTransaction('wd-t20', (t) => ({ ...t, booking: null }));

    const tableRows = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-testid="tx-table-row"]'));
    const rowFor = (root: HTMLElement, name: string) => tableRows(root).find((r) => r.textContent?.includes(name))!;
    const bookingOf = (root: HTMLElement, name: string) =>
      rowFor(root, name).querySelector('[data-testid="tx-table-booking"]')!.textContent!.replace(/\s+/g, ' ').trim();

    afterEach(() => TestBed.inject(LanguageService).setLang('en'));

    it('has the same 5 newest payments as the list', () => {
      const root = renderTable();
      expect(tableRows(root)).toHaveLength(5);
      expect(tableRows(root)[0].textContent).toContain('Kern Studio Berlin');
      expect(tableRows(root)[1].textContent).toContain('Müller GmbH');
      expect(root.querySelector('[data-testid="tx-table"]')!.textContent).not.toContain('Adobe');
    });

    it('has columns date, counterparty, account, booking, status, amount', () => {
      const heads = Array.from(renderTable().querySelectorAll('[data-testid="tx-table"] th')).map((h) =>
        h.textContent?.trim(),
      );
      expect(heads).toEqual(['Date', 'Counterparty', 'Account', 'Booking', 'Status', 'Amount']);
    });

    it('shows the account name', () => {
      expect(rowFor(renderTable(), 'Telekom').textContent).toContain('Qonto');
    });

    it('names a savings account by its bank and product, in every language', () => {
      const onSavings = (demo: DemoStateService) => {
        demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
        demo.updateTransaction('wd-t1', (t) => ({ ...t, accountId: 'wd-savings' }));
      };
      const accountCell = (root: HTMLElement, name: string) =>
        rowFor(root, name).querySelectorAll('td')[2].textContent!.replace(/\s+/g, ' ').trim();
      const en = renderTable('en', onSavings);
      expect(accountCell(en, 'Müller GmbH')).toBe('Qonto · Savings');
      expect(accountCell(en, 'Telekom')).toBe('Qonto');
      expect(accountCell(renderTable('de', onSavings), 'Müller GmbH')).toBe('Qonto · Sparkonto');
    });

    it('booking cell is label, SKR03 number and German name in English', () => {
      expect(bookingOf(renderTable('en'), 'Telekom')).toBe('Phone & internet · 4920 Telefon');
    });

    it('booking cell is only the SKR03 number and German name in German', () => {
      expect(bookingOf(renderTable('de'), 'Telekom')).toBe('4920 Telefon');
    });

    it('booking cell has the label in Arabic, with the SKR03 part left-to-right', () => {
      const root = renderTable('ar');
      const cell = rowFor(root, 'Telekom').querySelector('[data-testid="tx-table-booking"]')!;
      expect(cell.textContent).toContain('4920 Telefon');
      expect(cell.textContent).not.toContain('Phone');
      expect(cell.querySelector('bdi[dir="ltr"]')?.textContent?.trim()).toBe('4920 Telefon');
    });

    it('booking cell is a dash when there is no booking', () => {
      expect(bookingOf(renderTable('en', withoutBooking), 'APCOA Parking')).toBe('—');
    });

    it('counterparty truncates and has dir="auto"; amounts are in ltr bdi', () => {
      const root = renderTable();
      const names = Array.from(root.querySelectorAll('[data-testid="tx-table-counterparty"]'));
      expect(names).toHaveLength(5);
      for (const name of names) {
        expect(name.classList).toContain('truncate');
        expect(name.getAttribute('dir')).toBe('auto');
        expect(name.getAttribute('href')).toMatch(/^\/payments\/wd-t\d+$/);
      }
      const amounts = Array.from(root.querySelectorAll('[data-testid="tx-table-amount"]'));
      expect(amounts).toHaveLength(5);
      for (const amount of amounts) expect(amount.closest('bdi[dir="ltr"]')).not.toBeNull();
    });

    it('shows the table from lg and hides the list from lg', () => {
      const root = renderTable();
      const table = root.querySelector('[data-testid="tx-table"]')!;
      expect(table.parentElement!.classList).toContain('hidden');
      expect(table.parentElement!.classList).toContain('lg:block');
      expect(root.querySelector('[data-testid="tx-row"]')!.closest('ul')!.classList).toContain('lg:hidden');
    });

    it('gives booking real room: no fixed width on counterparty and booking, narrow fixed widths elsewhere', () => {
      const root = renderTable();
      const cols = Array.from(root.querySelectorAll('[data-testid="tx-table"] col'));
      const widths = cols.map((c) => Array.from(c.classList).filter((k) => /^w-/.test(k)));
      // date, counterparty, account, booking, status, amount
      expect(widths[1]).toEqual([]);
      expect(widths[3]).toEqual([]);
      for (const i of [0, 2, 4, 5]) expect(widths[i]).toHaveLength(1);
      for (const th of Array.from(root.querySelectorAll('[data-testid="tx-table"] th'))) {
        expect(Array.from(th.classList).some((k) => /^w-/.test(k))).toBe(false);
      }
    });

    it('booking cell truncates and has no title of its own (the stretched link covers it)', () => {
      const cell = rowFor(renderTable('en'), 'Telekom').querySelector('[data-testid="tx-table-booking"]')!;
      expect(cell.classList).toContain('truncate');
      expect(cell.hasAttribute('title')).toBe(false);
    });

    it('the counterparty link carries the full row text as its hover title', () => {
      const titleOf = (root: HTMLElement, name: string) =>
        rowFor(root, name).querySelector('[data-testid="tx-table-counterparty"]')!.getAttribute('title');
      expect(titleOf(renderTable('en'), 'Telekom')).toBe('Telekom · Phone & internet · 4920 Telefon');
      expect(titleOf(renderTable('de'), 'Telekom')).toBe('Telekom · 4920 Telefon');
      expect(titleOf(renderTable('en', withoutBooking), 'APCOA Parking')).toBe('APCOA Parking');
    });

    it('status chips never wrap', () => {
      for (const chip of Array.from(
        renderTable().querySelectorAll('[data-testid="tx-table"] [data-testid="tx-status"]'),
      )) {
        expect(chip.classList).toContain('whitespace-nowrap');
      }
    });

    it('the whole row opens its payment: row is relative and the counterparty link is stretched over it', () => {
      const root = renderTable();
      expect(tableRows(root)).toHaveLength(5);
      for (const row of tableRows(root)) {
        expect(row.classList).toContain('relative');
        const link = row.querySelector('[data-testid="tx-table-counterparty"]')!;
        expect(link.classList).toContain('after:absolute');
        expect(link.classList).toContain('after:inset-0');
        expect(link.getAttribute('href')).toMatch(/^\/payments\/wd-t\d+$/);
      }
    });
  });
});
