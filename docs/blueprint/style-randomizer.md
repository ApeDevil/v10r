# Style Randomizer Blueprint

Implementation blueprint for the Style Randomization system. Randomizes decorative styling (typography + color palettes) on each visit while keeping theme (dark/light) user-controlled.

**Foundation:** See [../foundation/style.md](../foundation/style.md) for philosophy, principles, and anti-patterns.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. hooks.server.ts ──► Check style cookie, roll new style if missing       │
│          │                                                                   │
│          ▼                                                                   │
│  2. hooks.server.ts ──► Load full style config → event.locals.style         │
│          │                                                                   │
│          ▼                                                                   │
│  3. +layout.server.ts ──► Pass style to page data                           │
│          │                                                                   │
│          ▼                                                                   │
│  4. +layout.svelte ──► Apply CSS custom properties, load fonts              │
│          │                                                                   │
│          ▼                                                                   │
│  5. Components ──► Use CSS vars (bg-primary, font-heading) or context       │
│          │                                                                   │
│          ▼                                                                   │
│  6. DiceRollButton ──► POST /api/style/roll → new cookie → invalidateAll()  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**

- **Cookie-first**: Cookie is trusted first (even for authenticated users) to avoid per-request database queries; database is backup/sync
- **SSR-compatible**: CSS custom properties injected server-side, blocking theme script prevents FOUC
- **Theme orthogonality**: Dark/light stored separately from palette/typography
- **Pre-validated only**: All palette/typography combinations validated at build time
- **Weighted distribution**: Randomization ensures even distribution across options

> **Performance Note**: For serverless (Neon PostgreSQL), trusting the cookie first saves 50-100ms per request by avoiding database round-trips.

---

## Data Model

### Core Types

```typescript
// src/lib/styles/random/types.ts

export interface ColorScale {
  50: string;
  100: string;
  200: string;
  300: string;
  400: string;
  500: string;
  600: string;
  700: string;
  800: string;
  900: string;
  950: string;
}

export interface SemanticColors {
  success: string;
  warning: string;
  error: string;
  info: string;
}

export interface PaletteColors {
  primary: string;
  primaryHover: string;
  primaryForeground: string;
  secondary: string;
  secondaryHover: string;
  secondaryForeground: string;  // Required for WCAG validation
  accent: string;
  accentForeground: string;     // Required for WCAG validation
  bg: string;
  fg: string;
  muted: string;
  mutedForeground: string;
  border: string;
  ring: string;
  semantic: SemanticColors;
}

export interface Palette {
  id: string;           // "P1", "P2", etc. - compact identifier
  name: string;         // "Ocean Depths" - human-readable
  light: PaletteColors; // Light mode values
  dark: PaletteColors;  // Dark mode values
}

export interface FontConfig {
  family: string;       // "Inter Variable"
  weights: number[];    // [400, 500, 700]
  fallback: string;     // "system-ui, sans-serif"
  url?: string;         // Google Fonts URL (optional if self-hosted)
}

export interface TypographySet {
  id: string;           // "T1", "T2", etc.
  name: string;         // "Serif + Sans"
  heading: FontConfig;
  body: FontConfig;
  mono?: FontConfig;    // Optional for code blocks
}

// Branded types for type-safe IDs (prevents accidental swapping)
export type PaletteId = string & { readonly __brand: 'PaletteId' };
export type TypographyId = string & { readonly __brand: 'TypographyId' };

export interface StyleConfig {
  paletteId: PaletteId;
  typographyId: TypographyId;
  locked: boolean;
}

export interface ResolvedStyle {
  config: StyleConfig;
  palette: Palette;
  typography: TypographySet;
}

// Versioned cookie schema for future migrations
export interface StyleCookieV1 {
  pid: string;
  tid: string;
  lck: boolean;
  v: 1;
}

// Add new versions as union: StyleCookie = StyleCookieV1 | StyleCookieV2
export type StyleCookie = StyleCookieV1;
```

### Style ID Format

Compact representation for cookies: `P{n}-T{n}` (e.g., "P7-T3")

```typescript
// src/lib/styles/random/serializer.ts

export function serializeStyleId(config: StyleConfig): string {
  return `${config.paletteId}-${config.typographyId}`;
}

export function parseStyleId(styleId: string): { paletteId: string; typographyId: string } | null {
  const match = styleId.match(/^(P\d+)-(T\d+)$/);
  if (!match) return null;
  return { paletteId: match[1], typographyId: match[2] };
}
```

---

## Palette Registry

### Structure

```typescript
// src/lib/styles/random/palette-registry.ts

import type { Palette } from './types';
import { validatePaletteContrast } from './contrast';

export const PALETTE_REGISTRY: Palette[] = [
  {
    id: 'P1',
    name: 'Ocean',
    light: {
      primary: 'hsl(210 100% 45%)',
      primaryHover: 'hsl(210 100% 40%)',
      primaryForeground: 'hsl(0 0% 100%)',
      secondary: 'hsl(195 85% 40%)',
      secondaryHover: 'hsl(195 85% 35%)',
      secondaryForeground: 'hsl(0 0% 100%)',
      accent: 'hsl(175 70% 35%)',
      accentForeground: 'hsl(0 0% 100%)',
      bg: 'hsl(210 30% 98%)',
      fg: 'hsl(210 40% 10%)',
      muted: 'hsl(210 20% 94%)',
      mutedForeground: 'hsl(210 20% 40%)',
      border: 'hsl(210 20% 88%)',
      ring: 'hsl(210 100% 45%)',
      semantic: {
        success: 'hsl(142 71% 35%)',
        warning: 'hsl(38 92% 45%)',
        error: 'hsl(0 84% 50%)',
        info: 'hsl(210 100% 45%)',
      },
    },
    dark: {
      primary: 'hsl(210 90% 60%)',
      primaryHover: 'hsl(210 90% 65%)',
      primaryForeground: 'hsl(210 40% 10%)',
      secondary: 'hsl(195 75% 55%)',
      secondaryHover: 'hsl(195 75% 60%)',
      secondaryForeground: 'hsl(210 40% 10%)',
      accent: 'hsl(175 60% 50%)',
      accentForeground: 'hsl(210 40% 10%)',
      bg: 'hsl(210 40% 8%)',
      fg: 'hsl(210 30% 95%)',
      muted: 'hsl(210 30% 15%)',
      mutedForeground: 'hsl(210 20% 60%)',
      border: 'hsl(210 30% 20%)',
      ring: 'hsl(210 90% 60%)',
      semantic: {
        success: 'hsl(142 71% 50%)',
        warning: 'hsl(38 92% 55%)',
        error: 'hsl(0 84% 60%)',
        info: 'hsl(210 90% 60%)',
      },
    },
  },
  // P2: Sunset (warm oranges/corals)
  // P3: Forest (greens/browns)
  // P4: Aurora (purples/teals)
  // P5: Monochrome (grays only)
  // ... etc
];

// Validate all palettes at module load (build-time check)
for (const palette of PALETTE_REGISTRY) {
  const validation = validatePaletteContrast(palette);
  if (!validation.valid) {
    throw new Error(`Palette ${palette.id} fails WCAG: ${validation.issues.join(', ')}`);
  }
}

export const PALETTE_IDS = PALETTE_REGISTRY.map(p => p.id);

export function getPalette(id: string): Palette | undefined {
  return PALETTE_REGISTRY.find(p => p.id === id);
}
```

