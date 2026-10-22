import { TestBed } from '@angular/core/testing';
import { BUSINESSES, PERSON } from '../data/sample-data';
import { needsYouCount, paymentStatus } from '../domain/payment-status';
import { DemoStateService } from './demo-state.service';

describe('DemoStateService', () => {
  it('starts with weber-design and an active setup', () => {
    const state = TestBed.inject(DemoStateService);
    expect(state.person).toBe(PERSON);
    expect(state.businesses.map((b) => b.id)).toEqual(PERSON.businessIds);
    expect(state.business().id).toBe('weber-design');
    expect(state.setup()).toBe('active');
  });

  it('setBusiness switches data', () => {
    const state = TestBed.inject(DemoStateService);
    state.setBusiness('sara-yoga');
    expect(state.business().taxProfile.kleinunternehmer).toBe(true);
  });

  it('setBusiness ignores an unknown id', () => {
    const state = TestBed.inject(DemoStateService);
    state.setBusiness('nope');
    expect(state.business().id).toBe('weber-design');
  });

  it('setSetup changes the setup state', () => {
    const state = TestBed.inject(DemoStateService);
    state.setSetup('new');
    expect(state.setup()).toBe('new');
  });

  it('bankConnected follows the setup state: no bank yet in "new", connected in "halfway" and "active"', () => {
    const state = TestBed.inject(DemoStateService);
    expect(state.bankConnected()).toBe(true);
    state.setSetup('new');
    expect(state.bankConnected()).toBe(false);
    state.setSetup('halfway');
    expect(state.bankConnected()).toBe(true);
    state.setSetup('active');
    expect(state.bankConnected()).toBe(true);
  });

  it('updateTransaction changes what business() returns and needsYouCount drops', () => {
    const state = TestBed.inject(DemoStateService);
    const before = needsYouCount(state.business().transactions);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    const tx = state.business().transactions.find((t) => t.id === 'wd-t3')!;
    expect(paymentStatus(tx)).toBe('booked');
    expect(needsYouCount(state.business().transactions)).toBe(before - 1);
    expect(state.businesses.find((b) => b.id === 'weber-design')).toBe(state.business());
  });

  it('updateTransaction ignores an unknown payment id', () => {
    const state = TestBed.inject(DemoStateService);
    const business = state.business();
    state.updateTransaction('nope', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(state.business()).toBe(business);
  });

  it('updateTransaction only changes the open business', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    state.setBusiness('sara-yoga');
    const sara = state.businesses.find((b) => b.id === 'sara-yoga')!;
    expect(state.business()).toBe(sara);
    expect(state.businesses.find((b) => b.id === 'weber-design')!.transactions.find((t) => t.id === 'wd-t3')!.receipt).toBe('notNeeded');
  });

  it('editing never changes the shared sample data', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    expect(BUSINESSES.find((b) => b.id === 'weber-design')!.transactions.find((t) => t.id === 'wd-t3')!.receipt).toBe('missing');
  });

  it('resetData restores the original sample data', () => {
    const state = TestBed.inject(DemoStateService);
    state.updateTransaction('wd-t3', (tx) => ({ ...tx, receipt: 'notNeeded' }));
    state.resetData();
    const tx = state.business().transactions.find((t) => t.id === 'wd-t3')!;
    expect(tx.receipt).toBe('missing');
    expect(state.business().id).toBe('weber-design');
  });
});
