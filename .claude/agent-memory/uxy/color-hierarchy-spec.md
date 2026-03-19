---
name: Color Hierarchy Specification
description: UX spec for color distribution philosophy, token usage rules, palette switching drama — secondary-fg diagnosis, current audit of composites showcase, and prioritized fix list
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
| Sublinks | `--color-primary` (not secondary-fg — see diagnosis below) | High-value nav shortcuts |

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

### Verdict: Need a `--color-link` token

`--color-secondary-fg` cannot serve as a link color reliably. It is structurally too
close to `--color-fg` in light mode and too unsaturated everywhere. A dedicated
`--color-link` token should:
- In light mode: track `--color-primary` (which already has L=0.48–0.55, C=0.12–0.22)
  but can be slightly lighter to avoid competing with buttons
- In dark mode: track `--color-primary` (L=0.62–0.72)
- Optionally: be set to `--color-primary` directly with no new token needed

---

## 4. Proposed Token Usage Rules (Actionable Mapping)

```
Links (inline text)      → var(--color-primary)
Links (sublink badges)   → var(--color-primary) text, var(--color-primary-bg) hover bg
Active nav item          → var(--color-primary)
Active tab underline     → var(--color-primary)
Focus rings              → var(--color-primary)
Primary CTA              → var(--color-primary) bg + var(--color-on-primary) text
Card hover border        → var(--color-primary)               [already done]
Badge/chip label         → var(--color-secondary-fg)          [on secondary-bg container]
Category eyebrow         → var(--color-primary) or var(--color-muted)
Icon (active/selected)   → var(--color-primary)
Icon (passive)           → var(--color-muted)
Section heading (h2)     → var(--color-fg)                    [neutral; let accent breathe]
Body text                → var(--color-body)
Supporting text          → var(--color-muted)
Page bg                  → var(--color-bg)
Card bg                  → var(--surface-1)
```

**For sublinks specifically:**
Replace `color: var(--color-secondary-fg)` with `color: var(--color-primary)`.
Replace hover bg `color-mix(in srgb, var(--color-secondary-bg) 40%, transparent)` with
`color-mix(in srgb, var(--color-primary-bg) 40%, transparent)`.

This change alone makes sublinks immediately distinct and palette-responsive.

---

## 5. Accessibility Constraints

### Mandatory WCAG AA pairs (4.5:1 for text, 3:1 for large/UI)

| Pair | Risk level | Notes |
|------|-----------|-------|
| `--color-primary` on `--color-bg` | **High risk** | Several palettes have primary at L=0.48–0.55 on light bg L=0.93–0.96. This can fall below 4.5:1 for small text. Must be verified per palette. Use on large text (≥18px) or UI elements (3:1 threshold) if needed. |
| `--color-primary` on `--surface-1` | Medium risk | Surface-1 is slightly darker than bg — marginally safer |
| `--color-secondary-fg` on `--surface-1` | Low risk (currently) | Reads fine as it closely tracks fg. Problem is invisibility, not inaccessibility. |
| `--color-on-primary` on `--color-primary` | Low risk | Designed as a pair — validated at build time |
| `--color-muted` on `--color-bg` | Medium risk | L=0.45–0.50 on light bg can be borderline. WCAG AA requires 4.5:1. Avoid for essential info. |
| Focus rings (`--color-primary`) | Requires 3:1 against adjacent colors | Already meets 3:1 in most palettes; P3/Forest (low-chroma green) needs verification |

### Specific risks with the "use primary for links" recommendation

- P3 Forest light: primary is `oklch(0.48, 0.12, 155)` — medium green on near-white bg.
  Contrast should be checked. If it fails AA, the fix is increasing chroma to 0.15+.
- P0 High Contrast: primary is `oklch(0.40, 0.15, 265)` on near-white — deep blue,
  should pass comfortably.
- P4 Neon Lime light: primary is `oklch(0.55, 0.20, 135)` — mid-green. Borderline.

The build-time `validatePaletteContrast` function in `contrast.ts` should cover this if
it checks `primary` vs `bg`. Confirm it does when implementing.

### P0 High Contrast special case

P0's secondary-fg in light mode is `oklch(0.15, 0, 0)` — nearly pure black on near-white.
This is actually readable (good contrast), but it is completely achromatic. Sublinks in P0
will look identical to regular fg text. For P0, using primary (which has chroma 0.15) is
especially important because it's the only chromatic signal available.

---

## 6. Palette Drama: Additional Opportunities Beyond Sublinks

The following elements are palette-transparent today but could amplify the switch:

1. **Sidebar active item background**: Currently uses `primary-bg`. Good. Ensure it's
   actually applied — it creates a "glow" in the dominant accent hue.

2. **Section heading accent mark**: A left border `border-l-4 border-primary` on
   major section h2s would make palette hue visible in the information hierarchy without
   adding visual noise.

3. **Empty state icon**: Currently `text-muted`. Switching to `text-primary` would be
   a low-surface-area but high-attention chromatic moment.

4. **Nav grid hover**: If NavGrid uses link cards, the hover border (already primary)
   creates a grid of color on hover — dramatic.

5. **Kbd / code inline**: Currently probably neutral. Tinting with `primary-bg` bg and
   `primary-fg` text makes even code examples palette-responsive.
