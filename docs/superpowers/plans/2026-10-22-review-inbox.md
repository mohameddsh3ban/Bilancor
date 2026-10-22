# Review Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One queue of every decision the client must make — payments and documents — as animated cards at `/review`, reachable in one tap from everywhere, with undo, skip, learning and a finish screen, on sample data in EN/DE/AR.

**Architecture:** A pure `reviewItems()` derives the queue from the live demo data (oldest first). A `ReviewService` holds the session (skipped order, answered count, one-level undo via a business snapshot, the URL to return to). Cards call the existing Payments/Documents actions through `DemoStateService`; a small rules module adds "learning". The page is a child route of the app shell rendered as a fixed full-screen layer.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui, Transloco.

**Spec:** [docs/specs/2026-10-22-review-inbox-design.md](../../specs/2026-10-22-review-inbox-design.md) (builds on the [Payments](../../specs/2026-10-22-payments-mockup-design.md) and [Documents](../../specs/2026-10-22-documents-mockup-design.md) designs; conventions in `web/README.md`)

**Start condition:** run this plan only after the Documents page (branch `documents-mockup`) is merged. Branch from that merge (e.g. `morty-review`).

## Global Constraints

- No backend, real automation or real data; everything comes from `web/src/app/data/` and changes live in memory only (reload / Reset demo restores, rules included).
- Phone first, no horizontal scroll at 375 px; computer layout from Tailwind `lg`.
- Colours only via the shadcn utilities and project tokens (`surface`, `positive`, `negative`, `warning`); logical utilities only; Arabic mirrors everything, including the slide direction (`rtl:` variants).
- Amounts, IBANs, references, invoice numbers in `<bdi dir="ltr">`; names `dir="auto"` + `truncate`.
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; Arabic draft); SKR03 names stay German.
- Every animation ≤ ~500 ms and disabled with the system reduce-motion setting (`motion-reduce:` variants / a `prefers-reduced-motion` check).
- No extra steps: no overview screen, no "Are you sure?" dialogs (Undo instead), no fix that leaves the review page.
- Reuse Payments/Documents code (actions, status functions, pickers, `UploadService`, pipes, `BookingLabel`, `CategoryPicker`); never copy them.
- Demo "today" is `DEMO_TODAY`; storage only via `SafeStorage`.
- Commits stage only the task's files with explicit paths; never commit `.superpowers/`.

## Review Focus

1. **Undo after learning** — undoing an answer that made a rule and booked another payment restores both payments and removes the rule. Test in Task 4 (`undo after a learned rule restores both payments and the rules`).
2. **Skipped item at the end** — answering the last card while a skipped one waits brings the skipped card back and the progress still reads right. Test in Task 4 (`a skipped item comes back after the others`).
3. **Business or language switch while the review is open** — the queue rebuilds for the new business; text re-renders. Test in Task 5 (`switching business while reviewing restarts the queue for that business`).
4. **Item fixed or removed elsewhere** — Reset demo, or a change made on another page, while the review is open: the card disappears or the queue rebuilds; no crash. Test in Task 4 (`reset demo while reviewing rebuilds the queue`).
5. **Reduce motion** — with reduced motion on, cards swap without slide classes and the tick doesn't animate. Test in Task 5 (`reduced motion swaps cards without sliding`).

---

## File Structure

```
web/src/app/
  domain/review-queue.ts            # ReviewItem, reviewItems, needsYouTotal (Task 1)
  domain/category-rules.ts          # CategoryRule, counterpartyKey, applyRuleToUnclear (Task 2)
  domain/photo-receipt.ts           # photoReceiptFor (Task 3)
  state/review.service.ts           # session queue, skip, answer, undo, return URL (Task 4)
  review/review.page.ts             # layer, progress, card host, toast, finish (Task 5)
  review/review-card.ts             # card frame: kind, amount, who, tick, skip (Task 5)
  review/payment-card.ts, document-card.ts, finish.ts (Tasks 5–6)
  shell/needs-you-button.ts         # top-bar "Needs you · N" (Task 7)
```

