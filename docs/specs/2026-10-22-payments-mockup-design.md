# Payments page — clickable mockup (design)

Oct 22, 2026 · Status: ready for approval

## Intent

Payments is where a client sees every bank payment and what each one still needs. Clients come here to **check their latest payments**: to find one payment ("did Müller GmbH pay?", "what is this €49?") and to see that everything is in order. Because the product has no bookkeeper ([product spec](../bookkeeping-portal-spec.md)), the client fixes the few payments automation could not finish, right here.

Bilancor's Payments page is built for a bookkeeper working through thousands of rows (10 filters, paging, tasks for the bookkeeper). Ours is built for a freelancer who is not a bookkeeper: few filters, plain status words, and one-tap fixes.

Like the [homepage mockup](2026-10-21-homepage-mockup-design.md), this is a **clickable mockup with sample data** in the real frontend stack (`web/`), not the working product. This time the payment's own actions really work on the sample data, so the owner can feel the flow.

## Goals

- A Payments list on phone (primary) and computer, in English, German and Arabic (right-to-left).
- One payment's details: full screen on a phone, a side panel next to the list on a computer.
- Working search, quick filters, account and month filters.
- Working actions on sample data: confirm a booking, "no receipt needed", change category, business/private; each adds a history line.
- The homepage reflects the changes (its "Needs you"/decisions count and status chips).
- A print view for one payment and for a month list.
- The homepage's links to Payments become real.

## Non-goals

- No backend, bank connection or real data (sample data only, as on the homepage).
- Not built yet, stays "coming soon": taking a photo, picking a receipt from Documents, self-issued receipts (Eigenbeleg), and the decisions flow behind the homepage's Start button.
- No real PDF file with the receipt image inside; the print view uses the browser's Print / Save as PDF.
- No bulk selection of several payments.
- No paging; the list scrolls.

## Anti-goals

