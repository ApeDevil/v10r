# /credits page — i18n voice decisions (2026-07-31)

Built the full `credits_*` (53 keys) + `footer_copyright`/`footer_built_with` (2 keys)
block for `messages/{en,de,ru}.json`, sourced from `src/lib/credits/registry.ts`
(10 groups, 33 entries). Route/component not yet built (out of cony's lane —
svey/ary territory); this is copy-only, ready for wiring.

## Reusable term decisions (apply these, don't re-derive)

- "Credits" (page title) → de keeps **"Credits"** untranslated (established OSS-page
  loanword in German dev culture, avoids the stiffer "Danksagungen"). ru → **"Благодарности"**.
  Never use ru "Кредиты" for this sense — that word means bank loans, a false friend.
- "Docs" as a short link/button label (not a nav item) → de **"Doku"**, ru **"Доки"**
  (matches existing `showcase_docs_button`). This is the casual short form; the formal
  full word (de "Dokumentation", ru "документация") is for prose sentences, not chip labels.
  `nav_docs` (top-level nav) stays formal ("Dokumentation"/"Документация") — don't conflate.
- "Website" link label → de **"Website"** (untranslated), ru **"Сайт"** (matches
  `showcase_forms_field_website`).
- "Showcase" (singular, as a link label) → de **"Showcase"** (established loanword,
  see `admin_cache_flush_showcase_label`, `showcase_shell_errors_btn_showcase404`), ru
  **"Витрина"** nominative singular (ru consistently renders "showcase" as "витрина" —
  `showcase_index_title`, `home_showcase_map_aria`, `showcase_workers_meaning_service_link`).
  Note existing ru inconsistency: `nav_showcases` = "Демонстрации" but page titles use
  "Витрины" — pre-existing drift, not touched, flag if asked to reconcile nav vs page copy.
- "Hosted service" (badge for `service`-kind registry entries, contrast with SPDX license
  badge on `npm`-kind entries) → de **"Gehosteter Dienst"** ("Dienst" is the established
  German word for hosted/managed backend, see `errors_upstream_unavailable`,
  `ai_chat_error_unavailable`), ru **"Облачный сервис"** (re-authored, not literal —
  "cloud service" reads more natural than a calque of "hosted").
- Rate limiting / caching (de) → established compounds are **"Rate-Limiting"** and
  **"Cache"/"Caching"**, always capitalized, untranslated (see `admin_cache_*`,
  `showcase_abuse_*`, `showcase_pwa_description`). Reuse verbatim.
- Rate limiting (ru) → established is **"Лимиты запросов"** (plural noun), NOT a
  transliteration of "rate limiting". "Cache" (ru) → established is **"Кэш"** (with э,
  capital for standalone use) — not "Кеш". Reuse verbatim.
- "Pipeline" (de) → stays **"Pipeline"** untranslated in compounds (KI-Pipeline,
  CI/CD-Pipeline, notifications tab "Pipeline"). (ru) → two established variants coexist:
  "конвейер" (general/product-facing, e.g. notifications pipeline) vs "пайплайн"
  (dev-facing/technical, e.g. "CI/CD-пайплайн"). For dev-audience surfaces (credits,
  stack internals) prefer **"пайплайн"**.
- Blog posts (de) → established **"Blogbeiträge"**, NOT "Blogposts" (see `admin_posts_*`,
  `admin_tags_*`). (ru) → established **"записи блога"**, NOT "посты блога" (same source).
- Mixing bare Latin technical terms into Cyrillic sentences (e.g. "self-hosted шрифты",
  "dev-сервер", "circuit breaker", "provider API") is the established ru voice for this
  codebase, confirmed at scale (`dev-ветку`, `UI-элементы`, `Push dev→prod`,
  `stack, grid, divider`). Don't over-translate niche technical nouns that have no
  natural Russian equivalent in daily dev speech — leave them Latin.
- "i18n" itself stays **"i18n"** untranslated in all three locales everywhere
  (`showcase_i18n_title` precedent) — reused verbatim for `credits_group_i18n`.
- "AI" group label → de **"KI"**, ru **"ИИ"** (`showcase_ai_title` precedent) — always
  reuse this pair, never leave "AI" untranslated in de/ru prose or headers.

## Style conventions confirmed for this file pair

- Role one-liners / card descriptions used as UI microcopy (not full page meta
  descriptions): lowercase-start sentence fragments, **no trailing period** — matches
  `home_structure_route_*_desc`, `home_structure_server_*_desc` style, NOT the
  full-sentence-with-period style of `showcase_*_description` (those are meta/page
  descriptions, a different register).
- Full-sentence prose (lede, outro, meta_description) DOES take a trailing period,
  matching `showcase_*_description` convention.
- `messages/en.json` has no fixed alphabetical or strict-domain ordering — new key
  blocks get appended wherever contextually sensible (end of file for a wholly new
  domain like `credits_*`; inline next to same-prefix keys like `footer_*`). Don't
  assume alphabetical sort is enforced or expected.
