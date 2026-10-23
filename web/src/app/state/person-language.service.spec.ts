import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../core/i18n/language.service';
import { provideTranslocoTesting } from '../core/i18n/transloco-testing';
import { AccountService } from './account.service';
import { PersonLanguageService } from './person-language.service';

describe('PersonLanguageService', () => {
  let accounts: AccountService;
  let language: LanguageService;
  let service: PersonLanguageService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
    accounts = TestBed.inject(AccountService);
    language = TestBed.inject(LanguageService);
    service = TestBed.inject(PersonLanguageService);
  });

  afterEach(() => {
    language.setLang('en');
    document.documentElement.lang = '';
    document.documentElement.dir = '';
  });

  const saraLang = () => accounts.persons().find((p) => p.id === 'p1')!.lang;

  describe('applyOnSignIn', () => {
    it('a language picked before signing in wins and is saved', () => {
      accounts.updatePerson('p1', (p) => ({ ...p, lang: 'ar' }));
      language.setLang('de');
      service.applyOnSignIn('p1', true);
      expect(language.lang()).toBe('de');
      expect(saraLang()).toBe('de');
    });

    it("without a pick the person's language applies", () => {
      accounts.updatePerson('p1', (p) => ({ ...p, lang: 'ar' }));
      language.setLang('de');
      service.applyOnSignIn('p1', false);
      expect(language.lang()).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
      expect(saraLang()).toBe('ar');
    });

    it('Sara with no language yet keeps the current one', () => {
      language.setLang('de');
      expect(saraLang()).toBeNull();
      service.applyOnSignIn('p1', false);
      expect(language.lang()).toBe('de');
      expect(saraLang()).toBe('de');
    });

    it('a person nobody knows changes nothing', () => {
      language.setLang('de');
      service.applyOnSignIn('nobody', true);
      expect(language.lang()).toBe('de');
      expect(saraLang()).toBeNull();
    });

    it('works for an account made in the demo, whose language is the one it was made with', () => {
      const id = accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia@example.com',
        lang: 'ar',
      });
      language.setLang('en');
      service.applyOnSignIn(id, false);
      expect(language.lang()).toBe('ar');
    });
  });

  describe('set', () => {
    it('signed out, it only sets the language (the sign-in pages)', () => {
      service.set('de');
      expect(language.lang()).toBe('de');
      expect(saraLang()).toBeNull();
    });

    it("signed in, it also saves the language as the person's own", () => {
      accounts.signIn('p1', false);
      service.set('ar');
      expect(language.lang()).toBe('ar');
      expect(accounts.person().lang).toBe('ar');
      service.set('de');
      expect(accounts.person().lang).toBe('de');
    });

    it('saves it for the signed-in account made in the demo, not for Sara', () => {
      const id = accounts.createPerson({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia@example.com',
        lang: 'en',
      });
      accounts.signIn(id, false);
      service.set('de');
      expect(accounts.person().lang).toBe('de');
      expect(saraLang()).toBeNull();
    });

    it('the language buttons never touch the other person data', () => {
      accounts.signIn('p1', false);
      const before = accounts.person();
      service.set('en');
      expect(accounts.person()).toMatchObject({ ...before, lang: 'en' });
    });
  });
});