---

### Task 1: The queue and one shared count

**Files:**
- Create: `domain/review-queue.ts` (+ spec)
- Modify: `data/models.ts`, `data/sample-data.ts` (+ spec), `home/cards/decisions-card.ts`, `home/cards/key-numbers.ts` (+ specs)

**Interfaces:**
- Consumes (from Documents; **first step verifies these exist under these names after the merge** — record any differences in the report and use the merged names): `Doc`, `DocStatus`, `docStatus(doc)`, `docNeedsYou(doc)`, `visibleDocuments(docs, setup)`, `docName(doc)`, `Business.documents`; `paymentStatus(tx)`, `needsYouCount(txs)`; `DemoStateService.bankConnected`.
- Produces:

```ts
export type PaymentProblem = 'confirm' | 'noReceipt' | 'unclear';
export type DocumentProblem = 'duplicate' | 'direction' | 'checkAmount' | 'checkDate' | 'checkName';
export type ReviewItem =
  | { kind: 'payment'; id: string; date: string; problem: PaymentProblem }
  | { kind: 'document'; id: string; date: string; problem: DocumentProblem };
export function reviewItems(business: Business, setup: SetupState): ReviewItem[];
export function needsYouTotal(business: Business, setup: SetupState): number; // = reviewItems(...).length
```
  `reviewItems`: payments whose status isn't `booked` (only when `setupSteps(setup).bank`), plus `visibleDocuments(...)` that `docNeedsYou`; `date` = payment date / `doc.date ?? doc.addedOn`; sorted by date ascending, ties: payments before documents, then id.
