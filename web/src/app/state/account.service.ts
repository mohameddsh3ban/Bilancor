import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { SafeStorage } from '../core/storage/safe-storage';
import type { Device, Lang, Person } from '../data/models';
import { PERSON } from '../data/sample-person';
import { normalEmail } from '../domain/people';

// Who can sign in, who is signed in, and what belongs to the login rather than to a business: its devices, backup codes
// and language. It sits in the app's first load (the sign-in pages and the guards use it), so it must not import
// anything that reaches `data/sample-data.ts`: the businesses are the demo state's.

/** The signed-in sample person's id: the only sign-in that survives a reload. */
const SESSION_KEY = 'mockup.session';
/** One key per person who ticked "Don't ask again on this device", under this prefix so Reset demo clears them all. */
const TRUSTED_PREFIX = 'mockup.trusted.';
const trustedKey = (personId: string): string => `${TRUSTED_PREFIX}${personId}`;

/** A full set of backup codes. */
const BACKUP_CODES = 8;

/**
 * The 8 backup codes the demo shows (`1234-5678`), the same every time for one round and a new set for each round. Round 0
 * is the first set, shown at sign-up and joining where nobody is signed in yet; Make new codes asks for the later rounds.
 * They are invented: nothing checks them, and any code signs in.
 */
export function demoBackupCodes(round: number): string[] {
  return Array.from({ length: BACKUP_CODES }, (_, i) => {
    // A multiplicative hash of the code's place, kept to 8 digits: no two of a round's 8 codes are alike.
    const digits = String(
      (Math.imul(round * BACKUP_CODES + i + 1, 2654435761) >>> 0) % 100_000_000,
    ).padStart(8, '0');
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  });
}

/** The device a new account is made on: the browser the visitor has open, as a sample row like Sara's. */
function thisDevice(personId: string): Device {
  return {
    id: `${personId}-d1`,
    browser: 'Chrome',
    system: 'Windows',
    place: 'Berlin',
    lastSeen: null,
    current: true,
  };
}

/**
 * The demo's logins: Sara, who always exists, and the accounts made during the visit (`visit-<n>`, kept in memory only,
 * so a reload forgets them). Signing in is remembered across a reload for Sara only. Nothing here is a real account.
 */
@Injectable({ providedIn: 'root' })
export class AccountService {
  private readonly storage = inject(SafeStorage);

  /** The demo's sample person: who the app shows while nobody is signed in. */
  readonly samplePerson: Person = PERSON;

  private readonly personList = signal<Person[]>([PERSON]);
  private readonly signedInId = signal<string | null>(this.storedSession());
  private readonly signInCount = signal(0);
  /** Never goes back, so the id of an account made during the visit is never used twice, not even after a reset. */
  private visitCounter = 0;
  /** Which set of backup codes Make new codes gives next (the first set is round 0, shown at sign-up). */
  private codeRound = 0;

  /** Everyone who can sign in. */
  readonly persons: Signal<Person[]> = this.personList.asReadonly();
  readonly signedIn: Signal<boolean> = computed(() => this.signedInId() !== null);
  /** The signed-in person, or the sample person when nobody is. */
  readonly person: Signal<Person> = computed(() => {
    const id = this.signedInId() ?? PERSON.id;
    return this.personList().find((p) => p.id === id) ?? PERSON;
  });
  /** Goes up by one on every sign-in (not at start with a remembered one), so the tax reminder can open again. */
  readonly signIns: Signal<number> = this.signInCount.asReadonly();

  /** The person who has this email, whatever its case or the spaces around it. */
  findByEmail(email: string): Person | undefined {
    const address = normalEmail(email);
    return this.personList().find((p) => normalEmail(p.email) === address);
  }

  emailTaken(email: string): boolean {
    return this.findByEmail(email) !== undefined;
  }

  /** Whether the person ticked "Don't ask again on this device", so the code step is skipped. */
  isTrusted(personId: string): boolean {
    return this.storage.get(trustedKey(personId)) !== null;
  }

