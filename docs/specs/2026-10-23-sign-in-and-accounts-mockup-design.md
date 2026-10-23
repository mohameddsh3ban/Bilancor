# Sign-in and accounts — clickable mockup (design)

Oct 23, 2026 · Status: draft for approval

## Intent

Today the mockup has no front door: it opens as Sara Weber, who owns three businesses, and nobody else can ever see her books. This mockup adds the parts that belong to a **person** rather than to a business: signing up, signing in, a two-step login, a language that belongs to the person, the people who can open a business, and a **My account** page.

What a client should feel: **the account is theirs.** They decide who sees their books, and they can always see who does. Bilancor's portal (studied Oct 23, 2026, see the [product spec](../bookkeeping-portal-spec.md#users-and-access)) is BuchhaltungsButler's: the client sees no user management at all, so the admin ("Master") role is most likely held by Bilancor; when users are added, the inviter chooses the new person's password; there are six roles and about 60 rights; joining a second company is a support case; and the interface is German only. Ours: whoever signs up owns the business, three plain roles, invitations by link, one login for several businesses, two-step login always on, and each person's own language.

Like the earlier mockups ([homepage](2026-10-21-homepage-mockup-design.md), [Payments](2026-10-22-payments-mockup-design.md), [Documents](2026-10-22-documents-mockup-design.md), [Setup and Settings](2026-10-22-setup-and-settings-mockup-design.md), [Taxes](2026-10-22-taxes-mockup-design.md)), this is a **clickable mockup with sample data** in `web/`, not the working product. There is no real login, no real email and no server.

**Build order:** after the Invoices page (being built in another session, see [its design](2026-10-23-invoices-mockup-design.md)) is merged, in its own worktree. Both change the shared files: routes, the top bar, translations, the demo state and the sample data.

## Goals

- **Sign up** in three short steps that end on the "New client" homepage with its three setup steps.
- **Sign in** with email, password and a 6-digit code; a forgotten password by email link.
- **The demo opens on the sign-in page** with Sara's email filled in, and stays signed in on reload until **Sign out** or **Reset demo**.
- **People with access:** a card in Settings for each business, to invite, change and remove people, with three plain roles; and the invited person's side (the email, joining).
- **Our support has no access** unless the owner lets it look for 7 days.
- **One login, several businesses:** the switcher shows the person's role in each, with **Add a business**.
- **My account:** name, email, language, password, two-step login, backup codes, where you're signed in, and your businesses.
- **The language belongs to the person**, not the browser.
- English, German and Arabic (right-to-left), phone first.

## Non-goals

- **Views per role.** After someone joins, the demo still always shows the app as Sara sees it. A "View as" switch, with each page hiding what that role can't do (a tax advisor without change buttons, an assistant who sees only Documents), is a **later step, after Invoices is merged**, because it touches every page. This build only stores each person's role and shows it.
- No real accounts, passwords, codes, emails or sessions. Nothing leaves the browser.
- No plan or billing page: the price stays a placeholder ("€ — a month"; the amount is an open question in the spec), and there are no payment details.
- No closing a business and no deleting the account: records must be kept up to 10 years (GoBD), so this needs its own design.
- No GmbH sign-up (Phase 3), no single sign-on, no passkeys, no SMS codes.
- No support-team side of support access, no admin portal.
- The history lines are stored, not shown (as today).

## Anti-goals

- **Anyone but the owner in charge of the account**, us included. Our support sees nothing unless the owner turns it on, and it ends by itself.
- **Choosing someone else's password.** An invited person always chooses their own, from the invitation link.
- **A matrix of roles and single rights.** Three roles, each explained in plain words with what it can and can't do. No custom roles.
- **A charge per person.** Everyone with access is included in the price.
- **Switching off two-step login.** It is always on: the account holds bank and tax data.
- Changes that leave no trace: inviting, joining, changing a role, removing a person, handing over the business and support access each add a history line (GoBD).
- Copying Bilancor's or BuchhaltungsButler's design, wording or code; using real data from the studied account.

## Constraints

