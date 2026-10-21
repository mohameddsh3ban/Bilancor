import { revenueLimitStatus } from './revenue-limit';

describe('revenueLimitStatus', () => {
  it('is ok just below 80 % of the €25,000 limit', () => {
    expect(revenueLimitStatus(1_999_999).level).toBe('ok');
  });

  it('is warning from 80 % (€20,000) inclusive', () => {
    expect(revenueLimitStatus(2_000_000).level).toBe('warning');
  });

  it('is warning at 85 % and reports percent 85', () => {
    const status = revenueLimitStatus(2_130_000);
    expect(status.level).toBe('warning');
    expect(status.percent).toBe(85);
  });

  it('is warning at exactly €25,000 (inclusive)', () => {
    expect(revenueLimitStatus(2_500_000).level).toBe('warning');
  });

  it('is overNextYear just above €25,000', () => {
    expect(revenueLimitStatus(2_500_001).level).toBe('overNextYear');
  });

  it('is overNextYear at exactly €100,000 (inclusive)', () => {
    expect(revenueLimitStatus(10_000_000).level).toBe('overNextYear');
  });

  it('is overNow just above €100,000', () => {
    expect(revenueLimitStatus(10_000_001).level).toBe('overNow');
  });

  it('exposes the limits in cents', () => {
    const status = revenueLimitStatus(0);
    expect(status.limitCents).toBe(2_500_000);
    expect(status.hardLimitCents).toBe(10_000_000);
  });

  it('reports percent rounded to a whole number', () => {
    expect(revenueLimitStatus(0).percent).toBe(0);
    expect(revenueLimitStatus(2_500_000).percent).toBe(100);
  });
});
