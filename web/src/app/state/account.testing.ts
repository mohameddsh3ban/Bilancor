import { TestBed } from '@angular/core/testing';
import { PERSON } from '../data/sample-person';
import { AccountService } from './account.service';

/**
 * For tests that open a page of the app (its guards let only a signed-in person in) and are about something else: signs
 * Sara in, as the sign-in page does without a trusted device or a language pick. Call it before the router first runs.
 */
export function signInAsSara(): void {
  TestBed.inject(AccountService).signIn(PERSON.id, false);
}
