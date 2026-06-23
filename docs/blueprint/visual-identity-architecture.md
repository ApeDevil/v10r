# Visual Identity Architecture

> **Note:** the feature shipped — the admin branding page lives at `/admin/branding`. The active brand is the `brand_settings` singleton (`enabled` flag), resolved server-side per request via `getBrandConfig()` (`src/lib/server/style/brand.ts`); admin-created palettes live in `custom_palettes` (`src/lib/server/branding/palette-crud.ts`, `CustomPaletteEditor.svelte`). There is no brand cookie — the brand is a cached DB read, not a cookie.

> Final architecture for the admin-configurable "visual identity" system that allows an admin to lock a site-wide palette, typography, and border-radius — overriding the style randomizer for all visitors.

## Decision Summary

| Tension | Decision | Rationale |
|---------|----------|-----------|
| Cookie vs DB vs Edge Config | **Cached DB singleton** | `getBrandConfig()` reads `brand_settings` once per warm instance, then serves from memory — zero DB queries per page load |
| Generic `site_config` vs dedicated table | **Dedicated `brand_settings` singleton** | Only two concrete use cases exist (randomizer + visual identity), a generic config table is speculative |
| Build-time CSS vs runtime injection | **Neither -- reuse `data-palette` attribute cascade** | The CSS already exists in `app.css`, the pipeline already works, adding a new mechanism is unnecessary |
| Admin UI location | **`admin/branding/`** | Admin-level config is not user settings; separate route enables admin gating |
| Randomizer coexistence | **`data-palette` priority: enabled brand > user cookie > randomizer** | CSS cascade stays identical; only the source of the attribute value changes |

---

## 1. What Already Exists (and why most proposals overcomplicate this)

The codebase already has a complete theme delivery pipeline:

```
Cookie (v10r_style)
  --> hooks.server.ts (loadStyle hook reads cookie, populates event.locals.style)
  --> i18n hook (transformPageChunk replaces %palette%, %typography%, %radius% in app.html)
  --> app.html (<html data-palette="P3" data-typography="T2" data-radius="R1">)
  --> app.css ([data-palette="P3"] { --color-bg: ...; })
  --> app.html inline <script> (reads cookie client-side to prevent FOUC on navigation)
```

This pipeline handles 8 palettes, 5 typography sets, and 3 radius presets with zero DB queries per page load. The visual identity feature should **extend this pipeline**, not replace it.

---

## 2. Architecture: Brand Priority Chain

The core insight is that "visual identity" is just a different source for the same `data-palette`/`data-typography`/`data-radius` attributes. The question is: which source wins?

### Priority (highest to lowest):

1. **Enabled brand settings** (`brand_settings.enabled = true`) -- if set, always wins
2. **User's locked style cookie** (`v10r_style` with `lck: true`) -- user chose to keep a style
3. **Randomizer** -- generates a new style

### Where brand settings come from:

- Admin saves theme in admin UI --> form action upserts the `brand_settings` singleton and calls `invalidateBrandCache()`
- On every page load, the style hook calls `getBrandConfig()`, which serves the cached `brand_settings` row (0ms warm, one DB read on cold start)
- When `enabled` is true, the brand palette/typography/radius override the randomizer for all visitors

### Why not Edge Config / Vercel KV?

The research agent correctly identified that DB-per-request is bad. But the solution is not to add a new infrastructure dependency -- it is the in-memory cache. `getBrandConfig()` reads the DB once per warm instance, then serves every request from memory at zero network cost.

The DB stores the admin's intent. The in-memory cache delivers it to every request. Admin saves once, then `invalidateBrandCache()` forces a fresh read.

### How do new visitors get the brand?

The style hook calls `getBrandConfig()`. If a brand is enabled, every visitor receives the brand palette/typography/radius — no per-visitor cookie or DB write required.

```
Page load:
  1. style hook: getBrandConfig() (cache hit, or one cold-start DB read)
  2. Check: is brand_settings.enabled true?
     YES --> use brand palette/typo/radius
     NO  --> fall through to user style cookie / randomizer
  3. All subsequent requests on a warm instance: cache-driven, zero DB queries
```

---

## 3. Database Schema

Two tables in the `app` schema. No revision history (YAGNI -- git tracks the code, and for a template project, admin theme changes are infrequent).

### `brand_settings` (singleton)

The active visual identity. One row, `id = 'default'`.

```
src/lib/server/db/schema/app/brand-settings.ts
```

