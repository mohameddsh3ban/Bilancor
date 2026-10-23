import { formatIban } from '../core/format/format';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, InvoiceProfile } from '../data/models';
import { nextInvoiceNumber } from '../domain/invoices';

/** The payment terms the choice offers, in days. */
export const PAYMENT_TERMS = [7, 14, 30] as const;

/** What "Invoice details" holds while it is filled in: every field as typed or chosen so far. */
export interface InvoiceDraft {
  name: string;
  street: string;
  postcode: string;
  city: string;
  /** The IBAN as typed, with or without spaces; empty for no account on the invoices. */
  iban: string;
  numberPattern: string;
  paymentTermDays: number;
  language: InvoiceProfile['language'];
}

/** The fields an error can belong to. */
export type InvoiceQuestion = 'iban' | 'pattern';
/** The translation key of the message for each field that cannot be saved as it stands. */
export type InvoiceErrors = Partial<Record<InvoiceQuestion, string>>;

/** The form showing saved details. */
export function draftOf(profile: InvoiceProfile): InvoiceDraft {
  return {
    name: profile.name,
    street: profile.street,
    postcode: profile.postcode,
    city: profile.city,
    iban: profile.iban === null ? '' : formatIban(profile.iban),
    numberPattern: profile.numberPattern,
    paymentTermDays: profile.paymentTermDays,
    language: profile.language,
  };
}

/** An IBAN as it is stored and compared: no spaces, upper-case. */
export function normalizeIban(iban: string): string {
  return iban.replace(/\s/g, '').toUpperCase();
}

/**
 * Whether text is shaped like an IBAN (spaces and case do not count): two letters, two digits and 11 to 30 letters or
 * digits, and a German one is DE and 20 digits. The check digits are not calculated, so an invented IBAN passes.
 */
export function isIban(text: string): boolean {
  const iban = normalizeIban(text);
  return iban.startsWith('DE') ? /^DE\d{20}$/.test(iban) : /^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(iban);
}

/**
 * The translation key of what is wrong with a number pattern, or null when it can be used: the running number `{NNN}`
 * must be in it (without it every invoice would get the same number), and `{YYYY}`, the year, is the only other thing
 * that may sit in curly brackets.
 */
export function patternError(pattern: string): string | null {
  const text = pattern.trim();
  if (!text.includes('{NNN}')) return 'invoiceDetails.pattern.errorNumber';
  return /[{}]/.test(text.replaceAll('{NNN}', '').replaceAll('{YYYY}', ''))
    ? 'invoiceDetails.pattern.errorBraces'
    : null;
}

/** The words for a payment term: its own key for the terms of the choice, a general one for any other. */
export function termKey(days: number): string {
  return (PAYMENT_TERMS as readonly number[]).includes(days)
    ? `invoiceDetails.term.d${days}`
    : 'invoiceDetails.term.other';
}

/** The number the next invoice of the business gets this year: in its pattern, or in `pattern` when that is what is typed. */
export function nextNumberFor(
  business: Business,
  pattern: string = business.invoiceProfile.numberPattern,
): string {
  const profile = { ...business.invoiceProfile, numberPattern: pattern };
  return nextInvoiceNumber({ ...business, invoiceProfile: profile }, DEMO_TODAY.slice(0, 4));
}

/**
 * What can be saved from the form: the invoice details (`current` supplies the sender email, which is not edited here),
 * or the fields that are not right. The text is trimmed and the IBAN stored without spaces, upper-cased; no IBAN is
 * fine (none is printed), and so is an empty name or address (the checklist of a new invoice says what is missing).
 */
export function validateDraft(
  draft: InvoiceDraft,
  current: InvoiceProfile,
): { profile: InvoiceProfile } | { errors: InvoiceErrors } {
  const errors: InvoiceErrors = {};

  const iban = normalizeIban(draft.iban);
  if (iban !== '' && !isIban(iban)) errors.iban = 'invoiceDetails.iban.error';

  const pattern = patternError(draft.numberPattern);
  if (pattern !== null) errors.pattern = pattern;

  if (Object.keys(errors).length > 0) return { errors };
  return {
    profile: {
      ...current,
      name: draft.name.trim(),
      street: draft.street.trim(),
      postcode: draft.postcode.trim(),
      city: draft.city.trim(),
      iban: iban === '' ? null : iban,
      numberPattern: draft.numberPattern.trim(),
      paymentTermDays: draft.paymentTermDays,
      language: draft.language,
    },
  };
}
