import { TAX_OFFICES } from '../data/banks';
import type { TaxProfile } from '../data/models';
import { BUSINESSES } from '../data/sample-data';
import { findTaxOffice, isVatId, vatReturnDue } from './tax-details';

const profileOf = (id: string): TaxProfile => BUSINESSES.find((b) => b.id === id)!.taxProfile;
const weber = profileOf('weber-design');
const sara = profileOf('sara-yoga');
const cafe = profileOf('cafe-linde');

describe('vatReturnDue', () => {
  const due = (date: string) => ({ kind: 'date', date });

  it('is the next 10th for a monthly return that is not filed yet', () => {
    // Demo day 22 Oct 2026: September's return was due on Monday 12 Oct (10 Oct is a Saturday), so October's is next.
    expect(vatReturnDue(weber)).toEqual(due('2026-11-10'));
  });

  it('is still the previous period with a permanent extension, as it runs a month longer', () => {
    // September's return, extended: 10 Nov.
    expect(vatReturnDue({ ...weber, permanentExtension: true })).toEqual(due('2026-11-10'));
  });

  it('is the 10th after the end of the quarter for a quarterly return, moved off a weekend', () => {
    // Q4 ends in December: 10 Jan 2027 is a Sunday, so the deadline is Monday 11 Jan.
    expect(vatReturnDue(cafe)).toEqual(due('2027-01-11'));
  });

  it('is the previous quarter with a permanent extension, quarterly too', () => {
    // Q3's return, extended: 10 Nov 2026.
    expect(vatReturnDue({ ...cafe, permanentExtension: true })).toEqual(due('2026-11-10'));
  });

  it('keeps the previous period while its deadline is today or later', () => {
    expect(vatReturnDue(weber, '2026-11-05')).toEqual(due('2026-11-10'));
    expect(vatReturnDue(weber, '2026-11-10')).toEqual(due('2026-11-10'));
    expect(vatReturnDue(weber, '2026-11-11')).toEqual(due('2026-12-10'));
    expect(vatReturnDue(cafe, '2026-07-01')).toEqual(due('2026-07-10'));
    expect(vatReturnDue(cafe, '2026-04-01')).toEqual(due('2026-04-10'));
    expect(vatReturnDue(cafe, '2026-04-15')).toEqual(due('2026-07-10'));
  });

  it('moves a deadline on a Saturday or Sunday to the Monday after', () => {
    // 10 Oct 2026 is a Saturday, 10 Jan 2027 a Sunday.
    expect(vatReturnDue(weber, '2026-10-05')).toEqual(due('2026-10-12'));
    expect(vatReturnDue(weber, '2027-01-05')).toEqual(due('2027-01-11'));
    expect(vatReturnDue(cafe, '2026-09-30')).toEqual(due('2026-10-12'));
  });

  it('compares today with the deadline after the move, not with the 10th', () => {
    expect(vatReturnDue(weber, '2026-10-11')).toEqual(due('2026-10-12'));
    expect(vatReturnDue(weber, '2026-10-12')).toEqual(due('2026-10-12'));
    expect(vatReturnDue(weber, '2026-10-13')).toEqual(due('2026-11-10'));
  });

  it('has no monthly or quarterly date for a yearly return', () => {
    expect(vatReturnDue({ ...weber, vatPeriod: 'yearly' })).toEqual({ kind: 'yearly' });
    expect(vatReturnDue({ ...weber, vatPeriod: 'yearly', permanentExtension: true })).toEqual({
      kind: 'yearly',
    });
  });

  it('is null for a Kleinunternehmer', () => {
    expect(vatReturnDue(sara)).toBeNull();
    expect(vatReturnDue({ ...weber, kleinunternehmer: true })).toBeNull();
  });

  it('is null while the period is not answered', () => {
    expect(vatReturnDue({ ...weber, vatPeriod: null })).toBeNull();
  });

  it('follows the date it is given, not the demo date', () => {
    expect(vatReturnDue(weber, '2026-03-15')).toEqual(due('2026-04-10'));
    expect(vatReturnDue(cafe, '2026-03-15')).toEqual(due('2026-04-10'));
  });

  it('rolls into the next year, also after the extension', () => {
    expect(vatReturnDue(weber, '2026-12-15')).toEqual(due('2027-01-11'));
    expect(vatReturnDue({ ...weber, permanentExtension: true }, '2026-12-15')).toEqual(due('2027-01-11'));
    expect(vatReturnDue({ ...weber, permanentExtension: true }, '2026-12-05')).toEqual(due('2027-01-11'));
    expect(vatReturnDue({ ...weber, permanentExtension: true }, '2026-11-05')).toEqual(due('2026-12-10'));
    expect(vatReturnDue({ ...cafe, permanentExtension: true }, '2026-12-31')).toEqual(due('2027-02-10'));
  });

  it('reaches back into the year before in January', () => {
    // 5 Jan 2027: December's (or Q4's) return is still to be filed.
    expect(vatReturnDue(weber, '2027-01-05')).toEqual(due('2027-01-11'));
    expect(vatReturnDue(cafe, '2027-01-05')).toEqual(due('2027-01-11'));
    expect(vatReturnDue({ ...cafe, permanentExtension: true }, '2027-01-05')).toEqual(due('2027-02-10'));
  });

  it('puts the last month of a quarter in that quarter', () => {
    expect(vatReturnDue(cafe, '2026-09-30')).toEqual(due('2026-10-12'));
    expect(vatReturnDue(cafe, '2026-06-30')).toEqual(due('2026-07-10'));
  });

  it('does not read the stored VAT date of the business', () => {
    // Weber Design stores 2026-11-10, but a quarterly answer moves the date.
    expect(vatReturnDue({ ...weber, vatPeriod: 'quarterly' })).toEqual(due('2027-01-11'));
  });
});

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
