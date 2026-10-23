import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Lang } from '../data/models';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { AccountService } from '../state/account.service';
import { AuthFrame } from './auth-frame';

@Component({
  imports: [AuthFrame],
  template: `
    <app-auth-frame (langPicked)="picked.push($event)">
      <h1 data-testid="inside">Inside the card</h1>
    </app-auth-frame>
  `,
})
class Host {
  readonly picked: Lang[] = [];
}

describe('AuthFrame', () => {
  let language: LanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    language = TestBed.inject(LanguageService);
  });

  afterEach(() => {
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  function render() {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const buttons = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>('[data-testid="lang-switcher"] button'));
    return { fixture, el, buttons };
  }

  it('shows the app name and what is put inside, in a card', () => {
    const { el } = render();
    expect(el.querySelector('[data-testid="auth-brand"]')!.textContent).toContain('Your logo');
    expect(el.querySelector('main [data-testid="inside"]')!.textContent).toBe('Inside the card');
  });

  it('has the EN, DE and عربي buttons, with the current language pressed', () => {
    const { buttons } = render();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['EN', 'DE', 'عربي']);
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('a language button sets the language and says it was picked, and saves it for nobody', async () => {
    const { fixture, buttons } = render();
    const accounts = TestBed.inject(AccountService);
    buttons()[2].click();
    fixture.detectChanges();
    expect(language.lang()).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(fixture.componentInstance.picked).toEqual(['ar']);
    expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'true',
    ]);
    // Nobody is signed in, so the pick is the browser's language only: Sara's own stays unset.
    expect(accounts.person().lang).toBeNull();
  });
});
