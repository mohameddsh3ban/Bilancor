import { DEMO_TODAY } from '../data/demo-date';
import { addDays as addDaysFromBankConnection, daysBetween as daysBetweenFromBankConnection } from './bank-connection';
import { addDays, daysBetween } from './dates';

describe('addDays', () => {
  it('adds days to an ISO date, across a month and a year end', () => {
    expect(addDays('2026-10-22', 5)).toBe('2026-10-27');
    expect(addDays('2026-12-30', 3)).toBe('2027-01-02');
    expect(addDays('2026-10-22', 0)).toBe(DEMO_TODAY);
  });

  it('goes through a leap day without a zone or the clock getting in the way', () => {
    expect(addDays('2028-02-28', 2)).toBe('2028-03-01');
    expect(addDays('2026-03-28', 2)).toBe('2026-03-30');
    expect(addDays('2026-10-24', 2)).toBe('2026-10-26');
  });

  it('counts back with a negative number', () => {
    expect(addDays('2026-10-22', -22)).toBe('2026-09-30');
  });
});

describe('daysBetween', () => {
  it('counts the whole days from one ISO date to another, across a month and a year end', () => {
    expect(daysBetween('2026-10-22', '2026-10-27')).toBe(5);
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(3);
    expect(daysBetween('2026-10-22', '2026-10-22')).toBe(0);
  });

  it('is negative when the second date is earlier', () => {
    expect(daysBetween('2026-10-22', '2026-10-10')).toBe(-12);
  });

  it('counts a leap day', () => {
    expect(daysBetween('2028-02-28', '2028-03-01')).toBe(2);
  });
});

describe('bank-connection still exports them', () => {
  it('is the same functions, so its readers need no change', () => {
    expect(addDaysFromBankConnection).toBe(addDays);
    expect(daysBetweenFromBankConnection).toBe(daysBetween);
  });
});
