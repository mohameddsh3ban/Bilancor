import type { Lang } from '../data/models';
import { parseAmountQuery } from './payment-filters';

/** The amount typed in a field as cents, or null unless it is a number above 0 (a document is never worth nothing or less). `49,90` and `49.90` read alike. */
export function parseDocAmount(text: string): number | null {
  const amount = parseAmountQuery(text);
  return amount !== null && !amount.negative && amount.cents > 0 ? amount.cents : null;
}

/** An amount as a field shows it: no thousands separator, the decimal mark of the language. */
export function amountInput(cents: number, lang: Lang): string {
  const plain = `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
  return lang === 'de' ? plain.replace('.', ',') : plain;
}
