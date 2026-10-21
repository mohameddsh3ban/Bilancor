# Homepage — clickable mockup (design)

Oct 21, 2026 · Status: ready for approval

## Intent

The homepage is the first screen a client sees. It shows their latest transactions and the current state of every part of their bookkeeping at a glance. Because the product has no human bookkeeper (see [the product spec](../bookkeeping-portal-spec.md)), the homepage is also where the client handles the few things automation cannot decide.

This document covers a **clickable mockup with sample data**, not the working product. The mockup is the first step of building the product page by page: each page is studied, designed with the product owner, and mocked up before the next one starts. The mockup code is meant to grow into the real frontend, so it uses the real frontend stack.

## Goals

- Show the homepage on a phone (primary) and on a computer, in English, German and Arabic (right-to-left).
- Show two states: a **new client** with no data (setup checklist) and an **active client** (all cards filled).
- Make the homepage's own controls work: language switcher, business switcher, notice buttons, menu, notifications bell.
- Set up the app shell (menu, top bar, layout) that every later page will reuse.

## Non-goals

- No backend, database, login or real bank data. All data is sample data held in the frontend.
- No other pages. Every link to a page not yet designed opens a "coming soon" screen.
- No final visual design. The product owner designs the logo and visual style later; the mockup uses a neutral look that is easy to restyle.
- No roles and permissions (owner, employee, tax advisor). Decided later on the Settings page.

## Anti-goals

- Copying Bilancor's design, wording or code (product spec, "Rules to respect").
- Using real names, amounts or details from the Bilancor account that was studied. Sample data is invented.
- A layout that only works on a computer and is squeezed onto a phone. Phone comes first.

## Tech (decided by the product owner)

| Layer | Choice |
| --- | --- |
| App type | Browser app; phone-style screens on phones, full layout on computers. No native app |
| Frontend | Angular |
| Styling and components | Tailwind CSS + spartan/ui (the Angular version of shadcn/ui) |
| Backend (later, not in this mockup) | Node.js (NestJS) + PostgreSQL |
| Hosting | Decided later |

## Layout

### Phone (chosen: layout B)

From top to bottom:

1. **Top bar:** business switcher with the person's name, notifications bell, language switcher.
2. **Notices** (only when there are any).
3. **Needs your decision:** one line, "3 things need your decision", with a rough time estimate ("about 2 minutes") and a **Start** button.
4. **Latest transactions:** the last 4–5 payments, each with counterparty, date, status chip and amount; **See all →**.
5. **Account balances:** each account (bank accounts, cash box) with its balance, then **Total available**.
6. **Tax overview:** next VAT return with its due date and estimated amount; amount to set aside for income tax.
7. **Fixed bottom bar:** Home · Payments · camera button (raised, centre) · Invoice · More. More opens the rest of the menu.

### Computer (chosen: layout B)

