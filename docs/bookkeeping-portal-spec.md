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

## Settings: bank connection and tax details

Studied Oct 22, 2026, in the original German, by reading the pages and their structure only. The gear icon next to the user name opens a menu with Unternehmensdaten (company data), Einstellungen (settings), Datenimport (data import), Meine Daten (my data) and Abmelden (log out). Bank connection and tax details are spread over two of these pages.

Our own version of the setup steps and Settings is described in `docs/specs/2026-10-22-setup-and-settings-mockup-design.md`.

### Einstellungen: one long page

Twelve sections on one page, with a contents list at the top: Banken und Zahlungsdienstleister, Überweisungskonten, Kontenverwaltung, Belegübertragung, Schnittstellen und API-Zugang, Kostenstellen / Projektverwaltung, Steuerliche Einstellungen, Automatisierungsregeln, Rechnungseinstellungen, Rechnungsfreigabe, Layout-Einstellungen, Zahlungserinnerungen.

**Banken und Zahlungsdienstleister** (banks and payment providers):

- "Verknüpfen Sie hier Ihre Bankkonten, Kreditkarten und Zahlungsdienstleister wie PayPal, Amazon, eBay und Stripe": bank accounts, credit cards and payment providers are all connected here.
- Each connection is a row with its bank and account (the studied account has one Qonto connection), and **Bearbeiten** (edit) and **Entfernen** (remove).
- **Verbindung hinzufügen** (add connection) opens "Kontenabruf einrichten" (set up account retrieval), from the user's screenshot:
  - A note: current availability of banks and payment providers is in Bilancor's "Banken-Monitoring", and "Wir empfehlen, die Anbindung von Banken über finAPI vorzunehmen".
  - "Anbieter auswählen" (choose a provider), each with **Jetzt einrichten** (set up now): Bankverbindung über finAPI, Bankverbindung über Qwist, PayPal, Stripe, Amazon Marketplace, Amazon Marketplace (manueller Import), and more further down.
  - So the client first picks a technical connection provider (finAPI or Qwist), not their bank.
- **Bearbeiten** opens the connection's window (seen through the browser's translation, so the German names are unknown): "Edit bank details" with "Unlinked bank accounts" (an **Other accounts** button to add further accounts or credit cards from the same bank) and "Linked bank accounts", one row per account with its SKR03 account (1200), an **Import from** date (the date payments are fetched from) and **Remove**. It shows no connection status, no time of the last fetch and no date when the bank consent runs out.

**Überweisungskonten** (accounts for transfers): connected banks can be used to pay invoices from the portal "sofern bankenseitig unterstützt". Other bank accounts can be added by IBAN and then pay "mit dem Sofortüberweisungs-Prinzip (bereitgestellt von finAPI)". Each row can be made the default transfer account or switched off. This confirms that the bank connection runs through **finAPI**.

**Kontenverwaltung** (account management): one list of every account, 1,199 in the studied account, ten per page, with **Neues Konto** and a type filter. The money accounts sit at the top, each with a type and how it is fed:

| Type | Example | How it gets its payments |
| --- | --- | --- |
| Kasse (cash) | Kasse (1), 1000 | "Beleg erzeugt Zahlung": a receipt creates the payment |
| Bank/Geldinstitut | qonto, 1200 | "Anbindung über finAPI" (bank connection) |
| Bank/Geldinstitut | Sparkasse alt (2024-25), 1201 | "Manuelles Konto": no connection, payments come from statement import |
| Sonstiges Basiskonto | EÜR Verrechnungskonto, 1371 | "Beleg erzeugt Zahlung" |
| Sachkonto | 10, 15, 20 … | "Standardkontenrahmen": the whole SKR03 chart of accounts, shown to the client |

**Automatisierungsregeln** (automation rules): an automatic split of fees for payments imported through the connection, with a booking account per provider (finAPI: "ohne VSt."), and **Neue Regel hinzufügen** for the client's own booking rules (not opened).

### Steuerliche Einstellungen (tax settings)

