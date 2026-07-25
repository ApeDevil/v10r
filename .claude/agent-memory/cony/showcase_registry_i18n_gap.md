# Showcase registry i18n gap (confirmed 2026-07-25)

## Ground truth

`src/lib/showcases/registry.ts` is the single source of truth for the showcase card tree (18 cards). Every `title`, `description`, and `sublinks[].label` (including nested `children[].label`) is a hardcoded English string literal. No `m.*()` calls anywhere in the file.

Consumers, all rendering the raw hardcoded strings with zero locale awareness:

- `src/routes/[[locale=locale]]/(public)/showcases/+page.svelte` — hub grid, does `title={card.title}` / `description={card.description}` directly into `LinkCard`.
- `LinkCard.svelte` (`src/lib/components/composites/link-card/`) — also renders `sublink.label` directly in the card's top-right sublink row.
- `showcases.ts` route helper — `getShowcaseTabs(basePath)` returns `card.sublinks` as-is; `getShowcaseSubTabs(parentPath)` returns nested `children` as-is.
- Every per-section `+layout.svelte` (25 files, one per showcase section/subsection) calls `getShowcaseTabs` and passes the result straight into `ShowcaseLayout` → `NavTab`, which renders `tabs[].label` directly. So sublink labels leak into the **tab bar of every showcase subpage**, not just the hub grid — confirmed by reading `ShowcaseLayout.svelte` (passes `tabs` straight to `NavTab`) and two `+layout.svelte` samples.

Additionally, most `+layout.svelte` files hardcode a SECOND, independently-authored English string for title/description/breadcrumb/ariaLabel — not derived from registry.ts at all, so the "same" card already has two out-of-sync English copies. Example: registry.ts admin description is "How v10r exposes admin surfaces to a single operator — controller, lawful basis, retention, and your rights." while `admin/+layout.svelte` hardcodes a different sentence: "The accountability surface for v10r.dev — who collects what, why it's lawful, how long it's kept, and how to exercise your rights."

## The one exception — the pattern to extend

`analytics/+layout.svelte` is already migrated: `title={m.showcase_analytics_layout_title()}`, `description={m.showcase_analytics_layout_description()}`, breadcrumb via `m.showcase_analytics_layout_breadcrumb()`, aria via `m.showcase_analytics_layout_aria()`. Matching keys exist in `messages/en.json` (and presumably de/ru — not yet verified for parity). This is the naming convention already established in the codebase (`showcase_<slug>_layout_<field>`) — any remediation should extend this convention, not invent a new one. Even analytics still leaks hardcoded English **sublink/tab labels**, since those come from registry.ts regardless of layout-file migration status.

## Remediation shape (not yet built, not yet assigned)

Two separate string pools need converting, and they should collapse into ONE authored string per concept rather than staying two:
1. `registry.ts` — 18 titles, 18 descriptions, ~65 sublink/child labels.
2. The ~23 remaining un-migrated `+layout.svelte` files — title/description/breadcrumb/aria, 4 keys each.

Rough new/converted key count: ~190–210 keys × 3 locales ≈ 570–630 string entries. This is a real localization pass, not a quick fix — recommend batching per-section (one showcase fully done in all 3 locales, ship, repeat), never per-field across all cards (partial per-field translation — title translated, description left English — reads as more broken than no translation at all, and violates the project's locale-parity-non-negotiable rule).

Ownership: registry.ts's data shape (string literal vs `() => string` field vs slug+resolver) is svey/archy's call, not cony's — cony's job is to confirm the gap exists, flag severity, and hand over the authored copy once the mechanism is chosen.
