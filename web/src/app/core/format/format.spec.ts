import { formatDate, formatIban, formatMoney, formatMonthRange, formatTaxPeriod } from './format';

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
  // Vitest runs in Node, so the process time zone can be switched at runtime.
  const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } })
    .process.env;
  const originalTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  afterEach(() => {
    env['TZ'] = originalTz;
  });

  it('shows the same calendar day in a zone west of UTC', () => {
    env['TZ'] = 'America/New_York';
    expect(formatDate('2026-10-21', 'en')).toBe('21 Oct');
    expect(formatDate('2026-01-01', 'en')).toBe('1 Jan');
  });

  it('shows a short day and month per language', () => {
    expect(formatDate('2026-10-21', 'en')).toBe('21 Oct');
    expect(formatDate('2026-10-21', 'de')).toBe('21. Okt.');
  });

  it('ar uses western digits', () => {
    expect(formatDate('2026-10-21', 'ar')).not.toMatch(/[٠-٩]/);
    expect(formatDate('2026-10-21', 'ar')).toMatch(/21/);
  });

  it('adds the year when asked, and leaves it out otherwise', () => {
    expect(formatDate('2026-10-17', 'en', { year: true })).toBe('17 Oct 2026');
    expect(formatDate('2026-10-17', 'de', { year: true })).toBe('17. Okt. 2026');
    expect(formatDate('2026-10-17', 'en', { year: false })).toBe('17 Oct');
    expect(formatDate('2026-10-17', 'en', {})).toBe('17 Oct');
  });

  it('ar with the year uses western digits', () => {
    const text = formatDate('2026-10-17', 'ar', { year: true });
    expect(text).toMatch(/17/);
    expect(text).toMatch(/2026/);
    expect(text).not.toMatch(/[٠-٩]/);
  });

  it('the year follows the calendar day in a zone west of UTC', () => {
    env['TZ'] = 'America/New_York';
    expect(formatDate('2026-01-01', 'en', { year: true })).toBe('1 Jan 2026');
  });
});

describe('formatMoney whole', () => {
  it('drops the cents', () => {
    expect(formatMoney(2130000, 'en', { whole: true })).toBe('€21,300');
    expect(formatMoney(2130000, 'de', { whole: true }).replace(/ /g, ' ')).toBe('21.300 €');
  });
});

describe('formatIban', () => {
  it('groups an IBAN in fours', () => {
    expect(formatIban('DE68210501700012345678')).toBe('DE68 2105 0170 0012 3456 78');
    expect(formatIban('DE6821')).toBe('DE68 21');
    expect(formatIban('DE68')).toBe('DE68');
  });
});

describe('formatTaxPeriod', () => {
  const october = { start: '2026-10-01', kind: 'monthly' } as const;
  const thirdQuarter = { start: '2026-07-01', kind: 'quarterly' } as const;

  it('names a month like formatMonth does', () => {
    expect(formatTaxPeriod(october, 'en')).toBe('October 2026');
    expect(formatTaxPeriod(october, 'de')).toBe('Oktober 2026');
    expect(formatTaxPeriod(october, 'ar')).toMatch(/2026/);
  });

  it('names a quarter by its number and year', () => {
    expect(formatTaxPeriod(thirdQuarter, 'en')).toBe('Q3 2026');
    expect(formatTaxPeriod(thirdQuarter, 'de')).toBe('3. Quartal 2026');
    expect(formatTaxPeriod(thirdQuarter, 'ar')).toBe('الربع الثالث 2026');
  });

  it('counts the quarters from January and uses Western digits in Arabic', () => {
    const firstOfEach = ['2026-01-01', '2026-04-01', '2026-07-01', '2026-10-01'];
    expect(firstOfEach.map((start) => formatTaxPeriod({ start, kind: 'quarterly' }, 'en'))).toEqual([
      'Q1 2026',
      'Q2 2026',
      'Q3 2026',
      'Q4 2026',
    ]);
    expect(firstOfEach.map((start) => formatTaxPeriod({ start, kind: 'quarterly' }, 'ar'))).toEqual([
      'الربع الأول 2026',
      'الربع الثاني 2026',
      'الربع الثالث 2026',
      'الربع الرابع 2026',
    ]);
    expect(formatTaxPeriod(october, 'ar')).not.toMatch(/[٠-٩]/);
  });
});

describe('formatMonthRange', () => {
  it('names the months of a span, without the year', () => {
    expect(formatMonthRange('2026-01', '2026-07', 'en')).toBe('January–July');
    expect(formatMonthRange('2026-01', '2026-06', 'de')).toBe('Januar–Juni');
    expect(formatMonthRange('2026-01', '2026-07', 'ar')).toBe('يناير–يوليو');
  });

  it('names a span of one month once', () => {
    expect(formatMonthRange('2026-01', '2026-01', 'en')).toBe('January');
    expect(formatMonthRange('2026-03', '2026-03', 'de')).toBe('März');
  });
});
