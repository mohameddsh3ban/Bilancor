import { Notice, NoticeKind, SetupSteps, TaxProfile } from '../data/models';

/** The setup step a notice kind needs: until it is done, the notice has nothing to talk about. */
const STEP_FOR_KIND: Record<NoticeKind, keyof SetupSteps> = {
  bankExpiry: 'bank',
  bankEnded: 'bank',
  terms: 'bank',
  unreadable: 'receipt',
  revenueLimit: 'tax',
};

/**
 * The text key of a notice. A bank connection that ends tomorrow or today has a text of its own ("in 1 day", "today"),
 * so no sentence says "in 1 days" or "in 0 days"; every other notice has one text.
 */
export function noticeTextKey(notice: Notice): string {
  const key = `notice.${notice.kind}.text`;
  if (notice.kind !== 'bankExpiry') return key;
  const days = Number(notice.params['days']);
  if (days === 0) return `${key}Today`;
  return days === 1 ? `${key}One` : key;
}

/**
 * Keeps only the notices whose setup step is done. The revenue-limit notice also needs a Kleinunternehmer: once the
 * business charges VAT there is no limit to warn about. Applies to open notices and history alike.
 */
export function noticesForSetup(notices: Notice[], steps: SetupSteps, profile: TaxProfile): Notice[] {
  return notices.filter(
    (n) => steps[STEP_FOR_KIND[n.kind]] && (n.kind !== 'revenueLimit' || profile.kleinunternehmer),
  );
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
