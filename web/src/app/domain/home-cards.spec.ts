import { BUSINESSES } from '../data/sample-data';
import { ALL_DONE, homeCards, presetOf, presetSteps } from './home-cards';

describe('presetSteps', () => {
  it('new: no steps done', () => {
    expect(presetSteps('new')).toEqual({ bank: false, tax: false, receipt: false });
  });

  it('halfway: only the bank step done', () => {
    expect(presetSteps('halfway')).toEqual({ bank: true, tax: false, receipt: false });
  });

  it('active: all steps done', () => {
    expect(presetSteps('active')).toEqual({ bank: true, tax: true, receipt: true });
  });

  it('ALL_DONE is the active client', () => {
    expect(ALL_DONE).toEqual(presetSteps('active'));
  });
});

describe('presetOf', () => {
  it('presetSteps and presetOf round-trip the three presets', () => {
    for (const preset of ['new', 'halfway', 'active'] as const) {
      expect(presetOf(presetSteps(preset))).toBe(preset);
    }
    expect(presetOf(ALL_DONE)).toBe('active');
  });

  it('a mixed set has no preset', () => {
    expect(presetOf({ bank: false, tax: true, receipt: false })).toBeNull();
    expect(presetOf({ bank: true, tax: true, receipt: false })).toBeNull();
    expect(presetOf({ bank: false, tax: false, receipt: true })).toBeNull();
  });
});

describe('homeCards', () => {
  const weber = BUSINESSES.find((b) => b.id === 'weber-design')!;
  /** Weber Design with no invoices at all: nothing is owed. */
  const nothingOwed = { ...weber, invoices: [] };

  it('new: only the checklist shows', () => {
    expect(homeCards(presetSteps('new'), weber)).toEqual({
      checklist: true,
      transactions: false,
      balances: false,
      tax: false,
      decisions: false,
      owed: false,
    });
  });

  it('halfway: checklist, transactions, balances and what is owed show', () => {
    expect(homeCards(presetSteps('halfway'), weber)).toEqual({
      checklist: true,
      transactions: true,
      balances: true,
      tax: false,
      decisions: false,
      owed: true,
    });
  });

  it('active: checklist hides and all five cards show', () => {
    expect(homeCards(presetSteps('active'), weber)).toEqual({
      checklist: false,
      transactions: true,
      balances: true,
      tax: true,
      decisions: true,
      owed: true,
    });
  });

  it('owed shows only once the bank step is done and a customer owes something', () => {
    expect(homeCards(presetSteps('active'), nothingOwed).owed).toBe(false);
    expect(homeCards(presetSteps('halfway'), nothingOwed).owed).toBe(false);
    expect(homeCards({ bank: false, tax: true, receipt: true }, weber).owed).toBe(false);
    expect(homeCards({ bank: true, tax: false, receipt: false }, weber).owed).toBe(true);
  });
});
