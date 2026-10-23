# Setup and Settings Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable setup (Your tax details, Connect your bank) and a three-section Settings page on sample data, where finishing a setup step really ticks it per business and the tax answers drive the rest of the app, in EN/DE/AR, phone-first.

**Architecture:** The single `SetupState` becomes three flags per business in `DemoStateService` (the toolbar's three choices become presets for the open business). Tax answers and bank connections live on each sample business (`TaxProfile`, `Account.connection`, a business `history`); everything shown about them is derived by pure functions in `domain/` (VAT return due date, tax office, connection status, bank notices). Three new routes under `/settings` hold the pages.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`), Transloco.

**Spec:** [docs/specs/2026-10-22-setup-and-settings-mockup-design.md](../../specs/2026-10-22-setup-and-settings-mockup-design.md) (builds on the [Payments](2026-10-22-payments-mockup.md), [Documents](2026-10-22-documents-mockup.md) and review-inbox work; conventions in `web/README.md`)

## Global Constraints

- **Start only when the review inbox is merged** into the branch you build from, and `git status` shows no uncommitted changes under `web/`. Task 1's first step re-checks the names below against that code.
- No backend, real bank connection, provider name (finAPI, Tink, GoCardless, Qwist …), credentials or official tax-office lookup; everything comes from `web/src/app/data/`.
- The simulated bank sign-in always shows "DEMO · no real bank, no password" and has no input fields.
- Banks are shown as initials tiles in project colours, never real logos.
- No answer to a tax question is pre-selected or called "recommended"; texts explain terms and say where the answer is written.
- No names, numbers or details from the studied Bilancor account; no Bilancor/BuchhaltungsButler wording, layout or code.
- Phone first: every screen works at 375 px with no horizontal scroll; computer layout from Tailwind `lg`.
- Colours only via the shadcn utilities and the project tokens `surface`, `positive`, `negative`, `warning`; logical utilities only; Arabic mirrors everything, including back arrows (`rtl:rotate-180`).
- IBANs, tax numbers, VAT IDs and amounts in `<bdi dir="ltr">`; IBANs always masked as `DE89 … 4321`.
- German terms next to translations through `<app-term>`; every status shows a word.
- Every saved change to tax details or bank accounts adds one line to the business `history` (stored, not shown).
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). Specs that render text: `localStorage.clear()` in `beforeEach`, `LanguageService.setLang('en')` in `afterEach`.
- Storage only via `SafeStorage`; edits live in memory (reload or Reset demo restores them). Demo "today" is `DEMO_TODAY = '2026-10-22'`; the simulated fetch uses a timer, never the real clock.
- VAT shown anywhere goes through `vatRateShown(taxProfile, booking)`; category choices through `categoriesFor(taxProfile)` (both in `domain/tax-rules.ts`).
- Run tests from `web/` with `npx ng test --watch=false`; `npx ng build` must have no budget warnings.
- Commits stage only the task's own files by path (never `git add -A`); never stage `backend/`, `admin/`, `CLAUDE.md`, `.superpowers/`.

## Review Focus

1. **Toolbar shortcut after real setup work** — connect a savings account and save new tax answers, then pick *New client*, then *Active client*: the steps change, the account and answers are still there. Test in Task 1 (`a shortcut only sets the open business's steps`) and Task 6 (`a shortcut keeps connected accounts`).
2. **Switching business in the middle of the bank flow** — the flow goes back to its first screen for the business now open; nothing is connected to the other business. Test in Task 6 (`switching business restarts the flow`).
3. **Changing "Yes, I charge VAT" to "No" on a filled form** — the hidden VAT answers are cleared on Save (period, extension, Ist/Soll), and switching back starts them empty. Test in Task 4 (`answering No clears the VAT answers`).
4. **Tapping Connect or Renew twice** — one connection per account, one history line. Test in Task 6 (`connecting twice adds the accounts once`) and Task 7 (`renewing twice writes one history line`).
5. **Changing language with a half-filled tax form** — typed values and choices stay. Test in Task 4 (`the form keeps its answers when the language changes`).

---

## File Structure