- **Left sidebar:** logo placeholder, **Upload receipt** button at the top (the camera's equivalent), then the menu.
- **Top bar:** greeting, business switcher, notifications bell, language switcher.
- **Notice** as a full-width strip under the top bar.
- **Three key numbers** across the top: Needs your decision (count + Start), Total available (with each account's balance underneath), VAT due (amount and date, with income tax to set aside underneath). For a Kleinunternehmer, the third number is the revenue-limit tracker instead.
- **Latest transactions** at full width below, with columns: date, counterparty, account, booking (account name), status, amount; **See all →**.

The mockups used to choose these layouts are in `.superpowers/brainstorm/` (`homepage-phone-layout.html`, `homepage-desktop-layout.html`), option B in each.

## Cards in detail

| Card | Content | Controls in the mockup |
| --- | --- | --- |
| Notices | One message per notice with one button that fixes it, e.g. "Your Sparkasse connection expires in 5 days · Renew", "New terms from our bank-connection provider · Review", "VAT return due in 3 days · Open" | The button opens "coming soon". Notices that do not block anything can be dismissed; notices that block a feature (like Bilancor's finAPI terms) cannot. Up to 2 notices show stacked, most urgent first; more collapse into "+N more". A dismissed notice moves to the bell's history; dismissals are kept per person and per business in the browser, so they survive a reload *(my call)* |
| Needs your decision | Count of open decisions and a time estimate | Start → "coming soon" (the decision flow is designed later) |
| Latest transactions | Payments with status: Booked, Confirm, No receipt, Unclear. The booking column shows the translated account name with the German SKR03 number and name next to it, e.g. "Phone & internet · 4920 Telefon" (in German: just "4920 Telefon"), following the spec's "German terms kept, then explained" rule | Tapping a row or See all → "coming soon" |
| Account balances | Accounts with balance and last update; total available | Tapping an account → "coming soon" |
| Tax overview | Next VAT return (due date, estimated amount); income tax to set aside. For a Kleinunternehmer, the VAT return is replaced by the revenue-limit tracker (below) | Tapping → "coming soon" |
| Quick actions | Camera / Upload receipt, Invoice | → "coming soon" |

### Kleinunternehmer: revenue-limit tracker

A Kleinunternehmer (§ 19 UStG) charges no VAT and files no VAT return, so the VAT slot has nothing to show. For these businesses (decided by the product owner):

- The desktop's third key number and the phone's tax card show **revenue this year against the Kleinunternehmer limits** instead of VAT due, e.g. "€18,400 of €25,000 this year", with a progress bar.
- The limits (rules since 2025): revenue of at most €25,000 in the previous year and at most €100,000 in the current year. Going over €25,000 this year means no Kleinunternehmer status next year; going over €100,000 ends it immediately.
- The tracker warns as revenue gets close (*my call:* from 80% of €25,000), and the warning also appears as a notice.
- Income tax to set aside stays, as for every business.

## New client (first visit)

A client with no bank connected and no documents sees a **setup checklist** instead of empty cards:

1. Connect your bank
2. Upload your first receipt
3. Add your tax details (Kleinunternehmer or not; VAT filed monthly or quarterly)

Each step shows done or not done. As steps are completed, the normal cards appear *(my call on which card follows which step)*:

| Step done | Cards that appear |
| --- | --- |
| Bank connected | Latest transactions, Account balances (desktop: Total available number) |
| Tax details added | Tax overview (desktop: VAT number) |
| First receipt uploaded | Needs your decision (desktop: decisions number) |

Until all three are done, the checklist stays at the top, under the notices. In the mockup, each step's button opens "coming soon", and a demo switch offers three states so the owner can compare them: **new client** (nothing done), **halfway** (bank connected only) and **active client** (all done).

## Several people and several businesses

- Several people can log in to the same business. The homepage greets each person by name; everyone sees the same numbers.
- One login can belong to several businesses (for example an owner with two businesses, or a tax advisor). A **business switcher** at the top, next to the person's name, picks the business; the homepage always shows one business at a time.
- The mockup has three sample businesses so the switcher can be tried, each with its own sample data: a freelancer who charges VAT, a **Kleinunternehmer** close to the €25,000 limit (to show the revenue-limit tracker and its warning), and a small business with two bank accounts and a cash box.

## Menu (every page)

Home · Payments · Documents · Invoices · Taxes · Reports · Settings · Help

- **Documents** combines Bilancor's Document management and Evidence (to be confirmed when both are studied).
- **Taxes** covers VAT returns and the EÜR.
- **Reports** combines BWA, fixed assets, year-end and controlling.
- **Notifications** are a bell icon in the top bar, not a menu item. The bell keeps a history of past notices; the homepage shows only the ones that still need action. In the mockup, the bell shows an unread count and opens a small panel with sample history for the current business, including dismissed notices *(my call)*. A full notifications page is designed later.
- In the mockup, Home is the only real page; every other item opens "coming soon".

## Languages

Follows the language requirements in the product spec:

- English, German and Arabic; each person picks their own language.
- Arabic mirrors the whole layout right-to-left (sidebar on the right, bottom bar order reversed), while amounts, IBANs and invoice numbers stay left-to-right.
- German tax terms stay visible next to the translation, e.g. "VAT return (UStVA)".
- Amounts in euros, formatted for the chosen language; Western digits (0–9) in Arabic too.
- German tax terms get a short explanation on hover or tap, as the spec requires. This is built now as a reusable part of the app shell, since every page will use it.
- The builder writes the German and Arabic text for the mockup, kept in translation files and marked as draft. A person fluent in each language and in German bookkeeping reviews it before launch, as the spec requires *(my call)*.

## Reviewing the mockup

The mockup runs on a local development server, reachable from the owner's phone on the same Wi-Fi network, so it can be tried on a real phone without choosing hosting yet *(my call)*. On a computer, the browser's device view can show phone sizes.

## Sample data

Invented, and realistic for a German freelancer: a Qonto and a Sparkasse account, a cash box, payments from customers and to typical suppliers (Telekom, Deutsche Bahn, Adobe, Amazon), a mix of statuses, a VAT return due on the 10th of next month. No data from the studied Bilancor account.

## Left to the builder

- Project structure, routing, state management and the translation library.
- The neutral visual style (colours, spacing, icons) within Tailwind and spartan/ui, kept easy to restyle.
- How the new-client / active-client switch and the phone / computer layouts are shown in the mockup (for example a small demo toolbar).
- The breakpoint between phone and computer layouts, and how the layout looks on a tablet.
- The "coming soon" screen's content.
