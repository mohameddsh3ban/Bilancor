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

/** The names of the months from `first` to `last` (both 'YYYY-MM'), without the year: "January–July", or one name when they are the same month. */
export function formatMonthRange(first: string, last: string, lang: Lang): string {
  const name = (month: string) =>
    new Intl.DateTimeFormat(LOCALES[lang], { month: 'long', timeZone: 'UTC' }).format(new Date(`${month}-01`));
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
