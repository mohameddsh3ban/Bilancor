# Screen & Feature Map — Bookkeeping Portal (MVP)

Oct 21, 2026 · @Z3bola

## Overview

Bilancor sells a human bookkeeping service on top of a digital portal, and the portal is what clients use every day. We sell the software only: clients keep their own books, and automation does the work a bookkeeper does at Bilancor.

**Decision (Oct 21, 2026):** software only, with no bookkeeping service. The client confirms the few cases automation cannot decide, through a review inbox instead of a bookkeeper. Competitors with the same model: sevDesk, Lexware Office, Accountable, Norman, Kontist.

**Market and languages (Oct 21, 2026):** the first client is in Germany, so the product follows German tax rules from day one. The whole product is available in Arabic, English and German from the first release (see Language). We aim for every freelancer and sole trader in Germany, not one community: German speakers, English-speaking expats and Arabic speakers alike.

- **Who they are:** Bilancor GmbH is an external bookkeeping office in Berlin serving freelancers and business owners ([website](https://berlin.bilancor.de/)).
- **Scope of the service:** only booking ongoing transactions, payroll, and payroll tax filings, under § 6 No. 4 of the German Tax Advisory Act (StBerG). Year-end statements and tax returns go to a tax advisor.
- **Marketing promises:** answers within 3 hours at most, a BWA report within 24 hours, a fixed contact person per client, a simple monthly report, and contact via WhatsApp.
- **Price:** a fixed monthly package they claim is about 30% cheaper on average than a tax advisor. The actual price is only given in the first call.
- **Reference point:** the account we studied paid Bilancor €205.63 (including 19% VAT) on October 9, 2026. Not yet clear whether that is a monthly subscription.

The portal is German-only, and we studied it through the browser's auto-translate. So this doc lists each element's original German name where we know it.

## Navigation structure

The sidebar has 10 items in 4 groups; so far we have studied the homepage, the payments page and the document pages. Names are as they appeared in the browser translation, with the German original where we know it.

| Group | Item | German original | Purpose |
| --- | --- | --- | --- |
| — | Homepage | Startseite | Summary of tasks, documents, receivables/payables, BWA figures and balances |
| Documents | Document management | Belegverwaltung | Folder overview of incoming and outgoing documents, and upload (studied) |
| Documents | Invoicing | Rechnungsstellung | Create and send invoices to customers (likely) |
| Accounting | Payments | Zahlungen | Bank transactions, matched to documents and bookings (studied) |
| Accounting | Evidence | Belege | Shortcut to the list of all incoming documents, the same list as in Document management (studied) |
| Fixed assets | Plant management | Anlagenverwaltung | Fixed-asset register with annual depreciation (AfA) |
| Evaluations | Diploma | Abschluss | Year-end statements: balance sheet and profit & loss |
| Evaluations | Controlling (beta) | Controlling | Analytics and KPIs, still in beta |
| — | Notifications |  | Notifications |
| — | Help & Contact |  | Support and contact |

## Homepage

The homepage is a dashboard of 5 card groups, and each card opens the matching page with a filter already applied.

| Card | What it shows | Action |
| --- | --- | --- |
| Open tasks related to payments | Number of payments with open tasks | Show: opens Payments with the Tasks filter |
| Unrecognized incoming documents | Supplier invoices uploaded but not yet matched or booked | Show |
| Unrecognized outgoing documents | Invoices issued to customers, not yet matched or booked | Show |
| Unpaid incoming invoices | Supplier invoices with no linked payment, how many are overdue, and total liabilities | Links to the lists |
| Unpaid outgoing invoices | Customer invoices not yet collected, and how many are overdue | Links to the lists |
| Key business figures | Monthly BWA chart: result, Gesamtleistung (roughly revenue), total costs, cost of goods and services | Create BWA |
| Account balances | Accounts (bank, Kasse cash register) with date of last transaction and balance | — |

- An invoice stays "unpaid" until it is linked to a payment, so a high number may mean unmatched payments rather than real debt.
- The BWA chart shows sample data marked Example until the first report is created, with a link explaining why.

## Payments page

The payments page is the heart of the portal: every bank transaction is a row, and the row's status says whether it has a document and whether it is booked. The studied account has 2,291 payments, grouped by month.

### Toolbar

- **Full-text search:** text search across payments (name, amount, invoice number).
- **Retrieve payments:** pulls new transactions from connected banks (likely).
- **••• menu:** one option, Import bank statement (CSV), to upload a statement manually.
- **Account / Sort by:** pick a specific bank account, and sort order (default: newest first).
- **Missing evidence / Unbooked:** shortcuts for two filters from the filter menu.
- **Filter active / Select filter:** the full filter menu. The label changes to Select filter when no filter is on.
- **✕ and ↻:** clear all filters, and refresh the list.
- **Payments per page:** number of payments per page (25).

### Row columns

| Element | What it shows |
| --- | --- |
| Checkbox | Select several payments for a bulk action, with Select all at the bottom of the page |
| Expand arrow | Payment type (Zahlungsart, e.g. SWIFT Income) and document status with quick links |
| Counterparty and date | Name of the other party, payment date, and bank and account |
| Amount | Black = incoming, red with minus = outgoing |
| Booking box | Buchungstext (booking description) plus account number and name, e.g. 4970 Nebenkosten des Geldverkehrs |
| Tax box | ohne USt./VSt. (no VAT) or the VAT rate, e.g. 19% VSt. |
| ⋮ menu | Payment actions (next section) |
| Document icon | Opens the document-assignment window |
| Status column | Booking status (next table) |

### Statuses

| Look | Original text | Meaning |
| --- | --- | --- |
| Blue document with ! | Dieser Zahlung sind noch keine Belege zugewiesen | No document linked to the payment |
| Yellow light bulb on yellow background | Buchung nicht bestätigt | Booking exists but is not confirmed yet |
| Empty grey circle | ohne Buchung | No booking; the row reads: Es liegen keine aktuellen Buchungen zu dieser Zahlung vor |

### Filters

| Field | German original | Values and notes |
| --- | --- | --- |
| Quick filter |  | Saved filters, created via Create quick filters |
| Period |  | Time range, default Entire period |
| Arrivals/Departures | Eingänge/Ausgänge | Incoming, outgoing, or all |
| Document allocation |  | E.g. missing evidence (no document) |
| Booking status |  | All or unbooked (likely) |
| Booking account |  | Accounting account number |
| Amount |  | A specific amount |
| Suspected duplicate |  | Payments that may be duplicates; "out of" is a translation of aus (off) |
| Comments |  | Payments by whether they have comments |
| Tasks |  | Payments by tasks; used by the tasks card on the homepage |

At the bottom of the menu: Reset selection to reset the fields, Remember selection to keep the filter for next time, then Apply.

## Document assignment and payment actions

Linking documents to payments is the core daily work in the portal: every payment needs documents adding up to its amount, or a mark that it needs none.

### Payment lifecycle (as we understand it)

1. The transaction comes in from bank sync or a CSV file.
2. The system tries to match it to a document automatically.
3. If that fails: manual assignment, a "no document needed" mark, or a self-issued receipt.
4. A suggested booking appears with status "not confirmed" (the yellow light bulb).
5. The booking is confirmed, most likely by the bookkeeping team.

### Document-assignment window

- **Title:** Receipts totaling, then the payment amount, counterparty name and date.
- **Top of the window:** no evidence status, an Upload document link for a new document, and a refresh button.
- **VIEW PAYMENT DETAILS:** opens the payment details inside the window.
- **Suggested documents list:** thumbnail, counterparty, invoice number, amount, date, and a Hinzufügen (Add) button. One payment can settle several invoices.

| Window filter | Meaning |
| --- | --- |
| Outgoing documents | Type of documents shown; follows the payment direction (incoming payment → issued invoices) |
| Period | Time range |
| Test status | Prüfstatus: the document's review status (ungeprüft, unvollständig, geprüft) |
| Payment status | On by default; probably shows unpaid only |
| surgery | OP-Ausgleich, short for Offene Posten: open items, settled or not |
| Amount | Amount |

### ⋮ menu

| Action | Purpose |
| --- | --- |
| Update automatic document assignment | Retry automatic matching |
| Assign supporting documents | Open the document-assignment window |
| Mark payment as paperless | The payment needs no document (Als beleglos markieren) |
| Create self-issued receipt | Self-issued receipt (Eigenbeleg) when the original is lost or never existed |
| Comment | Comment on the payment |
| Create task | Task on the payment; probably counted in the homepage tasks card |

## Document pages

Studied Oct 22, 2026, in the original German (no browser translation), by reading the page and its structure only.

Our own version of the Documents page is described in `docs/specs/2026-10-22-documents-mockup-design.md`.

**The portal is BuchhaltungsButler.** The empty-folder text says documents are sent "zu BuchhaltungsButler", so Bilancor's portal is a white-labelled BuchhaltungsButler. What we study here is BuchhaltungsButler's product, which has public help pages and prices we can read without touching the account.

### Folder overview (Belegverwaltung)

The page at /receipts/ is a list of folders, not documents. Each folder opens the document list with a filter already applied.

| Group | Folder | Notes |
| --- | --- | --- |
| Eingang (incoming) | Alle Eingangsbelege | All supplier invoices and receipts (1,207 in the studied account) |
| Eingang | One folder per money account: Kasse (cash), EÜR Verrechnungskonto, each bank account | The URL carries the SKR03 account number (1000, 1200, 1201, 1371). Cash and the EÜR clearing account show "Beleg erzeugt automatisch Zahlung": with no bank feed, uploading a receipt creates the payment itself |
| Ausgang (outgoing) | Ausgangsbelege | Invoices to customers (53) |

- **Hochladen** (Upload) at the top right opens a "Belege hochladen" window with two drop zones side by side, Eingangsbelege and Ausgangsbelege, each reading "Hier ablegen oder auswählen" (drop here or choose). The client decides the direction for every upload, which may explain the receipts sitting in the wrong folder (see below).
- **+ Konto hinzufügen** (add account) next to a ? button, "Hinweise zur Ordnerstruktur der Eingangsbelege". Its popover says incoming documents are sorted by accounting logic: each document goes to the account of the payment it is linked to. The setting "Beleg erzeugt Zahlung" makes a document assigned to that account create the matching payment directly, for accounts with no online banking, CSV import or other sync (e.g. cash). So the folders always mirror the payment accounts, and creating your own folders is not possible.
- **Evidence (Belege) in the sidebar** links to the same list as Alle Eingangsbelege; it is not a separate page for booked documents.

### Document list

**Toolbar:** back arrow, the title as a dropdown (Eingangsbelege / Ausgangsbelege), Volltextsuche (full-text search), Hochladen, and a ••• menu ("Kontextmenü für Belege") that reads "keine Aktionen verfügbar" with nothing selected; probably bulk actions for selected rows (likely). Second row: Konto (incoming only), three quick checkboxes Duplikatsverdacht / Unbezahlt / Ungebucht, Filter auswählen, ✕ and ↻. The toolbar sticks to the top when scrolling.

**Columns:** Datum, Gegenpartei, Re.-Nummer and Betrag can be sorted. The default order is neither date nor amount, probably upload order (likely).

| Element | What it shows |
| --- | --- |
| Checkbox | Bulk selection, with a floating Alle auswählen at the bottom left |
| Thumbnail | First page of the document; opens the document |
| Counterparty | Name, or a red "Gegenpartei fehlt" when it was not recognised |
| Number and date | Invoice number and document date |
| Badge | Payment status in red Überfällig (due date in the hidden label "Fällig: …") or Bezahlt; or a warning "Erkennung unvollständig" (recognition incomplete) |
| Amount | Gross amount |
| Middle box | Supplier or customer account: "Dieser Beleg ist keinem Kreditor zugewiesen" (incoming) or "… Debitor …" (outgoing) |
| Tasks icon | Aufgaben link |
| ⋮ menu | "Aktionen für den Beleg" (next table) |
| Status circle | Buchungsstatus, one of: anderweitig verbucht, ohne Buchung, Buchung nicht bestätigt, Buchung bestätigt, festgeschrieben, nicht verfügbar. Icon only, with no tooltip on hover |

**Footer:** "1207 Belege gefunden (1207 insgesamt im Ordner)", Belege je Seite (25), and page numbers.

**Row ⋮ menu:**

| Action | Purpose |
| --- | --- |
| Detailansicht öffnen | Open the document detail (below) |
| PDF anzeigen | Show the original file |
| Einzug per Lastschrift | Collect the amount by direct debit (shown on an incoming document too) |
| Bezahlen | Pay the invoice by bank transfer from the portal (transfer accounts via finAPI) |
| Aufgabe erstellen | Create a task on the document |

### Document detail

Opens as a large window over the list, with arrows at the sides to step to the previous or next document.

- **Left:** the scanned document, with a zoom button, and page thumbnails at the bottom.
- **Right:** four steps as collapsible sections, in order:

| Step | German original | What it holds |
| --- | --- | --- |
| Check the document | Beleg prüfen | The read data as a form, with a green tick once checked (fields below) |
| Book the document | Beleg buchen | Only "Es liegen keine aktuellen Buchungen zu diesem Beleg vor" (no bookings for this document yet), with no form |
| Assign a payment | Zahlung zuweisen | A "Zahlung suchen" search box with a list button that opens payment filters, and Weiter (next) |
| Book the payment | Zahlung buchen | Greyed out until a payment is assigned |

**Beleg prüfen fields:**

| Field | German original | Notes |
| --- | --- | --- |
| Document type | Belegtyp | Eingangsbeleg or Ausgangsbeleg, as radio buttons |
| Issuer | Rechnungssteller | Shown for incoming documents |
| Recipient | Rechnungsempfänger | Shown for outgoing documents; for incoming it stays hidden, though it is filled in |
| Invoice number | Rechnungsnummer |  |
| Invoice date, different service date | Rechnungsdatum, Abw. Leistungsdatum | Help text: for DATEV compatibility, the service date may not be after the invoice date |
| Amount, currency, VAT | Betrag, currency (about 50 currencies), UST % | VAT choices 19, 16, 7, 5, 0 % or ausländisch/verschiedene (foreign/mixed) |
| Exchange rate, converted amount | Umrechnungskurs, Umrechn. Betrag | Only for foreign currencies |
| Due date | Fälligkeitsdatum | Help text: a default payment term per supplier can be set in Kontenverwaltung, and the due date is then calculated |
| Comment | Kommentar | Free text |

There is no save button in the form, so it most likely saves each change on its own (likely).

**Payment filters inside Zahlung zuweisen:** Konto, Zeitraum, Zugänge/Abgänge (incoming/outgoing), Belegzuweisung (default "fehlender Beleg": only payments without a document) and Betrag. When nothing is found: "Keine Zahlungen vorhanden", a pointer to the Payments page to import payments, and for payments made from a private account a "Beleg erzeugt Zahlung" link that creates the payment from the document.

**Help texts in the payment steps:**

- Booking the payment directly to an expense or income account is fine when document and payment fall in the same period, but then the document never reaches the supplier account.
- A payment can be linked to several documents; differences such as cash discount (Skonto) or currency are booked with a split booking, and so are overpayments such as tips.
- For an unpaid document, a booking can be prepared in advance (Buchungsvormerkung). It is applied as the booking suggestion as soon as the payment is linked.

- **Bottom bar:** icons for task or comment, PDF, direct debit and pay (the same actions as the ⋮ menu), and Schließen (close).

### Document filters

Read from the page structure without opening the menu. They also settle three guesses from the payments page: Test status is Prüfstatus, surgery is OP (Offene Posten), and the Tasks values.

| Field | Values |
| --- | --- |
| Schnellfilter | Saved filters (none in the studied account) |
| Zeitraum | Gesamter Zeitraum, Frei definierter Zeitraum (von / bis), then every year, quarter and month that has documents |
| Prüfstatus | alle, ungeprüft, unvollständig, geprüft |
| Zahlstatus | alle, unbezahlt (keiner Zahlung zugewiesen), bald fällig, überfällig, bezahlt (Zahlung zugewiesen) |
| Erinnerung | alle, nicht erinnert, 1., 2. or 3. Zahlungserinnerung |
| OP-Ausgleich | alle, OP nicht ausgeglichen, OP ausgeglichen |
| Buchungsstatus | alle, ungebucht, gebucht, nicht festgeschrieben, festgeschrieben |
| Buchungskonto | Free text, "1234; Buchungskonto" |
| Betrag | Free text |
| Kommentare | alle, Ja, Nein |
| Aufgaben | keine Auswahl, alle, offen, erledigt |
| Gelöschte Belege | nicht anzeigen, anzeigen: deleted documents are kept and can be shown again |

At the bottom: Auswahl zurücksetzen, a filter name with Schnellfilter anlegen, Auswahl merken, Abbrechen, Anwenden.

### Ways to add documents

Listed in the empty-folder message ("Noch kein Eingangsbeleg hier, der verarbeitet werden kann …") and in Settings › Belegübertragung.

| Channel | How it works |
| --- | --- |
| Manual upload | Drag files into the widget that Hochladen opens |
| Email | One address per company for incoming and one for outgoing documents (eingang.… / ausgang.…@belege.portal.bilancor.de), plus a list of sender addresses linked to the company |
| Dropbox | A linked Dropbox gets a fixed folder structure; files put there upload in the background |
| GetMyInvoices | Fetches invoices from over 10,000 supplier portals |
| Partners and API | billbee, Dropscan (scanning service), invoicefetcher, GetMyInvoices, Agicap, FLOWWER, Spesenfuchs, Tidely, and an API |

### What the account shows

- **Own sales invoices filed as supplier invoices:** the opened "incoming" document is in fact an invoice the client issued to a customer. Recognition read it correctly (issuer: the client's company, recipient: the customer), yet the document type stayed Eingangsbeleg, so the client's own company became the counterparty. The data needed to catch the mistake was already there. This is why 24 of the 25 incoming documents on the first page show the client's own company name and "Überfällig": they wait for an outgoing payment that will never come, while the real customer payments stay unmatched (likely). The upload window leaves the direction to the client, and nothing checks whether the issuer is the client's own company.
- **Failed recognition, no reason given:** most outgoing documents read "Gegenpartei fehlt" and "Erkennung unvollständig". They are small amounts with shop-style invoice numbers, so they are probably purchase receipts uploaded to the wrong folder (likely). Nothing tells the client what to fix.
- **Duplicates get in:** the same invoice number appears twice in the outgoing list. Duplicate suspicion is only a filter, not a warning at upload.
- **No supplier accounts:** no document on the first pages is assigned to a Kreditor or Debitor, so the middle column repeats the same grey sentence on every row.
- **Old "overdue" invoices:** many invoices from 2024 still read Überfällig, most likely paid but not linked to a payment (as on the homepage).
- **Icon-only status:** the booking-status circle has no label or tooltip.

### Still to see (needs a click)

The ••• menu with documents selected, Zahlung buchen once a payment is assigned, and Beleg buchen on a document that has a booking. None of these can be seen in this account without changing data.

## Screens still to explore

7 items are still unopened. Explore by reading and hovering only, with no button that changes data.

- [x] Document management: folders, list, filters, upload window, menus, document detail with its four steps, and ways to upload (Oct 22, 2026)
- [ ] Invoicing: steps to create an invoice, templates, and e-invoice support
- [x] Evidence: the same list as Alle Eingangsbelege (Oct 22, 2026)
- [ ] Plant management: adding an asset and how depreciation is shown
- [ ] Diploma: what the client sees of the year-end statements
- [ ] Controlling (beta): which KPIs are shown
- [ ] Notifications: types of notifications
- [ ] Help & Contact: available support channels
- [x] Tasks filter: keine Auswahl, alle, offen, erledigt (seen in the document filters, Oct 22, 2026)
- [ ] Settings (gear icon next to the user name): users and bank connections. Settings › Einstellungen is one long page: banks, transfer accounts, chart of accounts, Belegübertragung, API, cost centres, tax settings, automation rules, invoice numbering, invoice approval, layout, payment reminders

## Technical and legal foundation

The UI is the easy part; the real difficulty is in 8 backend components and in the rules of the German market. With no bookkeeper, the matching and booking engines carry the product.

| Component | Purpose | Counterpart in the portal |
| --- | --- | --- |
| Bank connection | Pull transactions via Open Banking (PSD2) through a provider such as finAPI, Tink or GoCardless, with CSV import as a fallback | Retrieve payments, Import bank statement |
| Document intake | Upload files and read their data automatically: counterparty, amount, date, VAT. E-invoices (XRechnung/ZUGFeRD) are read exactly | Document management, Upload document |
| Matching engine | Match documents to payments automatically; unclear cases go to the review inbox | Yellow light bulb, document-assignment window |
| Booking engine | German chart of accounts and VAT calculation, learning from past bookings. The account numbers we saw (4970, 4955, 8195) most likely follow SKR03 | Booking box and tax box |
| Review inbox | The client's list of decisions automation cannot make: private payment, lost receipt, unclear purpose. Replaces Bilancor's bookkeeper | Tasks (in our product, aimed at the client) |
| Tax filing | VAT return (UStVA) and EÜR sent through ELSTER's official interface (ERiC) | Not offered by Bilancor; their tax advisor files |
| Reports | BWA, fixed-asset register and depreciation, and year-end preparation | Key business figures, Plant management, Diploma |
| Export | DATEV-format export for clients who still use a tax advisor, especially for a GmbH's year-end | Not seen yet |

**How far automation goes**

| Part | Fully automatic? | Note |
| --- | --- | --- |
| Pulling bank transactions | Yes | Via the bank connection provider |
| Reading receipts | Mostly | Very accurate on clear invoices; exact on e-invoices |
| Matching receipts to payments | Mostly | The rest needs a quick confirmation in the review inbox |
| Choosing account and VAT rate | Mostly | Unusual cases need the client to confirm |
| VAT return (UStVA) | Yes | Through ELSTER (ERiC) |
| EÜR for freelancers and sole traders | Yes | The simplest year-end case |
| BWA and dashboard | Yes | Calculated from the bookings |
| GmbH balance sheet and E-Bilanz | Hard | Needs judgment (accruals, provisions, valuation); most GmbHs still use a tax advisor |
| Payroll | Hard | Needs ITSG-certified software for social insurance reporting; integrate a provider or leave out |

**Rules to respect** (general understanding, not legal advice):

- **GoBD:** German rules for digital bookkeeping. No changing a booking without a trace, a full change log, keeping documents for up to 10 years, and a written description of how the system works (Verfahrensdokumentation). An IDW PS 880 audit is the usual proof, as competitors show.
- **§ 6 No. 4 StBerG:** applies only to keeping books as a service for others. With software only, the client keeps their own books, so no qualified bookkeeper is needed. The terms of use must state that the client is responsible for their books and filings.
- **Tax advice:** applying general rules (VAT rates, accounts) is fine. Personal tax recommendations, for example from an AI chat, could count as unauthorized tax advice (StBerG), so the product should not give them.
- **E-invoicing:** XRechnung and ZUGFeRD formats are becoming mandatory step by step for B2B invoices in Germany, so invoicing and intake must support them.
- **Data protection:** comply with DSGVO (GDPR), and sign a data processing agreement (AVV) with each client, as Bilancor does.
- **Design:** build our own design and copy, and do not copy Bilancor's UI or code.

## Opportunities to stand out

The two clearest openings: a multilingual portal, and a published, transparent price instead of "price in the first call". Since we compete with software-only products, not with Bilancor's service, the multilingual angle carries the most weight: Accountable offers English, and we know of no one offering Arabic. The UX lessons from exploring give a ready list of improvements.

### Price

Bilancor does not publish its price. These are German market prices for outsourced bookkeeping, per [TaxDome's article](https://taxdome.com/de-de/blog/buchhaltung-steuerberater-kosten-preise-einflussfaktoren-spartipps) (February 2026):

| Model | Price |
| --- | --- |
| Per document | €0.90 – €1.20 |
| Small-business package (up to 50 documents) | From €45/month |
| Revenue-based (under €100,000/year) | €50 – €200/month |
| Freelancer, 50 – 80 bookings/month | €90 – €120/month |
| GmbH, 150 – 250 bookings/month incl. payroll | €300 – €500/month |
| Bookkeeper hour / tax advisor hour | €50 – €70 / €150 – €300 |

The article also names digital competitors such as Kontist, Finom and sevDesk, which partner with tax firms and offer software and service together.

These are prices for a human bookkeeping service. Our price competes with software-only products instead, which cost far less.

**Software-only competitors** (checked Oct 21, 2026; regular prices per month, excl. VAT, after any intro discount ends):

| Product | Plans | Plan comparable to ours (bookkeeping, UStVA, EÜR) | Notes |
| --- | --- | --- | --- |
| [sevDesk](https://sevdesk.de/preise/) | Free (limited) · Rechnung €12.90 · Buchhaltung €25.90 · Buchhaltung Pro €34.90 | Buchhaltung, €25.90 | Extra user €5.90/month; new customers get 60% off for 12 months on a 24-month term |
| [Lexware Office](https://www.lexware.de/preise/) | S €7.90 · M €12.90 · L €21.90 · XL €32.90 | L, €21.90 | Cancel monthly; payroll add-on from €12.90, business account from €9.90; 50% off for 3 months |
| [Norman](https://norman.finance/de/preise) | Free €0 · Klein €12 · Pro €28 | Pro, €28 (Klein, €12, for Kleinunternehmer without VAT) | Free plan includes AI autopilot and unlimited e-invoices; 3 months free when paying yearly; 75% off for 3 months |
| [Kontist](https://kontist.com/pricing/) | Free €0 · Start €11 · Plus €25 | Plus, €25 | A business bank account, not bookkeeping software on its own; now bundles sevDesk bookkeeping free for 3, 6 or 12 months depending on plan |
| Accountable | Free (5 receipts/month) · Invoicing €9.90 · Bookkeeping €19.90 · Taxes €29.90 · Max €59.90 | Taxes, €29.90 | Not confirmed on the official site, which shows no prices; figures from [Norman's comparison](https://norman.finance/de/en/blog/accounting-software-comparison-germany) and [Fastlancer's review](https://www.fastlancer.org/en/fastlancer-blog/accountable-review/), billed yearly. Offers a tax guarantee up to €500 and an AI tax assistant |

What the market shows:

- The plan that matches our package costs **€21.90 – €29.90 per month** excl. VAT.
- Two competitors (Norman, Accountable) have a permanent free plan, and sevDesk falls back to one after its trial.
- Everyone uses large intro discounts (50 – 75% for the first months) and cheaper yearly or two-year terms.
- Every competitor splits features across 3 to 5 plans. A single package with everything included is itself a difference.

**Decision (Oct 21, 2026):** a fixed monthly package, published openly on the website.

- One price per month, with every feature included: no charge per document or per booking.
- The client knows the full cost up front, unlike Bilancor's "price in the first call".
- Still open: the amount, a yearly-payment discount, and whether a fair-use limit is needed (see Open questions).

### Language

- The portal is German-only, and browser translation produced misleading labels: Diploma (Abschluss), Arrivals/Departures (Eingänge/Ausgänge), surgery (OP), Checkout (Kasse), out of (aus). Whole parts stayed in German.
- A UI in Arabic, English and German, with a short explanation of each German term, serves everyone in Germany: German speakers get a clear product, and English and Arabic speakers get one they can use without a translator.

**Language requirements** (all three languages from the first release):

- **Every screen, message and email** in Arabic, English and German, with each user choosing their own language. Two users of the same business can use different languages.
- **Arabic right-to-left:** the whole layout mirrors (sidebar, tables, icons with direction), while amounts, IBANs and invoice numbers stay left-to-right.
- **German terms kept, then explained:** tax terms show the German original next to the translation, e.g. "Annual profit report (EÜR)", with a short explanation on hover or tap. The client will meet these terms in letters from the tax office.
- **Outputs stay German:** ELSTER filings, DATEV export, account names in SKR03 and invoices to German customers are in German, whatever the UI language. Invoices can optionally be issued in English.
- **Legal texts:** terms of use, privacy policy and AVV in German as the binding version, with Arabic and English translations for reading.
- **Formats:** amounts in euros with German formatting in German (1.234,56 €) and the user's language conventions elsewhere; Western digits (0–9) in Arabic too, to match bank statements and receipts.
- **Translation quality:** tax and accounting terms reviewed by a person fluent in the language and in German bookkeeping, not machine-translated only.

### UX lessons

- **Hidden filter:** the Show button opened Payments with a hidden Tasks filter that stayed on after selecting Missing evidence, giving a misleading empty result. Fix: show every active filter as a removable chip.
- **Empty-result message:** it does not say which filter caused it. Fix: list the active filters in the message, with a "Clear all" button.
- **Unexplained icons:** the meaning of the document icon and the light bulb only appears on hover. Fix: a short label next to the icon, or a fixed legend.
- **Automatic checks:** the system does not warn about tax-inconsistent bookings, such as Kleinunternehmer revenue alongside input-VAT recovery. Fix: validation rules that warn before confirmation.

## Proposed MVP scope

With no bookkeeper, automation is the product, so it starts in phase 1. First customers: freelancers and sole traders who file an EÜR, where full automation works best. GmbHs come later.

1. **Phase 1 — automatic bookkeeping for freelancers**
   - Client accounts and login, with each client's data kept separate
   - Bank connection via Open Banking, with CSV import as a fallback
   - Document upload, with automatic reading of document data
   - Automatic document-to-payment matching and booking suggestions
   - Review inbox for the cases automation cannot decide, plus a "no document needed" mark and self-issued receipts
   - Change log for every booking and document (GoBD)
   - DATEV export for clients who use a tax advisor
   - UI in Arabic, English and German, with each German term explained
2. **Phase 2 — tax filing and checks**
   - VAT return (UStVA) through ELSTER
   - EÜR at year-end through ELSTER
   - Validation rules that warn before confirmation (e.g. Kleinunternehmer with input-VAT recovery)
   - Duplicate detection for payments and documents
   - Verfahrensdokumentation and an IDW PS 880 audit
3. **Phase 3 — reports and expansion**
   - BWA report and the homepage dashboard
   - Invoicing in XRechnung and ZUGFeRD formats
   - Fixed-asset register and depreciation
   - Support for GmbHs (double-entry, year-end preparation for the tax advisor)
   - Payroll through an integrated provider
   - Controlling analytics
   - Mobile app for photographing receipts

## Open questions

The key decision is made: software only. What remains is mostly who we sell to, at what price, and what we build ourselves.

- [x] Sell the software only, or the software plus a bookkeeping service? **Software only** (Oct 21, 2026)
- [x] First market? **Germany, with the UI in Arabic, English and German** (Oct 21, 2026)
- [x] Target segment within Germany? **Everyone: all freelancers and sole traders**, whatever their language (Oct 21, 2026)
- [x] Pricing model? **Fixed monthly package** (Oct 21, 2026)
- [ ] Package price, and whether to offer a discount for paying yearly
- [ ] Does the package need a fair-use limit on bookings or documents?
- [ ] Build every component, or use ready-made services for some (bank connection, document reading, ELSTER filing, payroll)?
- [ ] How do we stand out against sevDesk, Lexware Office, Accountable, Norman and Kontist, beyond language?
- [ ] Which partner tax advisors can we recommend to clients who need one (GmbH year-end)?
- [ ] Is the €205.63 paid to Bilancor a monthly subscription or a one-off invoice?
- [ ] Review Bilancor's terms of use (AGB) before continuing to study the account
- [ ] Consult a lawyer and a tax advisor in Germany before launch

## Sources

- [Bilancor — Berlin homepage](https://berlin.bilancor.de/)
- [TaxDome — bookkeeping and tax advisor costs (February 2026)](https://taxdome.com/de-de/blog/buchhaltung-steuerberater-kosten-preise-einflussfaktoren-spartipps)
- Official pricing pages, October 21, 2026: [sevDesk](https://sevdesk.de/preise/), [Lexware Office](https://www.lexware.de/preise/), [Norman](https://norman.finance/de/preise), [Kontist](https://kontist.com/pricing/)
- Accountable prices: [Norman — accounting software in Germany 2026](https://norman.finance/de/en/blog/accounting-software-comparison-germany), [Fastlancer — Accountable review](https://www.fastlancer.org/en/fastlancer-blog/accountable-review/)
- Screenshots of the portal, October 21, 2026
