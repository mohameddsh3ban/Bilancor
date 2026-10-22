import { Injectable, computed, signal } from '@angular/core';
import { Business, Person, SetupState, Transaction } from '../data/models';
import { BUSINESSES, PERSON } from '../data/sample-data';
import { setupSteps } from '../domain/home-cards';

const DEFAULT_BUSINESS_ID = 'weber-design';

/** A fresh copy of the sample businesses, so edits never touch the shared sample data. */
function freshBusinesses(): Business[] {
  return structuredClone(BUSINESSES).filter((b) => PERSON.businessIds.includes(b.id));
}

/** The demo's "who is signed in, which business is open, how far setup is" state, plus the editable sample data. */
@Injectable({ providedIn: 'root' })
export class DemoStateService {
  readonly person: Person = PERSON;

  /** The working copy of the sample data; every edit replaces objects, never changes them in place. */
  private readonly data = signal<Business[]>(freshBusinesses());
  private readonly businessIdSignal = signal(DEFAULT_BUSINESS_ID);
  private readonly setupSignal = signal<SetupState>('active');

  readonly business = computed<Business>(() => {
    const all = this.data();
    return all.find((b) => b.id === this.businessIdSignal()) ?? all[0];
  });
  readonly setup = this.setupSignal.asReadonly();
  /** Whether the person has connected a bank yet; until then there are no payments to show. */
  readonly bankConnected = computed(() => setupSteps(this.setupSignal()).bank);

  /** The person's businesses as they are now (including edits). */
  get businesses(): Business[] {
    return this.data();
  }

  setBusiness(id: string): void {
    if (this.data().some((b) => b.id === id)) this.businessIdSignal.set(id);
  }

  setSetup(state: SetupState): void {
    this.setupSignal.set(state);
  }

  /** Replaces one payment of the open business with the result of `change` (ignored for an unknown id). */
  updateTransaction(id: string, change: (tx: Transaction) => Transaction): void {
    const openId = this.businessIdSignal();
    this.data.update((all) =>
      all.map((business) => {
        if (business.id !== openId || !business.transactions.some((t) => t.id === id)) return business;
        return { ...business, transactions: business.transactions.map((t) => (t.id === id ? change(t) : t)) };
      }),
    );
  }

  /** Puts every edited payment back to the sample data (demo only). */
  resetData(): void {
    this.data.set(freshBusinesses());
  }
}
