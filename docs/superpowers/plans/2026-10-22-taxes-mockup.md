# Taxes Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Taxes page (VAT return and Year/EÜR) with a simulated ELSTER send and printable receipt, plus a tax reminder pop-up on opening the app, on sample data in EN/DE/AR.

**Architecture:** Pure functions in `domain/vat-return.ts` and `domain/tax-year.ts` derive every figure from the booked payments and the Settings tax profile; sent returns and the year's opening line are stored per business in the sample data, so Reset demo restores them. One `currentVatReturn()` feeds the Taxes page, the homepage tax card/tile, the review inbox finish line and the reminder, replacing the stored `vatDue` and Settings' profile-only `vatReturnDue()` for display.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui, Transloco.

**Spec:** [docs/specs/2026-10-22-taxes-mockup-design.md](../../specs/2026-10-22-taxes-mockup-design.md)

**Start condition:** run only after the Settings page (branch `setup-settings-mockup`) is merged. Branch from that merge (e.g. `morty-taxes`). All paths below are under `web/src/app/` unless they start with `web/`.

## Global Constraints

- No backend, real ELSTER, tax ID handling or real income-tax calculation; all data from `data/`; changes live in memory (reload / Reset demo restores sent returns, reminders and data).
- Phone first, no horizontal scroll at 375 px; computer from Tailwind `lg`. Colours via shadcn utilities and project tokens (`positive`, `negative`, `warning`); logical utilities; Arabic mirrors.
- Amounts, dates and ticket numbers in `<bdi dir="ltr">`; `money`/`appDate` pipes; German tax terms through `<app-term>` (add keys `umsatzsteuer`, `vorsteuer`, `elster`, `uebertragungsprotokoll`, `einkommensteuererklaerung`, `feststellungserklaerung`, `umsatzsteuererklaerung` where missing; reuse `ustva`, `euer`, `kleinunternehmer`, `dauerfristverlaengerung` if they exist).
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft).
- `DEMO_TODAY` = `2026-10-22`; storage only via `SafeStorage`.
- No personal tax advice: the page states figures and deadlines only.
- Reuse existing pieces (`paymentStatus`, `Booking.vatRate`, `PRIVATE_OUT`/`PRIVATE_IN`, Settings' tax profile, review inbox `/review`, `printOnceRendered` from `print/print-once.ts`, `<app-revenue-tracker>`, `<app-booking-label>`, `DemoStateService.dataGeneration`); never copy them.
- Commits stage only the task's files (explicit paths); never `.superpowers/`.

## Review Focus

1. **Changing the tax profile in Settings while using Taxes** (monthly ↔ quarterly, extension on/off, Kleinunternehmer on/off, yearly only) — figures, period and due date recompute; no crash. Tests: Task 1 `current return follows profile changes`, Task 5 `taxes page follows a profile change`.
2. **A period with more VAT paid than charged** — "You get €X back", never a negative "You pay". Tests: Task 1 `refund period`, Task 5 `refund shows "You get … back"`.
3. **Reset demo after sending** — the sent return disappears, the period is current again, reminders come back. Tests: Task 3 `reset restores the unsent return`, Task 4 `reset brings reminders back`.
4. **A reminder acknowledged for an old deadline** — a later deadline still reminds. Test: Task 4 `a new deadline reminds again`.
5. **Amounts in Arabic** — results, VAT lines and receipt amounts read left-to-right inside RTL text. Tests: Task 4 Arabic dialog, Task 5 `amounts are ltr in Arabic`.

---

## File Structure

```
domain/vat-return.ts          # periods, due dates, VAT per payment, currentVatReturn (Task 1)
domain/tax-year.ts            # year summary, returns due at year end (Task 2)
state/tax.service.ts          # send flow, sending state (Task 3)
state/tax-reminder.service.ts # which reminders show, Got it / Not now (Task 4)
shell/tax-reminder.ts         # the pop-up (Task 4)
taxes/taxes.page.ts, vat-return-tab.ts, year-tab.ts (Task 5), send-dialog.ts (Task 6)
print/vat-receipt.page.ts     # Übertragungsprotokoll print view (Task 6)
```

---

### Task 1: VAT return figures and one shared due date

**Files:**
- Create: `domain/vat-return.ts` (+ spec)
- Modify: `data/models.ts`, `data/sample-data.ts` (+ spec), `home/cards/tax-card.ts`, `home/cards/key-numbers.ts`, `review/finish.ts` (+ their specs), any other caller found in Step 1

**Interfaces:**
- Consumes (from Settings; Step 1 checks these names in the merged code and the report lists differences): `TaxProfile { kleinunternehmer; vatPeriod: 'monthly'|'quarterly'|'yearly'|null; permanentExtension; vatBasis; businessKind; … }`, `vatReturnDue(profile, today)` in `domain/tax-details.ts`; `paymentStatus(tx)`; `Booking.vatRate`; `PRIVATE_OUT`/`PRIVATE_IN`.
- Produces:

```ts
// models.ts
export interface SentVatReturn {
  periodStart: string; periodEnd: string; sentOn: string; // ISO dates
  chargedCents: number; paidCents: number; resultCents: number; ticket: string;
}
// Business gains `vatReturns: SentVatReturn[]`; the stored `vatDue` is removed (its date and amount are now calculated).

// vat-return.ts
export const DUE_SOON_DAYS = 21;
export interface TaxPeriod { start: string; end: string; kind: 'monthly' | 'quarterly' } // ISO dates, inclusive; not Settings' `VatPeriod` type
export function vatPartCents(tx: Transaction): number;   // |gross| × r ÷ (100 + r), rounded to the cent; 0 with no booking or rate 0 (private bookings are 0 %)
export function periodFor(date: string, kind: TaxPeriod['kind']): TaxPeriod;
export function nextPeriod(p: TaxPeriod): TaxPeriod;
export function dueDateFor(p: TaxPeriod, profile: TaxProfile): string; // 10th of the month after p.end, one month later with permanentExtension; no weekend shift
export interface VatReturnView {
  period: TaxPeriod; dueDate: string; daysLeft: number;   // daysLeft < 0 when overdue
  state: 'inProgress' | 'ready' | 'overdue';              // inProgress: period.end >= today; overdue: dueDate < today
  chargedCents: number; paidCents: number; resultCents: number; // result = charged − paid
  salesCount: number; salesNetCents: number; purchasesCount: number;
  needsYouCount: number;   // payments in the period whose status isn't 'booked'
  amountKnown: boolean;    // false when no booked payment in the period has a VAT rate above 0
}
export type CurrentVat = { kind: 'return'; view: VatReturnView } | { kind: 'yearly' } | null; // null: Kleinunternehmer or vatPeriod null
export function vatReturnFor(business: Business, period: TaxPeriod, today: string = DEMO_TODAY): VatReturnView;
export function currentVatReturn(business: Business, today: string = DEMO_TODAY): CurrentVat;
```
  Counted payments: dated within the period (payment dates, Ist), status `booked`; money in adds to charged and sales, money out to paid and purchases (count only those with a VAT part above 0). Current period: `nextPeriod` of the latest `vatReturns` entry, re-cut with `periodFor(day after its periodEnd, kind)` when the profile's period kind has changed since; with no sent return, `periodFor(today, kind)`.
- Sample data: Weber Design `vatReturns` = August 2026 (sent 2026-09-08) and September 2026 (sent 2026-10-08), stored as literals; a sample-data test asserts their charged/paid/result equal `vatReturnFor` for those months. Café Linde = Q2 (2026-04-01..2026-06-30, sent 2026-07-09, plausible literals). Café's Q3 must give a non-zero result from booked payments (add a few booked July payments if August–September aren't enough, keeping existing Payments/homepage tests' meaning). Weber's October must give a result above 0 from its booked payments. Sara: `[]`. Tickets in the form `ET-2026-0908-41827`.
- Display: homepage tax card, computer key-number tile and review finish line read `currentVatReturn`: date `view.dueDate`; amount `view.resultCents` (`home.tax.amountUnknown` when `!amountKnown`); `overdue` → red "Overdue since {date}" (new key); otherwise "Due {date}"; `yearly` → the existing "Yearly VAT return only". Settings' tests whose expectations change are updated: Café now shows Q3 overdue since 10 Oct (owner's decision), Weber's amount is the calculated one.

