import { Injectable, computed, signal } from '@angular/core';
import { BANKS, FOUND_ACCOUNTS } from '../data/banks';
import { DEMO_TODAY } from '../data/demo-date';
import {
  Account,
  Business,
  Doc,
  HistoryEntry,
  Person,
  SetupState,
  SetupSteps,
  TaxProfile,
  Transaction,
} from '../data/models';
import { BUSINESSES, PERSON } from '../data/sample-data';
import { bankNameOf, isAlreadyConnected, isRenewed, newConnection, noConnection } from '../domain/bank-connection';
import { applyRuleToUnclear, followCategoryChange, type CategoryRule } from '../domain/category-rules';
import { linkDocument, unlinkDocument } from '../domain/document-actions';
import { ALL_DONE, presetSteps } from '../domain/home-cards';

const DEFAULT_BUSINESS_ID = 'weber-design';

/** A fresh copy of the sample businesses, so edits never touch the shared sample data. */
function freshBusinesses(): Business[] {
  return structuredClone(BUSINESSES).filter((b) => PERSON.businessIds.includes(b.id));
}

/** The cash box of a business that has none: no payments, no balance, and no bank behind it. */
function newCashBox(businessId: string): Account {
  return {
    id: `${businessId}-cash`,
    kind: 'cash',
    name: 'Cash box',
    balanceCents: 0,
    lastUpdate: DEMO_TODAY,
    connection: noConnection('cash'),
    product: 'cash',
    iban: null,
  };
}

/** Whether two sets of tax answers are the same, field by field. */
function sameTaxProfile(a: TaxProfile, b: TaxProfile): boolean {
  const keys = Object.keys(a) as (keyof TaxProfile)[];
  return keys.length === Object.keys(b).length && keys.every((key) => a[key] === b[key]);
}

/** The demo's "who is signed in, which business is open, how far setup is" state, plus the editable sample data. */
@Injectable({ providedIn: 'root' })
export class DemoStateService {
  readonly person: Person = PERSON;

  /** The working copy of the sample data; every edit replaces objects, never changes them in place. */
  private readonly data = signal<Business[]>(freshBusinesses());
  private readonly businessIdSignal = signal(DEFAULT_BUSINESS_ID);
  /** The setup steps of each business that was ever changed; a business with no entry has every step done. */
  private readonly stepsByBusiness = signal<Record<string, SetupSteps>>({});
  private readonly generationSignal = signal(0);

  readonly business = computed<Business>(() => {
    const all = this.data();
    return all.find((b) => b.id === this.businessIdSignal()) ?? all[0];
  });
  /** The open business's documents as they are now, unfiltered. */
  readonly documents = computed<Doc[]>(() => this.business().documents);
  /** The open business's setup steps. */
  readonly setup = computed<SetupSteps>(() => this.stepsOf(this.businessIdSignal()));
  /** Goes up on every `resetData()`, so work that started before a reset can tell its data is gone. */
  readonly dataGeneration = this.generationSignal.asReadonly();
  /** Whether the person has connected a bank yet; until then there are no payments to show. */
  readonly bankConnected = computed(() => this.setup().bank);

  /** The person's businesses as they are now (including edits). */
  get businesses(): Business[] {
    return this.data();
  }

  setBusiness(id: string): void {
    if (this.data().some((b) => b.id === id)) this.businessIdSignal.set(id);
  }

  /** Sets the open business's steps to one of the demo toolbar's shortcuts; other businesses, accounts and answers stay as they are. */
  setSetup(preset: SetupState): void {
    const businessId = this.businessIdSignal();
    this.stepsByBusiness.update((all) => ({ ...all, [businessId]: presetSteps(preset) }));
  }

  /** The setup steps of any business, open or not; every step done for one that was never changed. */
  stepsOf(businessId: string): SetupSteps {
    return this.stepsByBusiness()[businessId] ?? ALL_DONE;
  }

  /** Marks one setup step of a business (the open one unless named) as done. Ignored when it is done already. */
  completeStep(step: keyof SetupSteps, businessId: string = this.businessIdSignal()): void {
    const current = this.stepsOf(businessId);
    if (current[step]) return;
    this.stepsByBusiness.update((all) => ({ ...all, [businessId]: { ...current, [step]: true } }));
  }

  /**
   * Saves the tax answers of the open business, adds one `taxChanged` line to its history and ticks the tax step. Answers
   * identical to the saved ones change nothing and add no line (the step is still ticked, so the page never has to be
   * saved twice to finish setup).
   */
  saveTaxProfile(profile: TaxProfile): void {
    this.updateBusiness(this.businessIdSignal(), (business) =>
      sameTaxProfile(business.taxProfile, profile)
        ? business
        : {
            ...business,
            taxProfile: { ...profile },
            history: [{ date: DEMO_TODAY, key: 'taxChanged', params: {} }, ...business.history],
          },
    );
    this.completeStep('tax');
  }

