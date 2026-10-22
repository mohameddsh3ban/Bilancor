# Review inbox — clickable mockup (design)

Oct 22, 2026 · Status: ready for approval

## Intent

The product has no bookkeeper ([product spec](../bookkeeping-portal-spec.md)): automation books what it can, and the client decides the rest. Those decisions are spread over Payments (*Confirm*, *Receipt missing*, *Unclear*) and Documents (*Possible duplicate*, *Received or sent?*, *Check amount/date/name*). The review inbox puts them in **one short queue, one decision per card**, so a client can clear everything in two or three minutes, for example while waiting for a coffee. It is the homepage's **Start** button.

What matters most to the owner: **good UX and easy access with no extra steps**, and a feeling that the app is **working through the pile with the client** — it keeps moving, with motion that shows something is happening.

Like the [Payments](2026-10-22-payments-mockup-design.md) and [Documents](2026-10-22-documents-mockup-design.md) mockups, this is a **clickable mockup with sample data** in `web/`, not the working product. A throwaway clickable sketch of the flow (`.superpowers/brainstorm/…/review-inbox-flow.html`) was shown to the owner and approved as the direction.

**Build order:** after the Documents page (built in another session on branch `documents-mockup`) is finished and merged, because the inbox uses its documents, statuses, fixes and simulated adding, and touches the same shared files.

## Goals

- One queue of every decision the client has to make, in date order, as cards — phone first, computer too, in English, German and Arabic (right-to-left).
- One tap per answer wherever possible; the answers really change the sample data, so Payments, Documents and the homepage update.
- Motion that shows progress: progress bar, tick, slide, finish celebration.
- Undo instead of confirmations; skip; leave and come back.
- The app visibly learning from an answer.
- Easy to reach from everywhere.

## Non-goals

- No backend or real automation; learning is a simple rule in the sample data.
- No list or settings page for learned rules (later, on Settings).
- No new fixes beyond those Payments and Documents already have; self-issued receipts and "Paid in cash or privately" stay "coming soon".
- No swipe gestures beyond what's needed to feel natural *(builder's call whether to add swipe-to-skip; buttons always work)*.

## Anti-goals

- Extra steps: an overview screen before the first card, "Are you sure?" pop-ups, or a fix that sends the client to another page they must find their way back from.
- Hidden ordering rules the client can't understand.
- Motion that slows the client down or can't be turned off.
- Copying Bilancor's design, wording or code.

## Constraints

Everything from the earlier mockups applies: Angular 22, Tailwind CSS 4, spartan/ui, Transloco; the colour convention in `web/README.md`; logical layout so Arabic mirrors; amounts, IBANs and invoice numbers in `<bdi dir="ltr">`; Western digits in Arabic; German tax terms next to translations; all text in `web/public/i18n/{en,de,ar}.json` with the same keys; the shared `money` and `appDate` pipes; demo date 22 Oct 2026; storage only through `SafeStorage`. Reuse what Payments and Documents built (actions, statuses, category picker, document picker, simulated adding, `DemoStateService` working copy) rather than writing new versions.

## Ways in

- **"Needs you · N" button in the top bar of every screen** (phone and computer), next to the bell. Hidden when N is 0 *(my call)*. N = payments that aren't *Booked* + documents in Needs you — the same number as the homepage decisions count.
- **Start** on the homepage decisions card and key-number tile (no longer "coming soon").
- **Start** next to the "Needs you" quick filter on Payments, and on the Needs-you box on Documents.

Every way in opens the **first card directly** — no overview screen.

The top-bar button follows the data in every demo setup state *(my call)*: it shows whenever N is above 0 (in "new client" there are no payments, so it only shows if an added document needs the client). The homepage decisions card keeps its current visibility.

## The flow

Route `/review` *(my call)*: a full-screen layer over the app on a phone (covering the bottom bar); on a computer, the same cards in a centred column (about 28rem wide) over a dimmed page. **✕** closes it and returns to where the client came from.

