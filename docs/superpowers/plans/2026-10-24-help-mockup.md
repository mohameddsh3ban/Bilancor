# Help Mockup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clickable Help page inside the app — search, help for the page the person came from, seven topics, about 25 sample answers that open on the page, German terms A–Z built from the terms the app already explains, Write to us (simulated), and a plain line about tax advice — in EN/DE/AR, phone-first.

**Architecture:** One runtime list of term keys (`TERM_KEYS`) replaces the hand-written `TermKey` union, so the A–Z list and its count can't drift. The answers, topics, page-to-question map and term-to-page map are plain data in `data/help.ts`, with all text in the translation files; searching and choosing the page's questions are pure functions in `domain/help.ts`. A small root service remembers the last page opened outside Help. Four lazy routes inside the app shell: `/help`, `/help/terms`, `/help/contact`, `/help/:id`.

**Tech Stack:** Angular 22 (standalone, zoneless, signals), Vitest via `ng test`, Tailwind CSS 4, spartan/ui (`@spartan-ng/helm/*`), Transloco.

**Spec:** [docs/specs/2026-10-24-help-mockup-design.md](../../specs/2026-10-24-help-mockup-design.md) (approved mockup `.superpowers/brainstorm/145253-1792862238/content/help-page.html`; conventions in `web/README.md`)

## Global Constraints

- **Start only when the Phase 1 gaps build is merged** into morty-documents (it adds terms such as Privateinlage, Kasse, CAMT and Kontoauszug, and changes the menu, routes and translations), in a fresh worktree with `git status` clean under `web/`. Task 1's first step re-checks the term keys, the menu and the routes against that code.
- Nothing is sent and nothing is stored: Write to us shows "Sent" in a demo box; "Was this helpful?" keeps nothing.
- Answers explain the app and German terms only — never what a person should do with their own taxes; every answer matches what the mockup does (checked against `web/README.md`), including its quirks (a VAT return due on the 10th even on a weekend).
- The same Help for everyone: no answer or link depends on the business or role, except that for a Kleinunternehmer "Help with Taxes" starts with "What is the Kleinunternehmer limit?".
- German terms keep their German original next to the translation; the term list and count come from `TERM_KEYS`.
- Phone first: every screen works at 375 px with no horizontal scroll; two columns from Tailwind `lg`. Colours only via the shadcn utilities and `surface`, `positive`, `negative`, `warning`; logical utilities only; Arabic mirrors everything.
- All text in `web/public/i18n/{en,de,ar}.json` with identical keys (German informal "du"; German and Arabic answers are drafts). Specs that render text: `localStorage.clear()` in `beforeEach`, `LanguageService.setLang('en')` in `afterEach`; signed-in specs use `signInAsSara()`.
- Every Help page is a lazy route; `npx ng build` has no budget warnings (650 kB); `DEMO_TODAY`, never the real clock.
- Run tests from `web/` with `npx ng test --watch=false`. Commits stage only the task's own files by path (never `git add -A`; never `.superpowers/`, `backend/`, `admin/`, `CLAUDE.md`).

## Review Focus

1. **Search that misses the obvious** — "Ausgangsbeleg", "ausgangsbeleg", "AUSGANGSBELEG", "uebertragung" and "ubertragung" all find their entry; a query of only spaces shows the page, not "Nothing found". Test in Task 1 (`search ignores case, spaces and umlaut spellings`).
2. **A term added later** (by Phase 1 or any future page) appears in A–Z with its count without touching Help. Test in Task 1 (`every term key has its texts and a place in A–Z`).
3. **Coming from a page Help doesn't know** (a print page, `/account`, `/businesses/new`, the first page of a visit) — Help shows Getting started, never an empty section. Test in Task 3 (`an unknown or missing last page shows Getting started`).
4. **Unknown addresses** — `/help/nope`, `/help?topic=nope`, `/help/terms#nope` show a clear "doesn't exist" or the full list, never a blank page. Tests in Tasks 4 and 5.
5. **Arabic** — answers, terms and the form mirror; German words, emails and dates read left to right inside Arabic sentences. Tests in Tasks 4–6 (`reads in Arabic`).

