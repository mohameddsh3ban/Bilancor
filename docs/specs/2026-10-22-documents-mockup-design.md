# Documents page — clickable mockup (design)

Oct 22, 2026 · Status: draft for approval

## Intent

Documents is where a client's receipts and invoices live. Clients come here to **add documents with as little effort as possible** and to **clear the few that need them**. Otherwise they rarely browse; they come back when a tax advisor or the tax office asks for one *(my guess, agreed in conversation)*.

Bilancor's document pages (studied Oct 22, 2026, see the [product spec](../bookkeeping-portal-spec.md#document-pages)) are BuchhaltungsButler underneath: folders per bank account, an upload window that makes the client choose incoming or outgoing, a status shown only as an icon, "recognition incomplete" with no reason, and a detail view with four bookkeeping steps. In the studied account this led to the client's own sales invoices being filed as supplier invoices, even though the issuer and recipient had been read correctly. Ours works out the direction itself, says what is wrong in plain words with the fix next to it, and ties each document to its payment.

Like the [Payments mockup](2026-10-22-payments-mockup-design.md), this is a **clickable mockup with sample data** in the real frontend stack (`web/`), not the working product.

**Build order:** after the Payments mockup is committed, because this work changes Payments code and shared files (routes, menu, translations, sample data, demo state).

## Goals

- A Documents list on phone (primary) and computer, in English, German and Arabic (right-to-left).
- A **Needs you** box at the top of the list: each document that needs the client, with what's wrong and its fix right there.
- One document's details: full screen on a phone, a side panel next to the list on a computer.
- Simulated adding of documents: photo, file, and the email address to forward to.
- Linking a document to its payment, from either side, updates both pages: the document becomes *Done*, the payment's *Receipt missing* goes away. Payments' **Pick from Documents** becomes real.
- The homepage's document links and counts become real.

## Non-goals

- No backend, real reading of documents (OCR), real file storage or real email inbox. Uploads get a ready-made result from the sample data.
- No Dropbox, supplier-portal fetching (GetMyInvoices and the like) or API.
- No downloading the original file, and no print view.
- Stays "coming soon": *Paid in cash or privately* (creating a payment from a document), self-issued receipts (Eigenbeleg), the homepage decisions Start button.
- No bulk selection, no paging (the list scrolls), no saved filters.

## Anti-goals

- Making the client choose incoming or outgoing when uploading.
- Folders per bank account.
- A status shown only as an icon, or a problem without a reason ("recognition incomplete"). Every status has a word; every problem says what's wrong and how to fix it.
- Changes that save without a trace: every change adds a history line (GoBD).
- Bookkeeper features: supplier/customer accounts (Kreditor/Debitor), payment reminders, open-items (OP) and booking-account filters, tasks and comments, pay and direct-debit buttons.
- Copying Bilancor's or BuchhaltungsButler's design, wording or code; using real names, amounts or details from the studied account.

## Constraints

Everything from the homepage and Payments mockups still applies: Angular 22, Tailwind CSS 4, spartan/ui, Transloco; the colour convention in `web/README.md`; logical (left/right-free) layout so Arabic mirrors; amounts, IBANs and invoice numbers in `<bdi dir="ltr">`; Western digits in Arabic; German tax terms visible next to translations; all text in `web/public/i18n/{en,de,ar}.json` with the same keys; storage only through `SafeStorage`; phone first, computer layout from Tailwind `lg`; the shared `money` and `date` pipes; the fixed demo date of 22 Oct 2026.

## Directions: Received and Sent

Every document is either **Received** (a bill or receipt from someone else; German *Eingangsbeleg*) or **Sent** (an invoice the client issued; *Ausgangsbeleg*). The direction is never asked at upload. It follows from who issued it: the client's own business as issuer means *Sent*, anyone else means *Received*. When the issuer can't be told, the document asks (see Needs you). In the detail view a short note says why: "We set *Sent* because the invoice comes from your business." The client can change it with Edit.

## Statuses

Each document shows one status, as a word with a colour. Like Payments, the status isn't stored; it follows from the document's state, checked in this order *(my call)*:

| Order | Status | When | Colour |
| --- | --- | --- | --- |
| 1 | Reading… | Just added, for a moment | muted |
| 2 | Possible duplicate | It looks like a document already there | warning |
| 3 | Received or sent? | We couldn't tell the direction | warning |
| 4 | Check <field> | A field couldn't be read (amount, date or name) | warning |
| 5 | Waiting for payment | Read and fine, not linked to a payment yet; shows the due date ("due 30 Oct") when there is one | muted |
| 5b | Overdue | Waiting for payment and the due date has passed ("Overdue since 30 Sep") | negative |
| 6 | Done | Linked to a payment | positive |

