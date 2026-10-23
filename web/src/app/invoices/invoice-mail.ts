import { formatDate, formatMoney } from '../core/format/format';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, Invoice } from '../data/models';
import { addDays } from '../domain/bank-connection';
import { invoiceText, type InvoiceTextKey } from '../domain/invoice-texts';
import {
  dueDateOf,
  invoiceFileFormat,
  invoiceTotals,
  leftCents,
  nextInvoiceNumber,
  paidCents,
  type InvoiceFormat,
} from '../domain/invoices';

/** How many days the formal reminder (Mahnung) gives to pay: its new date is this many days from the day it is sent. */
export const FORMAL_REMINDER_DAYS = 7;

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

/** The texts of each email; a reminder has a second body for an invoice that is part paid, which does not say that nothing came in. */
const TEXTS: Record<SendKind, { subject: InvoiceTextKey; body: InvoiceTextKey; bodyPartly?: InvoiceTextKey }> = {
  invoice: { subject: 'emailInvoiceSubject', body: 'emailInvoiceBody' },
  reminder1: { subject: 'emailReminderSubject', body: 'emailReminderBody', bodyPartly: 'emailReminderBodyPartly' },
  reminder2: { subject: 'emailFormalSubject', body: 'emailFormalBody', bodyPartly: 'emailFormalBodyPartly' },
};

/**
 * The email that sends an invoice or a reminder for it, ready written. The invoice asks for its gross amount by its due
 * date; the friendly reminder asks for what is still to pay and names the day the invoice was due; the formal reminder
 * asks for it by a new date, `FORMAL_REMINDER_DAYS` days from `today`. For an invoice that is part paid a reminder says
 * what the whole invoice was and what is still open (never that nothing came in); for one nobody paid on, the invoice's
 * amount is what is open. A draft has no number yet: the email carries the one it will be given. Nothing here is sent.
 */
export function invoiceMail(
  kind: SendKind,
  invoice: Invoice,
  business: Business,
  today = DEMO_TODAY,
): InvoiceMail {
  const lang = invoice.language;
  const number = invoice.number ?? nextInvoiceNumber(business, today.slice(0, 4));
  const total = formatMoney(invoiceTotals(invoice, business.taxProfile).grossCents, lang);
  const date = kind === 'reminder2' ? addDays(today, FORMAL_REMINDER_DAYS) : dueDateOf(invoice);
  const params = {
    name: invoice.customer.name,
    number,
    amount: total,
    total,
    left: formatMoney(leftCents(invoice, business), lang),
    date: formatDate(date, lang, { year: true }),
  };
  const texts = TEXTS[kind];
  const body = paidCents(invoice, business) > 0 ? (texts.bodyPartly ?? texts.body) : texts.body;
  return {
    to: invoice.customer.email,
    subject: invoiceText(lang, texts.subject, params),
    body: invoiceText(lang, body, params),
    number,
    format: invoiceFileFormat(invoice, business.taxProfile),
    lang,
  };
}
