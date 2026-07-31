# Feedback band i18n (pre-footer prompt + Source field)

2026-07-31, branch `credits`. Feedback entry point moved out of global footer into a
pre-footer band on showcase/docs pages. Removed `footer_feedback` (dead key, no
consumer) from all three locales. Added 4 keys, identical position in en/de/ru:

- `feedback_field_source_label` (after `feedback_field_email_prefilled`, before
  `feedback_submit`) — bare noun, matches sibling field labels (`Subject`/`Betreff`/
  `Тема`, `Message`/`Nachricht`/`Сообщение`). EN "Source" / DE "Quelle" / RU "Источник".
- `feedback_field_source_description` (right after the label) — matches the
  `feedback_field_email_description` register (short factual clause, em dash where
  the neighbor uses one).
- `feedback_band_prompt` (after `feedback_thanks_send_another`) — the light,
  non-corporate invite line shown above the band's CTA button. Reworded same day
  from "page" to "pattern" (v10r's term of art — showcase pages ARE the patterns;
  band shows on all `/showcases/*` and `/docs/*`). Final EN: "Think this pattern
  could be better? Tell us how."

## "Pattern" as a term of art (v10r-specific, not generic)

Grepped both locales before wording the reworded `feedback_band_prompt` — v10r
already has TWO parallel translations of "pattern" depending on register, and the
choice is consistent, not arbitrary:

- **DE**: kept as the English loanword **"Pattern"** (neuter, `das Pattern` —
  same gender class as native `das Muster`) in proper-noun/technical contexts:
  showcase title "Pattern MCP", "Pattern-Abhängigkeitsgraph", and — critically —
  already inside this same `feedback_*` cluster (`feedback_lede`: "ein besseres
  Pattern gesehen"). Native **"Muster"** is used instead in general-prose/UI-label
  contexts (`home_hero_etymology_descriptor` "Musterbibliothek", nav tab labels,
  `showcase_forms_tab_patterns`). `feedback_band_prompt` sits in the same cluster
  as `feedback_lede`, so it follows the loanword: **"Geht dieses Pattern noch
  besser? Sag uns, wie."**
- **RU**: **"паттерн"** (masculine, transliterated loanword) is the term of art
  used everywhere the English "pattern" concept appears — including
  `feedback_lede` ("лучший паттерн") in this same cluster, `showcase_mcp_*`,
  `home_hero_etymology_descriptor`, `home_instances_description`. **"шаблон"** is
  reserved for a different concept (UI presets/templates, e.g.
  `composites_desk_prefs_tab_presets` "Шаблоны") — do not conflate the two.
  `feedback_band_prompt` final: **"Думаете, этот паттерн можно сделать лучше?
  Расскажите как."**

Rule of thumb for any future v10r-pattern-concept string: DE splits by register
(Pattern=technical/proper-noun, Muster=general prose); RU does not split —
паттерн always, шаблон never for this concept.
- `feedback_band_cta` (right after the prompt) — short button label. Deliberately
  worded differently from `feedback_submit` in every locale (band CTA navigates to
  the form; submit sends it) — avoids two same-string buttons meaning different
  things on the same journey. DE: "Feedback geben" (band) vs "Feedback senden"
  (submit). RU: "Оставить отзыв" (band) vs "Отправить отзыв" (submit).

## Confirmed register for the `feedback_*` cluster

- **DE**: informal `du` throughout (`Sag uns, wie.`, `von der du kommst`). Field
  labels are bare nouns, no articles.
- **RU**: formal grammatical `вы`/`ваш`, but lowercase mid-sentence (only
  capitalized when it happens to start a sentence) — this is casual-UI register,
  not a formal-letter address; don't capitalize `Вы` out of politeness here.
- Both locales keep the "light, not corporate" tone from `feedback_lede` — short
  clauses, no marketing verbs, direct address.
