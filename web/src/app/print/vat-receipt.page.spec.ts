import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { MockInstance } from 'vitest';
import { formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { BUSINESSES } from '../data/sample-data';
import { findTaxOffice } from '../domain/tax-details';
import { DemoStateService } from '../state/demo-state.service';
import { VatReceiptPage } from './vat-receipt.page';

describe('VatReceiptPage', () => {
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
        provideRouter([{ path: 'print/vat-return/:periodStart', component: VatReceiptPage }]),
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

  /** What Weber Design's September return stored when it was sent: the receipt must show exactly this. */
  const september = BUSINESSES.find((b) => b.id === 'weber-design')!.vatReturns.find(
    (r) => r.periodStart === '2026-09-01',
  )!;

  it('receipt shows the stored figures and ticket and prints once', async () => {
    await render('/print/vat-return/2026-09-01');
    expect(text(q('print-business'))).toBe('Weber Design');
    expect(text(q('receipt-title'))).toBe('Transfer receipt (Übertragungsprotokoll)');
    expect(text(q('receipt-kind'))).toBe('VAT return (UStVA)');
    expect(text(q('receipt-period'))).toBe('September 2026');
    expect(text(q('receipt-sent-on'))).toBe('8 Oct 2026');
    expect(text(q('receipt-charged'))).toContain('VAT you charged (Umsatzsteuer)');
    expect(text(q('receipt-charged-amount'))).toBe(formatMoney(september.chargedCents, 'en'));
    expect(text(q('receipt-paid'))).toContain('VAT you paid (Vorsteuer)');
    expect(text(q('receipt-paid-amount'))).toBe(formatMoney(september.paidCents, 'en'));
    expect(text(q('receipt-result-label'))).toBe('To pay');
    expect(text(q('receipt-result-amount'))).toBe(formatMoney(46112, 'en'));
    expect(text(q('receipt-ticket'))).toBe(september.ticket);
    for (const id of [
      'receipt-sent-on',
      'receipt-charged-amount',
      'receipt-paid-amount',
      'receipt-result-amount',
      'receipt-ticket',
    ]) {
      expect(q(id)!.closest('bdi[dir="ltr"]'), id).not.toBeNull();
    }
    expect(print).toHaveBeenCalledTimes(1);

    // Later changes to the page never open the dialog again.
    demo.recordSentReturn({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      sentOn: '2026-10-22',
      chargedCents: 0,
      paidCents: 0,
      resultCents: 0,
      ticket: 'ET-2026-1022-00002',
      taxOffice: null,
    });
    await settle();
    await settle();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('names the tax office the business files with', async () => {
    await render('/print/vat-return/2026-09-01');
    const office = findTaxOffice('berlin', '27/123/45678')!;
    expect(office).toBeTruthy();
    expect(text(q('receipt-office'))).toBe(`Tax office (Finanzamt) ${office}`);
  });

  it('names the office stored when the return was sent, even after the tax number changed', async () => {
    const office = findTaxOffice('berlin', '27/123/45678')!;
    // A number of another office (Berlin Mitte): the old receipt still names the office it was sent to.
    demo.saveTaxProfile({ ...demo.business().taxProfile, taxNumber: '21/456/78901' });
    await render('/print/vat-return/2026-09-01');
    expect(text(q('receipt-office'))).toBe(`Tax office (Finanzamt) ${office}`);

    demo.saveTaxProfile({ ...demo.business().taxProfile, taxNumber: null });
    await settle();
    expect(text(q('receipt-office'))).toBe(`Tax office (Finanzamt) ${office}`);
  });

  it('leaves out the tax office line when the return stored none', async () => {
    demo.recordSentReturn({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      sentOn: '2026-10-22',
      chargedCents: 1000,
      paidCents: 500,
      resultCents: 500,
      ticket: 'ET-2026-1022-00003',
      taxOffice: null,
    });
    await render('/print/vat-return/2026-10-01');
    expect(q('receipt-office')).toBeNull();
    expect(q('receipt-ticket')).not.toBeNull();
  });

  it('shows what was stored, never what the payments give now', async () => {
    demo.setBusiness('cafe-linde');
    demo.recordSentReturn({
      periodStart: '2026-07-01',
      periodEnd: '2026-09-30',
      sentOn: '2026-10-22',
      chargedCents: 123456,
      paidCents: 23456,
      resultCents: 100000,
      ticket: 'ET-2026-1022-12345',
      taxOffice: null,
    });
    // The payments of that quarter change afterwards: the receipt does not.
    demo.updateTransaction('cl-t12', (tx) => ({ ...tx, amountCents: tx.amountCents * 2 }));
    await render('/print/vat-return/2026-07-01');
    expect(text(q('print-business'))).toBe('Café Linde GbR');
    expect(text(q('receipt-period'))).toBe('Q3 2026');
    expect(text(q('receipt-charged-amount'))).toBe(formatMoney(123456, 'en'));
    expect(text(q('receipt-paid-amount'))).toBe(formatMoney(23456, 'en'));
    expect(text(q('receipt-result-amount'))).toBe(formatMoney(100000, 'en'));
    expect(text(q('receipt-ticket'))).toBe('ET-2026-1022-12345');
    expect(text(q('receipt-sent-on'))).toBe('22 Oct 2026');
  });

  it('a quarter that was sent is named as a quarter', async () => {
    demo.setBusiness('cafe-linde');
    await render('/print/vat-return/2026-04-01');
    expect(text(q('receipt-period'))).toBe('Q2 2026');
    expect(text(q('receipt-sent-on'))).toBe('9 Jul 2026');
  });

  it('a refund reads To get back, with the amount as a positive number', async () => {
    demo.recordSentReturn({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31',
      sentOn: '2026-10-22',
      chargedCents: 1000,
      paidCents: 7623,
      resultCents: -6623,
      ticket: 'ET-2026-1022-00001',
      taxOffice: null,
    });
    await render('/print/vat-return/2026-10-01');
    expect(text(q('receipt-result-label'))).toBe('To get back');
    expect(text(q('receipt-result-amount'))).toBe(formatMoney(6623, 'en'));
    expect(text(q('receipt-result'))).not.toMatch(/-\s*€/);
  });

  it('prints the receipt of the business that is open', async () => {
    demo.setBusiness('cafe-linde');
    await render('/print/vat-return/2026-04-01');
    expect(text(q('print-business'))).toBe('Café Linde GbR');
    // Weber's September is not Café's.
    await render('/print/vat-return/2026-09-01');
    expect(q('print-nothing')).not.toBeNull();
  });

  it('follows the language and direction of the app', async () => {
    TestBed.inject(LanguageService).setLang('de');
    await render('/print/vat-return/2026-09-01');
    expect(text(q('receipt-title'))).toBe('Übertragungsprotokoll');
    expect(text(q('receipt-period'))).toBe('September 2026');
    expect(text(q('receipt-result-label'))).toBe('Zu zahlen');
    expect(text(q('receipt-result-amount'))).toBe(formatMoney(46112, 'de').replace(/\s+/g, ' '));
    expect(text(q('print-back'))).toBe('Zurück');
    TestBed.inject(LanguageService).setLang('ar');
    await settle();
    expect(document.documentElement.dir).toBe('rtl');
    expect(text(q('receipt-result-label'))).toBe('المبلغ المستحق');
    expect(q('receipt-ticket')!.closest('bdi[dir="ltr"]')).not.toBeNull();
  });

  it('explains the German term of its title', async () => {
    await render('/print/vat-return/2026-09-01');
    expect(q('receipt-title')!.querySelector('app-term button')).not.toBeNull();
  });

  describe('back link', () => {
    it('returns to the taxes page and is hidden when printing', async () => {
      await render('/print/vat-return/2026-09-01');
      const back = q('print-back')!;
      expect(back.getAttribute('href')).toBe('/taxes');
      expect(text(back)).toBe('Back');
      expect(back.classList).toContain('print:hidden');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
    });
  });

  describe('when there is nothing to print', () => {
    const expectNothing = () => {
      expect(text(q('print-nothing'))).toBe('Nothing to print here.');
      expect(q('print-article')).toBeNull();
      expect(q('print-back')!.getAttribute('href')).toBe('/taxes');
      expect(print).not.toHaveBeenCalled();
    };

    it('unknown period shows nothing to print', async () => {
      await render('/print/vat-return/2025-01-01');
      expectNothing();
    });

    it('a period that was not sent yet', async () => {
      await render('/print/vat-return/2026-10-01');
      expectNothing();
    });

    it('something that is not a date', async () => {
      await render('/print/vat-return/nope');
      expectNothing();
    });

    it('a business that sent no return', async () => {
      demo.setBusiness('sara-yoga');
      await render('/print/vat-return/2026-09-01');
      expectNothing();
    });

    it('a receipt that Reset demo took back', async () => {
      demo.setBusiness('cafe-linde');
      demo.recordSentReturn({
        periodStart: '2026-07-01',
        periodEnd: '2026-09-30',
        sentOn: '2026-10-22',
        chargedCents: 100000,
        paidCents: 21436,
        resultCents: 78564,
        ticket: 'ET-2026-1022-00001',
        taxOffice: null,
      });
      demo.resetData();
      await render('/print/vat-return/2026-07-01');
      expectNothing();
    });
  });
});
