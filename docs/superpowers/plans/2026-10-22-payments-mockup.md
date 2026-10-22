# Payments Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Payments page (list + one payment) on sample data, with working search, filters and actions, linked from the homepage, in EN/DE/AR, phone-first.

**Architecture:** Payment status becomes derived from each payment's state (pure functions in `domain/`), so actions are pure `Transaction → Transaction` functions. `DemoStateService` holds an editable working copy of the sample businesses that both the homepage and Payments read; Reset demo restores it. The list and the detail are nested routes so the computer layout keeps the list beside the detail panel; print views are separate routes outside the app shell.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`), Transloco.

**Spec:** [docs/specs/2026-10-22-payments-mockup-design.md](../../specs/2026-10-22-payments-mockup-design.md) (builds on [the homepage design](../../specs/2026-10-21-homepage-mockup-design.md); conventions in `web/README.md`)

## Global Constraints

- No backend, HTTP data calls or real data; everything comes from `web/src/app/data/`.
- No names, amounts or details from the studied Bilancor account; no Bilancor wording, layout or code.
- Phone first: every screen works at 375 px with no horizontal scroll; computer layout from Tailwind `lg` (1024 px).
- Colours only via the shadcn utilities and the project tokens `surface`, `positive`, `negative`, `warning` (see `web/README.md`); no hard-coded colours.
- Logical utilities only (`ms-/me-/ps-/pe-/start-/end-/text-start/text-end`); Arabic (`dir="rtl"`) mirrors everything, including the detail panel side and back arrows (`rtl:rotate-180`).
- Amounts, IBANs, references and invoice numbers in `<bdi dir="ltr">`; counterparty names `dir="auto"` + `truncate` where they can be long.
- Every status shows a word, never only an icon. Every active filter shows as a removable chip.
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). SKR03 names stay German.
- Storage only via `SafeStorage`; sample-data edits live in memory only (reload or Reset demo restores them).
- Demo "today" is `DEMO_TODAY = '2026-10-22'`; no code reads the real clock.
- Run tests from `web/` with `npx ng test --watch=false`; `npx ng build` must have no budget warnings.
- Commits stage only the task's own files (`git add <paths>`, never `git add -A`): `backend/`, `admin/` and `CLAUDE.md` have changes the owner chose not to commit yet.
- For a Kleinunternehmer business, VAT always shows as "no VAT", whatever the category's rate.

## Review Focus

1. **Amount search as people type it** — `120,00`, `120.00`, `-120`, `1.500,00` find the matching payment. Test in Task 4 (`search matches amounts typed with comma, dot or minus`).
2. **Private, then Business again** restores exactly the earlier state, including *Receipt missing*. Test in Task 3 (`private round trip restores booking, confirmation and receipt`).
3. **Switching business with a payment open** — the open id belongs to the other business. Expected: back to the list, no crash. Test in Task 6 (`switching business with a payment open returns to the list`).
4. **Changing language with a payment open** — category, history lines and dates re-render in the new language (history is stored as keys, not text). Test in Task 6 (`history lines follow the language`).
5. **Filters that leave nothing** — the empty state names the active filters and offers Clear all; "Needs you" with nothing left shows the all-clear. Test in Task 5 (`empty result lists active filters and clears them`).

---

## File Structure

```
web/src/app/
  core/format/money.pipe.ts, date.pipe.ts     # shared pipes (Task 1)
  data/models.ts                              # extended (Task 2)
  data/sample-data.ts                         # 3 months per business (Task 2)
  data/categories.ts                          # CATEGORIES, PRIVATE_OUT, PRIVATE_IN (Task 2)
  data/demo-date.ts                           # DEMO_TODAY (Task 2)
  domain/payment-status.ts                    # paymentStatus, needsYouCount (Task 2)
  domain/payment-actions.ts                   # confirm, noReceiptNeeded, changeCategory, setPrivate (Task 3)
  domain/payment-filters.ts                   # filterPayments, matchesSearch, groupByMonth (Task 4)
  state/demo-state.service.ts                 # editable working copy (Task 3)
  payments/payments.page.ts                   # list page + outlet (Task 5)
  payments/payment-list.ts, payment-table.ts, payment-filters-bar.ts, payment-status-chip.ts (Task 5)
  payments/payment-detail.page.ts, category-picker.ts, payment-history.ts (Task 6)
  print/payment-print.page.ts, month-print.page.ts (Task 7)
```

