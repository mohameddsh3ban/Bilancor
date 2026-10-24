import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AccountService } from '../state/account.service';

// The guards sit in the app's first load, so they use the account service only (it reaches no sample data): the app
// shell, the pages and the demo state they let a person into are lazy routes.

/** Every page of the app needs a signed-in person: anybody else goes to the sign-in page, which brings them back after. */
export const signedInGuard: CanActivateFn = (_route, state) => {
  if (inject(AccountService).signedIn()) return true;
  // The homepage is where signing in goes anyway, so there is nothing to remember for it.
  const queryParams = state.url === '/' ? undefined : { next: state.url };
  return inject(Router).createUrlTree(['/sign-in'], { queryParams });
};

/** The sign-in pages are for people who are not in: a signed-in person goes to the homepage instead. */
export const signedOutGuard: CanActivateFn = () =>
  inject(AccountService).signedIn() ? inject(Router).createUrlTree(['/']) : true;
