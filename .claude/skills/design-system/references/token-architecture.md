# Token Architecture

Single source of truth pattern for design tokens.

## Two-File Architecture

```
src/app.css              ← Colors, shadows (runtime CSS variables)
src/lib/styles/tokens.ts ← References + non-colors (build-time)
```

**Why two files?**
- Colors need runtime switching (dark mode) → CSS variables in `app.css`
- Non-colors are static → build-time in `tokens.ts`

## What Goes Where

| Token Type | Source of Truth | Why |
|------------|-----------------|-----|
| Colors | `app.css` | Runtime dark mode toggle |
| Shadows | `app.css` | Theme-aware (can use color vars) |
| Animation/Duration | `app.css` | Respects `prefers-reduced-motion` |
| Z-index | `app.css` | Used in CSS, referenced in TS |
| Spacing | `tokens.ts` | Static, build-time optimization |
| Typography | `tokens.ts` | Static, build-time optimization |
| Breakpoints | `tokens.ts` | Static, used by UnoCSS + JS |
| Border radius | `tokens.ts` + `app.css` | Both need access |

## The Rule

**Never duplicate values between files.**

```css
/* app.css - ACTUAL VALUES */
:root {
  --color-primary: #2563eb;
}
.dark {
  --color-primary: #60a5fa;
}
```

```typescript
// tokens.ts - REFERENCES ONLY for colors
export const colors = {
  primary: 'var(--color-primary)',  // ← reference, NOT the hex value
} as const;

// ACTUAL VALUES for non-colors
export const spacing = {
  '4': '0.75rem',  // ← actual value lives here
} as const;
```

## Industry Standard (2024-2025)

This pattern matches:
- **shadcn/ui** - Pure CSS variables, no JS token layer
- **Radix UI** - CSS variables for colors, TS for references
- **Tailwind v4** - Moved from JS config to CSS-first in 2024
- **Chakra UI** - Auto-generates CSS vars from theme

**Key insight from Tailwind v4 migration:** CSS-first eliminates duplication and context switching.

## Three-Tier Token Hierarchy

```
Tier 1: Primitives (raw values)
  └── blue-600: #2563eb
  └── spacing-4: 0.75rem

Tier 2: Semantic (purpose-based)
  └── --color-primary: var(--blue-600)  // in app.css
  └── colors.primary: 'var(--color-primary)'  // in tokens.ts

Tier 3: Component usage
  └── <Button class="bg-primary">  // consumes semantic
```

**Components only use Tier 2 (semantic tokens).** Never reference primitives directly.

## Dark Mode Pattern

```css
/* app.css */
:root {
  --color-primary: #2563eb;    /* Light */
  --color-primary-hover: #1d4ed8;
}

.dark {
  --color-primary: #60a5fa;    /* Dark */
  --color-primary-hover: #93c5fd;
}
```

**Why CSS class toggle wins:**
- Instant switching, no page reload
- All components update via cascade
- Respects `prefers-color-scheme`
- Single class toggle propagates everywhere

## Anti-Patterns

### Duplicating Values

```typescript
// WRONG - values exist in both files
// app.css: --color-primary: #2563eb;
// tokens.ts:
export const colorValues = {
  primary: '#2563eb',  // ← DUPLICATION, will drift
};
```

### Component-Specific Tokens

```css
/* WRONG - creates token sprawl */
--button-primary-bg: var(--color-primary);
--card-header-bg: var(--color-primary);
--badge-accent-bg: var(--color-primary);

/* RIGHT - use semantic directly */
.button { background: var(--color-primary); }
.card-header { background: var(--color-primary); }
```

### Generic Naming

```css
/* WRONG - meaningless names */
--color-1: #2563eb;
--spacing-a: 1rem;

/* RIGHT - semantic purpose */
--color-primary: #2563eb;
--spacing-4: 1rem;
```

## File Locations

```
src/
├── app.css                      # Colors, shadows, z-index, animation
├── lib/
│   └── styles/
│       └── tokens.ts            # Spacing, typography, breakpoints + color refs
└── uno.config.ts                # Imports tokens.ts → generates utilities
```

## Adding New Tokens

### New Color

1. Add to `app.css` (both `:root` and `.dark`)
2. Add reference to `tokens.ts` colors object
3. UnoCSS picks up automatically

```css
/* 1. app.css */
:root { --color-accent: #8b5cf6; }
.dark { --color-accent: #a78bfa; }
```

```typescript
// 2. tokens.ts
export const colors = {
  // ...existing
  accent: 'var(--color-accent)',
} as const;
```

### New Spacing

1. Add to `tokens.ts` spacing object only
2. UnoCSS picks up automatically

```typescript
// tokens.ts
export const spacing = {
  // ...existing
  '9': '4rem',  // 64px
} as const;
```

## Verification

To check for duplication:

```bash
# Find hardcoded hex colors in components
grep -r "#[0-9a-fA-F]\{6\}" src/lib/components/

# Find arbitrary values in classes
grep -r "\[#" src/  # e.g., text-[#ff0000]
grep -r "text-\[" src/  # e.g., text-[1.3rem]
```

## References

- [W3C Design Tokens Spec (2025)](https://www.designtokens.org/TR/drafts/format/)
- [Tailwind v4 CSS-First Config](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui Theming](https://ui.shadcn.com/docs/theming)
- [Radix UI Color System](https://www.radix-ui.com/themes/docs/theme/color)
