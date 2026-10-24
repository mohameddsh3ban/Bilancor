# Statement Import, Self-issued Receipts, Cash or Own-money Payments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the last three Phase 1 "coming soon" spots with working mockups: bank statement import (with duplicate skipping, column matching and undo), self-issued receipts (Eigenbeleg) on payments, and "paid in cash or with my own money" on receipts, on sample data in EN/DE/AR.

**Architecture:** Pure functions in `domain/statement-import.ts`, `domain/self-issued.ts` and `domain/cash-payments.ts` decide everything (reading sample statement cells, duplicates, closed months, numbering, the payments to create); `StatementImportService` and `ReceiptService` perform the actions through `DemoStateService`, which gains `addAccount`, imports on the business and an "Own money" account kind. Sample statements follow the Documents upload-pool pattern.

**Tech Stack:** Angular 22 (standalone, zoneless, signals, OnPush), Vitest via `ng test`, Tailwind CSS 4, spartan/ui helm (`web/libs/ui`), Transloco.

**Spec:** [docs/specs/2026-10-24-phase1-gaps-mockup-design.md](../../specs/2026-10-24-phase1-gaps-mockup-design.md)

**Start:** only after the Reports page (built in another session) is merged into `morty-documents`. Worktree `.claude/worktrees/morty-phase1-gaps`, branch `morty-phase1-gaps` from that merge. All paths below are under `web/src/app/` unless they start with `web/`.

## Global Constraints

