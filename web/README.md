# Bookkeeping app mockup (web)

Clickable Angular mockup of the bookkeeping app: the homepage, the Payments page, the Documents page and the review inbox (en / de / ar). No backend.
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

- **Setup state** (New client / Halfway / Active client) shows how the homepage and the Payments page look at each stage of setup (in "New client" no bank is connected yet, so Payments has no list).
- **Business switcher** (in the top bar) changes which business is open.
- **Reset demo** brings back every notice you dismissed and the sample payments and documents, and forgets what the review inbox learned (dismissals are remembered in the browser until you reset).

## Payments

The Payments page (`/payments`) opens from the menu (on a phone, from the bottom bar) and from the homepage's "See all" and its transaction rows (a row opens that payment). It works in English, German and Arabic.

What works on sample data:

- **Search** by name, amount or reference. Amounts can be typed as `120`, `120,00`, `120.00` or `-120`.
- **Quick filters** (All, Needs you, Money in, Money out) are the segmented buttons under the search box; the one that is on is highlighted. **Account**, **month** and **search** show as removable chips with ✕, and **Clear all** removes everything.
- **One payment:** full screen on a phone, a side panel beside the list from 1024 px wide. On a computer between 1024 and 1535 px the table has no room next to the panel, so while a payment is open the list layout is shown instead; from 1536 px the table stays.
- **Actions**, where they apply: Confirm, No receipt needed, **Change** (the category), Business / Private. Each adds a line to the history.
- **Print views:** Download PDF (one payment), and Download month (computer only), which prints the selected month, or the newest month when none is chosen, with its account if one is chosen; search and the quick filter don't apply. Both open the browser's Print dialog; choose Save as PDF to keep a file.
- In the "New client" setup state, Payments shows "Connect your bank to see your payments" with a button instead of the list.

**Pick from Documents** (in a payment's Receipt section) opens a list of unlinked documents of the matching direction; choosing one links it (see Documents). A payment with a linked document can't be marked Private: the switch says to unlink the document first. **Open document** on a payment with a linked document opens that document. **Take photo** shows "Reading…" for about two seconds, then links a receipt made from the payment (its name, amount and date); no photo is really read.

Coming soon (the buttons open a placeholder page): Connect your bank, Self-issued receipt.

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

- **Cards:** an unclear payment asks "What was this for?" (its three likeliest categories, **Private**, or **Other category…**); a payment to confirm offers **Yes, that's right** or **Change category**; a payment without a receipt offers **Take a photo**, **Pick from Documents** or **No receipt needed**; a document asks **Keep both** or **Remove this one** (possible duplicate), **Received** or **Sent**, or for the amount, date or name to be typed in. An item with two problems keeps one card and asks the next question in place. Every answer changes the sample data, so Payments, Documents and the homepage follow.
- **Undo** shows for about 5 seconds after each answer and takes it back, with anything it learned or booked. **Skip for now** moves the card to the end of the queue. **✕** (or Escape) closes the inbox and keeps every answer and the skipped order; the next Start carries on with what is left.
- **Learning:** choosing a category for an unclear payment makes a rule for that name ("Amazon will be booked as Office supplies automatically from now on") and books the other unclear payments from it at once. Changing the category of such a payment later updates the rule. Rules belong to one business; **Reset demo** clears them.
- **Take a photo** shows "Reading…" for about two seconds, then adds a receipt made from the payment and links it. No photo is really read.
- When nothing is left, "All done — your books are up to date" shows with a one-line summary (and the next VAT return date, for a business that charges VAT). **Back** returns to the page the person came from.

A phone shows the inbox full screen; a computer shows a centred column over a dimmed page. Everything lives in memory: a page reload or **Reset demo** restores the sample data and starts the inbox over. The slide, tick and check animations stop when the system's reduce-motion setting is on.

## Translations

All text lives in `public/i18n/{en,de,ar}.json`. Every key in `en.json` must also exist in `de.json` and `ar.json`.

German and Arabic text is a **draft**. It must be reviewed by a fluent speaker who knows German bookkeeping before
it is shown to anyone else.

## spartan/ui (helm) components

Generated into `libs/ui/<name>/` and mapped in `tsconfig.json` paths. Import them as:

```ts
import { HlmButton } from '@spartan-ng/helm/button';
```

Available: `button`, `card`, `badge`, `dropdown-menu`, `popover`, `progress`, `tooltip`, `separator` (plus `utils`).
Config is in `components.json` (written by hand, because the generator only offers it interactively).
Add more with `npx ng g @spartan-ng/cli:ui <name> --interactive=false --defaults`.

## Colour convention

Colours come from the shadcn variables in `src/styles.css` (`--background`, `--foreground`, `--primary`, `--muted`,
`--card`, `--border`, ...) plus the project tokens `surface`, `positive`, `negative` and `warning` (each with a
`-foreground` where text sits on it). Use them as `bg-primary`, `bg-muted`, `text-muted-foreground`, `bg-surface`,
`text-positive` and so on. Never hard-code colours.
