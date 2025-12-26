# UnoCSS Patterns for Velociraptor

UnoCSS atomic CSS engine patterns for SvelteKit 2 + Svelte 5 projects.

## When to Use This Skill

Use when writing UnoCSS utility classes, configuring uno.config.ts, styling components, integrating icons, or working with Bits UI components. Essential for any styling work in the project.

## Critical Gotchas

| Issue | Impact | Solution |
|-------|--------|----------|
| Dynamic class interpolation | Classes not generated | Use safelist or static object maps |
| `.js/.ts` files not scanned | Missing classes in production | Add `@unocss-include` comment |
| Tailwind comma syntax | Grid cols broken | Use underscore: `grid-cols-[1fr_10px_max-content]` |
| Icons not showing | Empty space in UI | Install icon collection: `@iconify-json/{collection}` |
| FOUC in production | Flash of unstyled content | Set `cssCodeSplit: false` in vite config |

## SvelteKit Integration

### Vite Plugin Setup

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
  },
});
```

### Import UnoCSS

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import 'uno.css';

  let { children } = $props();
</script>

{@render children()}
```

### Svelte Scoped Mode (Large Projects)

For component-scoped CSS instead of global stylesheet:

```typescript
// vite.config.ts
import UnoCSS from '@unocss/svelte-scoped/vite';

export default defineConfig({
  plugins: [
    UnoCSS({
      injectReset: '@unocss/reset/tailwind.css',
    }),
    sveltekit(),
  ],
});
```

```html
<!-- src/app.html -->
<head>
  %unocss-svelte-scoped.global%
  %sveltekit.head%
</head>
```

```typescript
// src/hooks.server.ts - add to sequence
const unocssInject: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    transformPageChunk: ({ html }) =>
      html.replace('%unocss-svelte-scoped.global%', 'unocss_svelte_scoped_global_styles')
  });
};
```

## Configuration

### Standard Config

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
  presets: [
    presetWind3({ dark: 'class' }),  // Tailwind v3 compatible
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

  shortcuts: {
    'btn': 'px-4 py-2 rounded font-semibold shadow transition-colors',
    'btn-primary': 'btn bg-primary text-white hover:bg-primary-dark',
    'card': 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6',
  },

  theme: {
    colors: {
      primary: '#3b82f6',
      'primary-dark': '#2563eb',
    },
  },

  transformers: [
    transformerDirectives(),    // @apply support
    transformerVariantGroup(),  // hover:(bg-red text-white)
  ],
});
```

### Preset Selection

| Preset | Purpose | When to Use |
|--------|---------|-------------|
| `presetWind3` | Tailwind v3 compat | Default choice |
| `presetWind4` | Tailwind v4 compat | New v4 projects |
| `presetMini` | Minimal rules | Custom design systems |
| `presetIcons` | Pure CSS icons | Icon libraries |
| `presetAttributify` | HTML attribute mode | Cleaner templates |
| `presetTypography` | Prose styling | Content pages |

## Dynamic Classes

**UnoCSS is compile-time. Dynamic interpolation does NOT work.**

### Wrong

```svelte
<script>
  let color = 'red';
</script>
<div class="bg-{color}-500"></div>  <!-- Won't generate CSS! -->
```

### Correct: Static Object Map

```svelte
<script>
  // @unocss-include
  const colorMap = {
    red: 'bg-red-500',
    blue: 'bg-blue-500',
    green: 'bg-green-500',
  };
  let color = 'red';
</script>