Each field has a ? help text; the texts are already in the page, so they were read without opening them.

| Field | German original | Choices | Help text, in short |
| --- | --- | --- | --- |
| VAT on cash or invoice basis | Besteuerungsart | Ist-Versteuerung / Soll-Versteuerung | Ist: VAT is due when the customer pays ("vereinnahmte Entgelte"); it has to be applied for at the tax office. Soll: due once the work is done or invoiced ("vereinbarte Entgelte"), "verpflichtend ab einem Umsatz von 600.000 €" |
| Profit method | Gewinnermittlungsart | EÜR / Bilanz | The EÜR report is only offered with EÜR and with supplier/customer accounts switched off; the bookings always suit an EÜR made by a tax advisor |
| Start of the financial year | Beginn Wirtschaftsjahr | Day and month, "TT.MM." | — |
| VAT liability | Umsatzsteuerpflicht | Ja / Nein | Not liable: Kleinunternehmer, some freelance professions such as doctors, and associations without business activity |
| VAT ID without VAT liability | (checkbox under Nein) | on / off | For a non-liable business (e.g. Kleinunternehmer) that has a VAT ID to trade within the EU (reverse charge) |
| Default VAT rate on income | Standard-Steuersatz (Erlöse) | ohne USt., 19/16% USt., 7/5% USt., OSS – One-Stop-Shop, USt. (Regelsatz), USt. (ermäßigt), plus two alternative rates | The rate offered first when income is booked |
| Split input VAT | Aufzuteilende Vorsteuer | deaktiviert / aktiviert | Extra tax options for costs shared between taxable and non-taxable parts of the business |

One **Speichern** (save) button for the section.

### Datenimport (data import)

