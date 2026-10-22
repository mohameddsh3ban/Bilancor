# Taxes page and tax reminder — clickable mockup (design)

Oct 22, 2026 · Status: ready for approval

## Intent

Filing taxes is where the product most clearly goes beyond Bilancor, which leaves it to a tax advisor ([product spec](../bookkeeping-portal-spec.md), phase 2: VAT return and EÜR through ELSTER). The client should never miss a deadline and should understand, in plain words, what they owe and why.

Two parts, as the owner described them:
1. **A reminder** that pops up when the client opens the app, naming the business (the client may have several), with **Got it** (don't show this reminder again) and **Not now** (show it again next time).
2. **The Taxes page**, showing everything needed for the taxes, presented simply.

Like the earlier pages, this is a **clickable mockup with sample data** in `web/`. A sketch (`.superpowers/brainstorm/…/taxes-proposal.html`) was shown to and approved by the owner.

**Build order:** after the Settings page (another session) is merged, because Settings holds each business's tax details (Kleinunternehmer or not; VAT filed monthly or quarterly) and touches the same shared files. Until then the sample businesses' tax profiles are used as they are; the build reads them from wherever Settings stores them after the merge.

## Goals

- Taxes page (menu "Taxes", the homepage tax card/tile's **Open taxes**, the reminder's **Open taxes**) on phone and computer, EN/DE/AR, Arabic right-to-left.
- VAT figures calculated from the booked payments, the same figures everywhere (homepage, review inbox finish line, Taxes).
- A simulated **Send to the tax office (ELSTER)** with a printable receipt.
- The reminder pop-up on opening the app, per business, with Got it / Not now.

## Non-goals

- No real ELSTER connection, certificate or tax ID handling; no real income-tax calculation.
- No applying for the one-month extension (Dauerfristverlängerung) from Taxes (it only follows the Settings switch), no correction returns, no ZM/OSS.
- No sending of the EÜR or income-tax return (year-end; the Year tab is an overview only).
- No paying the tax from the app.

## Anti-goals

- Tax jargon without explanation: German terms always next to the translation, with the existing explain-on-tap (`<app-term>`).
- A number the client can't trace: every VAT-return total links to the payments behind it (the Year tab's January–July line is the one labelled exception, since the sample has no earlier payments).
- A reminder that nags with no way to stop it, or that hides which business it's about.
- Personal tax advice (the product spec forbids it); the page states figures and deadlines only.

## Constraints

Everything from the earlier mockups applies (Angular 22, Tailwind 4, spartan/ui, Transloco, colour tokens, logical layout, `<bdi dir="ltr">` for amounts, Western digits in Arabic, all text in `web/public/i18n/{en,de,ar}.json`, `money`/`appDate` pipes, `<app-term>`, `DEMO_TODAY` = 22 Oct 2026, storage only through `SafeStorage`, phone first, computer from `lg`). Reuse existing pieces (payment status, categories/VAT rates, review inbox Start, print-view pattern from Payments, revenue-limit tracker).

## How the VAT is calculated *(my calls)*

- **Periods:** monthly businesses file per calendar month, quarterly ones per calendar quarter. A return is **due on the 10th of the month after the period ends**.
- **Which payments count:** payments dated in the period whose status is *Booked*. Payments that aren't booked yet are left out and shown as "N payments still need you".
- **VAT part of a payment:** gross amount × rate ÷ (100 + rate), rounded to the cent, using the booking's VAT rate (0 % and private bookings contribute nothing).
  - Money in → **VAT you charged (Umsatzsteuer)**.
  - Money out → **VAT you paid (Vorsteuer)**.
