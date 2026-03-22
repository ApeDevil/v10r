---
name: Color Hierarchy Specification
description: UX spec for color distribution philosophy, token usage rules, palette switching drama — secondary-fg diagnosis, polychromatic research synthesis, and the "no new chromatic token" recommendation
type: project
---

# Color Hierarchy Specification: Making Palette Switching Feel Dramatic

## Why: Context

Velociraptor's 8 palettes feel indistinct when switching because the app surface is ~95%
neutral. Chromatic accent tokens (primary, secondary) are defined but rarely applied. This
spec establishes where color must go to create perceptual contrast between palettes.

## How to apply

Use when writing or reviewing any component that involves links, interactive text, badges,
section markers, nav items, or focus indicators. The token-to-element mapping is the ground
truth for where chromatic color belongs.

---

## 1. Color Distribution Philosophy

Industry benchmarks (Material Design 3, Radix Themes, shadcn/ui) converge on:

| Band | Share | Token role |
|------|-------|------------|
| Neutral surface | 60–70% | bg, subtle, surface-1/2 |
| Neutral text | 15–20% | fg, body, muted, border |
| Primary accent | 5–8% | interactive elements, active states, focus |
| Secondary accent | 2–4% | supplementary interactive, badges, sublinks |
| Semantic (success/error/warning) | 1–3% | status only |

The key insight: **5–8% primary is enough to make a palette feel like itself** because
that color appears on the elements users look at directly — links, buttons, active nav, focus
rings. When those critical touchpoints change hue, the whole UI feels transformed even
though 85% of pixels stay neutral.

Velociraptor's current ratio is closer to 1–2% chromatic, which is why palette switches
register as "slightly different gray" rather than "completely different world."

---

## 2. Color Hierarchy: Fixed Mapping

### ALWAYS chromatic — these must use accent tokens unconditionally

| Element | Token | Rationale |
|---------|-------|-----------|
| Inline text links | `--color-primary` | The most scanned element; 100% of users look at links |
| Interactive icon buttons (active) | `--color-primary` | Touch target + identity |
| Focus ring (keyboard nav) | `--color-primary` | Accessibility anchor + accent moment |
| Active nav item (sidebar) | `--color-primary` | Orientation; users return to this constantly |
| Primary CTA buttons | `--color-primary` (bg) + `--color-on-primary` (text) | Already correct |
| Card hover border | `--color-primary` | Already in LinkCard — good |
| Sublinks | `--color-primary` text, `--color-primary-container` hover bg | High-value nav shortcuts — already implemented |

### SOMETIMES chromatic — use judgment based on page weight

| Element | Token | When to apply |
|---------|-------|---------------|
| Section headings (h2 at top of page sections) | `--color-fg` or `--color-primary` | Use primary when the heading IS the action/category. Keep neutral in prose-heavy pages. |
| Card category labels / eyebrows | `--color-primary` | When the label differentiates cards (e.g., "Auth", "Database") |
| Dividers with labels | `--color-border` default, `--color-primary-bg` for featured | Featured sections only |
| Tag/badge chip | `--color-secondary-bg` + `--color-secondary-fg` | Already designed for this use case |
| Active tab underline | `--color-primary` | Required; passive tabs stay border/muted |
| Sidebar section labels | `--color-muted` default, `--color-primary` for active group | Avoid over-chroming nav tree |

### ALWAYS neutral — must not use accent tokens

| Element | Token |
|---------|-------|
| Body paragraph text | `--color-body` |
| Secondary/supporting text | `--color-muted` |
| Table cell content | `--color-fg` |
| Input placeholder text | `--color-muted` |
| Page background | `--color-bg` |
| Card backgrounds | `--surface-1` |
| Disabled state text | `--color-muted` (50% opacity) |
| Metadata / timestamps | `--color-muted` |

---

## 3. Secondary-fg Diagnosis: Why Sublinks Blend In

### The core problem

`--color-secondary-fg` is designed as text-on-secondary-bg — a color for **labeled chips
inside a secondary-colored background bubble**. When used as a standalone text color
against the card surface (`--surface-1`), it has no guaranteed contrast because it was
tuned for a different background.

### Per-palette secondary-fg analysis

Light mode values (the broken scenario — text against surface-1):

