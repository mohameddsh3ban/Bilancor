import { Injectable, computed, signal } from '@angular/core';
import { Business, Doc, Person, SetupState, Transaction } from '../data/models';
import { BUSINESSES, PERSON } from '../data/sample-data';
import { applyRuleToUnclear, followCategoryChange, type CategoryRule } from '../domain/category-rules';
import { linkDocument, unlinkDocument } from '../domain/document-actions';
import { setupSteps } from '../domain/home-cards';

const DEFAULT_BUSINESS_ID = 'weber-design';

/** A fresh copy of the sample businesses, so edits never touch the shared sample data. */
function freshBusinesses(): Business[] {
  return structuredClone(BUSINESSES).filter((b) => PERSON.businessIds.includes(b.id));
}

/** The demo's "who is signed in, which business is open, how far setup is" state, plus the editable sample data. */
@Injectable({ providedIn: 'root' })
export class DemoStateService {
  readonly person: Person = PERSON;

  /** The working copy of the sample data; every edit replaces objects, never changes them in place. */
  private readonly data = signal<Business[]>(freshBusinesses());
  private readonly businessIdSignal = signal(DEFAULT_BUSINESS_ID);
  private readonly setupSignal = signal<SetupState>('active');
  private readonly generationSignal = signal(0);

  readonly business = computed<Business>(() => {
    const all = this.data();
    return all.find((b) => b.id === this.businessIdSignal()) ?? all[0];
  });
  /** The open business's documents as they are now, unfiltered. */
  readonly documents = computed<Doc[]>(() => this.business().documents);
  readonly setup = this.setupSignal.asReadonly();
  /** Goes up on every `resetData()`, so work that started before a reset can tell its data is gone. */
  readonly dataGeneration = this.generationSignal.asReadonly();
  /** Whether the person has connected a bank yet; until then there are no payments to show. */
  readonly bankConnected = computed(() => setupSteps(this.setupSignal()).bank);

  /** The person's businesses as they are now (including edits). */
  get businesses(): Business[] {
    return this.data();
  }

  setBusiness(id: string): void {
    if (this.data().some((b) => b.id === id)) this.businessIdSignal.set(id);
  }

  setSetup(state: SetupState): void {
    this.setupSignal.set(state);
  }

  /**
   * Replaces one payment of the open business with the result of `change` (ignored for an unknown id).
   * When the payment gets a different category, the rule for its counterparty follows it (see `followCategoryChange`).
   */
  updateTransaction(id: string, change: (tx: Transaction) => Transaction): void {
    const openId = this.businessIdSignal();
    this.data.update((all) =>
      all.map((business) => {
        const before = business.id === openId ? business.transactions.find((t) => t.id === id) : undefined;
        if (!before) return business;
        const after = change(before);
        return {
          ...business,
          transactions: business.transactions.map((t) => (t.id === id ? after : t)),
          categoryRules: followCategoryChange(business.categoryRules, before, after),
        };
      }),
    );
  }

  /** Adds a document to the front of a business's documents (ignored for an unknown business). */
  addDocument(businessId: string, doc: Doc): void {
    this.updateBusiness(businessId, (business) => ({ ...business, documents: [doc, ...business.documents] }));
  }

  /** Replaces one document of a business (the open one unless named) with the result of `change` (ignored for an unknown id). */
  updateDocument(id: string, change: (doc: Doc) => Doc, businessId: string = this.businessIdSignal()): void {
    this.updateBusiness(businessId, (business) =>
      business.documents.some((d) => d.id === id)
        ? { ...business, documents: business.documents.map((d) => (d.id === id ? change(d) : d)) }
        : business,
    );
  }

  /** Removes a document of the open business; a document linked to a payment stays (unlink it first). */
  removeDocument(id: string): void {
    this.updateBusiness(this.businessIdSignal(), (business) =>
      business.documents.some((d) => d.id === id && d.paymentId === null)
        ? { ...business, documents: business.documents.filter((d) => d.id !== id) }
        : business,
    );
  }

  /**
   * Links a document to a payment of a business (the open one unless named): one change to both, one history line each.
   * Ignored when the document is linked already or the payment's receipt is not missing, so a repeated call does nothing.
   */
  link(docId: string, txId: string, auto = false, businessId: string = this.businessIdSignal()): void {
    this.updateBusiness(businessId, (business) => {
      const doc = business.documents.find((d) => d.id === docId);
      const tx = business.transactions.find((t) => t.id === txId);
      if (!doc || !tx || doc.paymentId !== null || tx.receipt !== 'missing') return business;
      const linked = linkDocument(doc, tx, auto);
      return {
        ...business,
        documents: business.documents.map((d) => (d.id === docId ? linked.doc : d)),
        transactions: business.transactions.map((t) => (t.id === txId ? linked.tx : t)),
      };
    });
  }

  /** Takes a document of the open business off its payment, putting the payment back as it was. Ignored when it is not linked. */
  unlink(docId: string): void {
    this.updateBusiness(this.businessIdSignal(), (business) => {
      const doc = business.documents.find((d) => d.id === docId);
      const tx = doc?.paymentId ? business.transactions.find((t) => t.id === doc.paymentId) : undefined;
      if (!doc || !tx) return business;
      const unlinked = unlinkDocument(doc, tx);
      return {
        ...business,
        documents: business.documents.map((d) => (d.id === docId ? unlinked.doc : d)),
        transactions: business.transactions.map((t) => (t.id === tx.id ? unlinked.tx : t)),
      };
    });
  }

  /**
   * Learns a rule for the open business: payments from that counterparty get that booking from now on. Adds the rule,
   * or replaces the one for the same counterparty, then books the other unclear payments of the counterparty
   * (`exceptId` is the payment the person just answered, which already has its category). Returns the ids it booked.
   */
  addRule(rule: CategoryRule, exceptId: string): string[] {
    let bookedIds: string[] = [];
    this.updateBusiness(this.businessIdSignal(), (business) => {
      const applied = applyRuleToUnclear(business.transactions, rule, exceptId);
      bookedIds = applied.bookedIds;
      const known = business.categoryRules.some((r) => r.counterpartyKey === rule.counterpartyKey);
      return {
        ...business,
        transactions: applied.txs,
        categoryRules: known
          ? business.categoryRules.map((r) => (r.counterpartyKey === rule.counterpartyKey ? rule : r))
          : [...business.categoryRules, rule],
      };
    });
    return bookedIds;
  }

  /** A deep copy of the open business as it is now: its payments, documents and rules. Keep it to `restore` it (Undo). */
  snapshot(): Business {
    return structuredClone(this.business());
  }

  /**
   * Puts a business back as a snapshot had it (ignored when no business has the snapshot's id). It is a different object
   * from the snapshot, so a later restore of the same snapshot works again. The data is not reset: `dataGeneration` stays.
   */
  restore(snapshot: Business): void {
    this.data.update((all) =>
      all.some((b) => b.id === snapshot.id) ? all.map((b) => (b.id === snapshot.id ? structuredClone(snapshot) : b)) : all,
    );
  }

  /** Puts every edited payment and document back to the sample data (demo only). */
  resetData(): void {
    this.data.set(freshBusinesses());
    this.generationSignal.update((n) => n + 1);
  }

  /** Applies `change` to one business; when it returns the same object, nothing changes at all. */
  private updateBusiness(businessId: string, change: (business: Business) => Business): void {
    this.data.update((all) => {
      let changed = false;
      const next = all.map((business) => {
        if (business.id !== businessId) return business;
        const updated = change(business);
        changed = changed || updated !== business;
        return updated;
      });
      return changed ? next : all;
    });
  }
}
