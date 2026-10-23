# Bookkeeping app mockup (web)

Clickable Angular mockup of the bookkeeping app: the homepage, the Payments page, the Documents page, the Invoices page, the review inbox, the setup steps with Settings, and the Taxes page with its tax reminder (en / de / ar). No backend.
All data is sample data in `src/app/data/sample-data.ts`.

## Install

Needs Node.js (LTS). From this `web/` folder:

```sh
npm install
```

## Commands

- `npm start` (or `npx ng serve`) — dev server at `http://localhost:4200`
- `npx ng test --watch=false` — unit tests (Vitest)
- `npx ng build` — production build (output in `dist/`)

## Open on a phone (same Wi-Fi)

1. On the computer, run `npm run serve:lan`. This serves the app on all network interfaces. Only run `serve:lan` on a trusted network: it opens the dev server to everyone on that Wi-Fi.
2. Find the computer's IPv4 address: run `ipconfig` and look for the Wi-Fi adapter's "IPv4 Address".
3. On the phone, open `http://<computer-ip>:4200` (for example `http://192.168.x.x:4200`). The phone must be on the same Wi-Fi.

Windows may ask to allow Node.js on private networks; allow it so your phone can connect.

## Demo toolbar

The strip at the top of every page is demo-only:

- **Setup state** (New client / Halfway / Active client) is a shortcut for the **open business only**: it sets that business's three setup steps (none / bank only / all three) and nothing else. Connected accounts, tax answers and documents stay as they are. The choice that matches the business's steps is highlighted, and none is when the steps are mixed. In "New client" no bank is connected yet, so Payments has no list.
- **Business switcher** (in the top bar) changes which business is open.
- **Reset demo** brings back every notice you dismissed and the sample payments, documents, bank accounts and tax answers, puts every business back to Active client, forgets what the review inbox learned (dismissals are remembered in the browser until you reset), and brings back the tax reminder, the VAT returns sent from Taxes, the sample invoices with their numbers, the payments they made and the invoice details.

## Payments

The Payments page (`/payments`) opens from the menu (on a phone, from the bottom bar) and from the homepage's "See all" and its transaction rows (a row opens that payment). It works in English, German and Arabic.

What works on sample data:

- **Search** by name, amount or reference. Amounts can be typed as `120`, `120,00`, `120.00` or `-120`.
- **Quick filters** (All, Needs you, Money in, Money out) are the segmented buttons under the search box; the one that is on is highlighted. **Account**, **month** and **search** show as removable chips with ✕, and **Clear all** removes everything.
- **One payment:** full screen on a phone, a side panel beside the list from 1024 px wide. On a computer between 1024 and 1535 px the table has no room next to the panel, so while a payment is open the list layout is shown instead; from 1536 px the table stays.
- **Actions**, where they apply: Confirm, No receipt needed, **Change** (the category), Business / Private. Each adds a line to the history.
- **Print views:** Download PDF (one payment), and Download month (computer only), which prints the selected month, or the newest month when none is chosen, with its account if one is chosen; search and the quick filter don't apply. Both open the browser's Print dialog; choose Save as PDF to keep a file.
- Until the business's bank step is done, Payments shows "Connect your bank to see your payments" with a button (it opens Connect your bank, see Setup and Settings) instead of the list.