```typescript
import { boolean, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './user-preferences';

export const brandSettings = appSchema.table('brand_settings', {
  id: text('id').primaryKey().default('default'),                // Single-row pattern
  paletteId: text('palette_id').notNull().default('P1'),         // e.g. 'P1', 'P3'
  typographyId: text('typography_id').notNull().default('T1'),   // e.g. 'T1', 'T4'
  radiusId: text('radius_id').notNull().default('R2'),           // e.g. 'R1', 'R2'
  enabled: boolean('enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

**Why single-row with `id = 'default'`**: No multi-tenant, no versioning needed. `UPSERT` on `'default'` is atomic and simple. If multi-tenant is ever needed, `id` becomes `tenantId`.

**Why three string columns, not JSONB**: Flat, fixed-shape data is simpler to validate, query, and type. JSONB would add parsing overhead for no benefit.

**Why `enabled`**: A positive boolean reads better in queries (`WHERE enabled = true`). Default `false` means saving a theme does not immediately affect the site.

### `custom_palettes`

Backs admin-created palettes derived from a preset. Per-user, not a singleton.

```
src/lib/server/db/schema/app/custom-palettes.ts
```

```typescript
import { index, integer, jsonb, text, timestamp } from 'drizzle-orm/pg-core';
import { user } from '../auth/_better-auth';
import { appSchema } from './user-preferences';