### Contrast Validation

```typescript
// src/lib/styles/random/contrast.ts

/**
 * Calculate relative luminance per WCAG 2.1
 * https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
 */
export function getLuminance(hsl: string): number {
  const rgb = hslToRgb(hsl);
  const [r, g, b] = rgb.map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(color1: string, color2: string): number {
  const l1 = getLuminance(color1);
  const l2 = getLuminance(color2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

export const WCAG = {
  AA_NORMAL: 4.5,    // Normal text on background
  AA_LARGE: 3.0,     // Large text (18pt+ or 14pt bold) on background
  UI_COMPONENT: 3.0, // UI components and graphical objects (WCAG 2.1 SC 1.4.11)
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

export interface ContrastValidation {
  valid: boolean;
  issues: string[];
}

/**
 * Validate a single mode (light or dark) for WCAG compliance.
 * Checks all required color pairs per WCAG 2.1/2.2 specifications.
 */
function validateMode(
  colors: PaletteColors,
  mode: 'Light' | 'Dark',
  issues: string[]
): void {
  // 1. Text on backgrounds (4.5:1 minimum)
  const fgBg = getContrastRatio(colors.fg, colors.bg);
  if (fgBg < WCAG.AA_NORMAL) {
    issues.push(`${mode}: fg/bg = ${fgBg.toFixed(2)}:1 (need ${WCAG.AA_NORMAL}:1)`);
  }

  const mutedOnBg = getContrastRatio(colors.mutedForeground, colors.bg);
  if (mutedOnBg < WCAG.AA_NORMAL) {
    issues.push(`${mode}: mutedForeground/bg = ${mutedOnBg.toFixed(2)}:1`);
  }

  const mutedOnMuted = getContrastRatio(colors.mutedForeground, colors.muted);
  if (mutedOnMuted < WCAG.AA_NORMAL) {
    issues.push(`${mode}: mutedForeground/muted = ${mutedOnMuted.toFixed(2)}:1`);
  }

  // 2. Button text on button backgrounds (3:1 for large text)
  const primaryBtn = getContrastRatio(colors.primaryForeground, colors.primary);
  if (primaryBtn < WCAG.AA_LARGE) {
    issues.push(`${mode}: primaryForeground/primary = ${primaryBtn.toFixed(2)}:1`);
  }

  const secondaryBtn = getContrastRatio(colors.secondaryForeground, colors.secondary);
  if (secondaryBtn < WCAG.AA_LARGE) {
    issues.push(`${mode}: secondaryForeground/secondary = ${secondaryBtn.toFixed(2)}:1`);
  }

  const accentBtn = getContrastRatio(colors.accentForeground, colors.accent);
  if (accentBtn < WCAG.AA_LARGE) {
    issues.push(`${mode}: accentForeground/accent = ${accentBtn.toFixed(2)}:1`);
  }

  // 3. UI components (3:1 per WCAG 2.1 SC 1.4.11)
  const borderOnBg = getContrastRatio(colors.border, colors.bg);
  if (borderOnBg < WCAG.UI_COMPONENT) {
    issues.push(`${mode}: border/bg = ${borderOnBg.toFixed(2)}:1 (need ${WCAG.UI_COMPONENT}:1)`);
  }

  // Focus ring must be visible on both bg and primary (for focused buttons)
  const ringOnBg = getContrastRatio(colors.ring, colors.bg);
  const ringOnPrimary = getContrastRatio(colors.ring, colors.primary);
  if (ringOnBg < WCAG.UI_COMPONENT && ringOnPrimary < WCAG.UI_COMPONENT) {
    issues.push(`${mode}: ring fails on both bg (${ringOnBg.toFixed(2)}:1) and primary (${ringOnPrimary.toFixed(2)}:1)`);
  }

  // 4. Semantic colors on backgrounds (4.5:1 if used as text)
  for (const [name, color] of Object.entries(colors.semantic)) {
    const onBg = getContrastRatio(color, colors.bg);
    const onMuted = getContrastRatio(color, colors.muted);
    // Semantic colors must work on at least one common background
    if (onBg < WCAG.AA_NORMAL && onMuted < WCAG.AA_NORMAL) {
      issues.push(`${mode}: ${name} fails on bg (${onBg.toFixed(2)}:1) and muted (${onMuted.toFixed(2)}:1)`);
    }
  }
}

export function validatePaletteContrast(palette: Palette): ContrastValidation {
  const issues: string[] = [];

  validateMode(palette.light, 'Light', issues);
  validateMode(palette.dark, 'Dark', issues);

  return { valid: issues.length === 0, issues };
}
```

---

## Typography Registry

> **Font Loading Strategy**: Use `font-display: optional` to eliminate CLS (Cumulative Layout Shift).
> This shows fallback fonts if web fonts don't load within ~100ms, ensuring zero layout shift.
> For production, consider self-hosting fonts in WOFF2 format for better performance and GDPR compliance.

```typescript
// src/lib/styles/random/typography-registry.ts

import type { TypographySet } from './types';

export const TYPOGRAPHY_REGISTRY: TypographySet[] = [
  {
    id: 'T1',
    name: 'Clean Sans',
    heading: {
      family: 'Inter',
      weights: [500, 700],
      fallback: 'system-ui, sans-serif',
      // Use display=optional for zero CLS (fallback shown if font doesn't load in ~100ms)
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=optional',
    },
    body: {
      family: 'Inter',
      weights: [400, 500],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=optional',
    },
    mono: {
      family: 'JetBrains Mono',
      weights: [400, 500],
      fallback: 'ui-monospace, monospace',
      url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=optional',
    },
  },
  {
    id: 'T2',
    name: 'Editorial',
    heading: {
      family: 'Playfair Display',
      weights: [500, 700],
      fallback: 'Georgia, serif',
      url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=optional',
    },
    body: {
      family: 'Source Sans 3',
      weights: [400, 600],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=optional',
    },
  },
  {
    id: 'T3',
    name: 'Technical',
    heading: {
      family: 'Space Grotesk',
      weights: [500, 700],
      fallback: 'Arial, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=optional',
    },
    body: {
      family: 'IBM Plex Sans',
      weights: [400, 500],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&display=optional',
    },
    mono: {
      family: 'IBM Plex Mono',
      weights: [400, 500],
      fallback: 'ui-monospace, monospace',
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=optional',
    },
  },
  // T4: Geometric (Outfit + Nunito)
  // T5: Humanist (Libre Baskerville + Open Sans)
];

export const TYPOGRAPHY_IDS = TYPOGRAPHY_REGISTRY.map(t => t.id);

export function getTypography(id: string): TypographySet | undefined {
  return TYPOGRAPHY_REGISTRY.find(t => t.id === id);
}
```

