import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { LanguageService } from '../../core/i18n/language.service';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
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

  it('shows the 5 newest transactions, linking to payments', () => {
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Müller GmbH');
    expect(el.textContent).not.toContain('Adobe');
    for (const row of rows()) expect(row.getAttribute('href')).toBe('/soon/payments');
    expect(el.querySelector('[data-testid="tx-see-all"]')?.getAttribute('href')).toBe('/soon/payments');
  });

  it('shows a status chip for each row', () => {
    const chips = rows().map((r) => r.querySelector('[data-testid="tx-status"]')?.textContent?.trim());
    expect(chips).toEqual(['Please confirm', 'Booked', 'Receipt missing', 'Unclear', 'Booked']);
  });

  it('amount is wrapped in ltr bdi', () => {
    const amounts = Array.from(el.querySelectorAll('[data-testid="tx-amount"]'));
    expect(amounts).toHaveLength(5);
    for (const amount of amounts) expect(amount.closest('bdi[dir="ltr"]')).not.toBeNull();
  });

  it('signs and colours amounts', () => {
    const [income, expense] = rows().map((r) => r.querySelector<HTMLElement>('[data-testid="tx-amount"]')!);
    expect(income.textContent).toContain('+');
    expect(income.className).toContain('text-positive');
    expect(expense.textContent).toMatch(/[-−]/);
    expect(expense.className).toContain('text-negative');
  });

  it('counterparty cell truncates at its own end and its row still contains the amount', () => {
    const name = rows()
      .map((r) => r.querySelector<HTMLElement>('[data-testid="tx-counterparty"]')!)
      .find((n) => n.textContent?.includes('Rundfunk ARD'))!;
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
    function renderTable(lang: 'en' | 'de' | 'ar' = 'en'): HTMLElement {
      TestBed.resetTestingModule();
      localStorage.clear();
      TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
      TestBed.inject(LanguageService).setLang(lang);
      const fixture = TestBed.createComponent(TransactionsCard);
      fixture.detectChanges();
      return fixture.nativeElement as HTMLElement;
    }

    const tableRows = (root: HTMLElement) =>
      Array.from(root.querySelectorAll<HTMLElement>('[data-testid="tx-table-row"]'));
    const rowFor = (root: HTMLElement, name: string) => tableRows(root).find((r) => r.textContent?.includes(name))!;
    const bookingOf = (root: HTMLElement, name: string) =>
      rowFor(root, name).querySelector('[data-testid="tx-table-booking"]')!.textContent!.replace(/\s+/g, ' ').trim();

    afterEach(() => TestBed.inject(LanguageService).setLang('en'));

    it('has the same 5 newest payments as the list', () => {
      const root = renderTable();
      expect(tableRows(root)).toHaveLength(5);
      expect(tableRows(root)[0].textContent).toContain('Müller GmbH');
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
      expect(bookingOf(renderTable('en'), 'Amazon')).toBe('—');
    });

    it('counterparty truncates and has dir="auto"; amounts are in ltr bdi', () => {
      const root = renderTable();
      const names = Array.from(root.querySelectorAll('[data-testid="tx-table-counterparty"]'));
      expect(names).toHaveLength(5);
      for (const name of names) {
        expect(name.classList).toContain('truncate');
        expect(name.getAttribute('dir')).toBe('auto');
        expect(name.getAttribute('href')).toBe('/soon/payments');
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
  });
});