Opens from the gear menu as a window (seen through the browser's translation, so the German names are unknown). Each import has its own button:

| Import | What it takes |
| --- | --- |
| Contacts (CSV) | Invoice contacts |
| Articles (CSV) | Items for invoices |
| Bank statements (CSV) | Bank statements, for accounts with no connection |
| Journal entries (CSV) | Existing bookings, e.g. when moving from another program |
| Accounts receivable/payable (CSV) | Customer and supplier lists |
| Document archive (ZIP) | A ZIP of documents "for automatic processing" |

At the bottom, an import history of the ten most recent CSV imports of bookings and bank statements.

### Unternehmensdaten (company data)

A separate page with four groups and one Speichern:

| Group | Fields |
| --- | --- |
| Allgemeine Firmendaten | Firmenname, Unternehmensform (15 choices: Einzelunternehmen, GbR, OHG, PartG, UG, GmbH, AG, KG, GmbH & Co. KG, Ltd., e.V. …), street, address line 2, postcode, town, country, phone, fax, email, website |
| Rechtliche Angaben | Registergericht, Registernummer, Inhaber |
| Bankverbindung | IBAN, BIC, Kreditinstitut (the account printed on invoices, separate from the bank connection) |
| Steuerliche Informationen | Zuständiges Finanzamt (one dropdown of 615 tax offices), Steuernummer, Umsatzsteuer-ID |

### What the pages show

- **Tax details in two places:** the VAT status and profit method are under Einstellungen › Steuerliche Einstellungen, while the tax office, tax number and VAT ID are under Unternehmensdaten › Steuerliche Informationen. Nothing links the two.
- **No VAT return period:** there is no setting for monthly or quarterly VAT returns, or for a permanent extension (Dauerfristverlängerung). Bilancor leaves the VAT return (UStVA) to the tax advisor, so it never asks.
- **Outdated help and labels:** the help text still gives €600,000 as the limit for cash-basis VAT, which was raised to €800,000 from 2024 (likely). The rate choices still read "19/16%" and "7/5%", left over from the temporary 2020 VAT cut.
- **A 615-entry tax-office list:** one alphabetical dropdown that also contains offices no client deals with (tax investigation, large-company audits). The office could instead follow from the tax number or the postcode.
- **The whole chart of accounts is on show:** 1,199 SKR03 accounts in the settings, ten per page, though a freelancer only ever needs a handful.
- **The IBAN twice:** the bank connection and the company's "Bankverbindung" for invoices are separate entries with no link between them.
- **One long page:** twelve unrelated sections, from bank connections to invoice layout and payment reminders, each with its own Speichern.
- **A technical choice first:** connecting a bank starts with choosing between finAPI and Qwist, a choice a freelancer can't judge; the window itself recommends finAPI.
- **No connection health:** the connection window shows no status, no last fetch and no consent end date, though a bank consent under PSD2 has to be renewed regularly (likely every 90 or 180 days).

### Still to see (needs a click)

The steps after **Jetzt einrichten** (they lead to the bank's own sign-in, so not to be opened in this account) and **Neue Regel hinzufügen**. User management is in the next section.

## Users and access

Studied Oct 23, 2026, in the original German, by reading the account's pages and their structure only, and BuchhaltungsButler's public help pages on users and roles (see Sources).

Our own version of sign-in, people with access and My account is described in `docs/specs/2026-10-23-sign-in-and-accounts-mockup-design.md`.

### What the client sees

The gear menu has two groups: Unternehmen verwalten (Unternehmensdaten, Einstellungen, Datenimport) and Mein Nutzerkonto (Meine Daten, Abmelden). This account has no user management anywhere: not in the menu, not among the twelve Einstellungen sections, and not in Unternehmensdaten.

**Meine Daten** (my data) is one page with three sections, each with its own Speichern:

| Section | German original | What it holds |
| --- | --- | --- |
| Company selection | Firmenauswahl | Aktueller Firmenaccount: a dropdown of the companies this login can reach, to switch to another and save. The help text says that to manage more companies with one login, the "Master" user of each company has to add this login's email as a user. A link removes the login from the company (Firmenverknüpfung aufheben) |
| User account | Nutzerkonto | E-Mail / Benutzername (the login, also the email address) and Passwort ändern |
| Personal details | Persönliche Angaben | Vorname, Nachname, Telefon |

- Help texts for two more fields are in the page, but the fields themselves are not shown. One is **Visma Connect**, "the single sign-on of the Visma group" with several ways to confirm a login (authenticator app, SMS, security key, fingerprint), so BuchhaltungsButler belongs to Visma. The other is a **language** field, whose help only says the chart of accounts' language is set elsewhere. BuchhaltungsButler has both, and Bilancor's version hides them (likely).
- Nothing on the page offers two-factor login or shows where the account is signed in.

**Rechnungsfreigabe** (invoice approval) in Einstellungen is the only place the client meets roles: it is off, and when on, "Mitarbeiter" can only pay an invoice once an "Admin-Nutzer" has approved it.

### How BuchhaltungsButler handles users (from its help pages)

- **Adding a user:** gear icon › Nutzerverwaltung › **Nutzer hinzufügen** opens a window for the email and the role. For someone new, the person adding them then fills in first name, last name and a password; someone who already has a BuchhaltungsButler login just gains access to the company. A grey hourglass shows next to a new user until they confirm their email. The role can be changed and the user deleted later.
- **Six standard roles:**

| Role | German original | In short |
| --- | --- | --- |
| Admin | Admin | Everything, including users, rights, the plan and approving invoices for payment |
| Tax advisor | Steuerberater:in | Everything bookkeeping needs, especially reports and exports, and can edit master data; can't start transfers or create payments |
| Standard user | Standardnutzer:in | Bookkeeping, paying approved invoices, creating invoices |
| Assistant | Assistent:in | Upload, check and sort documents, pay approved invoices, create invoices; no bookings |
| Receipt checker | Belegprüfer:in | Upload and check incoming documents only; no outgoing invoices and no payment accounts |
| Read only | Leserecht | Sees all bookkeeping data and reports; no bookings and no changes |

- **Rights table:** a help page lists about 60 single rights per role in 14 groups, from Paketbuchung (the plan) to Unternehmensdaten, Einstellungen, Belege, Überweisungen, Buchungen, Abschluss (including ELSTER and the GDPdU audit export) and Nutzerverwaltung. Only the Admin manages users and rights, books the plan, edits the company's Bankverbindung and invoice approval, and approves transfers.
- **Custom roles:** Nutzerverwaltung › **Rechteverwaltung** › **Nutzerrolle erstellen** starts a new role from one of the standard roles, then switches single rights on or off. There can be any number of roles.
- **Tax advisor:** the client adds the advisor by email in Nutzerverwaltung, and the advisor signs in with their own login and switches between their clients. One tax-advisor login is included in every plan, kept out of billing by a "Steuerberater" checkbox on the role. Advisors get a free full account by registering and writing to BuchhaltungsButler's support.
- **Several companies, one login** (Mehrmandantenfähigkeit): one main login (Hauptkonto) is made Admin of the other companies. Linking a company takes a support request for a temporary second admin access (5 days), adding the main login as Admin, confirming the email, and removing the old admin. A new company is registered with its own email first, then linked the same way. The company name at the top switches between them.
- **Prices per user:** not on the help pages. Third-party comparisons say the Smart plan includes one user and each further one costs €4.90 a month, and Premium includes five (not confirmed on the official price page).
- **Language:** a third-party comparison lists German as the only interface language (not confirmed).

### What it shows

- **The client is not in charge of their own account:** with no user management in sight, the Admin ("Master") role is most likely held by Bilancor, not by the client (likely). The client can't add a partner, an employee or their own tax advisor, and can't see who else can open their books.
- **Inviting means choosing someone else's password:** a person without a login gets the password the inviter sets, instead of an invitation link to choose their own.
- **Joining a second company is a support case:** the other company's Master has to add you, and linking existing companies needs a 5-day temporary admin from support.
- **Six roles and about 60 rights for a one-person business:** a freelancer mostly needs two things, "my tax advisor can look" and "my partner or assistant can upload receipts".
- **The help contradicts itself:** the rights table marks Leserecht "Ja" for editing documents and their assignment, though the role is described as read-only (likely errors in the help page).
- **German only:** the language field is hidden in this portal, and BuchhaltungsButler appears to be German-only.
- **No login security on show:** no two-factor login and no list of signed-in devices; Visma's single sign-on is hidden.

### Still to see

The Nutzerverwaltung and Rechteverwaltung screens, and the invitation email: none exist in this account. The login and registration pages were not opened, so the account stays signed in.

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
- [x] Settings: bank connections, transfer accounts, account management, tax settings, company data, the first connection screen and Datenimport (Oct 22, 2026); users and access through Meine Daten and the public help, since the account has no user management (Oct 23, 2026)
- [ ] Settings: invoice numbering, invoice approval, layout, payment reminders, API (with Invoicing)

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
- BuchhaltungsButler help on users, October 23, 2026: [Nutzerverwaltung und Rechtevergabe](https://wissen.buchhaltungsbutler.de/hc/de/articles/11453993512733-Nutzerverwaltung-und-Rechtevergabe-nutzen), [rights of the standard roles](https://wissen.buchhaltungsbutler.de/hc/de/articles/13110056377245-%C3%9Cbersicht-Einzelne-Rechte-der-Standard-Nutzerrollen), [custom roles](https://wissen.buchhaltungsbutler.de/hc/de/articles/13124377471133-Individuelle-Nutzerrolle-erstellen), [tax-advisor access](https://wissen.buchhaltungsbutler.de/hc/de/articles/11446168108957-Steuerberater-Zugang-einrichten), [several companies](https://wissen.buchhaltungsbutler.de/hc/de/articles/11453965304349-Mehrmandantenf%C3%A4higkeit-verstehen-und-nutzen)
- BuchhaltungsButler per-user prices and language (third-party, not confirmed): [quasa — Lexware Office or BuchhaltungsButler](https://quasa.io/de/media/lexware-office-oder-buchhaltungsbutler-bilanzierung-kostet-deutlich-mehr), [trusted.de — BuchhaltungsButler vs billomat](https://trusted.de/buchhaltungsbutler-vs-billomat-buchhaltung)