- [ ] **Step 1: Check the Settings names** (Consumes) and grep every reader of `vatDue` and `vatReturnDue`. Each one that shows a business's next deadline moves to `currentVatReturn`; `vatReturnDue` stays only where a profile-only answer is still needed (e.g. a Settings preview of an unsaved profile). List the readers in the report.
- [ ] **Step 2: Write the failing tests:** `vatPartCents: 19 % of 119.00 is 19.00, 7 % of 107.00 is 7.00, 0 % and private are 0`; `periods and due dates` (October 2026 monthly → due 2026-11-10, with extension 2026-12-10; December 2026 → 2027-01-10; Q3 2026 → 2026-10-10; Q4 2026 → 2027-01-10, with extension 2027-02-10); `weber current return is October 2026, inProgress, due 2026-11-10, daysLeft 19, result > 0`; `cafe current return is Q3, overdue, due 2026-10-10, result > 0, needsYouCount 0`; `refund period` (only purchases → resultCents < 0); `needsYou counts unbooked payments in the period`; `sara is null`; `yearly profile gives { kind: 'yearly' }`; `current return follows profile changes` (Weber made quarterly → Q4 2026 due 2027-01-10; Weber with extension → 2026-12-10); `sent sample returns match the calculation`; homepage card, tile and finish line show the calculated amount for Weber and "Overdue since 10 Oct" for Café.
- [ ] **Step 3: Run** `cd web && npx ng test --watch=false` → the new tests FAIL.
- [ ] **Step 4: Implement** the interfaces above and move the readers from Step 1.
- [ ] **Step 5: Run** the full suite → PASS.
- [ ] **Step 6: Commit** `feat: calculate the VAT return from booked payments`.