---

### Task 1: Shared money and date pipes

**Files:**
- Create: `core/format/money.pipe.ts`, `core/format/date.pipe.ts`, `core/format/pipes.spec.ts`
- Modify: `home/cards/balances-card.ts`, `key-numbers.ts`, `tax-card.ts`, `revenue-tracker.ts`, `transactions-card.ts` (remove their `money()`/`date()` helpers)

**Interfaces:**
- Consumes: `formatMoney(cents, lang, opts?)`, `formatDate(iso, lang)` (`core/format/format.ts`), `LanguageService.lang()`.
- Produces: `MoneyPipe` (`name: 'money'`, `pure: false`) — `transform(cents: number, opts?: { signed?: boolean; whole?: boolean }): string`; `DatePipe` exported as `AppDatePipe` (`name: 'appDate'`, `pure: false`) — `transform(iso: string): string`. Both read `LanguageService.lang()` inside `transform`, so they follow language changes.

- [ ] **Step 1: Failing tests** in `pipes.spec.ts`: `money pipe formats in the current language` (en `€1,234.56`; after `setLang('de')`, NBSP→space, `1.234,56 €`); `money pipe passes signed and whole` (`+€1,500.00`, `€21,300`); `appDate pipe follows the language` (`'2026-10-21'` → en contains `21 Oct`, de contains `21. Okt`).
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** both pipes; replace every `money(...)`/`date(...)` call in the five homepage files with the pipes and delete the helpers.
- [ ] **Step 4: Run the full suite** → all existing homepage tests still pass (no visible change).
- [ ] **Step 5: Commit** `refactor: share money and date pipes across homepage cards`.

---

### Task 2: Payment data model, derived status and sample data

**Files:**
- Modify: `data/models.ts`, `data/sample-data.ts`, `data/sample-data.spec.ts`, `home/cards/transactions-card.ts`, `home/cards/decisions-card.ts`, `home/cards/key-numbers.ts` (+ their specs if they reference `status`/`decisionsOpen`)
- Create: `data/categories.ts`, `data/demo-date.ts`, `domain/payment-status.ts`, `domain/payment-status.spec.ts`

**Interfaces:**
- Produces (in `models.ts`):

```ts
export type ReceiptState = 'attached' | 'missing' | 'notNeeded';
export interface Booking { skr03: string; nameDe: string; labelKey: string; vatRate: 0 | 7 | 19 }
export type HistoryKey = 'imported' | 'autoBooked' | 'confirmed' | 'receiptNotNeeded' | 'categoryChanged' | 'markedPrivate' | 'markedBusiness';
export interface HistoryEntry { date: string; key: HistoryKey; params: Record<string, string> } // text: i18n "history.<key>"; params.category holds a labelKey
export interface Transaction {
  id: string; date: string; counterparty: string; accountId: string; amountCents: number;
  booking: Booking | null; confirmed: boolean; isPrivate: boolean;
  receipt: ReceiptState; receiptFile: string | null;
  counterpartyIban: string; reference: string;
  history: HistoryEntry[];
  beforePrivate: { booking: Booking | null; confirmed: boolean; receipt: ReceiptState } | null;
}
```
  `Transaction.status` and `Business.decisionsOpen` are **removed**; `TxStatus` stays.