- The project's mockup rules apply as in the earlier designs: logical spacing utilities only; amounts, IBANs, codes and email addresses in `<bdi dir="ltr">`; every status shows a word; German terms through `<app-term>` with an info button inside choice cards; translation keys the same in `en`, `de` and `ar` (German informal "du", Arabic a draft); browser storage only through `SafeStorage`; the demo's today is `DEMO_TODAY` (22 Oct 2026), never the real clock; colour tokens only.
- **Bundle:** the first-load bundle is about 595 of its 600 kB warning after Taxes, and Invoices adds to it. Every new page is a lazy route, and the sign-in pages must not pull the app shell's code into the first load.
- The demo must still work without browser storage (a private window): then it opens on the sign-in page every time.

## The demo's start and Reset demo

- **The app opens on the sign-in page** (`/sign-in`), in the language the browser last used, with Sara's email filled in. Any password and any 6 digits sign her in.
- **Signed in is remembered** in the browser until **Sign out** or **Reset demo**, so a reload opens straight on the page that was open.
- **Every app page needs a signed-in person**, the print pages too. Opening one while signed out goes to `/sign-in`, and after signing in to the page asked for *(my call)*.
- **The tax reminder** pops up right after signing in (it now follows "the app opens" = "the person is in"), never on the sign-in pages.
- **Reset demo** signs out, forgets the remembered sign-in and the trusted device, restores Sara's people, invitations, support access, devices, backup codes and memberships, and removes accounts and businesses made during the visit, as well as everything it reset before. It does not change the language.
- **An account made with Create account** lives in memory only *(my call)*: a reload forgets it and opens the sign-in page with Sara's email again, since only Sara's sign-in is remembered.
- The sign-in pages sit outside the app shell, with no demo toolbar; the demo help is dashed boxes on the pages themselves.

## Sign-up

Three short steps with a progress line, from **Create an account** on the sign-in page. Approved as the mockup `signup-signin.html`.

1. **Account:** the language buttons (EN, DE, عربي) at the top; the price box ("One price, everything included · € — a month · First 30 days free, no card needed"); email and password (at least 10 characters, checked when continuing); **Create account**; "Already have an account? Sign in".
2. **Check your email:** "We sent a link to … It works for 24 hours", **Send it again**, "Wrong address? Change it" (back to step 1 with the fields kept). A demo box shows the email with **Confirm my email**.
3. **You and your business:** first and last name, the business's name, "What kind of work?" (Freelance · Freiberufler / Trade · Gewerbe) and "Just you, or with partners?" (Just me · Einzelunternehmen / Partners · GbR), each German term with its info button; "A GmbH can't sign up yet." **Continue**.
4. **Terms and a safe login:** a checkbox for the terms of use and the data processing agreement (AVV), "The German version is binding; the others are for reading", and the line "You keep your own books and send your own returns: the app does the work, you confirm." Then **Protect your login**: a QR picture, "Scan with an authenticator app, then type its 6-digit code", the code field, and the 8 backup codes to save. A demo box says any 6 digits work. **Finish**.