  /**
   * Ends the bank flow for the open business: the chosen accounts (of `bankId`, signed in at on the demo day) get a
   * connection with a consent of 180 days, payments asked for from `fetchFrom`, fetched at noon that day, and the bank
   * step is ticked. An account the business does not have yet is added (a copy, before its cash box); one it has gets
   * the connection. One `bankConnected` line for each account newly connected.
   *
   * An account that is connected already (bank step done) stays as it is, with no line, so a second call with the same
   * accounts changes nothing. The sample business accounts of that bank that are left out are not connected: they
   * become statement accounts and keep their payments. The accounts it is given are never changed (they are shared sample data).
   */
  connectAccounts(bankId: string, accounts: readonly Account[], fetchFrom: string): void {
    const bankDone = this.setup().bank;
    const bank = BANKS.find((b) => b.id === bankId)?.name ?? bankId;
    this.updateBusiness(this.businessIdSignal(), (business) => {
      const chosen = new Set(accounts.map((account) => account.id));
      const sample = new Set(
        (FOUND_ACCOUNTS[business.id]?.[bankId] ?? [])
          .filter((account) => account.product === 'business')
          .map((account) => account.id),
      );
      const lines: HistoryEntry[] = [];
      const connect = (account: Account): Account => {
        lines.push({ date: DEMO_TODAY, key: 'bankConnected', params: { bank, account: account.name } });
        return { ...account, connection: newConnection(fetchFrom) };
      };

      const had = new Set(business.accounts.map((account) => account.id));
      const kept = business.accounts.map((account) => {
        if (isAlreadyConnected(account, bankDone)) return account;
        if (chosen.has(account.id)) return connect(account);
        if (sample.has(account.id) && account.connection.kind !== 'statement') {
          return { ...account, connection: noConnection('statement') };
        }
        return account;
      });
      const added = [...new Map(accounts.map((account) => [account.id, account])).values()]
        .filter((account) => !had.has(account.id))
        .map(connect);
      if (added.length === 0 && kept.every((account, i) => account === business.accounts[i])) return business;

      const cashAt = kept.findIndex((account) => account.kind === 'cash');
      return {
        ...business,
        accounts: cashAt === -1 ? [...kept, ...added] : [...kept.slice(0, cashAt), ...added, ...kept.slice(cashAt)],
        history: [...lines.reverse(), ...business.history],
      };
    });
    this.completeStep('bank');
  }

  /** Gives the open business a cash box when it has none, with a `cashAdded` line. It does not count as the bank step. */
  addCashBox(): void {
    this.updateBusiness(this.businessIdSignal(), (business) =>
      business.accounts.some((account) => account.kind === 'cash')
        ? business
        : {
            ...business,
            accounts: [...business.accounts, newCashBox(business.id)],
            history: [{ date: DEMO_TODAY, key: 'cashAdded', params: {} }, ...business.history],
          },
    );
  }

  /**
   * Renews the bank connection of one account of the open business (Renew, or Sign in again once it has ended or
   * broken): a new consent of 180 days from the demo day, working again, fetched just now, with one `bankRenewed` line.
   * The date its payments were asked for from stays. Ignored for an account that has no bank connection (a statement
   * account, the cash box) and for an id that is not an account of the business. A connection that was renewed already
   * (its consent runs the full 180 days, and it works) stays as it is with no line, so a second call changes nothing.
   */
  renewConnection(accountId: string): void {
    this.updateBusiness(this.businessIdSignal(), (business) => {
      const account = business.accounts.find((a) => a.id === accountId);
      if (!account || account.connection.kind !== 'connected' || isRenewed(account.connection)) return business;
      const renewed = { ...account, connection: newConnection(account.connection.fetchFrom ?? DEMO_TODAY) };
      return {
        ...business,
        accounts: business.accounts.map((a) => (a.id === accountId ? renewed : a)),
        history: [
          { date: DEMO_TODAY, key: 'bankRenewed', params: { bank: bankNameOf(account) ?? account.name } },
          ...business.history,
        ],
      };
    });
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

  /** A deep copy of the open business as it is now. Keep it to `restore` its payments, documents and rules (Undo). */
  snapshot(): Business {
    return structuredClone(this.business());
  }

  /**
   * Puts the payments, documents and learned rules of a business back as a snapshot had them (ignored when no business
   * has the snapshot's id). Everything else of the business stays as it is now: its tax answers, accounts and history
   * may have changed since the snapshot, and Undo must not take those back. The restored lists are copies of the
   * snapshot's, so a later restore of the same snapshot works again. The data is not reset: `dataGeneration` stays.
   */
  restore(snapshot: Business): void {
    this.updateBusiness(snapshot.id, (business) => ({
      ...business,
      transactions: structuredClone(snapshot.transactions),
      documents: structuredClone(snapshot.documents),
      categoryRules: structuredClone(snapshot.categoryRules),
    }));
  }

  /** Puts every edited payment and document back to the sample data, and every business back to all steps done (demo only). */
  resetData(): void {
    this.data.set(freshBusinesses());
    this.stepsByBusiness.set({});
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
