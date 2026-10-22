import { CATEGORIES, REVENUE_19, REVENUE_7, REVENUE_KU } from '../data/categories';
import type { Booking, TaxProfile } from '../data/models';

/**
 * The categories a person can book a business payment to. Revenue depends on the tax status: a
 * Kleinunternehmer books it to 8195, a business that charges VAT to 8400 or 8300, so neither is offered the other's.
 */
export function categoriesFor(tax: TaxProfile): Booking[] {
  const notFor = tax.kleinunternehmer ? [REVENUE_19, REVENUE_7] : [REVENUE_KU];
  return CATEGORIES.filter((category) => !notFor.includes(category));
}

/**
 * The VAT rate to show for a booking, or null for "no VAT". A Kleinunternehmer never charges or reclaims VAT,
 * so they always get null, whatever the category's usual rate is.
 */
export function vatRateShown(tax: TaxProfile, booking: Booking): number | null {
  return tax.kleinunternehmer || booking.vatRate === 0 ? null : booking.vatRate;
}
