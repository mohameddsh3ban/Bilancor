# Reports Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Reports page on sample data — the year month by month, closing a finished month after our own check (and automatically when its VAT return is sent), a simulated DATEV export for the tax advisor with a printable summary, and the audit export — with Payments refusing changes in a closed month, in EN/DE/AR, phone-first.

**Architecture:** Closed months live on each business (`Business.closedMonths`), and the stored year opening gets a fixed last month (`yearOpening.untilMonth`). Pure functions in `domain/months.ts` and `domain/exports.ts` work out the month rows, the close check and the export summaries from the same per-payment rule as Taxes › Year (shared out of `domain/tax-year.ts`), so Reports and Taxes never disagree. `DemoStateService` gains `closeMonth`, and recording a sent VAT return closes its months. One lazy route `/reports` plus a print page.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`, dialogs through `HlmDialogImports` + `core/layout/dialog-card.ts`), Transloco.

**Spec:** [docs/specs/2026-10-23-reports-mockup-design.md](../../specs/2026-10-23-reports-mockup-design.md) (approved mockup `.superpowers/brainstorm/1746-1792758932/content/reports-page.html`, with the later change that a missing receipt blocks closing; conventions in `web/README.md`)

## Global Constraints

- **Start only when sign-in and accounts is merged** (it needs `Business.people`, `myRole`, `signedInGuard`, `data/new-business-sample.ts`), in a fresh worktree with `git status` clean under `web/`. Task 1's first step re-checks the names below against that code and the Invoices code.
- No real file is made: every download shows its made-up file name in a dashed `border-warning` demo box; **Print summary** opens the browser's Print dialog.
- One rule for "needs you" everywhere: `paymentStatus(tx) !== 'booked'` (unclear, unconfirmed, or receipt missing). It blocks closing a month; a possible duplicate only warns.
- Month figures use exactly Taxes › Year's rule: booked, not private, net of VAT for a business that charges VAT, gross for a Kleinunternehmer.
- Only Reports and Payments respect a closed month; Documents, the review inbox, receipt linking and Invoices' Mark as paid stay unchanged.
- No reopening, no corrections, no tax advice: the audit card says to ask the tax advisor first.
- `DEMO_TODAY = '2026-10-22'`; October 2026 is the running month; never the real clock.
- German terms through `<app-term>` (new keys `bwa`, `gdpdu`, `festschreibung`); DATEV is a format name, not translated. Amounts, file names, months and dates in `<bdi dir="ltr">` where they mix with text; every status shows a word (Closed, Not closed, Running, Partly closed).
- Phone first: every screen works at 375 px with no horizontal scroll; two columns from Tailwind `lg`. Colours only via the shadcn utilities and `surface`, `positive`, `negative`, `warning`; logical utilities only; Arabic mirrors everything.
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). Specs that render text: `localStorage.clear()` in `beforeEach`, `LanguageService.setLang('en')` in `afterEach`.
- Edits live in memory; Reset demo restores the sample's closed months. `/reports` and the print page are lazy; `npx ng build` must have no budget warnings.
- Run tests from `web/` with `npx ng test --watch=false`. Commits stage only the task's own files by path (never `git add -A`); never stage `backend/`, `admin/`, `CLAUDE.md`, `.superpowers/`.

## Review Focus

1. **A quarter's VAT return** closes all three of its months; a month closed by hand before keeps its first date and "by", with no second history line. Test in Task 1 (`sending Q3 closes July to September once`).
2. **The year total drifting from Taxes** — after confirming a payment, booking an unclear one or marking one private, the month table's year total still equals `yearSummary(...).incomeCents/costsCents` for every sample business. Test in Task 1 (`month rows add up to the Taxes year, before and after a change`).
3. **Closing what can't be closed** — the running month, a month already closed, a month with a payment that needs the person, or a month of the opening line: nothing changes and no line is added. Test in Task 1 (`closeMonth refuses the running, closed, blocked and opening months`).
4. **A payment dated inside the earlier months** (a cash payment from Invoices' Mark as paid in July) adds to the opening line, adds no July row, and counts as closed in Payments. Test in Task 1 (`a payment in the earlier months joins that line`).
5. **Periods with mixed or no content** — a quarter with closed and open months reads "Partly closed"; a period with no payments says "Nothing to export yet" with no download. Test in Task 2 (`a mixed quarter is partly closed; an empty period has nothing to export`).

---

## File Structure

```
web/src/app/
  data/models.ts                  # ClosedMonth, Business.closedMonths, yearOpening.untilMonth, history key monthClosed (Task 1)
  data/sample-data.ts             # closed months and untilMonth per business (Task 1)
  data/new-business-sample.ts     # untilMonth for a business made in the demo (Task 1)
  domain/tax-year.ts              # paymentFigure shared with the months (Task 1)
  domain/months.ts                # month rows, closed or not, the close check, closing (Task 1)
  domain/exports.ts               # export periods, summary, rows, file names (Task 2)
  state/demo-state.service.ts     # closeMonth; sent returns close their months (Task 1)
  reports/                        # reports.page, month-table, close-month-dialog, export-card, audit-card (Tasks 3-4)
  print/export-summary.page.ts    # the printable export summary (Task 4)
  payments/                       # closed month: actions off, heading word (Task 5)