---

## Randomization Generator

```typescript
// src/lib/styles/random/generator.ts

import { PALETTE_IDS, getPalette } from './palette-registry';
import { TYPOGRAPHY_IDS, getTypography } from './typography-registry';
import type { StyleConfig, ResolvedStyle } from './types';

/**
 * Generate a random style configuration.
 * Uses crypto.getRandomValues for better distribution.
 */
export function generateRandomStyle(): StyleConfig {
  const paletteIndex = crypto.getRandomValues(new Uint32Array(1))[0] % PALETTE_IDS.length;
  const typographyIndex = crypto.getRandomValues(new Uint32Array(1))[0] % TYPOGRAPHY_IDS.length;

  return {
    paletteId: PALETTE_IDS[paletteIndex],
    typographyId: TYPOGRAPHY_IDS[typographyIndex],
    locked: false,
  };
}

/**
 * Resolve a style config to full palette and typography objects.
 */
export function resolveStyle(config: StyleConfig): ResolvedStyle | null {
  const palette = getPalette(config.paletteId);
  const typography = getTypography(config.typographyId);

  if (!palette || !typography) return null;

  return { config, palette, typography };
}

/**
 * Generate CSS custom properties for a resolved style.
 */
export function generateCssVariables(
  style: ResolvedStyle,
  theme: 'light' | 'dark'
): Record<string, string> {
  const colors = theme === 'dark' ? style.palette.dark : style.palette.light;

  return {
    '--color-primary': colors.primary,
    '--color-primary-hover': colors.primaryHover,
    '--color-primary-foreground': colors.primaryForeground,
    '--color-secondary': colors.secondary,
    '--color-secondary-hover': colors.secondaryHover,
    '--color-accent': colors.accent,
    '--color-bg': colors.bg,
    '--color-fg': colors.fg,
    '--color-muted': colors.muted,
    '--color-muted-foreground': colors.mutedForeground,
    '--color-border': colors.border,
    '--color-ring': colors.ring,
    '--color-success': colors.semantic.success,
    '--color-warning': colors.semantic.warning,
    '--color-error': colors.semantic.error,
    '--color-info': colors.semantic.info,
    '--font-heading': `"${style.typography.heading.family}", ${style.typography.heading.fallback}`,
    '--font-body': `"${style.typography.body.family}", ${style.typography.body.fallback}`,
    '--font-mono': style.typography.mono
      ? `"${style.typography.mono.family}", ${style.typography.mono.fallback}`
      : 'ui-monospace, monospace',
  };
}
```

---

## Persistence Strategy

### Cookie Schema

```typescript
// Cookie name: v10r_style
// Value: JSON string
{
  "pid": "P7",      // Palette ID
  "tid": "T3",      // Typography ID
  "lck": false,     // Locked
  "v": 1            // Schema version
}
```

**Cookie Options:**
- `httpOnly: true` — Prevent XSS access
- `secure: true` — HTTPS only
- `sameSite: 'lax'` — CSRF protection
- `maxAge: 31536000` — 1 year
- `path: '/'` — Site-wide

### Database Schema (Authenticated Users)

```typescript
// src/lib/server/db/schema/preferences.ts
import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';
import { user } from './_better-auth';

export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Theme (orthogonal to style)
  theme: text('theme').$type<'light' | 'dark' | 'system'>().default('system'),

  // Style randomization
  paletteId: text('palette_id'),
  typographyId: text('typography_id'),
  styleLocked: boolean('style_locked').default(false),
  styleRandomizationEnabled: boolean('style_randomization_enabled').default(true),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
```

### Persistence Flow

```
┌────────────────┐      ┌─────────────────┐      ┌────────────────┐
│ Anonymous      │      │ Guest           │      │ Authenticated  │
│                │      │                 │      │                │
│ No cookie?     │ ───► │ Roll style      │      │ Check database │
│ Roll new style │      │ Set cookie      │      │ → Use DB style │
│ Set cookie     │      │                 │      │                │
└────────────────┘      └─────────────────┘      └────────────────┘
                                                         │
                                                         ▼
                              ┌─────────────────────────────────────┐
                              │ On login: Migrate cookie → database │
                              │ if user has no existing preference  │
                              └─────────────────────────────────────┘
```

---

## SvelteKit Integration

### Type Definitions

```typescript
// src/app.d.ts
import type { ResolvedStyle, StyleConfig } from '$lib/styles/random/types';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      style: ResolvedStyle;
      theme: 'light' | 'dark';
    }

    interface PageData {
      style: ResolvedStyle;
      theme: 'light' | 'dark';
    }
  }
}

export {};
```

### Server Hooks

> **Performance Critical**: Cookie-first approach saves 50-100ms per request by avoiding database round-trips.
> Database is only queried when cookie is missing (first visit after login or device change).

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { generateRandomStyle, resolveStyle } from '$lib/styles/random/generator';
import { userPreferences } from '$lib/server/db/schema/preferences';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import type { StyleConfig, StyleCookie } from '$lib/styles/random/types';

const STYLE_COOKIE = 'v10r_style';
const STYLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: STYLE_COOKIE_MAX_AGE,
};

/**
 * Parse and validate style cookie. Returns null if invalid.
 */
function parseStyleCookie(cookieVal: string): StyleConfig | null {
  try {
    const data: StyleCookie = JSON.parse(cookieVal);
    // Validate expected shape
    if (typeof data.pid !== 'string' || typeof data.tid !== 'string') {
      return null;
    }
    return {
      paletteId: data.pid as PaletteId,
      typographyId: data.tid as TypographyId,
      locked: Boolean(data.lck),
    };
  } catch {
    return null;
  }
}

/**
 * Serialize style config to cookie format.
 */
function serializeStyleCookie(config: StyleConfig): string {
  const data: StyleCookie = {
    pid: config.paletteId,
    tid: config.typographyId,
    lck: config.locked,
    v: 1,
  };
  return JSON.stringify(data);
}

