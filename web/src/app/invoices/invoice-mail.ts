import { formatDate, formatMoney } from '../core/format/format';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Invoice } from '../data/models';
import { addDays } from '../domain/bank-connection';
import { invoiceText, type InvoiceTextKey } from '../domain/invoice-texts';
import {
  REMINDER_GAP_DAYS,
  dueDateOf,
  invoiceFileFormat,
  invoiceTotals,
  leftCents,
  nextInvoiceNumber,
  type InvoiceFormat,
} from '../domain/invoices';

/** What goes to the customer: the invoice itself, the friendly reminder (level 1), or the formal reminder (level 2). */
export type SendKind = 'invoice' | 'reminder1' | 'reminder2';

/** The email as the send step first shows it. The text is written in the language of the invoice, whatever language the app is in. */
export interface InvoiceMail {
  to: string;
  subject: string;
  body: string;
  /** The number the invoice goes out with: its own, or for a draft the one it is given when it is sent. */
  number: string;
  /** What the invoice file is: a plain PDF, a ZUGFeRD PDF with the data inside, or an XRechnung data file next to the PDF. */
  format: InvoiceFormat;
  /** The language of the email, for the reader and the screen reader. */
  lang: 'de' | 'en';
}

const TEXTS: Record<SendKind, { subject: InvoiceTextKey; body: InvoiceTextKey }> = {
  invoice: { subject: 'emailInvoiceSubject', body: 'emailInvoiceBody' },
  reminder1: { subject: 'emailReminderSubject', body: 'emailReminderBody' },
  reminder2: { subject: 'emailFormalSubject', body: 'emailFormalBody' },
};

/**
 * The email that sends an invoice or a reminder for it, ready written. The invoice asks for its gross amount by its due
 * date; the friendly reminder asks for what is still to pay and names the day the invoice was due; the formal reminder
 * asks for it by a new date, `REMINDER_GAP_DAYS` days from `today`. A draft has no number yet: the email carries the one
 * it will be given. Nothing here is sent.
 */
export function invoiceMail(
  kind: SendKind,
  invoice: Invoice,
  business: Business,
  today = DEMO_TODAY,
): InvoiceMail {
  const lang = invoice.language;
  const number = invoice.number ?? nextInvoiceNumber(business, today.slice(0, 4));
  const cents =
    kind === 'invoice'
      ? invoiceTotals(invoice, business.taxProfile).grossCents
      : leftCents(invoice, business);
  const date = kind === 'reminder2' ? addDays(today, REMINDER_GAP_DAYS) : dueDateOf(invoice);
  const params = {
    name: invoice.customer.name,
    number,
    amount: formatMoney(cents, lang),
    date: formatDate(date, lang, { year: true }),
  };
  return {
    to: invoice.customer.email,
    subject: invoiceText(lang, TEXTS[kind].subject, params),
    body: invoiceText(lang, TEXTS[kind].body, params),
    number,
    format: invoiceFileFormat(invoice, business.taxProfile),
    lang,
  };
}
