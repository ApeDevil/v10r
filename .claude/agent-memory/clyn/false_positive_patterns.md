# clyn false-positive patterns (velociraptor)

Stable patterns observed while triaging `knip`/grep candidates. Check these before
reporting a "dead code" finding.

## Tooling
- No `bun`/`biome`/`knip` on host — container `v10r` is running (`podman ps`); use
  `podman exec v10r sh -c "cd /app && bunx knip ..."` / `bunx biome check .`.
- `knip.config.ts` **excludes `exports,types` from the default run** ("too noisy with
  Svelte templates... run with `--include exports,types` for deep audits"). The project
  itself judges the raw exports/types list as noisy — spot-check rather than dump it.
- `knip.config.ts` already documents several Svelte-template-only barrel/type files as
  ignored (viz chart/graph/plot `types.ts`/`index.ts`, `schemas/style.ts`,
  `server/analytics/index.ts` dormant-by-design, `server/db/rag/setup.ts`).

## Confirmed false positives from `knip`'s "Unused files" pass
Svelte-only barrels/type files that knip's Svelte-compiler pass fails to trace through
`.svelte` `import type { X } from './types'` — verified via direct grep, all ARE consumed:
- `src/lib/components/branding/types.ts` (`OwnedPalette`) — used in StylePicker.svelte,
  CustomPaletteWorkshop.svelte, showcases/shell/style +page.svelte.
- `src/lib/components/chat/citation-types.ts` — used in Chatbot.svelte, ChatMessage.svelte,
  ChunkView.svelte, ChatPanel.svelte, CitationBadge.svelte.
- `src/lib/components/composites/chatbot/harness-types.ts` — used in PlanCard.svelte,
  ChatPanel.svelte.
- `src/lib/components/primitives/pane/types.ts` (`PaneGroupHandle`) — used in
  ReorderablePaneLayout.svelte, PaneGroup.svelte.
- `src/lib/components/viz/diagram/erd/types.ts` — used in ErdDiagram.svelte.
=> Pattern: any `types.ts` sibling of a `.svelte` component directory flagged "unused
file" by knip needs a direct grep of its exported type names before trusting the flag.

## Confirmed TRUE positives (dead barrels) from the same pass
- `src/lib/server/ai/context/index.ts` and `src/lib/server/ai/loop/index.ts` — genuinely
  dead. Every consumer imports the concrete module directly (`./context/system-prompt`,
  `$lib/server/ai/loop/compact`) never through the barrel path itself. Zero hits for
  `from '$lib/server/ai/context'` / `from '$lib/server/ai/loop'`.
=> These two barrels are real dead code, unlike the Svelte-adjacent ones above — the
   discriminator is whether anything imports the *barrel path* itself vs. always
   reaching past it to the concrete file.

## One-off / idempotent DB scripts — NOT dead despite zero package.json wiring
`scripts/db/collapse-consent-tier.ts`, `scripts/db/drop-brand-settings.ts`,
`scripts/db/verify-tx-rollback.ts`, `scripts/perf/db-explain.ts`,
`scripts/content/_seed-domain.ts` are deliberately NOT in package.json — project
convention documents them as one-off/idempotent scripts run manually via
`podman exec v10r bun run scripts/...`, referenced from docs
(`docs/stack/data/postgres.md`, `docs/blueprint/analytics/activation.md`,
`docs/codebase-organization.md`). Underscore-prefixed scripts (`_db.ts`, `_seed-domain.ts`)
are internal helpers imported by sibling scripts, not standalone entries.
`scripts/db/apply-analytics-user-lane.ts` is the ONE exception with zero doc references
found — flagged separately as medium-confidence "possibly-already-applied, safe to
archive" rather than "dead code."

## Internal composite barrels (e.g. `components/composites/dock/index.ts`)
Unlike `$lib/index.ts` (true public API, never flag), an internal composite's own
`index.ts` re-exporting a helper that NOTHING outside the composite ever imports is a
real finding, not a "public API surface" exception. Verified 12 such symbols
(`hasWriteAccess`, `toggleScope`, `resetStorageState`, `togglePin`, `getActiveContexts`,
`hasContext`, `clearDockState`, `getIOLogCount`, `LAYOUT_PRESETS`, `getFocusedPanelId`,
`hasPanelMenus`, `clearWorkspaceStore` in `dock/`) are barrel-re-exported but have zero
consumers anywhere else in `src/`. Same pattern found for `$lib/errors/index.ts`
(`isDomainError`), `$lib/shortcuts/index.ts` (`getModifierKey`, `getShortcuts`),
`$lib/utils/fonts/index.ts` (`findPairing`).
=> Method: `grep -rlP "\bNAME\b" src --include=*.ts --include=*.svelte | grep -v
   <definingFile>` — if the ONLY other hit is the module's own `index.ts` barrel line,
   it's barrel-only-dead, not a false positive from re-export tracing.

## Dynamic string-key i18n construction (do NOT flag as dead)
`src/lib/server/notifications/service.ts:81` builds the paraglide key as
`` `notif_push_${type}` `` at runtime — so `notif_push_mention`, `notif_push_comment`,
`notif_push_system`, `notif_push_security`, `notif_push_success`, `notif_push_follow`
(and the base `notif_mention` etc. keys used the same way for the in-app channel,
`src/routes/.../showcases/notifications/send/+page.server.ts` messageKey map) are LIVE
despite zero static `m.KEY(` grep hits. Always check for `` m[`prefix_${var}`] `` /
plain string literal construction feeding a lookup before calling an i18n key dead.

## i18n key-usage grep method that works
Static paraglide usage is `m.someKey()` or, for label-as-value patterns (nav registries
etc.), a bare property reference `m.someKey` with no call parens. Grep must use
`\bm\.KEY\b` (no trailing `\(` requirement) to catch both — requiring `\(` produces
~250 false "unused" hits in this codebase from label-reference patterns.