export const customPalettes = appSchema.table('custom_palettes', {
  id: text('id').primaryKey(),                                   // CP_{nanoid(12)}
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  basePaletteId: text('base_palette_id').notNull(),             // P0-P7 source preset
  lightColors: jsonb('light_colors').notNull().$type<Record<string, string>>(),
  darkColors: jsonb('dark_colors').notNull().$type<Record<string, string>>(),
  accentOffset: integer('accent_offset').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

---

## 4. Module Structure

```
src/lib/server/style/brand.ts          -- getBrandConfig(), invalidateBrandCache()
src/lib/server/branding/palette-crud.ts -- custom palette CRUD
src/lib/server/db/brand/queries.ts     -- getBrandSettings() / upsert
```

### `style/brand.ts`

Reads the `brand_settings` singleton through `getBrandSettings()` and caches it in memory.

```typescript
import { getBrandSettings } from '$lib/server/db/brand/queries';

let cached: { style: StyleConfig; enabled: boolean } | null = null;

/** Get brand config from cache (0ms) or DB (cold start). */
export async function getBrandConfig() {
  if (cached) return cached;
  const row = await getBrandSettings();
  if (!row) return null;
  cached = {
    style: { paletteId: row.paletteId, typographyId: row.typographyId, radiusId: row.radiusId },
    enabled: row.enabled,
  };
  return cached;
}

/** Invalidate cache — call after admin saves brand settings. */
export function invalidateBrandCache() {
  cached = null;
}
```

The cache is unreliable on serverless cold starts (a new instance has an empty cache), but for warm instances it eliminates redundant queries. On a cold start `getBrandConfig()` reads the DB once, caches the row, and serves every subsequent request from memory. `invalidateBrandCache()` is called after an admin save so the next read picks up the change.

### `branding/palette-crud.ts`

CRUD for the `custom_palettes` table. Exports `createCustomPalette`, `getCustomPaletteById`, `getCustomPalette`, `listCustomPalettes`, `updateCustomPalette`, and `deleteCustomPalette`.

---

## 5. Hooks Integration

The style hook in `hooks.server.ts` calls `getBrandConfig()` before consulting the user's cookie. An enabled brand always wins; otherwise the existing cookie / randomizer path runs:

```typescript
const loadStyle: Handle = async ({ event, resolve }) => {
  // 1. Enabled brand wins for everyone (cache hit, or one cold-start DB read)
  const brand = await getBrandConfig();
  if (brand?.enabled) {
    event.locals.style = resolveStyle(brand.style)!;
    return resolve(event);
  }

  // 2. User's existing style cookie
  const config = parseStyleCookie(event.cookies.get(STYLE_COOKIE_NAME));
  let resolved = config ? resolveStyle(config) : null;

  // 3. No valid cookie -- generate random style (existing behavior)
  if (!resolved) {
    const random = generateRandomStyle();
    resolved = resolveStyle(random)!;
    event.cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(random), STYLE_COOKIE_OPTIONS);
  }

  event.locals.style = resolved;
  return resolve(event);
};
```

The brand has no per-visitor cookie. The server resolves the brand on every request from the in-memory cache, and the `transformPageChunk` hook writes the resolved `data-palette`/`data-typography`/`data-radius` attributes into `app.html`. The existing FOUC inline script only reads the user's `v10r_style` cookie — when a brand is enabled the attributes are already server-rendered, so there is no flash to prevent.

---

## 6. Admin UI

### Route: `[[locale=locale]]/admin/branding/`

**Why not user settings**: Settings is per-user (theme, density, locale, avatar). Branding is site-wide admin config. Mixing them conflates user preferences with admin authority.

**Why `admin/branding/` not `admin/design/`**: "Branding" is more precise. "Design" implies the design system itself, which is not what the admin is editing. They are choosing a brand palette.

```
src/routes/[[locale=locale]]/admin/branding/
  +page.server.ts    -- load current brand settings, form actions (save, enable, disable)
  +page.svelte       -- admin branding UI
```

The `[[locale=locale]]` catch-all param is the project-wide i18n routing pattern; admin gating lives in the route guards, not a separate route group.

### Form Actions

```typescript
// +page.server.ts
export const actions: Actions = {
  save: async ({ request, locals }) => {
    // Validate admin role
    // Parse form: paletteId, typographyId, radiusId, enabled (boolean)
    // Upsert brand_settings singleton
    // Call invalidateBrandCache() so the next request reads the new row
  },
};
```

### Admin UI Components (per UX agent recommendations)

Three sections, each using existing palette/typography/radius registries:

1. **Color Palette** -- grid of 8 palette swatches (P0-P7), click to select
2. **Typography** -- 5 typography preset cards (T1-T5), click to select
3. **Border Radius** -- 3 radius preset cards (R1-R3), click to select
4. **Publish toggle** -- switch to activate/deactivate visual identity
5. **Live preview** -- client-side `style.setProperty` via `$effect` (changes `data-palette` attribute on `<html>` in real-time, reverts on cancel)

**No custom color picker in v1.** The UX agent's "brand color picker with auto-derivation" is a good idea but requires a color generation library (`culori`), WCAG validation UI, and a 9th dynamic palette slot. That is a v2 feature. For v1, the admin picks from the existing 8 palettes. This means:
- Zero new CSS generation
- Zero new color tokens
- Reuses the exact same `[data-palette="P3"]` rules already in `app.css`
- The entire feature is routing existing pieces differently, not building new ones

---

## 7. Propagation to All Visitors

Because the brand is resolved server-side on every request, there is no per-visitor propagation lag. When the admin enables a brand and `invalidateBrandCache()` runs, the next request on each warm instance reads the new `brand_settings` row and serves it to everyone — an enabled brand outranks any existing `v10r_style` cookie. Disabling the brand reverses this on the next request: visitors fall through to their cookie or the randomizer.

The only delay is per-instance cache warmth: a warm instance that has not yet been invalidated serves the previous value until its next read. `invalidateBrandCache()` clears the local cache; cold instances read fresh.

---

## 8. Randomizer Coexistence

The randomizer continues to work exactly as it does today. The visual identity is simply a higher-priority source for the same data:

```
Priority cascade (resolved server-side each request):
  brand_settings.enabled = true      --> use brand palette/typo/radius
  v10r_style cookie present and valid --> use user's randomizer selection
  neither                             --> randomize, set v10r_style
```

When the admin disables the brand (`enabled = false`), the next request falls through to the cookie / randomizer path for everyone. No cookie cleanup is needed because the brand never set a cookie.

---

## 9. File Map

```
FILES:
  src/lib/server/db/schema/app/brand-settings.ts             -- brand_settings singleton table
  src/lib/server/db/schema/app/custom-palettes.ts            -- custom_palettes table
  src/lib/server/style/brand.ts                              -- getBrandConfig() / invalidateBrandCache()
  src/lib/server/branding/palette-crud.ts                    -- custom palette CRUD
  src/lib/server/db/brand/queries.ts                         -- getBrandSettings() / upsert
  src/routes/[[locale=locale]]/admin/branding/+page.server.ts -- Load + form actions
  src/routes/[[locale=locale]]/admin/branding/+page.svelte    -- Admin branding UI
  src/hooks.server.ts                                         -- Style hook reads getBrandConfig() first
```

---

## 10. Known Tradeoffs

| Tradeoff | Accepted Because |
|----------|-----------------|
| No custom color picker -- admin picks from 8 existing palettes | Avoids color generation complexity; 8 palettes cover a wide range; custom colors are a v2 feature with two concrete use cases before building |
| Cache warmth can briefly serve a stale brand | `invalidateBrandCache()` clears the local cache on save; a not-yet-invalidated warm instance serves the previous value until its next read; acceptable for a template project |
| In-memory cache is empty on serverless cold starts | `getBrandConfig()` reads the DB once per cold start, then serves from memory; the cache is opportunistic, not required for correctness |
| No revision history for theme changes | Git tracks code changes; admin theme is a single row updated infrequently; revision table is speculative |
| No Edge Config integration | Adds infrastructure dependency for a template project; the cached DB singleton has zero per-request latency; Edge Config is appropriate for SaaS scale, not here |

---

## 11. Future Extension Path

When the feature earns more complexity:

1. **Custom color picker** (v2): Add a P99 "Custom" palette slot. Admin picks a brand hue. Use `culori` to derive all 22 tokens in OKLCH. Generate a `[data-palette="P99"]` CSS block at save time (stored in DB as JSONB, injected via `transformPageChunk` as an inline `<style>`). The existing pipeline accommodates this -- `transformPageChunk` already runs, just add a new placeholder.

2. **Cross-instance invalidation** (v2): Add a short cache TTL or a Redis pub/sub signal so warm instances pick up a brand change without waiting for their next cold read. Today `invalidateBrandCache()` only clears the instance that handled the save.

3. **Multi-tenant** (v3): Change `brand_settings.id` from `'default'` to a tenant identifier. Add tenant resolution to hooks. Everything else stays the same.

4. **Custom fonts** (v2): The scout agent correctly flagged font loading as a harder FOUC problem. Custom font URLs would need `<link rel="preload">` injection via `transformPageChunk`. This is a separate feature with its own architecture concerns.
