# Reports: year-end and exports — clickable mockup (design)

Oct 23, 2026 · Status: draft for approval

## Intent

A freelancer's books end in two places: their own year-end (the EÜR, which Taxes already shows) and their tax advisor's software. Today the mockup has no way to hand the books over, and nothing ever becomes final. This mockup builds the **Reports** page (the menu already lists it as "coming soon"): the year month by month, closing a finished month so its bookings can no longer change, and an export for the tax advisor in the format they read (DATEV).

What a client should feel: **the figures are always right as they stand, and handing them over is one download.** Bilancor's Abschluss page (studied Oct 23, 2026, see the [product spec](../bookkeeping-portal-spec.md#year-end-and-exports-abschluss)) is BuchhaltungsButler's: reports are generated on request and sometimes arrive by email; only confirmed bookings count, with a mere warning; the export for a tax advisor isn't offered to the client at all; "closing" a month in the checklist and locking its bookings are two different things; and BWA, SuSa, ZM and GDPdU sit side by side unexplained. Ours: always up to date, open payments always named, one kind of closing, a plain export.

Like the earlier mockups, this is a **clickable mockup with sample data** in `web/`. No file is really made.

**Build order:** after sign-in and accounts (which waits for the Invoices page), because the export names the business's tax advisor from People with access, and both change the routes, the menu, the translations, the demo state and the sample data.

## Goals

- **Reports** (`/reports`): a "needs you" line, **Month by month**, **Export for your tax advisor**, **For a tax audit**.
- **Always up to date:** every figure is calculated from the bookings as they are; nothing to generate.
- **Never quietly short:** payments that still need the person are counted at the top and in the export, with a way to fix them.
- **One kind of closing:** closing a month locks its bookings (GoBD), after a check we run ourselves. **Sending a VAT return closes the months of its period by itself.**
- **Payments respects a closed month:** its payments can't be changed.
- English, German and Arabic (right-to-left), phone first.

## Non-goals

