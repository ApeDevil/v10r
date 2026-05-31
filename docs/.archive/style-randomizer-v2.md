# Style Randomizer Blueprint v2 (Refined)

Cross-domain refinement of the original blueprint. This document captures **only changes and decisions** relative to [style-randomizer.md](./style-randomizer.md). Read that first.

**Inputs:** Findings from svey (SvelteKit), uxy (UX), daty (data), resy (research), scout (real-world).

---

## Key Architectural Decisions

### 1. `data-palette` Attribute vs Inline Styles

**Decision: Hybrid approach. `data-palette` attribute on `<html>` for colors, inline style for fonts only.**

The DaisyUI pattern (`[data-palette="P7"]`) uses a single `setAttribute` call which is ~100x faster than 20+ `setProperty` calls. But DaisyUI predefines all palettes in CSS at build time. We need that too.

**How it works:**

```css
/* Generated at build time from palette registry */
[data-palette="P1"] {
  --color-primary: oklch(54% 0.19 240);
  --color-primary-hover: oklch(49% 0.19 240);
  /* ... all 16+ color vars ... */
}
[data-palette="P1"].dark {
  --color-primary: oklch(70% 0.15 240);
  /* ... dark variants ... */
}

/* Repeat for P2, P3, ... */
```

**Why hybrid:** Fonts can't follow this pattern because font-family stacks contain commas and quotes that CSS attribute selectors can't handle cleanly. Font vars stay as inline styles on `<html>` (only 3 properties: `--font-heading`, `--font-body`, `--font-mono`).

**SSR integration:** The `resolve` hook uses `transformPageChunk` to inject `data-palette="P7"` on the `<html>` tag, same as the existing `%lang%` replacement. No wrapper div needed. The existing `app.html` blocking script adds the attribute from the cookie before first paint.

```
Server: <html data-palette="P7" style="--font-heading:...; --font-body:...; --font-mono:...">
Client: setAttribute('data-palette', 'P7') on roll
```

**What this replaces from v1:** The `<div class="app-root" style={cssVarsString}>` wrapper is eliminated. CSS vars apply at `:root` / `html` level via attribute selector.

---

### 2. OKLCH for Registry, HSL Dropped

**Decision: Use OKLCH for all palette color definitions.**

Why:
- Perceptual uniformity means contrast validation is more predictable
- DaisyUI (40k stars) uses OKLCH for all palettes, proving the pattern at scale
- Modern browser support is >95% (all evergreen browsers)

What changes:
- `PaletteColors` values stored as `oklch(L% C H)` strings
- `contrast.ts` luminance calculation updated: parse OKLCH -> convert to linear sRGB -> standard WCAG luminance formula
- No `postcss-oklch` needed — OKLCH is natively supported. The plugin is only needed for IE/old Safari which we don't target.
- The luminance threshold constant corrected from `0.03928` to `0.04045` per resy finding

---

### 3. FOUC Strategy: SSR Sufficient for Palette, Blocking Script for Theme Only

**Decision: No blocking script for palette. SSR handles it. Blocking script stays for theme (dark class) only.**