const loadStyle: Handle = async ({ event, resolve }) => {
  const user = event.locals.user;
  let styleConfig: StyleConfig | null = null;
  let needsCookieUpdate = false;

  // 1. ALWAYS try cookie first (saves 50-100ms database round-trip)
  const cookieVal = event.cookies.get(STYLE_COOKIE);
  if (cookieVal) {
    styleConfig = parseStyleCookie(cookieVal);
  }

  // 2. If no valid cookie AND user is authenticated, check database
  if (!styleConfig && user) {
    try {
      const [prefs] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.userId, user.id))
        .limit(1);

      if (prefs?.paletteId && prefs?.typographyId) {
        styleConfig = {
          paletteId: prefs.paletteId as PaletteId,
          typographyId: prefs.typographyId as TypographyId,
          locked: prefs.styleLocked ?? false,
        };
        needsCookieUpdate = true; // Sync cookie with database
      }
    } catch (error) {
      // Database error - log and continue with fallback
      console.error('Failed to load style from database:', error);
      // styleConfig remains null, will generate random below
    }
  }

  // 3. If still no config, generate random style
  if (!styleConfig) {
    styleConfig = generateRandomStyle();
    needsCookieUpdate = true;

    // Save to database for authenticated users (background, don't block)
    if (user) {
      db.insert(userPreferences)
        .values({
          userId: user.id,
          paletteId: styleConfig.paletteId,
          typographyId: styleConfig.typographyId,
          styleLocked: false,
        })
        .onConflictDoUpdate({
          target: userPreferences.userId,
          set: {
            paletteId: styleConfig.paletteId,
            typographyId: styleConfig.typographyId,
            updatedAt: new Date(),
          },
        })
        .catch((error) => {
          console.error('Failed to save style to database:', error);
        });
    }
  }

  // 4. Resolve to full style object
  let resolved = resolveStyle(styleConfig);
  if (!resolved) {
    // Palette/typography was removed from registry - regenerate
    console.warn(`Style ${styleConfig.paletteId}-${styleConfig.typographyId} not found, regenerating`);
    styleConfig = generateRandomStyle();
    resolved = resolveStyle(styleConfig)!;
    needsCookieUpdate = true;
  }
  event.locals.style = resolved;

  // 5. Update cookie only if changed (avoid unnecessary Set-Cookie headers)
  if (needsCookieUpdate || !cookieVal) {
    event.cookies.set(STYLE_COOKIE, serializeStyleCookie(styleConfig), COOKIE_OPTIONS);
  }

  // 6. Load theme preference (cookie-based for SSR)
  const themeCookie = event.cookies.get('theme');
  if (themeCookie === 'dark' || themeCookie === 'light') {
    event.locals.theme = themeCookie;
  } else {
    // Default for SSR - client will detect system preference
    event.locals.theme = 'light';
  }

  return resolve(event);
};

export const handle = sequence(
  // betterAuthHandle,
  loadStyle,
  // rateLimitHandle,
);
```

### Root Layout

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    session: locals.session,
    style: locals.style,
    theme: locals.theme,
  };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setContext } from 'svelte';
  import { page } from '$app/state';
  import { browser } from '$app/environment';
  import { generateCssVariables } from '$lib/styles/random/generator';
  import type { ResolvedStyle } from '$lib/styles/random/types';

  let { children } = $props();

  // Reactive style from page data
  const style = $derived(page.data.style as ResolvedStyle);
  const serverTheme = $derived(page.data.theme as 'light' | 'dark');

  // Screen reader announcement for style changes
  let styleAnnouncement = $state('');

  // Client-side theme detection (respects system preference)
  let clientTheme = $state<'light' | 'dark'>('light');

  $effect(() => {
    // $effect only runs client-side, no need to check browser
    const stored = localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') {
      clientTheme = stored;
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      clientTheme = prefersDark ? 'dark' : 'light';
    }

    // Listen for system preference changes
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem('theme')) {
        clientTheme = e.matches ? 'dark' : 'light';
      }
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  });

  // Use client theme if available, fall back to server
  const theme = $derived(browser ? clientTheme : serverTheme);

  // Generate CSS variables
  const cssVars = $derived(generateCssVariables(style, theme));
  const cssVarsString = $derived(
    Object.entries(cssVars).map(([k, v]) => `${k}: ${v}`).join('; ')
  );

  // Apply dark class to html element
  $effect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  });

  // Provide style context with announcement function
  setContext('style', {
    get style() { return style; },
    get theme() { return theme; },
    get locked() { return style.config.locked; },
    announceStyleChange(paletteName: string, typographyName: string) {
      styleAnnouncement = `Style changed to ${paletteName} with ${typographyName} typography`;
      // Clear after announcement is read
      setTimeout(() => { styleAnnouncement = ''; }, 1000);
    },
  });

  // Collect font URLs - use $derived.by() for multi-statement computations
  const fontUrls = $derived.by(() => {
    const urls: string[] = [];
    if (style.typography.heading.url) urls.push(style.typography.heading.url);
    if (style.typography.body.url) urls.push(style.typography.body.url);
    if (style.typography.mono?.url) urls.push(style.typography.mono.url);
    return [...new Set(urls)]; // Dedupe
  });
</script>

<svelte:head>
  <!--
    FOUC Prevention: Detect theme BEFORE Svelte hydration.
    This runs synchronously before first paint.
    Note: Requires CSP nonce or 'unsafe-inline' if using strict CSP.
  -->
  {@html `<script nonce="%sveltekit.nonce%">
    (function() {
      const stored = localStorage.getItem('theme');
      const theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.dataset.theme = theme;
    })();
  </script>`}

  <!-- Preconnect to Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />

  <!-- Preload body font (most critical) -->
  {#if style.typography.body.url}
    <link rel="preload" as="style" href={style.typography.body.url} />
  {/if}

  <!-- Load fonts -->
  {#each fontUrls as url}
    <link rel="stylesheet" href={url} />
  {/each}
</svelte:head>

<!-- Screen reader announcement for style changes (WCAG 4.1.3) -->
<div class="sr-only" aria-live="polite" aria-atomic="true">
  {#if styleAnnouncement}
    {styleAnnouncement}
  {/if}
</div>

<div class="app-root" style={cssVarsString}>
  {@render children()}
</div>

<style>
  .app-root {
    min-height: 100vh;
    background-color: var(--color-bg);
    color: var(--color-fg);
    font-family: var(--font-body);
  }

  /* Screen reader only - visually hidden but accessible */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style>
```

---

## UnoCSS Integration

```typescript
// uno.config.ts
import { defineConfig, presetUno, presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetUno(),
    presetIcons(),
  ],
  theme: {
    colors: {
      primary: {
        DEFAULT: 'var(--color-primary)',
        hover: 'var(--color-primary-hover)',
        foreground: 'var(--color-primary-foreground)',
      },
      secondary: {
        DEFAULT: 'var(--color-secondary)',
        hover: 'var(--color-secondary-hover)',
      },
      accent: 'var(--color-accent)',
      background: 'var(--color-bg)',
      foreground: 'var(--color-fg)',
      muted: {
        DEFAULT: 'var(--color-muted)',
        foreground: 'var(--color-muted-foreground)',
      },
      border: 'var(--color-border)',
      ring: 'var(--color-ring)',
      success: 'var(--color-success)',
      warning: 'var(--color-warning)',
      error: 'var(--color-error)',
      info: 'var(--color-info)',
    },
    fontFamily: {
      heading: 'var(--font-heading)',
      body: 'var(--font-body)',
      mono: 'var(--font-mono)',
    },
  },
});
```

**Usage in components:**

```svelte
<h1 class="font-heading text-primary text-4xl">Welcome</h1>
<p class="font-body text-foreground">Body text uses the randomized font.</p>
<button class="bg-primary text-primary-foreground hover:bg-primary-hover">
  Click me
</button>
```

---

## API Endpoints

> **Security Note**: These endpoints are protected by SvelteKit's built-in CSRF protection
> (same-origin enforcement via `sameSite: 'lax'` cookies). For additional security,
> verify the `Origin` header matches your domain.

### Roll New Style

