# Documents Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Documents page (Needs-you box, list, one document, simulated adding) on sample data, linked both ways to Payments and to the homepage, in EN/DE/AR, phone-first.

**Architecture:** Documents become part of each sample business (`Business.documents`), next to its payments, in the same editable working copy in `DemoStateService`. A document's status is derived from its state (pure functions in `domain/`), and every change is a pure function; linking changes a document and a payment in one update. Adding documents is simulated by an `UploadService` that shows *Reading…* for `READING_MS` and then fills the document from a per-business pool of ready-made results. List and detail are nested routes, like Payments.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`), Transloco.

**Spec:** [docs/specs/2026-10-22-documents-mockup-design.md](../../specs/2026-10-22-documents-mockup-design.md) (builds on [the Payments design](../../specs/2026-10-22-payments-mockup-design.md) and its [plan](2026-10-22-payments-mockup.md); conventions in `web/README.md`)

## Global Constraints

- **Start only when the Payments mockup is committed** and `git status` shows no uncommitted changes under `web/`.
- No backend, HTTP data calls, real OCR, real storage or real email; everything comes from `web/src/app/data/`.
- No names, amounts or details from the studied Bilancor account; no Bilancor/BuchhaltungsButler wording, layout or code.
- Phone first: every screen works at 375 px with no horizontal scroll; computer layout from Tailwind `lg` (1024 px).
- Colours only via the shadcn utilities and the project tokens `surface`, `positive`, `negative`, `warning`; no hard-coded colours.
- Logical utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end`); Arabic mirrors everything, including the panel side, back arrows and Needs-you cards.
- Amounts, invoice numbers, file names and email addresses in `<bdi dir="ltr">`; document and counterparty names `dir="auto"` + `truncate` where they can be long.
- Every status shows a word, never only an icon. Every problem says what is wrong and offers its fix.
- Never ask incoming/outgoing when adding a document.
- Every change to a document or payment adds a history line (stored as key + params, never as text).
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). SKR03 names stay German; *Eingangsbeleg* / *Ausgangsbeleg* shown next to Received / Sent in the detail view.
- Storage only via `SafeStorage`; sample-data edits live in memory only (reload or Reset demo restores them).
- Demo "today" is `DEMO_TODAY = '2026-10-22'`; no code reads the real clock (timers for *Reading…* are fine).
- Files: accepted extensions `.pdf .jpg .jpeg .png .xml` (any case), at most `20 * 1024 * 1024` bytes.
- For a Kleinunternehmer business, VAT always shows as "no VAT": every VAT shown goes through `vatRateShown(taxProfile, booking)` from `domain/tax-rules.ts` (null = "no VAT"). Category choices come from `CategoryPicker`, which already offers `categoriesFor(taxProfile)`.
- Whether a bank is connected: `DemoStateService.bankConnected()`.
- Run tests from `web/` with `npx ng test --watch=false`; `npx ng build` must have no budget warnings.
- Commits stage only the task's own files (`git add <paths>`, never `git add -A`): `backend/`, `admin/` and `CLAUDE.md` have changes the owner chose not to commit yet.

## Review Focus

1. **Reset demo while a document is still *Reading…*** — the pending result must not reappear in the restored data, and nothing crashes. Test in Task 3 (`reset while reading drops the pending result`).
2. **Switching business while documents are reading** — the result lands in the business the files were added to, not the one now open. Test in Task 3 (`a result lands in the business it was added to`).
3. **Unlink after changing the booking while linked** — the payment gets its pre-link booking back; the document keeps the booking the pair had. Test in Task 2 (`unlink restores the payment and keeps the pair's booking on the document`).
4. **A drop mixing good and refused files** (`notes.docx`, a 25 MB PDF, two good files) — the good ones are added, each refused one is named with its reason. Test in Task 3 (`refused files are named with their reason`) and Task 5 (`dropping mixed files adds the good ones and lists the rest`).
5. **Tapping *This one* twice** (or a slow device repeating the click) — one link, one history line on each side. Test in Task 6 (`linking twice writes one history line`).

---

## File Structure