- No real DATEV, CSV or GDPdU file: a download shows the made-up file name and a printable summary.
- No reopening a closed month and no correction bookings: a later fix "goes into the current month as a correction", said in words only.
- **Only Reports and Payments respect a closed month** (the owner's decision). Documents, the review inbox, linking receipts and Invoices' **Mark as paid** stay as they are for now, so a receipt can still be added to a closed month's payment there, and a cash payment can still be dated in a closed month.
- No EU sales list (ZM), trial balance (SuSa) or account sheets (they travel inside the advisor's export in a real product), no balance sheet (GmbH, later), no cost centres.
- No reminder to close a month; no sending the EÜR or the income-tax return (Taxes says where they go).
- No views per role: the tax advisor's own download is a sentence, not a screen.

## Anti-goals

- A "Generate" button, waiting, or a report by email.
- Figures that leave out open payments without saying so.
- Two things called "closing" that do different things.
- An export blocked or done without the client knowing what's in it.
- Technical names without their explanation (BWA, GDPdU, Festschreibung).
- Tax advice: the audit card tells the person to ask their tax advisor first; nothing recommends what to file.
- Copying Bilancor's or BuchhaltungsButler's design, wording or code.

## Constraints

- The project's mockup rules apply as in the earlier designs: logical spacing utilities only; amounts, file names and dates in `<bdi dir="ltr">`; every status shows a word; German terms through `<app-term>` (new: `bwa`, `gdpdu`, `festschreibung`); translation keys the same in `en`, `de` and `ar`; browser storage only through `SafeStorage`; the demo's today is `DEMO_TODAY` (22 Oct 2026); colour tokens only.
- The figures come from the same calculation as Taxes › Year (`yearSummary` in `domain/tax-year.ts`), so the two pages never disagree: net of VAT for a business that charges VAT, as paid for a Kleinunternehmer, private payments left out.
- Reports is a lazy route; the first-load bundle must not grow.

## The Reports page

Approved as the mockup `reports-page.html` (in `.superpowers/brainstorm/1746-1792758932/content/`). One column on a phone, two from `lg` *(builder: which cards pair up)*.

**Before setup** *(my call)*: until the tax details are saved, the page shows only the same pointer as Taxes (the figures can't be worked out without knowing whether the business charges VAT); once they are saved but no bank is connected yet, it shows "Connect your bank to see your months" with the bank step, as Payments does. A business made during the visit therefore shows its October row only once both are done.

**Needs you.** When payments of the business still need the person (payments only, the count Payments shows, missing receipts included; the homepage's decisions count and the top bar's Needs you button also count documents): "N payments still need you. They aren't in these figures yet; an export marks them as open." with **Start** (the review inbox). Nothing when there are none.

**Month by month** (with `bwa` explained): one row per month of the year so far, with income, costs and profit and a status word:

- The months before the first sample payment are **one line** ("Jan–Jul, earlier months", from the stored year opening), as on Taxes, and count as **Closed** *(my call: they come from before the app)*. The line's months are fixed per business (stored with the opening), not worked out from the first payment, so a payment dated inside them later (a cash payment from Invoices' Mark as paid) is added to that line and doesn't split it *(my call)*.
- Each later month up to the current one; the current one is **Running** ("until 31 Oct").
- A finished month is **Closed** or **Not closed** with **Close**.
- **Year so far** at the bottom, the same total as Taxes › Year.
- A month opens Payments on that month (the existing month filter); the opening line opens nothing.
- "August and September closed by themselves when their VAT returns were sent" appears under the list when that is true.

**Export for your tax advisor:** "Your bookings and receipts in the format tax advisors read (DATEV), or as a spreadsheet."

- Period: **Month / Quarter / Year**, then the month, quarter or year (only those that have payments, and the current one).
- A summary of the period: number of bookings, number of receipts, Closed / Not closed / Running, and the payments that still need the person.
- When some still need the person, two choices: **Export with them marked as open** (chosen first) or **Fix them first** (with **Start**).
- **Download DATEV (ZIP)** and **Spreadsheet (CSV)**. In the demo: a box with the file name (`<business-id>_DATEV_<period>.zip` or `.csv`, e.g. `weber-design_DATEV_2026-10.zip`) and **Print summary**, a printable page outside the app shell listing the period's bookings (date, counterparty, amount, SKR03 account and German name, VAT rate, receipt yes/no, open or booked) *(my call: the summary's columns)*.
- "Your tax advisor <name> can download it too, with their own login." when People with access has a tax advisor; otherwise "Invite your tax advisor in Settings › People with access" *(my call)*.

**For a tax audit** (with `gdpdu` explained): "If the tax office audits you, it may ask for your books in a set format. Ask your tax advisor first: usually their export is enough." **Download the audit export (ZIP)**, for the current year: in the demo, the file name only (`<business-id>_GDPdU_2026.zip`).

## Closing a month

- **Close** opens **Close <month>?**: "Closing locks its bookings: they can't be changed any more" (with `festschreibung` explained), then the check:
  - every payment is booked and has its receipt (none still needs the person, by the app's own rule in `paymentStatus`: an unclear, unconfirmed or receipt-less payment needs the person) — **blocks** closing when it fails, with **Start** and the count of each kind ("2 to confirm, 1 receipt missing"). The owner decided a missing receipt blocks, as it blocks sending a VAT return, so the same rule holds everywhere and a closed month's figures are always complete;
  - "Nothing looks like a duplicate", or the possible duplicates with **Show** (Documents) — a warning;
  - each bank account, by what the bank delivered *(my call)*: "Matches the bank" when the connection isn't broken and the bank last delivered on or after the day after the month ended (so every payment of the month was there, and a consent that ended later doesn't matter); "Check it against your statement" for a statement account, a broken connection, or one that hasn't been fetched since the month ended; the cash box is left out. A warning only.
- **Close <month>** (off while it blocks) and **Not yet**. A warning (a possible duplicate) doesn't stop closing; a payment that still needs the person, a missing receipt included, does.
- The running month can't be closed: "Ready to close from 1 Nov".
- **Sending a VAT return** (Taxes) closes every month of its period that isn't closed yet, without the check: the return can only be sent once every payment in it is booked.
- Closing adds a line to the business's history: `monthClosed` (the month and the person) when a person closed it, or `monthClosedByReturn` (the month only) when sending its VAT return did. The month stays a raw `YYYY-MM` in the line; a screen that shows it formats it.
- A closed month stays closed; **Reset demo** restores the sample's closed months.

## Payments and a closed month

- A payment dated in a closed month keeps all its information but none of its actions (Confirm, No receipt needed, Change, Business / Private), with the line "<Month> is closed, so this payment can't be changed." on its detail.
- Its row shows nothing extra *(my call)*; the month heading in the list shows **Closed**.

## Sample data

- **Weber Design:** August and September closed by their VAT returns (sent 8 Sep and 8 Oct); October running.
- **Sara Weber Yoga** (Kleinunternehmer): August closed by hand on 5 Sep 2026; **September not closed**, so the demo can close it (every check passes: its payments are booked and have receipts, and its Qonto delivered on 20 Oct, after September ended, even though the consent ended that day); October running, with Druckerei Kiezdruck's missing receipt, which would stop October from closing once it ends.
- **Café Linde GbR:** Q2's return was sent, so its months are inside the closed opening line; July to September not closed (Q3 is overdue); October running. Sending Q3 from Taxes closes July to September.
- A business made during the visit: only October, running.

## Languages

Every new screen and message in English, German and Arabic. German terms kept and explained: BWA, GDPdU, Festschreibung, DATEV (a format name, not translated). Amounts, months and file names read correctly inside Arabic.

## Approved mockups

`.superpowers/brainstorm/1746-1792758932/content/reports-page.html`, approved with its guesses (sending a VAT return closes its months; a warning doesn't stop closing, an unbooked payment does), with one change decided afterwards: a missing receipt blocks closing instead of only warning (the mockup's "1 receipt is missing" warning becomes part of the blocking check).

## Left to the builder

- How closed months are stored (per business, a list of `YYYY-MM`) and calculated with the opening line.
- The layout on a phone and a computer, the period picker's exact control, the print summary's look.
- Exact copy within the meaning above; tests in the style of the earlier pages.
