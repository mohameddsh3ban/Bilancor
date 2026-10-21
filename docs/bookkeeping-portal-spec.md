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

The sidebar has 10 items in 4 groups; so far we have studied only the homepage and the payments page. Names are as they appeared in the browser translation, with the German original where we know it.

| Group | Item | German original | Purpose |
| --- | --- | --- | --- |
| — | Homepage | Startseite | Summary of tasks, documents, receivables/payables, BWA figures and balances |
| Documents | Document management |  | Upload and organize invoices and receipts (likely) |
| Documents | Invoicing |  | Create and send invoices to customers (likely) |
| Accounting | Payments | Zahlungen | Bank transactions, matched to documents and bookings (studied) |
| Accounting | Evidence | Belege | Accounting documents after they are booked (likely) |
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
| Test status | Probably Prüfstatus: the document's review status |
| Payment status | On by default; probably shows unpaid only |
| surgery | Probably OP, short for Offene Posten: open items |
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

## Screens still to explore

10 items are still unopened. Explore by reading and hovering only, with no button that changes data.

- [ ] Document management: ways to upload documents and document statuses after upload
- [ ] Invoicing: steps to create an invoice, templates, and e-invoice support
- [ ] Evidence: how it differs from Document management
- [ ] Plant management: adding an asset and how depreciation is shown
- [ ] Diploma: what the client sees of the year-end statements
- [ ] Controlling (beta): which KPIs are shown
- [ ] Notifications: types of notifications
- [ ] Help & Contact: available support channels
- [ ] Tasks filter: the values in the dropdown
- [ ] Settings (gear icon next to the user name): users and bank connections

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
