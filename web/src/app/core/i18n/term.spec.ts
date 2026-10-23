import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';
import { provideTranslocoTesting } from './transloco-testing';
import { Term, TermInfo, TermText } from './term';
import en from '../../../../public/i18n/en.json';

@Component({ imports: [Term], template: `<app-term key="ustva" />` })
class Host {}

@Component({ imports: [TermText, TermInfo], template: `<app-term-text key="ustva" /><app-term-info key="ustva" />` })
class PlainHost {}

describe('Term', () => {
  let fixture: ComponentFixture<Host>;
  const text = () => (fixture.nativeElement as HTMLElement).textContent ?? '';

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    fixture = TestBed.createComponent(Host);
  });

  afterEach(() => {
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  it('shows the German original outside German', () => {
    fixture.detectChanges();
    expect(text()).toContain('VAT return');
    expect(text()).toContain('(UStVA)');
  });

  it('shows only the German term in German, without parentheses', () => {
    TestBed.inject(LanguageService).setLang('de');
    fixture.detectChanges();
    expect(text()).toContain('UStVA');
    expect(text()).not.toContain('(');
  });

  it('opens the explanation on tap', () => {
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    button.click();
    fixture.detectChanges();
    expect(document.body.textContent).toContain(en.terms.ustva.explain);
  });

  describe('as plain text with its own info button', () => {
    let plainFixture: ComponentFixture<PlainHost>;
    const root = () => plainFixture.nativeElement as HTMLElement;

    beforeEach(() => {
      plainFixture = TestBed.createComponent(PlainHost);
    });

    it('shows the words without a button of their own', () => {
      plainFixture.detectChanges();
      const words = root().querySelector('app-term-text')!;
      expect(words.textContent!.replace(/\s+/g, ' ').trim()).toBe('VAT return (UStVA)');
      expect(words.querySelector('button')).toBeNull();
      expect(words.querySelector('bdi')!.getAttribute('dir')).toBe('ltr');
    });

    it('shows only the German term in German', () => {
      TestBed.inject(LanguageService).setLang('de');
      plainFixture.detectChanges();
      expect(root().querySelector('app-term-text')!.textContent!.trim()).toBe('UStVA');
    });

    it('has an info button named "What is ...?" that opens the explanation on tap', () => {
      plainFixture.detectChanges();
      const info = root().querySelector<HTMLButtonElement>('app-term-info button')!;
      expect(info.getAttribute('aria-label')).toBe('What is VAT return?');
      expect(info.classList).toContain('size-8');
      info.click();
      plainFixture.detectChanges();
      expect(document.body.textContent).toContain(en.terms.ustva.explain);
    });
  });
});
