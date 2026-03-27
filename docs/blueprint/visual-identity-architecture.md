# Visual Identity Architecture

> Final architecture for the admin-configurable "visual identity" system that allows an admin to lock a site-wide palette, typography, and border-radius — overriding the style randomizer for all visitors.

## Decision Summary

| Tension | Decision | Rationale |
|---------|----------|-----------|
| Cookie vs DB vs Edge Config | **Cookie (same as randomizer)** | The pipeline already works, zero DB queries per page load, and this is a template not a SaaS product |
| Generic `site_config` vs dedicated table | **Dedicated `site_theme` table** | Only two concrete use cases exist (randomizer + visual identity), a generic config table is speculative |
| Build-time CSS vs runtime injection | **Neither -- reuse `data-palette` attribute cascade** | The CSS already exists in `app.css`, the pipeline already works, adding a new mechanism is unnecessary |
| Admin UI location | **`(shell)/app/admin/branding/`** | Admin-level config is not user settings; separate route group enables future admin gating |
| Randomizer coexistence | **`data-palette` priority: brand cookie > user cookie > randomizer** | CSS cascade stays identical; only the cookie value changes |

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

## 2. Architecture: Cookie Priority Chain

The core insight is that "visual identity" is just a different source for the same `data-palette`/`data-typography`/`data-radius` attributes. The question is: which cookie wins?

### Priority (highest to lowest):

1. **Visual identity cookie** (`v10r_brand`) -- if set, always wins
2. **User's locked style cookie** (`v10r_style` with `lck: true`) -- user chose to keep a style
3. **Randomizer** -- generates a new style

### Where visual identity cookie gets set:

- Admin saves theme in admin UI --> form action writes to DB **and** sets `v10r_brand` cookie
- On every page load, `loadStyle` hook checks for `v10r_brand` cookie first
- The cookie is non-httpOnly (same as `v10r_style`) so the `app.html` inline script can read it for FOUC prevention

### Why not Edge Config / Vercel KV?

The research agent correctly identified that DB-per-request is bad. But the solution is not to add a new infrastructure dependency -- it is to recognize that the cookie already solves this. The cookie IS the per-request store, and it costs zero network round trips.

The DB stores the admin's intent. The cookie delivers it to the browser. Admin saves once, cookie persists for a year.

### How do new visitors get the brand cookie?

They do not have it on first visit. The `loadStyle` hook must check the DB **once** on first visit (no cookie present) and set the cookie. This is the only DB query, and it happens once per visitor per year.

```
First visit (no cookies):
  1. loadStyle: no v10r_brand cookie, no v10r_style cookie
  2. Check: is there a published visual identity in DB?
     YES --> set v10r_brand cookie, use brand palette/typo/radius
     NO  --> generate random style, set v10r_style cookie
  3. All subsequent requests: cookie-driven, zero DB queries
```

---

## 3. Database Schema

Single table in the `app` schema. No revision history (YAGNI -- git tracks the code, and for a template project, admin theme changes are infrequent).

```
src/lib/server/db/schema/app/site-theme.ts
```

```typescript
import { boolean, pgSchema, text, timestamp } from 'drizzle-orm/pg-core';

// Reuse existing appSchema from user-preferences.ts
import { appSchema } from './user-preferences';

export const siteTheme = appSchema.table('site_theme', {
  id: text('id').primaryKey().default('default'),   // Single-row pattern: always 'default'
  paletteId: text('palette_id').notNull(),           // e.g. 'P1', 'P3'
  typographyId: text('typography_id').notNull(),     // e.g. 'T2', 'T4'
  radiusId: text('radius_id').notNull(),             // e.g. 'R1', 'R2'
  published: boolean('published').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by'),                     // userId of admin who last saved
});
```

**Why single-row with `id = 'default'`**: No multi-tenant, no versioning needed. `UPSERT` on `'default'` is atomic and simple. If multi-tenant is ever needed, `id` becomes `tenantId`.

**Why not JSONB**: Three string columns are simpler to validate, query, and type than a JSONB blob. The data is flat and fixed-shape. JSONB would add parsing overhead for no benefit.

**Why `published` instead of `isDraft`**: Positive boolean reads better in queries (`WHERE published = true`). Default `false` means saving a theme does not immediately affect the site.

---

## 4. Module Structure

```
src/lib/server/site-theme/
  index.ts          -- public API: getPublishedTheme(), upsertTheme()
  cache.ts          -- in-memory cache with TTL (optional, for warm instances)
```

### `index.ts`

