# Bookkeeping app mockup (web)

Clickable Angular mockup of the bookkeeping app: the homepage, the Payments page, the Documents page, the Invoices page, the review inbox, the setup steps with Settings, the Taxes page with its tax reminder, the Reports page with closing a month and the export for the tax advisor, sign-in and accounts (sign-in, sign-up, people with access and My account), the three ways to complete the books without a bank connection: statement import, self-issued receipts, and paid in cash or with my own money, and the Help page with answers, German terms A–Z and Write to us (en / de / ar). No backend.
All data is sample data: the businesses in `src/app/data/sample-data.ts`, the sample person in `sample-person.ts`, the sample set a business made in the demo starts with in `new-business-sample.ts` and the bank files the statement import reads in `sample-statements.ts`.

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

The strip at the top of every page inside the app is demo-only (the sign-in pages have none: their demo help is dashed boxes on the page itself):

- **Setup state** (New client / Halfway / Active client) is a shortcut for the **open business only**: it sets that business's three setup steps (none / bank only / all three) and nothing else. Connected accounts, tax answers and documents stay as they are. The choice that matches the business's steps is highlighted, and none is when the steps are mixed. In "New client" no bank is connected yet, so Payments has no list.
- **Business switcher** (in the top bar) changes which business is open. It lists only the businesses the signed-in person is in, with their role (Owner, Full access, …) beside each, and ends with **+ Add a business** (see Sign-in and accounts).
- **Reset demo** signs out and opens the sign-in page with Sara's email filled in. It forgets the remembered sign-in and every trusted device, brings back Sara's people, invitations, support access, devices, backup codes and memberships, and removes the accounts and businesses made during the visit. It does not change the language. It also brings back every notice you dismissed and the sample payments, documents, bank accounts and tax answers, puts every business back to Active client, forgets what the review inbox learned (dismissals are remembered in the browser until you reset), and brings back the tax reminder, the VAT returns sent from Taxes, the sample invoices with their numbers, the payments they made and the invoice details, and the sample's closed months (a month closed in Reports, or by sending a VAT return, is open again). It takes back every statement import, self-issued receipt and payment made in cash or with my own money, with the accounts they made (a statement account added with "My bank isn't listed", the cash box, Own money). Each account's sample statements start over.

## Payments

The Payments page (`/payments`) opens from the menu (on a phone, from the bottom bar) and from the homepage's "See all" and its transaction rows (a row opens that payment). It works in English, German and Arabic.

What works on sample data:

- **Search** by name, amount or reference. Amounts can be typed as `120`, `120,00`, `120.00` or `-120`.
- **Quick filters** (All, Needs you, Money in, Money out) are the segmented buttons under the search box; the one that is on is highlighted. **Account**, **month** and **search** show as removable chips with ✕, and **Clear all** removes everything.
- **One payment:** full screen on a phone, a side panel beside the list from 1024 px wide. On a computer between 1024 and 1535 px the table has no room next to the panel, so while a payment is open the list layout is shown instead; from 1536 px the table stays.
- **Actions**, where they apply: Confirm, No receipt needed, **Change** (the category), Business / Private. Each adds a line to the history. Money out with its receipt missing also offers **Write a self-issued receipt** (see Self-issued receipts). A payment dated in a closed month has none of these actions (see below).
- **Import statement** in the toolbar (a button on a computer, in the ⋯ menu on a phone) opens the statement import, and the **Account** filter lists every account, the cash box and Own money included (see Statement import and Paid in cash or with my own money).
- **Print views:** Download PDF (one payment), and Download month (computer only), which prints the selected month, or the newest month when none is chosen, with its account if one is chosen; search and the quick filter don't apply. Both open the browser's Print dialog; choose Save as PDF to keep a file.
- **A closed month** (see Reports): its heading in the list says **Closed** (a month inside the earlier months line counts as closed too). A payment dated in it keeps everything it shows (receipt, booking, bank details, history, Download PDF, and the links Open document and Pays invoice) but none of its actions: no Confirm, No receipt needed, Take photo, Pick from Documents, Self-issued receipt, Change or Business / Private. Its page says "September is closed, so this payment can't be changed." Its row in the list shows nothing extra. Documents, the review inbox and Invoices' Mark as paid don't know about closed months yet (see Reports).
- Until the business's bank step is done, Payments shows "Connect your bank to see your payments" with a button (it opens Connect your bank, see Setup and Settings) instead of the list.