```
web/src/app/
  data/models.ts                  # SetupSteps, TaxProfile, AccountConnection, business history, new history keys (Tasks 1-2)
  data/sample-data.ts             # tax profiles, account connections, stored bank notices removed (Task 2)
  data/banks.ts                   # BANKS, FOUND_ACCOUNTS, GERMAN_STATES, TAX_OFFICES (Task 2)
  domain/home-cards.ts            # presetSteps, presetOf, homeCards(steps) (Task 1)
  domain/tax-details.ts           # vatReturnDue, findTaxOffice, checkTaxAnswers, taxProfileFrom (Task 3)
  domain/bank-connection.ts       # connectionStatus, bankNotices, maskIban (Task 5)
  state/demo-state.service.ts     # steps per business, saveTaxProfile, connectAccounts, renew, addCashBox (Tasks 1, 4, 6, 7)
  settings/settings.page.ts, tax-answers.ts, bank-accounts.ts (Task 7)
  settings/tax-details.page.ts (Task 4)
  settings/connect-bank.page.ts, bank-approval.ts (Task 6)
```

---

### Task 1: Setup steps per business

**Files:**
- Modify: `data/models.ts`, `domain/home-cards.ts` (+ spec), `state/demo-state.service.ts` (+ spec), `shell/demo-toolbar.ts` (+ shell spec), `state/upload.service.ts` (+ spec), and every reader: `domain/document-status.ts`, `domain/home-figures.ts`, `domain/review-queue.ts`, `state/notice.service.ts`, `state/review.service.ts`, `home/home.page.ts`, `home/cards/setup-checklist.ts`, `home/cards/key-numbers.ts`, `home/cards/decisions-card.ts`, `shell/needs-you-button.ts`, `documents/documents.page.ts`, `documents/document-detail.page.ts`, `payments/document-picker.ts` (+ their specs where they build a `SetupState`)

