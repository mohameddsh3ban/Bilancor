# Sign-in and Accounts Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable front door and account layer on sample data — sign-up, sign-in with a 6-digit code, a forgotten password, people with access per business, joining by invitation, My account, and a language per person — where a business made during the visit works end to end like the sample ones, in EN/DE/AR, phone-first.

**Architecture:** People become rows on each business (`Business.people: Member[]`, with a role) and the person gets an email, a language, devices and backup codes. A new `AccountService` holds the people who can sign in and who is signed in (remembered in `SafeStorage` for the sample person only); `DemoStateService` shows only the signed-in person's businesses and gains thin wrappers around pure people rules in `domain/people.ts`. The sign-in pages are lazy routes outside the app shell, the shell becomes lazy behind a `signedInGuard`, and a business made during the visit gets its payments and receipts from `data/new-business-sample.ts`.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`, dialogs through `HlmDialogImports` + `core/layout/dialog-card.ts` as in `taxes/send-dialog.ts`), Transloco.

**Spec:** [docs/specs/2026-10-23-sign-in-and-accounts-mockup-design.md](../../specs/2026-10-23-sign-in-and-accounts-mockup-design.md) (approved mockups in `.superpowers/brainstorm/1746-1792758932/content/`: `signup-signin.html`, `people-access.html`, `my-account.html`; conventions in `web/README.md`)

## Global Constraints