```typescript
// src/routes/api/style/roll/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateRandomStyle, resolveStyle } from '$lib/styles/random/generator';
import { userPreferences } from '$lib/server/db/schema/preferences';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
};

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const user = locals.user;

  // Check if style is locked
  if (locals.style.config.locked) {
    return json(
      { success: false, error: 'Style is locked. Unlock it first.' },
      { status: 400 }
    );
  }

  const newConfig = generateRandomStyle();
  const resolved = resolveStyle(newConfig);

  if (!resolved) {
    return json(
      { success: false, error: 'Failed to generate style. Please try again.' },
      { status: 500 }
    );
  }

  // Update database for authenticated users (non-blocking)
  if (user) {
    db.update(userPreferences)
      .set({
        paletteId: newConfig.paletteId,
        typographyId: newConfig.typographyId,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id))
      .catch((error) => {
        console.error('Failed to save style to database:', error);
      });
  }

  // Update cookie
  cookies.set('v10r_style', JSON.stringify({
    pid: newConfig.paletteId,
    tid: newConfig.typographyId,
    lck: false,
    v: 1,
  }), COOKIE_OPTIONS);

  return json({
    success: true,
    style: {
      paletteId: newConfig.paletteId,
      paletteName: resolved.palette.name,
      typographyId: newConfig.typographyId,
      typographyName: resolved.typography.name,
    },
  });
};
```

### Lock/Unlock Style

```typescript
// src/routes/api/style/lock/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { userPreferences } from '$lib/server/db/schema/preferences';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import * as v from 'valibot';

// Input validation schema
const LockRequestSchema = v.object({
  locked: v.boolean(),
});

const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 365,
};

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
  const user = locals.user;

  // Validate request body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const result = v.safeParse(LockRequestSchema, body);
  if (!result.success) {
    return json(
      { success: false, error: 'Invalid request: locked must be a boolean' },
      { status: 400 }
    );
  }

  const { locked } = result.output;

  // Update database for authenticated users (non-blocking)
  if (user) {
    db.update(userPreferences)
      .set({ styleLocked: locked, updatedAt: new Date() })
      .where(eq(userPreferences.userId, user.id))
      .catch((error) => {
        console.error('Failed to update lock status in database:', error);
      });
  }

  // Update cookie
  const current = locals.style.config;
  cookies.set('v10r_style', JSON.stringify({
    pid: current.paletteId,
    tid: current.typographyId,
    lck: locked,
    v: 1,
  }), COOKIE_OPTIONS);

  return json({ success: true, locked });
};
```

---

## FTUX: Dice Roll Component

> **Accessibility Fixes Applied**:
> - Touch targets meet 44×44px minimum (WCAG 2.5.5)
> - Screen reader announcements via context
> - Reduced motion preference respected
> - Error feedback for failed API calls
> - Unlock button when style is locked

```svelte
<!-- src/lib/components/DiceRollButton.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { getContext } from 'svelte';
  import type { ResolvedStyle } from '$lib/styles/random/types';

  interface StyleContext {
    style: ResolvedStyle;
    locked: boolean;
    announceStyleChange: (paletteName: string, typographyName: string) => void;
  }

  const styleContext = getContext<StyleContext>('style');

  // Throw early if used outside layout context
  if (!styleContext) {
    throw new Error('DiceRollButton must be used within the root layout');
  }

  let rolling = $state(false);
  let rollCount = $state(0);
  let errorMessage = $state('');

  // Check reduced motion preference with listener for changes
  let prefersReducedMotion = $state(false);
  $effect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotion = mq.matches;

    const handler = (e: MediaQueryListEvent) => {
      prefersReducedMotion = e.matches;
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  });

  async function rollStyle() {
    // Prevent double-clicks and locked state
    if (styleContext.locked || rolling) return;

    rolling = true;
    errorMessage = '';
    rollCount++;

    try {
      const response = await fetch('/api/style/roll', { method: 'POST' });
      const data = await response.json();

      if (!response.ok || !data.success) {
        errorMessage = data.error || 'Failed to change style. Please try again.';
        rollCount--; // Revert count on failure
        return;
      }

      // Announce to screen readers via layout context
      styleContext.announceStyleChange(data.style.paletteName, data.style.typographyName);

      await invalidateAll();
    } catch (err) {
      console.error('Style roll failed:', err);
      errorMessage = 'Network error. Please check your connection.';
      rollCount--; // Revert count on failure
    } finally {
      rolling = false;
    }
  }

  async function toggleLock(locked: boolean) {
    errorMessage = '';

    try {
      const response = await fetch('/api/style/lock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locked }),
      });

      if (!response.ok) {
        const data = await response.json();
        errorMessage = data.error || 'Failed to update lock status.';
        return;
      }

      await invalidateAll();
    } catch (err) {
      console.error('Lock toggle failed:', err);
      errorMessage = 'Network error. Please try again.';
    }
  }
</script>

<div class="dice-roll-container">
  {#if !styleContext.locked}
    <button
      class="dice-roll-button"
      onclick={rollStyle}
      disabled={rolling}
      aria-label="Randomize visual style"
    >
      <span
        class="dice-icon i-mdi-dice-6"
        class:animate-spin={rolling && !prefersReducedMotion}
      ></span>
      <span class="label">
        {rolling ? 'Rolling...' : 'Shuffle Style'}
      </span>
      {#if rollCount >= 2}
        <span class="badge">{rollCount}</span>
      {/if}
    </button>

    {#if rollCount >= 1}
      <button class="lock-button" onclick={() => toggleLock(true)}>
        <span class="i-mdi-lock"></span>
        Lock this style
      </button>
    {/if}
  {:else}
    <!-- Unlock button replaces the locked indicator -->
    <button class="unlock-button" onclick={() => toggleLock(false)}>
      <span class="i-mdi-lock-open"></span>
      <span>Unlock and randomize</span>
    </button>
  {/if}

  <!-- Error feedback -->
  {#if errorMessage}
    <div class="error-message" role="alert" aria-live="assertive">
      <span class="i-mdi-alert-circle"></span>
      {errorMessage}
    </div>
  {/if}
</div>

<style>
  .dice-roll-container {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    align-items: center;
  }

  .dice-roll-button {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    /* Ensure 44px minimum touch target */
    min-height: 44px;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    background-color: var(--color-accent);
    color: white;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-family: var(--font-body);
    transition: transform 150ms ease-out, opacity 150ms;
  }

  .dice-roll-button:hover:not(:disabled) {
    transform: scale(1.05);
  }

  .dice-roll-button:active:not(:disabled) {
    transform: scale(0.98);
  }

  .dice-roll-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .dice-icon {
    width: 1.5rem;
    height: 1.5rem;
  }

  .badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .lock-button,
  .unlock-button {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    /* Ensure 44px minimum touch target */
    min-height: 44px;
    padding: 0.625rem 1rem;
    border-radius: 0.375rem;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-muted-foreground);
    cursor: pointer;
    font-size: 0.875rem;
    transition: border-color 150ms, color 150ms;
  }

  .lock-button:hover,
  .unlock-button:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background-color: var(--color-error);
    color: white;
    font-size: 0.875rem;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .animate-spin {
    animation: spin 0.5s ease-in-out;
  }

  @media (prefers-reduced-motion: reduce) {
    .dice-roll-button:hover:not(:disabled) {
      transform: none;
    }
    .dice-roll-button:active:not(:disabled) {
      transform: none;
    }
    .animate-spin {
      animation: none;
    }
  }
</style>
```

