import { Injectable, inject } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import { isClosedDate } from '../domain/months';
import { canWriteSelfIssued, selfIssuedDocFor, selfIssuedProblems, withoutVat, type SelfIssuedInput } from '../domain/self-issued';
import { DemoStateService } from './demo-state.service';

/** Where the person writes a self-issued receipt from: the payment's own page (which respects closed months), or the review inbox (which does not). */
export type SelfIssuedFrom = 'payment' | 'inbox';

/**
 * Writes the receipts a person makes for payments of the open business. Every change goes through `DemoStateService`, so Documents,
 * Payments, the review inbox and the taxes follow, and Reset demo takes it all back.
 */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private readonly demo = inject(DemoStateService);

  /**
   * Writes a self-issued receipt (Eigenbeleg) for a payment of the open business, as the signed-in person who confirms it is true: the
   * receipt is added to Documents, linked to the payment by hand (so the payment counts as worked on, an imported one too), and the
   * payment keeps its category but at 0 % VAT, with a `vatRemovedSelfIssued` line (see `withoutVat`). Returns the id of the receipt's
   * document, or null, with nothing changed, for a payment that can't have one (see `canWriteSelfIssued`) and for input that is not
   * complete (see `selfIssuedProblems`: the caller asks for the tick before it calls this).
   *
   * From the payment's page a payment in a closed month can't have a receipt; from the review inbox the closed months are not
   * checked, as Documents does not check them either. Undo is the caller's: take `snapshot()` first and `restore()` it, which takes
   * the receipt and the 0 % back, and its number with it.
   */
  createSelfIssued(txId: string, input: SelfIssuedInput, from: SelfIssuedFrom): string | null {
    const business = this.demo.business();
    const tx = business.transactions.find((t) => t.id === txId);
    if (!tx) return null;
    const isClosed = from === 'payment' ? (month: string) => isClosedDate(business, `${month}-01`) : () => false;
    if (!canWriteSelfIssued(tx, isClosed) || selfIssuedProblems(input, true).length > 0) return null;

    const person = this.demo.person;
    const doc = selfIssuedDocFor(business, tx, input, `${person.firstName} ${person.lastName}`, DEMO_TODAY);
    this.demo.addDocument(business.id, doc);
    this.demo.link(doc.id, txId, false, business.id);
    this.demo.updateTransaction(txId, (current) => withoutVat(current));
    return doc.id;
  }
}
