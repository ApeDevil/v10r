---
name: visy-story
description: Structure visual explanations as progressive disclosure — overview first, drill-down on demand, one claim per view. Use whenever explaining a system or dataset across multiple views — architecture walkthroughs, C4 levels, dashboards, slide decks, presentations, long docs pages — or when one diagram has grown to carry everything and needs to become a sequence of views. Titles state takeaways (action titles), each view answers exactly one question, and the sequence moves from familiar to new.
metadata:
  family: visy
---

# Visual storytelling & progressive disclosure

One view answers one question. An explanation is a *sequence* of views, each earning the next — not one diagram carrying everything. When a single visual has grown past its budget (see the `visy` router skill), the fix is narrative structure, not smaller fonts.

## Disclosure ladders

- **Systems — the C4 ladder**: Context (everyone: the system among its neighbors) → Container (engineers: deployable pieces and how they talk) → Component (owners: modules inside one container). Match the level to the audience and never mix levels in one view — a context diagram with function names in it serves nobody.
- **Data — Shneiderman's mantra**: overview first, then zoom and filter, then details on demand. A dashboard opens with the shape of things (tiles, sparklines), and drills to full charts and rows.
- **Single artifact — multi-zoom**: a summary strip up top, labeled section boundaries, per-section detail below. The reader chooses their depth without leaving the page.

## Narrative rules

- **Action titles**: the title states the takeaway, not the topic — "Beacon-lane visitors match Vercel within 10%", not "Analytics data". If every title in the sequence is read alone, the argument should still land.
- One claim per view; cut anything not serving that claim — move it to the view where it is the claim.
- Sequence familiar → new: open with what the reader already recognizes, and let each view raise the question the next one answers.
- The first fixation must land on the claim: size, position, and contrast encode importance. If the eye lands on decoration, the hierarchy is wrong.
- Keep notation consistent across views: same arrow semantics, same color meanings, one legend defined once and honored everywhere.

## Composition floor

Nothing overlaps; every element stays inside its boundary; margins are non-negotiable. Every view needs an anchor visual — a wall of text is not a view. Check text overflow first when reviewing a rendered page or slide; it is the most common and most visible defect.

## Anti-slop

Known tells of generated visuals — avoid: accent lines under titles, centered-everything layouts, uniform rounded corners on every box, purple gradients, decorative icons that encode nothing. If an element could be deleted with no loss of meaning, delete it.

## Where stories live in this repo

- **Docs pages**: one Mermaid diagram per level, C4-style, linked hub → detail (matches the docs' README-hub navigation pattern).
- **Showcase pages**: the showcase *is* the story — working demo, explanation, and copyable code as one progression.
- **Admin dashboards**: overview tiles (Sparkline/Gauge/stat) that drill into full pages — Shneiderman applied.
- **Artifacts**: a summary section up top, sticky ToC for long pages, sections as disclosure levels.