---

### Task 2: Year figures (EÜR)

**Files:**
- Create: `domain/tax-year.ts` (+ spec)
- Modify: `data/models.ts`, `data/sample-data.ts` (+ spec)

**Interfaces:**
- Consumes: `vatPartCents`, `paymentStatus`, `PRIVATE_OUT`/`PRIVATE_IN`.
- Produces:

```ts
// models.ts — Business gains:
//   legalForm: 'sole' | 'gbr';
//   yearOpening: { incomeCents: number; costsCents: number; costsByCategory: CategoryTotal[] }; // January–July, net for VAT businesses
export interface CategoryTotal { labelKey: string; skr03: string; nameDe: string; cents: number }
export type YearReturn = 'euer' | 'einkommensteuererklaerung' | 'feststellungserklaerung' | 'umsatzsteuererklaerung';
export interface YearSummary {
  openingIncomeCents: number; openingCostsCents: number;          // January–July line
  paymentsIncomeCents: number; paymentsCostsCents: number;        // from payments, since paymentsSince
  incomeCents: number; costsCents: number; profitCents: number;   // opening + payments
  paymentsSince: string;            // date of the business's first payment this year
  byCategory: CategoryTotal[];      // costs, opening merged in, largest first
  returns: YearReturn[];            // in this order
  dueDate: string;                  // '2027-07-31'
}
export function yearSummary(business: Business, today: string = DEMO_TODAY): YearSummary;
```
  From payments: booked, not private, this calendar year up to today; money in is income, money out is costs; net (gross − `vatPartCents`) for a business that charges VAT, gross for a Kleinunternehmer. Returns: `euer`; then `feststellungserklaerung` for `legalForm 'gbr'`, else `einkommensteuererklaerung`; then `umsatzsteuererklaerung` when the business charges VAT.
- Sample data: `legalForm` Café `gbr`, others `sole`; `yearOpening` sized so each business's `incomeCents` equals its existing `revenueThisYearCents` on the sample as loaded (Sara: 2 130 000), costs plausible.

