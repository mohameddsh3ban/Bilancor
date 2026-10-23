import type { Booking } from './models';

// SKR03 accounts a freelancer or sole trader uses most. Names stay German; the VAT rate is the usual one for Germany.

export const REVENUE_19: Booking = { skr03: '8400', nameDe: 'Erlöse 19 % USt', labelKey: 'revenue19', vatRate: 19 };
export const REVENUE_7: Booking = { skr03: '8300', nameDe: 'Erlöse 7 % USt', labelKey: 'revenue7', vatRate: 7 };
export const REVENUE_KU: Booking = {
  skr03: '8195',
  nameDe: 'Erlöse als Kleinunternehmer i.S.d. § 19 Abs. 1 UStG',
  labelKey: 'revenueKU',
  vatRate: 0,
};
/** Revenue from a business in another EU country, where the customer owes the VAT (reverse charge). Not offered as a category to pick: only an invoice books to it. */
export const REVENUE_EU_RC: Booking = {
  skr03: '8336',
  nameDe: 'Erlöse aus im Inland nicht steuerbaren Umsätzen (EU, Reverse Charge)',
  labelKey: 'revenueEuRc',
  vatRate: 0,
};
/** Revenue from a business outside the EU, not taxable in Germany. Not offered as a category to pick: only an invoice books to it. */
export const REVENUE_ABROAD: Booking = {
  skr03: '8338',
  nameDe: 'Erlöse aus im Drittland steuerbaren Leistungen',
  labelKey: 'revenueAbroad',
  vatRate: 0,
};
export const PHONE: Booking = { skr03: '4920', nameDe: 'Telefon', labelKey: 'phone', vatRate: 19 };
export const TRAVEL: Booking = { skr03: '4670', nameDe: 'Reisekosten Unternehmer', labelKey: 'travel', vatRate: 7 };
export const SOFTWARE: Booking = {
  skr03: '4806',
  nameDe: 'Wartungskosten für Hard- und Software',
  labelKey: 'software',
  vatRate: 19,
};
export const OTHER_COSTS: Booking = {
  skr03: '4900',
  nameDe: 'Sonstige betriebliche Aufwendungen',
  labelKey: 'otherCosts',
  vatRate: 19,
};
export const RENT: Booking = { skr03: '4210', nameDe: 'Miete (unbewegliche Wirtschaftsgüter)', labelKey: 'rent', vatRate: 19 };
export const SUPPLIES: Booking = { skr03: '4980', nameDe: 'Sonstiger Betriebsbedarf', labelKey: 'supplies', vatRate: 19 };
export const GOODS_7: Booking = { skr03: '3300', nameDe: 'Wareneingang 7 % Vorsteuer', labelKey: 'goods7', vatRate: 7 };
export const UTILITIES: Booking = { skr03: '4240', nameDe: 'Gas, Strom, Wasser', labelKey: 'utilities', vatRate: 19 };
export const SALARIES: Booking = { skr03: '4120', nameDe: 'Gehälter', labelKey: 'salaries', vatRate: 0 };
export const ADVERTISING: Booking = { skr03: '4610', nameDe: 'Werbekosten', labelKey: 'advertising', vatRate: 19 };
export const INSURANCE: Booking = { skr03: '4360', nameDe: 'Versicherungen', labelKey: 'insurance', vatRate: 0 };
export const TRAINING: Booking = { skr03: '4945', nameDe: 'Fortbildungskosten', labelKey: 'training', vatRate: 19 };
export const OFFICE: Booking = { skr03: '4930', nameDe: 'Bürobedarf', labelKey: 'office', vatRate: 19 };
export const CONSULTING: Booking = { skr03: '4950', nameDe: 'Rechts- und Beratungskosten', labelKey: 'consulting', vatRate: 19 };

/** Private money taken out of or put into the business; never VAT, never part of the books' results. */
export const PRIVATE_OUT: Booking = { skr03: '1800', nameDe: 'Privatentnahmen allgemein', labelKey: 'privateOut', vatRate: 0 };
export const PRIVATE_IN: Booking = { skr03: '1890', nameDe: 'Privateinlagen', labelKey: 'privateIn', vatRate: 0 };

/** The categories a person can choose for a business payment. */
export const CATEGORIES: Booking[] = [
  REVENUE_19,
  REVENUE_7,
  REVENUE_KU,
  PHONE,
  TRAVEL,
  SOFTWARE,
  OTHER_COSTS,
  RENT,
  SUPPLIES,
  GOODS_7,
  UTILITIES,
  SALARIES,
  ADVERTISING,
  INSURANCE,
  TRAINING,
  OFFICE,
  CONSULTING,
];