**Pick from Documents** (in a payment's Receipt section) opens a list of unlinked documents of the matching direction; choosing one links it (see Documents). A payment with a linked document can't be marked Private: the switch says to unlink the document first. A payment whose receipt can't be unlinked (it has a self-issued receipt, or was made from its receipt as paid in cash or with own money) says instead that it stays business. **Open document** on a payment with a linked document opens that document. **Take photo** shows "Reading…" for about two seconds, then links a receipt made from the payment (its name, amount and date); no photo is really read.

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

A received receipt that is waiting for its payment also offers **Paid in cash or with my own money** (see Paid in cash or with my own money). A self-issued receipt written from a payment shows as a received document with the status **Done · Self-issued**, and its detail has a Print button (see Self-issued receipts). Documents does not look at closed months.

Not built: real reading of documents, a real email inbox (the forwarding address is made up) and Dropbox import.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample documents along with the payments, and drops any upload that is still "Reading…".

## Review inbox

The review inbox (`/review`) is one short queue of every decision that needs the person, one card each, oldest first (by the payment's or document's date). It works in English, German and Arabic.

**Ways in** (each opens the first card straight away): the **Needs you · N** button in the top bar of every screen (hidden when N is 0), **Start** on the homepage decisions card and its tile on a computer, **Review them** next to the "Needs you" quick filter on Payments, and **Start** in the Needs-you box on Documents. N is the homepage's decisions count, and drops with every answer.

- **Cards:** an unclear payment asks "What was this for?" (its three likeliest categories, **Private** when no document is linked to the payment, or **Other category…**); a payment to confirm offers **Yes, that's right** or **Change category**; a payment without a receipt offers **Take a photo**, **Pick from Documents** or **No receipt needed** (an incoming one that looks like the payment of an open invoice asks first whether it is, see Invoices), and for money out a link **Receipt lost? Write one yourself** under the answers (see Self-issued receipts); a document asks **Keep both** or **Remove this one** (possible duplicate), **Received** or **Sent**, or for the amount, date or name to be typed in. An item with two problems keeps one card and asks the next question in place. Every answer changes the sample data, so Payments, Documents and the homepage follow.
- **Undo** shows for about 5 seconds after each answer and takes it back, with anything it learned or booked (a self-issued receipt written from a card goes back too, with its number). **Skip for now** moves the card to the end of the queue. **✕** (or Escape) closes the inbox and keeps every answer and the skipped order; the next Start carries on with what is left. Closing steps back in the browser history, so the phone's back gesture afterwards goes to the page before, not into the inbox again.
- **Learning:** choosing a category for an unclear payment makes a rule for that name ("Amazon will be booked as Office supplies automatically from now on") and books the other unclear payments from it at once. Changing the category of any payment from that name later updates the rule; marking one **Private** does not. Rules belong to one business; **Reset demo** clears them.
- **Take a photo** shows "Reading…" for about two seconds, then adds a receipt made from the payment and links it. No photo is really read. The "Receipt lost? Write one yourself" link waits (greyed out) while a photo is read.
- When nothing is left, "All done — your books are up to date" shows with a one-line summary (and the next VAT return date, for a business that charges VAT). **Back** returns to the page the person came from.

A phone shows the inbox full screen; a computer shows a column in the middle of a dimmed page, at a fixed distance from the top so it does not move from card to card, with Undo floating at the bottom of the screen. Everything lives in memory: a page reload or **Reset demo** restores the sample data and starts the inbox over. The slide, tick and check animations stop when the system's reduce-motion setting is on.

## Setup and Settings

A new client sets up three steps, shown as the homepage checklist: connect the bank, save the tax details, add the first document. The steps are kept **per business** (switching business shows that business's progress) and can be done in any order. Connecting the bank, saving the tax details and adding the first document (any way) each tick their own step, and the checklist disappears when all three are done. The demo toolbar's New client / Halfway / Active client are shortcuts for the open business only, and **Reset demo** returns every business to Active client. All of it works in English, German and Arabic.

**Your tax details** (`/settings/tax`, opened from the setup step and from Settings) asks five plain questions, each German term next to its translation and explained on hover or tap (inside an answer card the words choose the answer, and a small info button at the card's end explains the term): kind of business, whether you charge VAT, the VAT return period and Ist/Soll, the tax number and VAT ID, and the financial year. No answer is pre-selected, except the kind of work for a business made in the demo (sign-up or Add a business already asked it).

- The VAT questions (return period, permanent extension, Ist/Soll) show only after "Yes, I charge VAT". Answering No (Kleinunternehmer) and saving clears them.
- The tax office appears under the tax number once the number is valid for the chosen state. In the demo only Bayern, Berlin, Bremen, Hamburg and Nordrhein-Westfalen have sample tax offices (invented, not the official list); any other state says so.
- **Save** checks every visible question, ticks the tax step and returns to where the page was opened from.
- The answers change the rest of the app: the VAT shown on payments and documents (a Kleinunternehmer shows "no VAT"), the category list (revenue without VAT), and the homepage VAT return card, whose due date follows the return period and the extension (yearly shows a line with no date).

**Connect your bank** (`/settings/bank/connect`, opened from the setup step, from Payments and from Settings) is four screens: pick a bank by its name (about twelve German banks, shown as initials tiles), what we can see (and can't), a simulated sign-in, and choose which accounts are the business's.

- The sign-in always reads "DEMO · no real bank, no password" and has no input fields: nothing is connected to a real bank.
- A sample business banks with its own sample bank (Weber Design: Qonto). Picking any other bank shows that sample bank's accounts, with a note on the sign-in screen saying so.
- The business account is ticked; savings and credit cards are not (private accounts stay out). **Connect N accounts** shows "Fetching payments…" for about two seconds, then the payments appear and the bank step ticks. An account that is already connected shows greyed out and is not counted in the button, one whose connection has ended says so and points to Settings, and connecting twice adds the accounts once.
- **I also take cash** adds a cash box without the bank flow. It shows in Settings and does not tick the bank step.
- **My bank isn't listed** (under the banks on the first screen) skips the sign-in: it asks for the account's name and IBAN, makes a statement account and opens the statement import for it (see Statement import).
- Switching business in the middle of the flow starts it again for the business now open.

**Settings** (`/settings`, from the menu) has five sections: **Business and tax** (the saved answers in plain words, with **Edit**), **Invoice details** (see Invoices), **Bank accounts**, **People with access** (see Sign-in and accounts), and **Documents inbox** (the forwarding address, with Copy).

- Bank accounts: **+ Connect a bank**, then one row per account with its masked IBAN and a status word: **Connected**, **Renew in N days** (the consent ends within 14 days), **Sign in again** (it ended or broke), **Statement import** (no bank connection), **Cash** or **Private** (the Own money account). **Renew** and **Sign in again** open the simulated sign-in for that bank only, then the status becomes Connected. **Import statement** on a statement account's row opens the statement import for it, and an account with imports ends with an **Imports** list (see Statement import).
- The homepage bank notices are calculated from the connections, so they go as soon as the connection is renewed: Weber Design shows "Qonto expires in 5 days" and Sara Weber Yoga shows "sign in again". Café Linde's Sparkasse shows Statement import in Settings and has no notice.
- Every saved change to tax details or bank accounts (connecting, renewing, adding a cash box or the Own money account, undoing an import) adds a line to the business's history. It is stored but not shown yet.

Not built yet, and with no button anywhere: PayPal, Stripe and Amazon connections, and the list of rules the review inbox learned. Not built either: a real bank connection (the sign-in is a demo screen with no bank behind it) and a real tax-office lookup.

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

- The sample payments only start in July or August, so the earlier months are **one stored opening line** per business (labelled "earlier months", not linked to payments). The rest is calculated from the booked payments that are not private, and links to Payments. Reports shows the same year month by month and ends in the same total.
- Amounts are net of VAT for a business that charges VAT, and as paid for a Kleinunternehmer. The Kleinunternehmer revenue-limit tracker (here and on the homepage) reads this same year income, so confirming a payment moves both together.

**Sending is simulated:** no ELSTER connection, no certificate, no tax ID.

- **Send to the tax office** opens a check step (period, VAT charged, VAT paid, result), with a line saying that sending also closes the period's months, so their payments can't be changed after that (see Reports). **Send** shows "Sending…" for 1.5 seconds, then "Sent ✓" with a made-up transfer ticket and **Print receipt**. Cancel, ✕, Escape and a tap outside close it before anything is sent; closing it while it sends does not stop the return.
- The return moves to **Sent earlier** with today's date, its amount and a **Receipt** link: a printable receipt (Übertragungsprotokoll) at `/print/vat-return/<periodStart>`, outside the app shell, which opens the browser's Print dialog (choose Save as PDF to keep a file). It shows the figures and the tax office stored when the return was sent, so a later change of the tax number does not rewrite it. The next period then becomes the current return.
- A return can't be sent while its period is still running (the button is off and the note under it says when it is ready) or while payments in it still need the person (the button reads "Fix N payments first" and opens the review inbox). A sent return can't be changed.
- **Sending closes the months of its period** (see Reports): every finished month of the period that is not closed yet, one month or the three of a quarter, with no check of its own, because the return could only be sent once every payment in it was booked. Months closed earlier keep their date and person. Reset demo opens them again together with the returns.

**Tax reminder:** a pop-up right after signing in, and when the app is reloaded while still signed in, on top of whichever page opened (not on the print pages, which sit outside the app shell, and never on the sign-in pages). It lists the businesses of the signed-in person whose current VAT return is due within 21 days or is overdue, each with its name, period and due date, and **Open taxes** (switches to that business and opens `/taxes`). A Kleinunternehmer has none, and neither has a business that files its VAT once a year or has not set its tax details yet.

- **Got it, don't remind me again** stores an acknowledgement per person, business and due date, so the next deadline reminds again. **Not now**, ✕, Escape and a tap outside close it, and it shows again the next time the app is opened; **Open taxes** counts as Not now. A return that becomes due while the app is open (a changed tax answer) waits for the next open.
- **Reset demo** clears the acknowledgements and restores the sent returns.

**The sample:** Weber Design (monthly) sent August and September; October is in progress, due 10 Nov, ready to send from 1 Nov. Café Linde GbR (quarterly) sent Q2; Q3 has been overdue since 10 Oct, so it is the one to send in the demo (Q4 is the current return after that), and sending it closes July to September in Reports. Sara Weber Yoga is a Kleinunternehmer, so it has no VAT return.

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

**Size:** the pages are lazy routes, but the invoices were part of the start-up sample data (the homepage card and the overdue notices need them), so the initial bundle grew to 622 kB when they joined it. The initial warning budget was therefore raised from 600 kB to 650 kB in `angular.json`. It is a warning threshold: the error limit stays at 1 MB. Now that the app opens on the sign-in page, and the app shell and the sample data are lazy and no longer in the first load, the initial bundle is about 380 kB. The budget stays at 650 kB.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample invoices, their numbers, the payments they made and the invoice details. The demo's "today" is 22 Oct 2026.

## Sign-in and accounts

The demo opens on a front door, like a client's app: the sign-in page (`/sign-in`). Its pages are **sign-in** with the code step, **forgot password** (`/forgot-password`), **sign-up** (`/sign-up`), the invited person's **join** page (`/join/:businessId/:memberId`), **Add a business** (`/businesses/new`), **People with access** (a card in Settings) and **My account** (`/account`). It works in English, German and Arabic; the sign-in, sign-up and join pages sit outside the app shell, have no demo toolbar and show the language the browser last used. Nothing is real: there are no accounts, passwords, codes, emails or sessions, and nothing leaves the browser. Every demo help is a dashed box on the page ("Demo: …"). The demo's "today" is 22 Oct 2026, so an invitation link works until 29 Oct and support access runs to 29 Oct.

**The start:** the sign-in page has Sara's email filled in.

- **Sign in:** **any password** works (it only has to be filled in), then the code step asks for **any 6 digits**, or **Use a backup code instead** (any code works and uses one up; Sara has 6 of 8, and with none left the page says so and points back to the app code). Two-step login can't be switched off. An empty field says what is missing, and an email typed with capitals or spaces is the same email. An email the demo knows only as a row on a business (Mia, Jana Hoffmann, Jonas Linde) says that in this demo only Sara's account and accounts you create can sign in. An email nobody has says so, with a link to create an account.
- **Trusted device:** "Don't ask again on this device for 30 days" skips the code at the next sign-in. The demo never lets it run out; **Reset demo** and a new password (Forgot password) forget it.
- **Every app page needs a signed-in person**, the print pages too. Opening one while signed out goes to `/sign-in?next=…` and, after signing in, to the page asked for (only a path inside the app is followed; anything else lands on the homepage). A signed-in person who opens a sign-in page lands on the homepage. The tax reminder pops up right after signing in.
- **Forgot password** is four steps: the email, "Check your email" (it says a link was sent for any email, so it can't tell an account from a stranger; only a known email gets the demo box with the email, written in that person's language), "Choose a new password" (at least 10 characters) and "Password changed". The new password signs the person out on every other device and forgets this device's trust; it does not sign anybody in, and the code is still asked at the next sign-in.
- **What is remembered in the browser:** only Sara's sign-in (a reload while signed in opens on the page that was open), the trusted devices, the browser's last language, and the dismissed notices and tax reminders as before. Everything else lives in memory. An account made with Create account is forgotten by a reload, which opens the sign-in page with Sara's email; Sara's own edits (name, email, devices) are forgotten too, and she is still signed in with the sample profile; her language stays what the browser last used. When the browser blocks storage the demo opens on the sign-in page every time.

**The language belongs to the person.** Signing in switches the app to the person's language. The language buttons in the top bar and the **Language** card on My account change it for whoever is signed in; the buttons on the sign-in, sign-up and forgot-password pages only change the page, but a language tapped there before signing in wins over the person's own and is saved as theirs. The pick is kept from page to page (sign in, Forgot password, a new password, back to sign in) and is used by the next sign-in only; Reset demo forgets it. On the join page somebody is signed in (the owner who sent the invitation), so its buttons save the language as theirs. Sara starts with the browser's current language, so opening the demo never changes it, and Reset demo leaves it alone. Emails shown in the demo are in the person's language; an invitation is in the inviter's, with one line in each of the other two. Emails, codes, IBANs and amounts read left to right inside Arabic, and the German terms (Freiberufler, Gewerbe, Einzelunternehmen, GbR, AVV, Steuerberater:in) are explained on hover or tap.

**Sign-up** is three steps on four screens, with a progress line:

- **Account:** the language buttons, the price box (a placeholder: "€ — a month", "First 30 days free, no card needed"), email and password (at least 10 characters). An email that already has an account says so, with a link to sign in.
- **Check your email:** "We sent a link to …", **Send it again**, **Change it** (back to the first screen with the fields kept), and a demo box with the email and **Confirm my email**.
- **You and your business:** first and last name, the business's name, the kind of work (Freiberufler / Gewerbe) and just you or partners (Einzelunternehmen / GbR). "A GmbH can't sign up yet."
- **Terms and a safe login:** a checkbox for the terms of use and the data processing agreement (AVV), whose links open a notice that the legal texts are not written yet, then **Protect your login**: a QR picture, a 6-digit code (any 6 digits work) and the 8 backup codes. **Finish** makes the person (in the language the page is in) and their business, signs them in and opens the homepage of a new client, with all three setup steps open and the person as its **Owner**. The tax details page starts with the kind of work already chosen.

**Add a business** (from the switcher) is the business questions and the terms on one page. It makes another business of the same person as its Owner, in the New client state, with its own plan.

**A new business's sample data.** A business made in the demo (by Create account or Add a business) has no bank, documents, tax details or invoices yet, and works with a generic set of sample data, the same for each one:

- **Connect your bank:** any bank in the list finds one business account at that bank (an invented IBAN), and connecting it fetches eight October payments: two customers paying in (one booking waits for a confirmation), rent, a phone bill, software, a train ticket, an Amazon order the system can't sort and a transfer to the owner's private account. A new client has no receipts, so all eight are in the review inbox.
- **Receipts:** the upload pool gives a Telekom and a Deutsche Bahn receipt that link themselves to their payments, then one whose direction is unclear, then two plain receipts that repeat.
- **Taxes:** once the tax details are saved, the year starts in October, so Year (EÜR) shows only October, and the income tax to set aside is €0.00. **Invoices** shows its empty state.

**People with access** is a card in Settings, after Bank accounts, for the open business.

- **The list:** each person with initials, name, email and "Joined 2 Sept 2026", and their role as a word. A waiting invitation shows the email, "Invited 20 Oct · the link works until 27 Oct" and **Waiting**. A line says that everyone is included in the price.
- **Four roles:** **Owner**, **Full access** (a partner: everything the owner can, except people and the plan), **Receipts only** (an assistant: upload receipts and fix their own, no payments, bank balances, taxes or settings) and **Tax advisor** (Steuerberater:in: see everything and download receipts and exports, no changing bookings, connecting banks or sending returns). The role cards list what each can and can't do. There are no custom roles.
- **Only the owner** invites, changes, removes and hands over; anyone else sees the list without the ⋮ menus and without **Invite someone**, and a line says who the owner is. The sample has Sara as Owner of Weber Design (with Jana Hoffmann as Tax advisor and a waiting invitation for `mia@example.com` as Receipts only) and of Sara Weber Yoga; at Café Linde GbR Jonas Linde is the Owner and Sara has Full access.
- **Invite someone:** an email and one of the three role cards, then **Send invitation**. An empty or invalid email, an email that already has access and one that is already invited each say so, whatever the case or spaces, and so does a missing role. **Change what they can do** opens the role cards again, **Make owner** (only for Full access) asks first and makes the owner Full access, and **Remove** asks first. A waiting invitation has **Send again** (a fresh 7-day link) and **Cancel invitation**.
- **Our support team** has no access unless the owner lets it look: **Let support look for 7 days** shows "Support can look until 29 Oct · Stop now". It is looking only; it never runs out in the demo, since today stays 22 Oct.
- Inviting, joining, changing a role, removing, leaving, handing over and support access each add a line to the business's history, with who did it. The lines are stored, not shown yet.

**Joining is a preview.** Sending or resending an invitation shows its email in a demo box (never sent), with **Accept the invitation**. That opens the join page, which needs a signed-in person (a signed-out visitor goes to sign-in first, and comes back to the link after signing in): the role and what it can and can't do, then a name, a language (a choice in the preview that nothing keeps), a password (at least 10 characters) and the same authenticator step as sign-up, and **Join**. "Already have a login? Sign in" is the same preview with any email and password. Finishing shows "Lena Vogel has joined Weber Design as Full access" with a **Back to Settings** button, where the list shows the new person as joined. The person who invited stays signed in as themselves: invited and joined people are only rows on a business, not logins, so the demo never signs in as them. A join link whose invitation was cancelled, was used already, or never existed says "This invitation no longer works", with a way back. Reset demo brings Mia's sample invitation back, so only an invitation made during the visit stops working after it.

**My account** (from the person menu) has five cards:

- **You:** first and last name (**Save**) and the email. **Change** asks for the new address and shows the email that confirms it in a demo box; only **Confirm my new email** saves it, and the card says the old address is told. The address must be an email and not the person's own or another account's. A new name or email also shows in People with access and in the sign-in page's filled-in email.
- **Language:** English, Deutsch, عربي.
- **Signing in:** **Change** the password (the current one is filled in; the new one needs 10 characters; it signs out every other device), two-step login "On" (always) with **Use a new phone** (the QR step again, with new backup codes that only count once they are saved with "I've saved them": Cancel leaves the old ones), and backup codes "6 of 8 left" with **Make new codes** (8 new ones, shown once; the old ones stop working).
- **Where you're signed in:** sample rows, since the app doesn't read the browser: "Chrome on Windows · This device" and "Safari on iPhone · Berlin · 21 Oct 2026", each other device with **Sign out**, and **Sign out everywhere else**.
- **Your businesses:** each with the person's role. **Leave** (not for an owner, and asks first) takes the business out of the list and the switcher, and opens another if it was the open one; a person always keeps at least one business. An owner can't leave: they hand the business over in People with access first.

**The person menu** at the end of the top bar shows the person's initials; it opens their name and email, **My account** and **Sign out**, which opens the sign-in page with "You're signed out."

Not built: **views per role** (after someone joins, the demo still shows the app as Sara sees it; a "View as" switch, with each page hiding what that role can't do, is a later step), a real login, password, code, email or session, a plan or billing page (the price is a placeholder, and each business has its own plan), closing a business or deleting an account (records have to be kept for up to 10 years, so an owner who is alone in a business can't leave it), GmbH sign-up, single sign-on, passkeys and SMS codes, the support team's side of support access, the legal texts, and showing the history lines.

Changes live in memory only, apart from what is remembered in the browser (above). A page reload, or **Reset demo** in the demo toolbar, restores Sara's sample people and devices and forgets the accounts and businesses made during the visit.

## Reports

The Reports page (`/reports`) is where a business hands over its books: the year month by month, closing a finished month so its bookings can't change, and an export for the tax advisor. It opens from the menu (on a phone, under More in the bottom bar). It works in English, German and Arabic. Its pages: the page itself and the printable summary of an export (`/print/export/<period>`, outside the app shell). With Reports and Help built, every menu entry opens a page of its own. On a phone the cards are one column; from 1024 px the months are on one side and the export and the audit card on the other.

- **Before there are figures:** until the tax details are saved the page only points at them, as Taxes does (whether the business charges VAT decides the figures). Once they are saved but no bank is connected it says "Connect your bank to see your months" with a button, as Payments does.
- **Needs you:** when payments still need the person (unclear, not confirmed or without a receipt: the one rule Payments, Taxes and the review inbox use), a line says how many, and **Start** opens the review inbox. It counts payments only, so it can differ from the **Needs you** button in the top bar, which counts documents too (Weber Design: 7 and 8). Under the count, one sentence says what that means for the page: "They aren't in these figures yet; an export marks them as open" ("It isn't in these figures yet; …" for one payment). Those payments are left out of the figures until they are booked, but an export has them, marked as open (see the export below).

**Month by month** (the BWA is explained on hover or tap; `src/app/domain/months.ts`):

- One block per month of the year so far, with income, costs and profit and a status word, then **Year so far**. The figures are Taxes › Year's (a line above them says which): booked payments that are not private, net of VAT for a business that charges VAT and as paid for a Kleinunternehmer. Year so far is the same total as Taxes › Year for every sample business, and the two move together when a payment is confirmed, booked or marked private. A payment dated after today is in no month.
- The months before the business's first payment are **one line** ("Jan–Jul, earlier months"), stored per business with its year opening, and count as Closed. A payment dated inside them later (a cash payment from Invoices' Mark as paid) is added to that line and doesn't split it. Taxes › Year still works its "earlier months" label out from the first payment, so in that case the two pages name the months differently, with the same totals.
- Each later month up to the current one follows: the current month is **Running** ("until 31 Oct", and "Ready to close from 1 Nov"); a finished month is **Closed**, or **Not closed** with **Close**. A month's name opens Payments on that month (the existing month filter); the opening line opens nothing.
- Under the months, when it is true: "August and September closed by themselves when their VAT returns were sent".

**Closing a month:**

- **Close** asks first: "Close September 2026?", saying that closing locks the bookings so they can't be changed any more (the Festschreibung is explained on hover or tap). Only the owner and people with full access get the button; for another role (the demo never shows the app as one) a line says who can.
- **The check** is made by the app, in three kinds of line (the bank line comes once for each bank account, so there are more than three when a business has several):
  - **Payments:** every payment of the month is booked and has its receipt, or the count of each kind that still needs the person ("2 to confirm, 1 receipt missing") with **Start** (the review inbox). This **blocks**: **Close September** stays off while a payment of the month needs the person, a missing receipt included, the same rule that blocks sending a VAT return.
  - **Possible duplicates:** "Nothing looks like a duplicate", or how many documents of the month look like one, with **Show** (Documents: it opens that document when exactly one looks like a duplicate, and the list when there are several). A warning only.
  - **Each bank account** (the cash box is left out), judged by what the bank delivered: "Matches the bank" when the connection isn't broken and the bank last delivered on or after the day after the month ended (so every payment of the month was there; a consent that ended later doesn't matter, and Sara Weber Yoga's Qonto, whose consent ended on 20 Oct after a delivery that day, matches for September). "Check it against your statement" for a statement account, a broken connection, and a connection that hasn't been fetched since the month ended. A warning only.
- **Reaching a blocked pop-up:** no finished month of the sample is blocked, so the blocked pop-up needs an edit first. For example, at Sara Weber Yoga open Documents, open the Zoom invoice of 2 September (linked to that day's payment) and choose **Not this payment**: the payment needs its receipt again, and September's pop-up then says "1 receipt missing" with **Start**, with **Close September** off. Linking a receipt to the payment again, or **No receipt needed** on it, unblocks the month.
- **Close September** closes the month. **Not yet**, ✕, Escape and a tap outside leave it as it is. After closing, the cursor goes to the new "Closed" word. If the month stops waiting while the pop-up is open (a VAT return that was still being sent closes it), the pop-up goes by itself and the cursor goes to the new "Closed" word, instead of leaving a Close that does nothing.
- Nothing can be closed that shouldn't be: the running month and months to come have no button, and a month that is closed already, a month of the earlier months line or a month with a payment that needs the person is refused, with nothing changed and no history line added.
- Closing adds a history line to the business: "<month> was closed by <person>" (stored as the month, `YYYY-MM`, and the person's full name). It is stored, not shown yet.

**Closing by a sent VAT return:** sending a VAT return in Taxes closes the months of its period by itself (see Taxes), with no check and no person behind it. A quarter closes its three months. Each month it closes gets its own history line, "<month> was closed by its VAT return" (a line of its own, with no person). A month that was closed by hand before keeps its first date and person and gets no second history line. The note under the months names the months that closed this way.

**Export for your tax advisor:**

- **Period:** Month, Quarter or Year, then a list of what can be exported, newest first: the months that have payments and the running month, the quarters that hold one of those months, and the year. The months list has no entry for the earlier-months line (January to the month before the first payment): its payments are only in the year's export, and in a quarter that reaches back into them. A line says what the export holds, such as "October: 12 bookings, 8 receipts · Running · 7 payments still need you". Bookings are the period's payments that are not private. Receipts are those with their receipt attached, as Payments shows (a part payment of an invoice counts). The state is **Closed**, **Not closed**, **Running** or **Partly closed** (a quarter or the year holding closed months and others).
- When some of them still need the person there are two choices: **Export with them marked as open** (chosen first) or **Fix them first**, with **Start**, which turns the downloads off while it is chosen. When just one payment needs the person the choices read in the singular: **Export it marked as open** and **Fix it first**. The choice starts over with another period. A period with no payments says "Nothing to export yet" and has no downloads.
- **Download DATEV (ZIP)** and **Spreadsheet (CSV)** make no file. A dashed demo box shows the made-up name, `<business-id>_DATEV_<period>.zip` or `.csv` (`weber-design_DATEV_2026-10.zip`, `…_2026-Q4.zip`, `…_2026.zip`), and **Print summary**. DATEV is a format name, so it isn't translated.
- The last line names the tax advisor ("Your tax advisor Jana Hoffmann can download it too, with their own login") when someone has joined with that role; otherwise it points to Settings › People with access.
- **Print summary** (`/print/export/2026-10`, `2026-Q4` or `2026`) opens a page outside the app shell that opens the browser's Print dialog once (choose Save as PDF to keep a file). It lists the period's bookings, oldest first: date, counterparty, amount, SKR03 account with its German name, VAT rate ("No VAT" for a Kleinunternehmer and for a booking at 0 %, a dash while the payment has no booking), receipt **Yes** (attached), **No** (missing) or **Not needed** (the payment was marked as needing none), and **Booked** or **Open** (a payment that still needs the person, with a line explaining Open). On a phone the account, VAT and receipt move under the counterparty's name. A period the card doesn't offer says so and doesn't print.

**For a tax audit:** the GDPdU is explained on hover or tap, and the card says to ask the tax advisor first ("usually their export is enough"). **Download the audit export (ZIP)** shows the same kind of demo box with the made-up name `<business-id>_GDPdU_2026.zip` (the year of the demo's today). It has no print summary.

**Only Reports and Payments respect a closed month** (see Payments). Documents, the review inbox, linking a receipt and Invoices' Mark as paid stay as they are for now: a receipt can still be linked to a payment in a closed month there, and a cash payment can still be dated in one.

**The sample:**

- **Weber Design:** August and September were closed by their VAT returns (sent 8 Sep and 8 Oct), October is running. Year so far is €48,600.00 income and €8,096.99 costs, the same as Taxes › Year. Its October export says 7 payments still need you.
- **Sara Weber Yoga** (Kleinunternehmer): August was closed by hand on 5 Sep. **September is not closed**, so it is the month to close in the demo: its four payments are all booked with receipts, and its Qonto delivered on 20 Oct, after September ended, so every line of the check passes. Closing it locks them in Payments. October is running, with Druckerei Kiezdruck's missing receipt, which would stop October from closing once it ends.
- **Café Linde GbR:** Q2's return was sent, so January to June is the closed earlier months line. July to September are not closed (Q3 is overdue), and sending Q3 from Taxes closes all three. October is running.
- **A business made in the demo:** only October, running, once its tax details are saved and its bank is connected. Its eight payments all still need the person, so its figures stay at €0.00 until they are booked.

Not built: reopening a closed month and correction bookings (the Festschreibung text says only that a later fix is made as a correction in the current month), a reminder to close a month, locking in Documents, the review inbox, receipt linking and Invoices, real DATEV, CSV or GDPdU files (no file is made), the EU sales list (ZM), the trial balance (SuSa) and account sheets, a balance sheet, cost centres, sending the EÜR or the income-tax return, and the tax advisor's own download screen (a sentence on the page says they can download it).

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, restores the sample's closed months and forgets the months closed during the visit. The demo's "today" is 22 Oct 2026.

## Statement import

The import page (`/payments/import`) adds payments from a bank statement file: for an account that has no bank connection, or to add older months to a connected one. It works in English, German and Arabic, and the German term for a bank statement (Kontoauszug) is explained on hover or tap.

**Ways in:** **Import statement** in the Payments toolbar (a button on a computer, in the ⋯ menu on a phone), **Import statement** on a statement account's row in Settings › Bank accounts, and **My bank isn't listed** on Connect your bank. `?account=<id>` names the account. Without it the page first asks which one: a statement account, a connected account ("Add older months"), or **A new account…** (a name and an IBAN, checked for its shape and refused when the business has an account with that IBAN already). The new account is made when the person continues, and stays even if no file is imported after that. Back leads to the page the import was opened from.

**What is simulated:** no file is ever read. Any file dropped on the page, any file chosen, and **Use a sample statement** all do the same thing: they take the next sample statement made for the chosen account, and a line on the page says so. Each account hands out its samples in order, and after the last one hands the last out again, which then shows every payment as already here. Reset demo starts them over. Importing needs no working bank connection, so an account whose connection ended can still take a statement. Every sample is invented, dated October 2026, and keeps clear of each business's opening line and closed months (`src/app/data/sample-statements.ts`):

- **Café Linde GbR, Sparkasse account:** `sparkasse-oktober.csv`, recognised as "Sparkasse CSV", seven rows. Two are the electricity and water payment (15 Oct) and the rent (10 Oct), which the account has already, so they are skipped. Of the five new ones, the bank fee, card sales and insurance book themselves, and two supplier payments (Metro, Krüger) wait for their receipts.
- **Weber Design, "My bank isn't listed":** a new statement account, whatever its name (the form suggests Volksbank), takes `volksbank-oktober.xml`, recognised as CAMT (the bank standard, with its own explanation), four rows. Bäckerei Lange pays RE-2026-039 and names the number in the reference, so the invoice turns Paid by itself. Druckerei Mayer's payment is the one sure match for the receipt already in Documents, so the receipt links by itself. A PayPal payment has no category yet and goes to the review inbox, and the bank's fee books itself.
- **Sara Weber Yoga, Qonto account:** `export_2026-10.csv` has a layout nobody knows, so the person matches its columns (below). Four rows, none in the app yet: a customer, insurance, a shop whose receipt is missing, and the bank's fee. The account's connection needs a new sign-in, but it can still take a statement.
- **A connected account with no sample of its own** (Weber Design's and Café Linde's Qonto, "Add older months"): its own payments of the latest open month, as the bank's CSV (`qonto-2026-10.csv`, "Qonto CSV"). Every row is already here, so nothing is invented and nothing moves; Import stays off and says so.
- **Any other account** (a statement account of a business made in the demo, or one with no sample of its own): `kontoauszug-oktober.xml`, a CAMT file with the eight October payments the demo bank connection brings, each waiting for its receipt. For a business made in the demo, connecting that bank afterwards does not bring those payments a second time, and importing this file after connecting finds them in the connected account, so they are skipped too.

**What the page shows once a file is read:** the recognised format as a chip ("Recognised: Sparkasse CSV", CAMT, or "Unknown layout"), the file name, how many payments it holds and their date range, then **New** and **Already here, skipped** (with **In a closed month, not imported** and **Couldn't be read, not imported** when there are any). **See which** lists each skipped payment beside the payment it matches, as a link, with the account that has it ("Already here · Volksbank"). The first five payments follow as they will appear, and **Import N payments** is the main button.

**Match the columns** shows only for an unknown layout. Each column of the file is a card with its header, its first cells and a choice of what it holds: Date, Amount, Who, What for or Ignore (Money in and Money out when money out has its own column). The choices are guessed first, from the header words (German or English) and from what the cells look like. **Money out is shown as** a minus sign or its own column. It really reads the sample's raw cells (dates as `dd.mm.yyyy`, amounts with a decimal comma), so changing a choice updates the counts and the first rows at once. **Import** stays off, with a line that says what is missing, until Date, Amount and Who are matched. A row that can't be read is counted and left out. A known layout (the Sparkasse CSV, CAMT) has no column step.

**Duplicates:** a row counts as already here when the business has a payment in any of its accounts on the same date, for the same amount, with the same name or the same reference (compared without capitals, extra spaces or the difference between ü and ue). Any account, not only the one the file is imported into: the same payment shows up in a second account of its bank, or in the main account a bank connection filled. A payment of the app matches one row only, so two equal payments in a file stay two while the app has one of them. Skipped rows are never added. When nothing in the file is new, **Import** stays off and says why.

**Closed months:** a row dated in a closed month (closed on the Reports page, or one of the earlier months of the year's opening line) is not imported and gets its own line. A row the account has already is "already here" even in a closed month. No sample touches a closed month, so the line shows only once a month of a file has been closed.

**Importing, and what follows:** **Importing…** shows for about a second, then the summary says "N added · N booked automatically · N need you", with a line for the skipped payments. **Start** (when something needs the person) opens the review inbox, **See the payments** opens Payments on this account, and **Undo import** takes the import back. Each sample row says what the demo's automatic booking decides about it (its category, whether it is confirmed and whether it needs a receipt), as the demo bank connection's payments do, and the app's existing matching does the rest, as the system's own work:

- a payment with no category takes the booking of the business's stored rule for that name, confirmed ("booked by your rule");
- a payment whose reference names an open invoice's number pays it (the invoice turns Paid, or Partly paid); one that only has the amount of an invoice is left to the review inbox;
- the one receipt that surely belongs to a payment is linked to it;
- everything else is left to the review inbox.

Finishing an import ticks the setup's bank step, as connecting does. The homepage counts, Taxes and the year figures follow, because they are calculated from the payments. Balances do not move.

**The Imports list and Undo:** an account that has imports ends with an expandable **Imports (N)** area under its row in Settings › Bank accounts: "22 Oct · sparkasse-oktober.csv · 5 payments", newest first. **Download the file** gives the original again under its own name (the sample CSV, or a small CAMT.053 file made from the rows), and **Undo import** takes the import back, also straight after importing on the summary. Undo removes the import's payments and takes back what automatic matching did with them: a receipt linked on its own waits again, an invoice one of them paid is open again. A line says how many payments were taken out. The account and the bank step stay, and the business's history gets one line. Undo is refused, and the line says why, when:

- **a payment was worked on:** answered, confirmed, recategorised, made private, or linked or matched to an invoice by hand ("Can't be undone: some payments were worked on"). The automatic links do not count. This is said first when both reasons apply;
- **a month was closed since:** a payment of the import sits in a month that has been closed ("Can't be undone: a month it touches is closed").

**The original file** is kept per import, so it can be downloaded again. In the mockup it is rebuilt from the sample statement.

Not built: reading a real file (the sample stands in for it, so no real CSV or CAMT parsing, character sets or separators), MT940, PDF statements, foreign currencies and credit-card statements, and remembering a column layout for the next import.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, takes back every import and the accounts made for them, and starts the samples over.

## Self-issued receipts

A self-issued receipt (Eigenbeleg) is for a payment whose receipt is lost or was never given. It opens from **Write a self-issued receipt** in the Receipt section of a payment (`/payments/:id/self-issued`, a page of its own with a way back to the payment), and from **Receipt lost? Write one yourself** under the answers of the review inbox's "receipt missing" card for money out, which opens the same form in a pop-up on top of the card. It works in English, German and Arabic. The receipt itself is German only and always left to right, whatever the language of the app.

**Who can write one:** money out, with its receipt missing, and not Private. From the payment's page a payment dated in a closed month has no actions, so no button (opening the address by hand goes back to the payment). The review inbox does not look at closed months, as Documents does not either, and in practice a closed month has no payment with a missing receipt, since closing needs every receipt. Money in, and a payment that has a receipt already, can't have one.

**The form:** the payment (name, date, amount) is fixed at the top. **What was it for?** is prefilled in German from the category's name and the payment's reference. **Why is there no receipt?** is required: It got lost, The machine gave none, It was a tip, The seller gave none, or Something else… with a text of its own. **Paid to** shows the payee, and above €150 an optional address field appears. Two notes show where they apply: "No VAT can be claimed back with a self-issued receipt, so this payment's VAT won't count" (when the payment's category has VAT), and above €150 "For larger amounts, ask the seller for a copy first; tax offices question larger self-issued receipts more often" (a note, not a block). The required tick **I confirm this is true** carries the signed-in person's name and today's date. **Create receipt** names what is missing under its field and puts the cursor on the first. **Cancel** (and, in the pop-up, ✕, Escape and a tap outside) leaves everything as it was.

**The tick replaces a signature.** That is the mockup's call: sources differ on whether a digital confirmation is enough for a tax office, so it needs checking with a tax advisor before launch. The paper says who confirmed it and when.

**What it creates:**

- **A numbered receipt:** `EB-{YYYY}-{NNN}` (EB-2026-001, EB-2026-002, …), one above the highest self-issued receipt of the business that year, in three digits. The count is per business and per year, and starts again each year. A receipt that is undone takes its number with it, so none is ever left out.
- **A document in Documents:** received, from the payee, dated as the payment, with the payment's amount, at 0 % VAT, linked to the payment, named after its number (`EB-2026-001.pdf`) and with the status **Done · Self-issued**. Its detail has a "Self-issued receipt" box with **Print**, and shows the receipt itself, in German, as its scan instead of the drawn placeholder.
- **The paper:** `/print/self-issued/:docId`, outside the app shell, opens the browser's Print dialog (choose Save as PDF to keep a file) and has the look of the invoice's paper: the business's name and address, "Eigenbeleg EB-2026-001", then Datum der Zahlung, Betrag, Zahlungsempfänger, Anschrift (when given), Verwendungszweck and Grund für den fehlenden Beleg, "Keine Vorsteuer", and Ausgestellt am and Bestätigt von.
- **The payment:** it counts as booked with the receipt attached, and keeps its category but at **0 % VAT**, with the history line "VAT removed: self-issued receipt". Taxes and the year figures follow: the payment adds no VAT paid to the VAT return. A payment with no category yet gets the mark too, so the category it is given later has no VAT either.
- **The 0 % stays.** Changing the category of such a payment (Change on its page, or an answer in the review inbox) keeps its VAT at 0 %. A learned category rule still uses the category's normal VAT for other payments.

**Locked:** a receipt that is written can't be edited, unlinked or removed (GoBD, as with a sent invoice's document), so its document page offers no Edit, Remove or "Not this payment". A real receipt that turns up later can't be linked to that payment, because it already has one: the document's page says "This payment already has a self-issued receipt." and offers neither the payment search nor **Paid in cash or with my own money** (that would add a second expense) Replacing a self-issued receipt is not in this version.

**Undo:** from the payment's page, "Self-issued receipt EB-2026-001 written" shows for 5 seconds with **Undo**, which takes back the receipt, its number and the 0 % VAT. From the review inbox the card's own Undo (also about 5 seconds) takes back the answer and the receipt the same way, and the card reads "Self-issued receipt added".

**The sample:** Weber Design's APCOA Parking payment (20 Oct, −€6.50, Travel booked at 19 %, "Parkhaus Zentrum, Automat", receipt missing) is the demo, and it also shows in the review inbox. Weber's Deutsche Bahn payment stays the first Documents upload demo, and Sara's Kiezdruck flyer payment keeps the receipt that matches it.

Not built: a self-issued receipt for money coming in or for a sent invoice, editing one after it is created, replacing it with a real receipt, a real signature, and any limit on the amount (there is only the note above €150).

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, takes back every receipt written and the 0 % VAT it took off.

## Paid in cash or with my own money

For a received receipt with no payment in the business account: a cash purchase, or a cost the owner paid privately. It opens from **Paid in cash or with my own money** in the Payment section of a received receipt's detail in Documents. The button shows for a received receipt that is read, has its direction, amount, date and name, does not look like a duplicate, and waits for its payment (Waiting or Overdue). A sent invoice keeps Invoices' **Mark as paid**, and a self-issued receipt has its payment already. It works in English, German and Arabic.

**The pop-up** asks **How was it paid?** with nothing chosen to begin with: **In cash, from the cash box** (Kasse, with its explanation) or **With my own money** (a private card, or cash of your own). **Paid on** is a day from the receipt's date up to today, the receipt's date to begin with, and a day outside says so. **Done** names what is missing and puts the cursor on it. Cancel, ✕, Escape and a tap outside change nothing.

**What it creates:** a money-out payment of the receipt's amount, booked and confirmed with the receipt's category and VAT (none for a Kleinunternehmer), linked to the receipt, with the history line "You marked it as paid in cash" or "…with your own money". It counts for the VAT return and the year figures like any payment. A receipt with no category yet gives a payment with none, not confirmed, so the review inbox still asks. The review inbox has no card for this, and **neither way ticks the bank step**.

- **Cash box:** the payment goes into the Cash box, which the business gets when it has none (a "You added a cash box" line in the history).
- **Own money:** the payment goes into a new account, **Own money**, made when first needed, in front of the cash box. In Settings › Bank accounts it shows with the status Private and the line "Money you paid for the business privately: an owner's deposit (Privateinlage)", which explains the German term. In Payments it is an account you can filter by. It is not part of the homepage balances, since it holds nothing of the business. The receipt's VAT counts, whoever paid it.

**Locked:** the payment is locked to its receipt, as an invoice's payment is. The receipt can't be taken off it: the receipt's page says "This payment was made from this receipt, so the two stay together" instead of "Not this payment". Right after **Done**, the receipt's page shows "Marked as paid in cash" or "Marked as paid with your own money" for 5 seconds with **Undo**, which takes the payment back so the receipt waits again. An account the action made stays after an Undo. Like Documents, it does not look at closed months.

**The sample:** Weber Design's received receipt from Copyshop Kreuzberg (19 Oct, €18.50, office supplies) is the cash demo, and Sara Weber Yoga's from Yogamatten-Shop (12 Oct, €89.00, supplies, no VAT as a Kleinunternehmer) is the own-money demo.

Not built: balances of the cash box and the Own money account (they do not move), cash counts and a cash book report, and a review-inbox card for a receipt with no payment.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, takes back every payment made this way and the accounts it made.

## Help

The Help page (`/help`) is where a person finds an answer without leaving the app: nobody sits behind the software to ask, so the help has to work on its own, in the person's language, at the moment of the question. It opens from the menu (on a phone, under More in the bottom bar) and works in English, German and Arabic (right to left). Its pages: **Help** (`/help`), **one answer** (`/help/<id>`), **German terms A–Z** (`/help/terms`) and **Write to us** (`/help/contact`), all lazy routes inside the app shell. Everything is sample content: the answers, the terms and the replies. The English texts are written from what this mockup does; the German and Arabic texts are drafts for a fluent reviewer. The answers, topics and the map of terms to pages are in `src/app/data/help.ts`, the rules (which questions belong to a page, the search, the A–Z order) in `src/app/domain/help.ts`, and the texts under `help.*` in the translation files. On a phone every card is one column; from 1024 px (`lg`) Help has two.

**The same Help for everyone:** no answer or link depends on the business or on the person's role. The answers say where it matters ("only the owner of the business can invite people", "if your business charges VAT"), and the links (Invite your tax advisor, Let support look) are always shown; the People card itself says who can use them. The one exception is the Kleinunternehmer's Taxes questions (below).

- **Search** ("What do you need help with?") looks, in the language of the page, at the answers' questions and texts and at the terms' German word, translation and explanation, and lists answers and terms together: first the answers whose question matches, then those whose text matches, then the terms whose name matches, then those whose explanation does. Each answer shows its topic; each term is marked **Term**. A line only a screen reader hears says how many results there are. The search is not in the address and is not remembered.
  - **Case, spaces and accents are ignored, and so is the spelling of an umlaut:** ä and ae count as a, ö and oe as o, ü and ue as u, ß as ss. So "ausgangsbeleg" and "Ausgangsbeleg" find the same words, and "ubertragung", "uebertragung" and "Übertragung" all find the Übertragungsprotokoll (the answer about sending a VAT return and the term). The folding is applied to both sides and to English words too, so "due" becomes "du" and also finds "during".
  - **A term in the results** opens German terms A–Z at that term (`/help/terms#<key>`).
  - **Nothing found:** the page says so and offers **Write to us**, which opens Write to us with what was typed already in the message (`/help/contact?q=<text>`).
- **Help for the page you came from** is the first card: "Help with Taxes" with "Because you came from Taxes." and that page's questions. The page is the last one opened outside Help (a small service the app shell starts keeps it in memory, so the menu's Help works from anywhere and the address needs no `?from=`); Help's own pages (an answer, German terms, Write to us) leave it as it was.
  - **Payments** (and the review inbox) → the four questions of Bank and payments. **Documents** → its three. **Invoices** → its three. **Taxes** → the first three of Taxes and year-end (when the VAT return is due, what happens when I send it, why a payment stops me sending it). **Reports** → closing a month, the export for the tax advisor and when the VAT return is due. **Settings** and **My account** → the three of Your account and people.
  - **Getting started:** from the homepage, from a page Help has no questions for (sign-up, Add a business, the print pages) and when Help is the first page opened (a reload on Help), the card is called **Getting started**, has its three questions and no "Because…" line.
  - **A Kleinunternehmer's Taxes questions** (Sara Weber Yoga) start with "What is the Kleinunternehmer limit?", then closing a month and the export for the tax advisor. A Kleinunternehmer has no VAT return, so the two VAT return questions are not offered.
- **Topics:** seven, each with the number of answers it holds: Getting started (3), Bank and payments (4), Receipts and documents (3), Invoices (3), Taxes and year-end (6), Your account and people (3) and Your data and privacy (2), 24 answers in all. A topic opens its questions at `/help?topic=<id>` in place of the Topics card (the page's questions, German terms A–Z, Write to us and the tax-advice line stay), with **All topics** to go back. The browser's back button and an answer's "‹ Help · <topic>" return to it. An address with a topic that doesn't exist shows all the topics.
- **German terms A–Z:** "<count> words from letters and forms, explained." with **Open the list** (`/help/terms`). The count is the length of the one list of term keys (`TERM_KEYS`): 42 today.
- **Write to us:** "We answer in English, German or Arabic." with **Write a message** (`/help/contact`).
- **The tax-advice line:** "We explain how the app works and what German terms mean. For advice on your own taxes, ask a tax advisor (Steuerberater:in)." with **Invite your tax advisor** (Settings › People with access, `/settings#people`). The answers keep to this: they explain how the app works and what German terms mean, and never say what a person should do with their own taxes (the Kleinunternehmer-limit answer sends the question of what to do near the limit to the tax advisor).

**One answer** (`/help/<id>`) has "‹ Help · <topic>" at the top (each part is a link), the question as the title, one to three short paragraphs, then:

- **German words in this answer:** the answer's terms as chips (none when it uses none); tapping a chip explains the term with the same text as everywhere else in the app.
- **A button to the page the answer talks about**, named after where it goes: "Open Taxes", "Open Documents", "Open Invoices", "Open Reports", "Open Payments", "Open Settings", "Open Home", "Open My account" and, for the review inbox, "Open Needs you" (the name its button has in the top bar and in Payments). In German and Arabic the page's name is quoted. A few go further than the page: Connect your bank (`/settings/bank/connect`, the button reads "Open Settings"), New invoice (`/invoices/new`, "Open Invoices"), Settings › Bank accounts and Settings › People with access (`/settings#people`, for inviting the tax advisor, the roles and who can see the books). "How long are my records kept?" has no button.
- **Did this answer your question?** **Yes** is replaced by "Thanks" (the cursor moves there) and nothing is stored. **No, write to us** opens Write to us with the answer's topic chosen and "About: <question>" followed by a blank line in the message.
- An address with no such answer shows "This answer doesn't exist" and **Back to Help**. The page is reused when only the id changes (the browser's back and forward), so the thanks are forgotten then.

The 24 questions:

- **Getting started:** What are the three setup steps? · How do I switch between my businesses? · How do I change the app's language?
- **Bank and payments:** How do I connect my bank? · What does Renew mean on a bank connection? · What does a payment need from me? · What if a payment was private?
- **Receipts and documents:** How do I add a receipt with my phone? · What if a receipt couldn't be read? · What is a self-issued receipt (Eigenbeleg)?
- **Invoices:** How do I write an invoice? · What is an e-invoice (XRechnung, ZUGFeRD)? · What happens when a customer pays?
- **Taxes and year-end:** When is my VAT return due? · What happens when I send my VAT return? · Why does a payment stop me sending my VAT return? · What is the Kleinunternehmer limit? · What happens when I close a month? · How do I send my books to my tax advisor?
- **Your account and people:** How do I invite my tax advisor? · How does the 6-digit code work? · What can each role do?
- **Your data and privacy:** Who can see my books? · How long are my records kept?

Each answer describes what the mockup does, as the sections above describe it, quirks included: the VAT return is said to be due on the 10th even when that is a weekend, and the answers about the VAT return start with "If your business charges VAT".

**German terms A–Z** (`/help/terms`) has a way back to Help, a filter box ("Type a German word or what it means") and then every term the app explains, grouped by the first letter of the German word: Ä counts as A, Ö as O and Ü as U, and the letters and the words within a letter are in German order. The words are the same in every language, so the groups are too (A B C D E F G I K L M P R S U V X Z today). The list is built from the app's own term texts, so a term is explained the same way everywhere, and a term added to the app shows up here by itself.

- Each term shows the **German word** (always left to right and marked as German, so it reads right in Arabic), its **translation** (English and Arabic only: the German page shows just the German word and its explanation, since a translation would say the word twice), the **explanation** the app already uses, and "Appears in: Taxes, Reports …" from a small map of terms to pages (`TERM_PAGES` in `src/app/data/help.ts`; sign-up and Add a business count as Home, Settings and My account as Settings).
- **The filter** looks at the German word, the translation and the explanation in the language of the page, with the same folding as the search ("uebertragung" finds the Übertragungsprotokoll). A line only a screen reader hears says how many terms are left. With no match, "No term matches" and **Show all terms**, which puts the cursor back in the box. The filter is not remembered.
- **`/help/terms#<key>`** (a term in Help's search results) scrolls to that term and puts the cursor on it; nothing sticks to the top of the page, so nothing covers it. An address with a key that isn't a term just shows the list.

**Write to us** (`/help/contact`) has a way back to Help, **Topic** (a menu with "Choose a topic", the seven topics and "Something else"; it is optional), **Your message**, "We answer to <email>, usually within 1 working day." with the signed-in person's own email (there is no field for it), **Send**, a dashed demo box ("Nothing is really sent in this demo.") and the line "To let us look at your books while we help: Settings › People with access › Let support look", whose link opens People with access.

- **Only the message is needed:** at least 10 characters once the spaces around it are taken away, and the "About: <question>" line counts, so Send works straight from an answer's No. Send with an empty or short message names what is wrong under the field ("Write your message.", "Write at least 10 characters.") and puts the cursor in it; the line goes as soon as the person types.
- **Send** shows "Sent. You'll find our answer in your email." with **Back to Help** in place of the form (the cursor moves to the note). Nothing is sent or stored: a reload shows the form again, filled in as the address says.
- **The address fills in parts of the form:** `?topic=<topic or other>` chooses the topic (anything else leaves it empty), `?about=<answer id>` starts the message with the About line and a blank line (an id with no answer is ignored), and `?q=<text>` puts the text of a search in the message, after the About line when both come. What the person types and chooses stays when the language changes, while a message nobody touched is written again in the new language, since the question is named in the language of the page. Another address for the same page (the browser's back and forward) starts the form again.

**Size:** the four pages are lazy routes, so the first load only grew by the route entries and the service that remembers the page (382.88 → 383.82 kB; the warning budget stays at 650 kB).

Not built: live chat, phone, video guides, a community forum, a status page for bank connections and "what's new" notes; a "?" button on every page and a help panel beside a page (the menu's Help knows where the person came from instead); message history, attachments and replies in the app. **Nothing is sent**: Send shows "Sent" in a demo box, and the "Let support look" line only links to the People card, whose own switch gives support access. **Nothing is stored:** Yes, the search, the filter and the message live in the page only. The answers are sample texts in the translation files (`help.answers.<id>.q` and `.a`), not a help-centre content system, and the German and Arabic ones are drafts.

Changes live in memory only. A page reload, or **Reset demo** in the demo toolbar, has nothing to take back in Help. The page Help remembers is the one a reload lands on, so a reload on Help itself opens it on Getting started.

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
