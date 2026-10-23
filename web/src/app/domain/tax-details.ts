import { GERMAN_STATES, TAX_OFFICES } from '../data/banks';
import type { TaxProfile } from '../data/models';

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

/** The tax office of a saved tax profile (see `findTaxOffice`); null while the state or the number is not answered. */
export function profileTaxOffice(profile: Pick<TaxProfile, 'taxState' | 'taxNumber'>): string | null {
  const { taxState, taxNumber } = profile;
  return taxState !== null && taxNumber !== null ? findTaxOffice(taxState, taxNumber) : null;
}

/** Whether the text is a German VAT ID (USt-IdNr.): `DE` and nine digits. Spaces are ignored. */
export function isVatId(text: string): boolean {
  return /^DE\d{9}$/.test(text.replace(/\s/g, ''));
}