- Copying Bilancor's design, wording or code.
- Bookkeeper features: tasks, comments for a bookkeeper, a "suspected duplicate" filter, 25-per-page paging.
- Status shown only as an icon whose meaning appears on hover (a UX lesson from Bilancor). Every status has a word.
- A filter that is on but not visible (Bilancor's hidden-filter lesson). Every active filter shows as a removable chip.
- Using real names, amounts or details from the studied Bilancor account.

## Constraints

Everything from the homepage mockup still applies: Angular 22, Tailwind CSS 4, spartan/ui, Transloco; the colour convention in `web/README.md`; logical (left/right-free) layout so Arabic mirrors; amounts, IBANs and invoice numbers in `<bdi dir="ltr">`; Western digits in Arabic; German tax terms visible next to translations; all text in `web/public/i18n/{en,de,ar}.json` with the same keys; storage only through `SafeStorage`; phone first, computer layout from Tailwind `lg` (1024 px).

**Before this page:** replace the `money()` / `date()` helpers repeated in the homepage cards with shared `money` and `date` pipes that read the current language (a follow-up from the homepage's final review), and use them here.

## The list

Route `/payments`. The menu's Payments item, the phone bottom bar's Payments, the homepage's "See all" and its transaction rows link here (a homepage row opens that payment).

**Top of the page:**
- Title "Payments".
- **Search** box: matches counterparty name, amount and the bank reference (where invoice numbers appear). Amount search accepts what people type: `120`, `120,00`, `120.00`, `-120`.
- **Quick filters**, one active at a time: *All · Needs you (count) · Money in · Money out*. "Needs you" counts payments whose status isn't *Booked*.
- **Account** and **month** filters (all / each account; all / each month in the data). When set, each shows as a chip with ✕; a "Clear all" link appears when any filter is set.
- On a computer: **Download month** (print view of the month currently filtered, or the newest month when none is set).

**The list:**
- Grouped by month, newest first, each group headed by the month and its money in / money out totals.
- Phone: one row per payment — counterparty (truncates; `dir="auto"`), date, status chip with its word, signed coloured amount.
- Computer: a table — date, counterparty, account, booking (translated label + SKR03, as on the homepage table), status, amount. The whole row opens the payment.
- **Empty results** say why: "No payments match" followed by the active filters as chips and "Clear all". With "Needs you" on and nothing left: an all-clear message ("Nothing needs you") and a link to show all payments.

**Before a bank is connected** *(my call, following the homepage's setup states)*: in the demo's "new client" state, Payments shows an empty state, "Connect your bank to see your payments", with a button to the (coming soon) bank step, and "Needs you" is 0. In "halfway" and "active" the payments show. A homepage link to a payment can't happen in "new", since the homepage shows no transactions then.

**Statuses** (word + colour, same as the homepage chips):
| Status | Meaning | Ways to fix it |
| --- | --- | --- |
| Booked | Done | — |
| Confirm | We booked it; confirm our choice | Confirm, or change category |
| Receipt missing | Booked, but no receipt attached | No receipt needed, mark Private, (later: photo, pick from Documents, self-issued receipt) |
| Unclear | We couldn't choose a category | Choose a category, or mark Private |

**How the status is decided** *(my call)*: the status isn't stored; it follows from the payment's state, checked in this order:
1. No category → **Unclear**
2. Category chosen by us and not yet confirmed → **Confirm**
3. Receipt missing → **Receipt missing**
4. Otherwise → **Booked**

So a payment shows one problem at a time, and fixing it reveals the next one if there is one (confirming a booking whose receipt is missing turns it into *Receipt missing*). Choosing a category yourself counts as confirming it. A *Private* payment needs no receipt and has a confirmed category, so it's *Booked*. The sample data starts every *Confirm* and *Unclear* payment with a receipt attached, so each starts with one problem.

## One payment

Route `/payments/:id`. Phone: full screen with a back link to the list (keeping the filters). Computer: the list stays, the payment opens in a panel on the end side (right in English/German, left in Arabic), and the selected row is highlighted.

From top to bottom:
1. **Header:** signed amount (large), counterparty, date, account.
2. **Receipt:** the attached receipt (file name and a placeholder thumbnail), "No receipt needed", or *Receipt missing* with the actions: Take photo (coming soon), Pick from Documents (coming soon), **No receipt needed**, Self-issued receipt (coming soon).
3. **Booking:** category in the user's language with the German SKR03 number and name; VAT rate (for a Kleinunternehmer: "no VAT"); **Change**; a **Confirm** button when the status is *Confirm*; **Business / Private** switch.
4. **Bank details:** IBAN of the other party, bank reference.
5. **History:** newest first, e.g. "17 Oct · Imported from Qonto", "17 Oct · Booked as Travel automatically", "22 Oct · You confirmed Revenue 19 %".
6. **Download PDF:** the print view of this payment.

### Actions and their effects

| Action | Effect |
| --- | --- |
| Confirm | The category counts as confirmed; the status follows the rule above (usually *Booked*). History: "You confirmed <category>". |
| No receipt needed | Receipt becomes "not needed"; the status follows the rule above. History line. |
| Change category | Opens a searchable list of about 15 common freelancer categories (translated label + SKR03 number and name), including every category already used in the sample data. Choosing one sets the booking and its VAT rate and counts as confirmed. History line. |
| Private | Booking becomes SKR03 1800 "Privatentnahmen" (money out) or 1890 "Privateinlagen" (money in), no VAT, no receipt needed, confirmed → *Booked*. Switching back to Business restores the previous category, confirmation and receipt state, so the payment returns to its previous status. History lines both ways. |

All changes live in memory: a page reload, or **Reset demo** in the demo toolbar, restores the original sample data.

**Demo date** *(my call)*: the mockup uses a fixed "today" of 22 Oct 2026, matching the sample data, so new history lines read "22 Oct · …" and tests don't depend on the real clock.

## Print views

- **One payment:** a clean page with business name, the payment's header details, bank details, booking, receipt state and history; opens the browser's print dialog.
- **Month list:** business name, month, account filter (if any), all of the month's payments as a table with totals; opens the print dialog. The quick filter and search don't apply, so the printout is always the whole month *(my call)*.
- Printed in the current language and direction. Navigation, demo toolbar and buttons are hidden when printing.

## Homepage changes

- "See all", transaction rows (to that payment), the menu and bottom-bar Payments items open the real page.
- The decisions count ("3 things need your decision") is now **calculated** from the payments that aren't *Booked*, instead of being a fixed number in the sample data, so it drops as payments are fixed. The homepage status chips use the same live data.
- The decisions Start button stays "coming soon".

## Sample data

- About three months of payments per sample business (August–October 2026), realistic for each business, with all four statuses present for Weber Design and Sara Weber Yoga, and everything *Booked* for Café Linde (it keeps "nothing needs you").
- New fields per payment: the other party's IBAN (made-up), the bank reference (with invoice numbers on customer payments), the receipt state (attached with a file name / missing / not needed), the VAT rate, and starting history lines.
- The homepage's current numbers stay as they are where possible (e.g. Weber Design still starts with 3 payments needing the client), so the homepage looks the same before any change. Sara Weber Yoga's count goes up from 1 to about 3, because it now has all four statuses *(my call)*.

## Languages

New text in all three files. Category labels and statuses are translated; SKR03 names stay German. Arabic mirrors the side panel and the back arrow. The print views follow the current language.

## Left to the builder

- How the list and detail routes are arranged so the computer layout keeps the list beside the panel (nested route or one page reading the id).
- Where the editable sample data lives (e.g. the demo state service holding a working copy of the businesses), as long as the homepage and Payments read the same live data and Reset demo restores it.
- The exact ~15 categories beyond those already in the sample data, and their VAT rates.
- The category picker's form (sheet, dialog or popover) within spartan/ui.
- How the print views are made (separate print routes, or print styles on the existing page).
- The month filter's control and the empty-state wording.