- **Start only when the Invoices page is merged** into the branch you build from, in a fresh worktree, with `git status` clean under `web/`. Task 1's first step re-checks the names below against that code (Invoices may add readers of `demo.businesses`, `demo.person`, the routes and the sample data).
- No real accounts, passwords, codes, emails, sessions or device detection; nothing leaves the browser. Every demo help is a dashed `border-warning` box on the page ("Demo: …"); there is no demo toolbar outside the app shell.
- `DEMO_TODAY = '2026-10-22'`: invitation links and support access run 7 days → `2026-10-29`; never the real clock.
- Roles are exactly `owner`, `full`, `receipts`, `advisor` (shown as Owner, Full access, Receipts only, Tax advisor · Steuerberater:in); no custom roles, no rights matrix, no per-person price.
- Two-step login can't be switched off. Passwords need at least 10 characters (sign-up, new or changed password); a sign-in password only needs to be filled in. A code is exactly 6 digits; any 6 digits work.
- Only the owner invites, changes, removes, hands over and turns support access on or off; an owner can't leave or be removed.
- The price is a placeholder: "€ — a month", "First 30 days free, no card needed", "Each business has its own plan".
- Emails, codes, IBANs, amounts and dates in `<bdi dir="ltr">`; German terms through `<app-term>` / `<app-term-info>` (new keys `einzelunternehmen`, `gbr`, `avv`, `steuerberater`; `freiberufler` and `gewerbe` exist); every status shows a word.
- Phone first: every screen works at 375 px with no horizontal scroll; computer layout from Tailwind `lg`. Colours only via the shadcn utilities and `surface`, `positive`, `negative`, `warning`; logical utilities only; Arabic mirrors everything (`rtl:rotate-180` on direction icons).
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft). Specs that render text: `localStorage.clear()` in `beforeEach`, `LanguageService.setLang('en')` in `afterEach`.
- Storage only via `SafeStorage`, keys under `mockup.`: `mockup.session` (the signed-in sample person's id), `mockup.trusted.<personId>` (trusted device), the existing `mockup.lang`. Everything else lives in memory (reload or Reset demo restores it).
- Every change to people or support access adds one line to the business `history` with `params.by` = the full name of who did it (stored, not shown).
- First load: the app shell and every new page are lazy routes; nothing in the first-load path imports `data/sample-data.ts`. `npx ng build` must have no budget warnings.
- Run tests from `web/` with `npx ng test --watch=false`. Commits stage only the task's own files by path (never `git add -A`); never stage `backend/`, `admin/`, `CLAUDE.md`, `.superpowers/`.

## Review Focus

1. **A hostile or broken `next`** — `/sign-in?next=//evil.example`, `next=https://evil.example`, `next=/\evil` or `next=/sign-in` all land on `/` after signing in; `next=/payments` lands on `/payments`. Test in Task 4 (`safeNext only follows paths inside the app`).
2. **A reload after Create account** — the stored session can't name a visit account, so the app opens on `/sign-in` with Sara's email, and a stored id that names no person counts as signed out instead of breaking. Test in Task 3 (`a stored session for an unknown person counts as signed out`).
3. **Emails typed with capitals or spaces** — `" Mia@Example.com "` is the same as `mia@example.com` for inviting, sign-in, sign-up and changing an email. Tests in Task 1 (`inviteError ignores case and spaces`), Task 4 (`sign-in ignores case and spaces`) and Task 5 (`an email that already has an account says so, whatever its case`).
4. **Losing the open business** — leaving Café Linde while it is open, or handing Weber Design over, never leaves an empty or stale business on screen; a person always keeps at least one business. Tests in Task 3 (`after leaving the open business, another one opens`) and Task 8 (`leaving Café Linde asks first and takes it out of the switcher`).
5. **A join link that no longer works** — opened after its invitation was cancelled, after Reset demo, or with made-up ids, the join page says "This invitation no longer works" with a way back. Test in Task 7 (`a join link for a cancelled or unknown invitation says it no longer works`).

---

## File Structure

```
web/src/app/
  data/models.ts                  # Role, Member, Device, Person, Business.people/supportUntil, history keys (Task 1)
  data/sample-person.ts           # PERSON, moved out of sample-data.ts so the first load stays small (Task 1)
  data/sample-data.ts             # members per business, Café Linde's owner (Task 1)
  domain/people.ts                # pure people rules: invite, join, roles, owner, leave, support (Task 1)
  data/new-business-sample.ts     # newBusiness, its account, payments and upload pool (Task 2)
  data/banks.ts                   # banksOf, foundAccountsOf with the new-business fallback (Task 2)
  state/account.service.ts        # who can sign in, who is signed in, devices, backup codes (Task 3)
  state/person-language.service.ts# the person's language vs the browser's (Task 3)
  state/demo-state.service.ts     # person's businesses, people wrappers, createBusiness, leave (Tasks 2-3)
  account/                        # guard, safeNext, auth frame, demo email, sign-in, forgot password, sign-up,
                                  #   business step, terms, two-step setup, add business, join, My account cards (Tasks 4-5, 7-8)
  shell/person-menu.ts, top-bar.ts, demo-toolbar.ts (Task 6)
  settings/people-card.ts, invite-dialog.ts, role-cards.ts (Task 7)
```

---

### Task 1: People in the data

**Files:**
- Modify: `data/models.ts`, `data/sample-data.ts` (+ `sample-data.spec.ts`), `state/demo-state.service.ts` (`freshBusinesses` keeps all three sample businesses) (+ spec), `core/i18n/term.ts` (`TermKey`), i18n files (`history.*`, `terms.*`)
- Create: `data/sample-person.ts`, `domain/people.ts` (+ spec)

**Interfaces:**
- `models.ts`:

```ts
export type Role = 'owner' | 'full' | 'receipts' | 'advisor';
export interface Member {
  id: string; personId: string | null; // the login behind the row; null for people who are only rows in the demo
  name: string | null; email: string; role: Role; status: 'joined' | 'invited';
  invitedOn: string | null; expiresOn: string | null; joinedOn: string | null; // ISO dates
}
export interface Device { id: string; browser: string; system: string; place: string; lastSeen: string | null; current: boolean } // lastSeen null: now
export interface Person { id: string; firstName: string; lastName: string; email: string; lang: Lang | null; devices: Device[]; backupCodesLeft: number } // lang null: not chosen yet
```
  `Person.businessIds` goes (memberships say it). `Business` gains `people: Member[]` and `supportUntil: string | null` (ISO date). `HistoryKey` gains `personInvited` (`email, role, by`), `invitationCancelled` (`email, by`), `personJoined` (`name, role, by`), `roleChanged` (`name, role, by`), `personRemoved` (`name, by`), `personLeft` (`name, by`), `ownerChanged` (`name, by`), `supportOn` (`until, by`), `supportOff` (`by`) — with `history.*` texts.
- `data/sample-person.ts`: `PERSON: Person = { id: 'p1', firstName: 'Sara', lastName: 'Weber', email: 'sara@example.com', lang: null, devices: [{ id: 'd1', browser: 'Chrome', system: 'Windows', place: 'Berlin', lastSeen: null, current: true }, { id: 'd2', browser: 'Safari', system: 'iPhone', place: 'Berlin', lastSeen: '2026-10-21', current: false }], backupCodesLeft: 6 }`. `sample-data.ts` re-exports nothing new; importers of `PERSON` switch to this file.
- Sample members (all invented): weber-design `wd-m1` Sara `owner` joined `2026-01-02`, `wd-m2` Jana Hoffmann `jana@kanzlei-hoffmann.example` `advisor` joined `2026-09-02` (personId null), `wd-m3` `mia@example.com` `receipts` invited `2026-10-20`, expires `2026-10-27`; sara-yoga `sy-m1` Sara `owner`; cafe-linde `cl-m1` Jonas Linde `jonas@cafe-linde.example` `owner` (personId null), `cl-m2` Sara `full`. `supportUntil: null` everywhere.
- `domain/people.ts` (every function returns the same object when nothing changes; `by` is a full name, `today` an ISO date):
  - `INVITE_DAYS = 7`, `SUPPORT_DAYS = 7`; dates through the existing `addDays` in `domain/bank-connection.ts`.
  - `normalEmail(email: string): string` (trimmed, lower-case); `isEmail(email: string): boolean` (`^[^\s@]+@[^\s@]+\.[^\s@]+$` after `normalEmail`).
  - `memberOf(business: Business, personId: string): Member | undefined` (joined rows only); `roleOf(business, personId): Role | null`; `ownerOf(business): Member`.
  - `type InviteError = 'invalid' | 'hasAccess' | 'invited'`; `inviteError(business, email): InviteError | null`.
  - `invite(business, email, role: Exclude<Role, 'owner'>, id: string, by: string, today: string): Business` (waiting row, `expiresOn = today + 7`); `resendInvite(business, memberId, today)` (new `expiresOn`, no line); `cancelInvite(business, memberId, by, today)`; `isExpired(member: Member, today: string): boolean`; `acceptInvite(business, memberId, name, today)` (joined, `by` = `name`; ignored for an expired or unknown row).
  - `changeRole(business, memberId, role: Exclude<Role, 'owner'>, by, today)`; `removeMember(business, memberId, by, today)`; `makeOwner(business, memberId, by, today)` (joined `full` rows only; the old owner becomes `full`); `leave(business, personId, today)` (`by` = the leaver). The owner row is never changed, removed or left by these.
  - `setSupport(business, on: boolean, by, today)` (`supportUntil = today + 7` or null); `supportActive(business, today): boolean`.

- [ ] **Step 1: Check the names.** On the branch you build from, `grep -rn "PERSON\|businessIds\|demo.person\|\.person\." web/src/app` and `grep -rn "BUSINESSES\b" web/src/app`; add every reader the Invoices merge brought to this task's file list.
- [ ] **Step 2: Failing tests:** sample data: `every business has exactly one owner`; `Sara is a joined member of all three businesses`; `Café Linde's owner is Jonas Linde and Sara has full access`; `Mia's invitation runs until 2026-10-27`. People rules: `invite adds a waiting row with a link until today + 7 and one personInvited line by the inviter`; **`inviteError ignores case and spaces`** (`' Mia@Example.com '` → `invited`; `'JANA@kanzlei-hoffmann.example'` → `hasAccess`; `'mia@'` → `invalid`); `cancelInvite removes the row with one line`; `acceptInvite joins the row and ignores an expired one`; `the owner can't be removed, changed or leave`; `makeOwner swaps the owner and a full-access member and refuses a tax advisor`; `support is active until today + 7 and off after setSupport(false)`; `a change that changes nothing returns the same business`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** (and update specs that build `Person` or `Business` by hand). **Step 5: Run full suite** → PASS.
- [ ] **Step 6: Commit** `feat: add people with roles to the sample businesses`.

---

### Task 2: A new business and its sample data

**Files:**
- Create: `data/new-business-sample.ts` (+ spec)
- Modify: `data/banks.ts` (+ spec), `state/demo-state.service.ts` (+ spec), `settings/connect-bank.page.ts` (+ spec), `state/upload.service.ts` (+ spec), `settings/tax-details.page.ts` (+ spec)

**Interfaces:**
- `new-business-sample.ts`:
  - `export interface NewBusinessInput { name: string; kind: BusinessKind; legalForm: 'sole' | 'gbr' }`; `export interface NewOwner { personId: string; name: string; email: string }`.
  - `isVisitBusiness(businessId: string): boolean` (ids `new-<n>`).
  - `newBusiness(id: string, input: NewBusinessInput, owner: NewOwner): Business` — `inboxEmail` `<id>@inbox.example`; tax profile with `businessKind: input.kind`, `kleinunternehmer: false`, every other answer null/false, `fiscalYearStart: '01-01'`; no accounts, payments, documents, returns, notices, rules or history; `yearOpening` all zero; `incomeTaxReserveCents: 0`; `people: [owner row, role owner, joined DEMO_TODAY]`; `supportUntil: null`.
  - `newBusinessAccount(businessId: string, bankName: string): Account` — id `<businessId>-main`, `kind: 'bank'`, `name: bankName`, `product: 'business'`, `balanceCents: 1834566`, `lastUpdate: '2026-10-21'`, IBAN `DE89370400440532013000`, placeholder `statement` connection (as `extraAccount` in `banks.ts`).
  - `newBusinessPayments(businessId: string, account: Account, ownerName: string): Transaction[]` — ids `<businessId>-t1…t8`, all on `account`, receipt `missing`, history `imported` (+ `autoBooked` when booked), invented IBANs:

    | # | date | counterparty | cents | booking | notes |
    |---|------|--------------|-------|---------|-------|
    | 1 | 2026-10-20 | Fischer & Co. KG | +119000 | REVENUE_19 | ref `Rechnung 2026-001` |
    | 2 | 2026-10-16 | Hausverwaltung Brandt | −45000 | RENT | `Miete Büro Oktober` |
    | 3 | 2026-10-14 | Telekom | −3995 | PHONE | `Mobilfunk Oktober` |
    | 4 | 2026-10-12 | Adobe | −5949 | SOFTWARE | `Creative Cloud Oktober` |
    | 5 | 2026-10-09 | Deutsche Bahn | −8900 | TRAVEL | `Fahrkarte Berlin–Leipzig` |
    | 6 | 2026-10-07 | Lindner Studio GmbH | +238000 | REVENUE_19 | `confirmed: false`; `Rechnung 2026-002` |
    | 7 | 2026-10-05 | Amazon | −3490 | null | suggestions OFFICE, SOFTWARE, OTHER_COSTS |
    | 8 | 2026-10-02 | `ownerName` | −50000 | null | `Überweisung Privatkonto` (the private transfer) |
  - `NEW_BUSINESS_POOL: PoolResult[]` — Telekom 3995 `2026-10-14` PHONE (certain match for #3); Deutsche Bahn 8900 `2026-10-09` TRAVEL (certain match for #5); Bürobedarf Klein 2990 OFFICE with `direction: null`; then plain: Copyshop Mitte 1250 OFFICE, Parkhaus Zentrum 600 TRAVEL.
- `banks.ts`: `banksOf(businessId: string): string[] | null` (`SAMPLE_BANKS[id]`, null for a visit business: any bank); `foundAccountsOf(businessId: string, bankId: string): Account[]` (`FOUND_ACCOUNTS` for sample ids, else `[newBusinessAccount(businessId, <bank name>)]`).
- `DemoStateService.createBusiness(owner: NewOwner, input: NewBusinessInput): string` — id `new-<n>` (a counter that never repeats in a visit), steps `presetSteps('new')`, returns the id (opening it is the caller's). `connectAccounts` reads `foundAccountsOf` and, the first time a visit business's `-main` account is connected, adds `newBusinessPayments` (newest first). `resetData()` drops every visit business.
- `connect-bank.page.ts`: the bank whose accounts are found is `banksOf(id)` as today, or the picked bank when `banksOf` is null (never "other bank").
- `UploadService`: the pool is `UPLOAD_POOLS[businessId] ?? NEW_BUSINESS_POOL`.
- `TaxDetailsPage`: before the tax step, a visit business starts from `{ ...emptyDraft(), businessKind: business.taxProfile.businessKind }`; a sample business still starts from `emptyDraft()`.

- [ ] **Step 0: Check the Invoices page** on the branch you build from: find how it reads a business's invoices and sample data by business id, and make a visit business show its empty state (no invoices) without errors; add those files to this task.
- [ ] **Step 1: Failing tests:** `a new business starts as a new client with no payments, documents or tax details, owned by the person`; `the Invoices page shows its empty state for a new business`; `connecting it at any bank adds its account named after that bank and the eight October payments`; `connecting twice adds the payments once`; `the payments wait until the bank step, then two or three are in the review inbox`; `its first upload links itself to the Telekom payment`; `its tax page starts with the kind of work answered at sign-up`; `a sample business's tax page still starts empty in New client`; `once its tax details are saved the year shows only October`; `resetData drops businesses made during the visit`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: give a business made in the demo its own sample data`.

---

### Task 3: Who is signed in

**Files:**
- Create: `state/account.service.ts` (+ spec), `state/person-language.service.ts` (+ spec)
- Modify: `state/demo-state.service.ts` (+ spec), `state/tax-reminder.service.ts` (+ spec), `state/notice.service.ts` (+ spec, if the person's id reader changes)

**Interfaces:**
- `AccountService` (root; injects only `SafeStorage`; imports `PERSON` from `data/sample-person.ts`):
  - `readonly samplePerson: Person`; `readonly persons: Signal<Person[]>`; `readonly signedIn: Signal<boolean>`; `readonly person: Signal<Person>` (the signed-in person, or the sample person when nobody is); `readonly signIns: Signal<number>` (up by one on every sign-in).
  - `findByEmail(email: string): Person | undefined` and `emailTaken(email: string): boolean` (both through `normalEmail`).
  - `isTrusted(personId: string): boolean`; `signIn(personId: string, trustDevice: boolean): void` (stores `mockup.session` for the sample person only, removes it for anyone else; `trustDevice` stores `mockup.trusted.<id>`); `signOut(): void`.
  - `createPerson(input: { firstName: string; lastName: string; email: string; lang: Lang }): string` (id `visit-<n>`, one current device "this device", `backupCodesLeft: 8`).
  - `updatePerson(personId: string, change: (p: Person) => Person): void`; `signOutDevice(deviceId: string): void` and `signOutOtherDevices(personId?: string): void` (default: the signed-in person; the current device stays); `makeBackupCodes(): string[]` (the signed-in person's 8 new codes, count back to 8); `useBackupCode(personId: string): boolean` (counts down; false at 0). Exported pure helper `demoBackupCodes(round: number): string[]` (8 codes `NNNN-NNNN`, deterministic per round), used by `makeBackupCodes` and by sign-up and joining, where nobody is signed in yet.
  - `reset(): void` — signs out, removes `mockup.session` and the `mockup.trusted.` prefix, persons back to `[PERSON]`.
  - At start, `mockup.session` signs in only when it names a person in `persons`.
- `DemoStateService`: `get person(): Person` (from `AccountService.person()`); `businesses` lists only the businesses where the person is a joined member; the open business is remembered per person (`setBusiness` ignores a business that isn't the person's; a person with none remembered opens their first). New wrappers on the open business, each a no-op unless the person is its owner (by = person's full name, today = `DEMO_TODAY`, invite ids `<businessId>-m<n>`): `invite(email: string, role: Exclude<Role, 'owner'>): InviteError | null`, `resendInvite(memberId)`, `cancelInvite(memberId)`, `changeRole(memberId, role)`, `removeMember(memberId)`, `makeOwner(memberId)`, `setSupportAccess(on: boolean)`. Not owner-only: `acceptInvite(businessId: string, memberId: string, name: string): boolean`, `leaveBusiness(businessId: string): void`. `readonly myRole: Signal<Role | null>` (in the open business); `roleIn(businessId: string): Role | null`; `isMemberEmail(email: string): boolean` (a row of any business, joined or invited, through `normalEmail`). `resetData()` also forgets the remembered businesses.
- `PersonLanguageService` (root; injects `AccountService`, `LanguageService`): `applyOnSignIn(personId: string, pickedHere: boolean): void` (picked or `lang === null` → save the current language to the person; else `LanguageService.setLang(person.lang)`); `set(lang: Lang): void` (sets the language, and saves it to the person when signed in).
- `TaxReminderService`: the pop-up opens again on every sign-in (its `linkedSignal` source follows both `dataGeneration` and `signIns`).

- [ ] **Step 1: Failing tests:** account: `a stored session for Sara signs her in at start`; **`a stored session for an unknown person counts as signed out`**; `signing in as a visit account removes the stored session`; `signOut forgets the session; reset also forgets the trusted device and the visit accounts`; `makeBackupCodes gives 8 codes and 8 left; useBackupCode counts down and refuses at 0`; `signOutOtherDevices keeps this device`. Demo state: `businesses lists only the person's joined memberships`; **`after leaving the open business, another one opens`**; `at Café Linde Sara's invite, remove and support calls change nothing`; `each person reopens the business they had open last`; `resetData brings back Sara's memberships and Weber Design's people`. Language: `a language picked before signing in wins and is saved`; `without a pick the person's language applies`; `Sara with no language yet keeps the current one`. Reminder: `the reminder opens again on the next sign-in`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: know who is signed in and show only their businesses`.

---

### Task 4: Routes, sign-in and a forgotten password

**Files:**
- Modify: `app.routes.ts` (+ a routes spec), `shell/app-shell.spec.ts` (sign in first)
- Create: `account/signed-in.guard.ts` (+ spec), `account/next-url.ts` (+ spec), `account/auth-frame.ts`, `account/demo-email.ts`, `account/sign-in.page.ts` (+ spec), `account/forgot-password.page.ts` (+ spec); i18n `auth.*`

**Interfaces:**
- Routes: the shell route becomes `loadComponent: () => import('./shell/app-shell')…` with `canActivate: [signedInGuard]`; the three print routes get `signedInGuard` too; new lazy routes outside the shell `sign-in`, `forgot-password` (and in Task 5 `sign-up`, Task 7 `join/:businessId/:memberId`), the first two with `signedOutGuard`.
- `signedInGuard: CanActivateFn` → signed out: `UrlTree` `/sign-in?next=<url>`. `signedOutGuard: CanActivateFn` → signed in: `/`.
- `safeNext(next: string | null): string` → `next` when it starts with `/`, not with `//` or `/\`, and not with `/sign-in`, `/sign-up` or `/forgot-password`; else `/`.
- `AuthFrame` (`app-auth-frame`): a centred card with the app name and the EN/DE/عربي buttons (call `LanguageService.setLang` only), content projection, output `langPicked`.
- `DemoEmail` (`app-demo-email`): inputs `subject: string`, `body: string`, `action: string` (all translated); output `act`; a dashed `border-warning` box headed "Demo: shown here instead of sent".
- `SignInPage` (`/sign-in`): email filled with `samplePerson.email`; password; **Forgot password?**; **Sign in**; "New here? Create an account"; `?signedOut=1` shows "You're signed out."; then the code screen (6 digits, "Don't ask again on this device for 30 days", "Use a backup code instead") unless the device is trusted. Errors: empty email/password; an email that is a member row of any business but no login → "In this demo, only Sara's account and accounts you create can sign in. Seeing the app as someone else comes later."; any other unknown email → says so, linking to Create an account; a code that isn't 6 digits; no backup codes left. Success: `signIn`, `applyOnSignIn(id, pickedHere)`, go to `safeNext(next)`.
- `ForgotPasswordPage` (`/forgot-password`): email → always "Check your email" ("It works for 1 hour"); a demo email only for a known email → **Choose a new password** (≥ 10) → "Password changed. You're signed out on your other devices." (`signOutOtherDevices(personId)`) with **Sign in**.

- [ ] **Step 1: Failing tests:** `a signed-out visit to /payments goes to /sign-in with next`; `the print pages need signing in too`; `signed in, /sign-in goes to the homepage`; **`safeNext only follows paths inside the app`** (`/payments` kept; `//evil.example`, `https://evil.example`, `/\evil`, `/sign-in`, null → `/`); `Sara's email is filled in and any password and any 6 digits sign her in`; **`sign-in ignores case and spaces`**; `a 5-digit code says it needs 6 digits`; `a trusted device skips the code the next time`; `Mia's email says only Sara and new accounts can sign in`; `an unknown email links to Create an account`; `signing in goes back to the page asked for`; `picking DE before signing in keeps German`; `the signed-out note shows after Sign out`; `a backup code signs in and uses one up`; forgot: `a new password signs out the other devices`; `an unknown email still says a link was sent, with no demo email`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite and `npx ng build`** → PASS, no budget warning.
- [ ] **Step 5: Commit** `feat: open on a sign-in page with a 6-digit code`.

---

### Task 5: Sign-up and Add a business

**Files:**
- Create: `account/business-draft.ts` (+ spec), `account/business-step.ts`, `account/terms-check.ts`, `account/two-step-setup.ts` (+ spec), `account/price-box.ts`, `account/sign-up.page.ts` (+ spec), `account/add-business.page.ts` (+ spec)
- Modify: `app.routes.ts` (`sign-up` outside the shell with `signedOutGuard`; `businesses/new` inside the shell); i18n `auth.signUp.*`, `auth.terms.*`, `auth.twoStep.*`, `terms.*`

**Interfaces:**
- `BusinessDraft { name: string; kind: BusinessKind | null; legalForm: 'sole' | 'gbr' | null }`; `businessErrors(draft): Partial<Record<'name' | 'kind' | 'legalForm', string>>` (translation keys); `businessInput(draft): NewBusinessInput | null`.
- `BusinessStep` (`app-business-step`): `model<BusinessDraft>('draft')`, input `errors`; the name field and two choice-card pairs — Freelance · `freiberufler` / Trade · `gewerbe`; Just me · `einzelunternehmen` / Partners · `gbr` — each with `<app-term-info>`; the line "A GmbH can't sign up yet."
- `TermsCheck` (`app-terms-check`): `model<boolean>('accepted')`, input `error`; links to the terms and the AVV (`avv` term) open a dialog "The legal texts aren't written yet"; "The German version is binding; the others are for reading."; "You keep your own books and send your own returns: the app does the work, you confirm."
- `TwoStepSetup` (`app-two-step-setup`): input `codes: string[]` (sign-up and joining pass `demoBackupCodes(0)`; My account passes `makeBackupCodes()`); output `done`; a decorative QR pattern (`aria-hidden`) with the typed key `DEMO 4F7K 2Q9X 8MZP`, the code field (6 digits), the demo box "any 6 digits work", then the backup codes and **I've saved them** → `done`.
- `PriceBox` (`app-price-box`): the placeholder price lines (Global Constraints); input `perBusiness: boolean` adds "Each business has its own plan".
- `SignUpPage` (`/sign-up`): screens `account` (language buttons via `AuthFrame`, `PriceBox`, email, password ≥ 10, a taken email → "There is already an account with this email" + Sign in) → `checkEmail` ("It works for 24 hours", **Send it again** → "Sent again", **Change it** back with the fields kept, `DemoEmail` **Confirm my email**) → `business` (first and last name + `BusinessStep`) → `finish` (`TermsCheck` + `TwoStepSetup`). Finish: `createPerson` (language = the current one), `createBusiness`, `signIn(id, false)`, `applyOnSignIn(id, true)`, go to `/`.
- `AddBusinessPage` (`/businesses/new`): `PriceBox` (per business), `BusinessStep`, `TermsCheck`, **Add the business** → `createBusiness` with the signed-in person as owner, `setBusiness`, go to `/`.

- [ ] **Step 1: Failing tests:** `the three steps lead to the New client homepage with its three setup steps`; `a password under 10 characters is refused`; **`an email that already has an account says so, whatever its case`**; `Change it goes back with the fields kept`; `Finish needs the terms ticked and a 6-digit code`; `the new person's language is the one picked on the first screen`; `there is no GmbH choice and the note says so`; `Add a business opens the new business as a new client, owned by Sara, and the switcher lists it`; `the terms link opens the not-written-yet notice`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: sign up in three steps and add a business`.

---

### Task 6: Person menu, switcher and Reset demo

**Files:**
- Create: `shell/person-menu.ts`
- Modify: `shell/top-bar.ts`, `shell/demo-toolbar.ts`, `shell/app-shell.spec.ts`; i18n `shell.*`, `roles.*`

**Interfaces:**
- `PersonMenu` (`app-person-menu`, at the end of the top bar): an initials button (`aria-label` "Account: <full name>"), a dropdown with name, email, **My account** (`/account`) and **Sign out** (`signOut()`, then `/sign-in?signedOut=1`).
- Switcher: each business with the role word (`roles.<role>`), then a separator and **+ Add a business** (`/businesses/new`).
- Top-bar language buttons call `PersonLanguageService.set`.
- Reset demo: `notices.resetDismissals()`, `demo.resetData()`, `accounts.reset()`, then `/sign-in`.

- [ ] **Step 1: Failing tests:** `the switcher shows Owner for Weber Design and Full access for Café Linde`; `Add a business opens /businesses/new`; `Sign out opens the sign-in page with the signed-out note, and the shell stays closed`; `the top-bar language buttons save the person's language`; `Reset demo signs out and the sign-in page has Sara's email`; `after Reset and signing in, the tax reminder shows again`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the person menu and roles in the switcher`.

---

### Task 7: People with access and joining

**Files:**
- Create: `settings/role-cards.ts`, `settings/invite-dialog.ts`, `settings/people-card.ts` (+ spec), `account/join.page.ts` (+ spec)
- Modify: `settings/settings.page.ts` (+ spec: the card after Bank accounts, `id="people"`), `app.routes.ts` (`join/:businessId/:memberId` outside the shell, `signedInGuard`); i18n `people.*`, `roles.*`

**Interfaces:**
- `RoleCards` (`app-role-cards`): `model<Exclude<Role, 'owner'> | null>('role')`, input `readonly: boolean`; per role the ✓/✕ lines of the spec (Full access, Receipts only, Tax advisor · `steuerberater`).
- `PeopleCard` (`app-people-card`): "Only these people can open <business>'s books. Everyone is included in the price."; a row per member (initials, name or email, "(you)", joined date or "Invited 20 Oct · the link works until 27 Oct", role or **Waiting**); for the owner a ⋮ menu per row — **Change what they can do** (`RoleCards` in a dialog), **Make owner** (joined Full access only, confirm), **Remove** (confirm); waiting rows **Send again**, **Cancel invitation** — and **Invite someone**; for anyone else no menus or invite, and "Only <owner name> (the owner) can invite or remove people." Then the support row: "No access. We can't see your books unless you let us in…" + **Let support look for 7 days**, or "Support can look until 29 Oct" + **Stop now** (owner only).
- `InviteDialog`: email + `RoleCards` + **Send invitation**; shows `inviteError` messages; on success closes and the card shows the invitation's `DemoEmail` ("<inviter> invited you to <business>, as <role>", **Accept the invitation** → `/join/<businessId>/<memberId>`), written in the inviter's language with one line in each of the other two (`TranslocoService.selectTranslate(key, params, lang)`). **Send again** shows it again.
- `JoinPage` (`/join/:businessId/:memberId`): an invited, unexpired row → "Join <business>", the role and its lines (`RoleCards` readonly), name, a language choice (part of the preview, not stored), password ≥ 10, then `TwoStepSetup` → **Join** → `acceptInvite` → "<name> has joined <business> as <role>" + **Back to Settings** (`/settings#people`). "Already have a login? Sign in" → email + password (any, filled) → the same ending. Anything else → "This invitation no longer works" + **Back to Settings**.

- [ ] **Step 1: Failing tests:** `Weber Design lists Sara as Owner, Jana as Tax advisor and Mia as Waiting`; `inviting adds a waiting row with a link until 29 Oct and shows the email`; `an email already invited says so, whatever its case`; `Send again moves the link to 29 Oct`; `Cancel invitation removes the row`; `changing Jana to Full access shows Full access`; `Remove asks first, then the row goes`; `Make owner hands over and hides the menus`; `at Café Linde Sara sees the list without menus and that Jonas Linde is the owner`; `Let support look shows until 29 Oct; Stop now shows No access`; `the invitation email has one line in each of the other two languages`; join: `accepting and joining shows Mia as joined in Settings`; `Already have a login joins the same way`; **`a join link for a cancelled or unknown invitation says it no longer works`**.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add people with access and joining by invitation`.

---

### Task 8: My account

**Files:**
- Create: `account/my-account.page.ts` (+ spec), `account/you-card.ts`, `account/language-card.ts`, `account/signing-in-card.ts`, `account/devices-card.ts`, `account/businesses-card.ts`
- Modify: `app.routes.ts` (`account` inside the shell); i18n `account.*`

**Interfaces:**
- `/account`, five cards in this order:
  - **You:** first and last name + **Save**; email with **Change** → a new valid, untaken email waits for a `DemoEmail` (**Confirm my new email**), then is saved; "The old address is told."
  - **Language:** English, Deutsch, عربي through `PersonLanguageService.set`; "For the app and our emails to you. Tax returns, exports and invoices to German customers stay German."
  - **Signing in:** **Change** password (dialog: current filled in, new ≥ 10; saving signs out the other devices); two-step login "On", "Always on: your account holds bank and tax data.", **Use a new phone** (`TwoStepSetup` in a dialog, new codes); backup codes "6 of 8 left", **Make new codes** (dialog shows the 8 new codes once).
  - **Where you're signed in:** a row per device ("Chrome on Windows", "This device", place, "now" or the date), **Sign out** on the others, **Sign out everywhere else**.
  - **Your businesses:** name and role; **Leave** where not the owner (confirm; `leaveBusiness`); "An owner can't leave: hand the business over in People with access first."

- [ ] **Step 1: Failing tests:** `the five cards show Sara's details`; `changing the email waits for the confirmation`; `the language card saves the person's language and the app follows`; `Make new codes shows 8 codes and 8 of 8 left`; `signing out the iPhone leaves this device`; `Change password signs out the other devices`; **`leaving Café Linde asks first and takes it out of the switcher`**; `an owner has no Leave button`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add the My account page`.

---

### Task 9: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Run** `npx ng test --watch=false` and `npx ng build` from `web/` → all pass, no budget warnings; note the first-load size.
- [ ] **Step 2: Look at it** (controller, browser preview) at 375 px and 1280 px, in en, de and ar: sign-in (both screens, every error), forgot password, the four sign-up screens, Add a business, People with access (owner and Café Linde), the invite dialog and email, the join page, My account, the person menu and the switcher.
- [ ] **Step 3: Walk the demo:** open → sign-in with Sara's email → code → homepage and tax reminder → Settings › People: invite `lena@example.com` as Full access → the email → Join → Lena joined → Make owner → menus gone → My account: Leave Café Linde → Sign out → Create an account → three steps → New client → connect any bank → eight payments → upload a receipt → it links to Telekom → tax details → Taxes shows October → reload → sign-in page with Sara's email → Reset demo from inside → signed out, Sara's data back.
- [ ] **Step 4: Update** `web/README.md`: a "Sign-in and accounts" section (the demo start, what any password and code do, what is remembered, people and roles, joining as a preview, My account, a new business's sample data, not built: views per role, real login, billing, closing a business) and the Demo toolbar's Reset demo line.
- [ ] **Step 5: Commit** `docs: describe sign-in and accounts`.
