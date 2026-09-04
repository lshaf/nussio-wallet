# Design system

Anchor Extension ships three surfaces from one component set: the toolbar popup (360 px wide),
the side panel / narrow tab (< 768 px) and the full tab (≥ 768 px). Every screen has to work at
360 px first; wide layouts are an enhancement.

## Tokens

All colours live in `src/assets/styles.css` as CSS variables and are exposed to Tailwind through
`@theme inline`. Never hard-code a colour in a component; use the token class.

| Token         | Light     | Dark      | Use                                             |
| ------------- | --------- | --------- | ----------------------------------------------- |
| `background`  | `#f2f5f9` | `#0a1220` | page ground                                     |
| `card`        | `#ffffff` | `#111b2e` | panels, lists, hero                             |
| `foreground`  | `#0c1830` | `#e6ecf5` | text                                            |
| `primary`     | `#2b4fa8` | `#6e96ff` | brand blue (from the Anchor icon), gauges, CTAs |
| `positive`    | `#1b8a6b` | `#3fbf9a` | connected, unlocked, success                    |
| `warning`     | `#d9720f` | `#f5a04a` | low resources, insecure node, hints             |
| `destructive` | `#c8323f` | `#f0596a` | errors, reset                                   |

Dark mode follows the system preference (`followSystemTheme()` in `src/lib/theme.ts` toggles the
`.dark` class on `<html>`).

## Type

- **Archivo Variable** (`font-sans`) for everything textual. The width axis is the personality:
  `eyebrow` (condensed, uppercase, tracked) for labels and section names, `display-num`
  (expanded, tabular) for headline quantities.
- **Red Hat Mono Variable** (`font-mono`) only for identifiers: account names, permissions,
  public keys, chain ids, node URLs, raw request payloads.
- Quantities are never mono. Use `num` (tabular figures) so columns align.

Fonts are bundled from `@fontsource-variable/*`; nothing is fetched at runtime.

## Building blocks (`src/components/shared`)

- `Amount` splits an asset into integer, fraction and symbol so the integer carries the weight.
  Sizes: `hero`, `lg`, `md`, `sm`. Wraps the fraction to the next line when narrow.
- `ResourceGauge` is the signature element: a draft-mark meter with a tick every 10 % and a
  waterline edge. `warn` switches the fill to the warning token. Use it for CPU, NET and RAM
  everywhere; no other progress bars.
- `PageHeader` = eyebrow + title + optional meta slot + actions slot; wraps on narrow.
- `DataList` for label/value pairs (`mono`, `tone` per item).
- `EmptyState` for empty lists, always with the next action inside.
- `AppMark` for the icon + wordmark.

## Layout rules

- `AppShell`: sidebar at `md+`, bottom tab bar below. Main content `max-w-5xl`, `p-4 md:p-8`,
  bottom padding reserved for the tab bar.
- `TopBar`: narrow = chain chip + status + lock on row one, account on row two; wide = one row.
- Tables only at `md+` and inside an `overflow-x-auto` card. Narrow views render cards
  (`OverviewCard`) from the same composable (`useAccountOverview`) as the table row.
- Two-column forms use `sm:grid-cols-2`; never fixed pixel widths on inputs.
- Touch targets ≥ 32 px; bottom nav items 56 px.
- Motion: `rise-in` on hero values and setup steps, gauge fill transition. Both respect
  `prefers-reduced-motion`.
