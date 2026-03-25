---
name: Domain Icon Customization UX
description: UX spec for moving domain icons/colors from hardcoded blog-tags.ts config to database with admin UI for icon assignment
type: project
---

## Summary

Recommendation: two-tier icon input (Lucide preset grid + paste SVG escape hatch), inline edit modal per domain row, live preview chip, initial-letter fallback.

## Input Method

Two tiers only — no file upload:

1. **Preset grid**: ~24–36 Lucide icons in a 6-column grid with filter input. Each button 36×36px touch target. Selection updates preview immediately.
2. **Custom SVG textarea**: revealed by "Use custom SVG" link below grid. Preview debounces 200ms. Invalid SVG shows inline error, holds last valid state.

No full iconify browser — style consistency and choice paralysis prevention.

## Location

"Edit" button on domain table rows opens a modal (separate from current inline "Rename" which stays for name+slug only). Modal contains: Name, Slug, Icon picker, Chart color swatches, Save/Cancel.

## Live Preview

Small domain tag chip (28px tall) rendered above the icon picker. Uses real domain name + selected icon + selected chart color. Updates live. No "Preview" label needed — placement makes purpose self-evident. `aria-hidden="true"`.

## Fallback (no icon set)

First uppercase letter of domain name rendered as glyph — same monospace path the category system uses. Never auto-assign a Lucide icon. Initial letter communicates clearly "no icon set yet."

## Chart Color

8 circular swatches (24px, 36×36px touch target) showing actual OKLCH colors from --chart-1 through --chart-8. Plus a "None" option (diagonal strikethrough circle) as first item. No numeric labels — color is the label. Tooltip shows index number only.

## Database Schema

Domain table gains:
- `icon_lucide`: nullable string (e.g. 'i-lucide-code')
- `icon_svg`: nullable text (raw sanitized SVG)
- `chart_color`: nullable integer 1–8

Resolution priority: icon_svg wins over icon_lucide. Mutually exclusive in UI — selecting preset clears SVG, pasting SVG clears preset selection. "Using custom SVG" note with "× Clear" link shown above preset grid when custom SVG is active.

## SVG Safety

- Sanitize server-side on save (strip script, on* attrs, javascript: hrefs, external refs)
- 8KB max, byte counter shown in textarea footer
- Client renders from textarea for preview, but saved value is always server-sanitized version
- Server returns sanitized form in save response; client updates textarea to show what was stored

## Why:
Hardcoded blog-tags.ts config requires a deploy to change domain icons. Admin users need to customize this without touching code. Decision made March 2026.

## How to apply:
When implementing domain edit forms, use this spec as the design contract. The key constraint is SVG sanitization must happen server-side before storage, not client-side.
