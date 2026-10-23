# Invoices Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An Invoices page (list with money owed, one invoice, new invoice on one screen) with simulated sending, reminders, cancel/duplicate, payment matching and an invoice-details section in Settings, on sample data in EN/DE/AR.

**Architecture:** An `Invoice` record per business (in `Business.invoices`) is the source of truth for drafts, numbers, lines, reminders, payments and cancellation; a sent invoice also has a sent `Doc` (linked through `Doc.invoice`), so Documents, Payments and the review inbox keep working. Pure functions in `domain/invoices.ts` derive totals, status, numbers, the legal checklist, the format and matching; `InvoiceService` performs the simulated actions through `DemoStateService`.

**Tech Stack:** Angular 22 (standalone, zoneless, signals, OnPush), Vitest via `ng test`, Tailwind CSS 4, spartan/ui helm (`web/libs/ui`, incl. `dialog`, `dropdown-menu`), Transloco.

**Spec:** [docs/specs/2026-10-23-invoices-mockup-design.md](../../specs/2026-10-23-invoices-mockup-design.md)

**Start:** a worktree `.claude/worktrees/morty-invoices`, branch `morty-invoices` from `morty-documents` (b72619e or later). All paths below are under `web/src/app/` unless they start with `web/`.

## Global Constraints

- No backend; all data from `data/`; changes live in memory (reload / Reset demo restores invoices, numbers and payments). Emails, e-invoices and payments are simulated; no XML is generated.
- Phone first, no horizontal scroll at 375 px; computer from Tailwind `lg`. Colours via shadcn utilities and project tokens (`positive`, `negative`, `warning`); logical utilities so Arabic mirrors.
- Amounts, dates, IBANs and invoice numbers in `<bdi dir="ltr">`; `money`/`appDate`/`appMonth` pipes; German terms via `<app-term>` (add `TermKey`s + `terms.<key>.{label,de,explain}`: `rechnung`, `stornorechnung`, `zahlungserinnerung`, `mahnung`, `leitwegId`, `eRechnung`, `zugferd`, `xrechnung`, `reverseCharge`).
- UI text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). The invoice itself (paper, email and reminder texts) comes from `domain/invoice-texts.ts` in German or English only and is always laid out left-to-right.
- `DEMO_TODAY` = `2026-10-22`; storage only via `SafeStorage`.
- No personal tax advice: the app applies the general rules in the spec and says what's missing.
- New pages are lazy routes. If `npx ng build` passes the 600 kB initial warning, raise `budgets[initial].maximumWarning` in `web/angular.json` to `650kB` and say so in the report (the README notes it in Task 11).
- Reuse existing pieces (`docStatus`, `visibleDocuments`, `documentCandidates`, `DemoStateService.link`, `ReviewService.answer`, `DialogCard`, `printOnceRendered`, `openedFrom`, category bookings, the amount parsing used by the review inbox's "check amount" card); never copy them.
- Commits stage only the task's files (explicit paths); never `.superpowers/` or `.claude/`. Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Numbers stay unique and gap-free** through sends, cancellations (next number in the same sequence), duplicates and Reset demo. Test in Task 3 (`numbers stay unique through send, cancel and reset`).
2. **Over- or double payment** — a second payment after *Paid*, or one larger than what's left, leaves *Paid* with nothing left, never a negative "left". Test in Task 1 (`overpayment stays paid with nothing left`).
3. **A sent invoice can't be changed** — `/invoices/:id/edit` for a sent invoice opens the invoice instead; Documents can't edit or remove an invoice's document. Tests in Task 8 (`a sent invoice opens read-only`) and Task 9 (`an invoice's document is locked`).
4. **A tax-profile change in Settings** — drafts follow the current profile (Kleinunternehmer → no VAT, § 19 note), sent invoices keep the VAT and note they were sent with. Test in Task 1 (`drafts follow the profile, sent invoices are frozen`).
5. **Arabic** — the paper, numbers, IBANs and amounts read left-to-right inside the RTL page; country names come from `Intl.DisplayNames` in the UI language. Test in Task 6 (`the paper is ltr in Arabic`).

---

## File Structure

```
data/models.ts, data/categories.ts            # Invoice types; two revenue bookings for customers abroad (Task 1)
domain/invoices.ts (+ spec)                   # totals, status, numbers, format, tax note, checklist, owed, rows, matching (Task 1)
domain/invoice-texts.ts (+ spec)              # German/English texts for paper and emails (Task 1)
data/sample-invoices.ts (+ spec)              # sample invoices and invoice profiles (Task 2)
state/invoice.service.ts (+ spec)             # send, remind, cancel, duplicate, cash, simulate, link (Task 3)
settings/invoice-details.ts, settings/invoice-details.page.ts   # Settings section + edit page (Task 4)
invoices/invoices.page.ts, invoices/owed-card.ts, invoices/invoice-row.ts   # list (Task 5)
invoices/invoice.page.ts, invoices/invoice-paper.ts, print/invoice-print.page.ts   # one invoice, paper, print (Task 6)
invoices/invoice-send-dialog.ts, invoices/invoice-actions.ts   # send / remind / cancel / cash / demo payment (Task 7)
invoices/invoice-form.page.ts, invoices/customer-fields.ts, invoices/invoice-lines.ts   # new / edit draft (Task 8)
```

---

### Task 1: Invoice domain

**Files:**
- Create: `domain/invoices.ts`, `domain/invoice-texts.ts` (+ specs)
- Modify: `data/models.ts`, `data/categories.ts`, i18n (category labels)

**Interfaces:**
- Consumes: `Business`, `Transaction`, `Doc`, `TaxProfile`, `SetupSteps`, `HistoryEntry`, `docStatus`, `visibleDocuments`, `DEMO_TODAY`, `addDays` (from `domain/bank-connection.ts`).
- Produces (models):

```ts
export type CustomerKind = 'business' | 'private' | 'public';
export interface InvoiceCustomer { name: string; street: string; postcode: string; city: string; country: string /* ISO alpha-2, 'DE' default */; email: string; kind: CustomerKind; vatId: string | null; leitwegId: string | null }
export type InvoiceUnit = 'piece' | 'hour' | 'day' | 'flat';
export interface InvoiceLine { description: string; quantity: number; unit: InvoiceUnit; unitPriceCents: number } // net for a VAT business, as charged for a Kleinunternehmer
export type ServicePeriod = { kind: 'date'; date: string } | { kind: 'month'; month: string /* YYYY-MM */ };
export type TaxNote = 'kleinunternehmer' | 'reverseCharge' | 'notTaxable';
export interface Invoice {
  id: string; number: string | null;              // null while a draft
  customer: InvoiceCustomer; lines: InvoiceLine[];
  vatRate: 0 | 7 | 19; taxNote: TaxNote | null;   // chosen rate for drafts; frozen effective rate + note once sent
  language: 'de' | 'en'; issueDate: string; servicePeriod: ServicePeriod; paymentTermDays: number;
  sentOn: string | null; docId: string | null; paymentIds: string[];
  reminders: { level: 1 | 2; sentOn: string }[];
  cancelledBy: string | null; cancels: string | null; // ids of the cancellation / the cancelled invoice
  history: HistoryEntry[];                          // newest first
}
export interface InvoiceProfile { name: string; street: string; postcode: string; city: string; email: string; iban: string | null; numberPattern: string /* 'RE-{YYYY}-{NNN}' */; paymentTermDays: number; language: 'de' | 'en' }
// Business gains: invoices: Invoice[]; invoiceProfile: InvoiceProfile
// Doc gains: invoice: { id: string; role: 'invoice' | 'cancellation'; cancelled: boolean } | null   (null on every existing doc)
// HistoryKey gains: 'invoiceCreated' | 'invoiceSent' | 'invoiceReminded' | 'invoicePaid' | 'invoicePartlyPaid' | 'invoiceCancelled' | 'invoiceCancellation' | 'invoiceDuplicated' | 'paidInCash' | 'paysInvoice'
// NoticeKind gains: 'invoiceOverdue'   (STEP_FOR_KIND: 'bank')
```
- Produces (`domain/invoices.ts`):

```ts
export type InvoiceStatus = 'draft' | 'open' | 'overdue' | 'partlyPaid' | 'paid' | 'cancelled' | 'cancellation';
export type InvoiceFormat = 'pdf' | 'zugferd' | 'xrechnung';
export const EU_COUNTRIES: readonly string[];          // the 27 member states, 'DE' included
export const REMINDER_GAP_DAYS = 7;
export function taxNoteFor(customer: InvoiceCustomer, profile: TaxProfile): TaxNote | null; // KU → 'kleinunternehmer'; business abroad in EU → 'reverseCharge'; business outside EU → 'notTaxable'; else null
export function effectiveVatRate(invoice: Invoice, profile: TaxProfile): 0 | 7 | 19;      // sent: invoice.vatRate; draft: 0 when taxNoteFor ≠ null, else invoice.vatRate
export function effectiveTaxNote(invoice: Invoice, profile: TaxProfile): TaxNote | null;  // sent: invoice.taxNote; draft: taxNoteFor
export function invoiceFormat(customer: InvoiceCustomer, profile: TaxProfile): InvoiceFormat; // public → xrechnung (KU too); KU → pdf; abroad → pdf; business → zugferd; private → pdf
export interface InvoiceTotals { lineNets: number[]; netCents: number; vatCents: number; grossCents: number }
export function invoiceTotals(invoice: Invoice, profile: TaxProfile): InvoiceTotals;    // line net = round(qty × unitPrice); vat = round(net × rate / 100)
export function dueDateOf(invoice: Invoice): string;                                     // issueDate + paymentTermDays
export function paidCents(invoice: Invoice, business: Business): number;                // sum of |amount| of linked payments
export function leftCents(invoice: Invoice, business: Business): number;                // max(0, gross − paid)
export function invoiceStatus(invoice: Invoice, business: Business, today?: string): InvoiceStatus; // draft → cancellation → cancelled → paid (paid ≥ gross) → partlyPaid (paid > 0) → overdue (due < today) → open
export function nextInvoiceNumber(business: Business, year: string): string;             // pattern from invoiceProfile; NNN = 1 + highest NNN among this business's invoice numbers and sent-doc invoiceNos matching the pattern for that year; 3 digits
export type ChecklistKey = 'sellerAddress' | 'taxNumber' | 'customerName' | 'customerAddress' | 'customerEmail' | 'customerVatId' | 'leitwegId' | 'privateAbroad' | 'lines' | 'servicePeriod';
export interface ChecklistItem { key: ChecklistKey; ok: boolean; fixAt: 'settingsInvoice' | 'settingsTax' | 'customer' | 'lines' | 'dates' }
export function invoiceChecklist(invoice: Invoice, business: Business, steps: SetupSteps): ChecklistItem[]; // only the items that apply (taxNumber: ok when steps.tax and a tax number or VAT ID exists; customerVatId: EU business abroad; leitwegId: public; privateAbroad: private + country ≠ DE → never ok)
export function canSendInvoice(invoice: Invoice, business: Business, steps: SetupSteps): boolean; // draft and every item ok
export interface OwedSummary { owedCents: number; owedCount: number; overdueCents: number; overdueCount: number }
export function owedSummary(business: Business, steps: SetupSteps, today?: string): OwedSummary; // visible rows: open/overdue/partlyPaid invoices by leftCents (overdue = due < today) + file rows that are waiting/overdue
export type InvoiceRow = { kind: 'invoice'; invoice: Invoice; status: InvoiceStatus } | { kind: 'file'; doc: Doc; status: 'open' | 'overdue' | 'paid' };
export function invoiceRows(business: Business, steps: SetupSteps, today?: string): InvoiceRow[]; // drafts always; sent invoices whose doc is in visibleDocuments; file rows = visible sent docs with invoice === null that aren't on a cash account; order: drafts, overdue, open/partlyPaid by due date, then paid/cancelled/cancellation newest first
export function reminderState(invoice: Invoice, business: Business, today?: string): { next: 1 | 2 | null; availableFrom: string | null }; // only overdue (incl. partly paid past due); 1 when none sent; 2 when level-1 sentOn + REMINDER_GAP_DAYS ≤ today (else availableFrom); null after level 2
export function invoiceMatch(business: Business, tx: Transaction): { invoice: Invoice; certain: boolean } | null; // money in, receipt 'missing': an open/overdue/partlyPaid invoice whose number is in tx.reference → certain; else exactly one whose leftCents === amount → not certain; else null
export function invoiceDocFor(invoice: Invoice, business: Business): Doc;               // the sent Doc: fileName `${number}.pdf`, direction 'sent', name customer.name, invoiceNo number, date sentOn, dueDate, amountCents |gross|, vatRate, booking per rate/note, fromUpload true, invoice link
export function revenueBookingFor(invoice: Invoice, profile: TaxProfile): Booking;      // KU → existing KU revenue; reverseCharge → REVENUE_EU_RC; notTaxable → REVENUE_ABROAD; 19/7 → existing revenue bookings
export function savedCustomers(business: Business): InvoiceCustomer[];                  // distinct by name+country, most recent invoice first
export function earlierLines(business: Business): InvoiceLine[];                        // distinct by description, most recent first
```
- `data/categories.ts` gains `REVENUE_EU_RC` (SKR03 8336, vat 0) and `REVENUE_ABROAD` (SKR03 8338, vat 0), not in the category picker list, with labels in i18n.
- `domain/invoice-texts.ts`: `invoiceText(lang: 'de' | 'en', key: InvoiceTextKey, params?): string` covering the paper (title Rechnung/Invoice, Stornorechnung/Cancellation invoice with "zu Rechnung {number} vom {date}", labels, service period, the three tax notes — de: "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet.", "Steuerschuldnerschaft des Leistungsempfängers", "Nicht im Inland steuerbare Leistung"; en equivalents — payment line with due date and IBAN) and three emails (invoice, friendly reminder, formal reminder: subject + body with `{number}`, `{amount}`, `{date}`, `{name}`).

- [ ] **Step 1: Write the failing tests** (`domain/invoices.spec.ts`, `domain/invoice-texts.spec.ts`), with small invoice fixtures built in the spec:
  `totals: 2 h × €80 + flat €340 at 19 % → net 50000, vat 9500, gross 59500`; `kleinunternehmer: rate 0, note kleinunternehmer, format pdf`; `EU business abroad: rate 0, reverseCharge, vatId required`; `business outside EU: notTaxable, pdf`; `public office: xrechnung and leitwegId required, also for a KU`; `private abroad can't be sent`; `status order` (draft, cancellation, cancelled, paid, partlyPaid, overdue on 2026-10-22 for due 2026-10-21, open for due today); `overpayment stays paid with nothing left`; `due date = issue + term`; `next number after RE-2026-044 is RE-2026-045; another year starts at 001`; `checklist names a missing tax number and seller address, and the tax step while it isn't done`; `drafts follow the profile, sent invoices are frozen`; `reminder: 1 when overdue; 2 available 7 days after level 1; null after level 2; null when not overdue`; `invoiceMatch: reference names the number → certain; only the amount → not certain; two same-amount invoices → null; money out → null`; `owed sums what's left and splits overdue`; `rows order`; `texts: de and en have the same keys; KU note wording exact`.
- [ ] **Step 2: Run** `cd web && npx ng test --watch=false --include=src/app/domain/invoices.spec.ts --include=src/app/domain/invoice-texts.spec.ts` → FAIL.
- [ ] **Step 3: Implement** the models (every existing `Doc` gets `invoice: null`; every `Business` an empty `invoices` and a placeholder profile until Task 2), categories and the functions above.
- [ ] **Step 4: Run** the full suite `npx ng test --watch=false` → PASS.
- [ ] **Step 5: Commit** `feat: invoice rules and totals`.

---

### Task 2: Sample invoices

**Files:**
- Create: `data/sample-invoices.ts` (+ spec)
- Modify: `data/sample-data.ts` (+ spec), `data/sample-documents.ts`, `domain/document-status.ts`, `domain/document-matching.ts` (+ specs), affected specs

**Interfaces:**
- Consumes: Task 1.
- Produces: `SAMPLE_INVOICES: Record<string, Invoice[]>`, `INVOICE_PROFILES: Record<string, InvoiceProfile>`; every sent sample doc that is an invoice gets `invoice: { id, role: 'invoice', cancelled: false }` and `invoiceNo` = the invoice number.
- `docStatus`: a doc with `invoice.role === 'cancellation'` or `invoice.cancelled` is `done`. `documentCandidates`: leaves out those docs.
- Sample (amounts in cents; numbers follow the existing references; invented addresses; invoice language `de`):
  - **Amounts add up:** each paid sample invoice's gross equals its payment's amount to the cent. Choose integer net prices that round to it at the booking's rate (e.g. net 126050 → gross 150000 at 19 %; net 45378 → 54000; net 40336 → 48000); a test asserts it.
  - **weber-design:** paid invoices behind doc-wd-t1 (RE-2026-041), t7 (043), t9 (038), t11 (036), t13 (031) with `paymentIds` [their payment]; **Studio Kern RE-2026-044** (wd-d2, 238000, issued 2026-10-16, term 14 → due 30 Oct, open); **Bäckerei Lange RE-2026-039** (wd-d3, 119000, issued 2026-09-16, due 30 Sep, overdue, no reminder); **cancelled RE-2026-040** to "Agentur Nord" (net 50000 → 59500, issued 2026-10-01) with its **cancellation RE-2026-042** (2026-10-07), sent docs `wd-d5` (cancelled) and `wd-d6` (cancellation); **draft to Bezirksamt Pankow** (public, Leitweg-ID `11001-01234-56`, one flat line 350000 net at 19 % → 416500). New payment `wd-t19`: 2026-10-21, "Kern Studio Berlin", +238000, reference "Danke für die Zusammenarbeit", `REVENUE_19`, confirmed, `receipt: 'missing'` (drives the review question; Weber's decisions 6 → 7).
  - **cafe-linde:** paid invoices behind doc-cl-t6 (RE-2026-052), cl-t9 (049), cl-t17 (RE-2026-044, the July Sommerfest; doc `invoiceNo` becomes "RE-2026-044"); new open invoice **RE-2026-053** to "Kanzlei Hoffmann" (catering, net 108000 at 19 % → gross 128520, issued 2026-09-25, term 14 → due 9 Oct, friendly reminder sent 2026-10-12 → formal reminder available from 19 Oct) with its sent doc `cl-d1`. Cash closings stay non-invoices.
  - **sara-yoga:** paid KU invoices behind doc-sy-t1 (019), t2 (020), t6 (016), t9 (017), t12 (013); new **RE-2026-021** to "Physio Zentrum Mitte" (60000, issued 2026-10-14, term 30 → due 13 Nov) with doc `sy-d2` and a new booked payment `sy-t13` (2026-10-21, +30000, reference "RE-2026-021 Anzahlung", `receipt: 'attached'`) → partly paid, €300.00 left. Lower Sara's `yearOpening.incomeCents` by 30000 so her year income stays 2 130 000.
  - **Invoice profiles:** addresses (Weber Design, Lindenstr. 5, 10969 Berlin; Café Linde GbR, Lindenallee 4, 20259 Hamburg; Sara Weber Yoga, Kastanienallee 12, 10435 Berlin), the business's first bank IBAN, `RE-{YYYY}-{NNN}`, 14 days, `de`, email `<id>@invoices.example`.

- [ ] **Step 1: Failing tests:** `every sent invoice has exactly one sent doc with the same number and amount`; `paid sample invoices total exactly their payments`; `weber has every state: open, overdue, cancelled, cancellation, paid, draft`; `weber owed is 357000 with 119000 overdue`; `cafe RE-2026-053 is overdue and offers the formal reminder`; `sara RE-2026-021 is partly paid with 30000 left and her year income is still 2130000`; `weber's Kern payment is a not-certain match for RE-2026-044`; `cash closings are not invoice rows`; `next numbers: weber RE-2026-045, cafe RE-2026-054, sara RE-2026-022`; `a cancelled invoice's doc is done and not offered to payments`; decision counts become weber 7 / sara 3 / café 0 (update the pinned specs deliberately, and the unlinked-doc list in `sample-data.spec.ts`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; `npx ng build` (raise the warning budget per Global Constraints if needed).
- [ ] **Step 5: Commit** `feat: sample invoices`.

---

### Task 3: InvoiceService and state changes

**Files:**
- Create: `state/invoice.service.ts` (+ spec)
- Modify: `state/demo-state.service.ts` (+ spec)

**Interfaces:**
- Consumes: Tasks 1–2; `DemoStateService.addDocument/updateDocument/addCashBox/dataGeneration/setup`.
- Produces — `DemoStateService` (open business unless a `businessId` is given): `saveInvoice(invoice: Invoice, businessId?: string): void` (insert or replace by id); `removeInvoice(id: string): void` (drafts only); `saveInvoiceProfile(profile: InvoiceProfile): void`; `addTransaction(tx: Transaction, businessId?: string): void` (newest first); `linkInvoicePayment(invoiceId: string, txId: string, auto: boolean, businessId?: string): void` (adds the id to `paymentIds`, sets the payment's `receipt: 'attached'` + `receiptFile` = the invoice's file, history lines `paysInvoice` / `invoicePaid` or `invoicePartlyPaid`; when the invoice is now fully paid its doc gets `paymentId` = this payment).
- `InvoiceService` (root): `SEND_MS = 1500`; `readonly sending: Signal<string | null>` (invoice id, cleared by a Reset demo); `newDraft(): Invoice` (not saved; defaults from the profile: today, current month, term, language, vatRate 19); `saveDraft(invoice: Invoice): void`; `send(id: string, email: { to: string; subject: string; body: string }): Promise<boolean>` (only when `canSendInvoice(invoice, business, demo.setup())`; after `SEND_MS`, unless the data generation changed: number = `nextInvoiceNumber`, `sentOn` = today, freeze `vatRate`/`taxNote`, add the doc via `invoiceDocFor`, history `invoiceSent`); `remind(id: string, level: 1 | 2, email): Promise<boolean>` (only when `reminderState(...).next === level`; adds the reminder + history); `cancel(id: string): string | null` (sent and unpaid only: a cancellation invoice with the next number, same lines, `cancels` = id, its doc with role `cancellation`; the original gets `cancelledBy`, its doc `cancelled: true`; returns the new id); `duplicate(id: string): string` (new saved draft: same customer, lines, rate, language; today; current month; profile term; history `invoiceDuplicated`); `markPaidInCash(id: string, date: string): void` (cash box created if missing; a booked incoming cash payment of `leftCents` with `revenueBookingFor`, `receipt: 'attached'`; linked; history `paidInCash`); `simulatePayment(id: string): void` (only with a connected bank: an incoming payment on the first bank account, today, `leftCents`, reference = the number, booked + confirmed, `receipt: 'missing'`, then linked as `auto` because `invoiceMatch` is certain); `confirmMatch(txId: string, invoiceId: string): void` (the review inbox's Yes).

- [ ] **Step 1: Failing tests** (fake timers): `send gives RE-2026-045, freezes the rate and adds a visible sent doc`; `send is refused while the checklist isn't complete`; `reset during sending sends nothing`; `numbers stay unique through send, cancel and reset`; `remind level 1 then level 2 only after 7 days`; `cancel creates RE-2026-04x cancellation and marks the original cancelled; a paid invoice can't be cancelled`; `duplicate makes a draft with today's dates`; `mark paid in cash adds a cash box and a booked payment, invoice paid`; `simulate payment links automatically and the invoice is paid`; `confirm match pays RE-2026-044 from the Kern payment`; `partial payment then the rest → paid, doc done`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: send, remind, cancel and pay invoices (simulated)`.

---

### Task 4: Invoice details in Settings

**Files:**
- Create: `settings/invoice-details.ts` (Settings card), `settings/invoice-details.page.ts` (+ specs)
- Modify: `settings/settings.page.ts`, `settings/opened-from.ts` if needed, `app.routes.ts` (lazy `settings/invoice`), i18n

**Interfaces:**
- Consumes: `saveInvoiceProfile`, `InvoiceProfile`, the business's bank accounts, `openedFrom`.
- Produces: route `/settings/invoice` (accepts `?from=settings|invoice`, back goes there). Card on Settings after the tax details: name and address, IBAN (formatted), number pattern with "Next number: RE-2026-045", payment term, invoice language, **Edit**. Edit page follows the tax-details page pattern: fields name, street, postcode, city, IBAN (pick from connected accounts or type; validated as an IBAN shape), number pattern (must contain `{NNN}`), payment term (7 / 14 / 30 days), language (German / English); the sender email shown read-only; **Save** → `saveInvoiceProfile`, back.

- [ ] **Step 1: Failing tests:** `settings shows the invoice details card with the next number`; `edit and save changes the address and term`; `a pattern without {NNN} can't be saved`; `back returns to where it came from`; Arabic page is rtl with ltr IBAN.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: invoice details in settings`.

---

### Task 5: Invoices list

**Files:**
- Create: `invoices/invoices.page.ts`, `invoices/owed-card.ts`, `invoices/invoice-row.ts` (+ specs)
- Modify: `app.routes.ts` (lazy `invoices`), `shell/menu.ts` (invoices → `/invoices`), `shell/coming-soon.page.ts` (drop `'invoices'`), their specs, i18n

**Interfaces:**
- Consumes: `invoiceRows`, `owedSummary`, `reminderState`, `invoiceStatus`, `leftCents`, `dueDateOf`.
- Produces: `/invoices` with `?filter=open|overdue|drafts|paid` (All when absent). `<app-owed-card>` (input-free, reads the open business; used again on the homepage in Task 10): "Owed to you" + total + count, red overdue part + count, each a link setting the filter; hidden when nothing is owed. Chips All · Open · Overdue (count) · Drafts (count) · Paid. Rows: name, number (or "Draft") and date, amount, status chip — *Draft*, *Due {date}* / *Due today*, *Overdue {n} days* (red), *Partly paid · {left} left*, *Paid {date}*, *Cancelled*, *Cancellation*, file rows *Added from a file*. Overdue rows show **Send reminder** / **Send formal reminder** (when `reminderState.next`) → `/invoices/:id?remind=1`; between levels "Reminded {date}". Row → `/invoices/:id` (file rows → `/documents/:docId`). **+ New invoice** → `/invoices/new`. Empty states for no invoices and for an empty filter (with "Show all").

- [ ] **Step 1: Failing tests:** `weber: owed €3,570.00, €1,190.00 overdue`; `overdue filter shows Bäckerei Lange with Send reminder linking to remind`; `drafts filter shows Bezirksamt Pankow`; `café row shows Send formal reminder`; `sara row shows Partly paid · €300.00 left`; `filter in the URL`; `menu and bottom bar open /invoices`; `new client state shows only drafts and written invoices`; amounts ltr in Arabic.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: add the invoices list`.

---

### Task 6: One invoice, the paper, the print view

**Files:**
- Create: `invoices/invoice.page.ts`, `invoices/invoice-paper.ts`, `print/invoice-print.page.ts` (+ specs)
- Modify: `app.routes.ts` (`invoices/:id`; top-level `print/invoice/:id`), i18n

**Interfaces:**
- Consumes: Tasks 1–3, `invoiceText`, `printOnceRendered`.
- Produces: `<app-invoice-paper [invoice] [business]>` — the invoice as the customer sees it, `dir="ltr"` and `lang` = the invoice language: seller block, customer block (country name in the invoice language), title + number + date (or "Draft"), service period, lines table, net / VAT rate and amount or the tax note, total, payment line (due date, IBAN), seller tax number / VAT ID, format line ("E-Rechnung (ZUGFeRD)" / "XRechnung" / nothing), "Your logo" placeholder; cancellation invoices titled Stornorechnung with the original's number and date. `/invoices/:id`: header (name, status chip, number, amount, due), paper, "What happened" (history with links to the payment / cancellation / original), and the next-step area with what this task owns: **Edit** for a draft (→ `/invoices/:id/edit`) and **Download PDF** (→ `/print/invoice/:id`) for a sent invoice. Task 7 adds Preview and send, the reminder buttons, Duplicate, Mark as paid, Cancel invoice and the demo payment to this area. Unknown id → "Invoice not found" with a link to the list. Print view: the paper alone, prints once, Back link `print:hidden`.

- [ ] **Step 1: Failing tests:** `the paper shows seller, customer, lines, VAT 19 % and total for RE-2026-044`; `a KU invoice shows the § 19 note and no VAT`; `reverse charge note and the customer's VAT ID`; `xrechnung line with Leitweg-ID for the Pankow draft`; `english invoice texts`; `the paper is ltr in Arabic`; `history links to the paying payment`; `print view prints once`; `unknown invoice says not found`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: show one invoice and its print view`.

---

### Task 7: Sending, reminders and the other actions

**Files:**
- Create: `invoices/invoice-send-dialog.ts`, `invoices/invoice-actions.ts` (+ specs)
- Modify: `invoices/invoice.page.ts`, i18n

**Interfaces:**
- Consumes: `InvoiceService`, `DialogCard`, the helm dialog and dropdown menu, `invoiceText` emails, `reminderState`, `invoiceFormat`.
- Produces: `<app-invoice-send-dialog [invoiceId] [kind: 'invoice' | 'reminder1' | 'reminder2'] [(open)]>` — To (customer email), Subject, editable Message prefilled from the invoice texts in the invoice's language, attachment line (`RE-….pdf`, "+ ZUGFeRD e-invoice" or `RE-….xml (XRechnung)`), **Send** / **Cancel** → "Sending…" (`sending() === invoiceId`) → "Sent ✓" (+ the new number for an invoice) with **Close**; a `false` result closes quietly. The invoice page opens it from **Preview and send** and from `?send=1` (Task 8) and `?remind=1` (Task 5). `<app-invoice-actions>`: **Mark as paid** (date, default today → `markPaidInCash`), ⋯ **Duplicate** (→ the new draft's edit page), ⋯ **Cancel invoice** (confirm dialog with the spec's sentence → `cancel` → shows the cancellation and offers **Make a corrected copy** = duplicate of the original), paid invoices show "Cancelling a paid invoice needs a credit note — coming later" instead; **DEMO · Simulate the customer's payment** (demo styling, only with a connected bank and status open/overdue/partly paid). Between reminder levels the next-step area shows "Reminded {date} · formal reminder possible from {date}".

- [ ] **Step 1: Failing tests** (fake timers): `preview and send: Sending… then Sent ✓ RE-2026-045, the invoice is open`; `?send=1 opens the send step`; `?remind=1 on Bäckerei Lange sends the friendly reminder`; `café formal reminder`; `cancel makes a cancellation and offers a corrected copy`; `paid invoices can't be cancelled`; `mark as paid in cash`; `demo payment turns Studio Kern paid; hidden without a bank`; `a reset while sending closes quietly`; Arabic dialog rtl with ltr numbers.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: send invoices and reminders, cancel and duplicate`.

---

### Task 8: New invoice and editing a draft

**Files:**
- Create: `invoices/invoice-form.page.ts`, `invoices/customer-fields.ts`, `invoices/invoice-lines.ts` (+ specs)
- Modify: `app.routes.ts` (`invoices/new`, `invoices/:id/edit`), i18n

**Interfaces:**
- Consumes: `InvoiceService.newDraft/saveDraft`, `removeInvoice`, `savedCustomers`, `earlierLines`, `invoiceTotals`, `invoiceChecklist`, `canSendInvoice`, `invoiceFormat`, `effectiveTaxNote`, `EU_COUNTRIES`, the existing amount parsing.
- Produces: one screen (spec "New invoice"): **Customer** — saved customers, recent first, or **+ New customer** (name, street, postcode, city, country select with `Intl.DisplayNames` names, `DE` first; email; kind Business / Private person / Public office; VAT number when an EU business abroad; Leitweg-ID when public; private + abroad shows "Customers abroad are businesses only for now"). **What you did** — lines (description with suggestions from `earlierLines` filling unit and price, quantity, unit, unit price accepting `49,90`/`49.90`, remove line), **+ Add a line**, VAT 19 % / 7 % (hidden with the note's plain-language explanation when a tax note applies), live net / VAT / total. **Dates** — invoice date, work done in (month or date), pay within (7 / 14 / 30) with the due date. **Invoice language** (German / English). **Ready to send** — the checklist, each missing item named with a link (`/settings/invoice?from=invoice`, `/settings/tax`, or focusing the field), the format as `<app-term>`, "Number RE-2026-045 is given when you send". **Preview and send** (enabled only when `canSendInvoice`) → `/invoices/:id?send=1`. The draft is saved on the first change and on every change after; an untouched new form saves nothing. ✕ → back to the list, keeping the draft; **Delete draft** on an existing draft. `/invoices/:id/edit` for a sent invoice redirects to `/invoices/:id`.

- [ ] **Step 1: Failing tests:** `a new invoice to Agentur Nord with 2 lines totals €2,380.00 and can be sent`; `line suggestions fill price and unit`; `amount accepts 49,90 and 49.90`; `KU business shows no VAT and the § 19 note`; `EU business needs a VAT number before sending`; `public office asks for the Leitweg-ID and shows XRechnung`; `private abroad can't be sent`; `untouched new form saves nothing; a change saves a draft`; `delete draft`; `a sent invoice opens read-only`; Arabic form rtl with ltr amounts.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: write a new invoice`.

---

### Task 9: Documents and Payments

**Files:**
- Modify: `documents/document-detail.page.ts`, `documents/document-fields.ts`, `documents/document-status-chip.ts`, `payments/payment-detail.page.ts` (or its document section), `payments/document-picker.ts` (+ specs), i18n

**Interfaces:**
- Consumes: `Doc.invoice`, `invoiceStatus`, `leftCents`, `InvoiceService.confirmMatch`/`DemoStateService.linkInvoicePayment`.
- Produces: an invoice's document on Documents shows "Written in Invoices" with **Open invoice** (`/invoices/:id`) and no Edit, Remove or category change; its chip reads *Waiting · {left} left* when partly paid, *Done · Cancelled* when cancelled, *Cancellation of {number}* for a cancellation. A payment detail whose id is in an invoice's `paymentIds` shows "Pays invoice {number}" linking to it. Picking an invoice's document in the document picker for an incoming payment links through `linkInvoicePayment` (so partial payments add up).

- [ ] **Step 1: Failing tests:** `an invoice's document is locked and opens the invoice`; `partly paid chip shows what's left`; `cancelled and cancellation chips`; `payment shows Pays invoice RE-2026-041`; `picking Studio Kern's document for the Kern payment pays the invoice`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: link invoices with documents and payments`.

---

### Task 10: Review inbox, homepage and notices

**Files:**
- Modify: `review/payment-card.ts` (+ spec), `domain/home-cards.ts`, `home/home.page.ts` (+ specs), `state/notice.service.ts`, `domain/notices.ts`, `home/cards/notices-card.ts` (+ specs), i18n

**Interfaces:**
- Consumes: `invoiceMatch`, `InvoiceService.confirmMatch`, `<app-owed-card>`, `owedSummary`, `reminderState`.
- Produces: the review inbox's *receipt missing* card for an incoming payment with a not-certain `invoiceMatch` asks "Is this the payment for invoice {number} from {name}?" with **Yes** (main; `confirmMatch` through `ReviewService.answer`, result "Invoice paid ✓") / **Pick another** (the document picker) / **No receipt needed**; other receipt-missing cards are unchanged. Homepage: `HomeCards.owed` (true when the bank step is done and `owedSummary` > 0) and `<app-owed-card>` after the decisions card on all sizes (update the pinned card order). Notices: computed `invoiceOverdue` notices, one per overdue invoice with no reminder yet (id `invoice-overdue-<invoiceId>`, urgency 2, params name/number/days/id), text "{name} is {days} days late with {number}", action "Send reminder" linking to `/invoices/<id>?remind=1` (the notices card's link mapping learns per-notice links).

- [ ] **Step 1: Failing tests:** `weber's inbox asks whether the Kern payment pays RE-2026-044; Yes pays it and owed drops to €1,190.00`; `pick another and no receipt still work`; `homepage shows Owed to you for weber (€3,570.00) and hides it for a business with nothing owed`; `Bäckerei Lange notice links to the reminder; it disappears after reminding`; `no invoice notice before the bank step`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; build OK.
- [ ] **Step 5: Commit** `feat: invoices in the review inbox, homepage and notices`.

---

### Task 11: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1:** Full suite and `npx ng build` pass (note the initial size; budget change if any).
- [ ] **Step 2:** Controller checks by eye at 375 × 812 and 1100 × 700, en and ar: list and filters, Bäckerei Lange reminder from the notice, Café formal reminder, Sara partly paid, a new invoice to an EU business and to a public office, send → number → Documents, simulate payment → Paid, cancel → cancellation, Kern question in the review inbox, Settings invoice details, print view.
- [ ] **Step 3:** README: an "Invoices" section (statuses, matching, reminders, formats and customers abroad, what's simulated, numbering, budget note if raised).
- [ ] **Step 4: Commit** `docs: describe the invoices page`.
