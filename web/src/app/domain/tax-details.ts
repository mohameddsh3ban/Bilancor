import { GERMAN_STATES, TAX_OFFICES } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { TaxProfile } from '../data/models';

/** When the next VAT return is due: on a date, once a year with no monthly or quarterly date, or not at all. */
export type VatReturnDue = { kind: 'date'; date: string } | { kind: 'yearly' } | null;

/** The day of the month on which a VAT return is due. */
const DUE_DAY = 10;

/**
 * The deadline of the return for the period that ends in `periodEnd` (a month number counted from January of `year`:
 * 0 is the December before, 13 the January after): the 10th of the following month, one month later with a permanent
 * extension (Dauerfristverlängerung), and the Monday after when that day is a Saturday or a Sunday. Public holidays
 * are not modelled. An ISO date; read as UTC, so no clock or zone matters.
 */
function deadlineOf(year: number, periodEnd: number, extension: boolean): string {
  // The month after the period, as the month index Date.UTC counts from (0 = January), so periodEnd is the index itself.
  const due = new Date(Date.UTC(year, periodEnd + (extension ? 1 : 0), DUE_DAY));
  const weekday = due.getUTCDay();
  if (weekday === 6) due.setUTCDate(due.getUTCDate() + 2);
  if (weekday === 0) due.setUTCDate(due.getUTCDate() + 1);
  return due.toISOString().slice(0, 10);
}

/**
 * The date of the VAT return still to file, from the tax answers and `today` (an ISO date; never the real clock).
 *
 * The deadline of a period is the 10th of the month after it ends (a month later with a permanent extension), moved to
 * the Monday after when that day is a Saturday or a Sunday. A return can be filed after its period has ended, so the
 * date shown is the previous period's deadline while it is today or later, and the current period's deadline once it
 * has passed. A yearly return has no such date. Null for a Kleinunternehmer, who files no VAT return, and while the
 * period is not answered.
 */
export function vatReturnDue(profile: TaxProfile, today: string = DEMO_TODAY): VatReturnDue {
  if (profile.kleinunternehmer || profile.vatPeriod === null) return null;
  if (profile.vatPeriod === 'yearly') return { kind: 'yearly' };

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const length = profile.vatPeriod === 'quarterly' ? 3 : 1;
  const periodEnd = Math.ceil(month / length) * length;

  const previous = deadlineOf(year, periodEnd - length, profile.permanentExtension);
  if (previous >= today) return { kind: 'date', date: previous };
  return { kind: 'date', date: deadlineOf(year, periodEnd, profile.permanentExtension) };
}

/**
 * The tax office a tax number belongs to, found in the sample table that stands in for the real lookup. The number
 * (outer spaces trimmed) must be written the way its state prints it, and its first digits, separators left out,
 * must start with a prefix of that state; when several prefixes fit, the longest one wins. Null when the state is
 * unknown or has no format, the number does not match it, or no office has the prefix.
 */
export function findTaxOffice(stateId: string, taxNumber: string): string | null {
  const pattern = GERMAN_STATES.find((state) => state.id === stateId)?.taxNumberPattern;
  const number = taxNumber.trim();
  if (!pattern || !pattern.test(number)) return null;

  const digits = number.replace(/\D/g, '');
  let found: { prefix: string; name: string } | null = null;
  for (const office of TAX_OFFICES) {
    if (office.state !== stateId || !digits.startsWith(office.prefix)) continue;
    if (!found || office.prefix.length > found.prefix.length) found = office;
  }
  return found?.name ?? null;
}

/** Whether the text is a German VAT ID (USt-IdNr.): `DE` and nine digits. Spaces are ignored. */
export function isVatId(text: string): boolean {
  return /^DE\d{9}$/.test(text.replace(/\s/g, ''));
}
