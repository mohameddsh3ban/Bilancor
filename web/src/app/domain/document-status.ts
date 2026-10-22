import { DEMO_TODAY } from '../data/demo-date';
import type { Doc, DocField, DocStatus, SetupState } from '../data/models';
import { setupSteps } from './home-cards';

/** The first of amount, date and name that reading could not find, or null when all three are there. */
export function missingField(doc: Doc): DocField | null {
  if (doc.amountCents === null) return 'amount';
  if (doc.date === null) return 'date';
  if (doc.name === null) return 'name';
  return null;
}

const CHECK_STATUS: Record<DocField, DocStatus> = {
  amount: 'checkAmount',
  date: 'checkDate',
  name: 'checkName',
};

/**
 * Where a document stands, decided in this order: still being read, a possible duplicate, no direction,
 * a field to check, linked to a payment, past its due date. Only a due date makes a document overdue.
 */
export function docStatus(doc: Doc, today = DEMO_TODAY): DocStatus {
  if (doc.reading) return 'reading';
  if (doc.duplicateOf !== null) return 'duplicate';
  if (doc.direction === null) return 'direction';
  const missing = missingField(doc);
  if (missing !== null) return CHECK_STATUS[missing];
  if (doc.paymentId !== null) return 'done';
  if (doc.dueDate !== null && doc.dueDate < today) return 'overdue';
  return 'waiting';
}

/** Whether the document is waiting for a decision from the person (a duplicate, a direction or a field to check). */
export function docNeedsYou(doc: Doc): boolean {
  const status = docStatus(doc);
  return status === 'duplicate' || status === 'direction' || status.startsWith('check');
}

/** How many documents are waiting for the person. */
export function docsNeedingYouCount(docs: readonly Doc[]): number {
  return docs.filter(docNeedsYou).length;
}

/** The documents the open business shows: everything once a bank is connected, before that only what was added in the demo. */
export function visibleDocuments(docs: readonly Doc[], setup: SetupState): Doc[] {
  return setupSteps(setup).bank ? [...docs] : docs.filter((doc) => doc.fromUpload);
}

/** What to call a document: its name, or its file name while the name is not known. */
export function docName(doc: Doc): string {
  return doc.name ?? doc.fileName;
}
