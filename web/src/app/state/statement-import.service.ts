import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { DEMO_TODAY } from '../data/demo-date';
import type { Business, ColumnMapping, SampleStatement } from '../data/models';
import { sampleStatementFor } from '../data/sample-statements';
import { certainMatch } from '../domain/document-matching';
import { invoiceMatch } from '../domain/invoices';
import { isClosedDate } from '../domain/months';
import { paymentStatus } from '../domain/payment-status';
import { importTransactions, previewImport, readRows, type ImportPreview } from '../domain/statement-import';
import { DemoStateService } from './demo-state.service';

/** How long importing a statement takes, as far as the demo is concerned. */
export const IMPORT_MS = 1200;

/**
 * What an import came to: the payments it added, how many of them are booked on their own (see `paymentStatus`: a category, a
 * confirmed booking and a receipt, or none needed) and how many need the person, and the rows that were skipped because the
 * account has them already. A row in a month that is closed is neither added nor counted as skipped (see `ImportPreview`).
 * An import that adds nothing leaves `importId` empty: it records nothing and changes nothing.
 */
export interface ImportSummary {
  importId: string;
  added: number;
  bookedAutomatically: number;
  needsYou: number;
  skipped: number;
}

/** What importing the rows of a statement into an account would do, for a business that is not changed. */
function previewOf(business: Business, accountId: string, statement: SampleStatement, mapping: ColumnMapping): ImportPreview {
  const { rows, unreadable } = readRows(statement, mapping);
  return previewImport(business, accountId, rows, (month) => isClosedDate(business, `${month}-01`), unreadable);
}

/**
 * Simulates importing a bank statement into an account of the open business. No file is read: the sample statement made for the
 * account stands in for it (see `sampleStatementFor`), the way a simulated upload takes the next result of its pool. The new payments are
 * then booked like the ones a bank connection brings: Documents and Invoices are matched where a match is certain, and everything
 * else is left to the review inbox. Every change goes through `DemoStateService`, and Reset demo takes it all back.
 */
@Injectable({ providedIn: 'root' })
export class StatementImportService {
  private readonly demo = inject(DemoStateService);

  /** The import that is running, with the data generation it started in. */
  private readonly running = signal<{ generation: number } | null>(null);
  /** Whether an import is running. Reset demo ends it at once: it is false from then, not only when the time is up. */
  readonly importing: Signal<boolean> = computed(() => {
    const run = this.running();
    return run !== null && run.generation === this.demo.dataGeneration();
  });

  /** Never goes back, so the id of an import and of its payments is not used twice in one page load, not even after an undo or a reset. */
  private idCounter = 0;
  /** How many statements each account of each business was handed in each data generation: a reset starts every account over. */
  private readonly used = new Map<string, number>();

  /**
   * The statement that stands in for the file the person drops into an account of the open business: the account's next sample
   * (see `sampleStatementFor`), then the last one again. An id that is not an account of the open business is a mistake of the caller: it throws.
   */
  nextSample(accountId: string): SampleStatement {
    const business = this.demo.business();
    const account = business.accounts.find((a) => a.id === accountId);
    if (!account) throw new Error(`There is no account ${accountId} to import into`);
    const key = `${this.demo.dataGeneration()}:${business.id}:${accountId}`;
    const used = this.used.get(key) ?? 0;
    this.used.set(key, used + 1);
    return sampleStatementFor(business, account, used);
  }

  /** What importing the statement into the account, read with the mapping, would do to the open business. */
  preview(accountId: string, statement: SampleStatement, mapping: ColumnMapping): ImportPreview {
    return previewOf(this.demo.business(), accountId, statement, mapping);
  }

  /**
   * Imports the statement into the account of the open business: after `IMPORT_MS` its new rows are added as payments, each is
   * matched to what it surely belongs to (an invoice whose number its reference names, else the one document that surely fits it) and
   * linked as the system's own work, the import is recorded on the business (so it can be undone) and the bank step is ticked.
   * The rows are read when the time is up, so they are checked against the payments the business has then. It is imported into the
   * business it was started for, whichever is open by then.
   *
   * Resolves null, and imports nothing, when another import is running (a second tap changes nothing), when Reset demo came in
   * meanwhile, and when the account or the business is gone. A statement with no new rows (a mapping that is not complete, or a file
   * the account has in full already) changes nothing at all and says so with an empty `importId`.
   */
  import(accountId: string, statement: SampleStatement, mapping: ColumnMapping): Promise<ImportSummary | null> {
    if (this.importing()) return Promise.resolve(null);
    const businessId = this.demo.business().id;
    const generation = this.demo.dataGeneration();
    const run = { generation };
    this.running.set(run);
    return new Promise((resolve) => {
      setTimeout(() => {
        // Only its own mark: after a reset another import may be running by now.
        if (this.running() === run) this.running.set(null);
        resolve(this.demo.dataGeneration() === generation ? this.finish(businessId, accountId, statement, mapping) : null);
      }, IMPORT_MS);
    });
  }

  /** The import is done now: its payments, its automatic matches, its record and the bank step. */
  private finish(businessId: string, accountId: string, statement: SampleStatement, mapping: ColumnMapping): ImportSummary | null {
    const business = this.businessOf(businessId);
    if (!business?.accounts.some((account) => account.id === accountId)) return null;
    const preview = previewOf(business, accountId, statement, mapping);
    const skipped = preview.duplicateCount;
    if (preview.newCount === 0) return { importId: '', added: 0, bookedAutomatically: 0, needsYou: 0, skipped };

    const importId = `imp-${++this.idCounter}`;
    const built = importTransactions(business, accountId, preview, statement, importId);
    // Each payment goes in front of the others, so adding the last row first keeps the order of the file for payments of one day.
    for (const tx of [...built].reverse()) this.demo.addTransaction(tx, businessId);
    for (const tx of built) this.matchOnItsOwn(businessId, tx.id);
    this.demo.recordImport(
      { id: importId, accountId, statementId: statement.id, fileName: statement.fileName, importedOn: DEMO_TODAY, paymentIds: built.map((tx) => tx.id), skippedCount: skipped },
      businessId,
    );
    this.demo.completeStep('bank', businessId);

    const now = new Map((this.businessOf(businessId)?.transactions ?? []).map((tx) => [tx.id, tx]));
    const booked = built.filter((tx) => paymentStatus(now.get(tx.id) ?? tx) === 'booked').length;
    return { importId, added: built.length, bookedAutomatically: booked, needsYou: built.length - booked, skipped };
  }

  /**
   * Links a new payment to what it surely belongs to, as the system's own work (`auto`, so the import can still be undone): an
   * invoice that its reference names (see `invoiceMatch`; an invoice that only has the same amount is left to the review inbox), else the one
   * document that surely belongs to it (see `certainMatch`).
   */
  private matchOnItsOwn(businessId: string, paymentId: string): void {
    const business = this.businessOf(businessId);
    const tx = business?.transactions.find((t) => t.id === paymentId);
    if (!business || !tx) return;
    const invoice = invoiceMatch(business, tx);
    if (invoice?.certain) {
      this.demo.linkInvoicePayment(invoice.invoice.id, paymentId, true, businessId);
      return;
    }
    const doc = business.documents.find((d) => d.paymentId === null && certainMatch(d, business.transactions)?.id === paymentId);
    if (doc) this.demo.link(doc.id, paymentId, true, businessId);
  }

  private businessOf(businessId: string): Business | undefined {
    return this.demo.businesses.find((b) => b.id === businessId);
  }
}
