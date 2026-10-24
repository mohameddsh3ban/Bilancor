# Statement import, self-issued receipts, and cash or own-money payments — clickable mockup (design)

Oct 24, 2026 · Status: ready for approval

## Intent

Three Phase 1 pieces from the [product spec](../bookkeeping-portal-spec.md) still lead to "coming soon":
- **Bank statement import:** the fallback when a bank can't be connected ("Bank connection via Open Banking, with CSV import as a fallback").
- **Self-issued receipts:** for a lost or never-given receipt ("a 'no document needed' mark and self-issued receipts").
- **Paid in cash or with your own money:** for a receipt with no payment in the business account.

Without them, a client with an unsupported bank, a lost taxi slip or a receipt paid with a private card can't get their books complete, and there is no bookkeeper to do it for them.

Like the earlier pages, this is a **clickable mockup with sample data** in `web/`. The owner approved a sketch (`.superpowers/brainstorm/…/phase1-gaps-proposal.html`: import, self-issued receipt, paid in cash or own money) and both playbacks ("nothing wrong or missing", "all good").

**Research (Oct 24, 2026, public pages only; Bilancor's account not touched):**

- **German rules:**
  - **Self-issued receipt (Eigenbeleg):**
    - It is only for when no third-party receipt exists or can be obtained (GoBD). Ask the seller for a copy first.
    - Usual contents: who was paid, what for, payment date, amount, why there is no original, issue date, who issued it.
    - There is no statutory maximum. Rules of thumb are about €150 (Lexware) to €250 (sevDesk), and larger or frequent ones draw scrutiny.
    - **No input VAT** (§ 15 UStG needs a proper invoice).
  - **Business costs paid with private money:** they are recorded as an owner's deposit (Privateinlage, SKR03 1890). This is not income, and the cost still counts in the EÜR.
  - **Cash book:** an EÜR freelancer needs no formal cash book, but cash payments should be recorded promptly.
  - **Statement files:**
    - German banks moved to **CAMT.053** (ISO 20022 XML), and MT940 was dropped from late 2025.
    - **CSV has no standard.** Each bank has its own columns, separator (`;` or `,`), character set (ISO-8859-1, cp1252 or UTF-8) and lines above the table. Examples: Sparkasse "CSV-CAMT", DKB, ING, N26, Qonto.
    - Keep the original file.
- **Competitors (BuchhaltungsButler, sevDesk, Lexware Office):**
  - **Import:** CSV only, with columns matched by hand (Lexware remembers the layout). None of them checks for payments that are already there, so duplicates get in and are deleted (or hidden) by hand. There is no undo. A live bank connection usually fetches only about 60–90 days back.
  - **Self-issued receipt:** only BuchhaltungsButler has one built in. It sits on the payment, is prefilled, has a reason list, can't be edited afterwards, and gives a hint above €250. sevDesk and Lexware offer printable templates.
  - **Cash and private:** sevDesk and Lexware let you mark a receipt as paid from the cash box or privately. BuchhaltungsButler's "receipt creates payment" accounts exist, but its help warns about them.

## Goals

- **Statement import** that recognises common German banks and CAMT on its own, skips payments already in the app, and feeds imported payments into the same automatic matching and review inbox as bank-connected ones. It is undoable until its payments are worked on. Phone and computer, EN/DE/AR, Arabic right-to-left.
- **Self-issued receipt** on a payment with a missing receipt: one prefilled screen that creates a numbered, printable German receipt linked to the payment, with honest notes about VAT and larger amounts.
- **"Paid in cash or with my own money"** on a received receipt with no payment: one choice, and the cost counts for taxes.

## Non-goals

- Reading real bank files. The mockup uses sample statement files, the way adding documents uses a sample pool today. Real parsing of CSV and CAMT comes with the backend. *(Owner saw this as my guess, with no objection.)*
- MT940, PDF statements, foreign currencies, credit-card statements.
- Bank balance or cash-box balance tracking (balances don't move in the demo, as with Invoices' "Mark as paid"), cash counts, or a cash-book report.
- A self-issued receipt for money coming in, or for sent invoices.
- Editing a self-issued receipt after it's created.

## Anti-goals

- **Duplicates slipping in** when a statement overlaps payments already in the app.
- **A wall of column settings before anything happens.** Matching columns by hand appears only for an unknown layout.
- **A self-issued receipt that quietly claims VAT,** or that is offered as the first choice while getting a real copy is still possible.
- **Accounting jargon as the question:** the client chooses "cash box" or "my own money", not "Privateinlage". The German term only appears as an explanation.
- Copying Bilancor's or competitors' design, wording or code.

## Constraints

Everything from the earlier mockups applies:
- Angular 22 (standalone, zoneless, signals), Tailwind 4, spartan/ui (helm in `web/libs/ui`, including dialog and dropdown menu), Transloco.
- Colour tokens and logical layout; `<bdi dir="ltr">` for amounts, IBANs and numbers; Western digits in Arabic.
- All UI text in `web/public/i18n/{en,de,ar}.json`; the `money`/`appDate` pipes; `<app-term>` for German terms.
- `DEMO_TODAY` = 22 Oct 2026; storage only through `SafeStorage`.
- Phone first, computer from `lg`. New pages are lazy-loaded (the initial bundle is near its 650 kB warning).

Reuse what exists rather than writing new versions:
- the statement-account kind and the cash box (`addCashBox`);
- `DemoStateService` and its `link`, `addTransaction`, `addDocument`;
- document and invoice matching (`documentCandidates`, `invoiceMatch`, `linkInvoicePayment`);
- the review inbox, the dialog card, `printOnceRendered` and the invoice paper style;
- the Documents upload pool pattern for sample files.

**Build order:** after the Reports page (being built in another session) is merged, because both touch Payments, Settings and the shared translation files.

**Closed months** (from the approved Reports design: "Only Reports and Payments respect a closed month", the owner's decision):
- **Statement import (Payments and Settings):**
  - A row dated in a closed month is not imported. It is listed in its own group, "In a closed month, not imported" *(my call)*.
  - An import can't be undone once any of its payments is in a month that has since been closed.
- **Payment detail:** a payment in a closed month has no actions, so it has no "Write a self-issued receipt" either.
- **Review inbox and Documents:** they don't check closed months, so a self-issued receipt from the inbox and a cash or own-money payment from Documents behave as Invoices' "Mark as paid" does. In practice a closed month has no payment with a missing receipt, because closing requires every receipt.
- **Sample data:** the sample statements avoid closed months.

## 1. Bank statement import

### Ways in

- **Payments:** an "Import statement" action in the toolbar (in a ⋯ menu on a phone). It asks which account first: an existing statement account, a connected account ("Add older months"), or "A new account…".
- **Settings › bank accounts:** "Import statement" on each statement account, replacing today's "coming soon".
- **Connect a bank › "My bank isn't listed":** asks for the account's name (e.g. "Volksbank") and IBAN, creates a statement account, then opens the import. This replaces "coming soon".

### The import screen (one screen, top to bottom)

1. **Account:** "Into: Sparkasse · business account".
2. **The file:** a drop zone, "Drop the file from your online banking here", or choose a file. In the mockup any file, or **Use a sample statement**, takes the sample statement made for the chosen account *(my calls)*:
   - Each sample statement belongs to one account.
   - An account with no sample of its own (for example one made during the visit) gets a generic statement of a few October payments, the same ones the demo bank connection would bring. Connecting that bank later then shows them as "Already here, skipped".
   - Once an account's samples are used, the last one can be imported again, and everything shows as already here.
   - Importing a statement doesn't need a working bank connection, so an ended connection can still take one.
3. **We read it:**
   - The recognised format as a chip: "Recognised: Sparkasse CSV", "Recognised: CAMT (bank standard)", or "Unknown layout".
   - The number of payments in the file and its date range.
   - **New** and **Already here, skipped** counts. "See which" lists the skipped ones with the existing payment they match.
4. **First rows:** a few payments as they will appear (name, date, signed amount).
5. **Unknown layout only:** "Match the columns". The first rows are shown with a choice above each column: Date / Amount / Who / What for / Ignore. Each is guessed first, and there is a "Money out is shown as" choice (minus sign / separate column). Everything else is skipped. *(One sample statement per demo uses an unknown layout.)*
   - **It really works on the sample's raw cells *(my call)*:** changing a column's meaning or the sign rule updates the preview.
   - It reads German dates (`dd.mm.yyyy`) and amounts with decimal commas.
   - Import stays disabled until Date, Amount and Who are matched.
6. **Import N payments** as the main button. It shows "Importing…" briefly, then a summary.

### Duplicates *(my call)*

A row counts as already here when the same account has a payment on the same date with the same amount and the same name or reference. Those rows are skipped and shown as "Already here, skipped". This is the app's main advantage over competitors here.

### After importing

- The new payments are booked like bank-connected ones:
  - a category is guessed from earlier payments and the learned rules;
  - documents are matched where certain;
  - invoices whose number is in the payment text turn Paid (and part payments add up);
  - everything else goes to the review inbox.
- **How "booked automatically" works in the mockup *(my call)*:**
  - Each sample row carries its category, whether it's confirmed, and whether it needs a receipt (bank fees, wages, insurance and standing-order rent need none), as the demo bank connection's payments do.
  - The app then runs its existing matching: learned category rules, certain document matches, and invoice matches.
  - No new guessing engine.
  - A bank-fees category is added (SKR03 4970, Nebenkosten des Geldverkehrs, 0 % VAT).
- **Bank step:** finishing an import ticks the setup's bank step, as a bank connection does. Cash and own money don't tick it.
- **Summary:** "42 added · 30 booked automatically · 12 need you", with **Start** opening the review inbox and **See the payments** opening Payments filtered to this account.
- The homepage counts, Taxes and the year figures follow, because they are calculated from the payments.
- **Original file kept *(my call)*:** the account remembers each import (file name, date, number of payments). The original file stays with it, so it can be downloaded again.

### Imports list and undo

- **Where the list lives *(my call)*:** there is no separate account page. Any account that has imports, whether a statement account, a connected account with older months added, or one made from Payments, gets an expandable **Imports** area under its row in Settings › bank accounts. It lists: "24 Oct · sparkasse-jul-oct.csv · 12 payments".
- **Undo right away:** the summary screen offers **Undo import** too, straight after importing.
- Each import has **Undo import** until any of its payments has been answered, linked or changed. After that the line reads "Can't be undone: some payments were worked on".
- Undo removes that import's payments and their automatic links.

## 2. Self-issued receipt (Eigenbeleg)

### Ways in

- **Payment detail:** "Write a self-issued receipt" on a money-out payment with a missing receipt, replacing today's "coming soon".
- **Review inbox:** on the "receipt missing" card for money out, a small link "Receipt lost? Write one yourself" below the answers. It opens the same screen on top of the card, and saving answers the card ("Self-issued receipt added").

### The screen (one screen)

- **Title and payment:** "Self-issued receipt (Eigenbeleg)", the payment's name, date and amount (fixed, from the payment).
- **What was it for?** A text field, prefilled from the payment's category and reference where possible.
- **Why is there no receipt?** It got lost / The machine gave none / It was a tip / The seller gave none / Something else… (a text field). This one is required.
- **Paid to:** the payment's name. An optional address field appears for amounts above €150.
- **Notes, shown when they apply:**
  - Always: "No VAT can be claimed back with a self-issued receipt, so this payment's VAT won't count." This is shown when the payment's category has VAT.
  - Above €150: "For larger amounts, ask the seller for a copy first; tax offices question larger self-issued receipts more often." It is a note, not a block.
- **Confirmation:** a required tick, "I confirm this is true", with the signed-in person's name and today's date. This replaces a signature *(my call; sources differ on whether a digital confirmation is enough, so the README notes it)*.
- **Main button:** "Create receipt". Cancel leaves everything as it was.

### What it creates

- **A numbered receipt:**
  - Numbered EB-2026-001, EB-2026-002 and so on, per business and year, gap-free.
  - Written in German *(my call: it's for the tax office)*, with every field above plus the issue date and who confirmed it.
  - It has a print view like the invoices.
  - It is saved to **Documents** as a received document marked "Self-issued", linked to the payment, and locked like an invoice's document.
- **The payment:**
  - The receipt is attached and the payment counts as booked.
  - Its category stays, but **with 0 % VAT**, with a history line "VAT removed: self-issued receipt". Taxes and the year figures follow.
- **Mistakes:** the review inbox's Undo takes it back within the usual window, and so does a 5-second Undo on the payment page. A created receipt can't be edited or removed later *(my call: GoBD, like sent invoices)*.
- **The 0 % VAT stays *(my call, anti-goal "never quietly claims VAT")*:**
  - Changing the category of a payment with a self-issued receipt keeps its VAT at 0 %.
  - A learned category rule still uses the category's normal VAT for other payments.
- **A real receipt that turns up later:** it can't be linked, because the payment already has a receipt. Its document page says "This payment already has a self-issued receipt". Replacing a self-issued receipt is not in this version.

## 3. Paid in cash or with your own money

### Ways in

- **Documents:** a received receipt that is waiting for a payment shows **Paid in cash or with my own money** in place of today's "coming soon".
- A sent invoice keeps Invoices' "Mark as paid".

### The choice (a small dialog)

- **How was it paid?**
  - In cash, from the cash box.
  - With my own money (private card or cash).
- **Paid on:** defaults to the receipt's date; any day from the receipt's date to today.
- **Main button:** "Done".

### What it creates

- **Cash box:** a money-out payment of the receipt's amount in the **Cash box** (created if the business has none), linked to the receipt and booked with the receipt's category and VAT. It counts for VAT and the year figures like any payment.
- **Own money:**
  - The same payment goes into a new account **Own money**, created when first needed. It is a kind of account that isn't a bank: "Money you paid for the business privately".
  - It is linked and booked the same way, and the receipt's VAT counts *(a proper invoice still allows the VAT, whoever paid it)*.
  - The account's explanation names the German term: owner's deposit (Privateinlage).
  - In Payments, "Own money" is an account you can filter by.
- **Locked *(my call)*:** a payment created this way is locked to its receipt, like an invoice payment. The receipt page offers a 5-second Undo right after "Done", and there is no review-inbox card for this.

## Sample data *(my calls)*

**Statement imports.** Each sample business gets one or two sample statement files. Each demo shows new payments, skipped duplicates and an automatic booking. One file has an unknown layout.
- **Café Linde GbR:** a Sparkasse CSV for October. Some of its payments are already in the app, such as the rent and utilities on the Sparkasse account, and are skipped. The new ones include bank fees and a supplier payment.
  - July–September aren't closed for Café, but its Q3 VAT return is overdue and still to be sent, so October keeps the figures steady.
- **Weber Design:** a CAMT file for "My bank isn't listed", for a new "Volksbank" account with a few October payments, one of which matches an open receipt.
- **Sara Weber Yoga:** an unknown-layout CSV for her Qonto account with October payments (her August is closed), to show matching columns.
- **No double counting:** sample statements contain only payments in open months after each business's first sample payment, so the year's opening line and closed months are never touched.

**Self-issued receipt.** A new Weber payment is the demo: "APCOA Parking", 20 Oct, −€6.50, office/travel category, receipt missing ("The machine gave none").
- Weber's Deutsche Bahn payment stays the first Documents upload demo, which links a real receipt to it, so the two demos don't collide.
- Sara's Kiezdruck flyer payment keeps its matching receipt.

**Cash and own money.** Two new received receipts with no payment:
- Weber: "Copyshop Kreuzberg", 19 Oct, €18.50, office supplies, paid in cash.
- Sara: "Yogamatten-Shop", 12 Oct, €89.00, supplies, paid with her own money (no VAT, Kleinunternehmer).

**Counts.** Existing tests keep their meaning. Counts that change because of the new documents are updated deliberately.

## Languages

- **App text:** in all three files.
- **The receipt itself:** German only, laid out left-to-right in every language.
- **German terms via `<app-term>`:** Eigenbeleg, Privateinlage, Kasse (cash box), CAMT, Kontoauszug (bank statement).

## Left to the builder

- The data shape: imports on the account; a self-issued receipt as a document with extra fields; the "Own money" account kind.
- The sample statement files' exact rows and how they are stored.
- Where "Import statement" sits on the computer layout of Payments.
- Exact wording.