- Data: `Transaction.suggestions?: string[]` (up to three `labelKey`s, set on every *Unclear* sample payment); a new Weber Design payment `wd-t18` "Amazon", −€23.90, 2026-10-02, booking null, receipt attached with its linked document (so it's *Unclear*), suggestions like `wd-t4`.

- [ ] **Step 1: Verify the Documents names** listed under Consumes in the merged code; write any differences at the top of the report.
- [ ] **Step 2: Failing tests:** `review items are oldest first across payments and documents` (weber-design order: wd-t18 (10-02), wd-t17 (10-08), wd-t4 (10-15), wd-t3 (10-17), wd-t1 (10-20), wd-d1 (10-20, checkAmount) — same date, payment first); `new client has no payment items`; `cafe-linde has none`; `needsYouTotal is 6 for weber-design, 3 for sara-yoga, 0 for cafe-linde`; homepage card and computer tile both show `needsYouTotal`; `every unclear sample payment has 1–3 suggestions from CATEGORIES`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement.** **Step 5: Run full suite** → PASS.
- [ ] **Step 6: Commit** `feat: derive the review queue and one shared needs-you count`.

---

### Task 2: Learning rules and business snapshots

**Files:**
- Create: `domain/category-rules.ts` (+ spec)
- Modify: `data/models.ts` (`Business.categoryRules: CategoryRule[]`, default `[]` in sample data; `HistoryKey` gains `bookedByRule`), `state/demo-state.service.ts` (+ spec), i18n (`history.bookedByRule`)

**Interfaces:**
- Produces:

```ts
export interface CategoryRule { counterpartyKey: string; booking: Booking }
export function counterpartyKey(name: string): string; // lowercase, trim, collapse spaces, drop trailing punctuation
export function applyRuleToUnclear(txs: readonly Transaction[], rule: CategoryRule, exceptId: string): { txs: Transaction[]; bookedIds: string[] };
// every other payment with the same key and paymentStatus 'unclear' gets the booking, confirmed, history { key:'bookedByRule', params:{ category: labelKey } }
```
- `DemoStateService` adds: `addRule(rule: CategoryRule): string[]` (adds or replaces the rule for that key on the open business, applies it via `applyRuleToUnclear`, returns booked ids); `snapshot(): Business` (deep copy of the open business) and `restore(snapshot: Business): void` (replaces that business in the working copy). In `updateTransaction`, when a payment's booking changes and the open business has a rule for its counterparty key, that rule's booking follows the new booking (not for private bookings).

- [ ] **Step 1: Failing tests:** `counterpartyKey normalises` (`' AMAZON  '` and `'Amazon.'` → `'amazon'`); `a rule books other unclear payments of the same counterparty` (rule from wd-t4 books wd-t18, not wd-t4, history `bookedByRule`); `a rule doesn't touch booked or confirm payments`; `changing a payment's category updates its counterparty's rule`; `marking private doesn't change a rule`; `snapshot and restore bring back payments, documents and rules`; `resetData clears rules`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add learned category rules and business snapshots`.

---

### Task 3: Take a photo for a payment

**Files:**
- Create: `domain/photo-receipt.ts` (+ spec)
- Modify: `state/upload.service.ts` (+ spec), `payments/payment-detail.page.ts` (+ spec), i18n

**Interfaces:**
- Consumes: `newReadingDoc`, `applyReadResult`, `READING_MS`, `DemoStateService.addDocument/link/updateDocument`.
- Produces: `photoReceiptFor(tx: Transaction): PoolResult` — plain *Received* result from the payment (name = counterparty, amount = |amount|, date = payment date, booking = payment's booking, no duplicate). `UploadService.addPhotoFor(paymentId: string): Promise<'linked' | 'dropped'>` — creates a reading document `photo-2026-10-22-<n>.jpg` with source `photo`, applies `photoReceiptFor` after `READING_MS`, links it to that payment (not via `certainMatch`), resolves `'linked'`; resolves `'dropped'` if the data was reset meanwhile. It never touches the upload pool's position. `readingFor: Signal<string | null>` (payment id currently being read).
- Payments detail: **Take a photo** calls `addPhotoFor` (shows *Reading…* on the button) instead of linking to coming soon.

- [ ] **Step 1: Failing tests:** `photo for wd-t3 links a new Done document after READING_MS` (fake timers; payment status leaves `noReceipt`; history lines `addedPhoto` / `linked`); `photo doesn't move the upload pool` (next `add()` still yields the pool's first result); `reset during reading drops it`; `payment detail Take a photo shows Reading… then the receipt`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: take a photo for a payment`.

---

### Task 4: Review session

**Files:**
- Create: `state/review.service.ts` (+ spec)

**Interfaces:**
- Consumes: `reviewItems`, `DemoStateService` (`business()`, `setup()`, `snapshot()`, `restore()`, `dataGeneration`), `Router`.
- Produces (`ReviewService`, root):

```ts
readonly current: Signal<ReviewItem | null>;   // first of the session queue
readonly position: Signal<number>;              // 1-based number of the current card
readonly total: Signal<number>;                 // answered + remaining
readonly answered: Signal<number>;
readonly minutesLeft: Signal<number>;           // decisionMinutes(remaining)
readonly lastAnswer: Signal<{ labelKey: string; params?: Record<string,string>; learnedBookedCount?: number } | null>;
readonly canUndo: Signal<boolean>;              // true for 5000 ms after an answer
readonly summary: Signal<{ decisions: number; receiptsAdded: number; duplicatesRemoved: number }>;
readonly returnUrl: Signal<string>;             // last URL outside /review, default '/'
answer(apply: () => void, result: { labelKey: string; params?: Record<string,string>; learnedBookedCount?: number; counts?: 'receipt' | 'duplicateRemoved' }): void;
skip(): void;
undo(): void;
```
  Session queue = live `reviewItems` ordered as returned, except skipped keys (`kind:id`) moved to the end in skip order. `answer` takes `demo.snapshot()` first, runs `apply`, increments `answered` only when the item left the queue (an item with a next problem stays current). `undo` restores the snapshot, reverts counters and summary, clears `canUndo`. A business switch or `dataGeneration` change resets the session (answered 0, skipped cleared). Closing the page (✕) does **not** reset it: the service is root-scoped, so the next Start continues the same session. `returnUrl` is tracked from `NavigationEnd` events whose URL doesn't start with `/review`.

- [ ] **Step 1: Failing tests:** `current is the oldest item and total counts all`; `answering moves on and counts`; `an item with a second problem stays current` (in the test, set wd-t3 to `confirmed: false` via `updateTransaction`, so it is *Confirm* with a missing receipt; answer with `confirmBooking` → current is still wd-t3, now `noReceipt`, `answered` unchanged); `a skipped item comes back after the others`; `undo restores the change and the counters`; `undo after a learned rule restores both payments and the rules`; `canUndo ends after 5000 ms` (fake timers); `reset demo while reviewing rebuilds the queue`; `returnUrl is the last page outside /review`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat: add the review session`.