**Pick from Documents** (in a payment's Receipt section) opens a list of unlinked documents of the matching direction; choosing one links it (see Documents). A payment with a linked document can't be marked Private: the switch says to unlink the document first. **Open document** on a payment with a linked document opens that document. **Take photo** shows "Reading…" for about two seconds, then links a receipt made from the payment (its name, amount and date); no photo is really read.

Coming soon (the button opens a placeholder page): Self-issued receipt.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample data. The demo's "today" is 22 Oct 2026, so new history lines are dated 22 Oct.

## Documents

The Documents page (`/documents`) opens from the menu (on a phone, under More in the bottom bar), from the camera button in the bottom bar (which also opens the Add choices), from the homepage's "Unreadable receipts" notice and from the "Open document" link on a payment. It works in English, German and Arabic.

What works on sample data:

- **Needs you** box at the top: one card per document that needs a decision. A possible duplicate offers **Keep both** or **Remove**, a document whose direction is unclear asks **Received** or **Sent**, and a document with an unreadable amount, date or name offers **Type it in**. Fixing a card removes it, or turns it into its next problem. The box disappears when it is empty.
- **List by month:** every other document, newest first, with its status as a word (Waiting for payment, Overdue, Done). Search by name, amount (typed as on Payments) or invoice number.
- **One document:** full screen on a phone, a side panel beside the list from 1024 px wide. It shows the drawn scan, what we read, the booking, the payment and the history.
  - **Edit** the fields we read. Saving adds a history line, and fixing an unreadable field clears that problem.
  - **Change** or **Confirm** the booking. One booking is shared by a document and its payment.
  - **Payment suggestions:** up to three likely payments, each with **This one**. **Search all payments** opens every unlinked payment of the matching direction. **Not this payment** unlinks (the payment gets its earlier booking back and needs a receipt again).
  - **Remove** a document that is not linked to a payment.
- Linking from either page adds a history line on both the document and the payment.
- In the "New client" setup state there is no list, only the ways to add a document.

**Adding documents:** the **+ Add** button, the menu's "Upload receipt" and the homepage's "Upload your first receipt" step open the choices. On a phone: take a photo, choose a file, or copy the forwarding address. On a computer: choose a file, copy the forwarding address, or drop files anywhere on the page. **Copy** copies the address; if the browser refuses, the message says to select it.

Every upload is simulated. A new document shows "Reading…" for about two seconds, then takes the next ready-made result from a small pool for the open business. For Weber Design, the first upload is a Deutsche Bahn receipt that links itself to the payment with the missing receipt, the second is a possible duplicate, and the third asks "Received or sent?"; after that the pool gives plain receipts waiting for payment. Accepted files are PDF, JPG, PNG and e-invoice XML, up to 20 MB; any other file is refused with a message that names it. A short message sums up what was added and how many documents need you.

**Homepage:** the decisions count ("things need your decision") counts documents in the Needs you box as well as payments, and the "Unreadable receipts" notice counts documents with an unreadable field (its Fix button opens Documents).

Coming soon (the buttons open a placeholder page): Paid in cash or privately, and Self-issued receipt. Not built: real reading of documents, a real email inbox (the forwarding address is made up) and Dropbox import.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample documents along with the payments, and drops any upload that is still "Reading…".

## Review inbox

The review inbox (`/review`) is one short queue of every decision that needs the person, one card each, oldest first (by the payment's or document's date). It works in English, German and Arabic.

**Ways in** (each opens the first card straight away): the **Needs you · N** button in the top bar of every screen (hidden when N is 0), **Start** on the homepage decisions card and its tile on a computer, **Review them** next to the "Needs you" quick filter on Payments, and **Start** in the Needs-you box on Documents. N is the homepage's decisions count, and drops with every answer.

- **Cards:** an unclear payment asks "What was this for?" (its three likeliest categories, **Private** when no document is linked to the payment, or **Other category…**); a payment to confirm offers **Yes, that's right** or **Change category**; a payment without a receipt offers **Take a photo**, **Pick from Documents** or **No receipt needed** (an incoming one that looks like the payment of an open invoice asks first whether it is, see Invoices); a document asks **Keep both** or **Remove this one** (possible duplicate), **Received** or **Sent**, or for the amount, date or name to be typed in. An item with two problems keeps one card and asks the next question in place. Every answer changes the sample data, so Payments, Documents and the homepage follow.
- **Undo** shows for about 5 seconds after each answer and takes it back, with anything it learned or booked. **Skip for now** moves the card to the end of the queue. **✕** (or Escape) closes the inbox and keeps every answer and the skipped order; the next Start carries on with what is left. Closing steps back in the browser history, so the phone's back gesture afterwards goes to the page before, not into the inbox again.
- **Learning:** choosing a category for an unclear payment makes a rule for that name ("Amazon will be booked as Office supplies automatically from now on") and books the other unclear payments from it at once. Changing the category of any payment from that name later updates the rule; marking one **Private** does not. Rules belong to one business; **Reset demo** clears them.
- **Take a photo** shows "Reading…" for about two seconds, then adds a receipt made from the payment and links it. No photo is really read.
- When nothing is left, "All done — your books are up to date" shows with a one-line summary (and the next VAT return date, for a business that charges VAT). **Back** returns to the page the person came from.

A phone shows the inbox full screen; a computer shows a column in the middle of a dimmed page, at a fixed distance from the top so it does not move from card to card, with Undo floating at the bottom of the screen. Everything lives in memory: a page reload or **Reset demo** restores the sample data and starts the inbox over. The slide, tick and check animations stop when the system's reduce-motion setting is on.

## Setup and Settings

A new client sets up three steps, shown as the homepage checklist: connect the bank, save the tax details, add the first document. The steps are kept **per business** (switching business shows that business's progress) and can be done in any order. Connecting the bank, saving the tax details and adding the first document (any way) each tick their own step, and the checklist disappears when all three are done. The demo toolbar's New client / Halfway / Active client are shortcuts for the open business only, and **Reset demo** returns every business to Active client. All of it works in English, German and Arabic.

**Your tax details** (`/settings/tax`, opened from the setup step and from Settings) asks five plain questions, each German term next to its translation and explained on hover or tap (inside an answer card the words choose the answer, and a small info button at the card's end explains the term): kind of business, whether you charge VAT, the VAT return period and Ist/Soll, the tax number and VAT ID, and the financial year. No answer is pre-selected.

- The VAT questions (return period, permanent extension, Ist/Soll) show only after "Yes, I charge VAT". Answering No (Kleinunternehmer) and saving clears them.
- The tax office appears under the tax number once the number is valid for the chosen state. In the demo only Bayern, Berlin, Bremen, Hamburg and Nordrhein-Westfalen have sample tax offices (invented, not the official list); any other state says so.
- **Save** checks every visible question, ticks the tax step and returns to where the page was opened from.
- The answers change the rest of the app: the VAT shown on payments and documents (a Kleinunternehmer shows "no VAT"), the category list (revenue without VAT), and the homepage VAT return card, whose due date follows the return period and the extension (yearly shows a line with no date).

**Connect your bank** (`/settings/bank/connect`, opened from the setup step, from Payments and from Settings) is four screens: pick a bank by its name (about twelve German banks, shown as initials tiles), what we can see (and can't), a simulated sign-in, and choose which accounts are the business's.

- The sign-in always reads "DEMO · no real bank, no password" and has no input fields: nothing is connected to a real bank.
- A sample business banks with its own sample bank (Weber Design: Qonto). Picking any other bank shows that sample bank's accounts, with a note on the sign-in screen saying so.
- The business account is ticked; savings and credit cards are not (private accounts stay out). **Connect N accounts** shows "Fetching payments…" for about two seconds, then the payments appear and the bank step ticks. An account that is already connected shows greyed out and is not counted in the button, one whose connection has ended says so and points to Settings, and connecting twice adds the accounts once.
- **I also take cash** adds a cash box without the bank flow. It shows in Settings and does not tick the bank step.
- Switching business in the middle of the flow starts it again for the business now open.

**Settings** (`/settings`, from the menu) has four sections: **Business and tax** (the saved answers in plain words, with **Edit**), **Invoice details** (see Invoices), **Bank accounts**, and **Documents inbox** (the forwarding address, with Copy).

- Bank accounts: **+ Connect a bank**, then one row per account with its masked IBAN and a status word: **Connected**, **Renew in N days** (the consent ends within 14 days), **Sign in again** (it ended or broke), **Statement import** (no bank connection) or **Cash**. **Renew** and **Sign in again** open the simulated sign-in for that bank only, then the status becomes Connected.
- The homepage bank notices are calculated from the connections, so they go as soon as the connection is renewed: Weber Design shows "Qonto expires in 5 days" and Sara Weber Yoga shows "sign in again". Café Linde's Sparkasse shows Statement import in Settings and has no notice.
- Every saved change to tax details or bank accounts (connecting, renewing, adding a cash box) adds a line to the business's history. It is stored but not shown yet.

Coming soon (the button opens a placeholder page): importing a bank statement, for a bank that isn't listed or an account with no connection. Not built yet, and with no button anywhere: PayPal, Stripe and Amazon connections, users, and the list of rules the review inbox learned. Not built either: a real bank connection (the sign-in is a demo screen with no bank behind it) and a real tax-office lookup.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample accounts, tax answers and setup steps.

## Taxes

The Taxes page (`/taxes`) shows the VAT return the business has to send next, and the year so far. It opens from the menu, from **Open taxes** on the homepage tax card (a tile on a computer) and from the tax reminder (below). It works in English, German and Arabic.

- **Tabs:** a business that charges VAT has two, **VAT return** and **Year (EÜR)** (`/taxes?tab=year`). A Kleinunternehmer has no tabs: the revenue-limit tracker, "No VAT return needed" and the year. Until the business has saved its tax details (or, when it charges VAT, picked a return period) the page only says so and links to the tax details in Settings.
- **A business that files its VAT once a year** shows "Yearly VAT return only" with the date (31 July next year) and nothing to send.

**How the VAT return is calculated** (`src/app/domain/vat-return.ts`):

- It counts the **booked** payments dated in the period (payment dates) for every business, Soll-taxed ones too (Café Linde): the mockup does not tell Ist-Versteuerung from Soll-Versteuerung. A payment that is not booked yet is left out and counted as "N payments still need you", with **Start** to open the review inbox.
- The VAT part of a payment is gross × rate ÷ (100 + rate), rounded to the cent, from the booking's VAT rate (private payments and payments without VAT add nothing). Money in is the **VAT charged** (Umsatzsteuer), money out is the **VAT paid** (Vorsteuer). The result is charged − paid: "You pay €X", or "You get €X back" when it is negative; a period still running says "So far you pay…".
- The period is a calendar month or quarter, as the tax details in Settings say. A return is due on the 10th of the month after the period ends, one month later with the permanent extension (Dauerfristverlängerung). **The mockup keeps the 10th even when it falls on a weekend** (Café Linde's 10 Oct 2026 is a Saturday). A real product must move a weekend deadline to the next working day.
- The **current return** is the period after the latest sent one, or the period that holds today when nothing was sent yet. The homepage tax card and tile and the review inbox's "All done" line (which shows only the date) use this same return, so they never disagree about which return is next. Neither shows it until the business has saved its tax details. **See the payments** opens Payments on the period's month (the first month of a quarter, with a hint saying to choose the other two in the month filter).

**Year (EÜR):** income, costs (by category, with the SKR03 account), profit so far this year, the income tax to set aside (a sample figure), and the returns to make at the end of the year, each with its German term and due 31 July next year: the EÜR for every business, the income-tax return (Einkommensteuererklärung) or, for a GbR, the partnership return (Feststellungserklärung), and the annual VAT return (Umsatzsteuererklärung) for a business that charges VAT. They are not sent from the app.

- The sample payments only start in July or August, so the earlier months are **one stored opening line** per business (labelled "earlier months", not linked to payments). The rest is calculated from the booked payments that are not private, and links to Payments.
- Amounts are net of VAT for a business that charges VAT, and as paid for a Kleinunternehmer. The Kleinunternehmer revenue-limit tracker (here and on the homepage) reads this same year income, so confirming a payment moves both together.

**Sending is simulated:** no ELSTER connection, no certificate, no tax ID.

- **Send to the tax office** opens a check step (period, VAT charged, VAT paid, result). **Send** shows "Sending…" for 1.5 seconds, then "Sent ✓" with a made-up transfer ticket and **Print receipt**. Cancel, ✕, Escape and a tap outside close it before anything is sent; closing it while it sends does not stop the return.
- The return moves to **Sent earlier** with today's date, its amount and a **Receipt** link: a printable receipt (Übertragungsprotokoll) at `/print/vat-return/<periodStart>`, outside the app shell, which opens the browser's Print dialog (choose Save as PDF to keep a file). It shows the figures and the tax office stored when the return was sent, so a later change of the tax number does not rewrite it. The next period then becomes the current return.
- A return can't be sent while its period is still running (the button is off and the note under it says when it is ready) or while payments in it still need the person (the button reads "Fix N payments first" and opens the review inbox). A sent return can't be changed.

**Tax reminder:** a pop-up when the app opens, and again after **Reset demo**, on top of whichever page opened (not on the print pages, which sit outside the app shell). It lists the businesses of the signed-in person whose current VAT return is due within 21 days or is overdue, each with its name, period and due date, and **Open taxes** (switches to that business and opens `/taxes`). A Kleinunternehmer has none, and neither has a business that files its VAT once a year or has not set its tax details yet.

- **Got it, don't remind me again** stores an acknowledgement per person, business and due date, so the next deadline reminds again. **Not now**, ✕, Escape and a tap outside close it, and it shows again the next time the app is opened; **Open taxes** counts as Not now. A return that becomes due while the app is open (a changed tax answer) waits for the next open.
- **Reset demo** clears the acknowledgements and restores the sent returns.

**The sample:** Weber Design (monthly) sent August and September; October is in progress, due 10 Nov, ready to send from 1 Nov. Café Linde GbR (quarterly) sent Q2; Q3 has been overdue since 10 Oct, so it is the one to send in the demo (Q4 is the current return after that). Sara Weber Yoga is a Kleinunternehmer, so it has no VAT return.

Not built: a real ELSTER connection, applying for the permanent extension from Taxes (it only follows the Settings answer), correction returns, sending the EÜR or the income-tax return, and paying the tax. The page states figures and deadlines only, with no tax advice.

Changes live in memory only, with one exception: the "Got it" acknowledgements of the tax reminder are remembered in the browser, so they survive a reload until **Reset demo**. A page reload, or **Reset demo** in the demo toolbar, restores the sample data, including the sent returns. The demo's "today" is 22 Oct 2026.

## Invoices

The Invoices page (`/invoices`) is where the business writes invoices, sends them and sees who still owes money. It opens from the menu (on a phone, from the bottom bar), from the homepage **Owed to you** card (shown once the bank step is done and something is owed) and from the overdue notice. It works in English, German and Arabic. Its pages: the **list**, **one invoice** (`/invoices/:id`), **new invoice** (`/invoices/new`, and `/invoices/:id/edit` for a draft), the **print view** (`/print/invoice/:id`, outside the app shell, opens the browser's Print dialog; choose Save as PDF to keep a file) and **Settings › Invoice details** (`/settings/invoice`).

- **The list:** the **Owed to you** card (what is left to pay and how many invoices, then in red the overdue part; each part sets the filter), the filters All, Open, Overdue, Drafts and Paid (Overdue and Drafts show a count; Open is everything still owed, part paid and overdue included), then one row per invoice: drafts, overdue, open by due date, then paid and cancelled, newest first. A row shows the customer, number, date, amount and a status chip, and a late invoice carries **Send reminder** on the row. Like Documents, it shows sent invoices once the bank step is done (before that, only drafts and invoices sent in the demo). An invoice made elsewhere and added on Documents shows as "Added from a file" and opens its document. Cash-register closings are not invoices.
- **One invoice:** the invoice as the customer sees it, **What happened** (the history, with links to the payment and to the cancellation invoice) and the next step as the main button: **Preview and send** for a draft that is ready (**Edit** when something is missing), **Send a friendly reminder** or **Send formal reminder** for a late invoice, **Duplicate** for a paid one, **Make a corrected copy** for a cancelled one, otherwise **Download PDF**. **Mark as paid** and a ⋯ menu follow where they apply.
- **New invoice:** one screen with the customer (one you sent an invoice to before, or a new one), the lines (earlier lines are suggested), the VAT, the dates, the invoice language, the totals updating as you type, and **Ready to send** (beside the form on a computer). The draft is saved on the first change and on every change after, ✕ keeps it, and **Delete draft** asks once. Writing an invoice needs the tax details: the checklist names that step with a link.
- **Statuses**, decided in this order: **Draft** (not sent), **Cancellation** (a cancellation invoice), **Cancelled**, **Paid** (the linked payments reach the total), **Partly paid** (some money came in; the chip says what is left), **Overdue** (past the due date, "Overdue 22 days"), otherwise **Open** ("Due 30 Oct" or "Due today"). The due date is the invoice date plus the payment term. A partly paid invoice past its due date stays "Partly paid", but counts in the overdue part and the Overdue filter and is offered reminders.
- **Numbers:** `RE-{YYYY}-{NNN}` by default. The next number is one above the highest used so far this year (counted over the business's invoices and sent documents, also those sent before the app), in three digits: gap-free, and it starts again each year. **A number is given when the invoice is sent**, not before; a draft says "Draft". A cancellation invoice takes the next number in the same sequence. The pattern in Settings must contain both `{YYYY}` and `{NNN}`, with nothing else in curly brackets, or Save says what is wrong.
- **Sent invoices are locked.** Only a draft can be edited or deleted. A sent invoice keeps the VAT rate, tax note, file format and seller details (name, address, email, bank account, tax number, VAT ID) it was sent with, so a later change in Settings never rewrites it; a draft follows Settings until it is sent.
- **Ready to send:** the checklist ticks itself and names every missing item with where to fix it, as a link (Settings › Invoice details, Settings › tax details, or the part of the form; from Settings it comes back to the draft). It checks what § 14 UStG requires from you: your name and address, your tax number or VAT ID, the customer's name and address, lines that each have a description, quantity and price, the invoice date, and when the work was done. The invoice number is given when the invoice is sent, not before. The invoice date is the one you pick, any day from 1 January of this year up to today: the field and the checklist say so, and the number's year is the year it is sent in. For reverse charge it also needs your VAT ID and the customer's, and for a public office its Leitweg-ID. It also needs the customer's email, because the invoice is sent by email. **Preview and send** stays off until nothing is missing.
- **VAT:** one rate per invoice, 19 % (the default) or 7 %, so every payment books at one rate and the VAT return stays exact; mixed rates come later. A Kleinunternehmer has no VAT field: the prices are what the customer pays, and the invoice carries the § 19 note (only that note, also for a customer abroad).
- **Customers abroad** are businesses only. A business in another EU country gets no German VAT and the reverse-charge note, and needs the customer's VAT ID and your own. A business outside the EU gets no German VAT and a "not taxable in Germany" note. A private person or a public office must be in Germany: the form says so, and the checklist blocks sending.
- **Formats** (named, not generated: no XML is made): **ZUGFeRD** for a business in Germany, **XRechnung** with the Leitweg-ID for a public office (also from a Kleinunternehmer), and a plain PDF for a private person, any customer abroad and a Kleinunternehmer's business customers. The send step shows the attachment, such as `RE-2026-045.pdf` plus "ZUGFeRD", or `RE-2026-045.xml` for an XRechnung.
- **Language:** each invoice is in German or English (from Settings, changeable per invoice). The paper, the email and the reminder texts come from `src/app/domain/invoice-texts.ts`, not from the translation files, so an Arabic user sees a German or English invoice. It is always laid out left-to-right, whatever the app's language.

**Sending and reminders are simulated:** nothing leaves the app, and the app never writes to a customer by itself.

- **Preview and send** opens the send step: to, subject, an editable message and the attachment. **Send** shows "Sending…" for 1.5 seconds, then "Sent ✓". The invoice gets its number, becomes Open, and its sent document appears on Documents.
- **Friendly reminder** (Zahlungserinnerung): asks for payment within 7 days. **Formal reminder** (Mahnung): offered once the friendly one is 7 days old; it gives a new date 7 days ahead and says late-payment interest may be charged, but calculates no interest or fees. Two levels in total. Between them the row says "Reminded 12 Oct · formal reminder possible from 19 Oct". A reminder never changes the due date, so the invoice stays Overdue. On a part-paid invoice the text says what is left. Each reminder adds a history line.
- **The overdue notice** ("Bäckerei Lange is 22 days late with RE-2026-039 · Send reminder") shows in the homepage notices and the bell, once the bank step is done, for a late invoice with no reminder yet, and opens the invoice with the reminder ready. It is calculated, so it goes when the invoice is reminded or paid.

**Cancel, copy, pay:**

- **Cancel invoice** (⋯, asks once) on an open or overdue invoice makes a **cancellation invoice** (Stornorechnung): the next number, the same customer, lines and seller details with negative amounts, dated today, with its own document. The original becomes Cancelled and stays on record, and the page offers **Make a corrected copy**. The cancellation invoice is not emailed. **Paid and partly paid invoices can't be cancelled yet**: the menu says it needs a credit note, coming later.
- **Duplicate** (in the ⋯ menu of an invoice with something left to pay, and as the main button on a paid one) makes a draft with the same customer, lines, language and VAT rate (19 % again when a note had forced 0 %), today's date and the payment term from Settings, and opens it.
- **Mark as paid** means paid in cash: it asks for the day (from the invoice date up to today) and adds a booked incoming payment of what is left to the cash box (the business gets one if it has none), linked to the invoice. VAT, the year figures and the Kleinunternehmer tracker count it like any payment.
- **DEMO · Simulate the customer's payment** (a control styled like the demo toolbar, on an invoice with something left to pay) adds the payment that matches, so the invoice turns Paid in front of you. It shows only when a bank connection works: the first bank account whose connection works receives the payment, and a statement account, the cash box and a connection that needs a new sign-in can't. In the sample, Weber Design's and Café Linde's Qonto connections work, so their open invoices show the control at once; Sara's shows it after renewing in Settings.

**Getting paid:**

- **A payment whose reference names an open invoice's number is matched automatically.** The invoice turns Paid, or Partly paid when less came in, and later payments add up; the history line carries the payment's date. No new bank payments arrive in the mockup, so this runs for the simulated payment; the sample's other payments are matched already.
- **When only the amount matches** (one open invoice has exactly that left, and the reference names none), the review inbox asks "Is this the payment for invoice RE-2026-044 from Studio Kern?" with **Yes**, **Pick another** and **No receipt needed**. It counts as one decision.
- **A payment that pays an invoice stays business:** its Private switch says so. A payment the app creates for an invoice, and a matched one with no category yet, is booked as revenue by the invoice's tax (19 % or 7 %, Kleinunternehmer, reverse charge or not taxable). So is a matched one that was booked with another VAT rate (an automatic 19 % for a 7 % or reverse-charge invoice): its history says "Booked as … to match the invoice", so the VAT return never counts VAT that was not charged. Taxes counts the VAT when the money arrives, as for any payment.

**Links with Documents and Payments:** a sent invoice is also a sent document on Documents, named after its number and dated with the invoice date (it is added on the day it was sent). **A document written here is locked:** its detail says "Written in Invoices" and offers **Open invoice**; in its Payment section "Paid in cash? Mark it in the invoice" leads to the invoice, where Mark as paid works. A part-paid invoice shows as Waiting with what is left (its Payment section lists the payments that came in), a cancelled one as Done · Cancelled, and a cancellation invoice as Done ("Cancellation of RE-2026-040"), never offered as a match for a payment. When a payment completes an invoice, its document is linked to that payment, and the payment's page shows **Pays invoice RE-2026-044** as a link to the invoice.

**Settings › Invoice details** (its own section on Settings, between Business and tax and Bank accounts; **Edit** opens the page) holds what is printed on every invoice: the name and address, the bank account (IBAN; one of the connected accounts or typed, checked for its shape only), the sender email (shown, not editable), the number pattern with the next number, the payment term (7, 14 or 30 days) and the invoice language. Save names each problem next to its field. The tax number and VAT ID come from the tax details.

**The sample** (invented customers and addresses; the sent invoices are the ones behind the sample payments and documents, so numbers and amounts match everywhere):

- **Weber Design:** Studio Kern RE-2026-044 is open (€2,380.00, due 30 Oct). Bäckerei Lange RE-2026-039 is overdue (€1,190.00, since 30 Sep, not reminded, so it has the notice). RE-2026-040 to Agentur Nord was cancelled with RE-2026-042. A draft to Bezirksamt Pankow is an XRechnung with a Leitweg-ID. Owed to you is €3,570.00, of which €1,190.00 is overdue. A €2,380.00 payment from "Kern Studio Berlin" has no invoice number, so the review inbox asks whether it pays RE-2026-044 (Weber's decisions count is up one on purpose).
- **Café Linde GbR:** RE-2026-053 to Kanzlei Hoffmann was reminded on 12 Oct, so the formal reminder is ready. Its earlier invoices are paid.
- **Sara Weber Yoga** (Kleinunternehmer, § 19 note): RE-2026-021 to Physio Zentrum Mitte is partly paid (€300.00 came in on 21 Oct, €300.00 left, due 13 Nov). Its bank connection needs a new sign-in, so it has no demo payment control until it is renewed in Settings.

Not built: quotes, recurring invoices, sending by post, a customers page, discounts, credit notes for paid invoices, private customers and public offices abroad, the EU summary report (Zusammenfassende Meldung), foreign currencies, a real logo ("Your logo" stands in), real e-invoice files, real email, and interest or fees on reminders.

**Size:** the pages are lazy routes, but the invoices are part of the start-up sample data (the homepage card and the overdue notices need them), so the initial bundle is now 622 kB. The initial warning budget was therefore raised from 600 kB to 650 kB in `angular.json`. It is a warning threshold: the error limit stays at 1 MB.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample invoices, their numbers, the payments they made and the invoice details. The demo's "today" is 22 Oct 2026.

## Translations

All text lives in `public/i18n/{en,de,ar}.json`. Every key in `en.json` must also exist in `de.json` and `ar.json`.

German and Arabic text is a **draft**. It must be reviewed by a fluent speaker who knows German bookkeeping before
it is shown to anyone else.

## spartan/ui (helm) components

Generated into `libs/ui/<name>/` and mapped in `tsconfig.json` paths. Import them as:

```ts
import { HlmButton } from '@spartan-ng/helm/button';
```

Available: `button`, `card`, `badge`, `dialog`, `dropdown-menu`, `popover`, `progress`, `tooltip`, `separator` (plus `utils`).
Config is in `components.json` (written by hand, because the generator only offers it interactively).
Add more with `npx ng g @spartan-ng/cli:ui <name> --interactive=false --defaults`.

## Colour convention

Colours come from the shadcn variables in `src/styles.css` (`--background`, `--foreground`, `--primary`, `--muted`,
`--card`, `--border`, ...) plus the project tokens `surface`, `positive`, `negative` and `warning` (each with a
`-foreground` where text sits on it). Use them as `bg-primary`, `bg-muted`, `text-muted-foreground`, `bg-surface`,
`text-positive` and so on. Never hard-code colours.
