import { Lang } from '../../data/models';

const LOCALES: Record<Lang, string> = {
  en: 'en-IE',
  de: 'de-DE',
  ar: 'ar-u-nu-latn',
};

export function formatMoney(cents: number, lang: Lang, opts: { signed?: boolean } = {}): string {
  return new Intl.NumberFormat(LOCALES[lang], {
    style: 'currency',
    currency: 'EUR',
    signDisplay: opts.signed ? 'exceptZero' : 'auto',
  }).format(cents / 100);
}

export function formatDate(iso: string, lang: Lang): string {
  return new Intl.DateTimeFormat(LOCALES[lang], { day: 'numeric', month: 'short' }).format(
    new Date(iso),
  );
}