<div class={colorMap[color]}></div>
```

### Correct: Safelist

```typescript
// uno.config.ts
export default defineConfig({
  safelist: [
    'bg-red-500',
    'bg-blue-500',
    'bg-green-500',
  ],
});
```

### Correct: Conditional Classes

```svelte
{#if color === 'red'}
  <div class="bg-red-500"></div>
{:else if color === 'blue'}
  <div class="bg-blue-500"></div>
{/if}
```

## Icons

### Installation

```bash
bun add -D @unocss/preset-icons @iconify-json/mdi @iconify-json/tabler
```

### Usage

```svelte
<!-- Syntax: i-{collection}-{icon-name} -->
<div class="i-mdi-account"></div>
<div class="i-tabler-home w-6 h-6 text-blue-500"></div>
```

### Dynamic Icons (With Safelist)

```svelte
<script>
  // @unocss-include
  const icons = {
    home: 'i-mdi-home',
    user: 'i-mdi-account',
    settings: 'i-mdi-cog',
  };
</script>

<div class={icons[type]}></div>
```

## Variant Groups

Cleaner syntax for grouped states:

```svelte
<!-- Without variant groups -->
<div class="hover:bg-gray-400 hover:text-white focus:bg-gray-400 focus:text-white"></div>

<!-- With variant groups (transformer required) -->
<div class="hover:(bg-gray-400 text-white) focus:(bg-gray-400 text-white)"></div>
```

## Shortcuts

### Static Shortcuts

```typescript
shortcuts: {
  'btn': 'py-2 px-4 font-semibold rounded-lg shadow-md',
  'btn-primary': 'btn bg-primary text-white hover:bg-primary-dark',
}
```

### Dynamic Shortcuts

```typescript
shortcuts: [
  // btn-{color} → btn-red, btn-blue, etc.
  [/^btn-(.*)$/, ([, c]) => `bg-${c}-500 hover:bg-${c}-600 text-white px-4 py-2 rounded`],
]
```

## @apply Directive

Use in `<style>` blocks with transformer:

```svelte
<style>
  .custom-button {
    @apply px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600;
  }
</style>
```

## Dark Mode

```svelte
<!-- Class-based (default with presetWind3) -->
<div class="bg-white dark:bg-gray-900 text-black dark:text-white"></div>
```

Toggle in parent:
```svelte
<html class="dark">
```

## Bits UI Integration

Bits UI is headless - apply UnoCSS directly:

```svelte
<script>
  import { Accordion } from 'bits-ui';
</script>

<Accordion.Root class="space-y-2">
  <Accordion.Item value="item-1">
    <Accordion.Trigger class="btn btn-primary w-full text-left">
      Click me
    </Accordion.Trigger>
    <Accordion.Content class="p-4 bg-gray-100 dark:bg-gray-800">
      Content here
    </Accordion.Content>
  </Accordion.Item>
</Accordion.Root>
```

### Data Attribute Styling

```svelte
<style>
  :global([data-accordion-trigger][data-state="open"]) {
    @apply bg-blue-700;
  }
</style>
```

### CSS Variables

```svelte
<!-- Match anchor width -->
<Select.Content class="w-[var(--bits-select-anchor-width)]">
```

## File Scanning

Default scanned extensions:
- `.jsx`, `.tsx`, `.vue`, `.svelte`, `.html`, `.md`, `.astro`

**NOT scanned:** `.js`, `.ts`

### Enable JS/TS Scanning

Per-file:
```typescript
// @unocss-include
export const classes = 'px-4 py-2 bg-blue-500';
```

Global:
```typescript
// uno.config.ts
export default defineConfig({
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|html)($|\?)/,
        'src/**/*.{js,ts}',  // Add this
      ],
    },
  },
});
```

## Tailwind Migration Notes

| Feature | Tailwind | UnoCSS |
|---------|----------|--------|
| Grid cols spaces | `grid-cols-[1fr,10px,max-content]` | `grid-cols-[1fr_10px_max-content]` |
| Variant groups | Not built-in | `hover:(bg-red text-white)` |
| Icons | JS components | `i-mdi-home` (pure CSS) |
| Plugins | Supported | Not supported (use presets/rules) |

## Anti-Patterns

### Don't: Interpolate Classes

```svelte
<!-- WRONG -->
<div class={`text-${size}`}></div>
```

### Don't: Expect Auto-scanning of TS/JS

```typescript
// WRONG - classes won't be generated
export const buttonClass = 'bg-blue-500';

// RIGHT - add magic comment
// @unocss-include
export const buttonClass = 'bg-blue-500';
```

### Don't: Massive Safelists

```typescript
// WRONG - bloats bundle
safelist: Object.keys(allIcons).map(i => `i-mdi-${i}`),

// RIGHT - safelist only what's actually dynamic
safelist: ['bg-red-500', 'bg-blue-500'],
```

### Don't: Use @apply for Everything

```svelte
<!-- WRONG - defeats purpose of atomic CSS -->
<style>
  .my-div { @apply text-sm text-white bg-blue-500 p-4 m-2 rounded; }
</style>

<!-- RIGHT - use classes directly -->
<div class="text-sm text-white bg-blue-500 p-4 m-2 rounded"></div>
```

## References

See `references/` for detailed guides:
- `setup.md` - Full installation and configuration
- `presets.md` - Preset configuration patterns
- `icons.md` - Icon integration deep dive
- `gotchas.md` - Common issues and solutions
- `bits-ui.md` - Bits UI styling patterns
