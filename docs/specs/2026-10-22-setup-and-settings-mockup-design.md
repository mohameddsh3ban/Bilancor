# Setup and Settings — clickable mockup (design)

Oct 22, 2026 · Status: draft for approval

## Intent

A new client sets up the app once: connect the bank, give the tax details, add a first receipt. The homepage's setup checklist already lists these three steps, but the first two still open "coming soon" pages. This mockup builds them, and a short **Settings** page where the same answers and bank accounts can be seen and changed later.

What a freelancer should feel: done in a few minutes, **without knowing any tax or banking jargon** and without a tax advisor next to them. Bilancor's settings (studied Oct 22, 2026, see the [product spec](../bookkeeping-portal-spec.md#settings-bank-connection-and-tax-details)) are BuchhaltungsButler's: twelve unrelated sections on one long page, tax details split over two pages, a choice between technical bank providers (finAPI or Qwist) before the bank, a list of 615 tax offices, no VAT return period, and no sign of whether the bank connection still works. Ours asks five plain questions, connects a bank by its name, and always shows the connection's health.

Like the earlier mockups ([Payments](2026-10-22-payments-mockup-design.md), [Documents](2026-10-22-documents-mockup-design.md), [review inbox](2026-10-22-review-inbox-design.md)), this is a **clickable mockup with sample data** in `web/`, not the working product. The owner saw and approved the three screens as mockups (`.superpowers/brainstorm/…/tax-step.html` option A, `bank-flow.html`, `settings-page.html`).

**Build order:** after the review inbox is merged, because this changes the shared demo state (setup steps) that the homepage, Payments, Documents and the review inbox all read.

## Goals

