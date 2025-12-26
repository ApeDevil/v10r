# UnoCSS Presets

Detailed preset configuration patterns.

## Contents

- [Available Presets](#available-presets) - Wind3, Wind4, Mini, Uno, Attributify, Icons, Typography, Web Fonts
- [presetWind3 (Recommended)](#presetwind3-recommended) - Tailwind v3 compatibility, dark mode
- [presetWind4 (Tailwind v4)](#presetwind4-tailwind-v4) - CSS variables, integrated reset
- [presetAttributify](#presetattributify) - HTML attribute mode
- [presetIcons](#preseticons) - Pure CSS icons via Iconify
- [presetTypography](#presettypography) - Prose styling for content
- [presetWebFonts](#presetwebfonts) - Font loading from Google, etc.
- [Preset Ordering](#preset-ordering) - Base preset first
- [Custom Rules](#custom-rules) - Static and dynamic rules
- [Custom Variants](#custom-variants) - State modifiers like hocus

## Available Presets

| Preset | Package | Purpose |
|--------|---------|---------|
| Wind3 | `@unocss/preset-wind3` | Tailwind v3 compatibility |
| Wind4 | `@unocss/preset-wind4` | Tailwind v4 compatibility |
| Mini | `@unocss/preset-mini` | Minimal essential rules |
| Uno | Built-in | Wind3 + attributify + icons |
| Attributify | `@unocss/preset-attributify` | HTML attribute mode |
| Icons | `@unocss/preset-icons` | Pure CSS icons |
| Typography | `@unocss/preset-typography` | Prose styling |
| Web Fonts | `@unocss/preset-web-fonts` | Font loading |
| Rem to Px | `@unocss/preset-rem-to-px` | Unit conversion |

## presetWind3 (Recommended)

Tailwind CSS v3 compatible utilities.

```typescript
import { presetWind3 } from 'unocss';

export default defineConfig({
  presets: [
    presetWind3({
      dark: 'class',        // 'class' | 'media'
      preflight: true,      // Include CSS reset
      variablePrefix: 'un-', // CSS variable prefix
    }),
  ],
});
```

### Dark Mode Options

```typescript
// Class-based (toggle with .dark on html/body)
presetWind3({ dark: 'class' })

// Media query (system preference)
presetWind3({ dark: 'media' })
```

Usage:
```svelte
<div class="bg-white dark:bg-gray-900"></div>
```

## presetWind4 (Tailwind v4)

For projects adopting Tailwind v4 patterns.

```typescript
import { presetWind4 } from 'unocss';

export default defineConfig({
  presets: [
    presetWind4(),
  ],
});
```

**Key Differences:**
- CSS variables auto-generated for theme values
- Reset styles integrated (no separate import)
- Theme keys adjusted to match Tailwind v4

## presetAttributify

Write utilities as HTML attributes.

```typescript
import { presetAttributify } from 'unocss';

export default defineConfig({
  presets: [
    presetAttributify({
      prefix: 'data-',      // Use data-* for valid HTML
      prefixedOnly: true,   // Only match prefixed attributes
      strict: false,        // Allow all attributes
    }),
  ],
});
```

### Usage

```svelte
<!-- Traditional -->
<div class="text-sm text-white bg-blue-500 hover:bg-blue-600"></div>

<!-- Attributify -->
<div
  data-text="sm white"
  data-bg="blue-500 hover:blue-600"
></div>

<!-- Grouped by state -->
<div data-hover="bg-blue-600 text-white scale-105"></div>
```

### Benefits

- Cleaner templates with long utility lists
- Group by property or state
- Better organization

### Caveats

- Use `prefix` to avoid conflicts with component props
- JSX needs `@unocss/transformer-attributify-jsx`

## presetIcons

Pure CSS icons via Iconify.

```typescript
import { presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetIcons({
      scale: 1.2,           // Scale icons
      cdn: 'https://esm.sh/', // CDN fallback
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
      collections: {
        // Custom icon collections
        custom: {
          logo: '<svg>...</svg>',
        },
      },
    }),
  ],
});
```

### Installation

```bash
# Install icon collections you need
bun add -D @iconify-json/mdi        # Material Design Icons
bun add -D @iconify-json/tabler     # Tabler Icons
bun add -D @iconify-json/lucide     # Lucide Icons
bun add -D @iconify-json/heroicons  # Heroicons
```

### Usage

```svelte
<!-- Syntax: i-{collection}-{icon} -->
<div class="i-mdi-account"></div>
<div class="i-tabler-home"></div>
<div class="i-lucide-settings"></div>

<!-- With sizing and color -->
<div class="i-mdi-heart w-8 h-8 text-red-500"></div>
```

## presetTypography

Prose styling for content.

```typescript
import { presetTypography } from 'unocss';

export default defineConfig({
  presets: [
    presetTypography({
      selectorName: 'prose',  // Class name
    }),
  ],
});
```

### Usage

```svelte
<article class="prose prose-lg dark:prose-invert">
  <h1>Heading</h1>
  <p>Paragraph text with <a href="#">links</a>.</p>
  <pre><code>Code blocks</code></pre>
</article>
```

### Modifiers

- `prose-sm`, `prose-lg`, `prose-xl` - Size variants
- `prose-invert` - Dark mode
- `prose-red`, `prose-blue` - Accent colors

## presetWebFonts

Load web fonts.

```typescript
import { presetWebFonts } from 'unocss';

export default defineConfig({
  presets: [
    presetWebFonts({
      provider: 'google',
      fonts: {
        sans: 'Inter',
        mono: ['JetBrains Mono', 'Fira Code'],
        custom: {
          name: 'Roboto',
          weights: ['400', '500', '700'],
          italic: true,
        },
      },
    }),
  ],
});
```

Usage: `font-sans`, `font-mono`, `font-custom`

## Preset Ordering

Order matters - base preset first:

```typescript
export default defineConfig({
  presets: [
    // 1. Base preset (required)
    presetWind3(),

    // 2. Feature presets
    presetAttributify(),
    presetIcons(),
    presetTypography(),
    presetWebFonts(),
  ],
});
```

## Custom Rules

Add custom utilities:

```typescript
export default defineConfig({
  rules: [
    // Static rule
    ['custom-shadow', { 'box-shadow': '0 2px 8px rgba(0,0,0,0.1)' }],

    // Dynamic rule
    [/^sq-(\d+)$/, ([, d]) => ({ width: `${d}rem`, height: `${d}rem` })],
  ],
});
```

Usage: `custom-shadow`, `sq-4`

## Custom Variants

Add custom state modifiers:

```typescript
export default defineConfig({
  variants: [
    // Add 'hocus' variant (hover + focus)
    (matcher) => {
      if (!matcher.startsWith('hocus:'))
        return matcher;
      return {
        matcher: matcher.slice(6),
        selector: s => `${s}:hover, ${s}:focus`,
      };
    },
  ],
});
```

Usage: `hocus:bg-blue-500`
