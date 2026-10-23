import { TAX_OFFICES } from '../data/banks';
import type { TaxProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { findTaxOffice, isVatId } from './tax-details';

const profileOf = (id: string): TaxProfile => BUSINESSES.find((b) => b.id === id)!.taxProfile;
const sara = profileOf('sara-yoga');
const cafe = profileOf('cafe-linde');

describe('findTaxOffice', () => {
  it('finds the office for a matching number', () => {
    expect(findTaxOffice('berlin', '27/123/45678')).toBe('Berlin Friedrichshain-Kreuzberg');
    expect(findTaxOffice('bayern', '143/123/45678')).toBe('München');
    expect(findTaxOffice('bremen', '60 123 45678')).toBe('Bremen');
  });

  it('finds the offices of the sample businesses', () => {
    expect(findTaxOffice(sara.taxState!, sara.taxNumber!)).toBe('Berlin Mitte');
    expect(findTaxOffice(cafe.taxState!, cafe.taxNumber!)).toBe('Hamburg-Altona');
  });

  it('ignores spaces around the number', () => {
    expect(findTaxOffice('berlin', '  27/123/45678 ')).toBe('Berlin Friedrichshain-Kreuzberg');
  });

  it('is null when the number is not in the state format', () => {
    expect(findTaxOffice('berlin', '27123/45678')).toBeNull();
    expect(findTaxOffice('berlin', '27/123/4567')).toBeNull();
    expect(findTaxOffice('berlin', '27/123/456789')).toBeNull();
    expect(findTaxOffice('berlin', '27/123/4567a')).toBeNull();
    expect(findTaxOffice('berlin', '27 123 45678')).toBeNull();
    expect(findTaxOffice('berlin', '')).toBeNull();
    expect(findTaxOffice('bayern', '27/123/45678')).toBeNull();
  });

  it('is null for a prefix the sample table does not know', () => {
    expect(findTaxOffice('berlin', '99/123/45678')).toBeNull();
  });

  it("is null for another state's prefix", () => {
    // 41 is a Hamburg office, but the same digits are no office in Berlin.
    expect(findTaxOffice('berlin', '41/123/45678')).toBeNull();
    expect(findTaxOffice('hamburg', '41/123/45678')).toBe('Hamburg-Altona');
  });

  it('is null for a state without a pattern, and for an unknown state', () => {
    expect(findTaxOffice('hessen', '27/123/45678')).toBeNull();
    expect(findTaxOffice('atlantis', '27/123/45678')).toBeNull();
  });

  describe('when prefixes overlap', () => {
    const shorter = { state: 'berlin', prefix: '27', name: 'Berlin Friedrichshain-Kreuzberg' };
    const longer = { state: 'berlin', prefix: '271', name: 'Berlin Test-Süd' };

    function withOffices(offices: (typeof TAX_OFFICES)[number][], check: () => void): void {
      const saved = TAX_OFFICES.splice(0, TAX_OFFICES.length, ...offices);
      try {
        check();
      } finally {
        TAX_OFFICES.splice(0, TAX_OFFICES.length, ...saved);
      }
    }

    it('takes the longest prefix that starts the number, whatever the order of the table', () => {
      for (const order of [
        [shorter, longer],
        [longer, shorter],
      ]) {
        withOffices(order, () => {
          // Digits 2712345678 start with both "27" and "271".
          expect(findTaxOffice('berlin', '27/123/45678')).toBe(longer.name);
          // Digits 2723456789 start with "27" only.
          expect(findTaxOffice('berlin', '27/234/56789')).toBe(shorter.name);
        });
      }
    });
  });
});

describe('isVatId', () => {
  it('takes DE and nine digits, spaces ignored', () => {
    expect(isVatId('DE123456789')).toBe(true);
    expect(isVatId('DE 123456789')).toBe(true);
    expect(isVatId('DE 123 456 789')).toBe(true);
    expect(isVatId(' DE123456789 ')).toBe(true);
  });

  it('rejects any other shape', () => {
    expect(isVatId('DE12345678')).toBe(false);
    expect(isVatId('DE1234567890')).toBe(false);
    expect(isVatId('AT123456789')).toBe(false);
    expect(isVatId('123456789')).toBe(false);
    expect(isVatId('DE12345678A')).toBe(false);
    expect(isVatId('DE-123456789')).toBe(false);
    expect(isVatId('')).toBe(false);
  });
});
