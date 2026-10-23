# Invoices page — clickable mockup (design)

Oct 23, 2026 · Status: ready for approval

## Intent

Freelancers write invoices every week, and chasing unpaid ones is where money gets lost. The Invoices page (menu "Invoices", already in the phone's bottom bar) does the two things the owner named: **check on invoices** and **create a new one**. It closes the loop with the rest of the product: invoice sent → customer pays → the payment is matched automatically → the invoice turns *Paid* and the VAT return counts it.

Like the earlier pages, this is a **clickable mockup with sample data** in `web/`. A sketch (`.superpowers/brainstorm/…/invoices-proposal.html`: list, one invoice, new invoice) was shown to and approved by the owner ("nothing wrong or missing"), as were the playbacks below.

**Research (Oct 23, 2026, public pages only; Bilancor's account was not touched):**

- **Bilancor (BuchhaltungsButler):** one list holds invoices, quotes and credit notes. Invoices are sent by email, and payments are matched automatically. The e-invoice type is picked when creating the invoice, and a Leitweg-ID is required, typed as "0" when there isn't one. Reminders are thinly documented, and the phone app only scans receipts.
- **sevDesk and Lexware Office:**
  - **Statuses:** Draft, Open, Overdue, Partly paid, Paid.
  - **Speed:** both claim "an invoice in 2 minutes".
  - **Reminders:** manual everywhere; in sevDesk they work on a computer only.
  - **Complaints:** sent invoices are hard to find, so a reminder gets missed.
  - **E-invoice format:** Lexware picks it from the customer.
- **German rules:**
  - **Required contents, § 14 (4) UStG:** both names and addresses, tax number or VAT ID, invoice date, a unique sequential number, what was done and when, net amounts by rate, the VAT rate and amount.
  - **Kleinunternehmer:** no VAT, and a § 19 note.
  - **E-invoices between businesses:** receiving has been required since 2025. Sending becomes required in 2027 when last year's revenue was over €800,000, and from 2028 for everyone. Kleinunternehmer, invoices up to €250 and private customers are exempt. Public offices need XRechnung with a Leitweg-ID.
  - **Corrections:** a sent invoice may not be changed (GoBD). It is cancelled with a cancellation invoice ("Stornorechnung", not "Gutschrift") and reissued.
  - **Numbers:** must be unique. Gap-free within each range is the safe choice.
  - **Retention:** 8 years.
  - **Late payment:** interest is the base rate plus 5 points for consumers or plus 9 for businesses (base rate 1.52 % since 1 Jul 2026).

## Goals

- `/invoices` on phone and computer, EN/DE/AR, Arabic right-to-left:
  - Money owed to the client comes first.
  - Quick filters.
  - A list where overdue invoices offer a reminder right on the row.
- **One invoice:** the invoice as the customer sees it, what happened so far, and the next step.
- **New invoice on one screen:**
  - Customer, lines, dates, and a total that updates as you type.
  - A check that everything the law requires is on it.
  - The e-invoice format chosen automatically from the customer.
- **Simulated sending by email,** a printable PDF view, reminders, cancel and correct, duplicate.
- **Joined up with the existing pages:** Documents, Payments, the review inbox, the homepage, Settings.

## Non-goals (later)

- Quotes that become invoices.
- Recurring invoices.
- Sending by post.
- A separate customers page or a product catalogue.
- Discounts or Skonto on invoices.
- Credit notes for paid invoices.
- Private customers abroad, and the EU summary report (Zusammenfassende Meldung). Business customers abroad *are* in (see below).
- Foreign currencies.
- Logo upload: a "Your logo" placeholder stands in, since the owner designs the brand later.
- Peppol, and real XRechnung/ZUGFeRD XML. The mockup names the format and the file; it doesn't generate XML.

## Anti-goals

- An invoice that is legally incomplete but can still be sent.
- A sent invoice that changes silently.
- The app emailing a customer without the client pressing a button.
- Making the client choose technical formats (XRechnung/ZUGFeRD) or understand them first.
- Invoices that are hard to find once sent, so a reminder gets missed.
- Copying Bilancor's or competitors' design, wording or code.

## Constraints

Everything from the earlier mockups applies:
- Angular 22 (standalone, zoneless, signals), Tailwind 4, spartan/ui (helm components in `web/libs/ui`, including the dialog added for Taxes), Transloco.
- Colour tokens and logical layout; `<bdi dir="ltr">` for amounts, IBANs and invoice numbers; Western digits in Arabic.
- All UI text in `web/public/i18n/{en,de,ar}.json`; the `money`/`appDate` pipes; `<app-term>` for German terms.
- `DEMO_TODAY` = 22 Oct 2026; storage only through `SafeStorage`.
- Phone first, computer from `lg`.
- New routes are lazy-loaded, because the initial bundle is at 594.9 of 600 kB.

Reuse what exists rather than writing new versions:
- the sent documents and their Waiting/Overdue statuses on Documents;
- payment matching and the document picker;
- the review inbox;
- the shared dialog card;
- the print-view pattern (`printOnceRendered`);
- `DemoStateService`'s working copy;
- the Settings tax details (tax number, VAT ID, Kleinunternehmer).

## The list (`/invoices`)

- **Owed to you** card: the total of sent, unpaid invoices and how many, then in red the overdue part and how many. Tapping either part sets the matching filter.
- **Quick filters:** All · Open · Overdue · Drafts · Paid. The Overdue and Drafts chips show a count.
- **Rows:** customer, invoice number and date, amount, and a status chip:
  - *Draft*
  - *Due 30 Oct*, or *Due today*
  - *Overdue 22 days* (red)
  - *Partly paid · €500.00 left*
  - *Paid 20 Oct*
  - *Cancelled*
- **Overdue rows** carry **Send reminder** (or **Send formal reminder** after a first reminder).
- **Order:** drafts and overdue first, then open by due date, then paid and cancelled, newest first.
- **+ New invoice** sits at the top, as the page's main button.
- **Computer:** the same list, with the selected invoice beside it *(builder's call)*.
- **The list's scope:** every invoice the business has sent appears once, here and on Documents (as a sent document), with the same status. The Owed-to-you total counts the same invoices that Documents shows as Waiting/Overdue *(the data shape is the builder's call)*.
  - **Written here:** invoices written in the app, including the sample's.
  - **Added from a file:** a sent invoice made elsewhere and uploaded on Documents. Its row reads "Added from a file" and opens the document on Documents, read-only here *(my call)*.
  - **Not invoices:** money taken into a cash box (cash-register closings).
- **Documents keeps its own statuses** for invoice-backed documents *(my calls)*:
  - Partly paid shows as *Waiting* with "€X left".
  - Cancelled shows as *Done* with "Cancelled".
  - The cancellation invoice is a sent document, "Cancellation of RE-2026-0NN". It is *Done* from the start and never offered as a match for a payment.
- **Locked on Documents:** a document written here can't be edited or removed on Documents. Its detail says "Written in Invoices" and links to the invoice, so a sent invoice can't change silently.
- **Visibility:** Invoices follows Documents in the demo's setup states. Invoices show when their documents would. Writing a new invoice needs the tax details, and until they're done the checklist names that step with a link.

## One invoice (`/invoices/:id`)

- **Header:** customer, status chip, number, amount, due date.
- **The invoice as the customer sees it,** in the invoice's own language (German by default). It is always laid out left-to-right, even in the Arabic UI.
- **What happened:** a history (created, sent by email on …, reminder sent on …, paid on … with a link to the payment, cancelled on … with a link to the cancellation invoice).
- **The next step,** as the main button:
  - Draft → **Preview and send** (or **Edit**)
  - Open → **Download PDF**
  - Overdue → **Send a friendly reminder** / **Send formal reminder**
  - Paid → **Duplicate**
- **Other actions:** Download PDF, Mark as paid *(for cash or payments outside the bank)*, and a ⋯ menu with Duplicate and Cancel invoice.
- **Sent invoices are locked;** only drafts can be edited or deleted.

## New invoice (`/invoices/new`, also used to edit a draft)

One screen, top to bottom:

1. **Customer:** pick a saved customer (recent ones first) or add a new one. A new customer needs a name, an address with country, and an email, plus their kind (for customers abroad, see "Customers abroad"):
   - *Business:* the invoice also carries a ZUGFeRD e-invoice, a PDF with the data inside, so it opens like any PDF.
   - *Private person:* a normal PDF.
   - *Public office:* an XRechnung, and only then the app asks for the **Leitweg-ID**.
   The customer is saved with the first invoice *(no customers page yet)*.
2. **What you did (lines):** description, quantity, unit (pieces, hours, days, flat), unit price. Typing suggests earlier lines with their price. **+ Add a line.** Net, VAT and total update live.
   - **VAT rate:** one rate for the whole invoice, 19 % or 7 %, with 19 % the default for a business that charges VAT *(my call)*. The app books every payment at one VAT rate, so one rate per invoice keeps the VAT return exact. Mixed rates come later.
   - **Kleinunternehmer:** no VAT field anywhere, and the § 19 note is added to the invoice automatically.
3. **Dates:** invoice date (today), when the work was done (a date or a month; the current month by default), and pay within (the default from Settings, 14 days), with the due date shown.
4. **Ready to send:** a checklist that ticks itself:
   - everything § 14 requires is present, or each missing item is named with where to fix it (e.g. "Add your tax number in Settings");
   - the format (PDF / ZUGFeRD / XRechnung) shown as a German term;
   - "Number RE-2026-045 is given when you send".
   Sending is blocked while anything required is missing.
5. **Preview and send:** opens the preview, then the send step.

The draft is saved as you type *(builder's call: on leaving the screen at the latest)*. ✕ asks nothing and keeps the draft.

## Sending (simulated)

- **Send step** (the shared dialog card), showing:
  - **To:** the customer's email.
  - **Subject:** "Rechnung RE-2026-045".
  - **Message:** a ready-written text in the invoice's language, editable.
  - **Attachment:** "RE-2026-045.pdf", plus "(ZUGFeRD e-invoice)" or "RE-2026-045.xml (XRechnung)".
- **Send** shows "Sending…" for about 1.5 s, then "Sent ✓". The invoice gets its number (the next free one in the pattern, gap-free per year) and becomes *Open*, and its sent document appears on Documents, linked.
- **Download PDF** opens a print view of the invoice (`/print/invoice/:id`, outside the shell, prints once), like the Payments and Taxes print views.

## Getting paid

- **Matched automatically:** an incoming payment whose reference contains an open invoice's number is linked to it automatically.
  - Full amount: the invoice becomes *Paid* on the payment date, with a history line and a link to the payment.
  - Less than the total: the invoice becomes *Partly paid · €X left* and keeps counting in Owed to you with what's left. A later payment can complete it, so one invoice can have several payments.
- **Not sure:** when the reference names no invoice but the amount equals one open invoice, the review inbox asks: "Is this the payment for invoice RE-2026-044 from Studio Kern?" The answers are **Yes** / **Pick another** / **No receipt needed**. This builds on the existing "receipt missing" card for incoming payments *(builder's call how)*.
- **Mark as paid:** means paid in cash, with a date. It adds a booked incoming payment to the cash box (creating the cash box if the business has none) and links it. VAT, the year figures and the Kleinunternehmer tracker therefore count it like any payment *(my call)*.
- **Watching it happen in the demo:** on an open invoice, a demo-only control (styled like the demo toolbar, clearly marked DEMO) reads **Simulate the customer's payment** *(my call)*. It adds the matching incoming payment to Payments, so the invoice turns *Paid* in front of you, with the history line. It is shown only when a bank is connected.
- **Taxes:** nothing changes. VAT counts when the money arrives, as the Taxes page already calculates, so a sent invoice appears in the VAT return once it's paid.

## Reminders *(owner's choice: "go with your guess")*

- **The app never writes to a customer on its own.**
- **The nudge:** when an invoice becomes overdue, the client sees a notice, "Bäckerei Lange is 22 days late with RE-2026-039 · Send reminder", which opens the invoice. The Overdue filter and the red total show it too.
  - *(My call: a notice like the existing ones, in the bell and the homepage notices card, rather than a review-inbox card, so the decisions count stays about bookkeeping.)*
  - The notice goes away once the invoice is reminded or paid.
- **Level 1, friendly reminder (Zahlungserinnerung):** a polite ready-written email with the invoice attached, asking for payment within 7 days. One tap through the same send step.
- **Level 2, formal reminder (Mahnung):** offered once level 1 is 7 days old and still unpaid. It is firmer, gives a new date, and mentions that late-payment interest may be charged. It doesn't calculate interest or fees *(my call)*.
- **Between the two levels:** the invoice shows "Reminded 18 Oct · formal reminder possible from 25 Oct" instead of the button.
- **Status doesn't change:** a reminder never changes the invoice's due date, so it stays *Overdue*, and the chip adds "reminded".
- **Two levels in total** *(my call)*. Each reminder adds a history line.

## Mistakes: cancel and correct

- **Cancel invoice** (⋯) on a sent, unpaid invoice asks once ("This creates a cancellation invoice. The original stays on record."). It then:
  - creates a **cancellation invoice** (Stornorechnung): the next number in the same RE- sequence, negative amounts, the original's number and date named;
  - sets the original to *Cancelled*;
  - offers **Make a corrected copy**, a new draft with the same customer and lines.
- Both documents stay on Documents.
- **Paid invoices can't be cancelled** in the mockup. The menu explains that a credit note will come later *(my call)*.
- **Duplicate** makes a new draft with the same customer and lines and today's dates.

## Settings: invoice details

A small new section on the Settings page, with an edit page like the tax details:
- the business's name and address as printed on invoices;
- the bank account (IBAN) printed on invoices, chosen from the connected accounts or typed;
- the email invoices come from (shown only; simulated);
- the number pattern (`RE-{YYYY}-{NNN}`, matching the sample's existing numbers);
- the default payment term (14 days);
- the invoice language (German or English).

The tax number or VAT ID come from the existing tax details. Missing invoice details show up in the new-invoice checklist with a link here.

## Homepage

An **Owed to you** card or tile *(builder's call where, among the existing cards)*: "€3,570.00 owed · €1,190.00 overdue". Tapping it opens Invoices with the matching filter. It is hidden when nothing is owed.

## Links in the app

- The menu and the bottom bar's **Invoices** go to `/invoices`, which is no longer "coming soon".
- On Documents, a sent document that was written here opens its invoice.
- A payment linked to an invoice shows "Pays invoice RE-2026-044" with a link.

## Sample data *(my calls)*

- **Build on the sent documents and incoming payments that already exist,** so numbers match everywhere (the pattern is `RE-2026-0NN`). The invoices sent from the app have customers with addresses and lines.
- **Weber Design** (VAT, freelance):
  - Paid: Müller GmbH and Atelier Sommer GmbH, the invoices behind the existing incoming payments.
  - Open: **Studio Kern RE-2026-044**, €2,380.00, due 30 Oct.
  - Overdue: **Bäckerei Lange RE-2026-039**, €1,190.00, overdue since 30 Sep, not reminded yet. This drives the nudge and the reminder demo.
  - Draft: **Bezirksamt Pankow** (public office, XRechnung, with a Leitweg-ID).
  - Owed to you: €3,570.00, of which €1,190.00 overdue.
  - **The "Is this the payment…?" demo:** one new incoming payment of €2,380.00 from "Kern Studio Berlin" on 21 Oct, with a reference that names no invoice. The review inbox asks whether it pays RE-2026-044. Weber's decisions count goes up by one, deliberately.
- **Café Linde GbR:**
  - Its catering invoices to Firma Dittmar (RE-2026-049, RE-2026-052, and the July one), paid by the existing payments.
  - **One open catering invoice** whose friendly reminder went out more than 7 days ago, so the formal reminder (Mahnung) can be shown.
  - Cash-register closings are not invoices.
- **Sara Weber Yoga** (Kleinunternehmer):
  - Course-fee invoices to Studio Mitte and the workshop invoice to Anna Keller, with the § 19 note and no VAT.
  - **One partly paid invoice** with what's left showing.
- **Kept together:** the demo date is fixed at 22 Oct, so each state (open, overdue, reminded, partly paid, paid, draft, cancelled) needs a sample invoice. A reminder sent during the demo never ages, so level 2 is only reachable on the reminded sample.
- **Invented addresses** for the businesses and customers.
- Existing tests keep their meaning. Counts that change because of new invoices are updated deliberately.

## Languages

- **The app's text** is in all three files.
- **The invoice itself** (paper, email texts, reminder texts) is in **German or English only**, from a small invoice-text dictionary of its own, not the UI translations. Arabic users therefore see a German or English invoice, laid out left-to-right.
- **The invoice's language** is chosen per invoice on the new-invoice screen, defaulting to the Settings choice *(my call)*.

## Customers abroad *(owner's choice: business customers abroad are in)*

The new-customer form asks for the **country**, with Germany as the default.
- **A business in another EU country:**
  - The customer's **EU VAT number** is required, and the checklist names it if missing.
  - The invoice carries no German VAT (0 %) and the note that the customer owes the VAT: "Steuerschuldnerschaft des Leistungsempfängers" in German, "Reverse charge" in English.
- **A business outside the EU** (e.g. UK, US, Gulf): no German VAT (0 %), and a note that the service isn't taxable in Germany ("nicht im Inland steuerbar"). This is the general rule for services to businesses abroad.
- **Not in this version:**
  - Private customers abroad. For a private customer the country stays Germany, and the form says customers abroad are businesses only for now.
  - The EU summary report for reverse-charge sales (Zusammenfassende Meldung).
- **Invoice format:** invoices abroad are plain PDFs, because the German e-invoice duty covers customers in Germany only *(my call)*.
- **VAT return:** these payments carry no VAT, so the VAT figures are right as they stand. A separate box for reverse-charge sales comes with the real ELSTER filing.
- **Kleinunternehmer:** the invoice carries the § 19 note only *(my call; to be checked with a tax advisor, as the product spec asks before launch)*.

## E-invoice format rules *(my calls)*

- **Business customer:** ZUGFeRD. A Kleinunternehmer is exempt from issuing e-invoices and sends a plain PDF.
- **Public office:** always XRechnung with a Leitweg-ID, Kleinunternehmer included.
- **Private person:** a plain PDF.
- **Invoices up to €250** follow the same rules. That is simpler, and the e-invoice is harmless there.

## Size *(my call)*

The initial bundle is at 594.9 of the 600 kB warning budget.
- The pages (list, invoice, new invoice, print view, Settings section) are lazy-loaded.
- The invoices themselves are part of the sample data that loads at start. The homepage card and the overdue notices need them, and partly paid, cancelled and draft states exist only on the invoice.
- If the build then passes the 600 kB warning, the warning budget is raised to 650 kB. The README says so. This is a warning threshold, not a limit users feel.
- **German terms via `<app-term>`:** Rechnung, Stornorechnung, Zahlungserinnerung, Mahnung, Leitweg-ID, E-Rechnung (ZUGFeRD, XRechnung), Kleinunternehmer.

## Left to the builder

- The data shape: an invoice as its own record linked to a sent document, or invoice details on the document.
- The computer layout of the list and the invoice.
- The order of the work, and where the Owed-to-you card sits on the homepage.
- When the draft is saved; how the review-inbox match question builds on the existing card.
- The exact wording, and the look of the invoice paper (simple and clean, with "Your logo").
