# UnoCSS Icons

Pure CSS icon integration via Iconify.

## Contents

- [Icon Collections](#icon-collections) - Available collections
- [Configuration](#configuration) - Options: scale, CDN, collections, customizations
- [Basic Usage](#basic-usage) - Syntax: i-{collection}-{icon-name}
- [Styling Icons](#styling-icons) - Size, color, transform
- [Icons in Buttons](#icons-in-buttons) - With text, icon-only
- [Dynamic Icons](#dynamic-icons) - Static maps, safelist, conditional rendering
- [Custom Icon Collections](#custom-icon-collections) - Inline SVG, from files
- [Icon Finder](#icon-finder) - Browse collections at icones.js.org
- [Anti-Patterns](#anti-patterns) - Dynamic interpolation, massive safelists
- [Comparison](#comparison-with-other-icon-solutions) - UnoCSS vs Heroicons vs SVG Sprites

## Icon Collections

Available collections:
- `@iconify-json/mdi` - Material Design Icons (7000+)
- `@iconify-json/tabler` - Tabler Icons (4000+)
- `@iconify-json/lucide` - Lucide Icons (1000+)
- `@iconify-json/heroicons` - Heroicons (300+)
- `@iconify-json/carbon` - Carbon Icons (2000+)
- `@iconify-json/ph` - Phosphor Icons (6000+)

## Configuration

```typescript
// uno.config.ts
import { presetIcons } from 'unocss';

export default defineConfig({
  presets: [
    presetIcons({
      scale: 1.2,
      extraProperties: {
        'display': 'inline-block',
        'vertical-align': 'middle',
      },
    }),
  ],
});
```

### Options

```typescript
presetIcons({
  // Scale factor for icons
  scale: 1.2,

  // CDN fallback for missing icons
  cdn: 'https://esm.sh/',

  // Extra CSS properties
  extraProperties: {
    'display': 'inline-block',
    'vertical-align': 'middle',
  },

  // Monorepo support - multiple icon directories
  cwd: [
    'packages/app',
    'packages/ui',
  ],

  // Custom icon loader
  customizations: {
    customize(props) {
      props.width = '1.2em';
      props.height = '1.2em';
      return props;
    },
  },

  // Custom collections
  collections: {
    custom: {
      logo: '<svg viewBox="0 0 24 24">...</svg>',
      icon: () => fs.readFileSync('./icons/icon.svg', 'utf-8'),
    },
  },
})
```

## Basic Usage

Syntax: `i-{collection}-{icon-name}`

```svelte
<!-- Material Design Icons -->
<div class="i-mdi-account"></div>
<div class="i-mdi-home"></div>
<div class="i-mdi-settings"></div>

<!-- Tabler Icons -->
<div class="i-tabler-user"></div>
<div class="i-tabler-home-2"></div>

<!-- Lucide Icons -->
<div class="i-lucide-user"></div>
<div class="i-lucide-settings"></div>

<!-- Heroicons -->
<div class="i-heroicons-user"></div>
<div class="i-heroicons-home"></div>
```

## Styling Icons

### Size

```svelte
<!-- Using width/height -->
<div class="i-mdi-heart w-4 h-4"></div>
<div class="i-mdi-heart w-6 h-6"></div>
<div class="i-mdi-heart w-8 h-8"></div>

<!-- Using text size (with proper extraProperties) -->
<div class="i-mdi-heart text-xl"></div>
<div class="i-mdi-heart text-2xl"></div>
```

### Color

```svelte
<!-- Text color applies to icon -->
<div class="i-mdi-heart text-red-500"></div>
<div class="i-mdi-star text-yellow-400"></div>
<div class="i-mdi-check text-green-500"></div>

<!-- Hover states -->
<div class="i-mdi-heart text-gray-400 hover:text-red-500"></div>
```

### Transform

```svelte
<!-- Rotation -->
<div class="i-mdi-arrow-right rotate-90"></div>

<!-- Flip -->
<div class="i-mdi-arrow-left scale-x-[-1]"></div>

<!-- Animation -->
<div class="i-mdi-loading animate-spin"></div>
```

## Icons in Buttons

```svelte
<button class="btn btn-primary flex items-center gap-2">
  <span class="i-mdi-plus"></span>
  Add Item
</button>

<button class="btn btn-secondary">
  <span class="i-mdi-download mr-2"></span>
  Download
</button>
```

## Icon-Only Buttons

```svelte
<button class="p-2 rounded hover:bg-gray-100" aria-label="Settings">
  <span class="i-mdi-cog w-5 h-5"></span>
</button>

<button class="p-2 rounded-full hover:bg-red-100" aria-label="Delete">
  <span class="i-mdi-delete w-5 h-5 text-red-500"></span>
</button>
```

## Dynamic Icons

### Static Object Map (Recommended)

```svelte
<script>
  // @unocss-include
  const statusIcons = {
    success: 'i-mdi-check-circle text-green-500',
    error: 'i-mdi-alert-circle text-red-500',
    warning: 'i-mdi-alert text-yellow-500',
    info: 'i-mdi-information text-blue-500',
  };

  let status = 'success';
</script>

<div class={statusIcons[status]}></div>
```

### With Safelist (Use Sparingly)

```typescript
// uno.config.ts
export default defineConfig({
  safelist: [
    'i-mdi-check-circle',
    'i-mdi-alert-circle',
    'i-mdi-alert',
    'i-mdi-information',
  ],
});
```

### Conditional Rendering

```svelte
{#if status === 'success'}
  <span class="i-mdi-check-circle text-green-500"></span>
{:else if status === 'error'}
  <span class="i-mdi-alert-circle text-red-500"></span>
{/if}
```

## Custom Icon Collections

### Inline SVG

```typescript
export default defineConfig({
  presets: [
    presetIcons({
      collections: {
        brand: {
          logo: '<svg viewBox="0 0 24 24"><path d="..."/></svg>',
          wordmark: '<svg viewBox="0 0 100 24"><text>Brand</text></svg>',
        },
      },
    }),
  ],
});
```

Usage: `i-brand-logo`, `i-brand-wordmark`

### From Files

```typescript
import { FileSystemIconLoader } from '@iconify/utils/lib/loader/node-loaders';

export default defineConfig({
  presets: [
    presetIcons({
      collections: {
        custom: FileSystemIconLoader('./src/assets/icons'),
      },
    }),
  ],
});
```

## Icon Finder

Find icons at: https://icones.js.org/

Browse collections:
- Material Design: `mdi`
- Tabler: `tabler`
- Lucide: `lucide`
- Heroicons: `heroicons`

## Anti-Patterns

### Don't: Dynamic Interpolation

```svelte
<!-- WRONG - won't work -->
<div class="i-mdi-{iconName}"></div>
```

### Don't: Massive Safelists

```typescript
// WRONG - bloats bundle
import { icons } from '@iconify-json/mdi/index.js';

export default defineConfig({
  safelist: Object.keys(icons.icons).map(i => `i-mdi-${i}`),
});
```

### Don't: Forget Icon Collections

```svelte
<!-- Won't work without @iconify-json/mdi installed -->
<div class="i-mdi-home"></div>
```

## Comparison with Other Icon Solutions

| Feature | UnoCSS Icons | Heroicons | SVG Sprites |
|---------|--------------|-----------|-------------|
| Bundle impact | CSS only | JS + SVG | Single SVG |
| Tree shaking | Automatic | Manual imports | N/A |
| Styling | CSS classes | Props/CSS | CSS |
| Collections | 100+ via Iconify | 1 | Custom |
| Dynamic | Safelist needed | Easy | Limited |
