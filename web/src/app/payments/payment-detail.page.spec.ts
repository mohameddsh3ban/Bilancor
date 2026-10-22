import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';
import ar from '../../../public/i18n/ar.json';

describe('PaymentDetailPage', () => {
  let demo: DemoStateService;
  let harness: RouterTestingHarness;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideTranslocoTesting(),
        provideRouter([
          {
            path: 'payments',
            component: PaymentsPage,
            children: [{ path: ':id', component: PaymentDetailPage }],
          },
        ]),
      ],
    });
    demo = TestBed.inject(DemoStateService);
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

  async function settle(): Promise<void> {
    harness.detectChanges();
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const q = (testId: string) => el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const detail = () => q('payment-detail');
  const d = (testId: string) =>
    detail()?.querySelector<HTMLElement>(`[data-testid="${testId}"]`) ?? null;
  const status = () => text(d('tx-status'));
  const historyTexts = () =>
    Array.from(detail()!.querySelectorAll('[data-testid="history-item"]')).map((item) =>
      text(item.querySelector('[data-testid="history-text"]')),
    );

  async function click(testId: string): Promise<void> {
    d(testId)!.click();
    await settle();
  }

  const options = () =>
    Array.from(document.body.querySelectorAll<HTMLElement>('[data-testid="category-option"]'));

  async function choose(label: string): Promise<void> {
    await click('change-category');
    options()
      .find((o) => text(o).startsWith(label))!
      .click();
    await settle();
  }

  describe('header', () => {
    it('shows the signed amount, the counterparty, the date, the account and the status', async () => {
      await render('/payments/wd-t1');
      expect(text(d('detail-amount'))).toBe(formatMoney(150000, 'en', { signed: true }));
      expect(d('detail-amount')!.className).toContain('text-positive');
      expect(d('detail-amount')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(text(d('detail-counterparty'))).toBe('Müller GmbH');
      expect(d('detail-counterparty')!.getAttribute('dir')).toBe('auto');
      expect(text(d('detail-meta'))).toBe('20 Oct · Qonto');
      expect(status()).toBe('Please confirm');
    });

    it('colours an outgoing amount and names the cash box in the language of the page', async () => {
      await render('/payments/wd-t15');
      expect(d('detail-amount')!.className).toContain('text-negative');
      expect(text(d('detail-meta'))).toBe('14 Aug · Cash box');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('detail-meta'))).toBe(`${formatDate('2026-08-14', 'de')} · Kasse`);
    });

    it('opens as a panel on computers and a full page on phones, each with a way back to the list', async () => {
      await render('/payments/wd-t3');
      const back = q('back-link')!;
      expect(back.getAttribute('href')).toBe('/payments');
      expect(back.classList).toContain('lg:hidden');
      expect(back.querySelector('ng-icon')!.classList).toContain('rtl:rotate-180');
      const close = d('close-panel')!;
      expect(close.getAttribute('href')).toBe('/payments');
      expect(close.classList).toContain('hidden');
      expect(close.classList).toContain('lg:inline-flex');
      expect(close.getAttribute('aria-label')).toBe('Close');
    });
  });

  describe('actions', () => {
    it('confirm turns Müller into booked and lowers Needs you', async () => {
      await render('/payments/wd-t1');
      expect(text(q('needs-you-count'))).toBe('3');
      await click('confirm-booking');
      expect(status()).toBe('Booked');
      expect(d('confirm-booking')).toBeNull();
      expect(text(q('needs-you-count'))).toBe('2');
      expect(historyTexts()[0]).toBe('You confirmed Revenue (19% VAT)');
      expect(text(d('history-date'))).toBe('22 Oct');
      const row = Array.from(el.querySelectorAll('[data-testid="payment-row"]')).find((r) =>
        r.textContent?.includes('Müller GmbH'),
      )!;
      expect(text(row.querySelector('[data-testid="tx-status"]'))).toBe('Booked');
    });

    it('confirming a payment whose receipt is missing leaves it needing the receipt', async () => {
      await render('/payments/wd-t3');
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
      await settle();
      expect(status()).toBe('Please confirm');
      await click('confirm-booking');
      expect(status()).toBe('Receipt missing');
    });

    it('no receipt needed books Deutsche Bahn', async () => {
      await render('/payments/wd-t3');
      expect(status()).toBe('Receipt missing');
      expect(text(q('needs-you-count'))).toBe('3');
      await click('no-receipt-needed');
      expect(status()).toBe('Booked');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
      expect(d('no-receipt-needed')).toBeNull();
      expect(d('take-photo')).toBeNull();
      expect(text(q('needs-you-count'))).toBe('2');
      expect(historyTexts()[0]).toBe('You marked: no receipt needed');
    });

    it('choosing a category books Amazon and adds a history line', async () => {
      await render('/payments/wd-t4');
      expect(status()).toBe('Unclear');
      expect(text(d('booking-label'))).toBe('No category yet');
      expect(d('change-category')!.textContent?.trim()).toBe('Choose');
      expect(d('confirm-booking')).toBeNull();
      await choose('Software');
      expect(status()).toBe('Booked');
      expect(text(d('booking-label'))).toBe(
        'Software & maintenance · 4806 Wartungskosten für Hard- und Software',
      );
      expect(text(d('booking-vat'))).toBe('19%');
      expect(d('change-category')!.textContent?.trim()).toBe('Change');
      expect(historyTexts()[0]).toBe('You changed the category to Software & maintenance');
      expect(text(q('needs-you-count'))).toBe('2');
    });

    it('choosing the category a payment already has changes nothing', async () => {
      await render('/payments/wd-t2');
      const before = historyTexts();
      await choose('Phone');
      expect(historyTexts()).toEqual(before);
      expect(options()).toHaveLength(0);
    });

    it('private shows 1800 and back to business shows receipt missing', async () => {
      await render('/payments/wd-t3');
      expect(d('kind-business')!.getAttribute('aria-pressed')).toBe('true');
      await click('kind-private');
      expect(text(d('booking-label'))).toBe('Private withdrawal · 1800 Privatentnahmen allgemein');
      expect(text(d('booking-vat'))).toBe('No VAT');
      expect(status()).toBe('Booked');
      expect(d('kind-private')!.getAttribute('aria-pressed')).toBe('true');
      expect(d('kind-business')!.getAttribute('aria-pressed')).toBe('false');
      expect(historyTexts()[0]).toBe('You marked it as private');

      await click('kind-business');
      expect(status()).toBe('Receipt missing');
      expect(text(d('booking-label'))).toBe('Travel · 4670 Reisekosten Unternehmer');
      expect(d('kind-business')!.getAttribute('aria-pressed')).toBe('true');
      expect(historyTexts().slice(0, 2)).toEqual([
        'You marked it as business',
        'You marked it as private',
      ]);
    });

    it('a private payment offers no Change, Confirm or receipt actions', async () => {
      await render('/payments/wd-t1');
      expect(d('confirm-booking')).not.toBeNull();
      await click('kind-private');
      for (const id of ['change-category', 'confirm-booking', 'no-receipt-needed', 'take-photo']) {
        expect(d(id), id).toBeNull();
      }
      expect(text(d('booking-label'))).toBe('Private deposit · 1890 Privateinlagen');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
    });

    it('clicking the side that is already on adds no history line', async () => {
      await render('/payments/wd-t2');
      const before = historyTexts();
      await click('kind-business');
      expect(historyTexts()).toEqual(before);
    });

    it('a double tap writes one history line, not two', async () => {
      await render('/payments/wd-t1');
      const confirm = d('confirm-booking')!;
      confirm.click();
      confirm.click();
      await settle();
      expect(historyTexts().filter((t) => t.startsWith('You confirmed'))).toHaveLength(1);

      await harness.navigateByUrl('/payments/wd-t3');
      await settle();
      const noReceipt = d('no-receipt-needed')!;
      noReceipt.click();
      noReceipt.click();
      await settle();
      expect(historyTexts().filter((t) => t.startsWith('You marked: no receipt'))).toHaveLength(1);
    });

    it('only offers the actions that apply', async () => {
      await render('/payments/wd-t2');
      expect(status()).toBe('Booked');
      expect(d('confirm-booking')).toBeNull();
      expect(d('no-receipt-needed')).toBeNull();
      expect(d('change-category')).not.toBeNull();

      await harness.navigateByUrl('/payments/wd-t1');
      await settle();
      expect(d('confirm-booking')).not.toBeNull();
      expect(d('no-receipt-needed')).toBeNull();

      await harness.navigateByUrl('/payments/wd-t3');
      await settle();
      expect(d('confirm-booking')).toBeNull();
      expect(d('no-receipt-needed')).not.toBeNull();
    });
  });

  describe('receipt', () => {
    it('shows the attached file with a placeholder thumbnail', async () => {
      await render('/payments/wd-t2');
      expect(text(d('receipt-state'))).toBe('telekom-rechnung-oktober.pdf');
      expect(d('receipt-state')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(d('receipt-thumbnail')).not.toBeNull();
    });

    it('missing receipt: no receipt needed, and three coming-soon ways to add one', async () => {
      await render('/payments/wd-t3');
      expect(text(d('receipt-state'))).toBe('Receipt missing');
      expect(d('no-receipt-needed')!.tagName).toBe('BUTTON');
      expect(d('take-photo')!.getAttribute('href')).toBe('/soon/photo');
      expect(d('pick-document')!.getAttribute('href')).toBe('/soon/documents');
      expect(d('self-receipt')!.getAttribute('href')).toBe('/soon/selfReceipt');
    });

    it('a payment that needs no receipt says so', async () => {
      await render('/payments/wd-t15');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
      expect(d('no-receipt-needed')).toBeNull();
    });
  });

  describe('booking', () => {
    it('shows the translated label with the SKR03 account and the VAT rate', async () => {
      await render('/payments/wd-t2');
      expect(text(d('booking-label'))).toBe('Phone & internet · 4920 Telefon');
      expect(d('booking-label')!.querySelector('bdi[dir="ltr"]')!.textContent).toContain(
        '4920 Telefon',
      );
      expect(text(d('booking-vat'))).toBe('19%');
    });

    it('shows only the SKR03 account in German', async () => {
      await render('/payments/wd-t2');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('booking-label'))).toBe('4920 Telefon');
      expect(text(d('booking-vat'))).toBe('19 %');
    });

    it('kleinunternehmer shows no VAT', async () => {
      demo.setBusiness('sara-yoga');
      // sy-t3 is Rent, a category with 19 % VAT; a small business never shows it.
      await render('/payments/sy-t3');
      expect(text(d('booking-label'))).toBe('Rent · 4210 Miete (unbewegliche Wirtschaftsgüter)');
      expect(text(d('booking-vat'))).toContain('No VAT');
      expect(text(d('booking-vat'))).not.toContain('19');
    });

    it('a business that charges VAT shows the category rate', async () => {
      await render('/payments/wd-t8');
      expect(text(d('booking-vat'))).toBe('19%');
    });
  });

  describe('bank details', () => {
    it('shows the IBAN in groups and the reference, both left-to-right', async () => {
      await render('/payments/wd-t2');
      expect(text(d('bank-iban'))).toBe('DE12 3705 0198 0012 3456 01');
      expect(d('bank-iban')!.closest('bdi[dir="ltr"]')).not.toBeNull();
      expect(text(d('bank-reference'))).toBe('Rechnung 8841 0712, Mobilfunk Oktober');
      expect(d('bank-reference')!.closest('bdi[dir="ltr"]')).not.toBeNull();
    });

    it('a cash payment has no other bank account, so no IBAN, but keeps its reference', async () => {
      await render('/payments/wd-t15');
      expect(d('bank-iban')).toBeNull();
      expect(text(d('bank-reference'))).toBe('Einkauf bar');
    });
  });

  describe('history', () => {
    it('lists the newest line first', async () => {
      await render('/payments/wd-t3');
      expect(historyTexts()).toEqual(['Booked as Travel automatically', 'Imported from Qonto']);
      await click('no-receipt-needed');
      expect(historyTexts()).toEqual([
        'You marked: no receipt needed',
        'Booked as Travel automatically',
        'Imported from Qonto',
      ]);
      const dates = Array.from(detail()!.querySelectorAll('[data-testid="history-date"]')).map(
        text,
      );
      expect(dates).toEqual(['22 Oct', '17 Oct', '17 Oct']);
    });

    it('history lines follow the language', async () => {
      await render('/payments/wd-t1');
      expect(historyTexts()).toEqual([
        'Booked as Revenue (19% VAT) automatically',
        'Imported from Qonto',
      ]);
      const lang = TestBed.inject(LanguageService);
      lang.setLang('de');
      await settle();
      expect(historyTexts()).toEqual([
        'Automatisch als Einnahmen (19 % USt) gebucht',
        'Importiert von Qonto',
      ]);
      expect(text(d('history-date'))).toBe(formatDate('2026-10-20', 'de'));
      lang.setLang('ar');
      await settle();
      expect(historyTexts()[0]).toContain(ar.booking.revenue19);
      expect(historyTexts()[0]).not.toContain('Revenue');
    });

    it('names the cash box in the language of the page', async () => {
      await render('/payments/wd-t15');
      expect(historyTexts()).toEqual([
        'You marked it as private',
        'Booked as Private withdrawal automatically',
        'Imported from Cash box',
      ]);
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(historyTexts().at(-1)).toBe('Importiert von Kasse');
    });

    it('a change made in one language reads right in another', async () => {
      await render('/payments/wd-t4');
      await choose('Travel');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(historyTexts()[0]).toBe('Du hast die Kategorie auf Reisen geändert');
      expect(text(d('booking-label'))).toBe('4670 Reisekosten Unternehmer');
    });
  });

  describe('download', () => {
    it('links to the print view of this payment', async () => {
      await render('/payments/wd-t3');
      expect(d('download-pdf')!.getAttribute('href')).toBe('/print/payment/wd-t3');
      expect(text(d('download-pdf'))).toBe('Download PDF');
    });
  });

  describe('when the payment is not there', () => {
    const url = () => TestBed.inject(Router).url;

    it('switching business with a payment open returns to the list', async () => {
      await render('/payments/wd-t3');
      expect(detail()).not.toBeNull();
      demo.setBusiness('sara-yoga');
      await settle();
      expect(url()).toBe('/payments');
      expect(detail()).toBeNull();
      expect(q('payments-detail')!.classList).toContain('hidden');
      expect(q('payments-list')!.classList).not.toContain('hidden');
    });

    it('an unknown id goes to the list', async () => {
      await render('/payments/nope');
      expect(url()).toBe('/payments');
      expect(detail()).toBeNull();
    });

    it('the id of another business goes to the list', async () => {
      await render('/payments/sy-t1');
      expect(url()).toBe('/payments');
      expect(detail()).toBeNull();
    });

    it('a client who has not connected a bank yet goes to the list', async () => {
      demo.setSetup('new');
      await render('/payments/wd-t3');
      expect(url()).toBe('/payments');
      expect(detail()).toBeNull();
    });

    it('keeps the open payment when the setup state still has a bank', async () => {
      await render('/payments/wd-t3');
      demo.setSetup('halfway');
      await settle();
      expect(url()).toBe('/payments/wd-t3');
      expect(detail()).not.toBeNull();
    });
  });

  it('reads the open payment again when another one opens', async () => {
    await render('/payments/wd-t3');
    expect(text(d('detail-counterparty'))).toBe('Deutsche Bahn');
    await harness.navigateByUrl('/payments/wd-t4');
    await settle();
    expect(text(d('detail-counterparty'))).toBe('Amazon');
  });
});