- [ ] **Step 1: Write the failing tests:** `year income equals revenueThisYearCents for every sample business`; `VAT business amounts are net` (a booked 119.00 sale at 19 % adds 100.00 income); `Kleinunternehmer amounts are gross`; `private and unbooked payments are left out`; `categories merge opening and payments, largest first`; `returns per business` (weber: euer, einkommensteuererklaerung, umsatzsteuererklaerung; cafe: euer, feststellungserklaerung, umsatzsteuererklaerung; sara: euer, einkommensteuererklaerung); `due 2027-07-31`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: calculate the year figures`.

---

### Task 3: Sending a VAT return (simulated)

**Files:**
- Create: `state/tax.service.ts` (+ spec)
- Modify: `state/demo-state.service.ts` (+ spec)

**Interfaces:**
- Consumes: `currentVatReturn`, `SentVatReturn`, `DemoStateService` (open business, `dataGeneration`).
- Produces: `DemoStateService.recordSentReturn(r: SentVatReturn): void` (appends to the open business's `vatReturns`). `TaxService` (root): `SEND_MS = 1500`; `readonly sending: Signal<boolean>`; `canSend(view: VatReturnView): boolean` (state ≠ `inProgress` and `needsYouCount === 0`); `send(): Promise<SentVatReturn | null>` — for the open business's current return: null when it can't be sent or a send is already running; otherwise sets `sending`, waits `SEND_MS`, and unless `dataGeneration` changed meanwhile (→ null) records `{ periodStart, periodEnd, sentOn: DEMO_TODAY, chargedCents, paidCents, resultCents, ticket }` and returns it. Ticket: `ET-<YYYY>-<MMDD of sentOn>-<5 digits>`, the digits derived deterministically from business id + periodStart (so tests are stable).

- [ ] **Step 1: Write the failing tests** (fake timers): `cafe Q3 is sent after SEND_MS and Q4 becomes current, inProgress, due 2027-01-10`; `sending is true while waiting`; `a second send while sending returns null`; `weber October can't be sent (in progress)`; `a period with payments needing you can't be sent`; `reset during sending records nothing`; `reset restores the unsent return`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS.
- [ ] **Step 5: Commit** `feat: send a VAT return (simulated)`.

---

### Task 4: Tax reminder pop-up

**Files:**
- Create: `state/tax-reminder.service.ts`, `shell/tax-reminder.ts` (+ specs)
- Modify: `shell/app-shell.ts`, i18n

**Interfaces:**
- Consumes: `currentVatReturn`, `DUE_SOON_DAYS`, `DemoStateService` (signed-in person, their businesses, `setBusiness`, `dataGeneration`), `SafeStorage`, Router.
- Produces: `TaxReminderService` (root):
  - `readonly due: Signal<{ businessId: string; name: string; view: VatReturnView }[]>` — the person's businesses whose current return (`kind: 'return'`) has `daysLeft <= DUE_SOON_DAYS` (overdue included), minus acknowledged ones (storage key `mockup.taxReminder.<personId>.<businessId>.<dueDate>`); oldest due date first.
  - `readonly open: Signal<boolean>` — true when the app starts and again after each `dataGeneration` change, if `due()` isn't empty.
  - `gotIt(): void` — acknowledges every listed reminder, closes. `notNow(): void` — closes until the next app start or reset. `openTaxes(businessId: string): void` — `setBusiness`, navigate to `/taxes`, close as Not now.
  - Reset demo clears every `mockup.taxReminder.*` acknowledgement, then reopens.
  
  `<app-tax-reminder>` in the app shell (spartan dialog): title "A tax return is coming up" / "{n} tax returns are coming up"; one block per business: name, "VAT return (UStVA) for {period}", "due {date} · in {n} days" or red "Overdue since {date}", **Open taxes**; then **Got it, don't remind me again** (main) and **Not now**; ✕, Escape and clicking outside = Not now.

- [ ] **Step 1: Write the failing tests:** `on start weber (due in 19 days) and cafe (overdue) are listed, cafe first`; `got it hides them for good (new service instance, same storage)`; `not now shows them again on the next start`; `a new deadline reminds again` (acknowledged 2026-11-10 doesn't hide 2026-12-10); `open taxes switches business and goes to /taxes`; `kleinunternehmer gets no reminder`; `reset brings reminders back`; `no pop-up when nothing is due`; `escape closes as not now`; `Arabic dialog is rtl with ltr dates`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: remind about tax returns when the app opens`.

---

### Task 5: Taxes page

