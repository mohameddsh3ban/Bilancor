import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LanguageService } from './language.service';
import { provideTranslocoTesting } from './transloco-testing';
import { Term } from './term';
import en from '../../../../public/i18n/en.json';

@Component({ imports: [Term], template: `<app-term key="ustva" />` })
class Host {}

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
});
