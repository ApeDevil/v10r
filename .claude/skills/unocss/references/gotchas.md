# UnoCSS Gotchas

Common issues and their solutions.

## Contents

- [Dynamic Classes Don't Work](#dynamic-classes-dont-work) - Static maps, safelist, full class names
- [JS/TS Files Not Scanned](#jsts-files-not-scanned) - Magic comment, global config
- [FOUC in Production](#fouc-in-production) - CSS code splitting fix
- [Tailwind Syntax Differences](#tailwind-syntax-differences) - Grid, bg position, content quotes
- [Icons Not Showing](#icons-not-showing) - Missing collections, wrong syntax, dynamic names
- [@apply Not Working](#apply-not-working) - Transformer setup
- [Variant Groups Not Working](#variant-groups-not-working) - Transformer setup
- [Dark Mode Not Toggling](#dark-mode-not-toggling) - Class vs media configuration
- [Safelist Bloating Bundle](#safelist-bloating-bundle) - Minimize safelist
- [Classes in Third-Party Components](#classes-in-third-party-components) - Safelist or include library
- [Svelte Scoped Mode Issues](#svelte-scoped-mode-issues) - Limitations and migration
- [Production vs Development Mismatch](#production-vs-development-mismatch) - Common causes
- [HMR Not Updating](#hmr-not-updating) - Restart dev server
- [TypeScript Errors in Config](#typescript-errors-in-config) - Use defineConfig

## Dynamic Classes Don't Work

**Issue:** Class interpolation produces no CSS.

```svelte
<!-- WRONG - classes not generated -->
<script>
  let color = 'red';
</script>
<div class="bg-{color}-500"></div>
```

**Why:** UnoCSS is compile-time. It scans static strings, not runtime values.

**Solutions:**

### Option 1: Static Object Map

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

### Option 2: Safelist

```typescript
// uno.config.ts
export default defineConfig({
  safelist: ['bg-red-500', 'bg-blue-500', 'bg-green-500'],
});
```

### Option 3: Full Class Names

```svelte
<div class={color === 'red' ? 'bg-red-500' : 'bg-blue-500'}></div>
```

## JS/TS Files Not Scanned

**Issue:** Classes defined in `.js` or `.ts` files don't generate CSS.

```typescript
// src/lib/styles.ts
export const buttonClass = 'bg-blue-500 text-white'; // Not scanned!
```

**Why:** UnoCSS only scans `.svelte`, `.vue`, `.jsx`, `.tsx`, `.html`, `.md` by default.

**Solutions:**

### Option 1: Magic Comment

```typescript
// @unocss-include
export const buttonClass = 'bg-blue-500 text-white';
```

### Option 2: Global Config

```typescript
// uno.config.ts
export default defineConfig({
  content: {
    pipeline: {
      include: [
        /\.(vue|svelte|[jt]sx|mdx?|html)($|\?)/,
        'src/**/*.{js,ts}',  // Add JS/TS
      ],
    },
  },
});
```

## FOUC in Production

**Issue:** Flash of unstyled content on initial page load.

**Why:** CSS code splitting loads styles after HTML in SSR.

**Solution:**

```typescript
// vite.config.ts
export default defineConfig({
  build: {
    cssCodeSplit: false,  // Single CSS file
  },
});
```

## Tailwind Syntax Differences

**Issue:** Tailwind code doesn't work in UnoCSS.

### Grid Columns with Spaces

```css
/* Tailwind */
grid-cols-[1fr,10px,max-content]

/* UnoCSS - use underscore! */
grid-cols-[1fr_10px_max-content]
```

### Background Position

```css
/* Tailwind */
bg-[center_top_1rem]

/* UnoCSS - add prefix */
bg-[position:center_top_1rem]
```

### Content Quotes

```css
/* Tailwind */
before:content-['']

/* UnoCSS - not supported, use custom rule */
```

Custom rule for empty content:

```typescript
rules: [
  ['before-empty', { content: "''" }],
]
```

## Icons Not Showing

**Issue:** Icon classes render as empty space.

**Causes:**

### Missing Icon Collection

Ensure the icon collection package (e.g., `@iconify-json/mdi`) is installed.

### Wrong Syntax

```svelte
<!-- WRONG -->
<div class="mdi-home"></div>

<!-- CORRECT -->
<div class="i-mdi-home"></div>
```

### Dynamic Icon Name

```svelte
<!-- WRONG -->
<div class={`i-mdi-${iconName}`}></div>

<!-- CORRECT - use static map -->
<script>
  // @unocss-include
  const icons = { home: 'i-mdi-home', user: 'i-mdi-account' };
</script>
<div class={icons[iconName]}></div>
```

## @apply Not Working

**Issue:** `@apply` directive does nothing.

**Why:** Transformer not configured.

**Solution:**

```typescript
// uno.config.ts
import transformerDirectives from '@unocss/transformer-directives';

export default defineConfig({
  transformers: [transformerDirectives()],
});
```

Then in Svelte:

```svelte
<style>
  .button {
    @apply px-4 py-2 bg-blue-500 text-white rounded;
  }
</style>
```

## Variant Groups Not Working

**Issue:** `hover:(bg-red text-white)` doesn't parse.

**Why:** Transformer not configured.

**Solution:**

```typescript
// uno.config.ts
import transformerVariantGroup from '@unocss/transformer-variant-group';

export default defineConfig({
  transformers: [transformerVariantGroup()],
});
```

## Dark Mode Not Toggling

**Issue:** `dark:` classes don't respond to theme changes.

**Why:** Dark mode not configured or wrong toggle method.

### Class-Based (Default)

```typescript
presetWind3({ dark: 'class' })
```

Toggle by adding `.dark` to `<html>`:

```svelte
<script>
  function toggleDark() {
    document.documentElement.classList.toggle('dark');
  }
</script>
```

### Media Query Based

```typescript
presetWind3({ dark: 'media' })
```

Automatically follows system preference.

## Safelist Bloating Bundle

**Issue:** Large safelist increases CSS size dramatically.

**Why:** Every safelisted class is always included.

**Solution:** Minimize safelist, use static maps instead:

```typescript
// BAD - huge bundle
safelist: [...allPossibleColors.map(c => `bg-${c}-500`)],

// GOOD - only what's truly dynamic
safelist: ['bg-red-500', 'bg-green-500'],
```

## Classes in Third-Party Components

**Issue:** Classes passed to third-party components don't generate CSS.

**Why:** UnoCSS doesn't scan `node_modules`.

**Solutions:**

### Option 1: Safelist Required Classes

```typescript
safelist: ['p-4', 'm-2', 'bg-gray-100'], // Classes used in library
```

### Option 2: Include Library in Scan

```typescript
content: {
  pipeline: {
    include: [
      /\.(vue|svelte|[jt]sx|mdx?|html)($|\?)/,
      'node_modules/some-library/**/*.svelte',
    ],
  },
},
```

## Svelte Scoped Mode Issues

**Issue:** Some features don't work in scoped mode.

**Limitations:**
- Extractors not supported
- Different CSS injection mechanism
- Need hooks.server.ts modification

**If switching to scoped mode:**

1. Update vite config to use `@unocss/svelte-scoped/vite`
2. Add placeholder to `app.html`
3. Add hook handler
4. Remove `import 'uno.css'` from layout

## Production vs Development Mismatch

**Issue:** Works in dev, broken in production.

**Common Causes:**

1. **Dynamic classes** - Add to safelist
2. **Missing builds** - Run `bun run build` locally to test
3. **CSS code splitting** - Disable with `cssCodeSplit: false`
4. **Tree shaking** - Ensure classes are statically extractable

**Debug Tip:**

```bash
# Generate CSS to inspect
bunx unocss "src/**/*.svelte" -o uno-output.css
```

## HMR Not Updating

**Issue:** Changes to `uno.config.ts` don't reflect.

**Solution:** Restart dev server after config changes.

```bash
# Stop and restart
bun run dev
```

## TypeScript Errors in Config

**Issue:** TypeScript complains about config options.

**Solution:** Use `defineConfig` for type safety:

```typescript
import { defineConfig } from 'unocss';

export default defineConfig({
  // Full autocomplete here
});
```