```typescript
import { eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { siteTheme } from '$lib/server/db/schema/app/site-theme';

export interface SiteThemeConfig {
  paletteId: string;
  typographyId: string;
  radiusId: string;
}

/** Get the published visual identity, or null if none is active */
export async function getPublishedTheme(): Promise<SiteThemeConfig | null> {
  const [row] = await db
    .select({
      paletteId: siteTheme.paletteId,
      typographyId: siteTheme.typographyId,
      radiusId: siteTheme.radiusId,
    })
    .from(siteTheme)
    .where(eq(siteTheme.published, true))
    .limit(1);

  return row ?? null;
}

/** Save (upsert) the visual identity */
export async function upsertTheme(
  config: SiteThemeConfig & { published: boolean },
  userId: string,
) {
  return db
    .insert(siteTheme)
    .values({
      id: 'default',
      ...config,
      updatedBy: userId,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: siteTheme.id,
      set: {
        ...config,
        updatedBy: userId,
        updatedAt: new Date(),
      },
    })
    .returning();
}
```

### Optional: In-Memory Cache

The research agent correctly noted that in-memory cache is unreliable on serverless (cold starts destroy it). However, for warm instances it eliminates redundant queries. Keep it simple:

```typescript
// cache.ts
let cached: { data: SiteThemeConfig | null; expiry: number } | null = null;

export function getCached(): SiteThemeConfig | null | undefined {
  if (cached && Date.now() < cached.expiry) return cached.data;
  return undefined; // cache miss
}

export function setCache(data: SiteThemeConfig | null, ttlMs = 60_000) {
  cached = { data, expiry: Date.now() + ttlMs };
}
```

This is opportunistic. If the cache is warm, skip the DB. If cold, query once, cache, and move on. The important point: this cache only matters for the "first visit" path. Returning visitors have the cookie.

---

## 5. Hooks Integration

Modify the existing `loadStyle` hook in `hooks.server.ts`. The change is minimal:

```typescript
const loadStyle: Handle = async ({ event, resolve }) => {
  // 1. Check for visual identity cookie (highest priority)
  const brandCookie = event.cookies.get('v10r_brand');
  if (brandCookie) {
    const config = parseStyleCookie(brandCookie);
    if (config) {
      const resolved = resolveStyle(config);
      if (resolved) {
        event.locals.style = resolved;
        return resolve(event);
      }
    }
    // Invalid brand cookie -- fall through to regenerate
  }

  // 2. Check for user's existing style cookie
  const cookieValue = event.cookies.get(STYLE_COOKIE_NAME);
  let config = parseStyleCookie(cookieValue);
  let resolved = config ? resolveStyle(config) : null;

  // 3. No valid cookie -- check DB for published visual identity (once per visitor)
  if (!resolved) {
    const published = await getPublishedTheme(); // uses cache if warm
    if (published) {
      config = {
        paletteId: published.paletteId as PaletteId,
        typographyId: published.typographyId as TypographyId,
        radiusId: published.radiusId as RadiusId,
        locked: false,
      };
      resolved = resolveStyle(config);
      if (resolved) {
        // Set brand cookie so we never query DB again for this visitor
        event.cookies.set('v10r_brand', serializeStyleCookie(config), STYLE_COOKIE_OPTIONS);
        event.locals.style = resolved;
        return resolve(event);
      }
    }

    // 4. No visual identity -- generate random style (existing behavior)
    config = generateRandomStyle();
    resolved = resolveStyle(config)!;
    event.cookies.set(STYLE_COOKIE_NAME, serializeStyleCookie(config), STYLE_COOKIE_OPTIONS);
  }

  event.locals.style = resolved;
  return resolve(event);
};
```

### FOUC Prevention (app.html inline script)

Extend the existing inline script to also check `v10r_brand`:

```javascript
// In app.html <script>
const bm = document.cookie.match(/v10r_brand=([^;]+)/);
const sm = bm || document.cookie.match(/v10r_style=([^;]+)/);
if (sm) {
  try {
    const s = JSON.parse(decodeURIComponent(sm[1]));
    if (s.pid) document.documentElement.dataset.palette = s.pid;
    if (s.tid) document.documentElement.dataset.typography = s.tid;
    if (s.rid) document.documentElement.dataset.radius = s.rid;
  } catch {}
}
```

---

## 6. Admin UI

### Route: `(shell)/app/admin/branding/`

**Why not `/app/settings/`**: Settings is per-user (theme, density, locale, avatar). Branding is site-wide admin config. Mixing them conflates user preferences with admin authority. The existing settings page already has 5 cards and 3 form actions. Adding branding there would make it the largest page in the app.

**Why `admin/branding/` not `admin/design/`**: "Branding" is more precise. "Design" implies the design system itself, which is not what the admin is editing. They are choosing a brand palette.

```
src/routes/(shell)/app/admin/
  +layout.server.ts    -- admin role guard (future: check user.role)
  branding/
    +page.server.ts    -- load current theme, form actions (save, publish, unpublish)
    +page.svelte       -- admin branding UI
```

### Form Actions