  /**
   * Signs the person in (ignored for an id nobody has). Only the sample person's sign-in is remembered for a reload: an
   * account made in the demo is forgotten by one, so signing in as it forgets any stored sign-in. `trustDevice` remembers
   * this device for the person; leaving it off never forgets one that is remembered.
   */
  signIn(personId: string, trustDevice: boolean): void {
    if (!this.personList().some((p) => p.id === personId)) return;
    if (personId === PERSON.id) this.storage.set(SESSION_KEY, personId);
    else this.storage.remove(SESSION_KEY);
    if (trustDevice) this.storage.set(trustedKey(personId), '1');
    this.signedInId.set(personId);
    this.signInCount.update((n) => n + 1);
  }

  /** Forgets that this device was trusted for the person (a new password does), so the code is asked at the next sign-in. Nobody is signed out. */
  forgetTrust(personId: string): void {
    this.storage.remove(trustedKey(personId));
  }

  /** Signs out and forgets the remembered sign-in. A trusted device stays trusted. */
  signOut(): void {
    this.signedInId.set(null);
    this.storage.remove(SESSION_KEY);
  }

  /**
   * Makes an account (`visit-<n>`) with this device as its one device and a full set of 8 backup codes, and returns its
   * id. It does not sign in: that is `signIn`. The email is stored without capitals or spaces.
   */
  createPerson(input: { firstName: string; lastName: string; email: string; lang: Lang }): string {
    const id = `visit-${++this.visitCounter}`;
    // A page load that came before may have left a trusted device under this id for an account that is gone.
    this.storage.remove(trustedKey(id));
    const person: Person = {
      id,
      firstName: input.firstName,
      lastName: input.lastName,
      email: normalEmail(input.email),
      lang: input.lang,
      devices: [thisDevice(id)],
      backupCodesLeft: BACKUP_CODES,
    };
    this.personList.update((all) => [...all, person]);
    return id;
  }

  /** Replaces one person with the result of `change` (ignored for an id nobody has); a change that returns the same person changes nothing. */
  updatePerson(personId: string, change: (person: Person) => Person): void {
    this.personList.update((all) => {
      const found = all.find((p) => p.id === personId);
      if (!found) return all;
      const changed = change(found);
      return changed === found ? all : all.map((p) => (p === found ? changed : p));
    });
  }

  /** Signs one other device of the signed-in person out: it leaves the list. This device stays, and so does an id nobody has. */
  signOutDevice(deviceId: string): void {
    this.updatePerson(this.person().id, (p) =>
      p.devices.some((d) => d.id === deviceId && !d.current)
        ? { ...p, devices: p.devices.filter((d) => d.id !== deviceId) }
        : p,
    );
  }

  /** Signs every device but this one out, for the signed-in person unless one is named (a new password is chosen while nobody is signed in). */
  signOutOtherDevices(personId: string = this.person().id): void {
    this.updatePerson(personId, (p) =>
      p.devices.every((d) => d.current) ? p : { ...p, devices: p.devices.filter((d) => d.current) },
    );
  }

  /** Gives the signed-in person a new set of 8 backup codes (the old ones stop counting) and returns them, to be shown once. */
  makeBackupCodes(): string[] {
    this.updatePerson(this.person().id, (p) =>
      p.backupCodesLeft === BACKUP_CODES ? p : { ...p, backupCodesLeft: BACKUP_CODES },
    );
    return demoBackupCodes(++this.codeRound);
  }

  /** Uses up one backup code; false when none is left (or nobody has the id). Which code was typed is never checked. */
  useBackupCode(personId: string): boolean {
    const left = this.personList().find((p) => p.id === personId)?.backupCodesLeft ?? 0;
    if (left === 0) return false;
    this.updatePerson(personId, (p) => ({ ...p, backupCodesLeft: p.backupCodesLeft - 1 }));
    return true;
  }

  /** Reset demo: signs out, forgets the remembered sign-in and every trusted device, and drops the accounts made during the visit. Sara is as she was. */
  reset(): void {
    this.signedInId.set(null);
    this.storage.remove(SESSION_KEY);
    this.storage.removeWithPrefix(TRUSTED_PREFIX);
    this.personList.set([PERSON]);
    this.codeRound = 0;
  }

  /** The remembered sign-in, when it names someone who can sign in; an id nobody has counts as signed out. */
  private storedSession(): string | null {
    const stored = this.storage.get(SESSION_KEY);
    return stored !== null && this.personList().some((p) => p.id === stored) ? stored : null;
  }
}
