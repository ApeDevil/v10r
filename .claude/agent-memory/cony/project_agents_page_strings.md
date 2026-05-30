---
name: project-agents-page-strings
description: Confirmed copy decisions for /docs/programming/ agents gallery page — card title, page title, buckets, affordances, all 3 locales
metadata:
  type: project
---

Card title decided as `Agents` / `Agenten` / `Агенты` (not "Programming with AI" — that's a practice descriptor, not a section noun). Consistent with existing card pattern: Foundation / Stack / Blueprint.

Bucket labels (en → de → ru):
- Architecture & Data → Architektur & Daten → Архитектура и данные
- Runtime & Quality → Laufzeit & Qualität → Среда выполнения и качество
- Interface & Words → Oberfläche & Sprache → Интерфейс и текст ("Sprache" over "Wörter" in de; "текст" over "слова" in ru)
- Intelligence & Trust → Intelligenz & Vertrauen → Интеллект и доверие (kept — secy + aiy own a trust surface)

Affordance: "View prompt" / "Prompt anzeigen" / "Показать промпт" — "prompt" kept as loanword in de/ru.
Aria-label: "View system prompt for {name}" / "System-Prompt für {name} anzeigen" / "Показать системный промпт агента {name}"
Popup close: "Close prompt" / "Prompt schließen" / "Закрыть промпт"
Popup heading pattern: `{name} — {soul}` (e.g., `archy — Order that scales`)

Essay doc stays at docs/blueprint/programming-with-ai.md — no move, no fold. Hub links to it.

**Why:** Hub is a gallery (browse); essay is rationale (read). Mixing registers or moving URL creates churn with no gain.
**How to apply:** If asked to restructure programming-with-ai.md or move it, recall this decision and its rationale.