---

### Task 5: Review page, card frame and finish

**Files:**
- Create: `review/review.page.ts`, `review/review-card.ts`, `review/finish.ts` (+ specs)
- Modify: `app.routes.ts` (child `review` of `AppShell`, lazy), i18n, `styles.css` (keyframes if needed)

**Interfaces:**
- Consumes: `ReviewService`; payment/document cards from Task 6 (create minimal placeholders `PaymentCard` / `DocumentCard` with `[item]` inputs now).
- Produces:
  - `ReviewPage` at `/review`: `fixed inset-0 z-50` layer; phone: opaque, full screen over the bottom bar; `lg`: dimmed backdrop (`bg-foreground/40`) with the cards in a centred column `max-w-md`. Top: ✕ (navigates to `returnUrl()`), progress bar (`position/total`), "N of M · about X min left". Card host renders `<app-payment-card>` / `<app-document-card>` for `current()`, keyed by item so a new item slides in. Bottom: undo toast (text from `lastAnswer`, **Undo** button) while `canUndo()`. When `current()` is null: `<app-review-finish>`.
  - `<app-review-card [kindKey] [amountCents] [signed] [name] [date]>` with content projection for question + answers, a tick overlay API (`showTick(labelKey, params)`: shows "Saving…" for ~150 ms, then the green tick with the result text), and **Skip for now** (calls `skip()`). When an item has a next problem, the card stays in place and its question/answers change after the tick (no slide).
  - Motion: card enter/leave = translate-x ±110% + opacity, ~300 ms, reversed under `rtl`; tick scale-in ~250 ms; progress width transition; all off under reduced motion (`motion-reduce:transition-none`, and the page reads `matchMedia('(prefers-reduced-motion: reduce)')` to skip the leave delay).
  - Finish: check animation, "All done — your books are up to date", summary line from `summary()`, "Next VAT return due <date>" only when `business().vatDue`, **Back** → `returnUrl()`.

