# Help — clickable mockup (design)

Oct 24, 2026 · Status: draft for approval

## Intent

Help is the last menu item that still opens "coming soon". We sell software only, so nobody sits behind the app to answer a question: the help has to work on its own, inside the app, in the person's language, at the moment of the question.

Bilancor (studied Oct 24, 2026, see the [product spec](../bookkeeping-portal-spec.md#help-and-contact)) has no help inside its portal: "Hilfe & Kontakt" opens its public website, where both the help and the contact page answer 404, and the few help links in its settings lead to BuchhaltungsButler's German knowledge base, with another product's names and plans. What a client should feel with ours: **the answer is one search away, it talks about this app, and it never leaves the page.**

Like the earlier mockups, this is a **clickable mockup with sample content** in `web/`. No message is really sent.

**Build order:** after the Phase 1 gaps build (statement import, self-issued receipts, cash payments, another session) is merged, because both change the menu, the routes and the translation files.

## Goals

- **Help** (`/help`): a search box, help for the page the person came from, seven topics, German terms A–Z, Write to us, and a plain line about tax advice.
- **Answers open on the page** (`/help/<id>`), with the German terms in them explained, a button to the page they talk about, and "Did this answer your question?".
- **German terms A–Z** (`/help/terms`): every term the app explains (38 today; the Phase 1 gaps build adds a few, such as Privateinlage and Kontoauszug), in one searchable list.
- **Write to us** (`/help/contact`): a topic and a message, answered by email.
- English, German and Arabic (right-to-left), phone first.

## Non-goals

- No live chat, phone, video guides, community forum, status page for bank connections or "what's new" notes.
- No "?" button on every page (the menu's Help knows where the person came from instead); no help panel beside a page.
- No message history, attachments or replies in the app; nothing is sent.
- No real help-centre content system: the answers are sample texts in the translation files.

## Anti-goals

- **Tax advice.** Answers explain how the app works and what German terms mean; they never say what a person should do with their own taxes. The page says so and points to a tax advisor (StBerG).
- **Leaving the app for help**, or help written about another product.
- **Answers that disagree with the app.** Every answer describes what the mockup really does (dates, buttons, names), checked against `web/README.md`.
- German-only help, or a translated term without its German original.
- Copying Bilancor's or BuchhaltungsButler's texts.

## Constraints

- The project's mockup rules apply as in the earlier designs: logical spacing utilities only; dates, amounts and emails in `<bdi dir="ltr">` where they mix with text; German terms through `<app-term>`; translation keys the same in `en`, `de` and `ar` (German informal "du", Arabic a draft); browser storage only through `SafeStorage`; `DEMO_TODAY`, never the real clock; colour tokens only.
- Every Help page is a lazy route inside the app shell; the first-load bundle must not grow beyond the route entries.
- The term list is built from the existing `terms.*` texts (label, German original, explanation), so a term is explained the same way everywhere. The list and its count come from one list of term keys in code, not from a typed number *(my call)*: today the `TermKey` type lacks `eigenbeleg` and a spec hard-codes 38, so whatever terms exist at build time are the ones shown.
- **The same Help for everyone** *(my call)*: answers and links don't change with the business or the person's role. Where it matters, the answer says so ("only the owner can invite people", "if your business charges VAT"), and the links (Invite your tax advisor, Let support look) are always shown; the People card itself says who can use them. One light exception: for a Kleinunternehmer, "Help with Taxes" starts with "What is the Kleinunternehmer limit?" instead of the VAT-return questions.

## The Help page

Approved as the mockup `help-page.html` (in `.superpowers/brainstorm/145253-1792862238/content/`). One column on a phone, two from `lg`.

- **Search:** "What do you need help with?". It searches, in the current language, the answers' questions and texts and the terms' German words, translations and explanations, ignoring case and accents (typing "ausgangsbeleg" or "Ausgangsbeleg" finds it; "uebertragung" or "ubertragung" finds "Übertragungsprotokoll") *(my call)*. Results list answers (with their topic) and terms (marked "Term") together. With nothing found: "Nothing found" and **Write to us**, with what was typed carried into the message.
- **Help for the page you came from:** "Help with <page>", "Because you came from <page>", and that page's questions (see Answers). The page is the last one opened before Help *(my call: no `?from=` needed; the menu's Help works from anywhere)*. From the homepage, or when Help is opened first, the section is "Getting started".
- **Topics:** Getting started, Bank and payments, Receipts and documents, Invoices, Taxes and year-end, Your account and people, Your data and privacy — each with how many answers it holds; a topic opens its list of questions on the page, at an address of its own (`/help?topic=<id>`), so the browser's back and an answer's "‹ Help · <topic>" return to it *(my call)*.
- **A term in the search results** opens German terms A–Z at that term (`/help/terms#<key>`) *(my call)*.
- **German terms A–Z:** "<count> words from letters and forms, explained." → `/help/terms`.
- **Write to us:** "We answer in English, German or Arabic." → `/help/contact`.
- **Tax advice:** "We explain how the app works and what German terms mean. For advice on your own taxes, ask a tax advisor (Steuerberater:in)." with **Invite your tax advisor** → `/settings#people`.

## Answers

About 25 sample answers, each with a topic, the pages it belongs to (for "Help with <page>"), the terms it uses, and a button to the page it talks about. The builder writes the texts in English from what the mockup does (web/README.md), with German and Arabic drafts; the owner reviews the wording. The questions *(my call: the list)*:

- **Getting started:** What are the three setup steps? · How do I switch between my businesses? · How do I change the app's language?
- **Bank and payments:** How do I connect my bank? · What does Renew mean on a bank connection? · What does a payment need from me? · What if a payment was private?
- **Receipts and documents:** How do I add a receipt with my phone? · A receipt couldn't be read · What is a self-issued receipt (Eigenbeleg)?
- **Invoices:** How do I write an invoice? · What is an e-invoice (XRechnung, ZUGFeRD)? · What happens when a customer pays?
- **Taxes and year-end:** When is my VAT return due? · What happens when I send it? · Why does a payment stop me sending? · What is the Kleinunternehmer limit? · What happens when I close a month? · How do I send my books to my tax advisor?
- **Your account and people:** How do I invite my tax advisor? · How does the 6-digit code work? · What can each role do?
- **Your data and privacy:** Who can see my books? · How long are my records kept?

Pages and their questions: Home → Getting started; Payments and the review inbox → Bank and payments; Documents → Receipts and documents; Invoices → Invoices; Taxes → the first three of Taxes and year-end; Reports → closing a month, the export for the tax advisor, the VAT return; Settings and My account → Your account and people.

**One answer** (`/help/<id>`): "‹ Help · <topic>" (each part a link: Help, and the topic's list), the question as the title, the answer (one to three short paragraphs), its terms as chips that explain on tap, a button to the page it talks about ("Open Taxes"), and "Did this answer your question?" with **Yes** (a short "Thanks" in its place, nothing stored) and **No, write to us** (Write to us with the topic chosen and "About: <question>" filled in). An unknown id shows "This answer doesn't exist" and a way back.

## German terms A–Z

`/help/terms`: a search box, then the terms grouped by the first letter of the German word (Ä with A, Ü with U, sorted the German way); each shows the German word, its translation (in English and Arabic; the German page shows the German word with its explanation) and the explanation the app already uses, plus where it appears ("Taxes", "Reports" …) *(my call: a small map of terms to pages)*.

## Write to us

`/help/contact`: **Topic** (the seven topics and "Something else"), **Your message** (needed; at least a few words *(my call)*), "We answer to <email>, usually within 1 working day.", **Send**, and the line "To let us look at your books while we help: Settings › People with access › Let support look" with its link. A demo box says nothing is sent; Send shows "Sent. You'll find our answer in your email." and a way back to Help. Coming from an answer's **No** or an empty search, the topic and message start filled in.

## Languages

All pages, answers and terms in English, German and Arabic. German terms keep their German original next to the translation. The answers' German and Arabic are drafts for a fluent reviewer, like the rest of the app.

## Approved mockups

`.superpowers/brainstorm/145253-1792862238/content/help-page.html`, approved with its guesses ("No" opens Write to us with the question filled in; answers usually within 1 working day).

## Left to the builder

- How the answers and the term-to-page map are stored (a data file plus translation keys), and how the last page is remembered.
- The exact answer texts within the rules above; the layout on a phone and a computer.
- Tests in the style of the earlier pages, including one that every answer's question and text exist in all three languages.
