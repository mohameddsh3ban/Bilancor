import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { formatMoney, formatMonthRange } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Business, TaxProfile } from '../data/models';
import { SOFTWARE } from '../data/categories';
import { BUSINESSES } from '../data/sample-data';
import { currentVatReturn } from '../domain/vat-return';
import { DemoStateService } from '../state/demo-state.service';
import { VatReturnTab } from './vat-return-tab';

describe('VatReturnTab', () => {
  let demo: DemoStateService;
  let fixture: ComponentFixture<VatReturnTab>;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting(), provideRouter([])] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) =>
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (testId: string) =>
    Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        `[data-testid="${testId}"]`,
      ),
    );

  function render(businessId = 'weber-design'): HTMLElement {
    demo.setBusiness(businessId);
    fixture = TestBed.createComponent(VatReturnTab);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** Renders the tab for a sample business whose tax answers (and, optionally, other fields) were changed. */
  function renderChanged(
    businessId: string,
    taxPatch: Partial<TaxProfile>,
    businessPatch: Partial<Business> = {},
  ): void {
    const business = BUSINESSES.find((b) => b.id === businessId)!;
    const changed = {
      ...business,
      ...businessPatch,
      taxProfile: { ...business.taxProfile, ...taxPatch },
    };
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([]),
        { provide: DemoStateService, useValue: { business: () => changed } },
      ],
    });
    fixture = TestBed.createComponent(VatReturnTab);
    fixture.detectChanges();
  }

  const SWITCHED_TO_VAT: Partial<TaxProfile> = {
    kleinunternehmer: false,
    vatPeriod: 'monthly',
    vatBasis: 'ist',
  };

  /** Sara Weber Yoga charges VAT from now on (monthly); her booked October payments hold VAT only on what she bought. */
  function saraSwitchesToVat(): void {
    demo.setBusiness('sara-yoga');
    demo.saveTaxProfile({ ...demo.business().taxProfile, ...SWITCHED_TO_VAT });
  }

  it('weber VAT tab shows October in progress, so far you pay, ready to send from 1 Nov', () => {
    render('weber-design');
    const strip = q('vat-deadline')!;
    expect(text(strip)).toBe(
      'VAT return (UStVA) · October 2026 · in progress · due 10 Nov (in 19 days)',
    );
    expect(strip.className).toContain('text-warning');
    expect(strip.className).not.toContain('text-negative');
    expect(text(q('vat-result-line'))).toBe('So far you pay €393.33');
    expect(text(q('vat-result-to'))).toBe('to the tax office');
    const send = q('vat-send-button') as HTMLButtonElement;
    expect(send.tagName).toBe('BUTTON');
    expect(send.disabled).toBe(true);
    expect(text(send)).toBe('Send to the tax office');
    expect(text(q('vat-send-note'))).toBe('Ready to send from 1 Nov');
  });

  it('a deadline further away than 21 days has no warning colour', () => {
    demo.setBusiness('weber-design');
    demo.saveTaxProfile({ ...demo.business().taxProfile, permanentExtension: true });
    render('weber-design');
    const strip = q('vat-deadline')!;
    expect(text(strip)).toBe(
      'VAT return (UStVA) · October 2026 · in progress · due 10 Dec (in 49 days)',
    );
    expect(strip.className).not.toContain('text-warning');
    expect(strip.className).not.toContain('text-negative');
  });

  it('cafe shows Q3 overdue since 10 Oct with "You pay"', () => {
    render('cafe-linde');
    const strip = q('vat-deadline')!;
    expect(text(strip)).toBe('VAT return (UStVA) · Q3 2026 · Overdue since 10 Oct');
    expect(strip.className).toContain('text-negative');
    expect(text(q('vat-result-line'))).toBe(`You pay ${formatMoney(78564, 'en')}`);
    expect(text(q('vat-result-to'))).toBe('to the tax office');
    expect(text(q('vat-result'))).not.toContain('So far');
    expect(q('vat-needs')).toBeNull();
    const send = q('vat-send-button') as HTMLButtonElement;
    expect(send.tagName).toBe('BUTTON');
    expect(send.disabled).toBe(false);
    expect(q('vat-send-note')).toBeNull();
  });

  it('refund shows "You get … back"', () => {
    saraSwitchesToVat();
    // A return for August was sent, so the open one is September: over, and past its date.
    demo.recordSentReturn({
      periodStart: '2026-08-01',
      periodEnd: '2026-08-31',
      sentOn: '2026-09-08',
      chargedCents: 0,
      paidCents: 0,
      resultCents: 0,
      ticket: 'ET-2026-0908-00000',
      taxOffice: null,
    });
    render('sara-yoga');
    const view = currentVatReturn(demo.business());
    expect(view?.kind === 'return' && view.view.resultCents).toBeLessThan(0);
    const refund = Math.abs(view?.kind === 'return' ? view.view.resultCents : 0);
    expect(text(q('vat-result-line'))).toBe(`You get ${formatMoney(refund, 'en')} back`);
    expect(text(q('vat-result-to'))).toBe('from the tax office');
    expect(text(q('vat-total-label'))).toBe('To get back');
    expect(text(q('vat-total-amount'))).toBe(formatMoney(refund, 'en'));
  });

  it('a refund that is still in progress says so far, with the amount as a positive number', () => {
    saraSwitchesToVat();
    render('sara-yoga');
    expect(text(q('vat-result-line'))).toBe('So far you get €66.23 back');
    expect(text(q('vat-result-to'))).toBe('from the tax office');
    expect(text(q('vat-result'))).not.toMatch(/-\s*€/);
  });

  it('adds up what was charged and what was paid, with the number of sales and purchases', () => {
    render('weber-design');
    expect(text(q('vat-charged')!.querySelector('button'))).toBe('VAT you charged (Umsatzsteuer)');
    expect(text(q('vat-charged-detail'))).toBe('1 sale · €2,500.00 net');
    expect(text(q('vat-charged-amount'))).toBe('€475.00');
    expect(text(q('vat-paid')!.querySelector('button'))).toBe('VAT you paid (Vorsteuer)');
    expect(text(q('vat-paid-detail'))).toBe('4 purchases');
    expect(text(q('vat-paid-amount'))).toBe('€81.67');
    expect(text(q('vat-total-label'))).toBe('To pay');
    expect(text(q('vat-total-amount'))).toBe('€393.33');
    expect(text(q('vat-how'))).toContain('Based on payment dates');
  });

  it('see the payments links to Payments with the month of the period', () => {
    render('weber-design');
    expect(q('vat-see-payments')!.getAttribute('href')).toBe('/payments?month=2026-10');
    expect(text(q('vat-see-payments'))).toBe('See the payments');
  });

  it('for a quarter, see the payments opens its first month and says where the other two are', () => {
    render('cafe-linde');
    const link = q('vat-see-payments')!;
    expect(link.getAttribute('href')).toBe('/payments?month=2026-07');
    const hint = q('vat-see-payments-hint')!;
    expect(text(hint)).toBe('Opens July — choose August or September in the month filter');
    expect(link.getAttribute('aria-describedby')).toBe(hint.id);
  });

  it('a monthly return opens its one month, with no hint about the others', () => {
    render('weber-design');
    expect(q('vat-see-payments-hint')).toBeNull();
    expect(q('vat-see-payments')!.getAttribute('aria-describedby')).toBeNull();
  });

  it('the quarter hint reads in German and in Arabic, with the months in their language', () => {
    TestBed.inject(LanguageService).setLang('de');
    render('cafe-linde');
    expect(text(q('vat-see-payments-hint'))).toBe('Öffnet Juli — wähle August oder September im Monatsfilter');

    TestBed.inject(LanguageService).setLang('ar');
    fixture.detectChanges();
    const month = (m: string) => formatMonthRange(m, m, 'ar');
    expect(text(q('vat-see-payments-hint'))).toContain(month('2026-07'));
    expect(text(q('vat-see-payments-hint'))).toContain(month('2026-08'));
    expect(text(q('vat-see-payments-hint'))).toContain(month('2026-09'));
  });

  it('needs-you card starts the review', () => {
    render('weber-design');
    const card = q('vat-needs')!;
    expect(text(card)).toContain('6 payments still need you — fix them so the return is right');
    const start = q('vat-needs-start')!;
    expect(text(start)).toBe('Start');
    expect(start.getAttribute('href')).toBe('/review');
  });

  it('says one payment in the singular', () => {
    // Confirming five of the six leaves one.
    demo.setBusiness('weber-design');
    for (const id of ['wd-t1', 'wd-t3', 'wd-t4', 'wd-t17', 'wd-t19']) {
      demo.updateTransaction(id, (tx) => ({
        ...tx,
        booking: tx.booking ?? SOFTWARE,
        confirmed: true,
        receipt: 'attached',
      }));
    }
    render('weber-design');
    expect(text(q('vat-needs'))).toContain(
      '1 payment still needs you — fix it so the return is right',
    );
  });

  it('while payments wait, and the return is over, Send says Fix n payments first and opens the review', () => {
    // Café's Q3 is over; one of its payments is not confirmed yet.
    demo.setBusiness('cafe-linde');
    demo.updateTransaction('cl-t12', (tx) => ({ ...tx, confirmed: false }));
    demo.updateTransaction('cl-t13', (tx) => ({ ...tx, confirmed: false }));
    render('cafe-linde');
    const send = q('vat-send-button')!;
    expect(send.tagName).toBe('A');
    expect(text(send)).toBe('Fix 2 payments first');
    expect(send.getAttribute('href')).toBe('/review');
    expect(text(q('vat-needs'))).toContain('2 payments still need you');
  });

  it('while the return is in progress, Send waits for the period even with payments waiting', () => {
    render('weber-design');
    expect(q('vat-send-button')!.tagName).toBe('BUTTON');
    expect(text(q('vat-send-button'))).not.toContain('Fix');
  });

  it('says it goes out through ELSTER, with the term explained', () => {
    render('weber-design');
    expect(text(q('vat-send-via'))).toBe('Goes out through Online tax filing (ELSTER)');
    expect(q('vat-send-via')!.querySelector('app-term button')).not.toBeNull();
  });

  it('sent earlier lists september then august with receipts', () => {
    render('weber-design');
    const rows = qa('vat-sent-row');
    expect(rows.map((r) => text(r.querySelector('[data-testid="vat-sent-period"]')))).toEqual([
      'September 2026',
      'August 2026',
    ]);
    const part = (row: HTMLElement, testId: string) =>
      text(row.querySelector(`[data-testid="${testId}"]`));
    expect(part(rows[0], 'vat-sent-on')).toBe('sent 8 Oct');
    expect(part(rows[0], 'vat-sent-amount')).toBe('€461.12');
    expect(part(rows[0], 'vat-sent-kind')).toBe('to pay');
    expect(part(rows[0], 'vat-sent-chip')).toBe('Sent');
    expect(part(rows[1], 'vat-sent-on')).toBe('sent 8 Sept');
    expect(part(rows[1], 'vat-sent-amount')).toBe('€176.12');
    const receipts = qa('vat-receipt');
    expect(receipts.map((r) => r.getAttribute('href'))).toEqual([
      '/print/vat-return/2026-09-01',
      '/print/vat-return/2026-08-01',
    ]);
    expect(text(receipts[0])).toBe('Receipt');
  });

  it('sent earlier names a quarter as a quarter', () => {
    render('cafe-linde');
    const rows = qa('vat-sent-row');
    expect(rows).toHaveLength(1);
    expect(text(rows[0].querySelector('[data-testid="vat-sent-period"]'))).toBe('Q2 2026');
    expect(text(rows[0].querySelector('[data-testid="vat-sent-on"]'))).toBe('sent 9 Jul');
    expect(text(rows[0].querySelector('[data-testid="vat-sent-amount"]'))).toBe('€884.30');
    expect(qa('vat-receipt')[0].getAttribute('href')).toBe('/print/vat-return/2026-04-01');
  });

  it('a business that sent nothing yet has no sent earlier list', () => {
    saraSwitchesToVat();
    render('sara-yoga');
    expect(q('vat-sent')).toBeNull();
  });

  it('a return that was sent shows as sent earlier, and the next period takes its place', () => {
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
    render('cafe-linde');
    expect(text(q('vat-deadline'))).toContain('Q4 2026 · in progress · due 10 Jan (in 80 days)');
    expect(
      qa('vat-sent-row').map((r) => text(r.querySelector('[data-testid="vat-sent-period"]'))),
    ).toEqual(['Q3 2026', 'Q2 2026']);
  });

  it('yearly profile shows yearly only', () => {
    demo.setBusiness('weber-design');
    demo.saveTaxProfile({ ...demo.business().taxProfile, vatPeriod: 'yearly' });
    render('weber-design');
    expect(text(q('vat-yearly'))).toBe('Yearly VAT return only · due 31 Jul 2027');
    expect(q('vat-deadline')).toBeNull();
    expect(q('vat-result')).toBeNull();
    expect(q('vat-send-button')).toBeNull();
    // What was sent earlier is still true.
    expect(qa('vat-sent-row')).toHaveLength(2);
  });

  it('a return with no booked payment that carries VAT says Amount not known yet', () => {
    renderChanged('sara-yoga', SWITCHED_TO_VAT, { transactions: [] });
    expect(text(q('vat-result'))).toBe('Amount not known yet');
    expect(q('vat-result-line')).toBeNull();
    expect(text(q('vat-deadline'))).toBe(
      'VAT return (UStVA) · October 2026 · in progress · due 10 Nov (in 19 days)',
    );
    expect(q('vat-charged')).toBeNull();
    expect(q('vat-see-payments')).not.toBeNull();
    expect(q('vat-result')!.textContent ?? '').not.toContain('€');
  });

  it('says the same in German', () => {
    TestBed.inject(LanguageService).setLang('de');
    render('weber-design');
    expect(text(q('vat-deadline'))).toBe(
      'UStVA · Oktober 2026 · läuft noch · fällig am 10. Nov. (in 19 Tagen)',
    );
    expect(text(q('vat-result-line'))).toBe(
      `Bisher zahlst du ${formatMoney(39333, 'de').replace(/\s/g, ' ')}`,
    );
    expect(text(q('vat-result-to'))).toBe('ans Finanzamt');
    expect(text(q('vat-send-note'))).toBe('Bereit zum Senden ab 1. Nov.');
    expect(text(q('vat-send-via'))).toBe('Geht raus über ELSTER');
  });

  it('the deadline strip names the VAT return with its German term, explained, in English and German', () => {
    render('weber-design');
    const term = () => q('vat-deadline')!.querySelector('app-term')!;
    expect(text(term())).toBe('VAT return (UStVA)');
    expect(term().querySelector('button')).not.toBeNull();

    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text(term())).toBe('UStVA');
    expect(term().querySelector('button')).not.toBeNull();
  });

  it('says the same in Arabic, with the amounts left to right', () => {
    TestBed.inject(LanguageService).setLang('ar');
    render('weber-design');
    const line = q('vat-result-line')!;
    expect(line.querySelector('bdi[dir="ltr"]')?.textContent).toBe(formatMoney(39333, 'ar'));
    expect(text(line)).toContain('ستدفع');
    expect(text(q('vat-send-note'))).toContain('جاهز للإرسال');
  });

  it('follows a change of the tax answers', async () => {
    render('weber-design');
    expect(text(q('vat-deadline'))).toContain('October 2026');
    demo.saveTaxProfile({ ...demo.business().taxProfile, vatPeriod: 'quarterly' });
    fixture.detectChanges();
    expect(text(q('vat-deadline'))).toContain('Q4 2026');
    expect(q('vat-see-payments')!.getAttribute('href')).toBe('/payments?month=2026-10');
    demo.saveTaxProfile({ ...demo.business().taxProfile, vatPeriod: 'yearly' });
    fixture.detectChanges();
    expect(q('vat-yearly')).not.toBeNull();
    expect(q('vat-deadline')).toBeNull();
  });
});