---

## File Structure

```
src/
├── app.d.ts                              # Style types in App namespace
├── hooks.server.ts                       # Style loading hook
│
├── routes/
│   ├── +layout.server.ts                 # Pass style to pages
│   ├── +layout.svelte                    # CSS variables, font loading
│   └── api/style/
│       ├── roll/+server.ts               # POST: randomize style
│       └── lock/+server.ts               # POST: lock/unlock style
│
├── lib/
│   ├── styles/
│   │   └── random/
│   │       ├── index.ts                  # Public exports
│   │       ├── types.ts                  # Type definitions
│   │       ├── palette-registry.ts       # Pre-validated palettes
│   │       ├── typography-registry.ts    # Curated font sets
│   │       ├── contrast.ts               # WCAG validation utilities
│   │       ├── generator.ts              # Randomization + CSS generation
│   │       └── serializer.ts             # Style ID encoding/decoding
│   │
│   ├── components/
│   │   └── DiceRollButton.svelte         # FTUX randomization trigger
│   │
│   └── server/
│       └── db/schema/
│           └── preferences.ts            # User style preferences
│
└── uno.config.ts                         # UnoCSS theme extension
```

---

## Implementation Checklist

> **Validation Complete**: This checklist incorporates all findings from UXY, ARCHY, SVEY, RESY, and SCOUT agent analysis.

### Phase 1: Data Model & Registry

- [ ] Create type definitions in `types.ts`
  - [ ] Add branded types for `PaletteId` and `TypographyId`
  - [ ] Add `secondaryForeground` and `accentForeground` to `PaletteColors`
  - [ ] Add versioned `StyleCookie` type for future migrations
- [ ] Create contrast validation utilities in `contrast.ts`
  - [ ] Validate all color pairs (fg/bg, muted, button text, borders, rings, semantic)
  - [ ] Add `UI_COMPONENT` constant (3:1 ratio per WCAG 2.1 SC 1.4.11)
- [ ] Define 5+ palettes in `palette-registry.ts`
- [ ] Validate all palettes pass WCAG AA (complete contrast coverage)
- [ ] Define 3-5 typography sets in `typography-registry.ts`
  - [ ] Use `font-display: optional` for zero CLS
- [ ] Create style ID serialization in `serializer.ts`
- [ ] Create generator functions in `generator.ts`

### Phase 2: Server Integration

- [ ] Add `style` to `event.locals` type definitions
- [ ] Implement `loadStyle` hook in `hooks.server.ts`
  - [ ] **Cookie-first logic** (trust cookie, DB as fallback) - saves 50-100ms
  - [ ] **Error handling** with try-catch for database queries
  - [ ] Only set cookie if changed (avoid unnecessary Set-Cookie headers)
- [ ] Create cookie persistence logic with schema version
- [ ] Add `userPreferences` table with style columns
- [ ] Create `/api/style/roll` endpoint
  - [ ] Add consistent error response format
- [ ] Create `/api/style/lock` endpoint
  - [ ] Add Valibot input validation
- [ ] Test guest → user style migration

### Phase 3: Client Integration

- [ ] Update root layout to inject CSS variables
- [ ] **Add FOUC prevention script** in `<svelte:head>` (blocking, before hydration)
- [ ] Add font loading in `<svelte:head>`
  - [ ] Preload body font
  - [ ] Use `$derived.by()` for font URL collection (not `$derived(() => ...)`)
- [ ] Create style context provider with `announceStyleChange` function
- [ ] **Add screen reader live region** for style change announcements (WCAG 4.1.3)
- [ ] Extend UnoCSS theme with CSS variable references
- [ ] Test SSR/hydration (no FOUC)

### Phase 4: FTUX Component

- [ ] Create `DiceRollButton.svelte`
- [ ] Add roll animation (respect `prefers-reduced-motion` with listener)
- [ ] Add roll counter badge (show at ≥2 rolls)
- [ ] Add "Lock this style" button (show at ≥1 roll)
- [ ] **Add unlock button** when style is locked (not just indicator)
- [ ] **Fix touch targets** to 44×44px minimum (WCAG 2.5.5)
- [ ] **Add error feedback** for failed API calls with `role="alert"`
- [ ] Context validation (throw if used outside layout)
- [ ] Integrate into landing page/hero

### Phase 5: Testing & Polish

- [ ] Test all palette/typography combinations
- [ ] Run colorblind simulation tests (manual - no CI automation available)
- [ ] Verify keyboard accessibility
- [ ] Measure font loading performance (CLS < 0.1)
- [ ] Test on mobile devices (touch targets, viewport)
- [ ] Add axe-core to CI/CD for automated a11y testing
- [ ] Test theme FOUC prevention (server default + client detection)

### Phase 6: Production Readiness

- [ ] Consider self-hosting fonts (WOFF2) for GDPR compliance
- [ ] Add analytics for palette/typography popularity
- [ ] Monitor CLS with real user metrics
- [ ] Document CSP requirements for FOUC prevention script

---

## Data Model Refinements (Cross-Domain)

Refinements from architecture, SvelteKit, UX, research, and real-world analysis. Changes only -- everything not mentioned here remains as specified above.

---

### 1. OKLCH Color Format

**Decision: Use OKLCH for all palette color values.**

HSL is perceptually non-uniform -- `hsl(60 100% 50%)` and `hsl(240 100% 50%)` have wildly different perceived brightness despite identical lightness values. OKLCH fixes this, making programmatic scale generation and contrast prediction reliable. DaisyUI (40k+ stars) uses OKLCH exclusively in production, proving the approach at scale.

**What changes:**

All `PaletteColors` string values switch from `hsl(H S% L%)` to `oklch(L C H)` format:

```typescript
// BEFORE
primary: 'hsl(210 100% 45%)',

// AFTER
primary: 'oklch(0.55 0.22 255)',
```

**Contrast validation changes:**

The `getLuminance()` function currently parses HSL and converts to linear RGB. With OKLCH:
- Use `culori` (npm library) for OKLCH-to-sRGB conversion. Do NOT hand-roll OKLCH math.
- Fix the WCAG luminance threshold: use `0.04045`, not `0.03928` (the spec was corrected).
- The contrast ratio formula itself (`(L1 + 0.05) / (L2 + 0.05)`) is unchanged -- it operates on relative luminance, not color space.

```typescript
// contrast.ts -- updated
import { oklch, rgb } from 'culori';

export function getLuminance(color: string): number {
  const srgb = rgb(color); // culori handles oklch() strings
  if (!srgb) throw new Error(`Cannot parse color: ${color}`);
  const [r, g, b] = [srgb.r, srgb.g, srgb.b].map(c =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)  // Fixed threshold
  );
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
```

