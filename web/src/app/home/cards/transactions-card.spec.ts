import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideTranslocoTesting } from '../../core/i18n/transloco-testing';
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

  it('shows the 5 newest transactions, linking to payments', () => {
    expect(rows()).toHaveLength(5);
    expect(rows()[0].textContent).toContain('Müller GmbH');
    expect(el.textContent).not.toContain('Rundfunk');
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

  it('counterparty cell truncates and its row still contains the amount', () => {
    // The long "Rundfunk ARD ..." payment is the 6th newest, so it is not on the card; use a long name that is.
    TestBed.inject(DemoStateService).setBusiness('sara-yoga');
    const fixture = TestBed.createComponent(TransactionsCard);
    fixture.detectChanges();
    const names = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('[data-testid="tx-counterparty"]'),
    );
    const long = names.find((n) => n.textContent?.includes('Studio Mitte, Kursgebühren Oktober'))!;
    expect(long.classList).toContain('truncate');
    expect(long.closest('[data-testid="tx-row"]')?.querySelector('[data-testid="tx-amount"]')).not.toBeNull();
  });
});
