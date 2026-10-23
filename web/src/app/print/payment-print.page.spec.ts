import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentPrintPage } from './payment-print.page';

describe('PaymentPrintPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness | undefined;
  let el: HTMLElement;
  let print: MockInstance<() => void>;

  beforeEach(() => {
    localStorage.clear();
    harness = undefined;
    print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([{ path: 'print/payment/:id', component: PaymentPrintPage }]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    print.mockRestore();
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  async function render(url: string): Promise<void> {
    // A test may open several pages; the harness can be created only once, so it navigates after that.
    if (harness) await harness.navigateByUrl(url);
    else harness = await RouterTestingHarness.create(url);
    await settle();
    el = harness!.routeNativeElement as HTMLElement;
  }

  async function settle(): Promise<void> {
    harness!.detectChanges();
    await harness!.fixture.whenStable();
    harness!.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const historyTexts = () =>
    Array.from(el.querySelectorAll('[data-testid="history-item"]')).map((item) =>
      text(item.querySelector('[data-testid="history-text"]')),
    );

  it('payment print shows business, amount, IBAN, booking and history', async () => {
    await render('/print/payment/wd-t1');
    expect(text(q('print-business'))).toBe('Weber Design');
    expect(text(q('print-amount'))).toBe(formatMoney(150000, 'en', { signed: true }));
    expect(q('print-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(text(q('print-counterparty'))).toBe('Müller GmbH');
    expect(q('print-counterparty')!.getAttribute('dir')).toBe('auto');
    expect(text(q('print-meta'))).toBe('20 Oct 2026 · Qonto');
    expect(text(q('tx-status'))).toBe('Please confirm');
    expect(text(q('print-iban'))).toBe('DE68 2105 0170 0012 3456 78');
    expect(q('print-iban')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(text(q('print-reference'))).toBe('RE-2026-041');
    expect(q('print-reference')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    expect(text(q('print-booking'))).toBe('Revenue (19% VAT) · 8400 Erlöse 19 % USt');
    expect(text(q('print-vat'))).toBe('19%');
    expect(text(q('print-receipt'))).toBe('beleg-wd-t1.pdf');
    expect(historyTexts()).toEqual([
      'Booked as Revenue (19% VAT) automatically',
      'Imported from Qonto',
    ]);
  });

  it('shows the year on the payment date and on every history date, since a printout leaves the app', async () => {
    await render('/print/payment/wd-t3');
    expect(text(q('print-meta'))).toBe('17 Oct 2026 · Qonto');
    const dates = () =>
      Array.from(el.querySelectorAll('[data-testid="history-date"]')).map((node) => text(node));
    expect(dates()).toEqual(['17 Oct 2026', '17 Oct 2026']);
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(text(q('print-meta'))).toBe('17. Okt. 2026 · Qonto');
    expect(dates()).toEqual(['17. Okt. 2026', '17. Okt. 2026']);
  });

  it('shows the receipt state in words and a payment with no category as such', async () => {
    await render('/print/payment/wd-t3');
    expect(text(q('print-receipt'))).toBe('Receipt missing');
    expect(text(q('tx-status'))).toBe('Receipt missing');
    await render('/print/payment/wd-t4');
    expect(text(q('print-booking'))).toBe('No category yet');
    expect(text(q('print-vat'))).toBe('—');
    expect(text(q('print-receipt'))).toBe('amazon-bestellung-5561.pdf');
  });

  it('prints the edits made in the app, since the business is the one the demo state holds', async () => {
    demo.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    await render('/print/payment/wd-t3');
    expect(text(q('print-receipt'))).toBe('No receipt needed');
    expect(text(q('tx-status'))).toBe('Booked');
  });

  it('shows no VAT for a payment without VAT, and for a small business whatever the category says', async () => {
    await render('/print/payment/wd-t15');
    expect(text(q('print-vat'))).toBe('No VAT');
    demo.setBusiness('sara-yoga');
    await render('/print/payment/sy-t3');
    expect(text(q('print-booking'))).toBe('Rent · 4210 Miete (unbewegliche Wirtschaftsgüter)');
    expect(text(q('print-vat'))).toBe('No VAT');
  });

  it('names a savings account by its bank and product, in every language', async () => {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    demo.updateTransaction('wd-t1', (t) => ({ ...t, accountId: 'wd-savings' }));
    await render('/print/payment/wd-t1');
    expect(text(q('print-meta'))).toBe('20 Oct 2026 · Qonto · Savings');
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(text(q('print-meta'))).toContain('Qonto · Sparkonto');
  });

  it('names the cash box and leaves out the IBAN, but keeps the reference', async () => {
    await render('/print/payment/wd-t15');
    expect(text(q('print-meta'))).toBe('14 Aug 2026 · Cash box');
    expect(q('print-iban')).toBeNull();
    expect(text(q('print-reference'))).toBe('Einkauf bar');
    expect(historyTexts()).toEqual([
      'You marked it as private',
      'Booked as Private withdrawal automatically',
      'Imported from Cash box',
    ]);
  });

  it('follows the language and direction of the app', async () => {
    TestBed.inject(LanguageService).setLang('ar');
    await render('/print/payment/wd-t3');
    expect(document.documentElement.dir).toBe('rtl');
    expect(text(q('tx-status'))).toBe('الإيصال مفقود');
    expect(q('print-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    TestBed.inject(LanguageService).setLang('de');
    await settle();
    expect(text(q('print-vat'))).toBe('7 %'); // Travel
    expect(text(q('print-receipt'))).toBe('Beleg fehlt');
  });

  describe('back link', () => {
    it('returns to the payment and is hidden when printing', async () => {
      await render('/print/payment/wd-t3');
      const back = q('print-back')!;
      expect(back.getAttribute('href')).toBe('/payments/wd-t3');
      expect(text(back)).toBe('Back');
      expect(back.classList).toContain('print:hidden');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
    });

    it('has nothing else that is interactive on the printed page', async () => {
      await render('/print/payment/wd-t3');
      const visible = Array.from(el.querySelectorAll('a, button, input, select')).filter(
        (node) => !node.classList.contains('print:hidden'),
      );
      expect(visible).toEqual([]);
    });
  });

  describe('when there is nothing to print', () => {
    it('an unknown id says so, offers the way back and does not open the dialog', async () => {
      await render('/print/payment/nope');
      expect(text(q('print-nothing'))).toBe('Nothing to print here.');
      expect(q('print-article')).toBeNull();
      expect(q('print-back')!.getAttribute('href')).toBe('/payments/nope');
      expect(print).not.toHaveBeenCalled();
    });

    it('the id of another business is not printed', async () => {
      await render('/print/payment/sy-t1');
      expect(q('print-nothing')).not.toBeNull();
      expect(print).not.toHaveBeenCalled();
    });

    it('a client who has not connected a bank yet has nothing to print', async () => {
      demo.setSetup('new');
      await render('/print/payment/wd-t3');
      expect(q('print-nothing')).not.toBeNull();
      expect(print).not.toHaveBeenCalled();
    });
  });

  it('print opens the dialog once', async () => {
    await render('/print/payment/wd-t1');
    expect(print).toHaveBeenCalledTimes(1);
    demo.updateTransaction('wd-t1', (tx) => ({ ...tx, confirmed: true }));
    await settle();
    await settle();
    expect(text(q('tx-status'))).toBe('Booked');
    expect(print).toHaveBeenCalledTimes(1);
  });
});