- **Your tax details:** one short page of plain questions, used both as the setup step and as Settings › Business and tax.
- **Connect your bank:** four short screens — pick your bank, what we can see, the bank's sign-in (simulated), choose accounts — then the payments arrive.
- **Settings:** three short sections — Business and tax, Bank accounts (with each connection's health and Renew), Documents inbox.
- **The setup steps become real:** finishing a step ticks it and changes the demo (payments appear, cards and notices follow). The three steps are independent and can be done in any order; the demo toolbar's three choices stay as shortcuts.
- **The answers count:** the tax answers drive the rest of the app (VAT shown or not, revenue categories, the VAT return card).
- English, German and Arabic (right-to-left), phone first.

## Non-goals

- No real bank connection, provider (finAPI, Tink, GoCardless …), credentials or consent; the bank sign-in is a demo screen.
- No real tax-office lookup or tax-number check against an official source; a small sample table stands in.
- Still "coming soon": importing a bank statement (CSV) for a bank that isn't listed or an account without a connection; PayPal, Stripe and Amazon connections; users and roles; a list of the rules the review inbox learned; invoice settings (with Invoicing).
- No profit method or balance sheet question: Phase 1 clients file an EÜR. No company form beyond freelancer/trade.

## Anti-goals

- Making the client choose a technical bank provider, or showing its name.
- A list of tax offices to scroll through.
- Recommending an answer to a tax question (that could count as tax advice under the StBerG). We explain the terms and say where the answer is written; the client decides.
- One long page of unrelated settings; the whole chart of accounts on show.
- Changes that leave no trace: every saved change adds a history line (GoBD).
- Real bank logos or bank names used as if we partnered with them; tiles show initials *(my call)*.
- Copying Bilancor's or BuchhaltungsButler's design, wording or code; using real data from the studied account.

## Constraints

Everything from the earlier mockups applies: Angular 22, Tailwind CSS 4, spartan/ui, Transloco; the colour convention in `web/README.md`; logical layout so Arabic mirrors; amounts, IBANs, tax numbers and VAT IDs in `<bdi dir="ltr">`; Western digits in Arabic; German tax terms next to translations through `<app-term>`; all text in `web/public/i18n/{en,de,ar}.json` with the same keys; the shared `money` and `appDate` pipes; demo date 22 Oct 2026; storage only through `SafeStorage`. Reuse what exists: `tax-rules.ts` (`vatRateShown`, `categoriesFor`), the notice service, the demo toolbar, the setup checklist, `DemoStateService`.

## Setup steps

Today `SetupState` is one value (`new` · `halfway` · `active`) shared by all businesses, and `setupSteps()` derives three flags from it. It becomes **three independent flags per business** — `bank`, `tax`, `receipt` — held in `DemoStateService` *(my call: in the real product each business is set up on its own, so switching business shows that business's progress)*.

| Step | Done when | What follows |
| --- | --- | --- |
| Connect your bank | The bank flow finishes with at least one account | Payments appear (the business's sample payments), bank notices may show, Documents shows its sample documents |
| Your tax details | The tax page is saved once | The VAT return card and tax notices show |
| Upload your first receipt | The first document is added (any way) | The decisions card shows, as today |

- The **demo toolbar** keeps *New client* (none done), *Halfway* (bank only) and *Active client* (all three) as shortcuts for the **open business**. A choice is highlighted when that business's steps match it exactly, none otherwise. The shortcuts only set the flags; they never change accounts, answers or documents. **Reset demo** restores the sample data and sets every business back to all three done (Active client), as the app starts today *(my calls)*.
- Everything that reads the setup today reads the flags instead (the homepage cards, Payments, Documents, the notices, the review inbox). Their behaviour for the three shortcut states stays as it is.
- When all three are done the checklist disappears, as today. A done step links to its place in Settings (bank, tax) or to Documents (receipt).

## Your tax details

Route `/settings/tax`. Phone: a page of its own with a back link; computer: the same page in the main area. Reached from the setup step, from Settings › Business and tax › **Edit**, and from nowhere else.

**The page:** title "Your tax details", one line "So we book and file the right way. You'll find most answers in your letter from the tax office.", then the questions as cards, then **Save**. German terms next to the translations, each explained on hover or tap.

| Question | Answers | Notes |
| --- | --- | --- |
| What kind of business is it? | Freelance work (Freiberufler) · A trade (Gewerbe) | |
| Do you charge VAT? | Yes · No, I'm a Kleinunternehmer | The "No" answer names the limits: under €25,000 last year and €100,000 this year |
| How often do you send VAT returns (UStVA)? | Monthly · Quarterly · Only once a year | Only after "Yes". Under it: ☐ I have a permanent extension (Dauerfristverlängerung) |
| When is VAT due? | When my customer pays (Ist) · When I send the invoice (Soll) | Only after "Yes" |
| Tax number (Steuernummer) | Federal state + number | As soon as the number is valid, the tax office shows under it ("✓ Tax office: …") |
| VAT ID (USt-IdNr.) | optional | Format `DE` + 9 digits |
| Financial year | "Calendar year" with a **Mine is different** link that shows a day + month field | |

- A small "Not sure? It's in your letter from the tax office (Fragebogen zur steuerlichen Erfassung)." line where a client may hesitate (VAT, return period, Ist/Soll). No answer is ever pre-selected as "recommended".
- **Validation on Save:** every visible question answered; tax number matches the chosen state's format and is found in the sample table ("We couldn't find a tax office for this number. Please check it."); VAT ID format if filled. Errors show next to the field.
- **Before the tax step is done**, the page opens empty; afterwards it shows the saved answers *(my call: the sample businesses' profiles count as "saved" in the Halfway/Active shortcuts' sense only once the step is done)*.
- **Save:** stores the answers, ticks the tax step, adds one history line ("You changed your tax details", with the date), and returns to where the page was opened from (homepage or Settings).

**Settings history** *(my call, approved as "in the background")*: the business gains its own history list. Saving tax details, connecting a bank (one line per account), renewing a connection and adding a cash box each add a line (keys with texts in the three languages, ready to show later). There is no list on screen in this mockup.

**What the answers change** *(my calls on the details)*:
- *Kleinunternehmer*: VAT shows "no VAT" everywhere (`vatRateShown`), the category picker offers revenue without VAT (`categoriesFor`), and the homepage VAT return card shows the Kleinunternehmer line instead of a due date. Switching back restores it. Existing bookings stay as they are. The stored revenue-limit notice (Sara Weber Yoga) shows only while the business is a Kleinunternehmer; no new revenue-limit notice is calculated, and the revenue tracker shows whatever share the sample revenue gives, above 100 % included *(my call)*.
- *VAT return period and extension*: the homepage VAT return card's due date follows them from the demo date — monthly: 10 Nov 2026 (10 Dec with the extension); quarterly: 10 Jan 2027 (10 Feb with the extension); once a year: no monthly or quarterly date, a line "Yearly VAT return only" and no amount. The amount is the business's sample amount; a business with none (Sara Weber Yoga switched to VAT) shows the date with "Amount not known yet" *(my call)*.
- The other answers are shown in Settings but change nothing else in the mockup.

## Connect your bank

Route `/settings/bank/connect`, one flow in four screens (the step is page state, not separate routes). Reached from the setup step, from Payments' "Connect your bank" (new client), and from Settings › **+ Connect a bank**.

1. **Pick your bank:** "Connect your bank — your payments then come in by themselves.", a search box, a grid of about twelve common German banks (Sparkasse, Volksbank, ING, DKB, N26, Qonto, Kontist, Deutsche Bank, Commerzbank, Postbank, HypoVereinsbank, Revolut) as initials tiles. Under the grid: **My bank isn't listed** (import a statement — coming soon) and **I also take cash** (adds a cash box account if the business has none, then shows it in Settings; no bank flow).
2. **What we can see:** "Connect <bank>", *We can*: see your payments and balance, fetch new payments every day; *We can't*: move money or make transfers, see your bank password. "You sign in on <bank>'s own page. Your bank asks you to renew this every 180 days; we remind you in time." **Continue to <bank>**.
3. **Bank sign-in, simulated:** a clearly marked demo screen ("DEMO · no real bank, no password"): the bank's tile, "Bookkeeping app wants to read your payments and balance.", **Approve** · **Cancel**. Cancel goes back to step 1.
4. **Choose accounts:** "Which accounts are for the business?" Each found account with name, masked IBAN (`DE89 … 4321`), balance and a tick; the business account is ticked, savings and credit card are not. Each ticked account has "Fetch payments from <date>" (default 1 January of the current year). "Private accounts stay out: leave them unticked." **Connect N accounts**, then "Fetching payments…" for about two seconds, then back to where the flow started, with the bank step ticked.

**Which accounts the demo finds** *(my calls)*: each sample business banks with its sample banks (Weber Design: Qonto; Café Linde: Qonto and Sparkasse; Sara Weber Yoga: Qonto). Picking one of them finds its sample business account plus a sample savings account and credit card. Picking any other bank shows, on the sign-in screen, "Demo: this business banks with Qonto, so Qonto's accounts are shown." and continues with those.
- An account that is already connected shows ticked and greyed with "Already connected"; connecting again doesn't renew it (Renew does that).
- Every account the flow connects gets a consent of 180 days from the demo date and "last fetched just now".
- A sample business account left unticked is not connected: it shows in Settings as *Statement import*, and its sample payments stay (as if imported earlier).
- Ticked savings and credit-card accounts become accounts of the business with no payments: they show in Settings, in the homepage balances card and in Payments' account filter.
- "Fetch payments from" offers 1 January this year, 1 January last year and today; it is shown and stored but filters nothing in the mockup (the sample payments all fall in this year).
- "I also take cash" shows only when the business has no cash box; it adds one without going through the bank flow and does not count as the bank step. A cash box shows in Settings whether or not the bank step is done.

## Settings

Route `/settings`; the menu's Settings item opens it (instead of "coming soon"). Three sections as cards, stacked on a phone:

**Business and tax:** the saved answers in plain words, each with its German term (kind of business, VAT and return period, VAT due, tax number with its tax office, VAT ID, financial year), and **Edit** → `/settings/tax`. Before the tax step is done: a short line and a button "Add your tax details".

**Bank accounts:** **+ Connect a bank**, then one row per money account: initials tile, bank and account name, masked IBAN or "Payments come from your receipts" (cash), the last fetch ("last fetched today, 06:12") for a connected account, a status word and its button:

| Status | When | Colour | Button |
| --- | --- | --- | --- |
| Connected | Consent runs more than 14 days | positive | — |
| Renew in N days | Consent ends within 14 days | warning | **Renew** |
| Sign in again | Consent ended or the connection broke | negative | **Sign in again** |
| Statement import | An account with no connection | muted | **Import statement** (coming soon) |
| Cash | The cash box | muted | — |

**Renew** and **Sign in again** run screen 3 (the simulated approval) for that bank only, then set the consent to 180 days from the demo date, the last fetch to "just now" and the status to *Connected*. Before the bank step is done: a short line and **Connect your bank**, with the cash box (if any) listed under it.

**Documents inbox:** "Forward receipts and invoices to <address>" with **Copy** (the existing copy button), and "We work out whether each one is received or sent."

## Notices

The homepage's **bank connection** notice ("Your Qonto connection expires in 5 days") is calculated from the accounts instead of stored: one notice per connected account whose consent ends within 14 days, with the days left, and one "Your <bank> connection has ended — sign in again" per account whose consent ended or whose connection broke. Its button opens Settings › Bank accounts. It disappears after renewing or signing in again. The stored bank-expiry sample notices go; the other notices stay as they are.

## Sample data

- Each money account gains its connection: kind (`connected` · `statement` · `cash`), consent end date, last fetch time and a "broken" mark for connected ones. So the demo shows every status *(my calls)*:
  - Weber Design: Qonto *Renew in 5 days* (consent ends 27 Oct 2026, as the current notice says), cash box.
  - Café Linde: Qonto *Connected* (about 4 months left), Sparkasse *Statement import* (its stored expiry notice goes), cash box.
  - Sara Weber Yoga: Qonto *Sign in again* (consent ended 20 Oct 2026), so its homepage shows the "sign in again" notice.
- Each business's tax profile gains the new answers: Weber Design — freelance, VAT, monthly, no extension, Ist, a made-up Berlin tax number; Sara Weber Yoga — freelance, Kleinunternehmer; Café Linde — trade, VAT, quarterly, Soll *(answers my call)*. A small table maps sample states + tax-office numbers to tax-office names.
- A bank list of about twelve names for the picker.
- Made-up numbers only.

## Languages

New text in all three files. New terms with their German original and a short explanation: Freiberufler, Gewerbe, Umsatzsteuer-Voranmeldung (UStVA), Dauerfristverlängerung, Ist-Versteuerung, Soll-Versteuerung, Steuernummer, USt-IdNr., Finanzamt (Kleinunternehmer exists). Arabic mirrors the flow's back arrows and the Settings rows.

## Approved mockups

The three screens the owner approved are kept as reference in `.superpowers/brainstorm/19967-1792698879/content/` of the main checkout (`tax-step.html`, option A; `bank-flow.html`; `settings-page.html`). That folder isn't in git, so this document is the binding description; where the mockups and this document differ (sample accounts, the "Sign in again" example), this document wins.

## Left to the builder

- How the three setup flags replace `SetupState` in `DemoStateService` and in every reader, as long as the three shortcut states behave as today.
- The sample tax-number formats per state and the tax-office table (a few states and offices are enough; Berlin must work).
- How the bank flow keeps its step (component state is fine) and where it returns to.
- Initials-tile colours (from the project tokens), the exact wording of messages, and the animation of "Fetching payments…".
- Whether the tax page and Settings share one component for the Business and tax answers.
