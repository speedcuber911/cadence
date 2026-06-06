# Design System — Bold Athletic (reskin reference)

Identity: a premium sport-brand fitness app (Nike-like). Heavy condensed display type,
near-black background, **electric orange** accent. Sharp, high-energy, high-contrast.
This is a VISUAL spec only — never change component logic, props, state, or data flow.

## Type
- Display headings: `font-display` (Anton, condensed heavy) + `uppercase`. Use for page
  titles, card titles, big numbers, stat values, CTAs. Tight leading: `leading-[0.9]`.
  Page titles huge: `text-5xl`/`text-6xl`. Section headings smaller.
- Body / UI text: default Inter. Muted via `text-muted-foreground`.
- Numbers/stats: `font-display tabular-nums` big (e.g. `text-5xl`).
- Micro-labels: use the `eyebrow` class (uppercase, tracked, bold, muted). For an
  accent eyebrow add `text-primary`.

## Color
- Accent = `primary` (orange). Use `bg-primary text-primary-foreground` for CTAs,
  `text-primary` for accents, `border-primary/40` for active/hover borders.
- Domain colors stay: `work` (orange), `rest` (amber), `recovery`/prep (cyan) — used in
  player + difficulty/feel. Don't repaint domain semantics.
- Destructive = `destructive` (red) for delete.

## Surfaces & shape
- Cards: use the `surface` class (border + subtle top sheen + radius) instead of the
  shadcn `<Card>` defaults. e.g. `<div className="surface p-5">`. You MAY keep using
  shadcn primitives (Select, Dialog, Slider, Switch, Input, Tabs) for behavior, but
  style containers with `surface`.
- Radius is small/sharp (`--radius` ≈ 0.5rem) — already global. Avoid `rounded-full`
  on big elements; small pills ok.
- Hover on interactive cards: `hover:-translate-y-0.5 hover:border-primary/40 transition-all`.

## Primary CTA pattern
```
<button className="glow-cta flex h-14 items-center justify-center gap-2 rounded-[var(--radius)] bg-primary px-8 font-display text-lg uppercase tracking-widest text-primary-foreground transition-[filter] hover:brightness-110">
  <Icon className="size-5" /> Label
</button>
```
Secondary button: `border border-border bg-secondary px-6 font-display text-sm uppercase tracking-widest hover:border-primary/40`.

## Section heading pattern
```
<div className="flex items-center gap-2.5">
  <span className="accent-bar !h-4 !w-1" />
  <h2 className="eyebrow">Section name</h2>
</div>
```

## Reusable classes available (in index.css)
- `eyebrow` — micro uppercase tracked label
- `accent-bar` — orange vertical bar w/ glow (size with `!h-_ !w-_`)
- `surface` — card surface
- `glow-cta` — orange glow shadow for primary buttons
- `font-display` — Anton condensed (also `font-display` tailwind family)

## Don'ts
- No generic flat `bg-card/70 backdrop-blur` rounded-xl cards — use `surface`.
- No default-weight `font-bold` titles where a display heading belongs.
- Don't introduce new accent hues; orange is the brand.
- Keep it responsive (mobile single-col, desktop multi-col) and keep all existing logic.
```
