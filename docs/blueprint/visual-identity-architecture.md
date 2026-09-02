# Visual Identity Architecture

> How v10r resolves a visitor's palette, typography and border-radius — and why there is deliberately **no** site-wide brand lock.

An earlier design shipped an admin "visual identity" lock: a `brand_settings` singleton that overrode every visitor's style. It was removed. v10r's whole point is that the interface is not stiff, and a switch that pins all visitors to one palette contradicts that. What remains is per-visitor: a randomizer, a manual picker, and optional custom palettes.

## Decision Summary

| Tension | Decision | Rationale |
|---------|----------|-----------|
| Site-wide brand vs per-visitor style | **Per-visitor only** | No lock, no singleton, no override. Every visitor owns their own look |
| Where a visitor's choice lives | **`v10r_style` cookie**, mirrored to `app.user_preferences` for signed-in users | Non-httpOnly so the blocking script can apply it before first paint |
| Build-time CSS vs runtime injection | **Neither — reuse the `data-palette` attribute cascade** | The CSS already lives in `app.css`; only the attribute value changes |
| Random vs manual | **Both, side by side** | `POST /api/style/roll` rolls all three at once; `POST /api/style/pick` sets one dimension at a time |
| Custom palette persistence | **Client-side for everyone, DB for signed-in users** | Crafting needs no account; saving does |
| UI location | **`/showcases/shell/style`** | Public, and the showcase *is* the feature test |

---

## 1. Resolution cascade

`loadStyle` in `src/hooks.server.ts` runs early in the handle chain — notably **before** `sessionPopulate`, so it structurally cannot know who the user is. It resolves in this order:

1. **`v10r_style` cookie** — `{pid, tid, rid, v:1}`, parsed by `parseStyleCookie`.
2. **Custom palette lookup** — only when `pid` starts with `CP_`. `getCustomPaletteById()` reads the row and stamps `locals.customPaletteColors`.
3. **Randomizer fallback** — no cookie, or one that no longer resolves → `generateRandomStyle()`, written back so the next visit is stable.

The resolved style lands on `locals.style` and is stamped onto `<html>` as `data-palette` / `data-typography` / `data-radius` via `transformPageChunk`.

### Why `getCustomPaletteById` has no ownership check

Because it cannot. `loadStyle` runs before auth is populated, so at that point there is no user to compare against. A `CP_` id is therefore globally readable by anyone who puts it in their own cookie.

This is accepted, and the mitigation is placed where it can actually work: **ownership is enforced at the write and pick boundaries**, never at render. See §3.

The function is also TTL-cached (60s, 1000-entry cap, negative results included). The style cookie is read on *every* request before any auth or rate limit, so an uncached `CP_` path would let a forged cookie turn each request into a Neon round-trip.

---

## 2. Custom palettes

`app.custom_palettes` — per-user rows, derived from a preset.

```
src/lib/server/db/schema/app/custom-palettes.ts
```

