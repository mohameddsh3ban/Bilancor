import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business } from '../data/models';
import { isClosedDate } from '../domain/months';
import { canWriteSelfIssued, selfIssuedDocFor, selfIssuedProblems, withoutVat, type SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from './demo-state.service';
import { UNDO_MS } from './review.service';

/** Where the person writes a self-issued receipt from: the payment's own page (which respects closed months), or the review inbox (which does not). */
export type SelfIssuedFrom = 'payment' | 'inbox';

/** A receipt that was just written from a payment's page and can still be taken back: the payment and the document, and the receipt's number. */
export interface WrittenReceipt {
  txId: string;
  docId: string;
  number: string;
}

/** What Undo needs of a written receipt: the data as it was before it, and which business and data it belongs to. */
interface UndoStep extends WrittenReceipt {
  snapshot: Business;
  scope: string;
}

/**
 * Writes the receipts a person makes for payments of the open business. Every change goes through `DemoStateService`, so Documents,
 * Payments, the review inbox and the taxes follow, and Reset demo takes it all back.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly demo = inject(DemoStateService);

  /** The business and the data generation the data belongs to: a receipt written in other data is never taken back into this. */
  private readonly scope = computed(() => `${this.demo.business().id}:${this.demo.dataGeneration()}`);
  private readonly step = signal<UndoStep | null>(null);
  private timer: ReturnType<typeof setTimeout> | undefined;

  /** The receipt just written from a payment's page, while Undo is on offer (see `undoWritten`); null once the time is over or the data changed. */
  readonly justWritten = computed<WrittenReceipt | null>(() => {
    const step = this.step();
    return step !== null && step.scope === this.scope() ? { txId: step.txId, docId: step.docId, number: step.number } : null;
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.timer));
  }

  /**
   * Writes a self-issued receipt (Eigenbeleg) for a payment of the open business, as the signed-in person who confirms it is true: the
   * receipt is added to Documents, linked to the payment by hand (so the payment counts as worked on, an imported one too), and the
   * payment keeps its category but at 0 % VAT, with a `vatRemovedSelfIssued` line (see `withoutVat`). Returns the id of the receipt's
   * document, or null, with nothing changed, for a payment that can't have one (see `canWriteSelfIssued`) and for input that is not
   * complete (see `selfIssuedProblems`: the caller asks for the tick before it calls this).
   *
   * From the payment's page a payment in a closed month can't have a receipt, and the receipt can be taken back for `UNDO_MS` (see
   * `justWritten` and `undoWritten`: the same snapshot and restore as the review inbox's Undo). From the review inbox the closed months
   * are not checked, as Documents does not check them either, and Undo is the inbox's own: it takes `snapshot()` before the answer and
   * `restore()`s it. Either way the receipt goes with its number, so none is ever left out.
   */
  createSelfIssued(txId: string, input: SelfIssuedInput, from: SelfIssuedFrom): string | null {
    const business = this.demo.business();
    const tx = business.transactions.find((t) => t.id === txId);
    if (!tx) return null;
    const isClosed = from === 'payment' ? (month: string) => isClosedDate(business, `${month}-01`) : () => false;
    if (!canWriteSelfIssued(tx, isClosed) || selfIssuedProblems(input, true).length > 0) return null;

    const snapshot = this.demo.snapshot();
    const person = this.demo.person;
    const doc = selfIssuedDocFor(business, tx, input, `${person.firstName} ${person.lastName}`, DEMO_TODAY);
    this.demo.addDocument(business.id, doc);
    this.demo.link(doc.id, txId, false, business.id);
    this.demo.updateTransaction(txId, (current) => withoutVat(current));
    if (from === 'payment') this.offerUndo({ txId, docId: doc.id, number: doc.invoiceNo, snapshot, scope: this.scope() });
    return doc.id;
  }

  /** Takes back the receipt just written from a payment's page, with the 0 % VAT it took off and its number. Does nothing once the time is over. */
  undoWritten(): void {
    if (this.justWritten() === null) return;
    const step = this.step()!;
    clearTimeout(this.timer);
    this.step.set(null);
    this.demo.restore(step.snapshot);
  }

  private offerUndo(step: UndoStep): void {
    clearTimeout(this.timer);
    this.step.set(step);
    this.timer = setTimeout(() => this.step.set(null), UNDO_MS);
  }
}
