import type { Business, SetupState, SetupSteps } from '../data/models';
import { owedSummary } from './invoices';

/** A business that was never touched has finished its setup. */
export const ALL_DONE: SetupSteps = Object.freeze({ bank: true, tax: true, receipt: true });

export interface HomeCards {
  checklist: boolean;
  transactions: boolean;
  balances: boolean;
  tax: boolean;
  decisions: boolean;
  owed: boolean;
}

/** The steps a demo toolbar shortcut sets. */
export function presetSteps(preset: SetupState): SetupSteps {
  switch (preset) {
    case 'new':
      return { bank: false, tax: false, receipt: false };
    case 'halfway':
      return { bank: true, tax: false, receipt: false };
    case 'active':
      return { bank: true, tax: true, receipt: true };
  }
}

/** The shortcut whose steps these are exactly, or null for any other mix. */
export function presetOf(steps: SetupSteps): SetupState | null {
  const presets: readonly SetupState[] = ['new', 'halfway', 'active'];
  return (
    presets.find((preset) => {
      const wanted = presetSteps(preset);
      return wanted.bank === steps.bank && wanted.tax === steps.tax && wanted.receipt === steps.receipt;
    }) ?? null
  );
}

/**
 * Which cards the homepage shows. What customers owe shows once the bank step is done and something is owed (an
 * invoice with money left to pay), so a business that has sent nothing, or has been paid in full, has no such card.
 */
export function homeCards(steps: SetupSteps, business: Business): HomeCards {
  const allDone = steps.bank && steps.tax && steps.receipt;
  return {
    checklist: !allDone,
    transactions: steps.bank,
    balances: steps.bank,
    tax: steps.tax,
    decisions: steps.receipt,
    owed: steps.bank && owedSummary(business, steps).owedCount > 0,
  };
}
