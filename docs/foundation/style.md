# Style Randomization

A visual discovery pattern that randomizes decorative styling on each visit, creating memorable first impressions while maintaining usability and accessibility.

---

## Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Controlled variation** | Pre-validated palettes and font pairings, not random RGB values |
| **Stable navigation** | Critical UI elements remain predictable across variations |
| **Theme independence** | Randomization operates orthogonally to user-controlled dark/light mode |
| **Accessibility first** | WCAG compliance, motion preferences, color contrast guaranteed |
| **Context-appropriate** | Works for playgrounds and showcases; anti-pattern for task-oriented apps |

**Anti-goals:**
- Random colors that fail WCAG contrast ratios
- Unstable CTAs or navigation elements
- Breaking user mental models for core tasks
- Ignoring accessibility preferences
- Randomization on every interaction (causes fatigue)
- Pure algorithmic color generation (unreliable for accessibility)

---

## Terminology

### Theme

User-controlled dark/light mode preference. Persists across sessions. Independent of randomization. User can switch theme without affecting their current palette or typography.

### Typography

Font pairings for headings and body text. Curated sets only (e.g., "Serif + Sans", "Display + Mono"). Never random font selection from uncurated lists.

### Palette

Harmonious color set with defined semantic roles (primary, secondary, accent, neutral). Pre-validated for contrast and accessibility in both light and dark modes.

### Style

The combination of one palette and one typography set. Expressed as a compact identifier (e.g., "P7-T3" = Palette 7 + Typography 3).

---

## The Three-Axis Model

Style randomization operates on three independent dimensions:

```
THEME AXIS (user-controlled)
──────────────────────────────────────────────────────────────►
DARK                    SYSTEM                    LIGHT

                           │
                           ▼
              ┌──────────────────────────┐
              │  Current Style Config    │
              │  ────────────────────    │
              │  Typography: T3          │
              │  Palette: P7             │
              └──────────────────────────┘
                     ▲           ▲
                     │           │
    ┌────────────────┘           └────────────────┐
    │                                             │

TYPOGRAPHY AXIS (randomized per visit)        PALETTE AXIS (randomized per visit)
───────────────────────────────►              ───────────────────────────────────►
SERIF+SANS   GEOMETRIC   DISPLAY+MONO         OCEAN   SUNSET   FOREST   AURORA
```

**Key Insight:** A user can have dark theme + serif typography + ocean palette. Changing theme to light preserves the same palette and typography—they are orthogonal.

**Total Combinations:** With 5 typography sets × 20 palettes × 2 themes = 200 distinct visual experiences, all pre-validated for accessibility.

---

## Variation Strategy

### What Varies (Decorative Elements)

| Element | Variation Type |
|---------|----------------|
| Heading font | From curated typography set (3-5 options) |
| Body font | From curated typography set |
| Primary/secondary/accent colors | From pre-validated palette |
| Hero backgrounds | Gradients/patterns derived from palette |
| Section dividers | Accent colors from palette |
| Code block themes | Syntax highlighting aligned to palette |
| Icon accent colors | Secondary/accent from palette |
| Decorative borders | Palette-derived colors |

### What Stays Stable (Critical Elements)

| Element | Why It Stays Stable |
|---------|---------------------|
| Navigation structure | Discoverability, muscle memory |
| Navigation affordance position | Spatial consistency |
| Primary CTAs | Conversion path, recognizability |
| Form inputs and labels | Familiarity, trust, accessibility |
| Error state styling | Immediate recognition (always red-ish) |
| Success feedback | Clear signal (always green-ish) |
| Warning indicators | Consistent meaning (always amber-ish) |
| Focus indicators | Keyboard navigation, accessibility |
| Contrast ratios | WCAG compliance, readability |

**Semantic Colors Exception:** Success, warning, and error colors remain consistent across all palettes. Only their exact hue/saturation may shift slightly to harmonize with the palette, but the semantic meaning (green = success, red = error, amber = warning) is preserved.

---

## Palette Design Principles

### Structure

Every palette must define a complete semantic color system:

| Role | Purpose | Constraints |
|------|---------|-------------|
| **Primary** | Brand identity, primary CTAs | Must meet 4.5:1 on background |
| **Secondary** | Supporting actions, links | Must meet 4.5:1 on background |
| **Accent** | Highlights, decorative emphasis | Can be more vibrant |
| **Neutral** | Backgrounds, borders, text | Full 50-950 scale required |
| **Success** | Positive feedback, completion | Green family, consistent across palettes |
| **Warning** | Caution, attention needed | Amber family, consistent across palettes |
| **Error** | Errors, destructive actions | Red family, consistent across palettes |
| **Info** | Informational, neutral alerts | Blue family, consistent across palettes |

