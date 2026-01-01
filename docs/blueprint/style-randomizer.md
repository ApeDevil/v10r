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

- **Cookie-authoritative**: Style ID stored in httpOnly cookie (guests) or database (authenticated)
- **SSR-compatible**: CSS custom properties injected server-side, no FOUC
- **Theme orthogonality**: Dark/light stored separately from palette/typography
- **Pre-validated only**: All palette/typography combinations validated at build time
- **Weighted distribution**: Randomization ensures even distribution across options

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
  accent: string;
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

export interface StyleConfig {
  paletteId: string;
  typographyId: string;
  locked: boolean;
}

export interface ResolvedStyle {
  config: StyleConfig;
  palette: Palette;
  typography: TypographySet;
}
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
      accent: 'hsl(175 70% 35%)',
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
      accent: 'hsl(175 60% 50%)',
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
  AA_NORMAL: 4.5,
  AA_LARGE: 3.0,
  AAA_NORMAL: 7.0,
  AAA_LARGE: 4.5,
} as const;

export interface ContrastValidation {
  valid: boolean;
  issues: string[];
}

export function validatePaletteContrast(palette: Palette): ContrastValidation {
  const issues: string[] = [];

  // Validate light mode
  const lightFgBg = getContrastRatio(palette.light.fg, palette.light.bg);
  if (lightFgBg < WCAG.AA_NORMAL) {
    issues.push(`Light: fg/bg = ${lightFgBg.toFixed(2)}:1 (need ${WCAG.AA_NORMAL}:1)`);
  }

  const lightMuted = getContrastRatio(palette.light.mutedForeground, palette.light.bg);
  if (lightMuted < WCAG.AA_NORMAL) {
    issues.push(`Light: muted/bg = ${lightMuted.toFixed(2)}:1`);
  }

  const lightPrimary = getContrastRatio(palette.light.primaryForeground, palette.light.primary);
  if (lightPrimary < WCAG.AA_LARGE) {
    issues.push(`Light: primary button text = ${lightPrimary.toFixed(2)}:1`);
  }

  // Validate dark mode (same checks)
  const darkFgBg = getContrastRatio(palette.dark.fg, palette.dark.bg);
  if (darkFgBg < WCAG.AA_NORMAL) {
    issues.push(`Dark: fg/bg = ${darkFgBg.toFixed(2)}:1`);
  }

  const darkMuted = getContrastRatio(palette.dark.mutedForeground, palette.dark.bg);
  if (darkMuted < WCAG.AA_NORMAL) {
    issues.push(`Dark: muted/bg = ${darkMuted.toFixed(2)}:1`);
  }

  const darkPrimary = getContrastRatio(palette.dark.primaryForeground, palette.dark.primary);
  if (darkPrimary < WCAG.AA_LARGE) {
    issues.push(`Dark: primary button text = ${darkPrimary.toFixed(2)}:1`);
  }

  return { valid: issues.length === 0, issues };
}
```

---

## Typography Registry

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
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@500;700&display=swap',
    },
    body: {
      family: 'Inter',
      weights: [400, 500],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500&display=swap',
    },
    mono: {
      family: 'JetBrains Mono',
      weights: [400, 500],
      fallback: 'ui-monospace, monospace',
      url: 'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&display=swap',
    },
  },
  {
    id: 'T2',
    name: 'Editorial',
    heading: {
      family: 'Playfair Display',
      weights: [500, 700],
      fallback: 'Georgia, serif',
      url: 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@500;700&display=swap',
    },
    body: {
      family: 'Source Sans 3',
      weights: [400, 600],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@400;600&display=swap',
    },
  },
  {
    id: 'T3',
    name: 'Technical',
    heading: {
      family: 'Space Grotesk',
      weights: [500, 700],
      fallback: 'Arial, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&display=swap',
    },
    body: {
      family: 'IBM Plex Sans',
      weights: [400, 500],
      fallback: 'system-ui, sans-serif',
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500&display=swap',
    },
    mono: {
      family: 'IBM Plex Mono',
      weights: [400, 500],
      fallback: 'ui-monospace, monospace',
      url: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap',
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

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { generateRandomStyle, resolveStyle } from '$lib/styles/random/generator';
import { userPreferences } from '$lib/server/db/schema/preferences';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

const STYLE_COOKIE = 'v10r_style';
const STYLE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

interface StyleCookieData {
  pid: string;
  tid: string;
  lck: boolean;
  v: number;
}

const loadStyle: Handle = async ({ event, resolve }) => {
  const user = event.locals.user;
  let styleConfig: StyleConfig;

  if (user) {
    // Authenticated: Load from database
    const [prefs] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, user.id))
      .limit(1);

    if (prefs?.paletteId && prefs?.typographyId) {
      styleConfig = {
        paletteId: prefs.paletteId,
        typographyId: prefs.typographyId,
        locked: prefs.styleLocked ?? false,
      };
    } else {
      // New user: Roll and save
      styleConfig = generateRandomStyle();
      await db
        .insert(userPreferences)
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
        });
    }

    // Also set cookie for SSR consistency
    event.cookies.set(STYLE_COOKIE, JSON.stringify({
      pid: styleConfig.paletteId,
      tid: styleConfig.typographyId,
      lck: styleConfig.locked,
      v: 1,
    }), {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: STYLE_COOKIE_MAX_AGE,
    });
  } else {
    // Guest: Load from cookie
    const cookieVal = event.cookies.get(STYLE_COOKIE);

    if (cookieVal) {
      try {
        const data: StyleCookieData = JSON.parse(cookieVal);
        styleConfig = {
          paletteId: data.pid,
          typographyId: data.tid,
          locked: data.lck,
        };
      } catch {
        styleConfig = generateRandomStyle();
      }
    } else {
      styleConfig = generateRandomStyle();
    }

    // Set/refresh cookie
    event.cookies.set(STYLE_COOKIE, JSON.stringify({
      pid: styleConfig.paletteId,
      tid: styleConfig.typographyId,
      lck: styleConfig.locked,
      v: 1,
    }), {
      path: '/',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: STYLE_COOKIE_MAX_AGE,
    });
  }

  // Resolve to full style object
  const resolved = resolveStyle(styleConfig);
  if (!resolved) {
    // Fallback if palette/typography removed
    styleConfig = generateRandomStyle();
    event.locals.style = resolveStyle(styleConfig)!;
  } else {
    event.locals.style = resolved;
  }

  // Load theme preference
  const themeCookie = event.cookies.get('theme');
  if (themeCookie === 'dark' || themeCookie === 'light') {
    event.locals.theme = themeCookie;
  } else {
    // Default to system (resolved client-side)
    event.locals.theme = 'light'; // SSR default
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

  // Client-side theme detection (respects system preference)
  let clientTheme = $state<'light' | 'dark'>('light');

  $effect(() => {
    if (!browser) return;

    // Check for system preference if no explicit theme set
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
    if (!browser) return;
    document.documentElement.classList.toggle('dark', theme === 'dark');
  });

  // Provide style context
  setContext('style', {
    get style() { return style; },
    get theme() { return theme; },
    get locked() { return style.config.locked; },
  });

  // Collect font URLs
  const fontUrls = $derived(() => {
    const urls: string[] = [];
    if (style.typography.heading.url) urls.push(style.typography.heading.url);
    if (style.typography.body.url) urls.push(style.typography.body.url);
    if (style.typography.mono?.url) urls.push(style.typography.mono.url);
    return [...new Set(urls)]; // Dedupe
  });
</script>

<svelte:head>
  <!-- Preconnect to Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />

  <!-- Load fonts -->
  {#each fontUrls() as url}
    <link rel="stylesheet" href={url} />
  {/each}
</svelte:head>

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

### Roll New Style

```typescript
// src/routes/api/style/roll/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateRandomStyle, resolveStyle } from '$lib/styles/random/generator';
import { userPreferences } from '$lib/server/db/schema/preferences';
import { db } from '$lib/server/db';
import { eq } from 'drizzle-orm';

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const user = locals.user;

  // Check if style is locked
  if (locals.style.config.locked) {
    return json({ error: 'Style is locked' }, { status: 400 });
  }

  const newConfig = generateRandomStyle();
  const resolved = resolveStyle(newConfig);

  if (!resolved) {
    return json({ error: 'Failed to resolve style' }, { status: 500 });
  }

  if (user) {
    // Update database
    await db
      .update(userPreferences)
      .set({
        paletteId: newConfig.paletteId,
        typographyId: newConfig.typographyId,
        updatedAt: new Date(),
      })
      .where(eq(userPreferences.userId, user.id));
  }

  // Update cookie
  cookies.set('v10r_style', JSON.stringify({
    pid: newConfig.paletteId,
    tid: newConfig.typographyId,
    lck: false,
    v: 1,
  }), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

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

export const POST: RequestHandler = async ({ cookies, locals, request }) => {
  const user = locals.user;
  const { locked } = await request.json();

  if (user) {
    await db
      .update(userPreferences)
      .set({ styleLocked: locked, updatedAt: new Date() })
      .where(eq(userPreferences.userId, user.id));
  }

  // Update cookie
  const current = locals.style.config;
  cookies.set('v10r_style', JSON.stringify({
    pid: current.paletteId,
    tid: current.typographyId,
    lck: locked,
    v: 1,
  }), {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });

  return json({ success: true, locked });
};
```

---

## FTUX: Dice Roll Component

```svelte
<!-- src/lib/components/DiceRollButton.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import { getContext } from 'svelte';
  import type { ResolvedStyle } from '$lib/styles/random/types';

  interface StyleContext {
    style: ResolvedStyle;
    locked: boolean;
  }

  const styleContext = getContext<StyleContext>('style');

  let rolling = $state(false);
  let rollCount = $state(0);

  // Check reduced motion preference
  let prefersReducedMotion = $state(false);
  $effect(() => {
    if (typeof window !== 'undefined') {
      prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }
  });

  async function rollStyle() {
    if (styleContext.locked || rolling) return;

    rolling = true;
    rollCount++;

    try {
      const response = await fetch('/api/style/roll', { method: 'POST' });
      if (!response.ok) throw new Error('Failed to roll');
      await invalidateAll();
    } catch (err) {
      console.error('Style roll failed:', err);
    } finally {
      rolling = false;
    }
  }

  async function lockStyle() {
    await fetch('/api/style/lock', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locked: true }),
    });
    await invalidateAll();
  }
