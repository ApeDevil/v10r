---
name: mydata-color-only-state
description: my-data showcase signals collected/not-collected by color alone AND hides the icon from SR (aria-hidden) — double a11y defect to fix before reuse in any signup flow
metadata:
  type: feedback
---

The analytics transparency showcase (`src/routes/[[locale=locale]]/(public)/showcases/analytics/my-data/+page.svelte`) signals each data field's collected/not-collected state with TWO defects stacked:

1. **Color-only for sighted users** — `.data-item` is `color: var(--color-muted)`, `.data-item.collected` is `color: var(--color-success)` (green). The only visual difference between "collected" and "not collected" is text color. Violates the project's forbidden color-only-state rule.
2. **Invisible to screen readers** — the check/minus icon that *could* disambiguate is `aria-hidden="true"` (lines 48,55,62,79,86,93,110,117). So an SR user hears the field name + value with NO collected/not-collected status at all. Worse than color-only: it's status-absent.

**Why:** A surface whose entire purpose is "show data states" is the single worst place to encode state by color or to drop it from the a11y tree. WCAG 1.4.1 (use of color) + 1.3.1 (info and relationships).

**How to apply:** Before this component is reused as a post-signup transparency surface, every data row must carry a redundant, SR-perceivable status: a text status pill (cony writes the words) OR a filled-dot/hollow-ring shape paired with the icon, AND the row's status must reach the a11y tree (aria-label on the row, or a real visible text token — not an aria-hidden icon). Render each data group as a real `<table>` (caption + `<th scope>`) or `<dl>`, not bare divs+`<code>`. Related: [[ai-control-room-a11y-floor]], [[transparency-my-data-showcase]].