### Accessibility Constraints

| Constraint | Requirement | Verification |
|------------|-------------|--------------|
| **WCAG AA (minimum)** | Body text ≥ 4.5:1, large text ≥ 3:1 | Automated testing |
| **WCAG AAA (preferred)** | Body text ≥ 7:1 for maximum readability | Manual review |
| **Dark mode variants** | Each palette has validated dark mode colors | Both modes tested |
| **Colorblind-safe** | No color-only indicators; tested with simulators | Deuteranopia, protanopia, tritanopia |
| **Low vision** | Sufficient differentiation at reduced contrast | High contrast mode testing |

### Cultural Sensitivity

Color meanings vary across cultures. The palette system avoids:
- Relying on color alone for meaning (always pair with icons/text)
- Culturally specific color associations for critical UI

---

## Typography Design Principles

### Structure

Each typography set includes:

| Role | Purpose | Constraints |
|------|---------|-------------|
| **Heading font** | Titles, headers, brand expression | Expressive, legible at large sizes |
| **Body font** | Paragraphs, UI text, forms | Highly readable at 16px+ |
| **Mono font** (optional) | Code blocks, technical content | Fixed-width, clear character differentiation |

### Pairing Principles

| Principle | Rationale |
|-----------|-----------|
| **Contrast in style** | Serif + Sans, Display + Mono (visual hierarchy) |
| **Harmony in mood** | Both fonts share similar "energy" (formal/casual/technical) |
| **Limited to 2-3 families** | More families = slower load, visual chaos |
| **Fallback stacks** | System fonts if web fonts fail to load |

### Readability Constraints

| Constraint | Requirement |
|------------|-------------|
| **Minimum body size** | 16px (never smaller) |
| **Line height** | 1.5-1.7 for body, 1.1-1.3 for headings |
| **Letter spacing** | Normal or slightly positive for body |
| **Weight availability** | At least regular (400) + bold (700) |
| **Variable fonts preferred** | Single file, multiple weights, smaller payload |

### Performance Constraints

| Constraint | Approach |
|------------|----------|
| **Subset fonts** | Latin extended only (unless i18n requires more) |
| **WOFF2 format** | Best compression, widest support |
| **Font display: swap** | Show fallback immediately, swap when loaded |
| **Preload critical fonts** | Heading font loaded in `<head>` |

---

## First-Time User Experience (FTUX)

### The "Dice Roll" Concept

**Purpose:** Transform randomization from a passive experience into an interactive discovery moment. First-time users encounter a playful invitation to explore visual variations.

| Aspect | Approach |
|--------|----------|
| **Placement** | Hero section, visible above the fold |
| **Visual treatment** | Dice icon with playful micro-interaction |
| **Label** | "Shuffle Style" or "Surprise Me" |
| **Feedback** | Brief animation, style changes, optional toast |
| **Persistence** | After 2-3 uses, the button becomes less prominent |

### User Control Spectrum

```
DISCOVERY ──────────────────────────────────────────────► STABILITY
│                                                             │
│  "Roll the dice"    "This one's nice"    "Keep it this way" │
│      │                    │                      │          │
│      ▼                    ▼                      ▼          │
│  [New Visit]         [Bookmark]            [Lock Style]     │
│  Auto-randomize      Remember style        Disable random   │
│                      for session           permanently      │
└─────────────────────────────────────────────────────────────┘
```

**Every user can find their comfort level:**
- **Explorers:** Enjoy the novelty, actively click "roll"
- **Settlers:** Find a style they like, it persists for their session
- **Guardians:** Lock their preferred style, disable randomization

---

## Accessibility Requirements

| Concern | Requirement |
|---------|-------------|
| **Color contrast** | All text combinations meet WCAG AA minimum (4.5:1) |
| **Motion sensitivity** | Respect `prefers-reduced-motion` for style transitions |
| **Theme preference** | Respect `prefers-color-scheme` as initial default |
| **Screen readers** | Announce style changes with `aria-live="polite"` |
| **Keyboard navigation** | Dice roll button fully keyboard-accessible |
| **Focus indicators** | Visible focus rings across all palettes (not color-dependent) |
| **Dyslexia-friendly** | Body fonts tested for readability; no decorative body fonts |
| **Vestibular disorders** | No jarring transitions; smooth, optional animations |

### Mandatory Accessibility Checks

