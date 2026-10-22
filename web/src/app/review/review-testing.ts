import { OFFICE } from '../data/categories';
import type { ReviewItem } from '../domain/review-queue';
import type { DemoStateService } from '../state/demo-state.service';

/**
 * For tests that need a card answered but not its screen: settles whatever is wrong with the item in one go, so it
 * leaves the review queue.
 */
export function settleItem(demo: DemoStateService, item: ReviewItem): void {
  if (item.kind === 'payment') {
    demo.updateTransaction(item.id, (tx) => ({
      ...tx,
      booking: tx.booking ?? OFFICE,
      confirmed: true,
      receipt: tx.receipt === 'missing' ? 'notNeeded' : tx.receipt,
    }));
  } else {
    demo.updateDocument(item.id, (doc) => ({ ...doc, amountCents: doc.amountCents ?? 1000 }));
  }
}