**Files:**
- Create: `taxes/taxes.page.ts`, `taxes/vat-return-tab.ts`, `taxes/year-tab.ts` (+ specs)
- Modify: `app.routes.ts` (lazy `taxes` inside the shell), `shell/menu.ts` (Taxes → `/taxes`), homepage tax card/tile **Open taxes** → `/taxes`, `payments/payments.page.ts` (`?month=YYYY-MM` sets the initial month filter, same pattern as Documents' `?add=1`), i18n

**Interfaces:**
- Consumes: Tasks 1–3; `<app-term>`, `<app-revenue-tracker>`, `<app-booking-label>`; `/review`; `business.incomeTaxReserveCents`.
- Produces `/taxes`:
  - **Charges VAT:** tabs **VAT return** / **Year (EÜR)**; the Year tab is `?tab=year`.
  - **VAT return tab**, top to bottom:
    1. Deadline strip "{period} · due {date} (in {n} days)": warning colour when `daysLeft <= DUE_SOON_DAYS`, red "Overdue since {date}" when overdue, plain otherwise; adds "in progress" while `state === 'inProgress'`.
    2. Result: "You pay €X" / "You get €X back" with "to the tax office" / "from the tax office"; prefixed "So far" while in progress; "Amount not known yet" when `!amountKnown`.
    3. How it adds up: VAT you charged (`umsatzsteuer`) with "{n} sales · €X net", VAT you paid (`vorsteuer`) with "{n} purchases", the result line, "Based on payment dates", **See the payments** → `/payments?month=<YYYY-MM of period.start>`.
    4. Needs-you card "{n} payments still need you — fix them so the return is right" with **Start** → `/review`; hidden at 0.
    5. **Send to the tax office (ELSTER)**: disabled with "Ready to send from {day after period.end}" while in progress; "Fix {n} payments first" → `/review` while needs-you > 0; otherwise opens the send dialog (Task 6; until then an inert button).
    6. Sent earlier: each `vatReturns` entry, newest first — period, "sent {date}", amount, *Sent* chip, **Receipt** (Task 6 route).
  - **Yearly-only profile:** VAT tab shows "Yearly VAT return only · due 31 Jul 2027".
  - **Year tab** (from `yearSummary`): "January–July (earlier months)" line, unlinked; "From {paymentsSince}" income and costs, linked to `/payments`; total income, costs, profit; costs by category with `<app-booking-label>`; income tax set aside (`incomeTaxReserveCents`); the returns with `<app-term>` and "due 31 Jul 2027"; the line "These are prepared at the end of the year."
  - **Kleinunternehmer:** no tabs — revenue tracker, "No VAT return needed", then the Year content.
  - Computer: same sections, two columns where they fit.

- [ ] **Step 1: Write the failing tests:** `weber VAT tab shows October in progress, so far you pay, ready to send from 1 Nov`; `cafe shows Q3 overdue since 10 Oct with "You pay"`; `refund shows "You get … back"`; `see the payments opens /payments with the month filter set`; `needs-you card starts the review`; `sent earlier lists september then august with receipts`; `yearly profile shows yearly only`; `sara shows the tracker, no tabs, year figures`; `year tab lists the returns with German terms`; `taxes page follows a profile change`; `amounts are ltr in Arabic`; `menu and homepage open /taxes`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: add the taxes page`.

---

### Task 6: Send dialog and receipt

**Files:**
- Create: `taxes/send-dialog.ts`, `print/vat-receipt.page.ts` (+ specs)
- Modify: `taxes/vat-return-tab.ts`, `app.routes.ts` (top-level `print/vat-return/:periodStart`, outside the shell like the Payments print views), i18n

**Interfaces:**
- Consumes: `TaxService.send/sending/canSend`, the open business's `vatReturns`, `printOnceRendered`.
- Produces:
  - Send dialog (spartan dialog on computer, full-width sheet on phone). Check step: period, VAT charged, VAT paid, result, "Your return will be sent through ELSTER, the tax office's official channel."; **Send** / **Cancel**. Then "Sending…" while `sending()`, then "Sent ✓" with the ticket, **Print receipt** (→ `/print/vat-return/<periodStart>`) and **Close**.
  - Receipt page: reads the stored `SentVatReturn` (never recalculates): business name, period, charged, paid, result, sent date, ticket, titled with `<app-term>` `uebertragungsprotokoll`; prints once via `printOnceRendered`; a Back link (`print:hidden`) to `/taxes`. An unknown period shows "Nothing to print" and doesn't print.

- [ ] **Step 1: Write the failing tests** (fake timers): `send flow: check → Sending… → Sent with ticket, and Sent earlier lists Q3`; `cancel sends nothing`; `receipt shows the stored figures and ticket and prints once`; `unknown period shows nothing to print`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** the full suite → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: send dialog and ELSTER receipt`.

---

### Task 7: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1:** Full suite and `npx ng build` pass with no budget warnings (report a warning rather than raise the budget).
- [ ] **Step 2:** Controller checks by eye at 375 × 812 and 1280 × 800, in English and Arabic: the reminder on start (two businesses, Café red), Got it / Not now / reload; Taxes for Weber, Café (send flow and receipt print view) and Sara; a Settings profile change reflected; homepage card/tile and review finish line.
- [ ] **Step 3:** README: a short "Taxes" section — what's calculated and how, sending is simulated, reminder rules, Reset demo.
- [ ] **Step 4: Commit** `docs: describe the taxes page`.
