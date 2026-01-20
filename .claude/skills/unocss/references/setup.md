# UnoCSS Setup

Complete installation and configuration for Velociraptor.

## Contents

- [Standard Setup](#standard-setup) - Config file, Vite config, layout import
- [Svelte Scoped Setup](#svelte-scoped-setup-large-projects) - Component-scoped styles
- [Environment-Based Configuration](#environment-based-configuration) - Dev-only utilities
- [VS Code Integration](#vs-code-integration) - UnoCSS extension
- [Vercel Deployment](#vercel-deployment) - Build settings
- [TypeScript Types](#typescript-types) - Custom theme values

## Standard Setup

### Configuration File

```typescript
// uno.config.ts
import {
  defineConfig,
  presetWind3,
  presetAttributify,
  presetIcons,
  presetTypography,
} from 'unocss';
import transformerDirectives from '@unocss/transformer-directives';
import transformerVariantGroup from '@unocss/transformer-variant-group';

export default defineConfig({
  // Presets: Base first, then feature presets
  presets: [
    presetWind3({
      dark: 'class',  // Class-based dark mode
    }),
    presetAttributify({
      prefix: 'data-',
      prefixedOnly: true,
    }),
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
    presetTypography(),
  ],

  // Shortcuts
  shortcuts: {
    'btn': 'px-4 py-2 rounded font-semibold shadow transition-colors',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary-dark',
    'btn-secondary': 'btn bg-gray-200 text-gray-800 hover:bg-gray-300',
    'card': 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6',
    'input': 'px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-primary focus:border-transparent',
  },

  // Theme
  theme: {
    colors: {
      primary: '#3b82f6',
      'primary-dark': '#2563eb',
      secondary: '#6b7280',
    },
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'monospace'],
    },
  },

  // Transformers
  transformers: [
    transformerDirectives(),
    transformerVariantGroup(),
  ],

  // Content sources
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|astro|elm|php|phtml|html)($|\?)/,
      ],
    },
  },
});
```

### Vite Configuration

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from 'unocss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    UnoCSS(),      // MUST come before sveltekit()
    sveltekit(),
  ],
  build: {
    cssCodeSplit: false,  // Prevents FOUC in SSR
    target: 'es2022',
  },
});
```

### Layout Import

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import '@unocss/reset/tailwind.css';
  import 'uno.css';

  let { children } = $props();
</script>

{@render children()}
```

## Svelte Scoped Setup (Large Projects)

Component-scoped styles instead of global stylesheet. Uses `@unocss/svelte-scoped`.

### Vite Configuration

```typescript
// vite.config.ts
import { sveltekit } from '@sveltejs/kit/vite';
import UnoCSS from '@unocss/svelte-scoped/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    UnoCSS({
      injectReset: '@unocss/reset/tailwind.css',
    }),
    sveltekit(),
  ],
  build: {
    cssCodeSplit: false,
    target: 'es2022',
  },
});
```

### App HTML

```html
<!-- src/app.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%sveltekit.assets%/favicon.png" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    %unocss-svelte-scoped.global%
    %sveltekit.head%
  </head>
  <body data-sveltekit-preload-data="hover">
    <div style="display: contents">%sveltekit.body%</div>
  </body>
</html>
```

### Hooks Integration

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

const unocssInject: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%unocss-svelte-scoped.global%', 'unocss_svelte_scoped_global_styles')
  });
};

// Add to existing sequence
export const handle = sequence(unocssInject, authHandle, sessionHandle);
```

## Environment-Based Configuration

```typescript
// uno.config.ts
export default defineConfig({
  // Development-only utilities
  safelist: process.env.NODE_ENV === 'development'
    ? ['debug-red', 'debug-blue', 'debug-border']
    : [],
});
```

## VS Code Integration

Install the UnoCSS extension for IntelliSense:
- Extension ID: `antfu.unocss`

Features:
- Class name autocomplete
- Color preview
- Hover documentation
- Config file support

## Vercel Deployment

No special configuration needed. Standard build command:

```json
{
  "buildCommand": "bun run build",
  "outputDirectory": ".svelte-kit"
}
```

## TypeScript Types

UnoCSS is fully typed. The `defineConfig` function provides autocomplete for all options.

For custom theme values:

```typescript
// uno.config.ts
import { defineConfig } from 'unocss';

export default defineConfig({
  theme: {
    colors: {
      brand: {
        primary: '#3b82f6',
        secondary: '#6b7280',
      },
    },
  },
});
```

Usage: `text-brand-primary`, `bg-brand-secondary`
