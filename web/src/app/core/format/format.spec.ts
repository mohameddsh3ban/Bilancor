import { formatDate, formatMoney } from './format';

describe('formatMoney', () => {
  it('en', () => {
    expect(formatMoney(123456, 'en')).toBe('€1,234.56');
    expect(formatMoney(150000, 'en', { signed: true })).toBe('+€1,500.00');
    expect(formatMoney(-2500, 'en', { signed: true })).toBe('-€25.00');
  });

  it('de', () => {
    expect(formatMoney(123456, 'de').replace(/\u00a0/g, ' ')).toBe('1.234,56 €');
  });

  it('ar uses western digits', () => {
    const text = formatMoney(123456, 'ar');
    expect(text).toMatch(/1.234.56/);
    expect(text).not.toMatch(/[٠-٩]/);
  });
});

describe('formatDate', () => {
  it('shows a short day and month per language', () => {
    expect(formatDate('2026-10-21', 'en')).toBe('21 Oct');
    expect(formatDate('2026-10-21', 'de')).toBe('21. Okt.');
  });

  it('ar uses western digits', () => {
    expect(formatDate('2026-10-21', 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatDate('2026-10-21', 'ar')).toMatch(/21/);
  });
});
