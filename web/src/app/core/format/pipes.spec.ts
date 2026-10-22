import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../i18n/language.service';
import { provideTranslocoTesting } from '../i18n/transloco-testing';
import { AppDatePipe } from './date.pipe';
import { AppMonthPipe } from './month.pipe';
import { MoneyPipe } from './money.pipe';

describe('format pipes', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('money pipe formats in the current language', () => {
    const pipe = TestBed.runInInjectionContext(() => new MoneyPipe());
    expect(pipe.transform(123456)).toBe('€1,234.56');
    TestBed.inject(LanguageService).setLang('de');
    expect(pipe.transform(123456).replace(/ /g, ' ')).toBe('1.234,56 €');
  });

  it('money pipe passes signed and whole', () => {
    const pipe = TestBed.runInInjectionContext(() => new MoneyPipe());
    expect(pipe.transform(150000, { signed: true })).toBe('+€1,500.00');
    expect(pipe.transform(2130000, { whole: true })).toBe('€21,300');
  });

  it('appDate pipe follows the language', () => {
    const pipe = TestBed.runInInjectionContext(() => new AppDatePipe());
    expect(pipe.transform('2026-10-21')).toContain('21 Oct');
    TestBed.inject(LanguageService).setLang('de');
    expect(pipe.transform('2026-10-21')).toContain('21. Okt');
  });

  it('appDate pipe adds the year only when asked', () => {
    const pipe = TestBed.runInInjectionContext(() => new AppDatePipe());
    expect(pipe.transform('2026-10-17')).toBe('17 Oct');
    expect(pipe.transform('2026-10-17', { year: true })).toBe('17 Oct 2026');
    TestBed.inject(LanguageService).setLang('de');
    expect(pipe.transform('2026-10-17', { year: true })).toBe('17. Okt. 2026');
  });

  it('appMonth pipe names the month in the current language', () => {
    const pipe = TestBed.runInInjectionContext(() => new AppMonthPipe());
    expect(pipe.transform('2026-10')).toBe('October 2026');
    TestBed.inject(LanguageService).setLang('de');
    expect(pipe.transform('2026-10')).toBe('Oktober 2026');
    TestBed.inject(LanguageService).setLang('ar');
    expect(pipe.transform('2026-10')).toMatch(/2026/);
    expect(pipe.transform('2026-10')).not.toMatch(/[٠-٩]/);
  });
});