- `paymentStatus(tx: Transaction): TxStatus` — the spec's order: no booking → `unclear`; not confirmed → `confirm`; receipt `missing` → `noReceipt`; else `booked`.
- `needsYouCount(txs: readonly Transaction[]): number` — count of status ≠ `booked`.
- `DEMO_TODAY = '2026-10-22'` (`data/demo-date.ts`).
- `CATEGORIES: Booking[]` — about 15 freelancer categories including every booking already used in the sample data, each with its VAT rate; `PRIVATE_OUT` = 1800 "Privatentnahmen allgemein", `PRIVATE_IN` = 1890 "Privateinlagen", both `vatRate: 0`, labelKeys `privateOut` / `privateIn`. New labelKeys get `booking.<key>` translations in all three files.

- [ ] **Step 1: Failing tests:**
  - `payment-status.spec.ts`: the four-step order, incl. `confirmed:false` + receipt `missing` → `confirm`; `isPrivate` payment with PRIVATE_OUT, confirmed, `notNeeded` → `booked`; `needsYouCount` of weber-design = 3, sara-yoga = 3, cafe-linde = 0.
  - `sample-data.spec.ts` (update): every business has payments in 2026-08, 2026-09 and 2026-10; weber-design and sara-yoga contain all four statuses; cafe-linde all `booked`; every `confirm`/`unclear` payment has receipt `attached`; every payment has an IBAN, a reference and ≥1 history entry; every booking is in `CATEGORIES` or is PRIVATE_OUT/PRIVATE_IN; the revenueLimit notice percent still matches.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the model, categories, demo date and status functions; rewrite the sample data (about 12–15 payments per business over Aug–Oct 2026; weber-design keeps its six October payments with the same derived statuses; customer payments carry invoice numbers like `RE-2026-041` in `reference`; IBANs made up, `DE` format). Switch the homepage to `paymentStatus(tx)` and `needsYouCount(business.transactions)`.
- [ ] **Step 4: Run the full suite** → PASS (homepage numbers for weber-design and cafe-linde unchanged).
- [ ] **Step 5: Commit** `feat: derive payment status and extend sample payments`.

---

### Task 3: Payment actions and editable demo data

**Files:**
- Create: `domain/payment-actions.ts`, `domain/payment-actions.spec.ts`
- Modify: `state/demo-state.service.ts` (+ spec), `shell/demo-toolbar.ts` (+ shell spec)

**Interfaces:**
- Consumes: `Transaction`, `Booking`, `HistoryEntry`, `PRIVATE_OUT`, `PRIVATE_IN`, `DEMO_TODAY`, `paymentStatus`.
- Produces (pure, each returns a new `Transaction` with one history entry dated `DEMO_TODAY` prepended):
  - `confirmBooking(tx)` → `confirmed: true`; history `confirmed` `{ category }`.
  - `markNoReceiptNeeded(tx)` → `receipt: 'notNeeded'`; history `receiptNotNeeded`.
  - `changeCategory(tx, booking)` → `booking`, `confirmed: true`; history `categoryChanged` `{ category }`.
  - `setPrivate(tx, isPrivate: boolean)` → private: save `beforePrivate`, booking PRIVATE_OUT (amount < 0) or PRIVATE_IN, `confirmed: true`, `receipt: 'notNeeded'`, history `markedPrivate`; business: restore from `beforePrivate`, clear it, history `markedBusiness`. No-op when already in that state.
- `DemoStateService` adds: `updateTransaction(id: string, change: (tx: Transaction) => Transaction): void` (on the current business), `resetData(): void`. `businesses` becomes a signal-backed working copy (`structuredClone(BUSINESSES)`); `business()` stays a signal reading it.
- Demo toolbar "Reset demo" calls both `notices.resetDismissals()` and `demo.resetData()`.

