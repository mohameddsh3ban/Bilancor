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
   * Sets the language right after a sign-in. A language picked on the sign-in page (`pickedHere`) wins and is saved as the
   * person's; so does the current one for a person who has no language yet (Sara starts that way, so opening the demo
   * never changes the language by itself). Otherwise the person's own language applies.
   */
  applyOnSignIn(personId: string, pickedHere: boolean): void {
    const person = this.accounts.persons().find((p) => p.id === personId);
    if (!person) return;
    if (pickedHere || person.lang === null) this.save(personId, this.language.lang());
    else this.language.setLang(person.lang);
  }

  /** Sets the language, and saves it as the signed-in person's own; signed out (the sign-in pages), it only sets it. */
  set(lang: Lang): void {
    this.language.setLang(lang);
    if (this.accounts.signedIn()) this.save(this.accounts.person().id, lang);
  }

  private save(personId: string, lang: Lang): void {
    this.accounts.updatePerson(personId, (p) => (p.lang === lang ? p : { ...p, lang }));
  }
}
