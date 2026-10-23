import { TestBed } from '@angular/core/testing';
import { formatDate, formatMoney } from '../core/format/format';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import type { Business, Invoice } from '../data/models';
import { DemoStateService } from '../state/demo-state.service';
import { InvoicePaper } from './invoice-paper';

describe('InvoicePaper', () => {
  let demo: DemoStateService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    demo = TestBed.inject(DemoStateService);
  });

  afterEach(() => {
    TestBed.inject(LanguageService).setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  /** An invoice of the open business, by its number. */
  const invoiceOf = (number: string): Invoice =>
    demo.business().invoices.find((invoice) => invoice.number === number)!;

  function render(invoice: Invoice, business: Business = demo.business()): HTMLElement {
    const fixture = TestBed.createComponent(InvoicePaper);
    fixture.componentRef.setInput('invoice', invoice);
    fixture.componentRef.setInput('business', business);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  /** The words of a node on one line (a no-break space is a space). */
  const text = (node: Element | null | undefined) =>
    node?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  /** What its parts say, each part on its own, so a label and its value never run into one word. */
  const parts = (node: Element | null | undefined) =>
    Array.from(node?.children ?? [])
      .map((child) => text(child))
      .join(' ');
  const q = (el: HTMLElement, testId: string) =>
    el.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
  const qa = (el: HTMLElement, testId: string) =>
    Array.from(el.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`));
  const headers = (el: HTMLElement) =>
    Array.from(q(el, 'paper-lines')!.querySelectorAll('th')).map((th) => text(th));
  /** An amount as the paper prints it in this language, as one line of words. */
  const money = (cents: number, lang: 'de' | 'en') => formatMoney(cents, lang).replace(/\s+/g, ' ');

  it('the paper shows seller, customer, lines, VAT 19 % and total for RE-2026-044', () => {
    const el = render(invoiceOf('RE-2026-044'));

    expect(parts(q(el, 'paper-seller'))).toBe(
      'Weber Design Lindenstr. 5 10969 Berlin weber-design@invoices.example',
    );
    expect(text(q(el, 'paper-logo'))).toBe('Ihr Logo');
    expect(parts(q(el, 'paper-customer'))).toBe(
      'Rechnungsempfänger Studio Kern Torstr. 112 10119 Berlin Deutschland',
    );
    expect(text(q(el, 'paper-title'))).toBe('Rechnung');
    expect(parts(q(el, 'paper-number'))).toBe('Rechnungsnummer RE-2026-044');
    expect(parts(q(el, 'paper-date'))).toBe(
      `Rechnungsdatum ${formatDate('2026-10-16', 'de', { year: true })}`,
    );
    expect(parts(q(el, 'paper-service'))).toBe('Leistungszeitraum Oktober 2026');

    const lines = qa(el, 'paper-line');
    expect(lines.map((line) => parts(line))).toEqual([
      `Corporate Design, Konzept 1 pauschal ${money(115000, 'de')} ${money(115000, 'de')}`,
      `Umsetzung Website 10 Std. ${money(8500, 'de')} ${money(85000, 'de')}`,
    ]);
    expect(headers(el)).toEqual(['Beschreibung', 'Menge', 'Einzelpreis', 'Betrag']);

    expect(parts(q(el, 'paper-net'))).toBe(`Nettobetrag ${money(200000, 'de')}`);
    expect(parts(q(el, 'paper-vat'))).toBe(`Umsatzsteuer 19 % ${money(38000, 'de')}`);
    expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(238000, 'de')}`);
    expect(money(238000, 'de')).toBe('2.380,00 €');
    expect(q(el, 'paper-note')).toBeNull();

    expect(text(q(el, 'paper-payment'))).toBe(
      `Bitte überweisen Sie den Betrag bis zum ${formatDate('2026-10-30', 'de', { year: true })} auf das Konto DE08 1001 0101 0482 9136 50.`,
    );
    expect(text(q(el, 'paper-thanks'))).toBe('Vielen Dank für Ihren Auftrag.');
    expect(text(q(el, 'paper-tax-ids'))).toBe('Steuernummer 27/123/45678');
    expect(text(q(el, 'paper-format'))).toBe('E-Rechnung (ZUGFeRD)');
  });

  it('shows the quantity with the German or English words for the unit, and a work date as a service date', () => {
    const invoice: Invoice = {
      ...invoiceOf('RE-2026-044'),
      lines: [
        { description: 'Workshop', quantity: 1.5, unit: 'day', unitPriceCents: 60000 },
        { description: 'Material', quantity: 3, unit: 'piece', unitPriceCents: 1250 },
      ],
      servicePeriod: { kind: 'date', date: '2026-10-10' },
    };
    const el = render(invoice);
    expect(qa(el, 'paper-line').map((line) => parts(line))).toEqual([
      `Workshop 1,5 Tag(e) ${money(60000, 'de')} ${money(90000, 'de')}`,
      `Material 3 Stk. ${money(1250, 'de')} ${money(3750, 'de')}`,
    ]);
    expect(parts(q(el, 'paper-service'))).toBe(
      `Leistungsdatum ${formatDate('2026-10-10', 'de', { year: true })}`,
    );
  });

  it('a KU invoice shows the § 19 note and no VAT', () => {
    demo.setBusiness('sara-yoga');
    const invoice = invoiceOf('RE-2026-016');
    const el = render(invoice);

    expect(text(q(el, 'paper-note'))).toBe('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
    expect(q(el, 'paper-vat')).toBeNull();
    expect(q(el, 'paper-net')).toBeNull();
    expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(96000, 'de')}`);
    expect(qa(el, 'paper-line').map((line) => parts(line))).toEqual([
      `Yogakurse September, 8 Einheiten 8 Stk. ${money(12000, 'de')} ${money(96000, 'de')}`,
    ]);
    expect(text(q(el, 'paper-tax-ids'))).toBe(
      `Steuernummer ${demo.business().taxProfile.taxNumber}`,
    );
    // A Kleinunternehmer sends a plain PDF.
    expect(q(el, 'paper-format')).toBeNull();
  });

  describe('a customer abroad', () => {
    const french = (invoice: Invoice, language: 'de' | 'en' = 'de'): Invoice => ({
      ...invoice,
      language,
      customer: {
        ...invoice.customer,
        name: 'Atelier Lumière SARL',
        street: '12 rue des Lilas',
        postcode: '75011',
        city: 'Paris',
        country: 'FR',
        vatId: 'FR12345678901',
      },
      vatRate: 0,
      taxNote: 'reverseCharge',
    });

    it("reverse charge note and the customer's VAT ID", () => {
      const el = render(french(invoiceOf('RE-2026-044')));
      expect(text(q(el, 'paper-note'))).toBe('Steuerschuldnerschaft des Leistungsempfängers');
      expect(parts(q(el, 'paper-customer'))).toBe(
        'Rechnungsempfänger Atelier Lumière SARL 12 rue des Lilas 75011 Paris Frankreich USt-IdNr. des Kunden FR12345678901',
      );
      expect(q(el, 'paper-vat')).toBeNull();
      expect(parts(q(el, 'paper-net'))).toBe(`Nettobetrag ${money(200000, 'de')}`);
      expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(200000, 'de')}`);
      // Invoices abroad are plain PDFs.
      expect(q(el, 'paper-format')).toBeNull();
    });

    it('says it in English, with the country in English', () => {
      const el = render(french(invoiceOf('RE-2026-044'), 'en'));
      expect(text(q(el, 'paper-note'))).toBe(
        'Reverse charge: the recipient of the service is liable for the VAT',
      );
      expect(parts(q(el, 'paper-customer'))).toContain('France');
      expect(parts(q(el, 'paper-customer'))).toContain('Customer VAT ID FR12345678901');
    });

    it('a business outside the EU gets the "not taxable" note and no VAT', () => {
      const invoice: Invoice = {
        ...french(invoiceOf('RE-2026-044')),
        customer: { ...french(invoiceOf('RE-2026-044')).customer, country: 'GB', vatId: null },
        taxNote: 'notTaxable',
      };
      const el = render(invoice);
      expect(text(q(el, 'paper-note'))).toBe('Nicht im Inland steuerbare Leistung');
      expect(parts(q(el, 'paper-customer'))).toContain('Vereinigtes Königreich');
      expect(parts(q(el, 'paper-customer'))).not.toContain('USt-IdNr.');
      expect(q(el, 'paper-vat')).toBeNull();
    });
  });

  it('xrechnung line with Leitweg-ID for the Pankow draft', () => {
    const el = render(demo.business().invoices.find((invoice) => invoice.id === 'inv-wd-draft')!);
    expect(parts(q(el, 'paper-customer'))).toBe(
      'Rechnungsempfänger Bezirksamt Pankow Rathausstr. 3 13187 Berlin Deutschland',
    );
    // A draft has no number yet: the paper says so in its place.
    expect(parts(q(el, 'paper-number'))).toBe('Rechnungsnummer Entwurf');
    expect(text(q(el, 'paper-format'))).toBe('E-Rechnung (XRechnung) · Leitweg-ID 11001-01234-56');
    expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(416500, 'de')}`);
  });

  it('shows no Leitweg-ID on an invoice that is not an XRechnung', () => {
    const invoice = {
      ...invoiceOf('RE-2026-044'),
      customer: { ...invoiceOf('RE-2026-044').customer, leitwegId: '99-1234' },
    };
    expect(text(q(render(invoice), 'paper-format'))).toBe('E-Rechnung (ZUGFeRD)');
  });

  it('english invoice texts', () => {
    const el = render({ ...invoiceOf('RE-2026-044'), language: 'en' });

    expect(q(el, 'invoice-paper')!.getAttribute('lang')).toBe('en');
    expect(text(q(el, 'paper-logo'))).toBe('Your logo');
    expect(parts(q(el, 'paper-customer'))).toBe(
      'Billed to Studio Kern Torstr. 112 10119 Berlin Germany',
    );
    expect(text(q(el, 'paper-title'))).toBe('Invoice');
    expect(parts(q(el, 'paper-number'))).toBe('Invoice number RE-2026-044');
    expect(parts(q(el, 'paper-date'))).toBe(
      `Invoice date ${formatDate('2026-10-16', 'en', { year: true })}`,
    );
    expect(parts(q(el, 'paper-service'))).toBe('Service period October 2026');
    expect(headers(el)).toEqual(['Description', 'Quantity', 'Unit price', 'Amount']);
    expect(qa(el, 'paper-line').map((line) => parts(line))).toEqual([
      `Corporate Design, Konzept 1 flat rate ${money(115000, 'en')} ${money(115000, 'en')}`,
      `Umsetzung Website 10 h ${money(8500, 'en')} ${money(85000, 'en')}`,
    ]);
    expect(parts(q(el, 'paper-net'))).toBe(`Net amount ${money(200000, 'en')}`);
    expect(parts(q(el, 'paper-vat'))).toBe(`VAT 19 % ${money(38000, 'en')}`);
    expect(parts(q(el, 'paper-total'))).toBe(`Total ${money(238000, 'en')}`);
    expect(money(238000, 'en')).toBe('€2,380.00');
    expect(text(q(el, 'paper-payment'))).toBe(
      `Please transfer the amount by ${formatDate('2026-10-30', 'en', { year: true })} to the account DE08 1001 0101 0482 9136 50.`,
    );
    expect(text(q(el, 'paper-thanks'))).toBe('Thank you for your business.');
    expect(text(q(el, 'paper-tax-ids'))).toBe('Tax number 27/123/45678');
    expect(text(q(el, 'paper-format'))).toBe('E-invoice (ZUGFeRD)');
  });

  it('prints the VAT ID of the seller next to the tax number, when there is one', () => {
    const business: Business = {
      ...demo.business(),
      taxProfile: { ...demo.business().taxProfile, vatId: 'DE123456789' },
    };
    const el = render(invoiceOf('RE-2026-044'), business);
    expect(text(q(el, 'paper-tax-ids'))).toBe('Steuernummer 27/123/45678 · USt-IdNr. DE123456789');
  });

  it('pays to no account when the business has no IBAN yet', () => {
    const business: Business = {
      ...demo.business(),
      invoiceProfile: { ...demo.business().invoiceProfile, iban: null },
    };
    const el = render(invoiceOf('RE-2026-044'), business);
    expect(text(q(el, 'paper-payment'))).toBe(
      `Bitte überweisen Sie den Betrag bis zum ${formatDate('2026-10-30', 'de', { year: true })}.`,
    );
  });

  describe('a cancellation invoice', () => {
    it('is titled Stornorechnung and names the original with its number and date; negative amounts; nothing to pay', () => {
      const el = render(invoiceOf('RE-2026-042'));
      expect(text(q(el, 'paper-title'))).toBe('Stornorechnung');
      expect(text(q(el, 'paper-cancellation'))).toBe(
        `zu Rechnung RE-2026-040 vom ${formatDate('2026-10-01', 'de', { year: true })}`,
      );
      expect(parts(q(el, 'paper-number'))).toBe('Rechnungsnummer RE-2026-042');
      expect(qa(el, 'paper-line').map((line) => parts(line))).toEqual([
        `Design-Beratung -2 Std. ${money(8000, 'de')} ${money(-16000, 'de')}`,
        `Logo-Überarbeitung -1 pauschal ${money(34000, 'de')} ${money(-34000, 'de')}`,
      ]);
      expect(parts(q(el, 'paper-net'))).toBe(`Nettobetrag ${money(-50000, 'de')}`);
      expect(parts(q(el, 'paper-vat'))).toBe(`Umsatzsteuer 19 % ${money(-9500, 'de')}`);
      expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(-59500, 'de')}`);
      expect(q(el, 'paper-payment')).toBeNull();
      expect(q(el, 'paper-thanks')).toBeNull();
    });

    it('an ordinary invoice has no reference to another one', () => {
      expect(q(render(invoiceOf('RE-2026-044')), 'paper-cancellation')).toBeNull();
      expect(text(q(render(invoiceOf('RE-2026-040')), 'paper-title'))).toBe('Rechnung');
    });
  });

  it('a sent invoice keeps the VAT and format it was sent with, whatever the tax details say now', () => {
    const business: Business = {
      ...demo.business(),
      taxProfile: { ...demo.business().taxProfile, kleinunternehmer: true },
    };
    const el = render(invoiceOf('RE-2026-044'), business);
    expect(parts(q(el, 'paper-vat'))).toBe(`Umsatzsteuer 19 % ${money(38000, 'de')}`);
    expect(q(el, 'paper-note')).toBeNull();
    expect(text(q(el, 'paper-format'))).toBe('E-Rechnung (ZUGFeRD)');
  });

  describe('left to right, in the language of the invoice', () => {
    it('the paper is ltr in Arabic', () => {
      TestBed.inject(LanguageService).setLang('ar');
      expect(document.documentElement.dir).toBe('rtl');
      const el = render(invoiceOf('RE-2026-044'));
      const paper = q(el, 'invoice-paper')!;
      expect(paper.getAttribute('dir')).toBe('ltr');
      expect(paper.getAttribute('lang')).toBe('de');
      // The words are the invoice's, not the app's.
      expect(text(q(el, 'paper-title'))).toBe('Rechnung');
      expect(text(q(el, 'paper-logo'))).toBe('Ihr Logo');
      expect(text(q(el, 'paper-customer'))).toContain('Deutschland');
      expect(parts(q(el, 'paper-total'))).toBe(`Gesamtbetrag ${money(238000, 'de')}`);
    });

    it('is ltr in every language, with the language of the invoice', () => {
      for (const lang of ['en', 'de'] as const) {
        const paper = q(render({ ...invoiceOf('RE-2026-044'), language: lang }), 'invoice-paper')!;
        expect(paper.getAttribute('dir')).toBe('ltr');
        expect(paper.getAttribute('lang')).toBe(lang);
      }
    });
  });
});