| Palette | secondary-fg L | fg L | Delta L | Chroma | Assessment |
|---------|---------------|------|---------|--------|------------|
| P0 High Contrast | 0.15 (achromatic) | 0.13 | +0.02 | 0 | Barely distinguishable from fg. **Blends.** |
| P1 Ocean | 0.25 (h=200) | 0.25 | 0 | 0.06 | Same lightness as fg, low chroma. **Invisible.** |
| P2 Sunset | 0.28 (h=70) | 0.25 | +0.03 | 0.05 | Slightly yellowish but too close to fg. **Blends.** |
| P3 Forest | 0.25 (h=130) | 0.22 | +0.03 | 0.05 | Nearly identical to fg. **Invisible.** |
| P4 Neon Lime | 0.22 (h=120) | 0.20 | +0.02 | 0.06 | Very close to fg lightness. **Blends.** |
| P5 Deep Violet | 0.24 (h=310) | 0.22 | +0.02 | 0.06 | Near-fg range. **Blends.** |
| P6 Terracotta | 0.24 (h=40) | 0.22 | +0.02 | 0.06 | Near-fg. **Blends.** |
| P7 Midnight | 0.22 (h=280) | 0.20 | +0.02 | 0.06 | Near-fg. **Blends.** |

Dark mode secondary-fg (more readable but still under-saturated):

| Palette | secondary-fg | Chroma | Assessment |
|---------|-------------|--------|------------|
| P0 | L=0.92, C=0 | achromatic | Light gray, readable but zero identity |
| P1 | L=0.78, C=0.06 | low | Slightly blue, but barely |
| P2 | L=0.80, C=0.05 | low | Slightly warm, barely |
| P3 | L=0.78, C=0.05 | low | Slightly green, barely |
| P4 | L=0.82, C=0.06 | medium-low | Best of the chromatic set |
| P5 | L=0.80, C=0.05 | low | Slightly violet |
| P6 | L=0.80, C=0.05 | low | Slightly warm |
| P7 | L=0.82, C=0.05 | low | Slightly violet |

### Root cause diagnosis

**Two compounding problems:**

1. **Light mode**: secondary-fg tracks fg lightness too closely (delta L of only 0.02–0.03).
   Since OKLCH lightness is the dominant perceptual axis, they look identical.

2. **Across both modes**: Chroma (saturation) maxes at 0.06. That is in "tinted neutral"
   territory. Compare to primary which ranges from 0.12–0.22 chroma. The sublinks have
   1/3 the color intensity of the primary, so they look like pale versions of the text,
   not like a different color category.

3. **No dedicated link semantic**: The secondary token was designed for badge chips
   (secondary-bg container + secondary-fg text pairing). Reusing it for bare links is
   semantically misaligned — it's the wrong tool.

### Verdict: Use `--color-primary` for sublinks (already implemented)

LinkCard.svelte already uses `color: var(--color-primary)` for sublinks and
`color-mix(in srgb, var(--color-primary-container) 40%, transparent)` for hover bg.
This is correct. The secondary-fg path was the broken historical approach.

---

## 4. Polychromatic Research Synthesis

### The central question: how many chromatic roles?

**Material Design 3 model** (3 chromatic roles):
- Primary: main interactive elements, CTAs, active states
- Secondary: supporting interactive elements (chips, secondary containers, filter bars)
- Tertiary: contrasting accents, highlights, cross-category differentiation

**Radix Themes / shadcn / Linear model** (1 chromatic role + semantic):
- One accent color throughout; semantic colors (success/error/warning) for status only
- All interactive elements use the same accent — this is the dominant modern convention

**Key finding**: Most successful modern design systems use ONE chromatic role for interactive
elements. Multiple chromatic roles are reserved for data visualization (charts), not UI chrome.
When Stripe, Linear, Vercel, or Notion switch themes, they switch one accent color — not two.

### Why adding `--color-accent` as a second interactive role creates problems

1. **Cognitive load at scale**: Every interactive element now requires a decision: is this
   primary territory or accent territory? Without a clear semantic rule, the boundary drifts
   team-wide. You end up with inconsistent application.

2. **Palette burden**: 8 palettes × 2 modes = 16 contexts. Adding one new chromatic token
   that needs to be meaningfully different from primary in all 16 contexts is hard. A
   secondary accent at the wrong hue relative to primary will either clash or look like
   a variation of primary — neither is useful.

3. **Harmony vs. carnival**: Two fully-saturated chromatic interactive roles compete for
   attention. The eye doesn't know which to prioritize. The result is visual noise, not
   hierarchy. The "carnival effect" threshold is lower than people expect — it arrives
   with just two competing hues on the same surface.

4. **The sublinks problem is already solved by primary**: The diagnosis in section 3 shows
   the actual issue was `secondary-fg` being too desaturated to read as distinct, not that
   sublinks needed a *different* hue from the icon. Both the icon and the sublinks being
   primary is correct — they are the same semantic category (navigation). Same hue,
   same family. The hierarchy is established by shape and position, not hue.

### The right answer: apply primary more aggressively, not add more hues

The system already has an under-utilized primary family:
- `--color-primary` (main)
- `--color-primary-container` (tinted bg)
- `--color-on-primary-container` (text on tinted bg)
- `--color-primary-dim` (softer version)

