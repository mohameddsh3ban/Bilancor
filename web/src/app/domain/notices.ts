import { Notice } from '../data/models';

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
