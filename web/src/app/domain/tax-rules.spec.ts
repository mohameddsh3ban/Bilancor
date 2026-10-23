import {
  CATEGORIES,
  GOODS_7,
  PHONE,
  REVENUE_19,
  REVENUE_7,
  REVENUE_KU,
  SALARIES,
  TRAVEL,
} from '../data/categories';
import type { TaxProfile } from '../data/models';
import { categoriesFor, vatRateShown } from './tax-rules';

const vat: TaxProfile = {
  businessKind: 'freelance',
  kleinunternehmer: false,
  vatPeriod: 'monthly',
  permanentExtension: false,
  vatBasis: 'ist',
  taxState: 'berlin',
  taxNumber: '27/123/45678',
  vatId: null,
  fiscalYearStart: '01-01',
};
const small: TaxProfile = {
  businessKind: 'freelance',
  kleinunternehmer: true,
  vatPeriod: null,
  permanentExtension: false,
  vatBasis: null,
  taxState: 'berlin',
  taxNumber: '21/456/78901',
  vatId: null,
  fiscalYearStart: '01-01',
};

describe('categoriesFor', () => {
  it('offers a business that charges VAT the VAT revenue accounts, not the small-business one', () => {
    const offered = categoriesFor(vat).map((c) => c.skr03);
    expect(offered).toContain('8400');
    expect(offered).toContain('8300');
    expect(offered).not.toContain('8195');
  });

  it('offers a Kleinunternehmer the small-business revenue account, not the VAT ones', () => {
    const offered = categoriesFor(small).map((c) => c.skr03);
    expect(offered).toContain('8195');
    expect(offered).not.toContain('8400');
    expect(offered).not.toContain('8300');
  });

  it('keeps every other category, in the same order, for both', () => {
    const revenue = [REVENUE_19, REVENUE_7, REVENUE_KU];
    const others = CATEGORIES.filter((c) => !revenue.includes(c));
    expect(categoriesFor(vat).filter((c) => !revenue.includes(c))).toEqual(others);
    expect(categoriesFor(small).filter((c) => !revenue.includes(c))).toEqual(others);
    expect(categoriesFor(vat)).toHaveLength(CATEGORIES.length - 1);
    expect(categoriesFor(small)).toHaveLength(CATEGORIES.length - 2);
  });
});

describe('vatRateShown', () => {
  it('is the category rate for a business that charges VAT', () => {
    expect(vatRateShown(vat, REVENUE_19)).toBe(19);
    expect(vatRateShown(vat, TRAVEL)).toBe(7);
    expect(vatRateShown(vat, GOODS_7)).toBe(7);
  });

  it('is null (no VAT) for a category without VAT', () => {
    expect(vatRateShown(vat, SALARIES)).toBeNull();
    expect(vatRateShown(vat, REVENUE_KU)).toBeNull();
  });

  it('is null for a Kleinunternehmer, whatever the category rate is', () => {
    expect(vatRateShown(small, PHONE)).toBeNull();
    expect(vatRateShown(small, TRAVEL)).toBeNull();
    expect(vatRateShown(small, REVENUE_19)).toBeNull();
  });
});
