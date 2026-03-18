---
name: Style Randomizer UX Plan
description: Refined UX plan for Style Randomizer feature including contrast preferences, GDPR, data-palette swap approach, Svelte 5 patterns, and accessibility checklist
type: project
---

## Context

Style Randomizer randomizes typography + palette per visit. DiceRollButton triggers POST /api/style/roll → sets httpOnly cookie → invalidateAll() re-runs load functions → Svelte reactivity propagates. The palette swap itself is instant (data-attribute DOM mutation). The 50-150ms round-trip is server-side load function work, not a visual transition.

**Key insight from scout**: DaisyUI `[data-theme]` attribute switching makes palette change a single DOM attribute mutation — no flash, no transition needed. Style change is not a visual animation event; it's a data reload.

## Why

Original plan was drafted without cross-domain input. Cross-domain findings revealed three gaps: prefers-contrast handling, GDPR consent interaction, and nuances from the instant DOM swap approach.

## How to apply

Use this plan when building or reviewing DiceRollButton, StyleContext, consent banner interaction, or the palette validation pipeline.