**CSS generation:** No change needed. Modern browsers support `oklch()` natively. The generated CSS variables just contain OKLCH strings instead of HSL. No PostCSS fallback needed -- our browser support baseline already covers OKLCH (Chrome 111+, Firefox 113+, Safari 15.4+).

**Build-time validation:** Unchanged. `culori` parses OKLCH at module load, contrast checks run identically.

---

### 2. `[data-palette]` CSS Selector Approach

**Change: `generateCssVariables()` returns a CSS rule block, not an inline style string.**

The original plan applied CSS variables as an inline `style` attribute on a wrapper div. The `[data-palette]` approach is better: set a single attribute on `<html>`, and let a `<style>` block do the work. This matches the DaisyUI pattern (`[data-theme="name"]`).

**What changes in `generateCssVariables()`:**

```typescript
// BEFORE: Returns Record<string, string> for inline styles
export function generateCssVariables(
  style: ResolvedStyle,
  theme: 'light' | 'dark'
): Record<string, string> { ... }

// AFTER: Returns a CSS rule block string
export function generatePaletteCss(palette: Palette): string {
  // One rule per palette, both modes
  return `
[data-palette="${palette.id}"] {
${Object.entries(mapColorsToVars(palette.light)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}
.dark[data-palette="${palette.id}"],
.dark [data-palette="${palette.id}"] {
${Object.entries(mapColorsToVars(palette.dark)).map(([k, v]) => `  ${k}: ${v};`).join('\n')}
}`;
}
```

**Layout integration changes:**

```svelte
<!-- BEFORE: inline style on wrapper div -->
<div class="app-root" style={cssVarsString}>

<!-- AFTER: data attribute on html + injected style block -->
<svelte:head>
  {@html `<style>${generatePaletteCss(style.palette)}</style>`}
</svelte:head>

<!-- In hooks.server.ts or layout: -->
<!-- document.documentElement.dataset.palette = style.config.paletteId -->
```

The `<html>` element gets `data-palette="P3"`. The `<style>` block contains the CSS rules scoped to that attribute. Switching palettes is a single `setAttribute` call -- no inline style diffing.

**Typography remains separate:** Font families are still applied via CSS variables in the style block (or inline), since they are not theme-dependent.

---

### 3. High-Contrast Palette Variant

**Decision: Add an optional `highContrast` property to each `Palette`, not a separate registry.**

Rationale: A high-contrast variant is a property of the palette itself, not a different palette. The same "Ocean" identity should have a `prefers-contrast: more` variant that intensifies its own colors rather than switching to a generic high-contrast palette.

**What changes in types:**

```typescript
export interface Palette {
  id: string;
  name: string;
  light: PaletteColors;
  dark: PaletteColors;
  highContrast?: {           // NEW -- optional for Phase 1
    light: Partial<PaletteColors>;  // Only override tokens that need boosting
    dark: Partial<PaletteColors>;
  };
}
```

Using `Partial<PaletteColors>` means high-contrast only overrides what needs changing (typically `fg`, `bg`, `border`, `muted`, `mutedForeground`). Unspecified tokens fall through to the base palette.

**CSS generation adds a media query layer:**

```css
@media (prefers-contrast: more) {
  [data-palette="P1"] {
    --color-fg: oklch(0.05 0.01 255);    /* Darker */
    --color-border: oklch(0.30 0.05 255); /* More visible */
  }
}
```

**Phase 1 scope:** The `highContrast` property is optional. Palettes without it simply pass through. This avoids blocking launch while establishing the extensibility hook. Phase 2 adds high-contrast overrides to each palette and validates them against AAA ratios (7:1 for text).

---

### 4. Token Coverage Map

The current `app.css` defines **~40 color tokens** across `:root` and `.dark`. Each palette overrides a subset. Unmapped tokens inherit from the `app.css` defaults.

**Tokens palettes OVERRIDE (palette-controlled, ~16):**

| CSS Variable | PaletteColors field | Notes |
|---|---|---|
| `--color-bg` | `bg` | Page background |
| `--color-fg` | `fg` | Primary text |
| `--color-body` | `body` | **NEW** -- body text (currently missing from PaletteColors) |
| `--color-muted` | `muted` | Muted backgrounds |
| `--color-border` | `border` | Default borders |
| `--color-subtle` | `subtle` | **NEW** -- subtle backgrounds |
| `--color-primary` | `primary` | Primary actions |
| `--color-primary-hover` | `primaryHover` | Primary hover state |
| `--color-primary-bg` | `primaryBg` | **NEW** -- primary background tint |
| `--color-primary-fg` | `primaryForeground` | Text on primary bg |
| `--color-primary-light` | `primaryLight` | **NEW** -- light primary tint |
| `--color-on-primary` | `onPrimary` | **NEW** -- text on solid primary |
| `--color-secondary-bg` | `secondaryBg` | **NEW** -- replaces `secondary` |
| `--color-secondary-fg` | `secondaryForeground` | Text on secondary bg |
| `--color-input-border` | `inputBorder` | **NEW** -- input borders |
| `--color-input-bg` | `inputBg` | **NEW** -- input backgrounds |

**Tokens palettes LEAVE AS DEFAULTS (fixed, ~24):**

| Category | Tokens | Rationale |
|---|---|---|
| Semantic status | `--color-success`, `--color-success-bg/fg/light`, `--color-warning-*`, `--color-error-*`, `--color-info-*` | Status colors must be universally recognizable. Palette should not make errors look like success. |
| Semi-transparent | `--color-bg-alpha`, `--color-fg-alpha` | Derived from bg/fg -- can be computed from palette values if needed later |
| Shadows | `--shadow-sm/md/lg/xl/modal`, `--shadow-glow-*` | Shadow intensity is theme-dependent, not palette-dependent |
| Surfaces | `--surface-0/1/2/3` | Elevation system. Could be palette-controlled later, but risky in Phase 1 |
| Layout | `--sidebar-*`, `--layout-*`, `--z-*` | Structural, not decorative |
| Animation | `--duration-*`, `--ease-*` | Temporal, not visual |
| Radius | `--radius-*` | Shape, not color |
| Chart | `--chart-1` through `--chart-8`, `--chart-grid/axis/label/bg/tooltip-bg` | Data viz needs its own palette story |

**Action required:** Add `body`, `subtle`, `primaryBg`, `primaryLight`, `onPrimary`, `secondaryBg`, `inputBorder`, and `inputBg` to `PaletteColors`. This brings coverage from ~16 to match the actual app.css color tokens that should be palette-controlled.

Updated `PaletteColors` (complete):

```typescript
export interface PaletteColors {
  // Core
  bg: string;
  fg: string;
  body: string;              // NEW
  muted: string;
  mutedForeground: string;
  border: string;
  subtle: string;            // NEW
  ring: string;

  // Primary
  primary: string;
  primaryHover: string;
  primaryBg: string;         // NEW
  primaryForeground: string;
  primaryLight: string;      // NEW
  onPrimary: string;         // NEW

  // Secondary
  secondaryBg: string;       // RENAMED from secondary
  secondaryForeground: string;

  // Accent
  accent: string;
  accentForeground: string;

  // Input
  inputBorder: string;       // NEW
  inputBg: string;           // NEW
}
```

**Semantic colors removed from PaletteColors.** The `semantic: SemanticColors` nested object is removed. Status colors are fixed across all palettes.

---

### 5. Roll Endpoint API Response

**Updated response shape for same-style detection and toast messages:**

```typescript
// POST /api/style/roll response
interface RollResponse {
  success: true;
  style: {
    paletteId: string;          // "P3" -- for same-style detection
    paletteName: string;        // "Ocean" -- for toast message
    typographyId: string;       // "T2" -- for same-style detection
    typographyName: string;     // "Editorial" -- for toast message
  };
}

// Error response (400/500)
interface RollErrorResponse {
  success: false;
  error: string;
}
```

**Same-style detection flow (client-side):**

The client compares the previous `paletteId + typographyId` with the response. If both match, show a different toast ("Same style! Roll again?") instead of the standard change toast.

```typescript
// In DiceRollButton.svelte
const prevPaletteId = styleContext.style.config.paletteId;
const prevTypographyId = styleContext.style.config.typographyId;

const response = await fetch('/api/style/roll', { method: 'POST' });
const data = await response.json();

const sameStyle = data.style.paletteId === prevPaletteId
               && data.style.typographyId === prevTypographyId;

if (sameStyle) {
  toast('Same style! Roll again for something different.');
} else {
  toast(`Now wearing ${data.style.paletteName} + ${data.style.typographyName}`);
}
```

**Locked style with deleted palette:** When `resolveStyle()` returns null (palette removed from registry), regenerate a new random config but **preserve `locked: true`**. The user's lock intent survives palette deprecation.

```typescript
// In hooks.server.ts, step 4
if (!resolved) {
  const wasLocked = styleConfig.locked;  // Preserve lock intent
  styleConfig = generateRandomStyle();
  styleConfig.locked = wasLocked;        // Restore lock
  resolved = resolveStyle(styleConfig)!;
  needsCookieUpdate = true;
}
```

---

### 6. Updated TypeScript Types (Complete)

```typescript
// src/lib/styles/random/types.ts

// --- Color types ---

/** All OKLCH color strings, e.g. 'oklch(0.55 0.22 255)' */
export interface PaletteColors {
  // Core
  bg: string;
  fg: string;
  body: string;
  muted: string;
  mutedForeground: string;
  border: string;
  subtle: string;
  ring: string;

  // Primary
  primary: string;
  primaryHover: string;
  primaryBg: string;
  primaryForeground: string;
  primaryLight: string;
  onPrimary: string;

  // Secondary
  secondaryBg: string;
  secondaryForeground: string;

  // Accent
  accent: string;
  accentForeground: string;

  // Input
  inputBorder: string;
  inputBg: string;
}

// --- Palette ---

export interface Palette {
  id: string;
  name: string;
  light: PaletteColors;
  dark: PaletteColors;
  highContrast?: {
    light: Partial<PaletteColors>;
    dark: Partial<PaletteColors>;
  };
}

// --- Typography ---

export interface FontConfig {
  family: string;
  weights: number[];
  fallback: string;
  url?: string;
}

export interface TypographySet {
  id: string;
  name: string;
  heading: FontConfig;
  body: FontConfig;
  mono?: FontConfig;
}

// --- Branded IDs ---

export type PaletteId = string & { readonly __brand: 'PaletteId' };
export type TypographyId = string & { readonly __brand: 'TypographyId' };

// --- Style config ---

export interface StyleConfig {
  paletteId: PaletteId;
  typographyId: TypographyId;
  locked: boolean;
}

export interface ResolvedStyle {
  config: StyleConfig;
  palette: Palette;
  typography: TypographySet;
}

// --- Cookie ---

export interface StyleCookieV1 {
  pid: string;
  tid: string;
  lck: boolean;
  v: 1;
}

export type StyleCookie = StyleCookieV1;

// --- API Response ---

export interface RollResponseSuccess {
  success: true;
  style: {
    paletteId: string;
    paletteName: string;
    typographyId: string;
    typographyName: string;
  };
}

export interface RollResponseError {
  success: false;
  error: string;
}

export type RollResponse = RollResponseSuccess | RollResponseError;

// --- Token coverage documentation ---

/**
 * Tokens controlled by palette (overridden per palette):
 * bg, fg, body, muted, mutedForeground, border, subtle, ring,
 * primary, primaryHover, primaryBg, primaryForeground, primaryLight, onPrimary,
 * secondaryBg, secondaryForeground, accent, accentForeground,
 * inputBorder, inputBg
 *
 * Tokens NOT controlled by palette (app.css defaults):
 * - Semantic status: success/warning/error/info (all variants)
 * - Semi-transparent: bg-alpha, fg-alpha
 * - Shadows: sm, md, lg, xl, modal, glow-*
 * - Surfaces: surface-0/1/2/3
 * - Layout: sidebar-*, layout-*, z-*
 * - Animation: duration-*, ease-*
 * - Radius: radius-*
 * - Chart: chart-1..8, chart-grid/axis/label/bg/tooltip-bg
 */
```

---

### 7. Cookie `secure` Flag

**Change:** Conditional on environment, per svey finding.

```typescript
const COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',  // false in local dev (HTTP)
  sameSite: 'lax' as const,
  maxAge: STYLE_COOKIE_MAX_AGE,
};
```

---

### Summary of All Changes from Original Plan

| Area | Original | Refined |
|---|---|---|
| Color format | HSL strings | OKLCH strings (culori for parsing) |
| Luminance threshold | 0.03928 | 0.04045 (corrected WCAG spec) |
| CSS application | Inline `style` attribute | `[data-palette]` CSS rule block |
| `generateCssVariables()` | Returns `Record<string, string>` | Renamed `generatePaletteCss()`, returns CSS string |
| PaletteColors fields | ~16 fields + nested semantic | ~22 fields, no nested semantic |
| Semantic colors | Per-palette (in PaletteColors) | Fixed (app.css defaults, not overridden) |
| High contrast | Not addressed | Optional `highContrast` partial overrides per palette |
| Token coverage | Undocumented | Explicit map of 22 overridden vs 24 fixed tokens |
| Roll response | Had names but no explicit type | Typed `RollResponse` union with IDs for same-style detection |
| Lock preservation | Regenerate resets lock | Regenerate preserves `locked: true` intent |
| Cookie `secure` | Always `true` | Conditional on `NODE_ENV` |
| Dependencies | None added | `culori` (OKLCH math) |

## Related Documentation

- [../foundation/style.md](../foundation/style.md) — Philosophy and principles
- [state.md](./state.md) — Svelte 5 runes patterns
- [middleware.md](./middleware.md) — Server hooks integration
- [../stack/ui/unocss.md](../stack/ui/unocss.md) — UnoCSS configuration
- [app-shell/shell-state.md](./app-shell/shell-state.md) — Theme state management
