import type { Business, Doc, SetupSteps } from '../data/models';
import { docNeedsYou, docStatus, visibleDocuments } from './document-status';
import { paymentStatus } from './payment-status';

/** Why a payment is in the queue: its booking waits for a confirmation, its receipt is missing, or the system could not sort it. */
export type PaymentProblem = 'confirm' | 'noReceipt' | 'unclear';
/** Why a document is in the queue: the statuses of docStatus() that wait for the person. */
export type DocumentProblem = 'duplicate' | 'direction' | 'checkAmount' | 'checkDate' | 'checkName';

/** One thing the person has to decide, with the date it counts from. */
export type ReviewItem =
  | { kind: 'payment'; id: string; date: string; problem: PaymentProblem }
  | { kind: 'document'; id: string; date: string; problem: DocumentProblem };

/** Oldest first; on the same day payments come before documents, then by id. */
function compareItems(a: ReviewItem, b: ReviewItem): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  if (a.kind !== b.kind) return a.kind === 'payment' ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function documentItem(doc: Doc): ReviewItem {
  // docNeedsYou() is true only for these five statuses.
  return { kind: 'document', id: doc.id, date: doc.date ?? doc.addedOn, problem: docStatus(doc) as DocumentProblem };
}

/**
 * Everything the person has to decide, oldest first: the payments that are not booked (once a bank is connected)
 * and the documents they must look at. Every count of "things that need you" in the app is the length of this list.
 */
export function reviewItems(business: Business, steps: SetupSteps): ReviewItem[] {
  const payments: ReviewItem[] = [];
  if (steps.bank) {
    for (const tx of business.transactions) {
      const problem = paymentStatus(tx);
      if (problem !== 'booked') payments.push({ kind: 'payment', id: tx.id, date: tx.date, problem });
    }
  }
  const documents = visibleDocuments(business.documents, steps).filter(docNeedsYou).map(documentItem);
  return [...payments, ...documents].sort(compareItems);
}