```typescript
// +page.server.ts
export const actions: Actions = {
  save: async ({ request, locals }) => {
    // Validate admin role
    // Parse form: paletteId, typographyId, radiusId, publish (boolean)
    // Upsert to DB
    // If publishing: set v10r_brand cookie on admin's browser too
    // If unpublishing: delete v10r_brand cookie
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

## 7. Cookie Propagation to Other Visitors

When admin publishes a visual identity, the admin's browser gets the `v10r_brand` cookie immediately. But other visitors (who already have `v10r_style` cookies) will not see the change until:

1. Their `v10r_brand` cookie is missing (first visit, or cookie expired)
2. The `loadStyle` hook queries the DB and sets the cookie

**The propagation strategy**: When admin publishes, do NOT attempt to invalidate all visitors' cookies (impossible without a broadcast mechanism). Instead:

- New visitors get the visual identity on first visit (DB query path)
- Existing visitors keep their randomizer style until their `v10r_style` cookie expires (1 year)
- To force-propagate sooner: add a `v10r_brand_v` (version) check. When admin publishes, increment a version counter. The `loadStyle` hook checks if the brand cookie's version matches the DB version. If not, re-query and update.

**For v1, skip version propagation.** The template audience is small. New visitors get the brand immediately. Existing visitors get it when their cookie rotates. This is acceptable for a template project.

---

## 8. Randomizer Coexistence

The randomizer continues to work exactly as it does today. The visual identity is simply a higher-priority source for the same data:

```
Priority cascade:
  v10r_brand cookie present and valid  --> use brand palette/typo/radius
  v10r_style cookie present and valid  --> use user's randomizer selection
  neither present                      --> check DB for published visual identity
                                           found --> set v10r_brand, use it
                                           not found --> randomize, set v10r_style
```

When visual identity is unpublished (admin toggles off):
- `loadStyle` hook: `v10r_brand` cookie is no longer set for new visitors
- Existing visitors: their `v10r_brand` cookie should be deleted. The unpublish action can set `v10r_brand` with `maxAge: 0` on the admin's browser, but other visitors' brand cookies will linger until they expire or the hook detects the theme is unpublished.
- Simple fix: store `published` state in the brand cookie itself. The hook can check `published` before using the brand cookie values. Or: the brand cookie simply is not set when no visual identity is published. New visitors go through the randomizer path.

---

## 9. File Map

```
NEW FILES:
  src/lib/server/db/schema/app/site-theme.ts     -- Drizzle table definition
  src/lib/server/site-theme/index.ts              -- Business logic (getPublishedTheme, upsertTheme)
  src/lib/server/site-theme/cache.ts              -- Optional in-memory TTL cache
  src/routes/(shell)/app/admin/+layout.server.ts  -- Admin role guard
  src/routes/(shell)/app/admin/branding/+page.server.ts  -- Load + form actions
  src/routes/(shell)/app/admin/branding/+page.svelte     -- Admin branding UI

MODIFIED FILES:
  src/hooks.server.ts                             -- Extend loadStyle with brand cookie priority
  src/app.html                                    -- Extend inline script for v10r_brand
  src/lib/server/db/schema/app/index.ts           -- Export site-theme
  src/lib/server/db/schema/core.ts                -- Export app schema if not already
```

---

## 10. Known Tradeoffs

| Tradeoff | Accepted Because |
|----------|-----------------|
| No custom color picker -- admin picks from 8 existing palettes | Avoids color generation complexity; 8 palettes cover a wide range; custom colors are a v2 feature with two concrete use cases before building |
| No instant propagation to existing visitors | Template project, small audience; version-based propagation can be added later without schema changes |
| In-memory cache is unreliable on serverless cold starts | Cookie handles warm path; DB query only on first visit; cache is opportunistic, not required |
| No revision history for theme changes | Git tracks code changes; admin theme is a single row updated infrequently; revision table is speculative |
| Brand cookie is non-httpOnly (readable by client JS) | Same pattern as existing `v10r_style` cookie; required for FOUC prevention in inline `<script>` |
| No Edge Config integration | Adds infrastructure dependency for a template project; cookie-based approach has zero latency; Edge Config is appropriate for SaaS scale, not here |

---

## 11. Future Extension Path

When the feature earns more complexity:

1. **Custom color picker** (v2): Add a P99 "Custom" palette slot. Admin picks a brand hue. Use `culori` to derive all 22 tokens in OKLCH. Generate a `[data-palette="P99"]` CSS block at save time (stored in DB as JSONB, injected via `transformPageChunk` as an inline `<style>`). The existing pipeline accommodates this -- `transformPageChunk` already runs, just add a new placeholder.

2. **Instant propagation** (v2): Add a `brandVersion` integer to `site_theme`. Store version in brand cookie. On each request, compare cookie version to cached DB version. Mismatch triggers re-query + cookie update. Cache TTL of 60s means propagation within 60s for warm instances, next-visit for cold.

3. **Multi-tenant** (v3): Change `site_theme.id` from `'default'` to a tenant identifier. Add tenant resolution to hooks. Everything else stays the same.

4. **Custom fonts** (v2): The scout agent correctly flagged font loading as a harder FOUC problem. Custom font URLs would need `<link rel="preload">` injection via `transformPageChunk`. This is a separate feature with its own architecture concerns.