```

---

### Task 1: Closed months and the month figures

**Files:**
- Modify: `data/models.ts`, `data/sample-data.ts` (+ spec), `data/new-business-sample.ts` (+ spec), `domain/tax-year.ts` (+ spec), `state/demo-state.service.ts` (+ spec), `state/tax.service.ts` spec, i18n (`history.monthClosed`)
- Create: `domain/months.ts` (+ spec)

**Interfaces:**
- `models.ts`: `export interface ClosedMonth { month: string; on: string; by: string | null }` (`'YYYY-MM'`; ISO date; the person's full name, or null when its VAT return closed it). `Business` gains `closedMonths: ClosedMonth[]`. `yearOpening` gains `untilMonth: string` (`'YYYY-MM'`, the last month the stored opening covers). `HistoryKey` gains `monthClosed` (`month`, and `by` or `byReturn: '1'`).
- `tax-year.ts`: `paymentFigure(tx: Transaction, chargesVat: boolean): { incomeCents: number; costsCents: number } | null` (null for a private or not-booked payment), used by `yearSummary` and by the months.
- `months.ts`:
  - `type MonthState = 'closed' | 'notClosed' | 'running'`.
  - `interface MonthRow { kind: 'opening' | 'month'; from: string; until: string; incomeCents: number; costsCents: number; profitCents: number; state: MonthState }` (`from`/`until` are `'YYYY-MM'`; a month row has `from === until`).
  - `monthRows(business: Business, today: string): MonthRow[]` — the opening row (`'<year>-01'` to `untilMonth`, stored opening plus payments dated inside it, always `closed`; left out when it has no amounts and no payments) then every month after `untilMonth` up to `today`'s month; `running` for `today`'s month.
  - `yearTotals(rows: MonthRow[]): { incomeCents; costsCents; profitCents }`.
  - `isClosedDate(business: Business, date: string): boolean` (the date's month is in `closedMonths` or ≤ `untilMonth`).
  - `interface CloseCheck { unclear: number; confirm: number; noReceipt: number; duplicateDocIds: string[]; accounts: { accountId: string; result: 'matches' | 'statement' }[]; blocked: boolean }` — payments of the month by `paymentStatus`; documents with `docStatus(doc) === 'duplicate'` dated (`doc.date ?? doc.addedOn`) in the month; every non-cash account, `matches` when connected; `blocked` when any payment needs the person.
  - `closeCheck(business, month: string): CloseCheck`.
  - `closeMonth(business, month, by: string, today: string): Business` — same object for the running month, a closed month, an opening month or a blocked one; else adds the `ClosedMonth` and a `monthClosed` line.
  - `closeMonthsOf(business, periodStart: string, periodEnd: string, today: string): Business` — closes every month of the period not closed yet, `by: null`, one line each, no check.
- Sample (`closedMonths`, `untilMonth`): weber-design `untilMonth '2026-07'`, closed `2026-08` on `2026-09-08` and `2026-09` on `2026-10-08`, both `by: null`; sara-yoga `untilMonth '2026-07'`, closed `2026-08` on `2026-09-05` by `Sara Weber`; cafe-linde `untilMonth '2026-06'`, none closed. A business made in the demo: `untilMonth '2026-09'`, none closed.
- `DemoStateService`: `closeMonth(month: string): boolean` (the open business; owner or full access only; false when nothing changed); `recordSentReturn` also applies `closeMonthsOf` for the sent period. `resetData()` restores the sample's closed months (it already restores the businesses).

- [ ] **Step 1: Check the names** on the branch you build from: `yearSummary`, `paymentStatus`, `docStatus`, `recordSentReturn`, `myRole`, `newBusiness`, `markPaidInCash` (Invoices); add any new reader of `yearOpening` to this task.
- [ ] **Step 2: Failing tests:** `the sample's closed months and earlier months are as listed`; **`month rows add up to the Taxes year, before and after a change`** (each sample business; then confirm `wd-t1` and compare again); `October is running and September is not closed at Sara Weber Yoga`; `the opening row is closed and left out when it is empty`; **`a payment in the earlier months joins that line`** (a booked July payment at weber-design: no July row, the opening row grows, `isClosedDate` true); `closeCheck counts unclear, unconfirmed and receipt-less payments and blocks`; `a possible duplicate only warns`; `a connected account matches; a statement account says to check it`; **`closeMonth refuses the running, closed, blocked and opening months`**; `closing September at Sara Weber Yoga adds one closed month and one line by Sara Weber`; **`sending Q3 closes July to September once`** (cafe-linde through `TaxService`; then a second `closeMonthsOf` adds nothing); `resetData brings back the sample's closed months`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** (and update specs that build `Business` or `yearOpening` by hand). **Step 5: Run full suite** → PASS.
- [ ] **Step 6: Commit** `feat: close months and work out the year month by month`.

---

### Task 2: Export rules

**Files:**
- Create: `domain/exports.ts` (+ spec)

**Interfaces:**
- `type ExportKind = 'month' | 'quarter' | 'year'`; `interface ExportPeriod { kind: ExportKind; key: string; start: string; end: string }` (keys `'2026-10'`, `'2026-Q4'`, `'2026'`; ISO dates, `end` capped at `today`).
- `exportPeriods(business: Business, kind: ExportKind, today: string): ExportPeriod[]` — newest first: the months after `untilMonth` that have payments plus the running month; the quarters touching them; the year.
- `type ExportState = 'closed' | 'notClosed' | 'running' | 'partly'`.
- `interface ExportSummary { bookings: number; receipts: number; needsYou: number; state: ExportState; empty: boolean }` — bookings: the period's non-private payments; receipts: documents linked to them; `needsYou` by `paymentStatus`; `partly` when the period holds closed and other months; `empty` when there are no payments.
- `exportSummary(business, period: ExportPeriod, today: string): ExportSummary`.
- `interface ExportRow { date: string; counterparty: string; amountCents: number; skr03: string | null; nameDe: string | null; vatRate: number | null; hasReceipt: boolean; open: boolean }`; `exportRows(business, period): ExportRow[]` (oldest first; `open` when it needs the person).
- `exportFileName(businessId: string, period: ExportPeriod, file: 'datev' | 'csv'): string` → `weber-design_DATEV_2026-10.zip` / `weber-design_DATEV_2026-10.csv`; `auditFileName(businessId: string, year: number): string` → `weber-design_GDPdU_2026.zip`.

- [ ] **Step 1: Failing tests:** `month periods are the months with payments and the running one, newest first`; `Q3 2026 at Café Linde spans July to September`; `October at Weber Design counts its bookings, receipts and the payments that need Sara`; **`a mixed quarter is partly closed; an empty period has nothing to export`**; `export rows mark the open payments and leave private ones out`; `file names follow <id>_DATEV_<key>.zip / .csv and <id>_GDPdU_<year>.zip`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the export rules`.

