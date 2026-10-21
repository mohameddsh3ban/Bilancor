# Homepage mockup (web)

Clickable Angular mockup of the bookkeeping app's homepage (en / de / ar). No backend. All data is sample data in
`src/app/data/sample-data.ts`.

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

- **Setup state** (New client / Halfway / Active client) shows how the homepage looks at each stage of setup.
- **Business switcher** (in the top bar) changes which business is open.
- **Reset demo** brings back every notice you dismissed (dismissals are remembered in the browser until you reset).

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
