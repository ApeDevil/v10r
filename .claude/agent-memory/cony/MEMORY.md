# Cony Memory Index

## Page copy builds

- [/credits page i18n](credits_page_i18n.md) — 2026-07-31 full `credits_*` (53 keys) + `footer_copyright`/`footer_built_with` block built for en/de/ru from `src/lib/credits/registry.ts`; reusable term decisions (Docs/Website/Showcase/Hosted-service/Pipeline/Cache/Rate-Limiting/blog-post de+ru equivalents), ru "Кредиты" false-friend trap for "Credits", role-line no-period vs prose-period register split.
- [Feedback band i18n](feedback_band_i18n.md) — 2026-07-31 branch `credits`: removed dead `footer_feedback` key (all 3 locales), added `feedback_field_source_{label,description}` + `feedback_band_{prompt,cta}` for the new pre-footer feedback band; confirmed `feedback_*` cluster register (DE informal `du`, RU formal `вы` lowercase-mid-sentence) — reuse for any future `feedback_*` additions.

## Locale parity audits

- [Showcase registry i18n gap](showcase_registry_i18n_gap.md) — CONFIRMED 2026-07-25: `src/lib/showcases/registry.ts` card titles/descriptions/sublink labels (~18 titles + 18 descriptions + ~65 sublink labels) are hardcoded English, zero i18n, rendered as-is by the public hub page and leaked into every showcase page's tab bar via `getShowcaseTabs`. Most `+layout.svelte` files ALSO hardcode a second, un-synced English copy of title/description. `analytics/+layout.svelte` is the one exception — already migrated to `showcase_<slug>_layout_{title,description,breadcrumb,aria}` message-key pattern. That's the pattern to extend, not invent.

## Established voice/terminology decisions

- Dev-audience loanwords that survive en/de/ru untouched, no re-authoring needed: Frontend, Backend, API, AI→KI(de)/ИИ(ru), App Shell (PWA term-of-art, kept Latin in all 3 locales).
- "Security" alone is NOT an honest label for GDPR/privacy/data-rights content — that's governance/compliance, not threat-defense. Pair as "Security & Privacy" / "Sicherheit & Datenschutz" (idiomatic German compliance collocation) / "Безопасность и конфиденциальность" if one section must hold both auth/anti-abuse AND admin/privacy content.
- A section named identically to a card inside it (e.g. section "Database" containing card "Database") is a naming smell — breadcrumb reads as a stutter (Showcases → Database → Database). Rename the section, not the card (card titles are more specific and more load-bearing for search/deep-links).