---

### Task 3: The Reports page, month by month and closing

**Files:**
- Create: `reports/reports.page.ts` (+ spec), `reports/month-table.ts`, `reports/close-month-dialog.ts` (+ spec), `reports/audit-card.ts`
- Modify: `app.routes.ts` (lazy `reports` inside the shell), `shell/menu.ts` (`reports` → `/reports`), `shell/coming-soon.page.ts` (drop `'reports'`), their specs, `core/i18n/term.ts` (`TermKey`), i18n `reports.*`, `terms.*`

**Interfaces:**
- `ReportsPage` (`/reports`): before the tax step, the same pointer as Taxes (to `/settings/tax`); after it but before the bank step, "Connect your bank to see your months" with the bank step's link; else, in order: the needs-you line ("N payments still need you. They aren't in these figures or exports yet." + **Start** → `/review`, hidden at 0, count = `needsYouCount` of the business's payments), `MonthTable`, the export card (Task 4), `AuditCard`. Two columns from `lg` *(builder picks the pairs)*.
- `MonthTable` (`app-month-table`): title "Month by month <year>" with `<app-term key="bwa">`; the line "Income and costs without VAT, from the booked payments. Always up to date." (as paid for a Kleinunternehmer: "from the booked payments" without "without VAT"); one row per `MonthRow` (opening "Jan–Jul, earlier months"; months by name; the running one "until 31 Oct"), income, costs, profit, and the state word; a not-closed finished month adds **Close**; **Year so far**; a month row links to `/payments?month=<YYYY-MM>`; the line "August and September closed by themselves when their VAT returns were sent" when such months exist (listing them).
- `CloseMonthDialog`: title "Close <month>?", "Closing locks its bookings: they can't be changed any more." with `<app-term key="festschreibung">`, the `CloseCheck` lines (blocking: "2 to confirm, 1 receipt missing" + **Start**; duplicates + **Show** → `/documents`; each account "Matches the bank" or "Check it against your statement"), **Close <month>** (off while blocked) and **Not yet**. The running month shows "Ready to close from 1 Nov" instead of **Close**.
- `AuditCard`: title "For a tax audit" with `<app-term key="gdpdu">`, the sentence from the spec, **Download the audit export (ZIP)** → a demo box with `auditFileName`.

