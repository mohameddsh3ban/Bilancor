import { GERMAN_STATES, TAX_OFFICES } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import type { TaxProfile } from '../data/models';

/** When the next VAT return is due: on a date, once a year with no monthly or quarterly date, or not at all. */
export type VatReturnDue = { kind: 'date'; date: string } | { kind: 'yearly' } | null;

/** The day of the month on which a VAT return is due. */
const DUE_DAY = '10';

/**
 * The next date a VAT return is due, from the tax answers and `today` (an ISO date; never the real clock).
 *
 * A monthly return is due on the 10th of the month after the current month, a quarterly one on the 10th of the month
 * after the current quarter; a permanent extension (Dauerfristverlängerung) moves either one month later. A yearly
 * return has no such date. Null for a Kleinunternehmer, who files no VAT return, and while the period is not answered.
 */
export function vatReturnDue(profile: TaxProfile, today: string = DEMO_TODAY): VatReturnDue {
  if (profile.kleinunternehmer || profile.vatPeriod === null) return null;
  if (profile.vatPeriod === 'yearly') return { kind: 'yearly' };

  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const periodEnd = profile.vatPeriod === 'quarterly' ? Math.ceil(month / 3) * 3 : month;
  // The due month counted from January of `year` (0 = January). That is the month after the period ends, so a due
  // date past December carries into the next year.
  const dueIndex = periodEnd + (profile.permanentExtension ? 1 : 0);
  const dueYear = year + Math.floor(dueIndex / 12);
  const dueMonth = (dueIndex % 12) + 1;
  return { kind: 'date', date: `${dueYear}-${String(dueMonth).padStart(2, '0')}-${DUE_DAY}` };
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