These can create 3–4 distinct visual tiers *within the same hue*, avoiding carnival while
dramatically increasing chromatic presence.

### Where `--color-secondary` changing to chromatic WOULD help

The one case where a distinct chromatic role genuinely adds value is **badge/tag chips
on neutral surfaces** — when a tag chip needs to communicate a *category* visually,
a distinct hue from primary helps. But this is:
- Already designed for in the secondary-bg/secondary-fg pairing
- Only relevant for actual category differentiation (not most badge uses)
- Solvable by semantic color tokens (success, warning, info) which already exist

### Recommendation: Do NOT add `--color-accent` or make `--color-secondary` chromatic

**Why**: `--color-secondary` is currently used as button secondary variant background
(light near-neutral tint, dark near-neutral tint). Changing it to a fully chromatic color
breaks the secondary button. That fix would require decoupling secondary-button-bg from
the secondary token — a meaningful refactor for no clear gain.

**The actual gap is application density, not token count.**

---

## 5. Proposed Token Usage Rules (Actionable Mapping)

```
Links (inline text)      → var(--color-primary)
Links (sublink badges)   → var(--color-primary) text, var(--color-primary-container) hover bg [DONE]
Active nav item          → var(--color-primary) bg + var(--color-on-primary) text [DONE]
Active tab underline     → var(--color-primary) [DONE]
Focus rings              → var(--color-primary) [DONE]
Primary CTA              → var(--color-primary) bg + var(--color-on-primary) text [DONE]
Card hover border        → var(--color-primary) [DONE]
Badge/chip label         → var(--color-secondary-fg) on var(--color-secondary-bg) container [use for category chips only]
Category eyebrow         → var(--color-primary) or var(--color-muted)
Icon (active/selected)   → var(--color-primary)
Icon (passive)           → var(--color-muted)
Section heading (h2)     → var(--color-fg) [neutral; let accent breathe]
Body text                → var(--color-body)
Supporting text          → var(--color-muted)
Page bg                  → var(--color-bg)
Card bg                  → var(--surface-1)
```

---

## 6. Accessibility Constraints

### Mandatory WCAG AA pairs (4.5:1 for text, 3:1 for large/UI)

| Pair | Risk level | Notes |
|------|-----------|-------|
| `--color-primary` on `--color-bg` | **High risk** | Several palettes have primary at L=0.48–0.55 on light bg L=0.93–0.96. This can fall below 4.5:1 for small text. Must be verified per palette. Use on large text (≥18px) or UI elements (3:1 threshold) if needed. |
| `--color-primary` on `--surface-1` | Medium risk | Surface-1 is slightly darker than bg — marginally safer |
| `--color-secondary-fg` on `--surface-1` | Low risk (currently) | Reads fine as it closely tracks fg. Problem is invisibility, not inaccessibility. |
| `--color-on-primary` on `--color-primary` | Low risk | Designed as a pair — validated at build time |
| `--color-muted` on `--color-bg` | Medium risk | L=0.45–0.50 on light bg can be borderline. WCAG AA requires 4.5:1. Avoid for essential info. |
| Focus rings (`--color-primary`) | Requires 3:1 against adjacent colors | Already meets 3:1 in most palettes; P3/Forest (low-chroma green) needs verification |

### Specific risks with "use primary for links"

- P3 Forest light: primary is `oklch(0.48, 0.12, 155)` — medium green on near-white bg.
  Contrast should be checked. If it fails AA, the fix is increasing chroma to 0.15+.
- P0 High Contrast: primary is `oklch(0.40, 0.15, 265)` on near-white — deep blue,
  should pass comfortably.
- P4 Neon Lime light: primary is `oklch(0.55, 0.20, 135)` — mid-green. Borderline.

---

## 7. Palette Drama: Additional Opportunities Beyond Sublinks

The following elements are palette-transparent today but could amplify the switch:

1. **Sidebar active item background**: Already uses `primary` bg + `on-primary` text. Good.

2. **Section heading accent mark**: A left border `border-l-4 border-primary` on
   major section h2s would make palette hue visible in the information hierarchy without
   adding visual noise.

3. **Empty state icon**: Currently `text-muted`. Switching to `text-primary` would be
   a low-surface-area but high-attention chromatic moment.

4. **Nav grid hover**: LinkCard hover border (already primary) creates a grid of color
   on hover — dramatic.

5. **Kbd / code inline**: Currently probably neutral. Tinting with `primary-container` bg and
   `on-primary-container` text makes even code examples palette-responsive.

6. **NavSection active chip**: Already uses `color: var(--color-primary)` and
   `color-mix(in srgb, var(--color-primary) 10%, transparent)` bg. Good.

7. **TabNav active underline**: Already `border-bottom-color: var(--color-primary)`. Good.
