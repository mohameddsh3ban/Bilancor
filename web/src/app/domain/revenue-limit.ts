/** Kleinunternehmer revenue limit in euro cents (€25,000). */
export const LIMIT_CENTS = 2_500_000;
/** Hard revenue limit in euro cents (€100,000). */
export const HARD_LIMIT_CENTS = 10_000_000;
/** Warning starts at 80 % of the limit (€20,000), inclusive. */
export const WARNING_CENTS = 2_000_000;

export type RevenueLimitLevel = 'ok' | 'warning' | 'overNextYear' | 'overNow';

export interface RevenueLimitStatus {
  limitCents: typeof LIMIT_CENTS;
  hardLimitCents: typeof HARD_LIMIT_CENTS;
  percent: number;
  level: RevenueLimitLevel;
}

export function revenueLimitStatus(revenueCents: number): RevenueLimitStatus {
  let level: RevenueLimitLevel;
  if (revenueCents > HARD_LIMIT_CENTS) {
    level = 'overNow';
  } else if (revenueCents > LIMIT_CENTS) {
    level = 'overNextYear';
  } else if (revenueCents >= WARNING_CENTS) {
    level = 'warning';
  } else {
    level = 'ok';
  }

  return {
    limitCents: LIMIT_CENTS,
    hardLimitCents: HARD_LIMIT_CENTS,
    percent: Math.round((revenueCents * 100) / LIMIT_CENTS),
    level,
  };
}
