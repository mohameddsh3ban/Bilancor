/**
 * The texts of the invoice itself: the paper, the email that sends it and the two reminders. They are written in German or
 * English only, whatever language the app is in, so they live here and not in the app's translation files.
 * A placeholder like `{number}` is filled in by `invoiceText()`; the person who calls it formats amounts and dates.
 */
const DE = {
  // The paper: titles and labels
  title: 'Rechnung',
  cancellationTitle: 'Stornorechnung',
  cancellationRef: 'zu Rechnung {number} vom {date}', // the invoice it cancels, and its date
  draft: 'Entwurf', // in place of the number while the invoice is a draft
  invoiceNumber: 'Rechnungsnummer',
  invoiceDate: 'Rechnungsdatum',
  serviceDate: 'Leistungsdatum', // the work was done on one day
  servicePeriod: 'Leistungszeitraum', // the work was done during a month
  recipient: 'Rechnungsempfänger',
  taxNumber: 'Steuernummer',
  vatId: 'USt-IdNr.',
  customerVatId: 'USt-IdNr. des Kunden',
  leitwegId: 'Leitweg-ID',
  logoPlaceholder: 'Ihr Logo',
  formatZugferd: 'E-Rechnung (ZUGFeRD)',
  formatXrechnung: 'E-Rechnung (XRechnung)',
  // The paper: the lines and the sums
  colDescription: 'Beschreibung',
  colQuantity: 'Menge',
  colUnitPrice: 'Einzelpreis',
  colAmount: 'Betrag',
  unitPiece: 'Stk.',
  unitHour: 'Std.',
  unitDay: 'Tag(e)',
  unitFlat: 'pauschal',
  net: 'Nettobetrag',
  vat: 'Umsatzsteuer {rate} %',
  total: 'Gesamtbetrag',
  // The paper: what stands in place of VAT
  noteKleinunternehmer: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.',
  noteReverseCharge: 'Steuerschuldnerschaft des Leistungsempfängers',
  noteNotTaxable: 'Nicht im Inland steuerbare Leistung',
  // The paper: how to pay
  paymentLine: 'Bitte überweisen Sie den Betrag bis zum {date} auf das Konto {iban}.',
  paymentLineNoIban: 'Bitte überweisen Sie den Betrag bis zum {date}.',
  thanks: 'Vielen Dank für Ihren Auftrag.',
  // The email that sends the invoice. {name}: the customer; {date}: the due date
  emailInvoiceSubject: 'Rechnung {number}',
  emailInvoiceBody:
    'Guten Tag {name},\n\nvielen Dank für Ihren Auftrag. Im Anhang finden Sie die Rechnung {number} über {amount}.\n\nBitte überweisen Sie den Betrag bis zum {date}.\n\nMit freundlichen Grüßen',
  // The friendly reminder (Zahlungserinnerung). {date}: the day the invoice was due
  emailReminderSubject: 'Zahlungserinnerung zu Rechnung {number}',
  emailReminderBody:
    'Guten Tag {name},\n\nfür unsere Rechnung {number} über {amount} konnten wir bisher keinen Zahlungseingang feststellen. Sie war am {date} fällig. Vielleicht ist die Zahlung nur untergegangen.\n\nBitte überweisen Sie den Betrag innerhalb von 7 Tagen. Zur Sicherheit finden Sie die Rechnung noch einmal im Anhang. Falls Sie bereits gezahlt haben, betrachten Sie diese Nachricht bitte als gegenstandslos.\n\nMit freundlichen Grüßen',
  // The formal reminder (Mahnung). {date}: the new date to pay by
  emailFormalSubject: 'Mahnung zu Rechnung {number}',
  emailFormalBody:
    'Guten Tag {name},\n\ntrotz unserer Zahlungserinnerung ist die Rechnung {number} über {amount} bisher nicht beglichen.\n\nWir bitten Sie, den Betrag bis zum {date} zu überweisen. Die Rechnung finden Sie im Anhang. Bitte beachten Sie, dass bei weiterem Zahlungsverzug Verzugszinsen berechnet werden können.\n\nFalls Sie bereits gezahlt haben, betrachten Sie diese Nachricht bitte als gegenstandslos.\n\nMit freundlichen Grüßen',
};

export type InvoiceTextKey = keyof typeof DE;

const EN: Record<InvoiceTextKey, string> = {
  title: 'Invoice',
  cancellationTitle: 'Cancellation invoice',
  cancellationRef: 'for invoice {number} dated {date}',
  draft: 'Draft',
  invoiceNumber: 'Invoice number',
  invoiceDate: 'Invoice date',
  serviceDate: 'Service date',
  servicePeriod: 'Service period',
  recipient: 'Billed to',
  taxNumber: 'Tax number',
  vatId: 'VAT ID',
  customerVatId: 'Customer VAT ID',
  leitwegId: 'Leitweg ID',
  logoPlaceholder: 'Your logo',
  formatZugferd: 'E-invoice (ZUGFeRD)',
  formatXrechnung: 'E-invoice (XRechnung)',
  colDescription: 'Description',
  colQuantity: 'Quantity',
  colUnitPrice: 'Unit price',
  colAmount: 'Amount',
  unitPiece: 'pcs',
  unitHour: 'h',
  unitDay: 'day(s)',
  unitFlat: 'flat rate',
  net: 'Net amount',
  vat: 'VAT {rate} %',
  total: 'Total',
  noteKleinunternehmer: 'No VAT is charged in accordance with Section 19 UStG (German VAT Act).',
  noteReverseCharge: 'Reverse charge: the recipient of the service is liable for the VAT',
  noteNotTaxable: 'Service not taxable in Germany',
  paymentLine: 'Please transfer the amount by {date} to the account {iban}.',
  paymentLineNoIban: 'Please transfer the amount by {date}.',
  thanks: 'Thank you for your business.',
  emailInvoiceSubject: 'Invoice {number}',
  emailInvoiceBody:
    'Hello {name},\n\nThank you for your business. Please find invoice {number} for {amount} attached.\n\nPlease transfer the amount by {date}.\n\nKind regards',
  emailReminderSubject: 'Payment reminder for invoice {number}',
  emailReminderBody:
    'Hello {name},\n\nwe have not yet received payment for our invoice {number} for {amount}, which was due on {date}. Perhaps the payment was simply overlooked.\n\nPlease transfer the amount within 7 days. For your convenience the invoice is attached again. If you have already paid, please ignore this message.\n\nKind regards',
  emailFormalSubject: 'Formal reminder for invoice {number}',
  emailFormalBody:
    'Hello {name},\n\nDespite our payment reminder, invoice {number} for {amount} is still unpaid.\n\nPlease transfer the amount by {date}. The invoice is attached again. Please note that late-payment interest may be charged if payment is delayed further.\n\nIf you have already paid, please ignore this message.\n\nKind regards',
};

/** Every text of the invoice, by language. Both languages have the same keys (the type says so, and a test checks it). */
export const INVOICE_TEXTS: Record<'de' | 'en', Record<InvoiceTextKey, string>> = { de: DE, en: EN };

/** A text of the invoice in German or English, with each `{placeholder}` replaced; one without a value is left as it is. */
export function invoiceText(lang: 'de' | 'en', key: InvoiceTextKey, params: Record<string, string | number> = {}): string {
  return INVOICE_TEXTS[lang][key].replace(/\{(\w+)\}/g, (placeholder, name: string) =>
    name in params ? String(params[name]) : placeholder,
  );
}