**Interfaces:**
- `SetupSteps` (`{ bank: boolean; tax: boolean; receipt: boolean }`) moves to `models.ts`; `SetupState` stays as the name of the three presets.
- `presetSteps(preset: SetupState): SetupSteps` (today's `setupSteps`, renamed); `presetOf(steps: SetupSteps): SetupState | null` (null when no preset matches); `ALL_DONE: SetupSteps`.
- `homeCards(steps: SetupSteps)`, `visibleDocuments(docs, steps: SetupSteps)`, `decisionCount(business, steps: SetupSteps)`, `reviewItems(business, steps: SetupSteps)` take the flags instead of a preset.
- `DemoStateService`: `readonly setup: Signal<SetupSteps>` (the open business's flags; `ALL_DONE` for a business never touched); `setSetup(preset: SetupState): void` sets only the open business; `completeStep(step: keyof SetupSteps, businessId?: string): void` (default: open business); `resetData()` also resets every business to `ALL_DONE`; `bankConnected` reads `setup().bank`.
- Demo toolbar: the pressed choice is `presetOf(demo.setup())`; none pressed when it is null.
- `UploadService.add` calls `completeStep('receipt', businessId)` when at least one file is accepted.

- [ ] **Step 1: Check the names.** Confirm every reader listed above still exists under these names on the branch you build from (the review inbox may have added more: `grep -rn "setup()\|setupSteps(\|SetupState" web/src/app`). Add any new reader to this task's file list.
- [ ] **Step 2: Failing tests:** `presetSteps and presetOf round-trip the three presets; a mixed set has no preset`; service: **`a shortcut only sets the open business's steps`** (New client on weber-design, switch to cafe-linde → `ALL_DONE`; back → bank false; accounts and tax profile unchanged); `completeStep ticks one step of one business`; `resetData sets every business back to all done`; toolbar: `no choice is pressed for a mixed set`; upload: `adding a document ticks the receipt step of its business`. Existing specs for the three presets keep passing unchanged in behaviour.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run full suite** → PASS.
- [ ] **Step 6: Commit** `refactor: keep setup steps per business`.

---

### Task 2: Tax answers, bank connections and sample data

**Files:**
- Modify: `data/models.ts`, `data/sample-data.ts`, `data/sample-data.spec.ts`, i18n files (history texts)
- Create: `data/banks.ts` (+ spec)

**Interfaces:**
- `TaxProfile` becomes:

```ts
export type BusinessKind = 'freelance' | 'trade';
export type VatPeriod = 'monthly' | 'quarterly' | 'yearly';
export interface TaxProfile {
  businessKind: BusinessKind; kleinunternehmer: boolean;
  vatPeriod: VatPeriod | null; permanentExtension: boolean; vatBasis: 'ist' | 'soll' | null; // null / false when kleinunternehmer
  taxState: string | null; taxNumber: string | null; vatId: string | null; // taxState: a GERMAN_STATES id
  fiscalYearStart: string; // 'MM-DD', '01-01' for the calendar year
}
export interface AccountConnection { kind: 'connected' | 'statement' | 'cash'; consentUntil: string | null; lastFetched: string | null; fetchFrom: string | null; broken: boolean } // ISO date / ISO date-time / ISO date (stored, filters nothing)
```
  `Account` gains `connection: AccountConnection`, `product: 'business' | 'savings' | 'card' | 'cash'` and `iban: string | null`. `Business` gains `history: HistoryEntry[]`. `HistoryKey` gains `taxChanged`, `bankConnected` (`{ bank, account }`), `bankRenewed` (`{ bank }`), `cashAdded` — with `history.*` texts in all three files.
- `data/banks.ts`: `BANKS: { id: string; name: string }[]` (12: Sparkasse, Volksbank, ING, DKB, N26, Qonto, Kontist, Deutsche Bank, Commerzbank, Postbank, HypoVereinsbank, Revolut; `id` = lower-case slug); `GERMAN_STATES: { id: string; name: string; taxNumberPattern: RegExp | null }[]` (all 16; patterns at least for berlin `^\d{2}/\d{3}/\d{5}$`, bayern, hamburg, nordrhein-westfalen, bremen); `TAX_OFFICES: { state: string; prefix: string; name: string }[]` (a few per covered state; berlin prefix `27` → "Berlin Friedrichshain-Kreuzberg"); `SAMPLE_BANKS: Record<string, string[]>` (business id → its bank ids: weber-design `['qonto']`, sara-yoga `['qonto']`, cafe-linde `['qonto', 'sparkasse']`); `FOUND_ACCOUNTS: Record<string, Record<string, Account[]>>` (business id → bank id → the accounts the demo finds there: the existing sample business account, plus for the business's first bank a savings account and a credit card with `iban`, `product`, balance, no payments).
- Sample data *(values from the spec's Sample data)*:
  - weber-design: `{ businessKind: 'freelance', kleinunternehmer: false, vatPeriod: 'monthly', permanentExtension: false, vatBasis: 'ist', taxState: 'berlin', taxNumber: '27/123/45678', vatId: null, fiscalYearStart: '01-01' }`; Qonto `connected`, consent `2026-10-27`, last fetched `2026-10-22T06:12`; cash box `cash`.
  - sara-yoga: freelance, Kleinunternehmer (VAT answers null/false), a made-up Berlin number; Qonto `connected`, consent `2026-10-20` (ended).
  - cafe-linde: trade, VAT, quarterly, `soll`, a made-up number in another covered state; Qonto `connected`, consent about 4 months ahead; Sparkasse `statement`; cash box `cash`.
  - Stored notices `wd-n2` and `cl-n1` (`bankExpiry`) are removed; history notices stay. Every business starts with `history: []`.

- [ ] **Step 1: Failing tests:** `every account has a connection and a product`; `weber-design's Qonto consent ends 2026-10-27`; `cafe-linde's Sparkasse is a statement account`; `no stored bankExpiry notice is left open`; `every tax profile with kleinunternehmer has no VAT answers`; `FOUND_ACCOUNTS lists each business's sample accounts`; `every TAX_OFFICES state has a pattern`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (and update specs that build `TaxProfile`/`Account` by hand). **Step 4: Run full suite** → PASS (the homepage loses Weber Design's stored bank notice here; Task 5 brings it back calculated — update its pinned spec now).
- [ ] **Step 5: Commit** `feat: add tax answers and bank connections to the sample data`.

---

### Task 3: Tax rules and the VAT return card

**Files:**
- Create: `domain/tax-details.ts` (+ spec)
- Modify: `home/cards/tax-card.ts` (+ spec), `domain/notices.ts` (+ spec), i18n files

**Interfaces:**
- `vatReturnDue(profile: TaxProfile, today = DEMO_TODAY): { kind: 'date'; date: string } | { kind: 'yearly' } | null` — null for a Kleinunternehmer; monthly: the 10th of the month after the current month; quarterly: the 10th of the month after the current quarter; one month later each with `permanentExtension`; yearly → `{ kind: 'yearly' }`.
- `findTaxOffice(stateId: string, taxNumber: string): string | null` — the number (spaces trimmed) must match the state's pattern and its first digits a `TAX_OFFICES` prefix of that state.
- `isVatId(text: string): boolean` — `DE` + 9 digits, spaces ignored.
- Tax card: Kleinunternehmer → revenue tracker (as today); `date` → the due date and the business's `vatDue.amountCents`, or "Amount not known yet" when `vatDue` is null; `yearly` → "Yearly VAT return only", no amount.
- `noticesForSetup(notices, steps, profile: TaxProfile)` keeps `revenueLimit` only while `profile.kleinunternehmer`.

- [ ] **Step 1: Failing tests:** `vatReturnDue`: monthly → `2026-11-10`, with extension `2026-12-10`; quarterly → `2027-01-10`, with extension `2027-02-10`; yearly → `{ kind: 'yearly' }`; Kleinunternehmer → null. `findTaxOffice('berlin', '27/123/45678')` → "Berlin Friedrichshain-Kreuzberg"; wrong format, unknown prefix, uncovered state → null. `isVatId('DE 123456789')` true, `DE12345678` false. Card: `weber-design shows 10 Nov and €1,842.00`; `a yearly profile shows Yearly VAT return only`; `sara-yoga switched to VAT shows Amount not known yet`. Notices: `the revenue-limit notice shows only for a Kleinunternehmer`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: derive the VAT return date and tax office from the tax answers`.

---

### Task 4: Your tax details page

**Files:**
- Create: `settings/tax-details.page.ts` (+ spec)
- Modify: `state/demo-state.service.ts` (+ spec), `core/i18n/term.ts`, `app.routes.ts`, i18n files

**Interfaces:**
- Consumes: `findTaxOffice`, `isVatId`, `GERMAN_STATES`, `completeStep`.
- `DemoStateService.saveTaxProfile(profile: TaxProfile): void` — open business: sets the profile, adds `taxChanged` to `history`, `completeStep('tax')`. A save with an identical profile changes nothing (no line).
- `TermKey` gains `freiberufler`, `gewerbe`, `dauerfristverlaengerung`, `istVersteuerung`, `sollVersteuerung`, `steuernummer`, `ustIdNr`, `finanzamt` (with `terms.*` label/de/explain in all three files; `ustva`, `kleinunternehmer` exist).
- Route `settings/tax` (lazy `TaxDetailsPage`), query param `from` = `home` | `settings` (default `settings`) — where Save and the back link return to (`/` or `/settings`).
- The page: the spec's questions in order; VAT questions only after "Yes"; the tax office line under the number as soon as `findTaxOffice` finds it; "Mine is different" reveals a day + month field; Save validates (every visible question answered; `findTaxOffice` not null; VAT ID valid if filled) and shows each error next to its field. Before the tax step is done the form starts empty, afterwards with the saved answers. Saving with "No" stores `vatPeriod: null`, `permanentExtension: false`, `vatBasis: null`.

- [ ] **Step 1: Failing tests:** `the VAT questions appear only after Yes`; `a valid Berlin number shows its tax office`; `Save with a wrong number shows the error and keeps the answers`; `Save stores the answers, ticks the tax step and returns home` (from=home, new-client preset); **`answering No clears the VAT answers`**; **`the form keeps its answers when the language changes`**; `a Kleinunternehmer save makes the payment detail show No VAT` (navigate to a weber-design payment); `saving the same answers twice adds one history line`; `Mine is different stores 07-01`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the tax details page`.

---

### Task 5: Connection health and bank notices

**Files:**
- Create: `domain/bank-connection.ts` (+ spec)
- Modify: `data/models.ts` (`NoticeKind` gains `bankEnded`), `domain/notices.ts`, `state/notice.service.ts` (+ spec), `home/cards/notices-card.ts` (+ spec), `shell/coming-soon.page.ts`, i18n files

**Interfaces:**
- `type ConnectionStatus = { kind: 'connected' } | { kind: 'renewSoon'; daysLeft: number } | { kind: 'signInAgain' } | { kind: 'statement' } | { kind: 'cash' }`; `connectionStatus(account: Account, today = DEMO_TODAY): ConnectionStatus` — renewSoon when the consent ends within 14 days (inclusive), signInAgain when it ended (before today) or `broken`.
- `bankNotices(accounts: readonly Account[], today = DEMO_TODAY): Notice[]` — one `bankExpiry` (`{ bank, days }`, id `bank-expiry-<accountId>`, urgency 2) per renewSoon account, one `bankEnded` (`{ bank }`, id `bank-ended-<accountId>`, urgency 1, not blocking) per signInAgain account; dated `DEMO_TODAY`; only when the bank step is done.
- `maskIban(iban: string): string` — `DE89 … 4321` (first 4, last 4).
- `NoticeService` adds `bankNotices(business.accounts)` to the open notices. Notices card: `bankExpiry` and `bankEnded` link to `/settings`; `notice.bankEnded.text`/`.action` ("Your {{bank}} connection has ended" / "Sign in again").

- [ ] **Step 1: Failing tests:** `connectionStatus`: consent in 5 days → renewSoon 5; 14 days → renewSoon 14; 15 days → connected; yesterday → signInAgain; broken → signInAgain; statement and cash. `bankNotices` for weber-design → one "expires in 5 days"; sara-yoga → one bankEnded; cafe-linde → none. `maskIban('DE89370400440532013000')` → `DE89 … 3000`. Notices card: `the bank notice opens Settings`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS (Weber Design's homepage shows its bank notice again, now calculated).
- [ ] **Step 5: Commit** `feat: calculate bank notices from the connections`.

---

### Task 6: Connect your bank

**Files:**
- Create: `settings/connect-bank.page.ts` (+ spec), `settings/bank-approval.ts` (+ spec)
- Modify: `state/demo-state.service.ts` (+ spec), `app.routes.ts`, i18n files

**Interfaces:**
- Consumes: `BANKS`, `SAMPLE_BANKS`, `FOUND_ACCOUNTS`, `maskIban`, `completeStep`.
- `export const FETCH_MS = 2000;`
- `DemoStateService.connectAccounts(bankId: string, accounts: readonly Account[], fetchFrom: string): void` — open business: accounts not yet in `business.accounts` are added, the chosen ones get `connection: { kind: 'connected', consentUntil: DEMO_TODAY + 180 days, lastFetched: DEMO_TODAY + 'T12:00', fetchFrom, broken: false }`; sample business accounts of that bank left unchosen become `statement`; one `bankConnected` line per newly connected account; `completeStep('bank')`. Calling it again with already-connected accounts adds nothing and writes no line.
- `DemoStateService.addCashBox(): void` — adds a `cash` account named "Cash box" when the open business has none, `cashAdded` line; ignored otherwise.
- `<app-bank-approval [bankName] (approved) (cancelled)>` — screen 3: "DEMO · no real bank, no password", the bank tile, the sentence, **Approve** · **Cancel** (reused by Renew in Task 7). When the picked bank isn't one of the business's `SAMPLE_BANKS`, the parent passes a note "Demo: this business banks with <bank>, so <bank>'s accounts are shown."
- Route `settings/bank/connect` (lazy `ConnectBankPage`), query `from` = `home` | `payments` | `settings`. Steps as page state: pick (search filters `BANKS` by name; "My bank isn't listed" → `/soon/statementImport`; "I also take cash" only without a cash box → `addCashBox()` then back) → what we can see → approval → choose accounts (from `FOUND_ACCOUNTS[business][bank]`, or the first sample bank's when the picked bank isn't the business's; the business account ticked; already-connected ones ticked, greyed, "Already connected"; "Fetch payments from" options 1 Jan this year / 1 Jan last year / today) → **Connect N accounts** → "Fetching payments…" for `FETCH_MS` → `connectAccounts` → back to `from`. Cancel at approval → pick. When the open business changes, the flow restarts at pick.

- [ ] **Step 1: Failing tests:** `picking Qonto and approving shows the business account ticked`; `connecting in the new-client preset brings Weber Design's payments` (fake timers; Payments no longer shows the empty state; the bank step is ticked); `a bank the business doesn't use shows the demo note`; `leaving Café Linde's Sparkasse unticked makes it a statement account`; `a connected savings account shows in the homepage balances and the Payments account filter`; **`connecting twice adds the accounts once`**; `I also take cash adds one cash box`; **`switching business restarts the flow`**; **`a shortcut keeps connected accounts`** (connect the savings account, New client, Active client → still there); `the sign-in screen has no input field`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the bank connection flow`.

---

### Task 7: Settings page and entry points

**Files:**
- Create: `settings/settings.page.ts` (+ spec), `settings/tax-answers.ts`, `settings/bank-accounts.ts`
- Modify: `state/demo-state.service.ts` (+ spec), `app.routes.ts`, `shell/menu.ts` (+ spec), `home/cards/setup-checklist.ts` (+ spec), `payments/payments.page.ts` (+ spec), i18n files

**Interfaces:**
- Consumes: `connectionStatus`, `maskIban`, `findTaxOffice`, `GERMAN_STATES`, `BankApproval`, `CopyButton` (documents).
- `DemoStateService.renewConnection(accountId: string): void` — open business: consent `DEMO_TODAY` + 180 days, `broken: false`, last fetch refreshed, one `bankRenewed` line; ignored for an account that isn't `connected`, and a second call on an already renewed account (consent ≥ 180 days ahead) writes no line.
- Route `settings` (lazy `SettingsPage`); menu Settings → `/settings`.
- `<app-tax-answers>` — the saved answers in plain words with `<app-term>`s and the tax office; **Edit** → `/settings/tax?from=settings`; before the tax step: "Add your tax details" → same link.
- `<app-bank-accounts>` — **+ Connect a bank** (→ `/settings/bank/connect?from=settings`); rows: initials tile, bank and product name (`settings.bank.product.<product>`), masked IBAN or "Payments come from your receipts", last fetch for connected ones, the status word and button per the spec's table (**Renew** / **Sign in again** open `<app-bank-approval>` in a dialog or inline panel, then `renewConnection`; **Import statement** → `/soon/statementImport`). Before the bank step: a line and **Connect your bank**, with the cash box listed if there is one.
- Documents inbox section: the address, `CopyButton`, the "received or sent" line.
- Setup checklist: bank → `/settings/bank/connect?from=home` (to do) / `/settings` (done); tax → `/settings/tax?from=home` / `/settings`; receipt unchanged. Payments' "Connect your bank" → `/settings/bank/connect?from=payments`. Add `soon.statementImport` to the i18n files.

- [ ] **Step 1: Failing tests:** `menu Settings opens the page with three sections`; `Weber Design's Qonto shows Renew in 5 days`; `renewing shows Connected and the homepage notice goes`; **`renewing twice writes one history line`**; `Sara's Qonto shows Sign in again`; `Café Linde's Sparkasse shows Statement import`; `IBANs are masked`; `Edit opens the tax page and Save comes back to Settings`; `the setup checklist's bank and tax steps open the flows`; `before the bank step Settings offers Connect your bank and still lists the cash box`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the Settings page`.

---

### Task 8: Check and document

**Files:**
- Modify: `web/README.md`, `docs/bookkeeping-portal-spec.md` (one line under the Settings section: our version is in the design doc)

- [ ] **Step 1: Run** `npx ng test --watch=false` and `npx ng build` from `web/` → all pass, no budget warnings.
- [ ] **Step 2: Look at it** (controller, browser preview) at 375 px and 1280 px, in en, de and ar: tax page (Yes/No, errors, tax office line), bank flow (all four screens, the demo note, Fetching), Settings (every status), the homepage checklist and notices.
- [ ] **Step 3: Walk the demo** on weber-design: *New client* → Connect your bank (Qonto, business account) → payments appear and the bank step ticks → Your tax details (switch to Kleinunternehmer, Save) → a payment shows No VAT and the tax card shows the revenue tracker → back to VAT, quarterly with extension → the card shows 10 Feb 2027 → Settings: Renew Qonto → the notice goes → Reset demo.
- [ ] **Step 4: Update** `web/README.md` (Settings section: setup steps per business, the simulated bank flow, what is coming soon, Reset demo) and the spec line.
- [ ] **Step 5: Commit** `docs: describe the setup and settings mockup`.