**Top:** ✕, a progress bar, and "2 of 5 · about 4 min left" (minutes: the homepage's existing one-minute-per-decision rule).

**Order:** by date, **oldest first** — the payment date or the document date. No hidden priorities. A payment or document with more than one problem stays on **one card**: after the first answer, the card ticks and shows the next question in place (no slide), and slides away only when that item is done.

**Answering:**
- Big buttons, the most likely answer first and styled as the main button.
- After an answer: a short "Saving…" turns into a green tick with what happened ("Booked ✓", "Receipt added ✓"), the card slides out and the next slides in (the slide runs the other way in Arabic). About half a second in all.
- **Undo** shows at the bottom for about 5 seconds after each answer: it reverts that change (including a learned rule and anything it booked) and brings the card back.
- **Skip for now** moves the card to the end of the queue.
- Leaving with ✕ keeps everything answered (it's already saved) and the skipped order for the rest of the session; the next Start continues with the remaining decisions.

**Finish:** "All done — your books are up to date", a check animation, and a one-line summary ("5 decisions · 1 receipt added · 1 duplicate removed"). For a business that charges VAT, the next line is "Next VAT return due 10 Nov". A **Back** button returns to where the client came from.

**Motion:** every animation under about half a second; with the system's reduce-motion setting on, cards swap without sliding and the check doesn't bounce.

## The cards

Each card shows: what it is ("Payment · please confirm", "Document · check the amount"), the amount (signed and coloured for payments, plain for documents), the counterparty or document name, the date, **one plain question**, and the answers. Documents also show the placeholder "paper" from the Documents page with the unclear spot marked.

| Item | Question | Answers (main one first) |
| --- | --- | --- |
| Payment · *Unclear* | "What was this for?" | The three most likely categories *(builder: carried in the sample data per payment, or the categories most used for similar amounts)*, then **Private, not for the business** — only when the payment has no linked document, since the Documents page doesn't allow a payment with a document to be private *(my call)* — then **Other category…** (the category picker) |
| Payment · *Confirm* | "We booked this as <category>. Is that right?" | **Yes, that's right** · **Change category** (picker) |
| Payment · *Receipt missing* | "There's no receipt for this payment yet." | **Take a photo** · **Pick from Documents** (the document picker, best match first) · **No receipt needed** |
| Document · *Possible duplicate* | "Looks like the one you added on 17 Oct." | **Keep both** · **Remove this one** |
| Document · *Received or sent?* | "Is this a bill you received or an invoice you sent?" | **Received** · **Sent** |
| Document · *Check amount / date / name* | "We couldn't read the amount." | The field on the card (amount accepts `49,90` / `49.90`; date a date input; name text) and **Save** |

**Take a photo** *(my call)*: the card shows *Reading…* for the same time as the Documents page's simulated adding, then creates a plain *Received* receipt **made from this payment** (its counterparty, amount and date, a made-up file name like `photo-2026-10-22.jpg`), links it to this payment, and ticks. It does **not** take an entry from the Documents page's upload pool, so the Documents demo order stays the same, and it never produces a duplicate or a problem document. The document then shows on Documents as *Done*, with "Added by photo" and "Linked to the payment" history lines. The Payments detail page's **Take a photo** button uses the same helper, so it stops being "coming soon" there too.

**Pickers** (category, document) open on top of the card and close back to it; choosing answers the card.

## Learning

When the client chooses a category for an *Unclear* payment **in the review inbox**, the app makes a rule: payments from that counterparty get that category from now on *(my calls: rules are made in the inbox, where the learning is shown; they are kept per business in the demo state; Reset demo clears them)*.
- The card shows the message under the tick: "Got it — Amazon will be booked as Office supplies automatically from now on."
- The rule applies at once to other *Unclear* payments from the same counterparty: they are booked (confirmed) and their cards leave the queue. The message then adds "…and 1 more Amazon payment booked." Each booked payment gets a history line ("Booked as Office supplies by your rule").
- Changing the category of any payment from that counterparty, anywhere, updates the rule.
- Marking a payment **Private** doesn't make a rule.
- No list of rules for now.

## Counts and other pages

- The top-bar button, the homepage decisions count and its time estimate, Payments' "Needs you" count and Documents' Needs-you box all drop as answers are given (same live data).
- After an answer the item's own page shows the result and a history line, as if fixed there.

## Sample data

Uses the payments and documents as they are after the Documents page. Add one more *Unclear* payment for Weber Design from the same counterparty as an existing *Unclear* one (Amazon), so the learning moment can show "…and 1 more" *(my call; the homepage count grows by one)*. Give each *Unclear* payment its three suggested categories.

## Languages

All new text in the three files. Arabic mirrors the layout and reverses the slide direction; amounts stay left-to-right.

## Left to the builder

- How the queue is built and kept (a small service reading the live data), and how Undo snapshots and restores a change.
- The exact animation curves and timings within "about half a second".
- Whether to add swipe-to-skip on phones.
- How "where the client came from" is remembered for ✕ and Back.
- Wording of messages, within the tone of the sketch.
