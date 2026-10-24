import { Injectable, inject } from '@angular/core';
import { LanguageService } from '../core/i18n/language.service';
import type { Lang } from '../data/models';
import { AccountService } from './account.service';

/**
 * Where the person's language and the browser's meet. The language belongs to the person: signing in switches the app
 * to it, and the language buttons change it for whoever is signed in. The browser's own last language (kept by
 * `LanguageService`) stays what the sign-in pages show.
 */
@Injectable({ providedIn: 'root' })
export class PersonLanguageService {
  private readonly accounts = inject(AccountService);
  private readonly language = inject(LanguageService);

  /**
   * A language button was pressed while nobody was signed in (the sign-in, sign-up and forgotten-password pages share the
   * buttons), and no sign-in has come since. It lives here and not in a page, because the person may go from page to page
   * (sign in, Forgot password, back to sign in) before signing in.
   */
  private pickedSignedOut = false;

  /**
   * Sets the language right after a sign-in. A language picked while nobody was signed in wins and is saved as the
   * person's, and so does `picked` (sign-up, where the page's language is the person's choice); so does the current one
   * for a person who has no language yet (Sara starts that way, so opening the demo never changes the language by itself).
   * Otherwise the person's own language applies. The pick is used up by the sign-in; an id nobody has changes nothing and
   * leaves it for the real one.
   */
  applyOnSignIn(personId: string, picked = false): void {
    const person = this.accounts.persons().find((p) => p.id === personId);
    if (!person) return;
    const wins = picked || this.pickedSignedOut;
    this.pickedSignedOut = false;
    if (wins || person.lang === null) this.save(personId, this.language.lang());
    else this.language.setLang(person.lang);
  }

  /**
   * Sets the language, and saves it as the signed-in person's own. Signed out (the pages outside the app) it only sets it,
   * and remembers the pick for the next sign-in (`applyOnSignIn`).
   */
  set(lang: Lang): void {
    this.language.setLang(lang);
    if (this.accounts.signedIn()) this.save(this.accounts.person().id, lang);
    else this.pickedSignedOut = true;
  }

  /** Reset demo: a pick made while signed out is forgotten, so it never reaches a sign-in after the reset. */
  forgetPick(): void {
    this.pickedSignedOut = false;
  }

  private save(personId: string, lang: Lang): void {
    this.accounts.updatePerson(personId, (p) => (p.lang === lang ? p : { ...p, lang }));
  }
}