- [ ] **Step 1: Failing tests:**
  - `confirm on a payment with a missing receipt turns it into noReceipt` (confirmed:false, receipt missing → status `noReceipt`).
  - `changeCategory makes an unclear payment booked and logs it` (status `booked`, history[0] = `{ date:'2026-10-22', key:'categoryChanged', params:{ category:'travel' } }`).
  - `private round trip restores booking, confirmation and receipt` (wd-t3 → private → booked with 1800; → business → status `noReceipt`, booking TRAVEL, two new history entries).
  - `money in goes to 1890` (positive amount → PRIVATE_IN).
  - Service: `updateTransaction changes what business() returns and needsYouCount drops`; `resetData restores the original sample data`; shell: `Reset demo restores a changed payment`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add payment actions and editable demo data`.

---

### Task 4: Search, filters and month grouping

**Files:**
- Create: `domain/payment-filters.ts`, `domain/payment-filters.spec.ts`

**Interfaces:**
- Produces:

```ts
export type QuickFilter = 'all' | 'needsYou' | 'in' | 'out';
export interface PaymentFilter { quick: QuickFilter; accountId: string | null; month: string | null /* 'YYYY-MM' */; search: string }
export const EMPTY_FILTER: PaymentFilter; // { quick:'all', accountId:null, month:null, search:'' }
export function matchesSearch(tx: Transaction, search: string): boolean;
export function filterPayments(txs: readonly Transaction[], f: PaymentFilter): Transaction[]; // newest first
export interface MonthGroup { month: string; inCents: number; outCents: number; payments: Transaction[] }
export function groupByMonth(txs: readonly Transaction[]): MonthGroup[]; // newest month first; totals over the group's payments
export function monthsOf(txs: readonly Transaction[]): string[]; // newest first, for the month filter
```
  `matchesSearch`: case-insensitive substring on counterparty and reference; for amounts, strip spaces, `€`, `+`, thousands separators; accept `,` or `.` as decimal mark; compare against `|amountCents|` (and the sign if the query starts with `-`). An empty search matches everything.

- [ ] **Step 1: Failing tests:** `search matches amounts typed with comma, dot or minus` (`120`, `120,00`, `120.00`, `-120` find Deutsche Bahn −12000; `1.500,00` and `1500` find Müller +150000; `-1500` does not); `search matches name and reference case-insensitively` (`müller`, `RE-2026`); `needsYou keeps only non-booked`; `in/out split by sign`; `account and month combine`; `groupByMonth totals` (October group of weber-design: in/out sums match the data); `monthsOf` = `['2026-10','2026-09','2026-08']`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add payment search, filters and month grouping`.

---

### Task 5: Payments list page

**Files:**
- Create: `payments/payments.page.ts`, `payments/payment-filters-bar.ts`, `payments/payment-list.ts`, `payments/payment-table.ts`, `payments/payment-status-chip.ts` (+ specs `payments.page.spec.ts`, `payment-status-chip.spec.ts`)
- Modify: `app.routes.ts`, `shell/menu.ts` (+ `menu.spec.ts`), `home/cards/transactions-card.ts` (+ spec), i18n files

**Interfaces:**
- Consumes: Tasks 1–4; `homeCards`/`setupSteps` for the new-client state.
- Produces:
  - Routes inside `AppShell`: `payments` → `PaymentsPage` (lazy) with children `''` (nothing) and `':id'` → `PaymentDetailPage` (Task 6; create a placeholder component now, as for HomePage before). Filters live in the page as signals (not in the URL).
  - Menu `payments.route = '/payments'`; homepage "See all" → `/payments`, homepage rows → `/payments/<id>`.
  - `<app-payment-status-chip [status]>` — word + token colour (booked positive, confirm/unclear warning, noReceipt negative); the homepage transactions card switches to it.
  - Filters bar: search input; quick-filter buttons with "Needs you" count; account and month selects; removable chips for account/month/search; "Clear all" when anything is set. Computer only: "Download month" link → `/print/month?month=<filter month or newest>&account=<id?>` (route from Task 7; a placeholder route is fine until then).
  - Phone list (below `lg`) and computer table (from `lg`) over `groupByMonth(filterPayments(...))`; month headers with in/out totals; row → `/payments/<id>`; selected row highlighted.
  - Empty states: no results → "No payments match" + active filter chips + Clear all; `needsYou` with none → all-clear + "Show all payments"; setup state `new` → "Connect your bank to see your payments" with a button to `/soon/bank`, and Needs you count 0.
  - At `/payments/:id` below `lg` the list is hidden (detail full screen); from `lg` list and outlet sit side by side, outlet on the end side.