- [ ] **Step 1: Failing tests:** `the menu opens /reports and the coming-soon page no longer knows reports`; `before the tax step Reports shows the Taxes pointer; before the bank step it asks to connect the bank`; `Weber Design shows the earlier months, August and September closed, October running, and the year total of Taxes`; `the needs-you line counts missing receipts and Start opens the review inbox`; `a month opens Payments on that month`; `closing September at Sara Weber Yoga shows the passed check, then Closed`; `a blocked month says what is missing and Close is off`; `the running month says when it can be closed`; `the audit download shows weber-design_GDPdU_2026.zip`; `Arabic mirrors the table and keeps amounts left to right`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the Reports page with closing a month`.

---

### Task 4: Export for your tax advisor and its summary

**Files:**
- Create: `reports/export-card.ts` (+ spec), `print/export-summary.page.ts` (+ spec)
- Modify: `reports/reports.page.ts`, `app.routes.ts` (`print/export/:period` outside the shell, with `signedInGuard`), i18n `reports.export.*`, `print.*`

**Interfaces:**
- `ExportCard` (`app-export-card`): the title and sentence from the spec; Month / Quarter / Year (segmented) and a select of `exportPeriods`; the `exportSummary` line ("October: 18 bookings, 15 receipts · Running · 3 payments still need you"; "Nothing to export yet" when empty, with no downloads); when `needsYou > 0` two choices — **Export with them marked as open** (chosen first) and **Fix them first** (+ **Start**; the downloads are off while it is chosen) *(my call)*; **Download DATEV (ZIP)** and **Spreadsheet (CSV)** → a demo box with `exportFileName` and **Print summary** (`/print/export/<key>`); the advisor line: "Your tax advisor <name> can download it too, with their own login." for each joined `advisor` row of `business.people`, else "Invite your tax advisor in Settings › People with access" (link `/settings#people`).
- `ExportSummaryPage` (`/print/export/:period`): the business name, the period, the summary, and a table of `exportRows` (date, counterparty, amount, SKR03 account and German name, VAT rate, receipt yes/no, open or booked), outside the app shell, printing once after it renders (`printOnceRendered`, as `print/month-print.page.ts`); an unknown period key says so and doesn't print.

- [ ] **Step 1: Failing tests:** `Weber Design's October export shows its summary and the two choices`; `Fix them first turns the downloads off and Start opens the review inbox`; `Download DATEV shows weber-design_DATEV_2026-10.zip and Print summary`; `Quarter lists Q4 and Q3 2026; Q3 at Café Linde is not closed`; `the advisor line names Jana Hoffmann at Weber Design and points to People with access at Sara Weber Yoga`; `the summary page lists October's bookings with open ones marked, and prints once`; `an unknown period on the summary page says so and doesn't print`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the export for the tax advisor`.

---

### Task 5: Payments in a closed month

**Files:**
- Modify: `payments/payment-detail.page.ts` (+ spec), `payments/payment-list.ts`, `payments/payment-table.ts`, `payments/payments.page.spec.ts`, i18n `payments.closed*`

**Interfaces:**
- A payment with `isClosedDate(business, tx.date)` shows every detail but no action — no Confirm, No receipt needed, Take a photo, Change, Business / Private, and no unlinking its receipt — with "<Month> is closed, so this payment can't be changed." Its row shows nothing extra.
- The month heading (phone list and computer table) adds the word **Closed** for a closed month (and for months inside the earlier-months line, when a payment is dated there).

- [ ] **Step 1: Failing tests:** `a September payment at Weber Design has no actions and says September is closed`; `an October payment still has its actions`; `closing September at Sara Weber Yoga takes the actions off its payments`; `the August and September headings say Closed`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: lock the payments of a closed month`.

---

### Task 6: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Run** `npx ng test --watch=false` and `npx ng build` from `web/` → all pass, no budget warnings.
- [ ] **Step 2: Look at it** (controller, browser preview) at 375 px and 1280 px, in en, de and ar: Reports for each sample business and a business made in the demo, the close dialog (passed, blocked, running), the export card (month, quarter, year, mixed, empty), the summary print page, Payments in a closed month.
- [ ] **Step 3: Walk the demo:** sign in → Reports at Weber Design → year total equals Taxes → export October (marked as open) → Print summary → Sara Weber Yoga → close September → its payments lose their actions → Café Linde → Taxes: send Q3 → Reports shows July to September closed → Reset demo → they are open again.
- [ ] **Step 4: Update** `web/README.md`: a "Reports" section (the figures and their rule, closing and its check, closing by a sent VAT return, the export and its demo box, the audit export, what Payments does, not built: reopening, corrections, the other pages, real files) and the menu line.
- [ ] **Step 5: Commit** `docs: describe the Reports page`.
