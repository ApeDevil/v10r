# Style Randomizer — Implementation Plan

Consolidated plan from cross-domain analysis by architecture, SvelteKit, UX, data, research, and scout specialists. This document captures **decisions made** and the **build order** — not alternatives or trade-offs (those live in the original blueprint).

---

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Palette switching | `[data-palette="P7"]` attribute on `<html>` | DaisyUI pattern; ~100x faster than inline style; build-tool visible |
| Color format | OKLCH | Perceptual uniformity; DaisyUI production-proven; Baseline Widely Available |
| PostCSS fallback | `@csstools/postcss-oklab-function` v5 | 5M downloads/week; handles literal oklch() in CSS custom properties |
| FOUC prevention | SSR via `transformPageChunk` in hooks | httpOnly cookie can't be read by blocking script; SSR delivers correct attrs |
| Font hosting | `@fontsource-variable/*` (self-hosted WOFF2) | GDPR clean; no third-party requests; npm-managed |
| Font display | `font-display: optional` | Zero CLS; fallback on first uncached visit is acceptable |
| fontaine plugin | **SKIP** | Incompatible with Fontsource (issue #258, open 2.5yr); fontless doesn't support SvelteKit |
| Contrast validation | `culori` library, WCAG 2.x (threshold 0.04045) | Handles OKLCH→sRGB conversion; legally required standard |
| APCA | Not targeted | Removed from WCAG 3.0 draft; no legal standing |
| prefers-contrast | High-contrast palette auto-selection + CSS @media override | Curated > algorithmic boosting; guaranteed WCAG AAA |
| Cookie | httpOnly, secure (conditional on NODE_ENV), sameSite lax, 1yr | Cookie is "functionality" under GDPR (needs consent) |
| Database | Extend existing `app.user_preferences` with 3 columns | Same PK, same lifecycle, no join needed |
| Registries | Static TypeScript arrays, not DB records | Build-time WCAG validation; zero I/O; <100 entries |
| Client style change | `invalidateAll()` after API call | Server is source of truth; SvelteKit reactivity propagates |
| Same-style detection | Client compares returned IDs before invalidateAll | Avoids wasted reload; distinct UX toast |
| CSP nonces | `app.html` only (not `<svelte:head>`) | SvelteKit bug #11882: nonce substitution broken in `<svelte:head>` |

---

## Architecture

### Module Map

```
src/lib/styles/random/           ← Pure logic, no framework imports
├── types.ts                     ← PaletteId, TypographyId (branded), Palette, TypographySet, StyleConfig, ResolvedStyle
├── contrast.ts                  ← WCAG luminance (0.04045 threshold), validatePaletteContrast() via culori
├── palette-registry.ts          ← PALETTE_REGISTRY[], getPalette(), PALETTE_IDS — OKLCH values, build-time WCAG check
├── typography-registry.ts       ← TYPOGRAPHY_REGISTRY[], getTypography(), TYPOGRAPHY_IDS
├── generator.ts                 ← generateRandomStyle(), resolveStyle(), generatePaletteCss()
├── cookie.ts                    ← parseStyleCookie(), serializeStyleCookie(), COOKIE_OPTIONS
└── index.ts                     ← Public barrel

src/lib/state/
└── style.svelte.ts              ← createStyleState(), setStyleContext(), getStyle() — Svelte 5 runes

src/lib/server/style/
├── resolve.ts                   ← readStyleFromRequest() — cookie-first, DB fallback for auth users
├── persist.ts                   ← saveStyleToDb(), loadStyleFromDb()
└── migrate-guest-style.ts       ← Guest→user cookie→DB migration on login

src/lib/schemas/
└── style.ts                     ← Valibot schemas: StyleCookieSchema, LockRequestSchema, RollRequestSchema

src/routes/api/style/
├── roll/+server.ts              ← POST: generate new random style, set cookie, fire-and-forget DB write
└── lock/+server.ts              ← POST: toggle lock, set cookie, update DB

src/lib/components/shell/
└── DiceRollButton.svelte        ← Sidebar rail + hero placement, consumes getStyle() context
```

### Files to Modify (not create)

| File | Change |
|------|--------|
| `src/app.d.ts` | Add `style: ResolvedStyle` to `App.Locals` and `App.PageData` |
| `src/app.css` | Add `[data-palette]` + `.dark[data-palette]` variable blocks; add `@media (prefers-contrast: more)` overrides |
| `src/hooks.server.ts` | Add `loadStyle` handle (position 5: after sessionPopulate, before csrfProtection); use `transformPageChunk` for SSR attrs |
| `src/routes/+layout.server.ts` | Return `locals.style` in load data |
| `src/routes/+layout.svelte` | setStyleContext(), $effect for data-palette/data-typography attrs, sr-only live region, font imports |
| `src/lib/styles/tokens.ts` | Add fontFamily entries (heading, body, mono) |
| `uno.config.ts` | Add fontFamily to theme; optionally add palette blocks as preflights |
| `src/lib/server/db/schema/app/user-preferences.ts` | Add paletteId, typographyId, styleLocked columns |
| `vite.config.ts` | Add `@csstools/postcss-oklab-function` to PostCSS plugins |
| `package.json` | Add culori, @fontsource-variable/*, @csstools/postcss-oklab-function |

---

## Data Flow

### Every Request (hot path — 0ms I/O)

```
Browser GET /any-page
  → hooks.server.ts: loadStyle handle
    → Read cookie "v10r_style" (httpOnly, available server-side)
    → Cookie present? parseStyleCookie() → validate against registries
    → Cookie missing + auth user? Query DB (cold path, ~50ms)
    → Cookie missing + guest? generateRandomStyle()
    → Set event.locals.style = ResolvedStyle
    → transformPageChunk: inject data-palette="P7" data-typography="T3" on <html>
  → +layout.server.ts: return { style: locals.style }
  → +layout.svelte: setStyleContext(data.style)
  → Browser: <html data-palette="P7" data-typography="T3"> already in SSR HTML
  → CSS cascade applies correct palette vars immediately (zero FOUC)
```

### Dice Roll (user-initiated)

```
DiceRollButton click
  → POST /api/style/roll { highContrast: prefersMoreContrast }
    → Server: generateRandomStyle(options), set cookie, fire-and-forget DB write
    → Response: { success, style: { paletteId, typographyId, paletteName, typographyName } }
  → Client: compare IDs — same style? Show "Same one" toast, skip reload
  → Client: different? invalidateAll() → layout re-runs → $effect updates data-palette attr
  → Toast: "Ocean palette · Editorial typography"
  → sr-only announcement: "Style changed to Ocean palette with Editorial typography"
```

---

## Palette CSS Architecture

Palette variables defined as **static OKLCH literals** in CSS (not JS-injected), scoped by `[data-palette]` attribute:

```css
/* In app.css or generated palette-vars.css */

/* Default palette (also serves as P0 / fallback) */
:root {
  --color-primary: oklch(0.55 0.18 260);
  --color-primary-hover: oklch(0.48 0.20 260);
  /* ... ~22 overridden tokens ... */
}

[data-palette="P1"] {
  --color-primary: oklch(0.60 0.16 220);
  /* ... all light-mode vars for Ocean ... */
}
.dark[data-palette="P1"] {
  --color-primary: oklch(0.70 0.14 220);
  /* ... all dark-mode vars for Ocean ... */
}

[data-palette="P2"] { /* Sunset */ }
.dark[data-palette="P2"] { /* Sunset dark */ }
/* ... P3-P20 ... */

/* High-contrast override (prefers-contrast: more) */
@media (prefers-contrast: more) {
  :root {
    --color-fg: oklch(0.0 0 0);
    --color-body: oklch(0.0 0 0);
    --color-muted: oklch(0.25 0 0);
    --color-border: oklch(0.0 0 0);
  }
  .dark {
    --color-fg: oklch(1.0 0 0);
    --color-body: oklch(1.0 0 0);
    --color-muted: oklch(0.80 0 0);
    --color-border: oklch(1.0 0 0);
  }
}
```

### Token Coverage (22 overridden / ~18 fixed)

**Palette overrides these tokens:**
`--color-primary`, `--color-primary-hover`, `--color-primary-fg`, `--color-secondary`, `--color-secondary-hover`, `--color-secondary-fg`, `--color-accent`, `--color-accent-fg`, `--color-bg`, `--color-fg`, `--color-body`, `--color-subtle`, `--color-muted`, `--color-muted-fg`, `--color-border`, `--color-ring`, `--color-primary-bg`, `--color-primary-light`, `--color-on-primary`, `--color-secondary-bg`, `--color-input-border`, `--color-input-bg`

**Fixed tokens (not palette-controlled):**
Semantic colors (success, warning, error, info), surface elevation (`--surface-0` to `--surface-3`), shadows, chart colors, z-index, spacing — these remain in `:root`/`.dark` in app.css unchanged.

---

## Typography CSS Architecture

Typography sets are scoped by `[data-typography]` attribute:

```css
[data-typography="T1"] {
  --font-heading: "Inter", system-ui, sans-serif;
  --font-body: "Inter", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
[data-typography="T2"] {
  --font-heading: "Playfair Display", Georgia, serif;
  --font-body: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
}
/* T3-T5 */
```

All font families imported statically in `+layout.svelte`:
```ts
import '@fontsource-variable/inter';
import '@fontsource-variable/playfair-display';
import '@fontsource-variable/space-grotesk';
import '@fontsource-variable/jetbrains-mono';
// etc.
```

Browser only loads the fonts actually referenced by the active `--font-*` variables.

---

## Database Schema Addition

```typescript
// In src/lib/server/db/schema/app/user-preferences.ts — 3 new columns:
paletteId: text('palette_id'),                              // nullable — null = "use cookie or randomize"
typographyId: text('typography_id'),                        // nullable
styleLocked: boolean('style_locked').notNull().default(false),
```

Migration SQL: `ALTER TABLE app.user_preferences ADD COLUMN palette_id TEXT, ADD COLUMN typography_id TEXT, ADD COLUMN style_locked BOOLEAN NOT NULL DEFAULT false;`

---

## Cookie Schema

Name: `v10r_style` | Format: `{"pid":"P7","tid":"T3","lck":false,"v":1}` (~40 bytes)

Options: httpOnly=true, secure=(NODE_ENV=production), sameSite=lax, path=/, maxAge=1yr

GDPR: "functionality" cookie — requires consent. When consent declined: style randomized per-visit server-side, not persisted, lock option hidden.

---

## UX Summary

- **Dice button**: sidebar rail (icon-only) + expanded sidebar (labeled "Shuffle Style") + homepage hero (larger, with subtitle)
- **Transitions**: instant — no CSS animation on palette/typography swap
- **Toasts**: named — "Ocean palette · Editorial typography" (info type, 4s)
- **Lock discovery**: after 3 rolls, subtle "Like this one? Lock it" hint
- **Lock/unlock**: one-click toggle, no confirmation modal
- **prefers-contrast: more**: auto-constrain random pool to high-contrast palettes; CSS @media override for critical tokens
- **prefers-reduced-motion**: no dice animation, opacity pulse only
- **Mobile**: dice inside SidebarDrawer (forceExpanded, always shows label)
- **Error**: toast with specific message, button immediately re-enabled
- **Same style rolled**: skip invalidateAll, show "Same one — try again" toast

---

## Build Phases

### Phase 1: Types + Registries + Dependencies (zero runtime impact)

**New files:**
- `src/lib/styles/random/types.ts`
- `src/lib/styles/random/contrast.ts`
- `src/lib/styles/random/palette-registry.ts` (start with 3 palettes + 1 high-contrast)
- `src/lib/styles/random/typography-registry.ts` (start with 3 sets)
- `src/lib/styles/random/generator.ts`
- `src/lib/styles/random/cookie.ts`
- `src/lib/styles/random/index.ts`
- `src/lib/schemas/style.ts`

**Modified files:**
- `package.json` — add culori, @fontsource-variable/*, @csstools/postcss-oklab-function
- `vite.config.ts` — add PostCSS plugin

**Exit criteria:** `generateRandomStyle()` returns valid configs, all palettes pass WCAG validation at import, contrast.ts uses 0.04045 threshold.

### Phase 2: Palette + Typography CSS

**Modified files:**
- `src/app.css` — add `[data-palette]` blocks, `[data-typography]` blocks, `@media (prefers-contrast: more)` overrides
- `uno.config.ts` — add fontFamily theme entries

**Exit criteria:** Manually adding `data-palette="P1"` to `<html>` in dev tools visually changes the site's colors.

### Phase 3: Database Schema

**Modified files:**
- `src/lib/server/db/schema/app/user-preferences.ts` — 3 new columns
- `src/lib/server/db/preferences/mutations.ts` — style-aware updates

**New files:**
- `src/lib/server/style/resolve.ts`
- `src/lib/server/style/persist.ts`
- `src/lib/server/style/migrate-guest-style.ts`

**Exit criteria:** Can query/update style prefs in DB. Migration applied.

### Phase 4: Hooks + Layout Integration (the "flip the switch")

**Modified files:**
- `src/app.d.ts` — Locals.style, PageData.style
- `src/hooks.server.ts` — loadStyle handle + transformPageChunk
- `src/routes/+layout.server.ts` — return style
- `src/routes/+layout.svelte` — setStyleContext, $effect for attrs, font imports, sr-only live region

**New files:**
- `src/lib/state/style.svelte.ts`

**Risk:** This changes the entire site's visual appearance. Test with P0 (current colors) first.

**Exit criteria:** Anonymous user gets random style on first visit, same on refresh. Auth user syncs to DB. SSR HTML has correct data-palette attr. No FOUC.

### Phase 5: API + DiceRollButton

**New files:**
- `src/routes/api/style/roll/+server.ts`
- `src/routes/api/style/lock/+server.ts`
- `src/lib/components/shell/DiceRollButton.svelte`

**Modified files:**
- Sidebar components (add dice button)
- Homepage hero (add dice button)

**Exit criteria:** Roll changes style, lock persists, CSRF protection works, keyboard accessible, screen reader announces changes.

### Phase 6: Polish + Accessibility Audit

- Test all palette × typography × theme combinations
- Colorblind simulation (deuteranopia, protanopia, tritanopia)
- `prefers-contrast: more` validation
- `prefers-reduced-motion` validation
- CLS < 0.1 verification
- Mobile touch target validation (44×44px minimum)
- GDPR consent degraded mode testing
- Edge cases: cookie cleared, DB down, palette removed, same style rolled twice

---

## Accessibility Checklist

- [ ] 1.4.3 — All text/bg pairs: body 4.5:1, large 3:1 (every palette, both themes)
- [ ] 1.4.6 — High-contrast palettes: body 7:1 (AAA)
- [ ] 1.4.11 — Borders, focus rings, UI components: 3:1
- [ ] 2.1.1 — Dice, lock, unlock fully keyboard operable
- [ ] 2.5.5 — All touch targets ≥ 44×44px
- [ ] 4.1.3 — sr-only aria-live announces palette + typography names
- [ ] prefers-reduced-motion respected (no animation)
- [ ] prefers-contrast: more auto-selects high-contrast palette
- [ ] GDPR: lock hidden when functionality cookies declined

---

## Blueprint Corrections

| Original Blueprint | Correction | Source |
|-------------------|------------|--------|
| FOUC script in `<svelte:head>` | Move to `app.html` or use SSR `transformPageChunk` | SvelteKit #11882: nonce broken in svelte:head |
| `%sveltekit.nonce%` in svelte:head | Does NOT work | SvelteKit #11882 (confirmed) |
| WCAG threshold 0.03928 | Should be 0.04045 | CSS Color Level 4 spec, WCAG 2.1 |
| HSL color values | OKLCH (perceptual uniformity, DaisyUI-proven) | DaisyUI 40k stars, Evil Martians |
| Inline style on wrapper div | `[data-palette]` attribute on `<html>` | DaisyUI pattern; ~100x faster |
| `postcss-oklch` package | `@csstools/postcss-oklab-function` | postcss-oklch doesn't exist on npm |
| fontaine for CLS | Skip (incompatible with Fontsource) | fontaine #258 (open 2.5yr) |
| Google Fonts CDN | @fontsource-variable (self-hosted) | GDPR; no third-party requests |
| APCA targeting | Not a compliance target | Removed from WCAG 3.0 draft |
| Cookies "strictly necessary" | "Functionality" — needs consent | GDPR.eu, CookieYes analysis |
