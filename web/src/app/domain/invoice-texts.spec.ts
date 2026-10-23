import { INVOICE_TEXTS, invoiceText } from './invoice-texts';
import type { InvoiceTextKey } from './invoice-texts';

const placeholders = (text: string): string[] => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('invoice texts', () => {
  const keys = Object.keys(INVOICE_TEXTS.de) as InvoiceTextKey[];

  it('German and English have the same keys', () => {
    expect(Object.keys(INVOICE_TEXTS.en).sort()).toEqual([...keys].sort());
    expect(keys.length).toBeGreaterThan(30);
  });

  it('every text is filled in, and German and English use the same placeholders', () => {
    for (const key of keys) {
      expect(INVOICE_TEXTS.de[key].trim(), `de ${key}`).not.toBe('');
      expect(INVOICE_TEXTS.en[key].trim(), `en ${key}`).not.toBe('');
      expect(placeholders(INVOICE_TEXTS.en[key]), key).toEqual(placeholders(INVOICE_TEXTS.de[key]));
    }
  });

  it('the title is Rechnung or Invoice, and a cancellation is a Stornorechnung or a cancellation invoice', () => {
    expect(invoiceText('de', 'title')).toBe('Rechnung');
    expect(invoiceText('en', 'title')).toBe('Invoice');
    expect(invoiceText('de', 'cancellationTitle')).toBe('Stornorechnung');
    expect(invoiceText('en', 'cancellationTitle')).toBe('Cancellation invoice');
  });

  it('a cancellation names the invoice it cancels and its date', () => {
    const params = { number: 'RE-2026-040', date: '1. Oktober 2026' };
    expect(invoiceText('de', 'cancellationRef', params)).toBe('zu Rechnung RE-2026-040 vom 1. Oktober 2026');
    expect(invoiceText('en', 'cancellationRef', { number: 'RE-2026-040', date: '1 October 2026' })).toBe(
      'for invoice RE-2026-040 dated 1 October 2026',
    );
  });

  it('the Kleinunternehmer note is the wording of § 19 UStG, exactly', () => {
    expect(invoiceText('de', 'noteKleinunternehmer')).toBe('Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.');
    expect(invoiceText('en', 'noteKleinunternehmer')).toContain('Section 19 UStG');
  });

  it('the reverse-charge and not-taxable notes', () => {
    expect(invoiceText('de', 'noteReverseCharge')).toBe('Steuerschuldnerschaft des Leistungsempfängers');
    expect(invoiceText('de', 'noteNotTaxable')).toBe('Nicht im Inland steuerbare Leistung');
    expect(invoiceText('en', 'noteReverseCharge')).toMatch(/^Reverse charge/);
    expect(invoiceText('en', 'noteNotTaxable')).toBe('Service not taxable in Germany');
  });

  it('the payment line names the due date and the IBAN, or only the date when there is no IBAN', () => {
    const params = { date: '30. Oktober 2026', iban: 'DE08 1001 0101 0482 9136 50' };
    expect(invoiceText('de', 'paymentLine', params)).toBe(
      'Bitte überweisen Sie den Betrag bis zum 30. Oktober 2026 auf das Konto DE08 1001 0101 0482 9136 50.',
    );
    expect(invoiceText('en', 'paymentLine', { date: '30 October 2026', iban: 'DE08 1001' })).toBe(
      'Please transfer the amount by 30 October 2026 to the account DE08 1001.',
    );
    expect(invoiceText('de', 'paymentLineNoIban', { date: '30. Oktober 2026' })).toBe('Bitte überweisen Sie den Betrag bis zum 30. Oktober 2026.');
    expect(invoiceText('en', 'paymentLineNoIban', { date: '30 October 2026' })).toBe('Please transfer the amount by 30 October 2026.');
  });

  it('the VAT line takes the rate', () => {
    expect(invoiceText('de', 'vat', { rate: 19 })).toBe('Umsatzsteuer 19 %');
    expect(invoiceText('en', 'vat', { rate: 7 })).toBe('VAT 7 %');
  });

  it('names the units', () => {
    expect(invoiceText('de', 'unitHour')).toBe('Std.');
    expect(invoiceText('en', 'unitHour')).toBe('h');
    expect(invoiceText('de', 'unitFlat')).toBe('pauschal');
    expect(invoiceText('en', 'unitFlat')).toBe('flat rate');
  });

  it('leaves a placeholder alone when no value is given for it', () => {
    expect(invoiceText('de', 'cancellationRef', { number: 'RE-2026-040' })).toBe('zu Rechnung RE-2026-040 vom {date}');
  });

  describe('emails', () => {
    const params = { number: 'RE-2026-045', amount: '2.380,00 €', date: '30. Oktober 2026', name: 'Studio Kern' };

    it('the invoice email: subject "Rechnung RE-2026-045", a body with the amount and the date', () => {
      expect(invoiceText('de', 'emailInvoiceSubject', params)).toBe('Rechnung RE-2026-045');
      expect(invoiceText('en', 'emailInvoiceSubject', params)).toBe('Invoice RE-2026-045');
      const body = invoiceText('de', 'emailInvoiceBody', params);
      for (const part of ['Studio Kern', 'RE-2026-045', '2.380,00 €', '30. Oktober 2026']) expect(body).toContain(part);
    });

    it('the friendly reminder asks for payment within 7 days and names the invoice', () => {
      expect(invoiceText('de', 'emailReminderSubject', params)).toBe('Zahlungserinnerung zu Rechnung RE-2026-045');
      expect(invoiceText('en', 'emailReminderSubject', params)).toBe('Payment reminder for invoice RE-2026-045');
      expect(invoiceText('de', 'emailReminderBody', params)).toContain('7 Tagen');
      expect(invoiceText('en', 'emailReminderBody', params)).toContain('7 days');
    });

    it('the formal reminder is a Mahnung that gives a new date and mentions that interest may be charged', () => {
      expect(invoiceText('de', 'emailFormalSubject', params)).toBe('Mahnung zu Rechnung RE-2026-045');
      expect(invoiceText('en', 'emailFormalSubject', params)).toBe('Formal reminder for invoice RE-2026-045');
      expect(invoiceText('de', 'emailFormalBody', params)).toContain('Verzugszinsen');
      expect(invoiceText('en', 'emailFormalBody', params)).toContain('late-payment interest');
      expect(invoiceText('de', 'emailFormalBody', params)).toContain('30. Oktober 2026');
    });

    it('every email is filled in completely when given all four values, in both languages', () => {
      for (const lang of ['de', 'en'] as const) {
        for (const key of ['emailInvoiceSubject', 'emailInvoiceBody', 'emailReminderSubject', 'emailReminderBody', 'emailFormalSubject', 'emailFormalBody'] as const) {
          const text = invoiceText(lang, key, params);
          expect(text, `${lang} ${key}`).not.toMatch(/[{}]/);
          expect(text, `${lang} ${key}`).toContain('RE-2026-045');
        }
      }
    });

    it('the email bodies use the formal address in German', () => {
      for (const key of ['emailInvoiceBody', 'emailReminderBody', 'emailFormalBody'] as const) {
        const text = invoiceText('de', key, params);
        expect(text, key).toContain('Sie');
        expect(text, key).not.toMatch(/\bdu\b|\bdein/i);
      }
    });
  });
});
