import { Notice, NoticeKind, SetupSteps } from '../data/models';

/** The setup step a notice kind needs: until it is done, the notice has nothing to talk about. */
const STEP_FOR_KIND: Record<NoticeKind, keyof SetupSteps> = {
  bankExpiry: 'bank',
  terms: 'bank',
  unreadable: 'receipt',
  revenueLimit: 'tax',
};

/** Keeps only the notices whose setup step is done. Applies to open notices and history alike. */
export function noticesForSetup(notices: Notice[], steps: SetupSteps): Notice[] {
  return notices.filter((n) => steps[STEP_FOR_KIND[n.kind]]);
}

/**
 * Puts the number of documents to check on the "receipts that could not be read" notice, which is left out when
 * there are none. Other notices are kept as they are.
 */
export function withUnreadableCount(notices: Notice[], count: number): Notice[] {
  return notices.flatMap((notice) => {
    if (notice.kind !== 'unreadable') return [notice];
    return count > 0 ? [{ ...notice, params: { ...notice.params, count } }] : [];
  });
}

/**
 * Hides dismissed notices (blocking ones can never be dismissed), orders the rest
 * most urgent first and splits them into the ones shown on the page and the overflow.
 */
export function splitNotices(
  notices: Notice[],
  dismissedIds: ReadonlySet<string>,
  max = 2,
): { shown: Notice[]; overflow: Notice[] } {
  const open = notices
    .filter((n) => n.blocking || !dismissedIds.has(n.id))
    .sort((a, b) => a.urgency - b.urgency);
  return { shown: open.slice(0, max), overflow: open.slice(max) };
}