```typescript
export const customPalettes = appSchema.table('custom_palettes', {
  id: text('id').primaryKey(),                                   // CP_{nanoid(12)}
  name: text('name').notNull(),
  description: text('description').notNull().default(''),
  basePaletteId: text('base_palette_id').notNull(),              // P0-P7 source preset
  lightColors: jsonb('light_colors').notNull().$type<Record<string, string>>(),
  darkColors: jsonb('dark_colors').notNull().$type<Record<string, string>>(),
  accentOffset: integer('accent_offset').notNull().default(0),
  createdBy: text('created_by').notNull().references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

CRUD lives in `src/lib/server/style/palettes.ts`. Every mutation carries an `AND created_by = :userId` predicate, so a mismatched id simply affects no rows and returns `null` — which is how the endpoints collapse "doesn't exist" and "isn't yours" into a single 404.

`countCustomPalettes()` backs `MAX_CUSTOM_PALETTES_PER_USER`. Creation used to be admin-only and so carried no ceiling; open to every account it needs one.

### SSR-only CSS injection — the constraint that shapes the UI

A custom palette has no rule in `app.css`. Its CSS is a `<style>` block built in the `i18n` handle and injected at `</head>` on a **full document render only**. Client-side navigation and `invalidateAll()` do not re-run `transformPageChunk`.

Consequence: setting `data-palette="CP_…"` from the client finds no matching rule, and every `--color-*` falls back to the `:root` defaults — the page *loses* its palette instead of gaining one. Applying a custom palette therefore triggers a full reload; the cookie is already written by then, so SSR renders it correctly in both light and dark. The live preview inside the editor sidesteps this entirely by writing inline custom properties on `<html>` (see `styles/random/token-vars.ts`), which outrank every `[data-palette]` rule.

`tokenToCssVar()` is shared between that preview and the SSR injector on purpose — two copies that merely agree today is how a preview silently stops matching what the server renders.

---

## 3. API surface

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/style/roll` | none | Randomizes all three dimensions, excluding the current values. 10/60s per IP |
| `POST /api/style/pick` | none for presets | Sets any subset of `{paletteId, typographyId, radiusId}`, merged onto the current cookie. 60/60s, keyed per user when signed in |
| `POST /api/style/palettes` | session | Create. Quota-checked |
| `PATCH\|DELETE /api/style/palettes/[id]` | session | Ownership enforced in the SQL predicate |

**A `CP_` pick requires a session and ownership** (401 / 404). Rendering someone else's palette via a hand-edited cookie is already possible and cannot be prevented (§1) — but `pick` echoes the palette *name*, which is user-authored text. Leaving it open would build a `CP_id → name` oracle that the cookie path never exposed. Gating it also keeps the endpoint's anonymous surface entirely DB-free, the same property that makes `roll` safe.

Both mutating endpoints sit under `/api/` and are not CSRF-exempt, so clients must call them through `apiFetch` (which sets `X-Requested-With`).

---

## 4. Client state

`src/lib/state/style.svelte.ts` holds the resolved style in a context-scoped rune. Its single `$effect` is the **only** writer of the three `<html>` `data-*` attributes — everything else mutates state and lets that effect react.

- `roll(toast?)` — random, all three.
- `pick(patch, toast?)` — one dimension. Applied optimistically so the page repaints on click, then reconciled with the server response (authoritative — it resolves custom palette names). **Reverts on failure**: leaving the visual changed while the cookie was not would look fine until the next reload silently snapped it back.

---

## 5. File map

```
src/hooks.server.ts                              -- loadStyle + CSS injection
src/lib/state/style.svelte.ts                    -- client state, sole data-* writer
src/lib/styles/random/cookie.ts                  -- v10r_style serialization
src/lib/styles/random/generator.ts               -- generateRandomStyle, resolveStyle
src/lib/styles/random/merge.ts                   -- mergeStyleConfig (pure, tested)
src/lib/styles/random/token-vars.ts              -- token -> CSS var, live preview
src/lib/styles/random/palette-sanitize.ts        -- injection allowlist
src/lib/server/style/palettes.ts          -- custom palette CRUD + TTL cache
src/lib/server/style/persist.ts                  -- user_preferences mirror
src/lib/components/style/StylePicker.svelte   -- the public picker
src/lib/components/style/CustomPaletteWorkshop.svelte
src/lib/components/style/CustomPaletteEditor.svelte
src/routes/api/style/{roll,pick,palettes}/       -- endpoints
src/routes/[[locale=locale]]/(public)/showcases/shell/style/
```

---

## 6. Known tradeoffs

- **Applying a custom palette costs a reload.** The alternative is extracting the `<style>` block builder into an isomorphic module used by both the hook and the client. Worth doing if custom palettes get heavier use; not worth a second implementation.
- **`saveStyleToDb` writes are never read back.** `loadStyleFromDb` was removed (dead code — it had no call sites): `loadStyle` runs before `sessionPopulate`, so the hook has no user id to load by. The DB copy is a backup, not a restore path — do not describe it as "your account remembers your style" unless a read path is added.
- **Custom palette ids are guessable-in-principle.** 48 bits of entropy makes enumeration impractical, and the payload is a palette, but this is a deliberate accept rather than an oversight.