Confirmed findings:
- `%sveltekit.nonce%` does NOT work in `<svelte:head>` (SvelteKit bug #11882) — the blocking script MUST live in `app.html`
- SSR already delivers the correct `data-palette` and font vars in the initial HTML
- The existing `app.html` blocking script handles dark/light class — we extend it to also set `data-palette` from cookie

Updated `app.html` script (extends existing):
```javascript
(() => {
  // Theme (existing)
  const theme = document.cookie.match(/theme=(\w+)/)?.[1] ?? 'system';
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = theme === 'dark' || (theme === 'system' && prefersDark);
  if (isDark) document.documentElement.classList.add('dark');

  // Style palette (NEW — prevents palette flash on client nav)
  const sm = document.cookie.match(/v10r_style=([^;]+)/);
  if (sm) {
    try {
      const s = JSON.parse(decodeURIComponent(sm[1]));
      if (s.pid) document.documentElement.dataset.palette = s.pid;
    } catch {}
  }

  // Sidebar (existing)
  // ...
})();
```

**Why palette needs the blocking script too:** While SSR delivers the correct `data-palette` on first load, client-side navigation after a dice roll uses `invalidateAll()` which re-renders the layout. Without the blocking script, there is a brief flash between when the new HTML arrives and when Svelte applies the attribute. The cookie read in the blocking script ensures the attribute is always correct before paint, even during hydration mismatches.

---

### 4. Font Loading: fontaine + Fontsource

**Decision: Use `fontaine` Vite plugin for automatic fallback metrics + `@fontsource-variable/*` for self-hosted WOFF2.**

Why:
- fontaine auto-generates `@font-face` with `size-adjust`, `ascent-override`, `descent-override` for zero CLS
- Fontsource provides npm-installable variable fonts in WOFF2 (no Google Fonts CDN, GDPR compliant)
- `font-display: optional` stays — first-visit users see fallback; subsequent visits use cached font

What changes:
- Remove Google Fonts URLs from `FontConfig.url`
- `FontConfig` gains `fontsource` field: the npm package name (e.g., `@fontsource-variable/inter`)
- Font CSS imported in root layout: `import '@fontsource-variable/inter/woff2.css'`
- fontaine plugin added to `vite.config.ts` — it instruments `@font-face` declarations automatically
- `<link rel="preconnect" href="https://fonts.googleapis.com">` removed entirely

Build pipeline addition:
```typescript
// vite.config.ts
import { fontaineTransform } from 'fontaine';

export default defineConfig({
  plugins: [
    fontaineTransform.vite({ fallbacks: ['system-ui', 'Arial'] }),
    // ...existing plugins
  ]
});
```

---

### 5. `prefers-contrast: more` Handling

**Decision: Dedicated high-contrast palette `P0` auto-selected when `prefers-contrast: more` is detected.**

How:
- `P0` is a special palette with maximum contrast ratios (>10:1 for all text, stark borders)
- Server can't detect `prefers-contrast` — handled client-side only
- On first client load, if `prefers-contrast: more` matches and no cookie exists, auto-select `P0` and set cookie
- If user has a locked style, respect the lock (user intent > system preference)
- `P0` still appears in the dice roll rotation for users who want it

This is lightweight and doesn't require a full "high contrast mode" — it's just another palette that happens to have extreme contrast.

---

### 6. Cookie `secure` Flag

**Decision: Conditional based on environment.**

```typescript
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
};
```

Extract to shared constant in `$lib/styles/random/constants.ts` — used by hooks AND API endpoints (eliminates the duplication from v1 where COOKIE_OPTIONS was defined in 3 places).

---

### 7. GDPR Classification

**Decision: Classify as "functionality" cookie (not "strictly necessary"). Require cookie consent.**

Per resy finding, style preference cookies serve UX personalization, not core site operation. They must be covered by the cookie consent mechanism.

Implementation: The style hook checks for consent before setting the cookie. Without consent, style is still randomized server-side per request (stateless mode — no cookie set, no persistence).

---

## UX Refinements

### Dice Button Placement

Per uxy:
- **Desktop:** Sidebar rail, positioned between triggers and navigation
- **Mobile:** Inside SidebarDrawer (forceExpanded mode)
- **Homepage hero:** Secondary placement (prominent for first-time visitors)

### Style Transitions: Instant, Not Animated

Per uxy: Style changes must be **instant**. Fonts can't transition (they swap), so animated colors alongside an instant font swap looks broken. Remove all `transition` properties from style change paths.

### Toast Messages: Named Styles

```typescript
// WRONG: "Style changed"
// RIGHT: "Ocean palette + Editorial typography"
toast(`${paletteName} palette + ${typographyName} typography`);
```

### Progressive Disclosure

- Lock hint appears after **3** rolls in session (not 1 — uxy refined this)
- Style indicator (palette name) visible in expanded sidebar below dice button

### Same-Style Re-roll

```typescript
async function rollStyle() {
  // ...existing guards...
  const currentPid = styleContext.style.config.paletteId;
  const currentTid = styleContext.style.config.typographyId;

  const response = await fetch('/api/style/roll', {
    method: 'POST',
    headers: { 'X-Requested-With': 'sveltekit' }, // CSRF requirement
  });
  const data = await response.json();

  if (data.style.paletteId === currentPid && data.style.typographyId === currentTid) {
    toast('Same one -- try again');
    return; // Skip invalidateAll()
  }

  // ...proceed with invalidateAll()...
}
```

### Locked Style with Deleted Palette

Per uxy: If a locked palette is removed from the registry, preserve lock intent on the regenerated config:

```typescript
if (!resolved) {
  styleConfig = generateRandomStyle();
  styleConfig.locked = previousConfig.locked; // Preserve lock intent
  resolved = resolveStyle(styleConfig)!;
}
```

---

## Data Model Refinements

### Database: Extend Existing Table

Per daty, extend `app.user_preferences` (not create new table):

```sql
ALTER TABLE app.user_preferences
  ADD COLUMN palette_id TEXT,
  ADD COLUMN typography_id TEXT,
  ADD COLUMN style_locked BOOLEAN DEFAULT false;
```

No new table, no new relation. These are nullable columns — null means "no style preference saved."

### Valibot Schemas with Dynamic Picklist

```typescript
import * as v from 'valibot';
import { PALETTE_IDS } from './palette-registry';
import { TYPOGRAPHY_IDS } from './typography-registry';

export const PaletteIdSchema = v.picklist(PALETTE_IDS);
export const TypographyIdSchema = v.picklist(TYPOGRAPHY_IDS);

export const StyleCookieSchema = v.object({
  pid: PaletteIdSchema,
  tid: TypographyIdSchema,
  lck: v.boolean(),
  v: v.literal(1),
});
```

### Guest-to-User Migration

Per daty: Cookie wins if user has no DB preference; DB wins when cookie absent. Already matches v1 logic, confirmed correct.

### Non-Blocking DB Writes

Already in v1 (fire-and-forget `.catch()`). Confirmed correct pattern for response latency.

---

## Server Integration Refinements

### Hook Position

Confirmed: `loadStyle` goes after `sessionPopulate`, before `csrfProtection`:

```typescript
export const handle = sequence(
  securityHeaders,
  i18n,
  authHandler,
  sessionPopulate,
  loadStyle,        // NEW — needs locals.user from sessionPopulate
  csrfProtection,
  routeGuard,
);
```

### X-Requested-With on API Calls

All style API POST requests must include `X-Requested-With` header (existing CSRF middleware requires it):

```typescript
fetch('/api/style/roll', {
  method: 'POST',
  headers: { 'X-Requested-With': 'sveltekit' },
});
```

This was missing from v1's DiceRollButton.

### `$derived` for cssVarsString

Per svey: Must use `theme.resolvedMode` (the actual light/dark after system preference resolution), not `data.theme` (which may be "system"). Since we moved palette colors to `data-palette` attribute + CSS, the only `$derived` remaining is for font vars — which are theme-independent.

---

## Palette CSS Generation

New build-time step: generate a CSS file from the palette registry.

```typescript
// scripts/generate-palette-css.ts
import { PALETTE_REGISTRY } from '../src/lib/styles/random/palette-registry';

function generatePaletteCSS(): string {
  let css = '/* AUTO-GENERATED — do not edit manually */\n\n';

  for (const palette of PALETTE_REGISTRY) {
    // Light mode (default)
    css += `[data-palette="${palette.id}"] {\n`;
    for (const [key, value] of Object.entries(flattenColors(palette.light))) {
      css += `  --color-${key}: ${value};\n`;
    }
    css += '}\n\n';

    // Dark mode
    css += `[data-palette="${palette.id}"].dark {\n`;
    for (const [key, value] of Object.entries(flattenColors(palette.dark))) {
      css += `  --color-${key}: ${value};\n`;
    }
    css += '}\n\n';
  }

  return css;
}
```

Output: `src/lib/styles/palettes.generated.css` (gitignored, regenerated on build).
Imported in `app.css` after the base tokens.

---

## Updated Architecture Diagram

```
REQUEST FLOW (v2)
=================

1. app.html blocking script
   - Read theme cookie -> add/remove .dark class
   - Read v10r_style cookie -> set data-palette attribute
   (Prevents FOUC for both theme AND palette)

2. hooks.server.ts: sessionPopulate
   - Populates event.locals.user

3. hooks.server.ts: loadStyle
   - Cookie-first: parse v10r_style cookie
   - Fallback: DB query for authenticated users
   - Last resort: generateRandomStyle()
   - Set event.locals.style
   - transformPageChunk: inject data-palette="Px" on <html>
   - transformPageChunk: inject style="--font-*" on <html>

4. +layout.server.ts
   - Pass style to page data

5. +layout.svelte
   - $effect: sync data-palette attribute on client nav
   - $effect: sync font vars on client nav
   - Import Fontsource CSS
   - Provide style context

6. DiceRollButton (sidebar rail / hero)
   - POST /api/style/roll (with X-Requested-With)
   - setAttribute('data-palette', newId)  <-- instant, single DOM op
   - invalidateAll()

CLIENT-SIDE PALETTE APPLICATION
===============================

CSS file (build-time generated):
  [data-palette="P1"] { --color-primary: oklch(...); ... }
  [data-palette="P1"].dark { --color-primary: oklch(...); ... }
  [data-palette="P2"] { ... }

<html data-palette="P1" class="dark" style="--font-heading:...; --font-body:...; --font-mono:...">
  ^-- attribute swap = instant palette change
  ^-- .dark class = theme (orthogonal)
  ^-- inline style = fonts only (3 properties)
```

---

## Phased Rollout (Updated)

### Phase 0: Build Pipeline (NEW)

Dependencies to add:
- `fontaine` (Vite plugin, dev dependency)
- `@fontsource-variable/inter` (and each font used in typography sets)
- No `postcss-oklch` needed (native browser support sufficient)

Files:
1. `vite.config.ts` — add fontaine plugin
2. `scripts/generate-palette-css.ts` — palette CSS generator script
3. `package.json` — add `style:generate` script, add fontsource packages

### Phase 1: Data Model + Registry

Files (in order):
1. `src/lib/styles/random/types.ts` — types, branded IDs, cookie schema
2. `src/lib/styles/random/contrast.ts` — OKLCH luminance, WCAG validation (threshold: 0.04045)
3. `src/lib/styles/random/palette-registry.ts` — OKLCH palettes including P0 (high contrast)
4. `src/lib/styles/random/typography-registry.ts` — fontsource-based font configs
5. `src/lib/styles/random/generator.ts` — randomization, resolveStyle
6. `src/lib/styles/random/serializer.ts` — cookie serialization
7. `src/lib/styles/random/constants.ts` — shared COOKIE_OPTIONS, cookie name
8. `src/lib/styles/random/schemas.ts` — Valibot schemas with dynamic picklist
9. `src/lib/styles/random/index.ts` — public exports

### Phase 2: Generated CSS + UnoCSS

Files:
1. Run `scripts/generate-palette-css.ts` -> `src/lib/styles/palettes.generated.css`
2. `src/app.css` — import palettes.generated.css
3. `uno.config.ts` — extend fontFamily with var references (colors already use vars)

### Phase 3: Server Integration

Files:
1. `src/app.d.ts` — add `style: ResolvedStyle` to `App.Locals`
2. `src/hooks.server.ts` — add loadStyle handle (position: after sessionPopulate)
3. `src/routes/+layout.server.ts` — pass style to page data
4. `src/routes/api/style/roll/+server.ts` — POST endpoint
5. `src/routes/api/style/lock/+server.ts` — POST endpoint
6. DB migration: add 3 columns to `user_preferences`

### Phase 4: Client Integration

Files:
1. `src/app.html` — extend blocking script with palette cookie read
2. `src/routes/+layout.svelte` — attribute sync, font var sync, context, fontsource imports
3. `src/lib/components/style/DiceRollButton.svelte` — with X-Requested-With, named toasts, same-roll detection
4. `src/lib/components/style/StyleIndicator.svelte` — palette name display for sidebar
5. Sidebar integration (rail placement)
6. Homepage hero placement

### Phase 5: Accessibility + Polish

Files:
1. `src/lib/styles/random/palette-registry.ts` — P0 high-contrast palette
2. `src/routes/+layout.svelte` — `prefers-contrast: more` detection, auto-select P0
3. Screen reader live region (already in layout)
4. Colorblind simulation testing (manual)
5. Focus indicator verification across all palettes

---

## File-by-File Implementation Manifest

Total new files: **15**. Total modified files: **7**.

### New Files

| # | File | Responsibility |
|---|------|----------------|
| 1 | `scripts/generate-palette-css.ts` | Build script: registry -> CSS |
| 2 | `src/lib/styles/random/types.ts` | All type definitions, branded IDs |
| 3 | `src/lib/styles/random/contrast.ts` | OKLCH->sRGB conversion, WCAG validation |
| 4 | `src/lib/styles/random/palette-registry.ts` | Static palette definitions (OKLCH) |
| 5 | `src/lib/styles/random/typography-registry.ts` | Static typography definitions (fontsource) |
| 6 | `src/lib/styles/random/generator.ts` | Random generation, resolveStyle |
| 7 | `src/lib/styles/random/serializer.ts` | Cookie serialize/parse |
| 8 | `src/lib/styles/random/constants.ts` | COOKIE_OPTIONS, COOKIE_NAME |
| 9 | `src/lib/styles/random/schemas.ts` | Valibot validation schemas |
| 10 | `src/lib/styles/random/index.ts` | Barrel exports |
| 11 | `src/lib/styles/palettes.generated.css` | Auto-generated palette CSS (gitignored) |
| 12 | `src/routes/api/style/roll/+server.ts` | POST: dice roll endpoint |
| 13 | `src/routes/api/style/lock/+server.ts` | POST: lock/unlock endpoint |
| 14 | `src/lib/components/style/DiceRollButton.svelte` | Dice roll UI + sidebar/hero integration |
| 15 | `src/lib/components/style/StyleIndicator.svelte` | Palette name display |

### Modified Files

| # | File | Changes |
|---|------|---------|
| 1 | `vite.config.ts` | Add fontaine plugin |
| 2 | `package.json` | Add fontaine, fontsource packages, style:generate script |
| 3 | `src/app.css` | Import palettes.generated.css |
| 4 | `src/app.d.ts` | Add style to App.Locals + App.PageData |
| 5 | `src/app.html` | Extend blocking script with palette cookie read |
| 6 | `src/hooks.server.ts` | Add loadStyle handle to sequence |
| 7 | `src/routes/+layout.svelte` | Attribute sync, font vars, context, fontsource imports, prefers-contrast detection |

### Gitignore Addition

```
src/lib/styles/palettes.generated.css
```

---

## Conflict Resolutions

| Conflict | Resolution | Rationale |
|----------|-----------|-----------|
| Inline style vs data-attribute (scout vs v1) | Hybrid: data-attribute for colors, inline for fonts | Single setAttribute for palette swap (~100x faster), fonts need quoted family stacks |
| OKLCH vs HSL (resy vs v1) | OKLCH | Perceptual uniformity, DaisyUI precedent, native browser support |
| FOUC blocking script location (resy vs v1) | `app.html` only, not `<svelte:head>` | `%sveltekit.nonce%` broken in svelte:head (bug #11882) |
| `font-display: optional` vs `swap` (v1 had both mentioned) | `optional` | Zero CLS guarantee; fontaine handles fallback metrics |
| Lock hint at 1 roll vs 3 rolls (v1 vs uxy) | 3 rolls | Progressive disclosure — don't overwhelm on first interaction |
| Google Fonts CDN vs self-hosted (v1 vs scout/resy) | Self-hosted via Fontsource | GDPR compliance, no external requests, npm-managed |
| APCA targeting (v1 mentioned) | Dropped | APCA removed from WCAG 3.0 working draft per resy |
| `secure: true` always (v1) vs conditional (svey) | Conditional on NODE_ENV | `secure: true` breaks local HTTP dev |
| Cookie as "strictly necessary" (v1) vs "functionality" (resy) | Functionality — requires consent | Legal classification per GDPR analysis |

---

## Known Gaps for Future Phases

1. **Cookie consent integration** — needs consent banner implementation first
2. **Analytics for palette popularity** — deferred to post-launch
3. **`prefers-contrast: more` server detection** — not possible via HTTP; client-only
4. **Palette editor UI** — future admin tool for creating/validating palettes visually
5. **Typography preview** — font specimen page for curating new typography sets