---

## File Structure

```
web/src/app/
  core/i18n/term-keys.ts          # TERM_KEYS (runtime list) and TermKey = (typeof TERM_KEYS)[number] (Task 1)
  data/help.ts                    # topics, answers, page questions, term pages (Task 1)
  domain/help.ts                  # helpPageOf, pageQuestions, searchHelp, termsAZ, normalizeForSearch (Task 1)
  state/help-context.service.ts   # the last page opened outside Help (Task 3)
  help/                           # help.page, answer.page, terms.page, contact.page (Tasks 3-6)
```

---

### Task 1: Term keys, help data and rules

**Files:**
- Create: `core/i18n/term-keys.ts` (+ spec), `data/help.ts` (+ spec), `domain/help.ts` (+ spec)
- Modify: `core/i18n/term.ts` (import `TermKey` from term-keys), `core/i18n/i18n-keys.spec.ts` (read `TERM_KEYS` instead of its hard-coded list)

**Interfaces:**
- `TERM_KEYS: readonly [...]` — every key under `terms.*` except `whatIs` (today 38, including `eigenbeleg`, which the union lacks; plus whatever Phase 1 added); `type TermKey = (typeof TERM_KEYS)[number]`.
- `data/help.ts`:
  - `type HelpTopic = 'start' | 'payments' | 'receipts' | 'invoices' | 'taxes' | 'account' | 'privacy'` and `HELP_TOPICS: readonly HelpTopic[]` in that order.
  - `type HelpPage = 'start' | 'payments' | 'documents' | 'invoices' | 'taxes' | 'reports' | 'settings'`.
  - `interface HelpAnswer { id: string; topic: HelpTopic; terms: TermKey[]; link: { route: string; fragment?: string; page: HelpPage } | null }` — texts at `help.answers.<id>.q` and `.a` (`.a` may hold up to three paragraphs split by a blank line).
  - `HELP_ANSWERS: HelpAnswer[]` — the spec's 25 questions with ids (kebab-case, e.g. `vat-due`, `send-return`, `payment-blocks-send`, `klein-limit`, `close-month`, `export-advisor`).
  - `PAGE_QUESTIONS: Record<HelpPage, string[]>` — the spec's "Pages and their questions" (answer ids), Taxes = `['vat-due', 'send-return', 'payment-blocks-send']`.
  - `TERM_PAGES: Record<TermKey, HelpPage[]>` — where each term appears.
- `domain/help.ts`:
  - `helpPageOf(url: string | null): HelpPage` (`/` start, `/payments*` and `/review*` payments, `/documents*` documents, `/invoices*` invoices, `/taxes*` taxes, `/reports*` reports, `/settings*` and `/account` settings; anything else or null → `start`).
  - `pageQuestions(page: HelpPage, kleinunternehmer: boolean): string[]` (for `taxes` with a Kleinunternehmer: `['klein-limit', …the other two]`).
  - `normalizeForSearch(text: string): string` (lower-case, trimmed, `ä/ae→a`, `ö/oe→o`, `ü/ue→u`, `ß→ss`, other accents dropped; applied to both sides).
  - `type HelpHit = { kind: 'answer'; id: string; topic: HelpTopic } | { kind: 'term'; key: TermKey }`; `searchHelp(query: string, texts: { answers: Record<string, { q: string; a: string }>; terms: Record<TermKey, { label: string; de: string; explain: string }> }): HelpHit[]` (answers whose question matches first, then answers whose text matches, then terms; empty for a blank query).
  - `termsAZ(terms: Record<TermKey, { de: string }>, lang: Lang): { letter: string; keys: TermKey[] }[]` (by the German word, `Intl.Collator('de')`, Ä with A).