```
web/src/app/
  data/models.ts                       # Doc types, Business.documents/inboxEmail, Transaction.beforeLink, history keys (Task 1)
  data/sample-documents.ts             # extra documents per business, upload pools (Task 1)
  data/sample-data.ts                  # wd-t17, linked documents for attached receipts (Task 1)
  domain/document-status.ts            # docStatus, docNeedsYou, missingField, visibleDocuments (Task 1)
  domain/document-matching.ts          # nameTokens, paymentCandidates, documentCandidates, certainMatch (Task 2)
  domain/document-actions.ts           # link/unlink/keepDuplicate/setDirection/editDocument/... (Task 2)
  domain/document-upload.ts            # checkFile, nextPoolResult, applyReadResult (Task 3)
  domain/document-search.ts            # filterDocuments, groupDocsByMonth (Task 4)
  domain/payment-filters.ts            # export parseAmountQuery (Task 4)
  state/demo-state.service.ts          # document methods (Task 2)
  state/upload.service.ts              # the simulated reading (Task 3)
  documents/documents.page.ts          # list page + outlet (Task 4)
  documents/needs-you-box.ts, document-list.ts, document-table.ts, document-status-chip.ts, inbox-line.ts (Task 4)
  documents/add-menu.ts, drop-overlay.ts, upload-message.ts (Task 5)
  documents/document-detail.page.ts, document-paper.ts, document-steps.ts, document-fields.ts, document-payment.ts, payment-picker.ts (Task 6)
  payments/document-picker.ts          # Pick from Documents (Task 7)
  payments/payment-history.ts          # passes every param through (Task 6)
```

---

### Task 1: Document model, derived status and sample documents

**Files:**
- Modify: `data/models.ts`, `data/sample-data.ts`, `data/sample-data.spec.ts`, `domain/payment-status.spec.ts`, `domain/payment-filters.spec.ts`, `domain/payment-actions.ts` (`setPrivate` keeps `beforeLink`)
- Create: `data/sample-documents.ts`, `domain/document-status.ts`, `domain/document-status.spec.ts`

**Interfaces:**
- Produces (in `models.ts`):

```ts
export type DocDirection = 'received' | 'sent';
export type DocSource = 'photo' | 'file' | 'email';
export type DocField = 'amount' | 'date' | 'name';
export type DocStatus = 'reading' | 'duplicate' | 'direction' | 'checkAmount' | 'checkDate' | 'checkName' | 'waiting' | 'overdue' | 'done';
export interface Doc {
  id: string; fileName: string; source: DocSource; addedOn: string; fromUpload: boolean; reading: boolean;
  name: string | null; direction: DocDirection | null; invoiceNo: string;
  date: string | null; dueDate: string | null; amountCents: number | null; vatRate: 0 | 7 | 19; // amount: gross, positive
  duplicateOf: string | null; // id of the document this looks like
  booking: Booking | null; bookingConfirmed: boolean; // the prepared booking while not linked
  paymentId: string | null;
  history: HistoryEntry[]; // newest first
}
/** A ready-made reading result for a simulated upload; `plain` marks the receipts a pool repeats. */
export type PoolResult = Pick<Doc, 'name' | 'direction' | 'invoiceNo' | 'date' | 'dueDate' | 'amountCents' | 'vatRate' | 'duplicateOf' | 'booking'> & { plain: boolean };
```
  `Business` gains `documents: Doc[]` and `inboxEmail: string`; `Transaction` gains `beforeLink: { booking: Booking | null; confirmed: boolean; receipt: ReceiptState } | null` (`pay()` sets `null`). `HistoryKey` gains `addedPhoto`, `addedFile`, `addedEmail`, `docRead` (`{ category }`), `docEdited`, `markedReceived`, `markedSent`, `keptDuplicate`, `linked`, `linkedAuto`, `unlinked` (each `{ name }`, the payment's counterparty), `receiptLinked`, `receiptLinkedAuto`, `receiptUnlinked` (each `{ name }`, the document's name).
