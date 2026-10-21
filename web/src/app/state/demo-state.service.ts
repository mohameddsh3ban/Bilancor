import { Injectable, signal } from '@angular/core';
import { Business, Person, SetupState } from '../data/models';
import { BUSINESSES, PERSON } from '../data/sample-data';

/** The demo's "who is signed in, which business is open, how far setup is" state. */
@Injectable({ providedIn: 'root' })
export class DemoStateService {
  readonly person: Person = PERSON;
  readonly businesses: Business[] = BUSINESSES.filter((b) => PERSON.businessIds.includes(b.id));

  private readonly businessSignal = signal<Business>(this.businesses.find((b) => b.id === 'weber-design')!);
  private readonly setupSignal = signal<SetupState>('active');

  readonly business = this.businessSignal.asReadonly();
  readonly setup = this.setupSignal.asReadonly();

  setBusiness(id: string): void {
    const business = this.businesses.find((b) => b.id === id);
    if (business) this.businessSignal.set(business);
  }

  setSetup(state: SetupState): void {
    this.setupSignal.set(state);
  }
}
