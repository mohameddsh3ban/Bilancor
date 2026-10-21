# Homepage mockup (web)

Clickable Angular mockup of the bookkeeping app's homepage (en / de / ar). No backend.

## Commands

- `npm start` — dev server
- `npx ng test --watch=false` — unit tests (Vitest)
- `npx ng build` — production build

## spartan/ui (helm) components

Generated into `libs/ui/<name>/` and mapped in `tsconfig.json` paths. Import them as:

```ts
import { HlmButton } from '@spartan-ng/helm/button';
```

Available: `button`, `card`, `badge`, `dropdown-menu`, `popover`, `progress`, `tooltip`, `separator` (plus `utils`).
Config is in `components.json` (written by hand, because the generator only offers it interactively).
Add more with `npx ng g @spartan-ng/cli:ui <name> --interactive=false --defaults`.

## Styling

Colours go through the Tailwind theme tokens in `src/styles.css` (`--color-surface`, `--color-card`, `--color-border`,
`--color-primary`, `--color-muted`, `--color-positive`, `--color-negative`, `--color-warning`).
