import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from './transloco-testing';
import { LanguageService } from './language.service';

describe('LanguageService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('starts in en when nothing is stored', () => {
    const service = TestBed.inject(LanguageService);
    expect(service.lang()).toBe('en');
    expect(service.dir()).toBe('ltr');
    expect(document.documentElement.lang).toBe('en');
  });

  it('setLang ar sets rtl', () => {
    const service = TestBed.inject(LanguageService);
    service.setLang('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
    expect(service.lang()).toBe('ar');
    expect(service.dir()).toBe('rtl');
    service.setLang('de');
    expect(document.documentElement.dir).toBe('ltr');
    expect(service.dir()).toBe('ltr');
  });

  it('sets the Transloco active language', () => {
    const service = TestBed.inject(LanguageService);
    service.setLang('de');
    expect(TestBed.inject(TranslocoService).getActiveLang()).toBe('de');
  });

  it('language is remembered', () => {
    TestBed.inject(LanguageService).setLang('de');
    const second = TestBed.runInInjectionContext(() => new LanguageService());
    expect(second.lang()).toBe('de');
    expect(document.documentElement.lang).toBe('de');
  });

  it('ignores an unknown stored value', () => {
    localStorage.setItem('mockup.lang', 'fr');
    expect(TestBed.inject(LanguageService).lang()).toBe('en');
  });
});
