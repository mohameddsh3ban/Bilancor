import { TestBed } from '@angular/core/testing';
import { AccountService } from './account.service';
import { signInAsSara } from './account.testing';

describe('signInAsSara', () => {
  beforeEach(() => localStorage.clear());

  it('signs Sara in', () => {
    const accounts = TestBed.inject(AccountService);
    expect(accounts.signedIn()).toBe(false);
    signInAsSara();
    expect(accounts.signedIn()).toBe(true);
    expect(accounts.person().id).toBe('p1');
  });
});
