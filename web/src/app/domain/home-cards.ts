import type { SetupState } from '../data/models';

export interface SetupSteps {
  bank: boolean;
  tax: boolean;
  receipt: boolean;
}

export interface HomeCards {
  checklist: boolean;
  transactions: boolean;
  balances: boolean;
  tax: boolean;
  decisions: boolean;
}

export function setupSteps(state: SetupState): SetupSteps {
  switch (state) {
    case 'new':
      return { bank: false, tax: false, receipt: false };
    case 'halfway':
      return { bank: true, tax: false, receipt: false };
    case 'active':
      return { bank: true, tax: true, receipt: true };
  }
}

export function homeCards(state: SetupState): HomeCards {
  const steps = setupSteps(state);
  const allDone = steps.bank && steps.tax && steps.receipt;
  return {
    checklist: !allDone,
    transactions: steps.bank,
    balances: steps.bank,
    tax: steps.tax,
    decisions: steps.receipt,
  };
}
