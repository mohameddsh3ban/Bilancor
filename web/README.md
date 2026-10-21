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


## Colour convention

Colours come from the shadcn variables in `src/styles.css` (`--background`, `--foreground`, `--primary`, `--muted`,
`--card`, `--border`, ...) plus the project tokens `surface`, `positive`, `negative` and `warning` (each with a
`-foreground` where text sits on it). Use them as `bg-primary`, `bg-muted`, `text-muted-foreground`, `bg-surface`,
`text-positive` and so on. Never hard-code colours.