- [ ] **Step 1: Check the names** on the branch you build from: the `terms.*` keys in en.json (`node -e` listing), `TermKey`, `menu.ts` (`help` → `/soon/help`), `coming-soon.page.ts`, the routes; add every term Phase 1 added to `TERM_KEYS` and `TERM_PAGES`.
- [ ] **Step 2: Failing tests:** `TERM_KEYS lists every terms.* key except whatIs, eigenbeleg included`; **`every term key has its texts and a place in A–Z`** (label, de, explain in en/de/ar; a non-empty `TERM_PAGES` entry); `every answer id is unique and every page's questions are answers`; `each topic has at least two answers and the counts add up to HELP_ANSWERS`; `helpPageOf maps the app's pages and falls back to start`; `a Kleinunternehmer's Taxes questions start with the limit`; **`search ignores case, spaces and umlaut spellings`** (Ausgangsbeleg ×3 spellings; "uebertragung" and "ubertragung" → `uebertragungsprotokoll`; "   " → []); `search lists question matches before text matches before terms`; `termsAZ groups Ä with A and sorts the German way`.
- [ ] **Step 3: Run** → FAIL. **Step 4: Implement** (with placeholder `help.answers.*` texts only where a spec needs them; Task 2 writes the real ones). **Step 5: Run full suite** → PASS.
- [ ] **Step 6: Commit** `feat: add the help data and its rules`.

---

### Task 2: The answers' texts

**Files:**
- Modify: `web/public/i18n/{en,de,ar}.json` (`help.answers.*`, `help.topics.*`), `core/i18n/i18n-keys.spec.ts`

**Interfaces:**
- For each `HELP_ANSWERS` id: `help.answers.<id>.q` and `help.answers.<id>.a` in en, de and ar; `help.topics.<topic>` names. English written from `web/README.md` and the app's own copy (button names as the app shows them); German informal "du"; Arabic draft. No answer recommends a tax choice; conditions are said in words ("if your business charges VAT", "only the owner can …").

- [ ] **Step 1: Failing test:** `every answer has a question and a text in all three languages, and no text is a placeholder`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Write the texts**, checking each English answer against the README section it describes (note the section in the report per answer). **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: write the help answers in three languages`.

---

### Task 3: The Help page

**Files:**
- Create: `state/help-context.service.ts` (+ spec), `help/help.page.ts` (+ spec)
- Modify: `app.routes.ts` (lazy `help`, `help/terms`, `help/contact`, `help/:id` inside the shell, in that order), `shell/menu.ts` (`help` → `/help`), `shell/coming-soon.page.ts` (drop `help`), `shell/app-shell.ts` (start the context service, as it starts ReviewService), their specs; i18n `help.*`

**Interfaces:**
- `HelpContextService` (root): `readonly lastPage: Signal<string | null>` — the last URL opened outside `/help`, from `NavigationEnd`.
- `HelpPage` (`/help`): the search box (results as in the spec: answers with their topic, terms marked "Term" → `/help/terms#<key>`; nothing found → **Write to us** carrying the query, `/help/contact?q=<query>`); when not searching: "Help with <page>" + "Because you came from <page>" + `pageQuestions(helpPageOf(lastPage), kleinunternehmer)` (Getting started for `start`); the topics with counts (`?topic=<id>` shows that topic's questions in place of the overview, with "‹ All topics"); the A–Z card with `TERM_KEYS.length`; the Write to us card; the tax-advice note with **Invite your tax advisor** → `/settings#people`.

- [ ] **Step 1: Failing tests:** `the menu opens /help and the coming-soon page no longer knows help`; `coming from Taxes shows Help with Taxes and its three questions`; `a Kleinunternehmer coming from Taxes sees the limit first`; **`an unknown or missing last page shows Getting started`**; `a topic shows its questions at ?topic= and back to all topics`; `an unknown topic shows all topics`; `search shows answers and terms, and a term opens A–Z at it`; `nothing found offers Write to us with the query`; `the A–Z card counts TERM_KEYS`; `the tax-advice note links to People with access`; `reads in Arabic`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite and build** → PASS, no budget warnings.
- [ ] **Step 5: Commit** `feat: add the Help page`.

