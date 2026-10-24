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

/** A number with the separators of the language and at most `maxDecimals` decimals (two unless told otherwise): a quantity such as 1,5. */
export function formatNumber(value: number, lang: Lang, maxDecimals = 2): string {
  return new Intl.NumberFormat(LOCALES[lang], { maximumFractionDigits: maxDecimals }).format(value);
}

/** The name of a country (ISO 3166 alpha-2) in the language. A code that cannot be named is given back as it is; no code gives nothing. */
export function countryName(code: string, lang: Lang): string {
  if (code === '') return '';
  try {
    return new Intl.DisplayNames([LOCALES[lang]], { type: 'region' }).of(code) ?? code;
  } catch {
    return code; // not a region code at all
  }
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

/**
 * The names of the months from `first` to `last` (both 'YYYY-MM'), without the year: "January–July", or one name when they
 * are the same month. `short` gives the short names ("Jan–Jul") for a narrow place.
 */
export function formatMonthRange(first: string, last: string, lang: Lang, opts: { short?: boolean } = {}): string {
  const name = (month: string) =>
    new Intl.DateTimeFormat(LOCALES[lang], { month: opts.short ? 'short' : 'long', timeZone: 'UTC' }).format(new Date(`${month}-01`));
  return first === last ? name(first) : `${name(first)}–${name(last)}`;
}

const QUARTER_WORDS_AR = ['الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

/**
 * The name of a VAT period: its month and year for a monthly one ("October 2026"), its quarter and year for a quarterly
 * one ("Q3 2026", "3. Quartal 2026", "الربع الثالث 2026"). Takes any period's start (an ISO date) and kind, such as a `TaxPeriod`.
 */
export function formatTaxPeriod(period: { start: string; kind: 'monthly' | 'quarterly' }, lang: Lang): string {
  if (period.kind === 'monthly') return formatMonth(period.start.slice(0, 7), lang);
  const year = period.start.slice(0, 4);
  const quarter = Math.floor((Number(period.start.slice(5, 7)) - 1) / 3);
  if (lang === 'de') return `${quarter + 1}. Quartal ${year}`;
  if (lang === 'ar') return `الربع ${QUARTER_WORDS_AR[quarter]} ${year}`;
  return `Q${quarter + 1} ${year}`;
}