```
Before shipping a new palette:
☐ WCAG AA contrast verified for all text/background combinations
☐ Tested with colorblind simulators (deuteranopia, protanopia, tritanopia)
☐ Focus indicators visible against all backgrounds
☐ Semantic colors (success/warning/error) remain distinguishable

Before shipping a new typography set:
☐ Body font tested at 16px for extended reading
☐ Heading font legible at typical heading sizes
☐ No decorative/script fonts for body text
☐ Fallback fonts specified and tested
```

---

## Context Appropriateness

### Where Style Randomization Works

| Context | Why It Works |
|---------|--------------|
| **Playgrounds/sandboxes** | Reinforces experimentation ethos |
| **Showcases/demos** | Demonstrates design system flexibility |
| **Landing pages** | Creates memorable first impressions |
| **Marketing sites** | Expresses brand playfulness |
| **Personal portfolios** | Shows creative range |
| **Template/starter projects** | Proves adaptability |

### Where Style Randomization Fails

| Context | Why It Fails |
|---------|--------------|
| **Dashboards** | Users need consistency for task completion |
| **Transactional flows** | Checkout, payments require trust signals |
| **Documentation** | Reading focus over visual novelty |
| **Admin panels** | Professionalism, predictability expected |
| **Accessibility-critical apps** | Risk of contrast failures too high |
| **Brand-critical B2B** | Corporate identity must be stable |

### Velociraptor Context

**Style randomization works for Velociraptor** because:

1. **The app IS the showcase** — every page demonstrates stack capabilities
2. **Target audience appreciates experimentation** — developers, designers
3. **Memorable differentiation** — "that site that looks different every time"
4. **Proves the design system** — if randomization works, the token system is robust
5. **Low stakes** — no transactions, no critical workflows

> **Pioneering Pattern**: Research indicates no major production sites currently implement "random palette per visit + lock preference" as a UX pattern. Most implementations are limited to palette generator tools. Velociraptor would be pioneering this approach for showcase/portfolio contexts.

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Alternative |
|--------------|--------------|-------------|
| **Random RGB values** | Contrast failures, accessibility violations | Pre-validated palette registry |
| **Random font selection** | Illegible combinations, performance issues | Curated typography sets |
| **Randomize on every navigation** | Disorienting, fatiguing | Per-visit or per-session randomization |
| **Randomize CTAs** | Conversion loss, confusion | Keep CTAs visually stable |
| **Ignore theme preference** | Dark mode users blinded by light | Theme axis independent of style |
| **No opt-out mechanism** | Accessibility violation, user frustration | "Lock this style" option |
| **Decorative body fonts** | Readability disaster for dyslexic users | Only readable sans-serif/serif for body |
| **Skip contrast validation** | WCAG failures, lawsuits | Automated testing in CI |
| **Jarring transitions** | Vestibular issues, motion sickness | Respect `prefers-reduced-motion` |

---

## Success Criteria

### User Experience

- First-time visitor discovers style randomization within 10 seconds
- Dice roll button is keyboard accessible
- Style change feels playful, not jarring
- "Lock style" option is discoverable (appears after first roll)
- **"Unlock style" button available** when style is locked (not just an indicator)
- Returning visitors with locked styles see their preferred style
- Error feedback displayed for failed API calls

### Accessibility

- All palette/typography combinations pass WCAG AA
- **All UI components (borders, rings) meet 3:1 contrast** (WCAG 2.1 SC 1.4.11)
- Motion-sensitive users see no animated transitions
- Screen reader users are informed of style changes (live region announcements)
- Focus indicators visible across all palettes
- Colorblind users can distinguish all semantic states
- **Touch targets meet 44×44px minimum** (WCAG 2.5.5)

### Technical

- No flash of unstyled content (FOUC) on page load
- **Blocking theme script** executes before first paint (CSP nonce required)
- Style persists across page navigations (same session)
- Font loading doesn't cause layout shift (CLS < 0.1)
- Locked styles survive browser restarts
- Guest-to-user migration preserves style preference
- **Cookie-first persistence** for performance (saves 50-100ms vs database query)

### Privacy & Compliance

- Style preference cookies may qualify as "strictly necessary" (accessibility accommodation)
- **GDPR consideration**: Verify legal classification with counsel if targeting EU users
- For maximum compliance, consider self-hosting fonts (WOFF2) instead of Google Fonts CDN

### Statistical

- At least 80% of return visits show a different style (for unlocked users)
- Even distribution across palettes (no palette appears >2x more than others)
- Even distribution across typography sets

---

## Related Documentation

- [architecture.md](./architecture.md) — Styling layer and state management
- [user-data.md](./user-data.md) — Style preferences as user configuration
- [progressive-revelation.md](./progressive-revelation.md) — FTUX integration
- [../blueprint/style-randomizer.md](../blueprint/style-randomizer.md) — Implementation blueprint
