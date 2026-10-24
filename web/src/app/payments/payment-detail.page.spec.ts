import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { formatDate, formatMoney, formatMonthRange } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { FOUND_ACCOUNTS } from '../data/banks';
import { READING_MS } from '../domain/document-upload';
import { invoiceStatus } from '../domain/invoices';
import { DocumentDetailPage } from '../documents/document-detail.page';
import { DocumentsPage } from '../documents/documents.page';
import { DemoStateService } from '../state/demo-state.service';
import { PaymentDetailPage } from './payment-detail.page';
import { PaymentsPage } from './payments.page';
import ar from '../../../public/i18n/ar.json';
import de from '../../../public/i18n/de.json';
import en from '../../../public/i18n/en.json';

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
          {
            path: 'documents',
            component: DocumentsPage,
            children: [{ path: ':id', component: DocumentDetailPage }],
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

  /** Connects the savings account of Weber Design and puts a payment on it, as the bank flow and a bank fetch would. */
  function onSavings(paymentId: string): void {
    demo.connectAccounts('qonto', FOUND_ACCOUNTS['weber-design']['qonto'], '2026-01-01');
    demo.updateTransaction(paymentId, (t) => ({ ...t, accountId: 'wd-savings' }));
  }

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

    it('names a payment of a savings account by its bank and product, in every language', async () => {
      onSavings('wd-t1');
      await render('/payments/wd-t1');
      expect(text(d('detail-meta'))).toBe('20 Oct · Qonto · Savings');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('detail-meta'))).toBe(`${formatDate('2026-10-20', 'de')} · Qonto · Sparkonto`);
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(d('detail-meta'))).toContain(`Qonto · ${ar.settings.bank.product.savings}`);
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
      expect(text(q('needs-you-count'))).toBe('7');
      await click('confirm-booking');
      expect(status()).toBe('Booked');
      expect(d('confirm-booking')).toBeNull();
      expect(text(q('needs-you-count'))).toBe('6');
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
      expect(text(q('needs-you-count'))).toBe('7');
      await click('no-receipt-needed');
      expect(status()).toBe('Booked');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
      expect(d('no-receipt-needed')).toBeNull();
      expect(d('take-photo')).toBeNull();
      expect(text(q('needs-you-count'))).toBe('6');
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
      expect(text(q('needs-you-count'))).toBe('6');
    });

    it('choosing the category a payment already has changes nothing when it is booked', async () => {
      await render('/payments/wd-t2');
      expect(status()).toBe('Booked');
      const before = historyTexts();
      await choose('Phone');
      expect(historyTexts()).toEqual(before);
      expect(status()).toBe('Booked');
      expect(options()).toHaveLength(0);
    });

    it('choosing the category a payment already has changes nothing when only the receipt is missing', async () => {
      await render('/payments/wd-t3');
      expect(status()).toBe('Receipt missing');
      const before = historyTexts();
      await choose('Travel');
      expect(historyTexts()).toEqual(before);
      expect(status()).toBe('Receipt missing');
    });

    it('choosing the suggested category of a payment that needs confirming confirms it', async () => {
      await render('/payments/wd-t1');
      expect(status()).toBe('Please confirm');
      expect(text(q('needs-you-count'))).toBe('7');
      await choose('Revenue (19% VAT)');
      expect(status()).toBe('Booked');
      expect(d('confirm-booking')).toBeNull();
      expect(historyTexts()[0]).toBe('You confirmed Revenue (19% VAT)');
      expect(historyTexts().filter((t) => t.startsWith('You'))).toHaveLength(1);
      expect(options()).toHaveLength(0);
      expect(text(q('needs-you-count'))).toBe('6');
    });

    it('choosing the suggested category of a payment that needs confirming and has no receipt leaves the receipt to do', async () => {
      await render('/payments/wd-t3');
      demo.updateTransaction('wd-t3', (tx) => ({ ...tx, confirmed: false }));
      await settle();
      expect(status()).toBe('Please confirm');
      await choose('Travel');
      expect(status()).toBe('Receipt missing');
      expect(historyTexts()[0]).toBe('You confirmed Travel');
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
      // A payment with a document, or one that pays an invoice, can't be marked private: Kern's incoming payment has neither,
      // and is made to wait for its confirmation.
      demo.updateTransaction('wd-t19', (t) => ({ ...t, confirmed: false }));
      await render('/payments/wd-t19');
      expect(d('confirm-booking')).not.toBeNull();
      await click('kind-private');
      for (const id of ['change-category', 'confirm-booking', 'no-receipt-needed', 'take-photo']) {
        expect(d(id), id).toBeNull();
      }
      expect(text(d('booking-label'))).toBe('Private deposit · 1890 Privateinlagen');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
    });

    it('clicking the side that is already on adds no history line', async () => {
      await render('/payments/wd-t3');
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

    it('missing receipt: no receipt needed, a photo, a picker for documents, and a self-issued receipt', async () => {
      await render('/payments/wd-t3');
      expect(text(d('receipt-state'))).toBe('Receipt missing');
      expect(d('no-receipt-needed')!.tagName).toBe('BUTTON');
      expect(d('take-photo')!.tagName).toBe('BUTTON');
      expect(text(d('take-photo'))).toBe('Take photo');
      expect(d('take-photo')!.hasAttribute('disabled')).toBe(false);
      expect(d('pick-document')!.tagName).toBe('BUTTON');
      expect(text(d('pick-document'))).toBe('Pick from Documents');
      expect(d('self-receipt')!.getAttribute('href')).toBe('/payments/wd-t3/self-issued');
    });

    it('payment detail offers Write a self-issued receipt for APCOA, not in a closed month', async () => {
      await render('/payments/wd-t20');
      expect(text(d('receipt-state'))).toBe('Receipt missing');
      expect(d('self-receipt')!.tagName).toBe('A');
      expect(d('self-receipt')!.getAttribute('href')).toBe('/payments/wd-t20/self-issued');
      expect(text(d('self-receipt'))).toBe('Write a self-issued receipt (Eigenbeleg)');
      // No undo notice until a receipt was just written.
      expect(d('self-issued-undo')).toBeNull();

      // The same payment dated in a closed month (August is closed) offers none of it.
      demo.updateTransaction('wd-t20', (tx) => ({ ...tx, date: '2026-08-20' }));
      await settle();
      expect(d('self-receipt')).toBeNull();
      expect(d('no-receipt-needed')).toBeNull();
      expect(d('closed-note')).not.toBeNull();
    });

    it('offers the self-issued receipt for money out only: a payment coming in that lacks its receipt has none', async () => {
      demo.updateTransaction('wd-t1', (tx) => ({ ...tx, receipt: 'missing', receiptFile: null }));
      await render('/payments/wd-t1');
      expect(text(d('receipt-state'))).toBe('Receipt missing');
      expect(d('no-receipt-needed')).not.toBeNull();
      expect(d('self-receipt')).toBeNull();
    });

    it('names the self-issued receipt with its German term, Eigenbeleg, outside German', async () => {
      await render('/payments/wd-t3');
      expect(text(d('self-receipt'))).toBe('Write a self-issued receipt (Eigenbeleg)');
      expect(d('self-receipt')!.querySelector('bdi[dir="ltr"]')!.textContent).toBe('Eigenbeleg');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(d('self-receipt'))).toBe(`${ar.payments.detail.receipt.selfIssued} (Eigenbeleg)`);
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('self-receipt'))).toBe('Eigenbeleg erstellen');
      expect(d('self-receipt')!.querySelector('bdi')).toBeNull();
    });

    it('explains the Eigenbeleg when the link is focused', async () => {
      await render('/payments/wd-t3');
      d('self-receipt')!.dispatchEvent(new Event('focus'));
      await new Promise((resolve) => setTimeout(resolve));
      await settle();
      expect(document.body.textContent).toContain(en.terms.eigenbeleg.explain);
    });

    it('a payment that needs no receipt says so', async () => {
      await render('/payments/wd-t15');
      expect(text(d('receipt-state'))).toBe('No receipt needed');
      expect(d('no-receipt-needed')).toBeNull();
    });
  });

  describe('documents', () => {
    // The document list opens in an overlay outside the page, so it is read from the document.
    const options = () =>
      Array.from(
        document.body.querySelectorAll<HTMLElement>('[data-testid="document-picker-option"]'),
      );
    const optionNames = () =>
      options().map((o) => text(o.querySelector('[data-testid="picker-name"]')));
    const inBody = (testId: string) =>
      document.body.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    /** Text without the isolates that keep a name's direction (see PaymentHistory). */
    const plain = (node: Element | null | undefined) =>
      text(node).replaceAll(String.fromCodePoint(0x2068), '').replaceAll(String.fromCodePoint(0x2069), '');
    const doc = (id: string) => demo.documents().find((x) => x.id === id)!;
    const tx = (id: string) => demo.business().transactions.find((t) => t.id === id)!;

    async function pick(name: string): Promise<void> {
      await click('pick-document');
      options()
        .find((o) => text(o).includes(name))!
        .click();
      await settle();
    }

    it('Pick from Documents links Böttcher to wd-t17', async () => {
      await render('/payments/wd-t17');
      expect(status()).toBe('Receipt missing');
      await pick('Böttcher');
      expect(status()).toBe('Booked');
      expect(text(d('receipt-state'))).toBe('boettcher-quittung.pdf');
      expect(d('pick-document')).toBeNull();
      expect(d('no-receipt-needed')).toBeNull();
      expect(plain(d('history-text'))).toBe('You linked the document Böttcher Bürobedarf');
      expect(doc('wd-d4').paymentId).toBe('wd-t17');
      expect(options()).toHaveLength(0);
    });

    it('payment detail Take a photo shows Reading… then the receipt', async () => {
      await render('/payments/wd-t3');
      vi.useFakeTimers();
      try {
        d('take-photo')!.click();
        await settle();
        expect(text(d('take-photo'))).toBe('Reading…');
        expect(d('take-photo')!.hasAttribute('disabled')).toBe(true);
        expect(status()).toBe('Receipt missing');
        TestBed.inject(LanguageService).setLang('de');
        await settle();
        expect(text(d('take-photo'))).toBe(de.payments.detail.receipt.reading);
        expect(text(d('take-photo'))).not.toBe(en.payments.detail.receipt.reading);
        TestBed.inject(LanguageService).setLang('en');
        await settle();

        vi.advanceTimersByTime(READING_MS);
        await settle();
        expect(status()).toBe('Booked');
        expect(text(d('receipt-state'))).toBe('photo-2026-10-22-1.jpg');
        expect(d('take-photo')).toBeNull();
        expect(d('pick-document')).toBeNull();
        expect(d('open-document')!.getAttribute('href')).toBe('/documents/up-1');
        expect(plain(d('history-text'))).toBe('You linked the document Deutsche Bahn');
        expect(doc('up-1')).toMatchObject({ source: 'photo', paymentId: 'wd-t3', reading: false });
      } finally {
        vi.useRealTimers();
      }
    });

    it('a double tap on Take a photo takes one photo', async () => {
      await render('/payments/wd-t3');
      vi.useFakeTimers();
      try {
        const button = d('take-photo')!;
        button.click();
        button.click();
        await settle();
        vi.advanceTimersByTime(READING_MS);
        await settle();
        expect(demo.documents().filter((x) => x.fromUpload).map((x) => x.id)).toEqual(['up-1']);
        expect(tx('wd-t3').history.filter((h) => h.key === 'receiptLinked')).toHaveLength(1);
      } finally {
        vi.useRealTimers();
      }
    });

    it('another payment keeps its own Take a photo while one is being read', async () => {
      await render('/payments/wd-t3');
      vi.useFakeTimers();
      try {
        d('take-photo')!.click();
        await settle();
        await harness.navigateByUrl('/payments/wd-t17');
        await settle();
        expect(text(d('take-photo'))).toBe('Take photo');
        expect(d('take-photo')!.hasAttribute('disabled')).toBe(false);
        vi.advanceTimersByTime(READING_MS);
      } finally {
        vi.useRealTimers();
      }
    });

    it('lists the documents that fit the payment, best match first', async () => {
      await render('/payments/wd-t17');
      await click('pick-document');
      // Druckerei Mayer is the receipt of the sample statement's Volksbank payment: unlinked and received, so it fits any payment out.
      expect(optionNames()).toEqual(['Böttcher Bürobedarf', 'Druckerei Mayer', 'Bürobedarf Schulz']);
    });

    it('the picker offers only received documents for money out', async () => {
      await render('/payments/wd-t3');
      await click('pick-document');
      expect(optionNames()).toEqual(['Bürobedarf Schulz', 'Druckerei Mayer', 'Böttcher Bürobedarf']);
    });

    it('and only sent documents for money in', async () => {
      demo.updateTransaction('wd-t1', (t) => ({ ...t, receipt: 'missing', receiptFile: null }));
      await render('/payments/wd-t1');
      await click('pick-document');
      expect(optionNames()).toEqual(['Studio Kern', 'Bäckerei Lange']);
    });

    it('with no document that fits, says so and offers to add one', async () => {
      demo.updateDocument('wd-d1', (x) => ({ ...x, paymentId: 'wd-t2' }));
      demo.updateDocument('wd-d4', (x) => ({ ...x, paymentId: 'wd-t2' }));
      demo.updateDocument('wd-d8', (x) => ({ ...x, paymentId: 'wd-t2' }));
      await render('/payments/wd-t17');
      await click('pick-document');
      expect(text(inBody('document-picker-empty'))).toContain(
        'No unlinked documents fit this payment',
      );
      expect(inBody('document-picker-add')!.getAttribute('href')).toBe('/documents?add=1');
    });

    it('choosing a document twice writes one history line on each side', async () => {
      await render('/payments/wd-t17');
      await click('pick-document');
      const option = options().find((o) => text(o).includes('Böttcher'))!;
      option.click();
      option.click();
      await settle();
      expect(tx('wd-t17').history.filter((h) => h.key === 'receiptLinked')).toHaveLength(1);
      expect(doc('wd-d4').history.filter((h) => h.key === 'linked')).toHaveLength(1);
      expect(historyTexts().filter((t) => t.startsWith('You linked the document'))).toHaveLength(
        1,
      );
    });

    it('payment shows Pays invoice RE-2026-041', async () => {
      await render('/payments/wd-t1');
      const pays = d('pays-invoice')!;
      expect(plain(pays)).toBe('Pays invoice RE-2026-041');
      expect(pays.getAttribute('href')).toBe('/invoices/inv-wd-041');
      // a payment that pays no invoice says nothing of the kind
      await harness.navigateByUrl('/payments/wd-t2');
      await settle();
      expect(d('pays-invoice')).toBeNull();
    });

    it('a part payment of an invoice shows Pays invoice too, though the invoice document is not linked to it', async () => {
      demo.setBusiness('sara-yoga');
      await render('/payments/sy-t15');
      expect(d('open-document')).toBeNull();
      expect(plain(d('pays-invoice'))).toBe('Pays invoice RE-2026-021');
      expect(d('pays-invoice')!.getAttribute('href')).toBe('/invoices/inv-sy-021');
    });

    it('Pays invoice follows the language, and keeps the number left-to-right', async () => {
      await render('/payments/wd-t1');
      expect(text(d('pays-invoice'))).toContain(String.fromCodePoint(0x2068) + 'RE-2026-041' + String.fromCodePoint(0x2069));
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(plain(d('pays-invoice'))).toBe('Bezahlt die Rechnung RE-2026-041');
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(plain(d('pays-invoice'))).toBe(ar.payments.detail.paysInvoice.replace('{{number}}', 'RE-2026-041'));
    });

    it("picking Studio Kern's document for the Kern payment pays the invoice", async () => {
      await render('/payments/wd-t19');
      expect(status()).toBe('Receipt missing');
      expect(d('pays-invoice')).toBeNull();
      await pick('Studio Kern');
      expect(status()).toBe('Booked');
      expect(text(d('receipt-state'))).toBe('RE-2026-044.pdf');
      expect(plain(d('pays-invoice'))).toBe('Pays invoice RE-2026-044');
      expect(d('pick-document')).toBeNull();
      expect(doc('wd-d2').paymentId).toBe('wd-t19');
      const invoice = demo.business().invoices.find((i) => i.id === 'inv-wd-044')!;
      expect(invoice.paymentIds).toEqual(['wd-t19']);
      expect(invoiceStatus(invoice, demo.business())).toBe('paid');
      expect(historyTexts()[0]).toBe('Pays invoice RE-2026-044');
      expect(d('open-document')!.getAttribute('href')).toBe('/documents/wd-d2');
    });

    it("picking the document of a partly paid invoice adds the payment to what was paid", async () => {
      demo.setBusiness('sara-yoga');
      const part = demo.business().transactions.find((t) => t.id === 'sy-t15')!;
      demo.addTransaction({ ...part, id: 'sy-t90', date: '2026-10-22', receipt: 'missing', receiptFile: null, reference: 'Rest', history: [] });
      await render('/payments/sy-t90');
      await pick('Physio');
      const invoice = demo.business().invoices.find((i) => i.id === 'inv-sy-021')!;
      expect(invoice.paymentIds).toEqual(['sy-t15', 'sy-t90']);
      expect(invoiceStatus(invoice, demo.business())).toBe('paid');
      expect(doc('sy-d2').paymentId).toBe('sy-t90');
      expect(plain(d('pays-invoice'))).toBe('Pays invoice RE-2026-021');
    });

    it('Open document goes to the linked document', async () => {
      await render('/payments/wd-t17');
      expect(d('open-document')).toBeNull();
      await pick('Böttcher');
      const open = d('open-document')!;
      expect(open.getAttribute('href')).toBe('/documents/wd-d4');
      expect(text(open)).toBe('Open document');
      await click('open-document');
      expect(TestBed.inject(Router).url).toBe('/documents/wd-d4');
      const opened = harness.routeNativeElement as HTMLElement;
      expect(text(opened.querySelector('[data-testid="document-detail-name"]'))).toBe(
        'Böttcher Bürobedarf',
      );
    });

    it('Open document is there for a receipt that was attached from the start', async () => {
      await render('/payments/wd-t2');
      expect(d('open-document')!.getAttribute('href')).toBe('/documents/doc-wd-t2');
    });

    it('offers no Open document when no document links to the payment', async () => {
      demo.updateDocument('doc-wd-t2', (x) => ({ ...x, paymentId: null }));
      await render('/payments/wd-t2');
      expect(text(d('receipt-state'))).toBe('telekom-rechnung-oktober.pdf');
      expect(d('open-document')).toBeNull();
      await harness.navigateByUrl('/payments/wd-t3');
      await settle();
      expect(d('open-document')).toBeNull();
      await harness.navigateByUrl('/payments/wd-t15');
      await settle();
      expect(d('open-document')).toBeNull();
    });

    it('takes Open document away again when the document is unlinked', async () => {
      await render('/payments/wd-t17');
      await pick('Böttcher');
      demo.unlink('wd-d4');
      await settle();
      expect(d('open-document')).toBeNull();
      expect(status()).toBe('Receipt missing');
      expect(d('pick-document')).not.toBeNull();
    });

    it("a linked payment can't be marked private", async () => {
      await render('/payments/wd-t17');
      expect(d('private-blocked')).toBeNull();
      expect(d('kind-private')).not.toBeNull();
      await pick('Böttcher');
      expect(text(d('private-blocked'))).toBe('This payment has a document. Unlink it first.');
      expect(d('kind-private')).toBeNull();
      expect(d('kind-business')).toBeNull();

      demo.unlink('wd-d4');
      await settle();
      expect(d('private-blocked')).toBeNull();
      expect(d('kind-private')).not.toBeNull();
      expect(d('kind-business')!.getAttribute('aria-pressed')).toBe('true');
    });

    it('a payment with a receipt from the start is blocked too, in every language', async () => {
      await render('/payments/wd-t2');
      expect(text(d('private-blocked'))).toBe('This payment has a document. Unlink it first.');
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('private-blocked'))).toBe(de.payments.detail.booking.privateBlocked);
      expect(text(d('private-blocked'))).not.toBe(en.payments.detail.booking.privateBlocked);
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(d('private-blocked'))).toBe(ar.payments.detail.booking.privateBlocked);
    });

    it('a payment that no document links to can still be marked private', async () => {
      await render('/payments/wd-t3');
      expect(d('private-blocked')).toBeNull();
      await click('kind-private');
      expect(tx('wd-t3').isPrivate).toBe(true);
    });

    /** What the payment says in its place when it pays an invoice: no switch, and no word about unlinking a document (the invoice's document cannot be unlinked). */
    function expectStaysBusiness(): void {
      expect(text(d('private-blocked'))).toBe('This payment pays an invoice, so it stays business.');
      expect(d('kind-private')).toBeNull();
      expect(d('kind-business')).toBeNull();
    }

    it('a payment that pays all of an invoice stays business, in every language', async () => {
      await render('/payments/wd-t1');
      expect(d('open-document')).not.toBeNull(); // the invoice's document is linked to it, and cannot be unlinked
      expectStaysBusiness();
      TestBed.inject(LanguageService).setLang('de');
      await settle();
      expect(text(d('private-blocked'))).toBe(de.payments.detail.booking.privateBlockedInvoice);
      TestBed.inject(LanguageService).setLang('ar');
      await settle();
      expect(text(d('private-blocked'))).toBe(ar.payments.detail.booking.privateBlockedInvoice);
    });

    it('a part payment of an invoice stays business too, though no document is linked to it', async () => {
      demo.setBusiness('sara-yoga');
      await render('/payments/sy-t15');
      expect(d('open-document')).toBeNull();
      expectStaysBusiness();
      expect(tx('sy-t15')).toMatchObject({ isPrivate: false, receipt: 'attached' });
    });

    it('a payment picked for an invoice stays business from then on', async () => {
      await render('/payments/wd-t19');
      expect(d('kind-private')).not.toBeNull();
      await pick('Studio Kern');
      expectStaysBusiness();
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

    it('travel is taxed at the reduced rate of 7%', async () => {
      await render('/payments/wd-t3');
      expect(text(d('booking-label'))).toBe('Travel · 4670 Reisekosten Unternehmer');
      expect(text(d('booking-vat'))).toBe('7%');
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

    it('an imported payment has no IBAN of the other party, so no empty IBAN row, but keeps its reference', async () => {
      demo.updateTransaction('wd-t2', (t) => ({ ...t, counterpartyIban: '' }));
      await render('/payments/wd-t2');
      expect(d('bank-iban')).toBeNull();
      expect(d('bank-section')!.textContent).not.toContain('IBAN');
      expect(text(d('bank-reference'))).toBe('Rechnung 8841 0712, Mobilfunk Oktober');
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

  describe('a payment in a closed month', () => {
    /** Everything a payment can be changed with: nothing of it is there once its month is closed. */
    const ACTIONS = [
      'change-category',
      'confirm-booking',
      'no-receipt-needed',
      'take-photo',
      'pick-document',
      'self-receipt',
      'kind-business',
      'kind-private',
      'private-blocked',
    ];
    const noActions = () => {
      for (const id of ACTIONS) expect(d(id), id).toBeNull();
    };
    const note = (month: string) => `${month} is closed, so this payment can't be changed.`;

    it('a September payment at Weber Design has no actions and says September is closed', async () => {
      await render('/payments/wd-t10');
      noActions();
      expect(text(d('closed-note'))).toBe(note('September'));
      expect(d('closed-note')!.querySelector('bdi')!.textContent).toBe('September');
      // It keeps everything it shows.
      expect(text(d('detail-counterparty'))).toBe('Telekom');
      expect(text(d('detail-amount'))).toBe(formatMoney(-3995, 'en', { signed: true }));
      expect(text(d('detail-meta'))).toBe(`${formatDate('2026-09-22', 'en')} · Qonto`);
      expect(status()).toBe('Booked');
      expect(text(d('receipt-state'))).not.toBe('');
      expect(text(d('booking-label'))).toBe('Phone & internet · 4920 Telefon');
      expect(text(d('booking-vat'))).toBe('19%');
      expect(text(d('bank-iban'))).toBe('DE12 3705 0198 0012 3456 01');
      expect(text(d('bank-reference'))).toBe('Rechnung 8841 0689, Mobilfunk September');
      expect(historyTexts().length).toBeGreaterThan(0);
      expect(d('download-pdf')).not.toBeNull();
    });

    it('a payment in a closed month that lacks its receipt says so, with no way to add one', async () => {
      demo.updateTransaction('wd-t14', (tx) => ({
        ...tx,
        receipt: 'missing',
        receiptFile: null,
        confirmed: false,
      }));
      await render('/payments/wd-t14');
      expect(text(d('closed-note'))).toBe(note('August'));
      expect(text(d('receipt-state'))).toBe('Receipt missing');
      expect(text(d('receipt-section'))).not.toContain(en.payments.detail.receipt.missingHint);
      noActions();
    });

    it('a private payment loses its Business / Private switch with its month, and says what it is', async () => {
      demo.updateTransaction('wd-t15', (tx) => ({ ...tx, date: '2026-10-14' }));
      await render('/payments/wd-t15');
      expect(d('kind-private')).not.toBeNull();
      expect(d('closed-note')).toBeNull();
      demo.updateTransaction('wd-t15', (tx) => ({ ...tx, date: '2026-08-14' }));
      await settle();
      noActions();
      expect(text(d('closed-note'))).toBe(note('August'));
      expect(text(d('booking-label'))).toBe('Private withdrawal · 1800 Privatentnahmen allgemein');
    });

    it('a payment of an invoice keeps its links to the invoice and to the document', async () => {
      // Müller's payment of 26 Sep pays an invoice written in Invoices: both links only open a page.
      await render('/payments/wd-t9');
      noActions();
      expect(d('pays-invoice')).not.toBeNull();
      expect(d('open-document')).not.toBeNull();
    });

    it('an October payment still has its actions', async () => {
      await render('/payments/wd-t3');
      expect(d('closed-note')).toBeNull();
      for (const id of ACTIONS.filter(
        (id) => !['confirm-booking', 'private-blocked'].includes(id),
      )) {
        expect(d(id), id).not.toBeNull();
      }
      await harness.navigateByUrl('/payments/wd-t1');
      await settle();
      expect(d('closed-note')).toBeNull();
      expect(d('confirm-booking')).not.toBeNull();
    });

    it('closing September at Sara Weber Yoga takes the actions off its payments', async () => {
      demo.setBusiness('sara-yoga');
      await render('/payments/sy-t10');
      expect(d('closed-note')).toBeNull();
      expect(d('change-category')).not.toBeNull();
      expect(d('private-blocked')).not.toBeNull(); // its receipt is a document, so it can't be marked private
      expect(demo.closeMonth('2026-09')).toBe(true);
      await settle();
      noActions();
      expect(text(d('closed-note'))).toBe(note('September'));
      expect(text(d('detail-counterparty'))).toBe('Raumhaus Berlin');
      // October stays open.
      await harness.navigateByUrl('/payments/sy-t2');
      await settle();
      expect(d('closed-note')).toBeNull();
      expect(d('confirm-booking')).not.toBeNull();
    });

    it('a payment dated in the earlier months is closed too', async () => {
      demo.updateTransaction('wd-t14', (tx) => ({ ...tx, date: '2026-07-10' }));
      await render('/payments/wd-t14');
      expect(text(d('closed-note'))).toBe(note('July'));
      noActions();
    });

    it('names the month in the language of the page, set apart from the sentence around it', async () => {
      await render('/payments/wd-t10');
      const lang = TestBed.inject(LanguageService);
      lang.setLang('de');
      await settle();
      expect(text(d('closed-note'))).toBe(
        de.payments.closedNote.replace('{{month}}', formatMonthRange('2026-09', '2026-09', 'de')),
      );
      expect(text(d('closed-note'))).toContain('September');
      lang.setLang('ar');
      await settle();
      const arabic = formatMonthRange('2026-09', '2026-09', 'ar');
      expect(text(d('closed-note'))).toBe(ar.payments.closedNote.replace('{{month}}', arabic));
      expect(d('closed-note')!.querySelector('bdi')!.textContent).toBe(arabic);
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
