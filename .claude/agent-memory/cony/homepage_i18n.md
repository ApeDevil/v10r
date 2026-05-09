---
name: Homepage i18n — key set, voice decisions, module-scope pattern
description: Records all home_* message keys added, translation judgement calls, and the module-scope m.*() pattern used in structure-map.ts
type: project
---

112 `home_*` keys across en/de/ru (110 original + 2 added 2026-05-09). Key ranges by area:
- Hero (12): home_hero_classification … home_hero_theme_dark
- Taxonomy (26): home_taxonomy_title … home_taxonomy_cap_graph_rag_label
- Instances (12): home_instances_title … home_instances_meter_aria (incl. home_instances_uses_partial_stack, home_instances_uses_entire_stack)
- Structure (62): home_structure_title … home_structure_nrag_item_verify_desc
- Showcase (1): home_showcase_cta

**Why:** Full homepage i18n extraction, 2026-05-09.

**How to apply:** Any new homepage copy needs a key in all three locales. Follow `home_<area>_<element>` snake_case pattern.

## Voice decisions (tricky strings)

- "born to be fast & light" → de "gebaut für Geschwindigkeit und Leichtigkeit" / ru "создан быть быстрым и лёгким" — meaning-faithful, keeps punch without padding
- "Instantiate Through Emulation" → de "Instanziierung durch Emulation" / ru "Инстанцирование через эмуляцию" — noun-form matches EN cadence; anglicism "эмуляция" is natural in Russian tech context
- "Containerized Full-Stack Pattern Library" → de "Containerisierte Vollstack-Musterbibliothek" / ru "Контейнеризованная полностековая библиотека паттернов" — user overrode earlier proper-noun decision; full localization required
- "CAPABILITY TAXONOMY" → de "FÄHIGKEITEN-TAXONOMIE" (compound noun, natural German) / ru "ТАКСОНОМИЯ ВОЗМОЖНОСТЕЙ" (noun phrase, natural Russian)
- "INSTANTIATE" → de "INSTANZIIEREN" (infinitive as heading, sounds imperative) / ru "ИНСТАНЦИРОВАТЬ" (same approach)
- Zone names: RUNTIME→LAUFZEIT/ИСПОЛНЕНИЕ, STRUCTURE→STRUKTUR/СТРУКТУРА, DATA→DATEN/ДАННЫЕ, INTERFACE→OBERFLÄCHE/ИНТЕРФЕЙС, BEHAVIOR→VERHALTEN/ПОВЕДЕНИЕ, INTELLIGENCE→INTELLIGENZ/ИНТЕЛЛЕКТ
- "explore the showcases" → de "zu den Showcases" (directional, no verb needed) / ru "к примерам" (примеры = demonstrations/examples)
- "roll a new look" / "roll again" → de "neues Design würfeln" / "nochmal würfeln" / ru "новый облик" / "ещё раз" — ru keeps it minimal, matching the terse EN register
- "PRACTICAL EXAMPLE" → de "PRAKTISCHES BEISPIEL" / ru "ПРАКТИЧЕСКИЙ ПРИМЕР"
- "Intelligence Layer" → de "Intelligenz-Schicht" / ru "Слой интеллекта" — hyphen in DE aids scan; Russian noun phrase (Слой = layer) is standard technical register
- "Structural Map" → de "Strukturkarte" / ru "Структурная карта" — compound in DE, adjective+noun in RU; both natural
- "partial stack" / "entire stack" (instances uses list) → de "partieller Stack" / "vollständiger Stack" / ru "часть стека" / "весь стек" — noun phrases that hold up as list items alongside tech names

## Module-scope m.*() in structure-map.ts

structure-map.ts uses direct `m.xxx()` calls in the module-scope `sections` array. This works because Paraglide messages are plain getter functions. On locale navigation SvelteKit re-renders from scratch (URL-prefix routing), so the array re-evaluates with the correct locale. No getter-function wrapper needed.

## Not extracted

- Tech `desc` values in taxonomy cards (e.g. "Bun", "SvelteKit 2", "Podman (rootless)") — these are proper nouns per glossary, not translatable
- The ETYMOLOGY ASCII diagram `<pre>` block — typographic art, left in place per task spec
- `wild.uses` and `wild.dropped` array items — these are proper nouns (SvelteKit, UnoCSS, Bits UI, auth, databases, API, i18n, AI, 3D) per glossary; NOT the same as instances[].uses which now uses message keys
- `v4.lynxware.org` link text — URL, not translatable
- `style.paletteName` / `style.typographyName` — these are generated identifiers from the style system
- Section/group `title` fields remaining in structure-map.ts data — they're now unused metadata (StructureSection.svelte uses m.*() calls directly)