---

### Task 4: One answer

**Files:**
- Create: `help/answer.page.ts` (+ spec); i18n `help.answer.*`

**Interfaces:**
- `/help/:id`: "‹ Help · <topic>" (Help → `/help`, topic → `/help?topic=<topic>`), the question as `h1`, the answer's paragraphs, the terms as `<app-term>` chips, the page button ("Open Taxes" …, from `link`), "Did this answer your question?" with **Yes** (replaced by "Thanks", nothing stored) and **No, write to us** → `/help/contact?topic=<topic>&about=<id>`; an unknown id: "This answer doesn't exist" + **Back to Help**.

- [ ] **Step 1: Failing tests:** `an answer shows its question, paragraphs, term chips and page button`; `Yes says thanks and stores nothing`; `No opens Write to us with the topic and the question`; **`an unknown answer says it doesn't exist`**; `the breadcrumb returns to Help and to the topic`; `reads in Arabic`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: open a help answer on its page`.

---

### Task 5: German terms A–Z

**Files:**
- Create: `help/terms.page.ts` (+ spec); i18n `help.terms.*`, page names `help.pages.*`

**Interfaces:**
- `/help/terms`: a filter box (same `normalizeForSearch` over the German word, translation and explanation), then `termsAZ` groups with letter headings; each term with `id="<key>"` (so `#<key>` scrolls), the German word in `lang="de"`, its translation (not repeated on the German page), the explanation, and "Appears in: Taxes, Reports" from `TERM_PAGES`; no match → "No term matches" with the full list one tap away; `#nope` just shows the list.

- [ ] **Step 1: Failing tests:** `lists every TERM_KEYS term once, grouped by letter`; `filters by German word, translation or explanation`; `#<key> scrolls to that term`; `the German page doesn't repeat the word as its translation`; `reads in Arabic, German words left to right`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add German terms A–Z`.

---

### Task 6: Write to us

**Files:**
- Create: `help/contact.page.ts` (+ spec); i18n `help.contact.*`

**Interfaces:**
- `/help/contact`: **Topic** (the seven topics + "Something else"; from `?topic=`), **Your message** (from `?about=<id>` → "About: <question>\n\n", or `?q=` → the query; needed, at least 10 characters after trimming *(the plan's call for "a few words")*), "We answer to <email>, usually within 1 working day." (the signed-in person's email in `<bdi dir="ltr">`), **Send**, the support line linking `/settings#people`; the demo box; after Send: "Sent. You'll find our answer in your email." + **Back to Help**; nothing stored.

- [ ] **Step 1: Failing tests:** `the form starts with the topic and question from an answer's No`; `a search's text carries into the message`; `an empty or too short message says what's missing`; `Send shows Sent and stores nothing`; `the reply line uses the signed-in person's email`; `reads in Arabic`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run full suite** → PASS.
- [ ] **Step 5: Commit** `feat: add Write to us`.

---

### Task 7: Check and document

**Files:**
- Modify: `web/README.md`

- [ ] **Step 1: Run** `npx ng test --watch=false` and `npx ng build` from `web/` → all pass, no budget warnings.
- [ ] **Step 2: Walk the demo** (the implementer, on their own dev server; no app-code changes) at 375 px and 1280 px in en, de and ar: Taxes → Help (Help with Taxes) → an answer → No → Write to us → Send; Sara Weber Yoga → Taxes → Help (the limit first); search "ausgangsbeleg" and "ubertragung"; a term → A–Z at it; every answer read once in English against the app.
- [ ] **Step 3: Update** `web/README.md`: a "Help" section (search and its rules, the page questions, topics, answers and "Was this helpful?", German terms A–Z, Write to us, the tax-advice line, what isn't built) and the menu line.
- [ ] **Step 4: Commit** `docs: describe the Help page`.