- **Result:** charged − paid. Positive: "You pay €X". Negative: "You get €X back".
- **Current return:** the period right after the latest sent return; with no sent return at all, the period containing today *(my call: so a business that just started charging VAT isn't shown months of overdue returns)*. If that period hasn't ended yet, it's shown as "in progress · so far €X · due <date>" and **can't be sent until it ends** ("Ready to send from 1 Nov").
- **Tax profile from Settings** *(my calls)*: Taxes follows the tax profile the Settings page stores, and its due-date rules — including the one-month extension (Dauerfristverlängerung: due date one month later) and "yearly VAT return only" (no monthly/quarterly returns; the VAT tab shows "Yearly VAT return only · due 31 Jul 2027"). Figures are based on payment dates (Ist), with a small note "Based on payment dates".
- **Weekend deadlines:** the mockup uses the 10th as is, even on a weekend (the real product must move a weekend deadline to the next working day) *(my call)*.
- The homepage tax card/tile and the review inbox finish line show the **current return's** due date and amount from this calculation (replacing the fixed `vatDue` sample number).

## The Taxes page

Route `/taxes`. Phone: one column. Computer: the same sections, two columns where it fits *(builder's call)*.

**Business that charges VAT** — two tabs, **VAT return** and **Year (EÜR)**.

VAT return tab, top to bottom:
1. **Deadline strip:** "<Period> · due <date> (in N days)". Yellow when due within 21 days, red "Overdue since <date>" when past.
2. **Result:** large "You pay €X" / "You get €X back", with "to/from the tax office".
3. **How it adds up:** VAT you charged (Umsatzsteuer) with the number of sales and their net total; VAT you paid (Vorsteuer) with the number of purchases; the result line. **See the payments →** opens Payments filtered to that period *(month filter for monthly; for a quarter, the first month — builder may add a quarter filter if simple)*.
4. **Needs you:** "N payments still need you — fix them so the return is right" with **Start** (review inbox). Hidden when N is 0.
5. **Send to the tax office (ELSTER)** — disabled with "Fix N payments first" while N > 0 (tapping it opens the review inbox).
6. **Sent earlier:** list of sent returns (period, sent date, amount, *Sent* chip), each with **Receipt** (print view).

Year (EÜR) tab: income, costs and profit so far this year, costs grouped by category (translated label + SKR03), income tax set aside (existing sample figure), and the year-end returns with their German terms and "due 31 Jul 2027": EÜR for every business; plus the income-tax return (Einkommensteuererklärung) for a sole trader or freelancer, or the partnership return (Feststellungserklärung) for a GbR; plus the annual VAT return (Umsatzsteuererklärung) for a business that charges VAT *(my calls)*. A line explains that these are prepared at the end of the year.
- **Year figures** *(my calls)*: the sample payments only start in August, so each business gets one opening line for **January–July** (income, costs, and costs per category) stored in the sample data, sized so the year's income matches the existing revenue figure (Sara Weber Yoga: €21,300 in total). August onwards is calculated from booked payments. The January–July line is labelled as earlier months and isn't linked; the August-onwards totals link to Payments.
- **Net amounts:** for a business that charges VAT, income and costs are net (VAT taken out, as the EÜR requires); for a Kleinunternehmer they are the amounts as paid.

**Kleinunternehmer** — no VAT tab: the revenue-limit tracker (existing component), then the Year (EÜR) content above, plus "No VAT return needed".

## Sending (simulated)

**Send to the tax office** opens a check step (sheet/dialog): period, VAT charged, VAT paid, result, and the line "Your return will be sent through ELSTER, the tax office's official channel." Buttons **Send** and **Cancel**.
- **Send:** "Sending…" for about 1.5 s, then "Sent ✓" with **Print receipt**.
- The return moves to *Sent earlier* with today's date (22 Oct 2026) and its amount; history-like record kept in the business so Reset demo restores it.
- The next return becomes current (or "in progress").
- **Receipt (Übertragungsprotokoll):** a print view (outside the app shell, like the Payments print views): business, period, figures, sent date, a made-up transfer ticket number.
- Sent returns can't be changed in the mockup.

## The reminder pop-up

- **When:** once each time the app is opened (page load), and again after **Reset demo**. Shown on top of whatever page opened.
- **Which businesses:** every business of the signed-in person whose current VAT return is due within **21 days** or overdue *(my call: 21 days, so the sample's 10 Nov deadline shows on 22 Oct)*, and that isn't acknowledged for that deadline.
- **Content:** title ("A tax return is coming up" / "Two tax returns are coming up"); one block per business — business name, what (VAT return for <period>), "due <date> · in N days" or red "overdue since <date>", and **Open taxes** (switches to that business and opens `/taxes`, closing the pop-up as Not now).
- **Got it, don't remind me again:** acknowledges every listed reminder (stored per person + business + due date via `SafeStorage`); a later deadline reminds again.
- **Not now** (and ✕, Escape, tapping outside): closes; it shows again on the next app open.
- Reset demo clears acknowledgements.
- Kleinunternehmer businesses get no VAT reminders.

## Sample data *(my calls)*

- Weber Design (monthly): August and September sent (8 Sep, 8 Oct) with amounts from the calculation; **October** is current, in progress, due 10 Nov (19 days → shows in the reminder), ready to send from 1 Nov.
- Café Linde GbR (quarterly): **Q3 (Jul–Sep) not sent yet → overdue since 10 Oct** (decided by the owner, so the demo shows the red reminder, the two-business pop-up and a full send); Q2 sent on 9 Jul. Its booked Q3 payments give the Q3 figures (August–September from the sample payments; July folded into the January–July opening line, or added as a few July payments — builder's call, as long as Q3's figures are plausible and non-zero). The homepage tax card and tile for Café Linde show Q3 overdue instead of 10 Jan; after sending Q3, Q4 becomes current (in progress, due 10 Jan, or 10 Feb with the extension).
- Sara Weber Yoga: Kleinunternehmer, no VAT returns.
- Make sure each business's booked payments give plausible, non-zero VAT figures (adjust sample VAT rates/amounts only if needed, keeping existing homepage/payments tests' meaning).

## Languages

All new text in the three files; German terms via `<app-term>` (UStVA, Umsatzsteuer, Vorsteuer, EÜR, ELSTER, Übertragungsprotokoll). Amounts and dates via the shared pipes.

## Left to the builder

- Where the tax profile lives after the Settings merge (read it from there).
- The form of the check step (sheet or dialog) and the pop-up within spartan/ui.
- The computer layout of the Taxes page.
- The exact wording of messages and the transfer ticket format.
- Whether "See the payments" supports a quarter in one filter or opens the first month.
