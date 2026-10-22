import { Lang } from '../../data/models';

const LOCALES: Record<Lang, string> = {
  en: 'en-IE',
  de: 'de-DE',
  ar: 'ar-u-nu-latn',
};

export function formatMoney(
  cents: number,
  lang: Lang,
  opts: { signed?: boolean; whole?: boolean } = {},
): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'EUR',
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
    ...(opts.whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(cents / 100);
}

/**
 * A short day and month ("17 Oct"), with the year ("17 Oct 2026") when `year` is set.
 * Date-only ISO strings parse as UTC midnight, so format in UTC to keep the same calendar day everywhere.
 */
export function formatDate(iso: string, lang: Lang, opts: { year?: boolean } = {}): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    day: 'numeric',
    month: 'short',
    ...(opts.year ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(new Date(iso));
}

/** An IBAN in groups of four, as banks print it. */
export function formatIban(iban: string): string {
  return iban.replace(/(.{4})(?=.)/g, '$1 ');
}

/** The name of a 'YYYY-MM' month with its year, e.g. "October 2026". */
export function formatMonth(month: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${month}-01`));
}
