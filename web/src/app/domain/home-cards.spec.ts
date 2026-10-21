import { homeCards, setupSteps } from './home-cards';

describe('setupSteps', () => {
  it('new: no steps done', () => {
    expect(setupSteps('new')).toEqual({ bank: false, tax: false, receipt: false });
  });

  it('halfway: only the bank step done', () => {
    expect(setupSteps('halfway')).toEqual({ bank: true, tax: false, receipt: false });
  });

  it('active: all steps done', () => {
    expect(setupSteps('active')).toEqual({ bank: true, tax: true, receipt: true });
  });
});

describe('homeCards', () => {
  it('new: only the checklist shows', () => {
    expect(homeCards('new')).toEqual({
      checklist: true,
      transactions: false,
      balances: false,
      tax: false,
      decisions: false,
    });
  });

  it('halfway: checklist, transactions and balances show', () => {
    expect(homeCards('halfway')).toEqual({
      checklist: true,
      transactions: true,
      balances: true,
      tax: false,
      decisions: false,
    });
  });

  it('active: checklist hides and all four cards show', () => {
    expect(homeCards('active')).toEqual({
      checklist: false,
      transactions: true,
      balances: true,
      tax: true,
      decisions: true,
    });
  });
});
