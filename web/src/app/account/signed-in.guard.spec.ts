import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AccountService } from '../state/account.service';
import { signInAsSara } from '../state/account.testing';
import { signedInGuard, signedOutGuard } from './signed-in.guard';

@Component({ template: '' })
class Stub {}

describe('the sign-in guards', () => {
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', pathMatch: 'full', component: Stub, canActivate: [signedInGuard] },
          { path: 'payments', component: Stub, canActivate: [signedInGuard] },
          { path: 'settings', component: Stub, canActivate: [signedInGuard] },
          { path: 'sign-in', component: Stub, canActivate: [signedOutGuard] },
        ]),
      ],
    });
    router = TestBed.inject(Router);
  });

  describe('signedInGuard', () => {
    it('lets a signed-in person in', async () => {
      signInAsSara();
      await RouterTestingHarness.create('/payments');
      expect(router.url).toBe('/payments');
    });

    it('sends a signed-out visitor to the sign-in page, keeping the page asked for', async () => {
      await RouterTestingHarness.create('/payments');
      expect(router.url).toBe('/sign-in?next=%2Fpayments');
    });

    it('keeps the query and the place on the page too', async () => {
      await RouterTestingHarness.create('/settings?tab=bank#people');
      const tree = router.parseUrl(router.url);
      expect(tree.queryParams['next']).toBe('/settings?tab=bank#people');
    });

    it('leaves out the page asked for when it is the homepage', async () => {
      await RouterTestingHarness.create('/');
      expect(router.url).toBe('/sign-in');
    });
  });

  describe('signedOutGuard', () => {
    it('lets a signed-out visitor see the page', async () => {
      await RouterTestingHarness.create('/sign-in');
      expect(router.url).toBe('/sign-in');
    });

    it('sends a signed-in person to the homepage', async () => {
      signInAsSara();
      expect(TestBed.inject(AccountService).signedIn()).toBe(true);
      await RouterTestingHarness.create('/sign-in');
      expect(router.url).toBe('/');
    });
  });
});