- [ ] **Step 1: Failing tests:** `menu Payments goes to /payments`; `homepage rows link to their payment`; `list groups by month with totals`; `quick filter Needs you shows 3 for weber-design`; `empty result lists active filters and clears them`; `needs-you with nothing left shows the all-clear` (cafe-linde); `new client sees connect-your-bank`; `status chip shows a word`; `counterparty truncates with dir auto and amounts are ltr bdi`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: add payments list page`.

---

### Task 6: One payment

**Files:**
- Modify: `payments/payment-detail.page.ts` (placeholder from Task 5)
- Create: `payments/category-picker.ts`, `payments/payment-history.ts` (+ specs `payment-detail.page.spec.ts`, `category-picker.spec.ts`)
- Modify: i18n files

**Interfaces:**
- Consumes: route param `id`; `DemoStateService.business()`/`updateTransaction`; actions from Task 3; `CATEGORIES`; `paymentStatus`; pipes.
- Produces: the detail view in the spec's order — header (signed amount, counterparty, date, account), Receipt (file name + placeholder thumbnail / not needed / missing with Take photo → `/soon/photo`, Pick from Documents → `/soon/documents`, **No receipt needed**, Self-issued receipt → `/soon/selfReceipt`), Booking (translated label + `skr03 nameDe` in ltr bdi, VAT rate — "no VAT" for a Kleinunternehmer — **Change**, **Confirm** when status is `confirm`, **Business/Private** toggle), Bank details (IBAN, reference), History (newest first, `history.<key>` with the category translated via `booking.<labelKey>`), **Download PDF** → `/print/payment/<id>`. Phone: back link to `/payments` (filters kept, since they live in the page). Unknown id (or id of another business) → navigate to `/payments`.
  - `<app-category-picker>`: searchable list of `CATEGORIES` (label + SKR03), emits the chosen `Booking`; a spartan popover on computer, full-width sheet-style panel on phone — builder's choice within spartan/ui.

- [ ] **Step 1: Failing tests:** `confirm turns Müller into booked and lowers Needs you`; `no receipt needed books Deutsche Bahn`; `choosing a category books Amazon and adds a history line`; `private shows 1800 and back to business shows receipt missing`; `kleinunternehmer shows no VAT`; `history lines follow the language` (switch to de → history text German, category label German); `switching business with a payment open returns to the list`; `category picker filters by typed text` (`reise` → Travel).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add payment details with working actions`.

---

### Task 7: Print views

**Files:**
- Create: `print/payment-print.page.ts`, `print/month-print.page.ts` (+ specs)
- Modify: `app.routes.ts`, `styles.css` (`@media print` rules), i18n files

**Interfaces:**
- Produces: top-level routes **outside** `AppShell`: `print/payment/:id` and `print/month` (query params `month=YYYY-MM`, optional `account`). Each renders a clean page in the current language/direction (business name, details or month table with totals, as the spec lists), calls `window.print()` once after first render (in tests, spy on `window.print`), and shows a "Back" link that is hidden when printing. Month print ignores quick filter and search.

- [ ] **Step 1: Failing tests:** `payment print shows business, amount, IBAN, booking and history`; `month print lists every payment of the month with totals` (weber-design 2026-10 count and sums); `month print respects the account param`; `print opens the dialog once`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add printable payment and month views`.

---

### Task 8: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1:** Full suite and `npx ng build` (no budget warnings — if the new lazy chunks push the initial bundle over 600 kB, report it rather than raising the budget).
- [ ] **Step 2:** Controller checks by eye at 375 × 812 and 1280 × 800, and 1024 × 768 for the table, in en and ar: list, filters and chips, empty states, detail (full screen / side panel), category picker, Private round trip, print views (Print preview), homepage count dropping after a fix, Reset demo.
- [ ] **Step 3:** README: a short "Payments" section — what works on sample data, what is still coming soon, that changes reset on reload / Reset demo.
- [ ] **Step 4: Commit** `docs: describe the payments mockup`.
