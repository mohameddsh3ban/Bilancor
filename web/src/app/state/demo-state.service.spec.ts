import { TestBed } from '@angular/core/testing';
import { PERSON } from '../data/sample-data';
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
});