- `docStatus(doc: Doc, today = DEMO_TODAY): DocStatus` — order: `reading`; `duplicateOf` → `duplicate`; no direction → `direction`; `missingField(doc)` → `checkAmount`/`checkDate`/`checkName`; `paymentId` → `done`; `dueDate < today` → `overdue`; else `waiting`.
- `missingField(doc: Doc): DocField | null` — first of amount, date, name that is `null`.
- `docNeedsYou(doc: Doc): boolean` — status is `duplicate`, `direction` or `check*`. `docsNeedingYouCount(docs: readonly Doc[]): number`.
- `visibleDocuments(docs: readonly Doc[], setup: SetupState): Doc[]` — all when `setupSteps(setup).bank`, else only `fromUpload`.
- `docName(doc: Doc): string` — `doc.name ?? doc.fileName`.
- `sample-documents.ts` exports `linkedDocFor(tx: Transaction, kleinunternehmer: boolean): Doc` (id `doc-<tx.id>`, file `tx.receiptFile`, name `tx.counterparty`, direction by sign, invoice no `tx.reference`, date and addedOn `tx.date`, amount `|amountCents|`, VAT from the booking (0 for a Kleinunternehmer's sent invoice), booking and confirmation from the payment, `paymentId: tx.id`, history `linkedAuto`, `docRead`, `addedFile`), `EXTRA_DOCUMENTS: Record<string, Doc[]>` and `UPLOAD_POOLS: Record<string, PoolResult[]>` (by business id).

**Sample data** (all invented):

| id | Business | File | Name | Dir. | Invoice | Date | Due | Amount | Booking | Starts as |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| wd-d1 | weber-design | `IMG_2041.jpg` (photo) | Bürobedarf Schulz | received | K-55120 | 2026-10-20 | — | **null** | OFFICE, unconfirmed | checkAmount |
| wd-d2 | weber-design | `RE-2026-044.pdf` | Studio Kern | sent | RE-2026-044 | 2026-10-16 | 2026-10-30 | 238000 | REVENUE_19, confirmed | waiting |
| wd-d3 | weber-design | `RE-2026-039.pdf` | Bäckerei Lange | sent | RE-2026-039 | 2026-09-16 | 2026-09-30 | 119000 | REVENUE_19, confirmed | overdue |
| wd-d4 | weber-design | `boettcher-quittung.pdf` | Böttcher Bürobedarf | received | Q-8812 | 2026-10-08 | — | 2380 | OFFICE, unconfirmed | waiting (matches wd-t17) |
| sy-d1 | sara-yoga | `flyer-rechnung.pdf` | Kiezdruck Druckerei | received | KD-3391 | 2026-10-04 | — | 4500 | ADVERTISING, unconfirmed | waiting (matches sy-t8) |

  New payment `wd-t17`: 2026-10-08, "SCHREIBWAREN BOETTCHER", WD_QONTO, −2380, OFFICE, receipt `missing`, ref "Kartenzahlung 08.10.". Every payment with receipt `attached` gets `linkedDocFor(tx)`. `inboxEmail`: `weber-design@inbox.example`, `sara-yoga@inbox.example`, `cafe-linde@inbox.example`.

  Upload pools (in order; after the last, the pool repeats its plain receipts): weber-design — (1) Deutsche Bahn, received, 8841, 2026-10-17, 12000, TRAVEL (certain match for wd-t3); (2) Telekom, received, 2026-10-19, 3995, PHONE, `duplicateOf: 'doc-wd-t2'`; (3) Krause & Partner, **direction null**, 2026-117, 2026-10-21, 45000, CONSULTING; (4) Copyshop Mitte, received, B-2231, 2026-10-21, 1250, OFFICE; (5) Parkhaus Alexa, received, P-90812, 2026-10-21, 600, TRAVEL. sara-yoga — (1) Yogashop Berlin, received, 22-9204, 2026-10-21, 3290, SUPPLIES; (2) Raumhaus Berlin, received, R-1102, 2026-10-21, 35000, RENT. cafe-linde — (1) Metro Großmarkt, received, 0419-90321, 2026-10-21, 21480, GOODS_7; (2) Bäckerei Frisch, received, F-7781, 2026-10-21, 5630, GOODS_7.

- [ ] **Step 1: Failing tests:**
  - `document-status.spec.ts`: the order (`reading` beats a duplicate; a duplicate with no direction is `duplicate`; no direction with a missing amount is `direction`; amount and date missing → `checkAmount`); linked with a past due date → `done`; due `2026-09-30` unlinked → `overdue`, due `2026-10-30` → `waiting`, no due → `waiting`; `docsNeedingYouCount` of weber-design = 1, sara-yoga = 0, cafe-linde = 0; `visibleDocuments` in `new` keeps only `fromUpload`, in `halfway` keeps all.
  - `sample-data.spec.ts` (update): every `attached` payment has exactly one document with its `paymentId`; no document links a payment whose receipt isn't `attached`; document ids are unique per business; every document booking is in `CATEGORIES`; wd-t1…wd-t6 keep their statuses; wd-t17 is `noReceipt`.
  - `payment-status.spec.ts` (update): `needsYouCount` weber-design = **4**, sara-yoga = 3, cafe-linde = 0. `payment-filters.spec.ts` (update): the Needs-you ids now include `wd-t17`.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the model, `document-status.ts`, `sample-documents.ts` and the sample-data changes; `setPrivate` spreads `tx`, so `beforeLink` is kept.
- [ ] **Step 4: Run the full suite** → PASS. The homepage decisions count still reads payments only (4 for weber-design until Task 7).
- [ ] **Step 5: Commit** `feat: add sample documents and derived document status`.

---

### Task 2: Matching, document actions and editable documents

**Files:**
- Create: `domain/document-matching.ts`, `domain/document-matching.spec.ts`, `domain/document-actions.ts`, `domain/document-actions.spec.ts`
- Modify: `state/demo-state.service.ts` (+ spec)

**Interfaces:**
- Consumes: `Doc`, `Transaction`, `docStatus`, `docName`, `DEMO_TODAY`.
- Produces (`document-matching.ts`):
  - `nameTokens(name: string): string[]` — lower case, `ä→ae ö→oe ü→ue ß→ss`, split on anything not a letter or digit, drop tokens shorter than 3.
  - `paymentCandidates(doc: Doc, txs: readonly Transaction[]): Transaction[]` — payments with receipt `missing`, not private, sign matching the direction (received ↔ amount < 0, sent ↔ > 0); ranked: equal amount first, then more shared name tokens, then smaller date distance. A document with no direction has none.
  - `documentCandidates(tx: Transaction, docs: readonly Doc[]): Doc[]` — documents not linked, not reading, not `duplicate`, direction matching the sign; same ranking.
  - `certainMatch(doc: Doc, txs: readonly Transaction[]): Transaction | null` — the only candidate with equal amount, a date at most 7 days away, and one normalized name (tokens joined by a space) containing the other; else `null`.
- Produces (`document-actions.ts`, pure, each adds one history line dated `DEMO_TODAY` at the front of whatever it changes):
  - `linkDocument(doc: Doc, tx: Transaction, auto: boolean): { doc: Doc; tx: Transaction }` — doc: `paymentId`, history `linked`/`linkedAuto` `{ name: tx.counterparty }`. tx: `beforeLink` saved, receipt `attached`, `receiptFile: doc.fileName`; when `tx.booking` is null it takes `doc.booking` and `doc.bookingConfirmed`; history `receiptLinked`/`receiptLinkedAuto` `{ name: docName(doc) }`.
  - `unlinkDocument(doc: Doc, tx: Transaction): { doc: Doc; tx: Transaction }` — doc: `paymentId: null`, `booking`/`bookingConfirmed` from the payment as it is now, history `unlinked`. tx: restore `beforeLink` (or, when null, keep booking and confirmation) with receipt `missing`, `receiptFile: null`, `beforeLink: null`, history `receiptUnlinked`.
  - `keepDuplicate(doc)` → `duplicateOf: null`, `keptDuplicate`. `setDirection(doc, dir: DocDirection)` → `markedReceived`/`markedSent`. `editDocument(doc, changes: Partial<Pick<Doc, 'direction' | 'name' | 'invoiceNo' | 'date' | 'dueDate' | 'amountCents' | 'vatRate'>>)` → `docEdited`. `changeDocCategory(doc, booking)` → `bookingConfirmed: true`, `categoryChanged`. `confirmDocBooking(doc)` → `confirmed`.
- `DemoStateService` adds: `readonly documents: Signal<Doc[]>` (open business, raw); `readonly dataGeneration: Signal<number>` (goes up on every `resetData()`); `addDocument(businessId: string, doc: Doc): void`; `updateDocument(id: string, change: (doc: Doc) => Doc, businessId?: string): void` (default: open business); `removeDocument(id: string): void` (ignored for a linked document); `link(docId: string, txId: string, auto = false, businessId?: string): void` (one `data.update` changing both; ignored when the document is already linked or the payment's receipt isn't `missing`); `unlink(docId: string): void`.

- [ ] **Step 1: Failing tests:**
  - Matching: `nameTokens('Böttcher Bürobedarf')` → `['boettcher', 'buerobedarf']`; wd-d4's first candidate is wd-t17; `certainMatch` of the Deutsche Bahn pool result is wd-t3 and of wd-d4 is `null` (names differ); sy-d1's first candidate is sy-t8; a sent document never gets a money-out payment.
  - Actions: `link takes the document's category when the payment has none`; `link keeps the payment's own category`; **`unlink restores the payment and keeps the pair's booking on the document`** (link wd-d4 → change the payment's category to TRAVEL → unlink: wd-t17 back to OFFICE and `noReceipt`, wd-d4 booking TRAVEL); `unlinking a sample-linked payment leaves its booking and makes its receipt missing` (doc-wd-t2).
  - Service: `link changes both and needsYouCount drops`; `link twice writes one history line`; `removeDocument ignores a linked document`; `resetData restores documents and raises dataGeneration`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add document matching and actions`.

---

### Task 3: Simulated adding and reading

**Files:**
- Create: `domain/document-upload.ts`, `domain/document-upload.spec.ts`, `state/upload.service.ts`, `state/upload.service.spec.ts`

**Interfaces:**
- Produces (`document-upload.ts`):
  - `export const MAX_FILE_BYTES = 20 * 1024 * 1024;` `export const READING_MS = 2000;`
  - `type RefuseReason = 'type' | 'size'`; `checkFile(file: { name: string; size: number }): RefuseReason | null`.
  - `nextPoolResult(pool: readonly PoolResult[], index: number): PoolResult` (`PoolResult` from Task 1) — index past the end cycles through the `plain` entries only.
  - `newReadingDoc(id: string, fileName: string, source: DocSource): Doc` — `reading: true`, `fromUpload: true`, `addedOn: DEMO_TODAY`, everything unread, history `addedPhoto`/`addedFile`.
  - `applyReadResult(doc: Doc, result: PoolResult): Doc` — `reading: false`, the result's fields, `bookingConfirmed: false`, history `docRead`.
- `UploadService` (root): `add(files: readonly File[], source: 'photo' | 'file'): void`; `readonly summary: Signal<UploadSummary | null>` with `UploadSummary = { added: number; needsYou: number; refused: { name: string; reason: RefuseReason }[] }`; `clearSummary(): void`. `add` remembers the open business id and `dataGeneration`, adds a reading document per good file (ids `up-<n>`), sets `summary` with the refused files at once, and after `READING_MS` applies each file's pool result **in the business it was added to**, then calls `link(..., auto = true, businessId)` when `certainMatch` finds a payment of that business and `demo.bankConnected()`. When `dataGeneration` changed meanwhile, the result is dropped. When the whole batch is read, `summary` gets `added` and `needsYou`. Pool position is per business and starts over on reset.

- [ ] **Step 1: Failing tests** (fake timers):
  - `checkFile`: `notes.docx` → `type`; `scan.PDF` of 25 MB → `size`; `beleg.xml` → `null`.
  - `nextPoolResult` past the end repeats only plain receipts.
  - Service: `a file reads in two seconds and takes the first pool result`; `the Deutsche Bahn upload links itself to wd-t3` (wd-t3 status `booked`, both history lines say auto); **`refused files are named with their reason`**; `summary counts added and needs-you after reading` (three weber files → `{ added: 3, needsYou: 2 }`); **`a result lands in the business it was added to`** (add on weber-design, switch to sara-yoga, advance → the document is in weber-design); **`reset while reading drops the pending result`**; `in the new-client state an upload is never linked`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: simulate adding and reading documents`.

---

### Task 4: Documents list page

**Files:**
- Create: `domain/document-search.ts` (+ spec), `documents/documents.page.ts` (+ spec), `documents/needs-you-box.ts`, `documents/document-list.ts`, `documents/document-table.ts`, `documents/document-status-chip.ts` (+ spec), `documents/inbox-line.ts`
- Modify: `domain/payment-filters.ts` (export `parseAmountQuery`), `app.routes.ts`, `shell/menu.ts` (+ spec), `public/i18n/{en,de,ar}.json`

**Interfaces:**
- `filterDocuments(docs: readonly Doc[], search: string): Doc[]` — name, file name and invoice number contain the text (any case), or the amount equals a typed amount (`parseAmountQuery`, sign ignored); newest first by `date ?? addedOn`.
- `groupDocsByMonth(docs: readonly Doc[]): { month: string; docs: Doc[] }[]` — by `(date ?? addedOn).slice(0, 7)`, newest month first.
- Route `documents` (lazy `DocumentsPage`) with child `:id` (lazy `DocumentDetailPage`, Task 6; until then a placeholder component is fine). Menu: documents → `/documents`.
- `<app-document-status-chip [doc]>` — word + colour: reading muted italic, Needs-you statuses warning, waiting muted, overdue negative, done positive. Text keys `documents.status.<status>`, with `{{date}}` for `waitingDue` (when a due date exists) and `overdue`, `{{field}}` not needed (three separate check keys).
- `<app-needs-you-box [docs]>` — "Needs you · N" and one card per Needs-you document, newest first: title `docName` + date or amount; sentence `documents.needsYou.<status>` (duplicate: `{{date}}` = the original's `addedOn`); fixes: duplicate → **Keep both** (`keepDuplicate`) · **Remove** (`removeDocument`); direction → **Received** · **Sent** (`setDirection`); check* → **Type it in** (link to `/documents/<id>`). Hidden when empty.
- `<app-inbox-line [email]>` — "Or forward receipts to <address>" with **Copy** (`navigator.clipboard.writeText` in try/catch; shows "Copied" for 2 s).
- Page: title, **+ Add** (placeholder button until Task 5), inbox line, Needs-you box, search, then the list of every visible document not needing you: phone `document-list` (thumbnail, name, "Received · <date>" / "Sent · <invoice no>", chip, amount without sign or colour; `—` when unread), computer `document-table` (date, name, Received/Sent, status, amount), rows open `/documents/<id>`, selected row highlighted, layout and `hidden lg:flex` handling as in `PaymentsPage`. Empty states: `new` (no visible documents and no bank: three ways to add, the same three as the Add menu, as text) · `noMatch` (search finds nothing: message + clear search). The search doesn't filter the Needs-you box.

- [ ] **Step 1: Failing tests:**
  - Search: `finds by name, invoice number and amount typed as 23,80`; groups newest month first; a document with no date groups by `addedOn`.
  - Page: `menu Documents opens the page`; `the Needs-you box shows the unreadable receipt with Type it in`; `Received on the direction card moves the document into the list` (after an upload in the spec via `UploadService` + fake timers, or a document added through `DemoStateService.addDocument`); `Keep both and Remove clear a duplicate card`; `the list hides Needs-you documents and shows Studio Kern as Waiting for payment · due 30 Oct`; `Bäckerei Lange shows Overdue since 30 Sep`; `new-client state shows the ways to add`; `needs-you sentences follow the language` (switch to `de` → German sentence); `rows open the document` (URL `/documents/wd-d2`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement**, with all new text in the three i18n files. **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add documents list with needs-you box`.

---

### Task 5: Adding documents

**Files:**
- Create: `documents/add-menu.ts` (+ spec), `documents/drop-overlay.ts`, `documents/upload-message.ts`
- Modify: `documents/documents.page.ts` (+ spec), `shell/menu.ts` (`UPLOAD_ITEM` gets `route: '/documents'` and `queryParams: { add: '1' }`), `shell/sidebar.ts`, `shell/bottom-bar.ts`, `home/cards/setup-checklist.ts` (+ spec), i18n files

**Interfaces:**
- Consumes: `UploadService.add`, `summary`, `clearSummary`; `MAX_FILE_BYTES`.
- `<app-add-menu [email] [open]>` — **+ Add** button opening a menu (spartan dropdown or popover): *Take a photo* (phone only, `lg:hidden`; hidden `<input type="file" accept="image/*" capture="environment">`, source `photo`), *Choose a file* (`<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.xml">`, source `file`), *Forward by email* (the address with Copy, as in the inbox line). The hint lines from the spec: "Several pages become one document" and "PDF, JPG, PNG or e-invoice (XML), up to 20 MB". `open` (from `?add=1`) opens the menu on arrival, then the page removes the query parameter.
- `<app-drop-overlay>` — on the documents page from `lg`: `dragenter` with files shows a full-page dashed overlay "Drop to add N files" (N from `dataTransfer.items.length`) and "We'll sort out bills and invoices for you"; `drop` calls `add(files, 'file')`; `dragleave` out of the page or Esc hides it.
- `<app-upload-message>` — `aria-live="polite"` line at the top of the list: while reading "Reading N documents…", then "N documents added · M need you" (or "· all sorted" when 0), plus refused files ("Not added: notes.docx — only PDF, JPG, PNG or XML; big.pdf — over 20 MB"), with ✕ (`clearSummary`).
- The sidebar's and bottom bar's **Upload receipt** and the homepage setup step "receipt" link to `/documents?add=1`; the other setup steps keep `/soon/<id>`.

- [ ] **Step 1: Failing tests:**
  - `Upload receipt opens Documents with the Add menu open`; `choosing two files shows Reading… then the summary` (fake timers); **`dropping mixed files adds the good ones and lists the rest`** (`notes.docx`, a 25 MB `big.pdf`, two PDFs → two documents, two refused lines); `the setup step Upload your first receipt links to the Add menu`; `Copy shows Copied`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add documents by photo, file or drop`.

---

### Task 6: One document

**Files:**
- Create: `documents/document-detail.page.ts` (+ spec), `documents/document-paper.ts`, `documents/document-steps.ts`, `documents/document-fields.ts`, `documents/document-payment.ts`, `documents/payment-picker.ts`
- Modify: `payments/payment-history.ts` (+ spec), `core/i18n/term.ts` (`TermKey` gains `eingangsbeleg`, `ausgangsbeleg`), `app.routes.ts`, i18n files

**Interfaces:**
- Consumes: `docStatus`, `missingField`, `paymentCandidates`, the Task 2 actions and `DemoStateService` methods, `CategoryPicker` (`[current]`, `(picked)`), `BookingLabel`, `PaymentHistory`.
- `PaymentHistory` passes every entry param to the translation, then overrides `category` and `account` with their translations (so `{{name}}` works).
- Detail page (route `/documents/:id`; phone: back link "Documents"; computer: panel with ✕; unknown, hidden or other-business id → `/documents`), top to bottom:
  1. `<app-document-paper [doc]>` — a drawn placeholder page with the name, invoice number, date and total from the document; a missing field shows `?` and a `warning` outline (`data-testid="paper-missing"`).
  2. Fix box when `missingField` is set: "We couldn't read the <field>; it's marked on the scan." with the input (amount: text parsed by `parseAmountQuery`, must be > 0; date: `type="date"`; name: text) and **Save** → `editDocument`.
  3. Header: `docName`, "Received" / "Invoice you sent", invoice number, amount.
  4. `<app-document-steps [doc] [payment]>` — *Read · Booked · Paid* (sent: *Waiting for payment* until linked); ticks per the spec (Booked uses the payment's booking when linked).
  5. `<app-document-fields>` — what we read, with **Edit** (one form for direction, name, invoice no., date, amount, VAT rate, due date; Save/Cancel) and the note `documents.detail.why.<direction>` ("We set *Sent* because the invoice comes from your business"). Direction shows `<app-term key="eingangsbeleg|ausgangsbeleg">`. VAT: rate and amount (`round(amount * rate / (100 + rate))`) from `vatRateShown(taxProfile, { ...booking, vatRate: doc.vatRate })`; null shows "no VAT" (always for a Kleinunternehmer).
  6. Booking: linked → the payment's booking, **Change** → `changeCategory` on the payment, **Confirm** when unconfirmed → `confirmBooking`; not linked → the prepared booking with `changeDocCategory` / `confirmDocBooking`. `CategoryPicker` also emits the current category: then confirm it if unconfirmed, else do nothing (as `PaymentDetailPage.pick` does).
  7. `<app-document-payment>` — not linked: "No payment yet. These might be it:" + up to three `paymentCandidates` with **This one** (`link`), "No matching payments yet" when none, **Search all payments** (`<app-payment-picker>`: every candidate, searchable by name or amount), "Paid in cash or privately" → `/soon/cashPayment` (add `soon.cashPayment` to the i18n files). Linked: the payment (counterparty, signed amount, date, account) linking to `/payments/<id>`, and **Not this payment** (`unlink`).
  8. History (`PaymentHistory`), and **Remove** for an unlinked document (`removeDocument`, then back to `/documents`).

- [ ] **Step 1: Failing tests:**
  - `typing 71,39 fills the amount and clears the problem` (wd-d1 → status `waiting`, history `docEdited`); `the missing amount is marked on the paper`; `This one links Böttcher and wd-t17 shows Booked` (navigate to `/payments/wd-t17`); **`linking twice writes one history line`**; `Not this payment brings Receipt missing back`; `Edit changes the direction and the why-note follows`; `a Kleinunternehmer's sent invoice shows no VAT`; `history lines with a name follow the language`; `switching business with a document open returns to the list`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add document details with linking`.

---

### Task 7: Payments and homepage follow the documents

**Files:**
- Create: `payments/document-picker.ts` (+ spec)
- Modify: `payments/payment-detail.page.ts` (+ spec), `home/cards/decisions-card.ts` (+ spec), `state/notice.service.ts` (+ spec), `home/cards/notices-card.ts` (+ spec), i18n files

**Interfaces:**
- `<app-document-picker [payment] (picked)>` — **Pick from Documents** opens a searchable list of `documentCandidates(payment, visible documents)`, best first (name, date, amount, file name); choosing one emits its id; the page calls `demo.link(docId, txId)`. Empty: "No unlinked documents fit this payment" + a link to `/documents?add=1`.
- Payment detail: receipt `attached` with a linked document shows **Open document** → `/documents/<docId>`. While a document links to the payment, the Business/Private switch is replaced by the line "This payment has a document. Unlink it first." (`data-testid="private-blocked"`).
- Decisions card count = `needsYouCount(transactions) + docsNeedingYouCount(visibleDocuments(documents, setup))`.
- `NoticeService`: an open `unreadable` notice takes `params.count` = the number of visible documents with a `check*` status and is left out at 0 (history notices keep their stored counts). Notices card: **Fix** on `unreadable` → `/documents`; the others keep `/soon/<kind>`.

- [ ] **Step 1: Failing tests:**
  - `Pick from Documents links Böttcher to wd-t17` (status `booked`, receipt shows `boettcher-quittung.pdf`, history line); `the picker offers only received documents for money out`; `Open document goes to the linked document`; `a linked payment can't be marked private` (`private-blocked`; after unlinking, the switch is back).
  - `decisions count is 5 for weber-design and drops to 4 after typing the amount`; sara-yoga stays 3; cafe-linde all clear.
  - `the unreadable notice counts 1 for weber-design and disappears once the amount is typed`; `Fix opens Documents`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: link payments and homepage to documents`.

---

### Task 8: Check and document

**Files:**
- Modify: `web/README.md`, `docs/bookkeeping-portal-spec.md` (one line under "Document pages": our version is in the design doc)

- [ ] **Step 1: Run** `npx ng test --watch=false` and `npx ng build` from `web/` → all pass, no budget warnings.
- [ ] **Step 2: Look at it** in the browser preview at 375 px and 1280 px, in en, de and ar: Needs-you box, list, detail panel, Add menu, drop overlay, Pick from Documents, the homepage count. Fix any horizontal scroll, mirroring or truncation problem.
- [ ] **Step 3: Walk the demo** on weber-design: type the Bürobedarf amount → link Böttcher from Payments → upload one file (Deutsche Bahn links itself) → upload two more (duplicate, direction) → fix both → Reset demo. The homepage count goes 5 → 4 → 3 → 2 → 4 → 2 → 5.
- [ ] **Step 4: Update** `web/README.md` (Documents page, simulated upload and pools, Reset demo also restores documents) and the spec line.
- [ ] **Step 5: Commit** `docs: describe the documents mockup`.