- [ ] **Step 1: Failing tests:** `opening /review shows the first card directly`; `progress reads 1 of 6 for weber-design`; `close returns to the page you came from`; `undo toast appears after an answer and undo brings the card back`; `finish shows after the last answer with the summary and VAT line`; `switching business while reviewing restarts the queue for that business`; `reduced motion swaps cards without sliding`; `in Arabic the layer is rtl and the slide direction is reversed (class check)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS; `npx ng build` OK.
- [ ] **Step 5: Commit** `feat: add the review page`.

---

### Task 6: Payment and document cards

**Files:**
- Modify: `review/payment-card.ts`, `review/document-card.ts` (placeholders from Task 5) (+ specs), i18n

**Interfaces:**
- Consumes: `confirmBooking`, `changeCategory`, `markNoReceiptNeeded`, `setPrivate` (payments); `keepDuplicate`, `setDirection`, `editDocument` (documents); `DemoStateService.updateTransaction/updateDocument/removeDocument/link/addRule`; `UploadService.addPhotoFor`; `<app-category-picker>`; Documents' `<app-document-picker [payment] (picked)>`; `parseAmountQuery`; `ReviewService.answer`.
- Produces — answers per problem (main answer first), each wrapped in `review.answer(...)`:
  - **Unclear:** buttons for `tx.suggestions` (translated labels) → `changeCategory` + `addRule({ counterpartyKey(tx.counterparty), booking })`, result `learnedBookedCount` = booked ids length; **Private, not for the business** only when no document is linked → `setPrivate(true)` (no rule); **Other category…** → `<app-category-picker>` over the card, then as a suggestion (with rule).
  - **Confirm:** **Yes, that's right** → `confirmBooking`; **Change category** → picker → `changeCategory` (no rule — rules only from Unclear).
  - **Receipt missing:** **Take a photo** → `addPhotoFor` (card shows *Reading…*, then answers `counts: 'receipt'`); **Pick from Documents** → `<app-document-picker>` → `link(docId, txId)` (`counts: 'receipt'`); **No receipt needed** → `markNoReceiptNeeded`.
  - **Possible duplicate:** **Keep both** → `keepDuplicate`; **Remove this one** → `removeDocument` (`counts: 'duplicateRemoved'`).
  - **Received or sent?:** **Received** / **Sent** → `setDirection`.
  - **Check amount/date/name:** the field on the card (amount via `parseAmountQuery`, `type="date"` input, text) + **Save** → `editDocument`; Save disabled until valid.
  - Learning message under the tick: `review.learned` ("Got it — {{name}} will be booked as {{category}} automatically from now on.") plus `review.learnedMore` ("…and {{count}} more {{name}} payment(s) booked.") when count > 0.
  - Document cards show `<app-document-paper [doc]>` (from Documents) with the marked spot.

- [ ] **Step 1: Failing tests:** `unclear Amazon: choosing a suggestion books it, learns, and books wd-t18 too` (message contains "and 1 more"; queue drops by 2); `private is offered only without a linked document`; `confirm card confirms`; `take a photo shows Reading… then moves on` (fake timers); `pick from documents links wd-d4 to wd-t17`; `no receipt needed`; `duplicate: keep both / remove`; `direction: received`; `amount: 49,90 saves 4990 cents; Save disabled while empty or invalid`; `all answers keep the card on the review page (no navigation)`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add payment and document decision cards`.

---

### Task 7: Ways in

**Files:**
- Create: `shell/needs-you-button.ts` (+ spec)
- Modify: `shell/top-bar.ts`, `home/cards/decisions-card.ts`, `home/cards/key-numbers.ts`, `payments/payment-filters-bar.ts`, Documents' Needs-you box (`documents/needs-you-box.ts`), their specs, i18n

**Interfaces:**
- Consumes: `needsYouTotal`, `DemoStateService`.
- Produces: `<app-needs-you-button>` in the top bar next to the bell: link to `/review` reading "Needs you · N" (`review.needsYouButton`), hidden when N is 0, in every setup state. Homepage decisions card and key-number tile **Start** → `/review`. Payments filters bar: a **Start** link to `/review` beside the "Needs you" quick filter when its count > 0. Documents Needs-you box: a **Start** link to `/review`.

- [ ] **Step 1: Failing tests:** `top bar shows Needs you · 6 for weber-design and links to /review`; `hidden at 0 (cafe-linde)`; `shown in halfway when something needs you`; `homepage Start goes to /review`; `payments and documents Start go to /review`; `the count drops after an answer` (answer one card, button reads 5).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS; build OK.
- [ ] **Step 5: Commit** `feat: open the review inbox from everywhere`.

---

### Task 8: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1:** Full suite and `npx ng build` (no budget warnings; report rather than raise the budget).
- [ ] **Step 2:** Controller checks by eye at 375 × 812 and 1280 × 800, in en and ar: every way in, every card type, the learning moment (Amazon), Undo, Skip, ✕ and coming back, finish screen, reduced motion (emulated), and that Payments/Documents/homepage reflect each answer.
- [ ] **Step 3:** README: a short "Review inbox" section (ways in, card types, Undo/Skip, learning, what's simulated).
- [ ] **Step 4: Commit** `docs: describe the review inbox`.
