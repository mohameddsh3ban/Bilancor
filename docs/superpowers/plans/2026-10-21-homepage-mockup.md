# Homepage Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Angular mockup of the homepage with sample data, phone-first, in English, German and Arabic (right-to-left), including the app shell every later page reuses.

**Architecture:** One Angular app in `web/`. Pure TypeScript logic (formatting, tax limits, which cards show, notice rules) lives in small files with unit tests; components only read signals from three services (language, demo state, notices). All data is sample data in one file; nothing talks to a server.

**Tech Stack:** Angular 22.2 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4.3, spartan/ui 1.8 (`@spartan-ng/brain` + helm components), Transloco 8.4 (`@jsverse/transloco`) for runtime language switching, Node 24.

**Spec:** [docs/specs/2026-10-21-homepage-mockup-design.md](../../specs/2026-10-21-homepage-mockup-design.md) (product context: [docs/bookkeeping-portal-spec.md](../../bookkeeping-portal-spec.md))

## Global Constraints

- No backend, login, real bank data or HTTP calls. All data comes from `web/src/app/data/sample-data.ts`.
- No names, amounts or details from the studied Bilancor account. No Bilancor wording, layout or code.
- Phone first: every screen must work at 375 px wide with no horizontal scroll. Computer layout from Tailwind `lg` (1024 px) up *(builder's call, per spec)*.
- Languages: `en`, `de`, `ar`. Each person picks their own; Arabic sets `dir="rtl"` on `<html>` and mirrors the layout. Use Tailwind logical utilities (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`) instead of left/right ones.
- Amounts, IBANs and invoice numbers stay left-to-right inside Arabic text: wrap them in `<bdi dir="ltr">`.
- Western digits (0–9) in Arabic too. Amounts in euros, stored as integer cents.
- German tax terms stay visible next to the translation, with a short explanation on hover or tap (the `Term` component, Task 3).
- German and Arabic text is draft, kept in `web/src/assets/i18n/{en,de,ar}.json`; every key in `en.json` must exist in the other two.
- Every link to an undesigned page opens the "coming soon" screen at `/soon/:feature`.
- Neutral visual style, easy to restyle: colours only through Tailwind theme tokens defined once in `web/src/styles.css`.
- Storage: browser storage only through `SafeStorage` (Task 3), which never throws.

## Review Focus

1. **Arabic amounts:** a minus sign or € symbol jumping to the wrong side in RTL. Expected: amounts read exactly as in English. Test in Task 7 (`amount is wrapped in ltr bdi`).
2. **Long counterparty names** (real German names like "Rundfunk ARD, ZDF und Deutschlandradio Beitragsservice") pushing the amount off a 375 px screen. Expected: the name truncates, the amount stays visible. Sample data includes that name; test in Task 7 (`counterparty cell truncates`).
3. **Storage blocked** (private window, blocked site data). Expected: language and dismissals still work for the session, nothing crashes. Test in Task 3 (`SafeStorage survives a throwing localStorage`).
4. **Switching business** after dismissing a notice. Expected: the dismissal applies only to that business. Test in Task 5 (`dismissal does not leak to another business`).
5. **Nothing to decide** (0 open decisions). Expected: an "all done" message, not "0 things need your decision". Test in Task 7 (`zero decisions shows all-clear`).

---

## File Structure

```
.gitignore                                  # root: node_modules, .superpowers/, web/.angular, dist
web/                                        # Angular app (backend comes later in backend/)
  .postcssrc.json                           # Tailwind 4 PostCSS plugin
  src/styles.css                            # Tailwind import + theme tokens
  src/assets/i18n/en.json, de.json, ar.json
  src/app/
    app.config.ts, app.routes.ts, app.ts     # generated, then edited
    core/
      storage/safe-storage.ts               # localStorage wrapper that never throws
      format/format.ts                      # formatMoney, formatDate
      i18n/language.service.ts              # current language, dir, persistence
      i18n/transloco-loader.ts
      i18n/term.ts                          # <app-term>: German term + explanation
    data/
      models.ts                             # all types
      sample-data.ts                        # PERSON, BUSINESSES
    domain/
      revenue-limit.ts                      # Kleinunternehmer tracker logic
      home-cards.ts                         # which cards show per setup state
      notices.ts                            # splitNotices (pure)
    state/
      demo-state.service.ts                 # current business, setup state
      notice.service.ts                     # dismissals, shown/overflow/history
    shell/
      menu.ts                               # MENU_ITEMS, BOTTOM_BAR_ITEMS
      app-shell.ts                          # layout: top bar + sidebar/bottom bar + outlet
      top-bar.ts, sidebar.ts, bottom-bar.ts
      bell-panel.ts, demo-toolbar.ts
      coming-soon.page.ts
    home/
      home.page.ts                          # composes cards per layout
      cards/notices-card.ts, decisions-card.ts, setup-checklist.ts,
            transactions-card.ts, balances-card.ts, tax-card.ts, key-numbers.ts
```

Tests sit next to each file as `*.spec.ts`. Run all tests from `web/` with `npx ng test --watch=false`.

---

### Task 1: Project setup

**Files:**
- Create: `.gitignore`, `web/` (generated), `web/.postcssrc.json`
- Modify: `web/src/styles.css`, `web/src/app/app.ts`
- Test: `web/src/app/app.spec.ts` (generated, edited)

**Interfaces:**
- Produces: a building app in `web/`; spartan helm components importable from the path the spartan generator writes (record it in `web/README.md`); Tailwind theme tokens `--color-surface`, `--color-card`, `--color-border`, `--color-primary`, `--color-muted`, `--color-positive`, `--color-negative`, `--color-warning`.

- [ ] **Step 1: Init git at the project root** with `git init` and a `.gitignore` containing `node_modules/`, `.superpowers/`, `web/.angular/`, `dist/`.
- [ ] **Step 2: Generate the app:** `npx @angular/cli@22 new web --routing --style=css --ssr=false --skip-git --skip-tests=false` (accept zoneless).
- [ ] **Step 3: Add Tailwind 4:** in `web/`, `npm i -D tailwindcss@4 @tailwindcss/postcss postcss`; `.postcssrc.json` = `{"plugins":{"@tailwindcss/postcss":{}}}`; `src/styles.css` starts with `@import "tailwindcss";` followed by an `@theme` block defining the colour tokens above (neutral greys, primary `#1e3a8a`).
- [ ] **Step 4: Add spartan/ui:** `npx ng g @spartan-ng/cli:init`, then `npx ng g @spartan-ng/cli:ui` for: button, card, badge, dropdown-menu, popover, progress, tooltip, separator. Add Transloco: `npm i @jsverse/transloco@8`.
- [ ] **Step 5: Edit the generated `app.spec.ts`** so it asserts only that `App` creates (`expect(fixture.componentInstance).toBeTruthy()`), and reduce `app.ts`'s template to `<router-outlet />`.
- [ ] **Step 6: Verify:** `npx ng test --watch=false` → 1 test passes; `npx ng build` → succeeds.
- [ ] **Step 7: Commit:** `git add -A && git commit -m "chore: scaffold Angular app with Tailwind, spartan/ui, Transloco"`

---

### Task 2: Data model and sample data

**Files:**
- Create: `web/src/app/data/models.ts`, `web/src/app/data/sample-data.ts`
- Test: `web/src/app/data/sample-data.spec.ts`

**Interfaces:**
- Produces (in `models.ts`):

```ts
export type Lang = 'en' | 'de' | 'ar';
export type SetupState = 'new' | 'halfway' | 'active';
export type TxStatus = 'booked' | 'confirm' | 'noReceipt' | 'unclear';
export interface Account { id: string; kind: 'bank' | 'cash'; name: string; balanceCents: number; lastUpdate: string } // ISO date
export interface Booking { skr03: string; nameDe: string; labelKey: string } // labelKey -> i18n "booking.<labelKey>"
export interface Transaction { id: string; date: string; counterparty: string; accountId: string; amountCents: number; status: TxStatus; booking: Booking | null }
export type NoticeKind = 'terms' | 'bankExpiry' | 'unreadable' | 'revenueLimit';
export interface Notice { id: string; kind: NoticeKind; urgency: number; blocking: boolean; params: Record<string, string | number>; date: string } // lower urgency = more urgent; text from i18n "notice.<kind>.text" / ".action"
export interface TaxProfile { kleinunternehmer: boolean; vatPeriod: 'monthly' | 'quarterly' | null }
export interface Business { id: string; name: string; taxProfile: TaxProfile; accounts: Account[]; transactions: Transaction[]; decisionsOpen: number; vatDue: { dueDate: string; amountCents: number } | null; incomeTaxReserveCents: number; revenueThisYearCents: number; notices: Notice[]; noticeHistory: Notice[] }
export interface Person { id: string; firstName: string; lastName: string; businessIds: string[] }
```

- Produces (in `sample-data.ts`): `PERSON: Person` and `BUSINESSES: Business[]`, with these pinned values:
  - `PERSON` = Sara Weber, id `p1`, member of all three businesses.
  - `weber-design` "Weber Design": VAT, monthly; accounts Qonto 1 248 020 ¢ and Cash box 15 000 ¢; `decisionsOpen` 3; `vatDue` 2026-11-10, 184 200 ¢; income-tax reserve 320 000 ¢; notices `terms` (blocking, urgency 1), `bankExpiry` (Qonto, 5 days, urgency 2), `unreadable` (2 receipts, urgency 3); 6 transactions including Müller GmbH +150 000 confirm (8400 "Erlöse 19 % USt", `revenue19`), Telekom −3 995 booked (4920 "Telefon", `phone`), Deutsche Bahn −12 000 noReceipt (4670 "Reisekosten Unternehmer", `travel`), Amazon −4 900 unclear (no booking), Adobe −5 949 booked (4806 "Wartungskosten für Hard- und Software", `software`), "Rundfunk ARD, ZDF und Deutschlandradio Beitragsservice" −5 508 booked (4900 "Sonstige betriebliche Aufwendungen", `otherCosts`).
  - `sara-yoga` "Sara Weber Yoga": Kleinunternehmer, `vatPeriod` null, `vatDue` null; Qonto 642 075 ¢; `revenueThisYearCents` 2 130 000 (85.2 % of €25,000); `decisionsOpen` 1; reserve 210 000 ¢; notice `revenueLimit` (urgency 2); revenue bookings use 8195 "Erlöse als Kleinunternehmer i.S.d. § 19 Abs. 1 UStG", `revenueKU`.
  - `cafe-linde` "Café Linde GbR": VAT, quarterly; accounts Qonto 2 315 040 ¢, Sparkasse 874 512 ¢, Cash box 41 230 ¢; `decisionsOpen` 0 (exercises the all-clear message); `vatDue` 2027-01-10, 412 000 ¢; reserve 580 000 ¢; notice `bankExpiry` (Sparkasse, 5 days).
  - Each business has 1–2 `noticeHistory` entries. All dates in Sep–Oct 2026.

- [ ] **Step 1: Write the failing test** `sample-data.spec.ts`:
  - `three businesses, all belonging to PERSON`: `BUSINESSES.length === 3` and every id is in `PERSON.businessIds`.
  - `exactly one Kleinunternehmer, with no VAT due`: one business has `taxProfile.kleinunternehmer === true` and its `vatDue === null`.
  - `every transaction points to an account of its business`.
  - `amounts are integer cents`: every `amountCents`/`balanceCents` satisfies `Number.isInteger`.
- [ ] **Step 2: Run** `npx ng test --watch=false` → FAIL (module not found).
- [ ] **Step 3: Write `models.ts` and `sample-data.ts`** with the values above.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add data model and sample businesses`.

---

### Task 3: Storage, formatting, languages and German terms

**Files:**
- Create: `core/storage/safe-storage.ts`, `core/format/format.ts`, `core/i18n/language.service.ts`, `core/i18n/transloco-loader.ts`, `core/i18n/term.ts`, `src/assets/i18n/{en,de,ar}.json`
- Modify: `app.config.ts` (provide Transloco with `availableLangs: ['en','de','ar']`, `defaultLang: 'en'`, `reRenderOnLangChange: true`)
- Test: `safe-storage.spec.ts`, `format.spec.ts`, `language.service.spec.ts`, `term.spec.ts`, `i18n-keys.spec.ts` (all next to their files; `i18n-keys.spec.ts` in `core/i18n/`)

**Interfaces:**
- Consumes: `Lang` (Task 2).
- Produces:
  - `class SafeStorage` (injectable, root): `get(key: string): string | null`, `set(key: string, value: string): void`. Falls back to an in-memory `Map` when `localStorage` is missing or throws.
  - `formatMoney(cents: number, lang: Lang, opts?: { signed?: boolean }): string` — `Intl.NumberFormat` with locale `en-IE` / `de-DE` / `ar-u-nu-latn`, `style: 'currency', currency: 'EUR'`; `signed` uses `signDisplay: 'exceptZero'`.
  - `formatDate(iso: string, lang: Lang): string` — short day + month (`{ day: 'numeric', month: 'short' }`), same locales.
  - `class LanguageService` (root): `lang: Signal<Lang>`, `dir: Signal<'ltr' | 'rtl'>`, `setLang(lang: Lang): void` (sets `<html lang dir>`, Transloco active language, stores under key `mockup.lang`); starts from the stored value, else `en`.
  - `<app-term key="ustva" />`: shows `terms.<key>.label` and, unless the language is `de`, ` (<terms.<key>.de>)`; a spartan tooltip (hover) / popover (tap) shows `terms.<key>.explain`. Keys needed now: `ustva`, `euer`, `kleinunternehmer`, `skr03`.

- [ ] **Step 1: Write the failing tests:**
  - `SafeStorage survives a throwing localStorage`: stub `localStorage.getItem/setItem` to throw; `set('a','1')` does not throw and `get('a') === '1'`.
  - `formatMoney en`: `formatMoney(123456, 'en') === '€1,234.56'`; `formatMoney(150000, 'en', { signed: true }) === '+€1,500.00'`.
  - `formatMoney de`: after replacing ` ` with a space, `formatMoney(123456, 'de') === '1.234,56 €'`.
  - `formatMoney ar uses western digits`: result matches `/1.234.56/` and does not match `/[٠-٩]/`.
  - `setLang ar sets rtl`: after `setLang('ar')`, `document.documentElement.dir === 'rtl'`, `lang() === 'ar'`, `dir() === 'rtl'`; after `setLang('de')`, `dir === 'ltr'`.
  - `language is remembered`: `setLang('de')`, then a new `LanguageService` instance starts with `lang() === 'de'`.
  - `term shows German original outside German`: in `en`, `<app-term key="ustva">` text contains "VAT return" and "(UStVA)"; in `de` it contains "UStVA" and no parentheses.
  - `every en key exists in de and ar`: flatten the three JSON files and compare key sets.
- [ ] **Step 2: Run** → FAIL.
- [ ] **Step 3: Implement** the files above. This task adds the `terms.*` keys; each later task adds its own keys (menu, cards, notices, statuses, bookings, coming soon, demo toolbar) to all three files in the same commit, so `every en key exists in de and ar` keeps passing. German and Arabic are drafts.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add safe storage, formatting, language switching and German terms`.

---

### Task 4: Kleinunternehmer limit and card rules

**Files:**
- Create: `domain/revenue-limit.ts`, `domain/home-cards.ts`
- Test: `domain/revenue-limit.spec.ts`, `domain/home-cards.spec.ts`

**Interfaces:**
- Consumes: `SetupState` (Task 2).
- Produces:
  - `revenueLimitStatus(revenueCents: number): { limitCents: 2_500_000; hardLimitCents: 10_000_000; percent: number; level: 'ok' | 'warning' | 'overNextYear' | 'overNow' }` — `percent` = revenue / €25,000 × 100, rounded to a whole number; `warning` from 80 % (2 000 000 ¢) up to and including €25,000; `overNextYear` above €25,000 up to and including €100,000; `overNow` above €100,000.
  - `setupSteps(state: SetupState): { bank: boolean; tax: boolean; receipt: boolean }` — new: none; halfway: bank only; active: all.
  - `homeCards(state: SetupState): { checklist: boolean; transactions: boolean; balances: boolean; tax: boolean; decisions: boolean }` — transactions and balances follow `bank`, tax follows `tax`, decisions follows `receipt`, checklist shows until all three are done.

- [ ] **Step 1: Write the failing tests:**
  - `revenueLimitStatus`: 1 999 999 → `ok`; 2 000 000 → `warning`; 2 130 000 → `warning`, `percent` 85; 2 500 000 → `warning`; 2 500 001 → `overNextYear`; 10 000 000 → `overNextYear`; 10 000 001 → `overNow`.
  - `homeCards('new')` → only `checklist` true; `homeCards('halfway')` → checklist, transactions, balances true, tax and decisions false; `homeCards('active')` → checklist false, all four cards true.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add Kleinunternehmer limit and home card rules`.

---

### Task 5: Demo state and notices

**Files:**
- Create: `domain/notices.ts`, `state/demo-state.service.ts`, `state/notice.service.ts`
- Test: `domain/notices.spec.ts`, `state/notice.service.spec.ts`, `state/demo-state.service.spec.ts`

**Interfaces:**
- Consumes: `PERSON`, `BUSINESSES` (Task 2), `SafeStorage` (Task 3).
- Produces:
  - `splitNotices(notices: Notice[], dismissedIds: ReadonlySet<string>, max = 2): { shown: Notice[]; overflow: Notice[] }` — drops dismissed non-blocking notices (blocking ones are never dropped), sorts by `urgency` ascending, `shown` = first `max`.
  - `class DemoStateService` (root): `person: Person`, `businesses: Business[]` (the person's), `business: Signal<Business>`, `setup: Signal<SetupState>`, `setBusiness(id: string): void`, `setSetup(state: SetupState): void`. Starts with `weber-design` and `active`.
  - `class NoticeService` (root): `shown: Signal<Notice[]>`, `overflow: Signal<Notice[]>`, `history: Signal<Notice[]>` (business `noticeHistory` plus notices dismissed in this business, newest first), `unreadCount: Signal<number>` (= shown + overflow), `dismiss(id: string): void` (ignored for blocking notices). Dismissed ids stored as a JSON array under `mockup.dismissed.<personId>.<businessId>`.

- [ ] **Step 1: Write the failing tests:**
  - `splitNotices`: with weber-design's 3 notices and nothing dismissed → `shown` ids in urgency order (`terms`, `bankExpiry`), `overflow` length 1; dismissing the blocking `terms` id changes nothing.
  - `dismiss moves a notice to history`: after `dismiss(bankExpiry id)`, it is not in `shown`, it is first in `history`, `unreadCount()` drops by 1.
  - `dismissal is remembered`: a new `NoticeService` (same `SafeStorage`) still hides it.
  - `dismissal does not leak to another business`: dismiss in `weber-design`, `setBusiness('cafe-linde')` → cafe-linde's `bankExpiry` notice is shown.
  - `setBusiness switches data`: `setBusiness('sara-yoga')` → `business().taxProfile.kleinunternehmer === true`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add demo state and notice rules`.

---

### Task 6: App shell, menu and coming-soon page

**Files:**
- Create: `shell/menu.ts`, `shell/app-shell.ts`, `shell/top-bar.ts`, `shell/sidebar.ts`, `shell/bottom-bar.ts`, `shell/bell-panel.ts`, `shell/demo-toolbar.ts`, `shell/coming-soon.page.ts`
- Modify: `app.routes.ts`, `app.ts`
- Test: `shell/menu.spec.ts`, `shell/app-shell.spec.ts`, `shell/coming-soon.page.spec.ts`

**Interfaces:**
- Consumes: `LanguageService`, `DemoStateService`, `NoticeService`.
- Produces:
  - `MENU_ITEMS: { id: 'home' | 'payments' | 'documents' | 'invoices' | 'taxes' | 'reports' | 'settings' | 'help'; route: string; icon: string }[]` in that order; `home` → `/`, all others → `/soon/<id>`.
  - `BOTTOM_BAR_ITEMS`: home, payments, `upload` (raised centre camera → `/soon/upload`), invoices, `more` (opens a sheet listing the remaining `MENU_ITEMS`).
  - Routes: `''` → `AppShell` with children `''` → `HomePage` (lazy, Task 7) and `soon/:feature` → `ComingSoonPage`.
  - `AppShell` layout: top bar always; below `lg` a fixed bottom bar; from `lg` a start-side sidebar with "Upload receipt" (→ `/soon/upload`) above the menu.
  - Top bar: greeting with `person.firstName`; business switcher (spartan dropdown-menu listing `businesses`, calls `setBusiness`); bell with `unreadCount` badge opening `BellPanel` (spartan popover listing `history` with date and text); language switcher (EN / DE / عربي, calls `setLang`).
  - `DemoToolbar`: a small bar at the very top marked "Demo", with the setup-state switch (new / halfway / active → `setSetup`).
  - `ComingSoonPage`: shows the translated feature name from `soon.<feature>` and "We design this page next" text, plus a link back home. `soon.*` has a key for every feature any link uses: the menu ids, `upload`, `more`, `decisions`, the notice kinds (`terms`, `bankExpiry`, `unreadable`, `revenueLimit`), the setup steps (`bank`, `tax`, `receipt`) and `account`; an unknown feature shows the generic `soon.default`.

- [ ] **Step 1: Write the failing tests:**
  - `menu order`: `MENU_ITEMS.map(i => i.id)` equals the eight ids above, in order.
  - `coming soon shows the feature`: rendering `/soon/payments` in `en` shows "Payments".
  - `business switcher changes business`: in `AppShell`, choosing "Café Linde GbR" makes `DemoStateService.business().id === 'cafe-linde'`.
  - `bell shows unread count`: with weber-design active, the bell badge reads "3".
  - `language switcher sets rtl`: choosing عربي sets `document.documentElement.dir` to `rtl`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** with spartan helm components and Tailwind logical utilities. **Step 4: Run** → PASS.
- [ ] **Step 5: Verify by eye:** `npx ng serve`, open in the browser pane at 375 × 812 and 1280 × 800, in en and ar: bottom bar on phone, sidebar on computer, mirrored in Arabic, no horizontal scroll.
- [ ] **Step 6: Commit** `feat: add app shell, menu, switchers and coming-soon page`.

---

### Task 7: Homepage on a phone

**Files:**
- Create: `home/home.page.ts`, `home/cards/notices-card.ts`, `home/cards/decisions-card.ts`, `home/cards/setup-checklist.ts`, `home/cards/transactions-card.ts`, `home/cards/balances-card.ts`, `home/cards/tax-card.ts`
- Test: `home/home.page.spec.ts`, `home/cards/transactions-card.spec.ts`, `home/cards/decisions-card.spec.ts`, `home/cards/tax-card.spec.ts`, `home/cards/notices-card.spec.ts`

**Interfaces:**
- Consumes: `homeCards`, `setupSteps`, `revenueLimitStatus` (Task 4); `DemoStateService`, `NoticeService` (Task 5); `formatMoney`, `formatDate`, `<app-term>` (Task 3).
- Produces: `HomePage` (route `''`), stacking in this order: notices, setup checklist, decisions, transactions, balances, tax — each only when `homeCards(setup())` allows it.
  - Notices card: `shown` notices with text, action button (→ `/soon/<kind>`) and a dismiss "×" only on non-blocking ones; "+N more" opens the bell panel.
  - Decisions: "N things need your decision" + "about M minutes" (M = N, at least 1) + Start (→ `/soon/decisions`); when N = 0 the all-clear text `home.decisions.allClear`.
  - Setup checklist: the three steps from `setupSteps` with done ticks; each step's button → `/soon/<step>`.
  - Transactions: the 5 newest transactions — counterparty (truncates), date, status chip (booked = positive, confirm/unclear = warning, noReceipt = negative), amount signed and coloured; row and "See all" → `/soon/payments`.
  - Balances: each account with balance (tap → `/soon/account`); "Total available" = sum.
  - Tax card: VAT business → `<app-term key="ustva">` due date + estimated amount; Kleinunternehmer → `<app-term key="kleinunternehmer">` revenue-limit tracker ("€21,300 of €25,000 this year", spartan progress at `percent`, warning style at `warning` and above); both show income tax to set aside.

- [ ] **Step 1: Write the failing tests:**
  - `new client sees only the checklist`: `setSetup('new')` → checklist present; transactions, balances, tax, decisions absent.
  - `halfway shows transactions and balances`: `setSetup('halfway')` → those two plus checklist; no tax, no decisions.
  - `balances total`: weber-design → total text equals `formatMoney(1263020, 'en')`.
  - `zero decisions shows all-clear`: `setBusiness('cafe-linde')` → all-clear text, no "0 things".
  - `amount is wrapped in ltr bdi`: every amount element in the transactions card is inside `bdi[dir="ltr"]`.
  - `counterparty cell truncates`: the "Rundfunk ARD…" name element has the `truncate` class and its row still contains the amount.
  - `Kleinunternehmer gets the tracker`: `setBusiness('sara-yoga')` → tax card shows "€21,300" and "€25,000", a progress bar with value 85, no VAT due date.
  - `blocking notice has no dismiss`: weber-design `terms` notice has no dismiss button; `bankExpiry` has one.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Verify by eye** at 375 × 812 in en, de and ar, for all three businesses and all three setup states.
- [ ] **Step 6: Commit** `feat: add phone homepage cards`.

---

### Task 8: Homepage on a computer

**Files:**
- Create: `home/cards/key-numbers.ts`
- Modify: `home/home.page.ts`, `home/cards/transactions-card.ts`
- Test: `home/cards/key-numbers.spec.ts`, `home/cards/transactions-card.spec.ts` (extend)

**Interfaces:**
- Consumes: as Task 7.
- Produces: from `lg` up, `HomePage` shows notices (full-width strips), checklist (if any), then `KeyNumbers` (three tiles in a row), then the transactions card at full width; the phone's decisions, balances and tax cards are hidden at `lg`.
  - `KeyNumbers` tiles: decisions (count + Start, or all-clear); total available (with each account under it); third tile = VAT due (amount, date, income tax under it) or, for a Kleinunternehmer, the revenue-limit tracker. Each tile shows only when its card would show (`homeCards`).
  - Transactions card at `lg`: a table with columns date, counterparty, account, booking, status, amount. Booking cell: `booking.<labelKey>` translation + " · " + `skr03` + " " + `nameDe`; in `de` only `skr03 nameDe`; "—" when `booking` is null.

- [ ] **Step 1: Write the failing tests:**
  - `third tile is VAT for a VAT business`: weber-design → tile shows `formatMoney(184200,'en')` and the due date.
  - `third tile is the tracker for a Kleinunternehmer`: sara-yoga → tile shows "€25,000", no VAT amount.
  - `booking cell format`: in `en`, Telekom row booking cell = "Phone & internet · 4920 Telefon"; in `de` = "4920 Telefon"; Amazon row = "—".
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Verify by eye** at 1280 × 800 and 1024 × 768 in en and ar, all three businesses; then at 768 × 1024 to see the tablet result.
- [ ] **Step 6: Commit** `feat: add computer homepage layout`.

---

### Task 9: Phone review and handover

**Files:**
- Modify: `web/package.json` (script `"serve:lan": "ng serve --host 0.0.0.0"`), `web/README.md`

**Interfaces:**
- Consumes: the whole app.

- [ ] **Step 1: Run the full suite:** `npx ng test --watch=false` → all pass; `npx ng build` → no errors or warnings about budgets.
- [ ] **Step 2: Start for phone review:** `npm run serve:lan`; note the computer's local IP (`ipconfig`) and confirm `http://<ip>:4200` loads from another device on the same Wi-Fi (Windows may ask to allow Node through the firewall — the owner approves that).
- [ ] **Step 3: Write `web/README.md`:** how to install, run, test, open on a phone, where the spartan components live, and that German and Arabic text is draft pending review.
- [ ] **Step 4: Commit** `docs: add mockup README and LAN serve script`.
