import { TestBed } from '@angular/core/testing';
import { SafeStorage } from '../core/storage/safe-storage';
import { PERSON } from '../data/sample-person';
import { AccountService, demoBackupCodes } from './account.service';

const newPerson = {
  firstName: 'Mia',
  lastName: 'Becker',
  email: 'Mia@Example.com',
  lang: 'de' as const,
};

describe('AccountService', () => {
  beforeEach(() => localStorage.clear());

  it('starts signed out, with Sara as the only person and as the sample person', () => {
    const accounts = TestBed.inject(AccountService);
    expect(accounts.samplePerson).toBe(PERSON);
    expect(accounts.persons()).toEqual([PERSON]);
    expect(accounts.signedIn()).toBe(false);
    expect(accounts.person()).toBe(PERSON);
    expect(accounts.signIns()).toBe(0);
  });

  it('a stored session for Sara signs her in at start', () => {
    localStorage.setItem('mockup.session', 'p1');
    const accounts = TestBed.inject(AccountService);
    expect(accounts.signedIn()).toBe(true);
    expect(accounts.person().id).toBe('p1');
    // Being signed in at start is not a sign-in: only a real one makes the tax reminder open again.
    expect(accounts.signIns()).toBe(0);
  });

  it('a stored session for an unknown person counts as signed out', () => {
    localStorage.setItem('mockup.session', 'visit-1');
    const accounts = TestBed.inject(AccountService);
    expect(accounts.signedIn()).toBe(false);
    expect(accounts.person()).toBe(PERSON);
  });

  describe('the sample email', () => {
    it("is Sara's email as it is now: a change follows, a made account doesn't count, and a reset brings it back", () => {
      const accounts = TestBed.inject(AccountService);
      expect(accounts.sampleEmail()).toBe('sara@example.com');
      accounts.createPerson(newPerson);
      expect(accounts.sampleEmail()).toBe('sara@example.com');

      accounts.updatePerson('p1', (p) => ({ ...p, email: 'sara.klein@example.com' }));
      expect(accounts.sampleEmail()).toBe('sara.klein@example.com');
      // The new address is the one that finds her.
      expect(accounts.findByEmail(accounts.sampleEmail())?.id).toBe('p1');
      expect(accounts.emailTaken('sara@example.com')).toBe(false);

      accounts.reset();
      expect(accounts.sampleEmail()).toBe('sara@example.com');
    });
  });

  describe('finding a person by email', () => {
    it('ignores capitals and spaces around the address', () => {
      const accounts = TestBed.inject(AccountService);
      expect(accounts.findByEmail(' Sara@Example.com ')).toBe(PERSON);
      expect(accounts.emailTaken('SARA@example.com')).toBe(true);
      expect(accounts.findByEmail('mia@example.com')).toBeUndefined();
      expect(accounts.emailTaken('mia@example.com')).toBe(false);
    });

    it('finds an account made in the demo, whatever case it was typed in', () => {
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      expect(accounts.findByEmail(' MIA@example.COM ')?.id).toBe(id);
      expect(accounts.emailTaken('mia@example.com')).toBe(true);
    });
  });

  describe('signing in and out', () => {
    it('signing in as Sara signs her in, counts the sign-in and stores the session', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      expect(accounts.signedIn()).toBe(true);
      expect(accounts.person().id).toBe('p1');
      expect(accounts.signIns()).toBe(1);
      expect(TestBed.inject(SafeStorage).get('mockup.session')).toBe('p1');

      accounts.signIn('p1', false);
      expect(accounts.signIns()).toBe(2);
    });

    it('signing in as a visit account removes the stored session', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      const id = accounts.createPerson(newPerson);
      accounts.signIn(id, false);
      expect(accounts.person().id).toBe(id);
      expect(accounts.signedIn()).toBe(true);
      expect(localStorage.getItem('mockup.session')).toBeNull();
      expect(TestBed.inject(SafeStorage).get('mockup.session')).toBeNull();
    });

    it('signing in as a person nobody knows changes nothing', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('nobody', true);
      expect(accounts.signedIn()).toBe(false);
      expect(accounts.signIns()).toBe(0);
      expect(accounts.isTrusted('nobody')).toBe(false);
    });

    it('signOut forgets the session; reset also forgets the trusted device and the visit accounts', () => {
      const accounts = TestBed.inject(AccountService);
      const storage = TestBed.inject(SafeStorage);
      accounts.signIn('p1', true);
      const id = accounts.createPerson(newPerson);
      accounts.signIn(id, true);
      accounts.signIn('p1', false);
      expect(accounts.isTrusted('p1')).toBe(true);
      expect(accounts.isTrusted(id)).toBe(true);

      accounts.signOut();
      expect(accounts.signedIn()).toBe(false);
      expect(accounts.person()).toBe(PERSON);
      expect(storage.get('mockup.session')).toBeNull();
      expect(localStorage.getItem('mockup.session')).toBeNull();
      expect(accounts.isTrusted('p1')).toBe(true);
      expect(accounts.persons().length).toBe(2);

      accounts.signIn('p1', false);
      accounts.reset();
      expect(accounts.signedIn()).toBe(false);
      expect(storage.get('mockup.session')).toBeNull();
      expect(accounts.isTrusted('p1')).toBe(false);
      expect(accounts.isTrusted(id)).toBe(false);
      expect(localStorage.getItem('mockup.trusted.p1')).toBeNull();
      expect(accounts.persons()).toEqual([PERSON]);
      expect(accounts.findByEmail('mia@example.com')).toBeUndefined();
    });

    it('a sign-in that does not tick the box leaves a trusted device as it was; ticking it trusts only that person', () => {
      const accounts = TestBed.inject(AccountService);
      expect(accounts.isTrusted('p1')).toBe(false);
      accounts.signIn('p1', false);
      expect(accounts.isTrusted('p1')).toBe(false);
      accounts.signIn('p1', true);
      expect(accounts.isTrusted('p1')).toBe(true);
      accounts.signIn('p1', false);
      expect(accounts.isTrusted('p1')).toBe(true);
      expect(localStorage.getItem('mockup.trusted.p1')).not.toBeNull();
    });

    it('forgetTrust asks for the code again at the next sign-in, for that person only, and keeps the sign-in', () => {
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      accounts.signIn('p1', true);
      accounts.signIn(id, true);
      accounts.forgetTrust('p1');
      expect(accounts.isTrusted('p1')).toBe(false);
      expect(localStorage.getItem('mockup.trusted.p1')).toBeNull();
      expect(accounts.isTrusted(id)).toBe(true);
      // The person who is in stays in; only the trusted device is forgotten.
      expect(accounts.person().id).toBe(id);
      // A person nobody has, or one with no trusted device, is fine.
      accounts.forgetTrust('p1');
      accounts.forgetTrust('nobody');
      expect(accounts.isTrusted('nobody')).toBe(false);
    });

    it('the sign-in count never goes back, not even after a reset', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      accounts.signIn('p1', false);
      accounts.reset();
      expect(accounts.signIns()).toBe(2);
      accounts.signIn('p1', false);
      expect(accounts.signIns()).toBe(3);
    });
  });

  describe('createPerson', () => {
    it('makes a visit account with this device as its only device and 8 backup codes, and does not sign it in', () => {
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      expect(id).toBe('visit-1');
      const made = accounts.persons().find((p) => p.id === id)!;
      expect(made).toMatchObject({
        firstName: 'Mia',
        lastName: 'Becker',
        email: 'mia@example.com',
        lang: 'de',
        backupCodesLeft: 8,
      });
      expect(made.devices).toHaveLength(1);
      expect(made.devices[0]).toMatchObject({ current: true, lastSeen: null });
      expect(accounts.persons()).toHaveLength(2);
      expect(accounts.signedIn()).toBe(false);
      expect(accounts.signIns()).toBe(0);
    });

    it('numbers the accounts one after another, and never reuses a number after a reset', () => {
      const accounts = TestBed.inject(AccountService);
      expect(accounts.createPerson(newPerson)).toBe('visit-1');
      expect(accounts.createPerson({ ...newPerson, email: 'b@example.com' })).toBe('visit-2');
      accounts.reset();
      expect(accounts.createPerson({ ...newPerson, email: 'c@example.com' })).toBe('visit-3');
    });

    it("a new account doesn't inherit a trusted device that an earlier page load left in storage", () => {
      localStorage.setItem('mockup.trusted.visit-1', '1');
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      expect(id).toBe('visit-1');
      expect(accounts.isTrusted(id)).toBe(false);
    });
  });

  describe('updatePerson', () => {
    it('replaces one person and leaves the others as they are', () => {
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      const before = accounts.persons();
      accounts.updatePerson(id, (p) => ({ ...p, firstName: 'Maya' }));
      expect(accounts.persons().find((p) => p.id === id)!.firstName).toBe('Maya');
      expect(accounts.persons()[0]).toBe(before[0]);
    });

    it('the signed-in person follows the change', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      accounts.updatePerson('p1', (p) => ({ ...p, lang: 'ar' }));
      expect(accounts.person().lang).toBe('ar');
      expect(PERSON.lang).toBeNull();
    });

    it('ignores an unknown person, and a change that returns the same person changes nothing', () => {
      const accounts = TestBed.inject(AccountService);
      const before = accounts.persons();
      accounts.updatePerson('nobody', (p) => ({ ...p, firstName: 'X' }));
      accounts.updatePerson('p1', (p) => p);
      expect(accounts.persons()).toBe(before);
    });
  });

  describe('devices', () => {
    it('signOutDevice takes one other device out of the list', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      accounts.signOutDevice('d2');
      expect(accounts.person().devices.map((d) => d.id)).toEqual(['d1']);
    });

    it('signOutDevice never takes this device out, and ignores an id nobody has', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      const before = accounts.persons();
      accounts.signOutDevice('d1');
      accounts.signOutDevice('nope');
      expect(accounts.persons()).toBe(before);
    });

    it("signOutDevice only touches the signed-in person's devices", () => {
      const accounts = TestBed.inject(AccountService);
      const id = accounts.createPerson(newPerson);
      accounts.signIn(id, false);
      const before = accounts.persons();
      accounts.signOutDevice('d2');
      expect(accounts.persons()).toBe(before);
    });

    it('signOutOtherDevices keeps this device', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      accounts.signOutOtherDevices();
      expect(accounts.person().devices).toHaveLength(1);
      expect(accounts.person().devices[0]).toMatchObject({ id: 'd1', current: true });
      const after = accounts.persons();
      accounts.signOutOtherDevices();
      expect(accounts.persons()).toBe(after);
    });

    it('signOutOtherDevices can name a person who is not signed in (a new password)', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signOutOtherDevices('p1');
      expect(accounts.persons()[0].devices.map((d) => d.id)).toEqual(['d1']);
      expect(accounts.signedIn()).toBe(false);
    });

    it("with nobody signed in, signing a device out or every other one out leaves Sara's devices as they are", () => {
      // person() is Sara while nobody is signed in, but she is only the sample person then, not somebody who is in.
      const accounts = TestBed.inject(AccountService);
      const before = accounts.persons();
      accounts.signOutDevice('d2');
      accounts.signOutOtherDevices();
      expect(accounts.persons()).toBe(before);
      expect(accounts.persons()[0].devices.map((d) => d.id)).toEqual(['d1', 'd2']);
    });
  });

  describe('backup codes', () => {
    it('makeBackupCodes gives 8 codes and 8 left; useBackupCode counts down and refuses at 0', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      expect(accounts.person().backupCodesLeft).toBe(6);

      const codes = accounts.makeBackupCodes();
      expect(codes).toHaveLength(8);
      expect(codes.every((code) => /^\d{4}-\d{4}$/.test(code))).toBe(true);
      expect(accounts.person().backupCodesLeft).toBe(8);

      for (let left = 8; left > 0; left--) {
        expect(accounts.useBackupCode('p1')).toBe(true);
        expect(accounts.person().backupCodesLeft).toBe(left - 1);
      }
      expect(accounts.useBackupCode('p1')).toBe(false);
      expect(accounts.person().backupCodesLeft).toBe(0);
    });

    it("with nobody signed in, makeBackupCodes gives nothing and leaves Sara's codes and the next set as they were", () => {
      const accounts = TestBed.inject(AccountService);
      const before = accounts.persons();
      expect(accounts.makeBackupCodes()).toEqual([]);
      expect(accounts.persons()).toBe(before);
      expect(accounts.persons()[0].backupCodesLeft).toBe(6);
      // The failed call used up no set: the first one made once somebody is in is still the first.
      accounts.signIn('p1', false);
      expect(accounts.makeBackupCodes()).toEqual(demoBackupCodes(1));
    });

    it('useBackupCode refuses a person nobody knows', () => {
      expect(TestBed.inject(AccountService).useBackupCode('nobody')).toBe(false);
    });

    it('useBackupCode works for a person who is not signed in yet (the code screen)', () => {
      const accounts = TestBed.inject(AccountService);
      expect(accounts.useBackupCode('p1')).toBe(true);
      expect(accounts.persons()[0].backupCodesLeft).toBe(5);
    });

    it('each time new codes are made they are a new set, and the first set is the one sign-up shows', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      const first = accounts.makeBackupCodes();
      const second = accounts.makeBackupCodes();
      expect(first).not.toEqual(second);
      expect(first).not.toEqual(demoBackupCodes(0));
    });

    it('reset puts Sara back to 6 codes and 2 devices', () => {
      const accounts = TestBed.inject(AccountService);
      accounts.signIn('p1', false);
      accounts.makeBackupCodes();
      accounts.signOutOtherDevices();
      accounts.updatePerson('p1', (p) => ({ ...p, lang: 'de' }));
      accounts.reset();
      expect(accounts.person()).toBe(PERSON);
      expect(accounts.person().backupCodesLeft).toBe(6);
      expect(accounts.person().devices).toHaveLength(2);
      expect(accounts.person().lang).toBeNull();
    });
  });
});

describe('demoBackupCodes', () => {
  it('gives 8 different codes of the form 1234-5678', () => {
    const codes = demoBackupCodes(0);
    expect(codes).toHaveLength(8);
    expect(new Set(codes).size).toBe(8);
    expect(codes.every((code) => /^\d{4}-\d{4}$/.test(code))).toBe(true);
  });

  it('is the same every time for a round, and different from round to round', () => {
    expect(demoBackupCodes(3)).toEqual(demoBackupCodes(3));
    const rounds = Array.from({ length: 20 }, (_, round) => demoBackupCodes(round).join(' '));
    expect(new Set(rounds).size).toBe(20);
    for (let round = 0; round < 20; round++) expect(new Set(demoBackupCodes(round)).size).toBe(8);
  });
});