Statuses 2–4 are **Needs you**. A duplicate is checked first because fixing anything else on a duplicate is wasted work; fixing one problem reveals the next, as on Payments.

## The list

Route `/documents`. The menu's Documents item opens it (instead of "coming soon").

**Top of the page:**
- Title "Documents" and an **+ Add** button.
- Under the title, one line: "Or forward receipts to <address>" with a Copy button. The address is made up per sample business.
- **Needs you · <count>** box: one card per document with statuses 2–4. Each card names the document (name, or file name if no name was read; plus date or amount), says what's wrong in one sentence, and shows its fix:

| Problem | Sentence | Fix on the card |
| --- | --- | --- |
| Possible duplicate | "Looks like the one you added on 17 Oct." | **Keep both** · **Remove** |
| Received or sent? | "Is this a bill you received or an invoice you sent?" | **Received** · **Sent** |
| Check amount / date / name | "We couldn't read the amount." | **Type it in** (opens the document with the field ready) |

  Fixing a card removes it (or turns it into its next problem). When the box is empty it disappears.
- **Search**: name, amount (typed as on Payments: `120`, `120,00`, `120.00`) and invoice number.

**The list:** every document not in the Needs you box, grouped by month (document date), newest first.
- Phone: one row per document: small placeholder thumbnail, name (`dir="auto"`, truncates), "Received · 20 Oct" or "Sent · 2026-031", status word, amount (gross, no sign, not coloured).
- Computer: a table: date, name, Received/Sent, status, amount. The whole row opens the document in a panel on the end side, with the row highlighted, as on Payments.
- **Empty search** says so and offers to clear the search.

**Setup states** *(my call)*: the sample documents follow Payments. In "new client" (no bank, no payments) the page shows an empty state with the three ways to add a document. In "halfway" and "active" the sample documents show, since Payments already shows their payments with receipts attached. Documents the client adds show in every state; in "new client" there are no payments to link them to, so they stay *Waiting for payment*. Adding a document doesn't change the setup state; the demo toolbar alone sets it.

## One document

Route `/documents/:id`. Phone: full screen with a back link to the list. Computer: panel beside the list.