- Finishing creates the person (with the language chosen in step 1) and their business as its **Owner**, in the "New client" state: no bank, no documents, no tax details, all three setup steps open. The steps then work with generic sample data (see A new business's sample data). The kind of work and the legal form answered here are the business's answers: the tax-details page starts with the kind already chosen *(my call)*, and the year-end return follows the legal form as it does now.
- The terms links open a short notice that the legal texts are not written yet *(my call)*.
- The email (step 2) and the backup codes are invented demo values.

## Sign-in and a forgotten password

Approved as the mockup `signup-signin.html`.

- **Sign in:** email, password, **Forgot password?**, **Sign in**, "New here? Create an account", and the language buttons. Empty fields say what's missing. An email the demo doesn't know says so, with a link to create an account *(my call)*.
- **The code:** "Enter your code", the 6-digit field, a checkbox "Don't ask again on this device for 30 days", **Sign in**, and "Use a backup code instead" (any backup code works and uses one up). A ticked trusted device skips the code on the next sign-in, remembered in the browser until **Reset demo**.
- **In:** the business the person had open last, in the person's own language.
- **Forgot password:** the email, **Send the link** ("It works for 1 hour"), a demo box with the email, then **Choose a new password**. The new password signs the person out everywhere else (the other devices leave My account), and the code is still asked at the next sign-in.

## People with access

A new card in **Settings**, after Bank accounts, for the open business. Approved as the mockup `people-access.html`.

- **The list:** each person with their initials, name, email or "joined" date, and their role as a word: Owner, Full access, Receipts only, Tax advisor. A waiting invitation shows the email, "Invited 20 Oct · the link works until 27 Oct" and **Waiting**.
- **The ⋮ menu** of a person: **Change what they can do** (the same three role cards), **Make owner** (only for Full access: the owner becomes Full access), **Remove** (with a confirmation). Of a waiting invitation: **Send again** (a fresh 7-day link) and **Cancel invitation**.
- **Only the owner** invites, changes and removes people and hands over the business. Anyone else sees the list without the ⋮ menus and **Invite someone**, with a line saying who the owner is.
- **Invite someone:** their email, then one of three role cards, each with what they can (✓) and can't (✕) do:
  - **Full access** (e.g. a partner): everything the owner can — payments, receipts, taxes, settings — except people and the plan.
  - **Receipts only** (e.g. an assistant): upload receipts and fix the ones they added; no payments, bank balances, taxes or settings.
  - **Tax advisor** (Steuerberater:in): see everything, download receipts and exports; no changing bookings, connecting banks or sending returns.
  
  **Send invitation**: the link works for 7 days, and they choose their own password. An email that already has access, or is already invited, says so.
- **Our support team:** "No access. We can't see your books unless you let us in, for example when you ask us for help." **Let support look for 7 days**, then "Support can look until 29 Oct · Stop now". Looking only, no changes. The line goes back to "No access" once the end date is passed (with `DEMO_TODAY` it never passes in the demo).
- The card says that everyone is included in the price.

**The invited person's side.** After **Send invitation** (and on **Send again**), a demo box shows the email: "Sara Weber invited you to Weber Design, as Tax advisor", in the inviter's language with one line in each of the other two, and **Accept the invitation**. That opens `/join/…`, outside the app shell:

- **Join Weber Design:** the role and what it can do, the person's name, language and password, then the same authenticator step as sign-up. **Join**. "Already have a login? Sign in", after which the business is added to that login.
- Since views per role are not built, **joining is a preview**: finishing shows "Mia has joined Weber Design as Receipts only" and goes back to the person who invited her (whoever is signed in), whose list now shows Mia as joined *(my call)*. "Already have a login? Sign in" on the join page is the same preview: an email and password that accept anything, then the same message *(my call)*.
- **Invited and joined people are not logins** in the demo, only rows on a business: name, email, role, status and dates *(my call)*. The sign-in page knows Sara and the accounts made during the visit. Any other email, Mia's or Jana Hoffmann's too, says "In this demo, only Sara's account and accounts you create can sign in. Seeing the app as someone else comes later." *(my call)*. The demo never signs in as the invited person.

## My account, the person menu and the switcher

Approved as the mockup `my-account.html`.

- **The person menu** at the end of the top bar: the person's initials; it opens their name and email, **My account** and **Sign out**. Sign out opens the sign-in page with "You're signed out."
- **The business switcher** shows the person's role next to each business, and ends with **+ Add a business**: step 3 of sign-up (the business) and the terms, then the new business opens as a new client, with the person as Owner. Each business has its own plan and price.
- **My account** (`/account`, inside the app shell), five cards:
  - **You:** name and email. A new email is confirmed by an email first (shown in a demo box), and the old address is told.
  - **Language:** English, Deutsch, عربي. "For the app and our emails to you. Tax returns, exports and invoices to German customers stay German." The top-bar language buttons change the same setting.
  - **Signing in:** **Change** the password (the current one, then the new one); two-step login "On", always, with **Use a new phone** (the QR step again); backup codes "6 of 8 left" with **Make new codes** (8 new ones, shown once).
  - **Where you're signed in:** each device with where and when ("This device" for the current one), **Sign out** for each other device, and **Sign out everywhere else**. The devices are sample rows, not read from the real browser *(my call)*.
  - **Your businesses:** each with the person's role; **Leave** where they are not the owner (with a confirmation; if it was open, another business opens). An owner can't leave: they hand the business over in People with access first.

## The language belongs to the person

- Each person has a language. When a person signs in, the app switches to it; the language buttons (top bar, My account) change it for that person.
- **A language picked on the sign-in page wins** *(my call)*: if the visitor taps a language button there before signing in, the app keeps that language and saves it as the person's. Without a tap, the person's own language applies. So a visitor who picks DE and signs in as Sara stays in German.
- Sara's language starts as the browser's current language *(my call)*, so opening the demo never changes the language by itself. Reset demo leaves it as it is.
- The sign-in pages use the browser's last language; the sign-up's buttons set the new person's language.
- The browser's last language (the existing stored choice) stays as it is: it is what the sign-in pages show. The person's language is stored with the person *(my call)*.
- Emails to a person use their language; an invitation uses the inviter's (the invited person's language isn't known yet).

## Sample data

- **Sara Weber** gets an email (`sara@example.com`), a language, two devices (Chrome on Windows · Berlin · now, this device; Safari on iPhone · Berlin · 21 Oct 2026) and 6 of 8 backup codes left.
- **Weber Design:** Sara (Owner); a tax advisor, Jana Hoffmann of Kanzlei Hoffmann (joined 2 Sep 2026); a waiting invitation for `mia@example.com` as Receipts only (invited 20 Oct, link until 27 Oct).
- **Sara Weber Yoga:** Sara (Owner) only.
- **Café Linde GbR:** the other partner, Jonas Linde, is the **Owner** and Sara has **Full access**, so the demo shows both roles. Nothing else changes for Café Linde, since views per role are not built.
- Support access is off for every business.
- All names and emails are invented.

## A new business's sample data

The owner decided that a business made during the visit (by **Create account** or **Add a business**) gets generic sample data, so its setup steps, bank, receipts and taxes can be clicked through like the sample businesses'. Today these flows look their data up by the sample businesses' ids (the found accounts, the fetched payments, the upload pool), so they need a generic set for any other id.

- **Connect your bank:** any bank in the list finds one business account at that bank, with an invented IBAN, and after the fetch about eight payments from October 2026: a few client payments in, rent, a phone bill, software, a train ticket and one private transfer. Most get booking suggestions; two or three wait in the review inbox, as for the sample businesses *(my call: the exact rows)*.
- **Receipts:** a generic upload pool like the sample businesses' (a few receipts that match those payments, one that can't be read), repeating the same way once used up.
- **Taxes:** follow from these payments and the tax details the person gives, with an empty year opening: the business starts in October 2026, so the year shows only October *(my call)*. The income tax to set aside follows the same rule as the sample businesses, from a stored sample value of 0 if there is no sensible one *(my call)*.
- **Invoices:** none; the Invoices page shows its empty state *(my call)*.
- The payments read plausibly for both kinds of work (freelance and trade), and every business made during the visit gets the same set under its own name. Amounts in integer cents, all names invented.
- Like the account itself, it lives in memory only: a reload or **Reset demo** forgets it.

## History lines (GoBD)

Each of these adds a line to the business's history, with who did it and when: invited, invitation cancelled, joined, role changed, removed, left, owner handed over, support access on, support access stopped. Stored, not shown, like the existing lines.

## Languages

Every new screen, message and email in English, German and Arabic. German terms kept and explained: Freiberufler, Gewerbe, Einzelunternehmen, GbR, AVV, Steuerberater:in. Codes, emails and dates read left to right inside Arabic.

## Approved mockups

`.superpowers/brainstorm/1746-1792758932/content/`: `signup-signin.html`, `people-access.html`, `my-account.html`. The owner approved all three, including the guesses marked on them (30 days free, the 30-day trusted device, everyone included in the price, owner-only people management, support looking only, the 7-day invitation link, the invitation's language, each business with its own plan, Café Linde's owner, an owner can't leave).

## Left to the builder

- How the person, the memberships and the invitations are modelled, and how the sign-in pages are routed and guarded, as long as the first-load bundle doesn't grow beyond the lazy pages' entry points.
- Exact copy, within the meaning above; the layout of each screen on a phone and a computer.
- The validation messages, focus order and keyboard behaviour of the code field and the dialogs.
- Tests: the same unit-test style as the earlier pages.