- No backend; all data from `data/`; changes live in memory (reload / Reset demo restores accounts, imports, receipts and payments). Bank files are not really read: sample statements stand in.
- Phone first, no horizontal scroll at 375 px; computer from Tailwind `lg`. Colours via shadcn utilities and project tokens (`positive`, `negative`, `warning`); logical utilities so Arabic mirrors.
- Amounts, dates, IBANs and numbers in `<bdi dir="ltr">`; `money`/`appDate`/`appMonth` pipes; German terms via `<app-term>` (new `TermKey`s + `terms.<key>.{label,de,explain}` in all three files, each in the task that first shows it: `eigenbeleg` (key exists in JSON — add it to `TermKey`), `privateinlage`, `kasse`, `camt`, `kontoauszug`).
- UI text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). The self-issued receipt itself is German only and left-to-right.
- `DEMO_TODAY` = `2026-10-22`; storage only via `SafeStorage`.
- Closed months follow the Reports rule: only Reports and Payments respect them (import and payment detail do; Documents and the review inbox don't).
- New pages are lazy routes; the initial bundle stays under the 650 kB warning (report the size).
- Reuse existing pieces (`DemoStateService.link/linkInvoicePayment/addTransaction/addDocument/addCashBox/completeStep`, `certainMatch`, `invoiceMatch`, `applyRuleToUnclear` (or the rule-matching it uses), `parseDocAmount` in `domain/amount-input.ts`, `DialogCard`, `printOnceRendered`, the invoice paper's look, `UploadService`'s pool-per-generation pattern, the Reports closed-month check); never copy them. The payment builder private to `invoice.service.ts` (`paymentFor`) moves to the domain and is shared.
- Commits stage only the task's files (explicit paths); never `.superpowers/` or `.claude/`; each message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **The same statement imported twice** — the second preview shows everything as "Already here, skipped" and Import adds nothing. Test: Task 2 `importing the same statement twice adds nothing`.
2. **A statement row in a closed month** — listed under "In a closed month, not imported", never added; an import can't be undone once a month it touches is closed. Tests: Task 1 `closed-month rows are not imported`, Task 4 `undo refused once a month is closed`.
3. **Undo after a payment was worked on** — refused with "Can't be undone: some payments were worked on"; before that, undo removes the payments and their automatic links (documents waiting again, invoices open again). Tests: Task 2 `undo removes payments and their automatic links`, Task 4 `undo refused after answering a payment`.
4. **Changing the category of a payment with a self-issued receipt** — VAT stays 0 % (Taxes figures don't move). Test: Task 5 `category change keeps 0 % VAT`.
5. **Arabic** — import preview amounts/dates/IBAN and the receipt paper read left-to-right. Tests: Task 3 and Task 6 Arabic specs.

---

## File Structure

```
data/models.ts, data/categories.ts                 # imports, self-issued fields, own-money kind, BANK_FEES (Tasks 1, 5, 7)
domain/statement-import.ts (+ spec)                # cells, mapping, preview, duplicates, transactions, undo rule (Task 1)
data/sample-statements.ts (+ spec)                 # sample statement files per account / business / generic (Task 2)
state/statement-import.service.ts (+ spec)         # preview, import (timed), matching, undo (Task 2)
payments/statement-import.page.ts (+ parts)        # the import screen and ways in (Task 3)
settings/account-imports.ts                         # imports list + undo under account rows (Task 4)
domain/self-issued.ts, state/receipt.service.ts     # numbering, receipt doc, VAT rule (Task 5)
payments/self-issued-form.ts, payments/self-issued.page.ts, print/self-issued-print.page.ts (Task 6)
domain/cash-payments.ts, documents/paid-privately-dialog.ts (Task 7)
```

---

### Task 1: Statement import rules

**Files:**
- Create: `domain/statement-import.ts` (+ spec)
- Modify: `data/models.ts`, `data/categories.ts`, i18n (category label `bankFees`)

**Interfaces:**
- Consumes: the Reports closed-month check — **Step 1 finds its exact name** in the merged code (expected shape: `(business: Business, month: string /* YYYY-MM */) => boolean`; if Reports isn't merged, stop and report BLOCKED); `parseDocAmount`; `paymentCandidates`/`certainMatch` not needed here.
- Produces:

```ts
// models.ts
export type ColumnRole = 'date' | 'amount' | 'amountOut' | 'who' | 'purpose' | 'ignore';
export interface ColumnMapping { roles: ColumnRole[]; moneyOut: 'minus' | 'column' } // 'column': money out in its own 'amountOut' column
export interface RowMeta { booking: string | null /* Booking labelKey */; confirmed: boolean; receipt: ReceiptState }
export interface SampleStatement {
  id: string; fileName: string;
  format: 'bankCsv' | 'camt' | 'unknownCsv'; bankLabel: string | null;   // e.g. 'Sparkasse CSV'; null for unknown
  header: string[]; cells: string[][];                                   // raw text cells, German formats
  mapping: ColumnMapping | null;                                         // null → the person matches columns
  meta: RowMeta[];                                                       // one per row of cells
}
export interface StatementImport { id: string; accountId: string; statementId: string; fileName: string; importedOn: string; paymentIds: string[]; skippedCount: number }
// Business gains: imports: StatementImport[]  ([] in every sample business)
// HistoryKey gains: 'imported' already exists — imports pass params { file } ; add 'importUndone' (account history)
// categories.ts: BANK_FEES = { skr03: '4970', nameDe: 'Nebenkosten des Geldverkehrs', labelKey: 'bankFees', vatRate: 0 }, added to CATEGORIES

// domain/statement-import.ts
export function parseStatementDate(text: string): string | null;   // 'dd.mm.yyyy', 'dd.mm.yy' (20yy), ISO 'yyyy-mm-dd' → ISO; else null
export function parseStatementAmount(text: string): number | null; // cents; '-1.234,56', '1234,56', '1.234,56 €', '−12,00' (U+2212); via parseDocAmount for the number part
export function guessMapping(statement: SampleStatement): ColumnMapping;  // header words (Datum/Buchungstag/Date → date; Betrag/Amount → amount; Soll/Belastung → amountOut; Empfänger/Auftraggeber/Name/Partner → who; Verwendungszweck/Reference → purpose); else by cell shape
export function mappingComplete(mapping: ColumnMapping): boolean;        // has date, who, and amount (+ amountOut when moneyOut === 'column')
export interface StatementRow { index: number; date: string; amountCents: number; counterparty: string; reference: string }
export function readRows(statement: SampleStatement, mapping: ColumnMapping): { rows: StatementRow[]; unreadable: number };
export type RowState = 'new' | 'duplicate' | 'closedMonth';
export interface PreviewRow extends StatementRow { state: RowState; duplicateOf: string | null }
export interface ImportPreview { rows: PreviewRow[]; newCount: number; duplicateCount: number; closedCount: number; unreadable: number; from: string | null; to: string | null }
export function previewImport(business: Business, accountId: string, rows: StatementRow[], isClosed: (month: string) => boolean): ImportPreview;
export function isDuplicate(row: StatementRow, tx: Transaction, accountId: string | null): boolean; // same account (any account when null), date, amount, and same name (case/space/umlaut-insensitive) or same reference
export function importTransactions(business: Business, accountId: string, preview: ImportPreview, statement: SampleStatement, importId: string): Transaction[]; // 'new' rows only; ids `${importId}-r${index}`; booking/confirmed/receipt from meta[index]; stored category rules applied to rows without a booking; history [imported { file }] plus autoBooked/bookedByRule as today's payments carry
export function undoBlockedBy(business: Business, imp: StatementImport, isClosed: (month: string) => boolean): 'worked' | 'closed' | null; // 'worked' when any of its payments was changed since import (anything beyond its import history: linked by hand, answered, recategorised, made private); 'closed' when one sits in a closed month
export function canUndoImport(business: Business, imp: StatementImport, isClosed: (month: string) => boolean): boolean; // undoBlockedBy(...) === null
export function statementText(statement: SampleStatement): string; // the original file's text (header + cells, `;` separated; CAMT as a small XML) — for "Download the file"
```

- [ ] **Step 1: Find the Reports closed-month check** in the merged code and note its name in the report.
- [ ] **Step 2: Failing tests** (`domain/statement-import.spec.ts`, small fixtures): `dates: 01.10.2026, 01.10.26 and 2026-10-01 read the same; 32.10.2026 is unreadable`; `amounts: -1.234,56 → -123456; 1.234,56 € → 123456; −12,00 → -1200; text → null`; `guessMapping finds date, amount, who, purpose from German and English headers`; `mappingComplete needs date, who and amount (and the out column when money out has its own column)`; `readRows with a separate money-out column makes those rows negative`; `unreadable rows are counted, not imported`; `duplicates: same account, date, amount and name or reference; a different account isn't a duplicate`; `closed-month rows are not imported`; `preview counts and date range`; `importTransactions builds only new rows with their meta and applies stored rules`; `undoBlockedBy: worked after a change, closed in a closed month, null otherwise`; `isDuplicate with a null account matches any account`.
- [ ] **Step 3: Run** `cd web && npx ng test --watch=false --include=src/app/domain/statement-import.spec.ts` → FAIL.
- [ ] **Step 4: Implement.** Every existing `Business` gets `imports: []`.
- [ ] **Step 5: Run** the full suite → PASS.
- [ ] **Step 6: Commit** `feat: statement import rules`.

---

### Task 2: Sample statements and the import service

**Files:**
- Create: `data/sample-statements.ts`, `state/statement-import.service.ts` (+ specs)
- Modify: `state/demo-state.service.ts` (+ spec; `connectAccounts` dedupe), `data/sample-documents.ts` (`wd-d8`) (+ specs whose counts change deliberately)

**Interfaces:**
- Consumes: Task 1; `certainMatch`, `invoiceMatch`, `linkInvoicePayment`, `link`, `addTransaction`, `completeStep`, `dataGeneration`; `newBusinessPayments` (`data/new-business-sample.ts`) for the generic statement.
- Produces:
  - `DemoStateService`: `addAccount(account: Account, businessId?: string): void` (no duplicate ids; `bankConnected` history line not added; doesn't tick the bank step); `recordImport(imp: StatementImport, businessId?: string): void`; `undoImport(importId: string): boolean` (removes the import's payments, clears links pointing to them — `doc.paymentId` back to null, ids removed from `invoice.paymentIds` with their `paysInvoice`/paid history lines — removes the record, adds `importUndone` on the business history; returns false when `canUndoImport` says no).
  - `sampleStatementFor(business: Business, account: Account, used: number): SampleStatement` — the account's own samples in order (by account id), then for a business's newly added statement account its "new account" sample (Weber: the Volksbank CAMT), else the generic statement built from `newBusinessPayments` rows for October; after the last, the last again.
  - `StatementImportService` (root): `IMPORT_MS = 1200`; `readonly importing: Signal<boolean>`; `nextSample(accountId: string): SampleStatement` (counts per generation + account, like `UploadService`); `preview(accountId: string, statement: SampleStatement, mapping: ColumnMapping): ImportPreview`; `import(accountId: string, statement: SampleStatement, mapping: ColumnMapping): Promise<ImportSummary | null>` — after `IMPORT_MS`, unless the generation changed (→ null): builds the transactions, adds them, then for each new money-in payment a certain `invoiceMatch` → `linkInvoicePayment(…, auto=true)`, else a `certainMatch` document → `link(…, auto=true)`; records the import; `completeStep('bank')`; returns `ImportSummary { importId: string; added: number; bookedAutomatically: number; needsYou: number; skipped: number }` (`bookedAutomatically` = added payments whose `paymentStatus` is `booked` afterwards).
- Sample statements (German formats; only payments in open months after each business's first sample payment):
  - **Café Linde, `cl-sparkasse`:** `sparkasse-oktober.csv`, Sparkasse CSV, 7 rows for October: 2 already in the app (Stadtwerke Hamburg −287,40 on 15.10.; Hausverwaltung Lindenallee −1.850,00 on 10.10.) → skipped; new: Kontoführung −12,90 (BANK_FEES, receipt notNeeded, confirmed), Bäckerei-Großhandel Krüger −436,80 (GOODS_7, receipt missing), Kartenumsätze SumUp +1.284,50 (REVENUE_19, receipt notNeeded, confirmed), Versicherung Allianz −89,00 (INSURANCE, receipt notNeeded, confirmed), Metro Großmarkt −318,60 (GOODS_7, receipt missing).
  - **Weber Design, new account:** `volksbank-oktober.xml`, CAMT, 4 October rows; one is "Druckerei Mayer" −142,80 on 15.10., which links automatically to a new received sample document `wd-d8` ("Druckerei Mayer", 2026-10-14, 14280, ADVERTISING 19 %, unlinked — added in this task) as its only certain match.
  - **Sara Weber Yoga, `sy-qonto`:** `export_2026-10.csv`, unknown layout (`;`, columns `Wertstellung;Valuta;Gegenkonto;Name;Text;Betrag;Soll/Haben`), 4 October rows — `mapping: null`.
  - **Generic** (visit businesses): the October rows of `newBusinessPayments`, so a later bank connection would show them as already here.

- [ ] **Step 1: Failing tests:** `cafe preview: 5 new, 2 already here`; `importing adds 5 payments, books 3 automatically, 2 need you, ticks the bank step`; `importing the same statement twice adds nothing`; `weber's volksbank row links its receipt automatically`; `an invoice named in a row's reference is paid automatically`; `sara's statement needs columns matched; complete mapping previews 4 new`; `reset during importing imports nothing`; `undo removes payments and their automatic links`; `undo refused once a payment was answered`; `visit business gets the generic statement`; `connecting the demo bank after importing the generic statement adds no duplicate payments` (`connectAccounts` skips its October sample payments that `isDuplicate(row, tx, null)` finds in any of the business's accounts); `year figures move by exactly the booked new rows of Café's import` (`yearSummary`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: sample statements and the import service`.

---

### Task 3: The import screen and its ways in

**Files:**
- Create: `payments/statement-import.page.ts` (+ small parts as needed: `payments/column-matching.ts`) (+ specs)
- Modify: `app.routes.ts` (lazy `payments/import` — before `payments/:id`), `payments/payment-filters-bar.ts` (Import statement action; in a ⋯ on a phone), `settings/bank-accounts.ts` (statement rows' action → the import), `settings/connect-bank.page.ts` ("My bank isn't listed" → new account form → import), `shell/coming-soon.page.ts` (drop `statementImport`), their specs, i18n

**Interfaces:**
- Consumes: Task 2 (`StatementImportService`, `addAccount`), `openedFrom` (`settings/opened-from.ts`).
- Produces: `/payments/import` with `?account=<id>` (else the account chooser), `?new=1` (the new-account form: account name + IBAN, IBAN shape-checked like Settings' invoice IBAN; creates a statement account `{ kind: 'bank', product: 'business', connection: noConnection('statement') }` named e.g. "Volksbank"), `?from=settings|payments` for Back. One screen per the spec: account line; drop zone ("Drop the file from your online banking here", choose a file, **Use a sample statement** — a real file just takes the next sample too); "We read it" (format chip: "Recognised: <bankLabel>", "Recognised: CAMT (bank standard)" with `<app-term key="camt">`, or "Unknown layout"; payments in the file; date range; New / Already here, skipped (with **See which**: the skipped rows beside the payment they match) / In a closed month, not imported); first rows; for `mapping === null` the **Match the columns** grid (a select per column: Date / Amount / Money out / Who / What for / Ignore; "Money out is shown as" minus sign / its own column; guessed first; preview updates; Import disabled until `mappingComplete`); **Import N payments** → "Importing…" → summary ("5 added · 3 booked automatically · 2 need you", **Start** → `/review`, **See the payments** → `/payments?account=<id>` (add `?account=` to Payments' initial filter like `?month=`), **Undo import**). Account chooser lists statement accounts, connected accounts ("Add older months") and **A new account…**.

- [ ] **Step 1: Failing tests:** `payments offers Import statement`; `settings statement row opens the import for that account`; `my bank isn't listed asks for name and IBAN, creates a statement account and opens its import`; `cafe import screen shows Sparkasse CSV, 5 new, 2 already here, see which`; `import shows the summary with Start and See the payments`; `undo on the summary removes the import`; `sara's unknown layout needs columns; Import disabled until date, amount and who are matched`; `Use a sample statement and a dropped file both read the next sample`; `amounts, dates and IBAN are ltr in Arabic`; `coming soon no longer lists statementImport`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: import a bank statement`.

---

### Task 4: Imports list and undo in Settings

**Files:**
- Create: `settings/account-imports.ts` (+ spec)
- Modify: `settings/bank-accounts.ts` (+ spec), i18n

**Interfaces:**
- Consumes: `Business.imports`, `canUndoImport`, `DemoStateService.undoImport`, the closed-month check.
- Produces: under any account row that has imports, an expandable **Imports (N)** area: one line per import, newest first — "24 Oct · sparkasse-oktober.csv · 5 payments"; **Download the file** (the original's text via `statementText`, as a Blob download named after the file — the import record keeps the sample's id to find it); **Undo import** while `undoBlockedBy` is null, else "Can't be undone: some payments were worked on" (`worked`) or "Can't be undone: a month it touches is closed" (`closed`).

- [ ] **Step 1: Failing tests:** `an account with imports shows them, newest first`; `download gives the original file's text`; `undo from settings removes the payments`; `undo refused after answering a payment`; `undo refused once a month is closed`; `accounts without imports show no imports area`; Arabic ltr numbers.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: list and undo statement imports`.

---

### Task 5: Self-issued receipt rules and service

**Files:**
- Create: `domain/self-issued.ts`, `state/receipt.service.ts` (+ specs)
- Modify: `data/models.ts`, `data/sample-data.ts` (+ spec), `domain/payment-actions.ts` (category change keeps 0 %), i18n (history texts)

**Interfaces:**
- Consumes: `addDocument`, `link`, `updateTransaction`, `person`, the closed-month check, `snapshot/restore`.
- Produces:

```ts
// models.ts
export type SelfIssuedReason = 'lost' | 'machine' | 'tip' | 'sellerNone' | 'other';
export interface SelfIssued { number: string; reason: SelfIssuedReason; reasonText: string | null; purpose: string; address: string | null; confirmedBy: string; issuedOn: string }
// Doc gains: selfIssued: SelfIssued | null  (null on every existing doc)
// HistoryKey gains: 'selfIssued' (doc), 'vatRemovedSelfIssued' (payment)

// domain/self-issued.ts
export const SELF_ISSUED_NOTE_CENTS = 15000;
export interface SelfIssuedInput { purpose: string; reason: SelfIssuedReason; reasonText: string | null; address: string | null }
export function canWriteSelfIssued(tx: Transaction, isClosed: (month: string) => boolean): boolean; // money out, receipt 'missing', not private, not in a closed month
export function selfIssuedProblems(input: SelfIssuedInput, confirmed: boolean): ('purpose' | 'reasonText' | 'confirm')[]; // purpose non-blank; reasonText when reason 'other'; the tick
export function nextSelfIssuedNumber(business: Business, year: string): string;  // 'EB-{YYYY}-{NNN}', gap-free per business and year
export function selfIssuedDocFor(business: Business, tx: Transaction, input: SelfIssuedInput, confirmedBy: string, today: string): Doc; // received, name = counterparty, date = tx.date, amount |tx|, vatRate 0, booking = tx.booking with vatRate 0, fromUpload true, fileName `${number}.pdf`, history [selfIssued { number }]
export function hasSelfIssuedReceipt(business: Business, txId: string): boolean;
export function purposeSuggestion(tx: Transaction): string; // from the reference and category label key (UI translates the label)
```
- `ReceiptService` (root): `createSelfIssued(txId: string, input: SelfIssuedInput): string | null` (doc id; null when `canWriteSelfIssued` fails for the inbox path pass `() => false` as `isClosed` — the inbox and Documents don't check closed months; the payment page passes the real check): adds the doc, links it (payment receipt attached), sets the payment's booking VAT to 0 with `vatRemovedSelfIssued`. Category change on such a payment (`domain/payment-actions.ts` change-category path and the review card's change) keeps `vatRate: 0`.
- Sample: Weber gains `wd-t20` — "APCOA Parking", 2026-10-20, −650, TRAVEL (19 %), confirmed, receipt `missing`, reference "Parkhaus Zentrum, Automat" (Weber's decisions count +1 — update pinned counts deliberately).

- [ ] **Step 1: Failing tests:** `numbers EB-2026-001 then 002; another year starts at 001`; `the receipt document carries every field, 0 % VAT, linked`; `the payment counts as booked and its VAT is 0`; `Taxes: the October VAT paid drops by the parking VAT` (compare `vatReturnFor` before/after); `category change keeps 0 % VAT`; `can't write one for money in, a private payment, a payment with a receipt, or in a closed month (payment page)`; `the inbox path ignores closed months`; `problems: purpose, reason text for other, the tick`; `undo via snapshot/restore removes the receipt and the 0 %`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: self-issued receipt rules`.

---

### Task 6: Self-issued receipt screen, print view and ways in

**Files:**
- Create: `payments/self-issued-form.ts`, `payments/self-issued.page.ts`, `print/self-issued-print.page.ts`, `documents/self-issued-paper.ts` (+ specs)
- Modify: `app.routes.ts` (lazy `payments/:id/self-issued`; top-level `print/self-issued/:docId`, also in `app.routes.spec.ts`'s list), `payments/payment-detail.page.ts` (the `self-receipt` link → the page; hidden in a closed month), `review/payment-card.ts` (link under the receipt-missing answers), `documents/document-detail.page.ts` / `document-payment.ts` (self-issued label, locked like an invoice's document; a later real receipt's note), `shell/coming-soon.page.ts` (drop `selfReceipt`), specs, i18n

**Interfaces:**
- Consumes: Task 5; `ReviewService.answer`; `DialogCard`; `printOnceRendered`.
- Produces: `<app-self-issued-form [payment] (created)="…" (cancelled)>` — one screen per spec: title with `<app-term key="eigenbeleg">`; the payment line (name, date, amount — fixed); **What was it for?** (prefilled with `purposeSuggestion`); **Why is there no receipt?** (5 choices; "Something else…" opens a text field); **Paid to** (the name; an optional address field when |amount| > `SELF_ISSUED_NOTE_CENTS`); the notes (no VAT — when the booking has VAT; above €150 — ask the seller first); the required tick "I confirm this is true · <person's full name>, <today>"; **Create receipt**. The page wraps it at `/payments/:id/self-issued` (back to the payment; after creating, the payment page shows a 5-second **Undo**). The review card adds "Receipt lost? Write one yourself" (money out only) opening the form in a dialog; Create answers the card through `ReviewService.answer` with result "Self-issued receipt added" (counts: receipt). `<app-self-issued-paper [doc] [business]>` (German, `dir="ltr"`, `lang="de"`, like the invoice paper): "Eigenbeleg <number>", Datum der Zahlung, Betrag, Zahlungsempfänger (+ Anschrift), Verwendungszweck, Grund für den fehlenden Beleg, "Keine Vorsteuer", Ausgestellt am, Bestätigt von. Print view `/print/self-issued/:docId` prints once. On Documents a self-issued document shows "Self-issued" with **Print**, no Edit/Remove/category change; a waiting received document whose amount and name match a payment that already has a self-issued receipt says "This payment already has a self-issued receipt".

- [ ] **Step 1: Failing tests:** `payment detail offers Write a self-issued receipt for APCOA, not in a closed month`; `the form prefills, needs a reason text for other, needs the tick`; `create links the receipt and shows Undo for 5 seconds`; `notes: no VAT shown when the booking has VAT; the above-€150 note only above 150`; `review card link opens the form; creating answers the card`; `paper shows every field in German`; `print prints once`; `documents shows Self-issued, locked`; `a later real receipt says the payment already has one`; `paper is ltr in Arabic`; `coming soon no longer lists selfReceipt`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: write a self-issued receipt`.

---

### Task 7: Paid in cash or with your own money

**Files:**
- Create: `domain/cash-payments.ts` (+ spec), `documents/paid-privately-dialog.ts` (+ spec)
- Modify: `data/models.ts`, `state/demo-state.service.ts`, `state/receipt.service.ts`, `state/invoice.service.ts` (use the shared builder), `documents/document-payment.ts`, `settings/bank-accounts.ts` (own-money row), `domain/bank-connection.ts` (`noConnection('own')`, status, `accountName`), `data/sample-documents.ts` (+ specs), `shell/coming-soon.page.ts` (drop `cashPayment`), i18n

**Interfaces:**
- Consumes: `addCashBox`, `addTransaction`, `link`.
- Produces:
  - Models: `Account.kind` gains `'own'`; `AccountConnection.kind` gains `'own'`; `Account.product` gains `'own'`; HistoryKey gains `'paidWithOwnMoney'`, `'ownMoneyAdded'` (`paidInCash` exists).
  - `domain/cash-payments.ts`: `paymentFor(...)` moved from `invoice.service.ts` (same behaviour, now exported and used by both); `paidFromReceiptFor(doc: Doc, account: Account, day: string): Transaction` (money out of the receipt's amount, booked with the receipt's booking and VAT, confirmed, receipt attached with the receipt's file, history `paidInCash` or `paidWithOwnMoney`); `payDayAllowed(doc: Doc, day: string, today: string): boolean` (receipt date ≤ day ≤ today).
  - `DemoStateService.addOwnMoneyAccount(): void` — idempotent: `{ id: \`${businessId}-own\`, kind: 'own', name: 'Own money', product: 'own', balanceCents: 0, connection: noConnection('own'), iban: null }`, history `ownMoneyAdded`; doesn't tick the bank step.
  - `ReceiptService.markPaid(docId: string, how: 'cash' | 'own', day: string): string | null` (payment id; null if the doc isn't a received, unlinked, non-invoice receipt with an amount, or the day isn't allowed) and `undoPaid(txId: string): void` (within the 5 s Undo: removes the payment and unlinks).
  - Payments: the account filter lists "Own money"; Settings bank rows show the own-money account ("Money you paid for the business privately", with `<app-term key="privateinlage">`), no actions. A payment made this way is locked to its receipt (no "Not this payment"; `unlink` refuses it).
  - Dialog (`DialogCard`): **How was it paid?** In cash, from the cash box (`<app-term key="kasse">`) / With my own money (private card or cash); **Paid on** (date, receipt date … today); **Done** → the document page shows a 5-second **Undo**.
  - Sample: two new received receipts with no payment: Weber `wd-d7` "Copyshop Kreuzberg", 2026-10-19, 1850, OFFICE (19 %), photo; Sara `sy-d3` "Yogamatten-Shop", 2026-10-12, 8900, SUPPLIES (0 %, Kleinunternehmer).

- [ ] **Step 1: Failing tests:** `paid in cash adds a cash-box payment linked and booked, VAT counts`; `paid with own money creates the Own money account and a linked payment`; `own money for a Kleinunternehmer has no VAT`; `paid on must be between the receipt date and today`; `undo within 5 seconds removes it`; `the payment is locked to its receipt`; `payments filter lists Own money`; `settings shows the own-money row`; `invoice mark-as-paid still works through the shared builder`; `sent invoices keep their own Mark as paid link`; Arabic dialog rtl with ltr amounts; `coming soon no longer lists cashPayment`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: paid in cash or with my own money`.

---

### Task 8: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1:** Full suite and `npx ng build` pass (report the initial size).
- [ ] **Step 2:** Controller checks by eye at 375 × 812 and ~1100 × 700, en and ar: Café's Sparkasse import (skipped duplicates, summary, Start), Weber's "My bank isn't listed" → Volksbank → automatic receipt link, Sara's column matching, Settings imports list and undo, APCOA self-issued receipt from the payment and from the review inbox, its print view, Copyshop paid in cash, Yogamatten paid with own money, the Own money account in Payments and Settings.
- [ ] **Step 3:** README: sections for statement import (what's simulated, duplicates, closed months, undo), self-issued receipts (rules, no VAT, numbering, locked), and cash / own money (accounts created, locked, bank step not ticked).
- [ ] **Step 4: Commit** `docs: describe statement import, self-issued receipts and cash payments`.