From top to bottom:
1. **Scan:** a placeholder "paper" drawn from the document's data (no real image). When a field couldn't be read, its spot on the paper is marked, and the field to fill in sits right under the scan.
2. **Header:** name, "Received" or "Invoice you sent", invoice number, amount.
3. **Three steps:** *Read · Booked · Paid* (for a sent invoice the last reads *Waiting for payment* until linked). Done steps get a tick, the current one is highlighted. *Read* is done when no field is missing; *Booked* when the booking has a category and is confirmed (otherwise it reads *Confirm*, and the Booking section shows the same **Confirm** button as Payments); *Paid* when linked.
4. **What we read**, with **Edit**: type (Received / Sent, with the German term), from → to, invoice number, date, amount with VAT rate and VAT amount ("no VAT" for a Kleinunternehmer's sent invoices), due date. Plus the one-line note on why we chose the direction. Saving an edit adds a history line; fixing a field that couldn't be read clears that problem.
5. **Booking**, with **Change**: category in the user's language with the SKR03 number and German name, the same picker as Payments.
6. **Payment:**
   - Not linked: "No payment yet. These might be it:" with up to three suggested payments (counterparty, amount, date, account, reference) and **This one** on each. Below: "Search all payments" (opens the same picker with every unlinked payment of the matching direction) and "Paid in cash or privately" (coming soon).
   - Linked: the payment (counterparty, amount, date, account) linking to it in Payments, and **Not this payment** to undo the link.
7. **History:** newest first, e.g. "16 Oct · Added by email", "16 Oct · Read automatically, booked as Revenue 19 %", "22 Oct · You linked the payment from Müller GmbH".

**Remove** (on a duplicate's card, and in the detail of a document not linked to a payment) takes the document out of the list. A linked document can't be removed; unlink it first *(my call; a real version follows GoBD retention rules)*.

## One booking per document and payment

The product's first clients file an EÜR, so a document and its payment are booked once, together *(my call; to be confirmed with a tax advisor before the real product)*:
- Before linking, the document's category is a prepared booking. A category read automatically is not confirmed; one the client chose with **Change** counts as confirmed, as on Payments.
- When linked: if the payment has no category yet, it takes the document's, with its confirmation. If the payment already has one, the payment's stays.
- After linking, the document's Booking section shows the payment's booking, and **Change** or **Confirm** in either place changes that one booking.
- *Done* means linked. A linked document whose booking isn't confirmed is still *Done*; the open confirmation is counted once, on the payment (its *Confirm* status).
- Linking saves the payment's booking and confirmation as they were (like the existing `beforePrivate`). **Not this payment** restores them on the payment; the document keeps the booking the pair had at that moment as its prepared booking.

## Linking documents and payments

| Where | Action | Effect |
| --- | --- | --- |
| Document | **This one** on a suggested payment, or a payment picked from the search | Document → *Done*. Payment: receipt attached (the document's file name), booking as above, status follows the Payments rule. History lines on both. |
| Payment (Receipt section) | **Pick from Documents** | Opens a picker of unlinked documents of the matching direction (money out → Received, money in → Sent), best matches first. Choosing one has the same effect. |
| Document | **Not this payment** | Unlinks: the payment's receipt is *missing* again and the document is back to *Waiting for payment*. History lines on both. |

**Suggestions** *(my call)*: unlinked payments of the matching direction, ranked by amount (equal first), then name similarity, then closeness of date. At most three.

**Private payments** *(my call)*: a payment linked to a document can't be switched to *Private*; the switch says "This payment has a document. Unlink it first." A private payment needs no receipt, so a linked business document and a private payment would contradict each other.

**Automatic linking:** as in the product spec, matching is automatic and only unsure cases need the client. When an added document matches a *Receipt missing* payment for certain, it links itself as soon as reading finishes, with history lines on both ("Linked automatically"). Documents with only likely matches wait with their suggestions.

## Adding documents

- **Phone:** **+ Add** opens a sheet with *Take a photo* ("several pages become one document"), *Choose a file* ("PDF, JPG, PNG or e-invoice (XML), up to 20 MB") and *Forward by email* (address + Copy).
- **Computer:** dropping files anywhere on the page shows "Drop to add N files"; **+ Add** offers *Choose a file* and the email address.
- The menu's **Upload receipt** item (sidebar and phone bottom bar) and the homepage setup step "Upload your first receipt" lead here with the Add choices open.

**What happens (simulated):** each chosen file becomes a document named after the file, shows *Reading…* for about two seconds, then takes the next ready-made result from a small per-business pool in the sample data, in this order for Weber Design: the receipt for its *Receipt missing* payment that has no document (links automatically, see above), a duplicate of an existing document, one that needs the direction, then plain Received receipts waiting for payment. When the pool runs out it starts again with plain receipts. A photo works like choosing an image. Files over 20 MB or of another type are refused with a message. A short message sums up: "3 documents added · 1 needs you". Taking a photo with several pages and a real email arriving are not simulated.

## Homepage and Payments changes

- **Menu:** Documents and Upload receipt open the real page.
- **Decisions count** on the homepage ("3 things need your decision") counts payments that aren't *Booked* **plus** documents in Needs you *(my call)*.
- **"Receipts that could not be read" notice:** its count is calculated from documents with a *Check <field>* problem, and **Fix** opens Documents. It disappears at 0.
- **Payments:** *Pick from Documents* opens the picker above instead of "coming soon". *Take a photo* and *Self-issued receipt* stay coming soon.

## Sample data

- Every payment that has a receipt attached gets a matching document, linked and *Done*.
- Per sample business, added on top *(numbers my call, kept small so the homepage count grows little)*:
  - Weber Design: one document with an unreadable amount (the only Needs-you document at the start; the duplicate and the direction question come from uploads); two sent invoices waiting for payment, one overdue; one new *Receipt missing* payment with an unlinked document that matches it, which can be linked from either page. The existing *Receipt missing* payment (`wd-t3`) keeps no document; the first upload links to it automatically. The homepage count goes from 3 to 5 (four payments + one document). Existing payments `wd-t1`–`wd-t6` keep their statuses.
  - Sara Weber Yoga: one unlinked document that matches its existing *Receipt missing* payment; no Needs-you document, so its count stays as it is.
  - Café Linde: everything linked and *Done* (it keeps "nothing needs you").
- Each document: id, name (issuer for Received, recipient for Sent), direction, invoice number, date, due date (optional), amount, VAT rate, file name, how it was added (photo / file / email), problem fields, prepared booking, linked payment id, history.
- Made-up names and amounts only.

## Languages

New text in all three files, with the German terms *Eingangsbeleg* / *Ausgangsbeleg* next to Received / Sent in the detail view. SKR03 names stay German. Arabic mirrors the panel, the back arrow and the Needs-you cards.

## Left to the builder

- How the documents live in the demo state next to the payments, as long as both pages read the same live data and Reset demo restores both.
- The form of the Add sheet, the payment picker and the document picker within spartan/ui.
- How "Upload receipt" opens the Add choices (query parameter, state in a service, or similar).
- How the placeholder paper is drawn, and its marked spot.
- The exact wording of messages and empty states, the ready-made upload results, and how duplicates and name similarity are matched in the sample data.