</script>

<div class="dice-roll-container">
  {#if !styleContext.locked}
    <button
      class="dice-roll-button"
      onclick={rollStyle}
      disabled={rolling}
      aria-label="Randomize visual style"
      aria-live="polite"
    >
      <span
        class="i-mdi-dice-6 w-6 h-6"
        class:animate-spin={rolling && !prefersReducedMotion}
      ></span>
      <span class="label">
        {rolling ? 'Rolling...' : 'Shuffle Style'}
      </span>
      {#if rollCount > 0}
        <span class="badge">{rollCount}</span>
      {/if}
    </button>

    {#if rollCount >= 2}
      <button class="lock-button" onclick={lockStyle}>
        <span class="i-mdi-lock w-4 h-4"></span>
        Lock this style
      </button>
    {/if}
  {:else}
    <div class="locked-indicator">
      <span class="i-mdi-lock w-4 h-4"></span>
      <span>Style locked</span>
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

  .dice-roll-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .badge {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
  }

  .lock-button {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    background: transparent;
    border: 1px solid var(--color-border);
    color: var(--color-muted-foreground);
    cursor: pointer;
    font-size: 0.875rem;
    transition: border-color 150ms, color 150ms;
  }

  .lock-button:hover {
    border-color: var(--color-primary);
    color: var(--color-primary);
  }

  .locked-indicator {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--color-muted-foreground);
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

### Phase 1: Data Model & Registry

- [ ] Create type definitions in `types.ts`
- [ ] Create contrast validation utilities in `contrast.ts`
- [ ] Define 5+ palettes in `palette-registry.ts`
- [ ] Validate all palettes pass WCAG AA
- [ ] Define 3-5 typography sets in `typography-registry.ts`
- [ ] Create style ID serialization in `serializer.ts`
- [ ] Create generator functions in `generator.ts`

### Phase 2: Server Integration

- [ ] Add `style` to `event.locals` type definitions
- [ ] Implement `loadStyle` hook in `hooks.server.ts`
- [ ] Create cookie persistence logic
- [ ] Add `userPreferences` table with style columns
- [ ] Create `/api/style/roll` endpoint
- [ ] Create `/api/style/lock` endpoint
- [ ] Test guest → user style migration

### Phase 3: Client Integration

- [ ] Update root layout to inject CSS variables
- [ ] Add font loading in `<svelte:head>`
- [ ] Create style context provider
- [ ] Extend UnoCSS theme with CSS variable references
- [ ] Test SSR/hydration (no FOUC)

### Phase 4: FTUX Component

- [ ] Create `DiceRollButton.svelte`
- [ ] Add roll animation (respect `prefers-reduced-motion`)
- [ ] Add roll counter badge
- [ ] Add "Lock this style" button
- [ ] Integrate into landing page/hero

### Phase 5: Testing & Polish

- [ ] Test all palette/typography combinations
- [ ] Run colorblind simulation tests
- [ ] Verify keyboard accessibility
- [ ] Measure font loading performance (CLS)
- [ ] Test on mobile devices
- [ ] Add toast notification for style changes (optional)

---

## Related Documentation

- [../foundation/style.md](../foundation/style.md) — Philosophy and principles
- [state.md](./state.md) — Svelte 5 runes patterns
- [middleware.md](./middleware.md) — Server hooks integration
- [../stack/ui/unocss.md](../stack/ui/unocss.md) — UnoCSS configuration
- [app-shell/shell-state.md](./app-shell/shell-state.md) — Theme state management
