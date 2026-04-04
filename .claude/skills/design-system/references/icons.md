# Icon Sizing

Consistent icon sizes across Velociraptor.

## Size Tokens

| Token | Size | Rem | Context |
|-------|------|-----|---------|
| `icon-sm` | 16px | 1rem | Inline text, small buttons, dense UI |
| `icon-md` | 20px | 1.25rem | Form inputs, triggers, medium buttons |
| `icon-lg` | 24px | 1.5rem | Navigation, standard buttons, most common |
| `icon-xl` | 32px | 2rem | Section headers, decorative, hero |

## Usage

### With UnoCSS Icons

```svelte
<!-- Standard navigation icon -->
<span class="i-lucide-home text-icon-lg"></span>

<!-- Small icon in button -->
<button class="px-3 py-1 flex items-center gap-2">
  <span class="i-lucide-plus text-icon-sm"></span>
  Add
</button>

<!-- Input prefix icon -->
<div class="relative">
  <span class="i-lucide-search text-icon-md absolute left-3 top-1/2 -translate-y-1/2"></span>
  <input class="pl-10 ..." />
</div>
```

### With Icon Components

```svelte
<script>
  import { Home, Plus, Search } from 'lucide-svelte';
</script>

<!-- Size via class -->
<Home class="text-icon-lg" />

<!-- Or via size prop if component supports it -->
<Home size={24} />
```

## Context-Specific Sizing

### Navigation

| Element | Size | Token |
|---------|------|-------|
| Sidebar nav item | 24px | `text-icon-lg` |
| Mobile nav | 24px | `text-icon-lg` |
| Breadcrumb separator | 16px | `text-icon-sm` |

### Buttons

| Button Size | Icon Size | Token |
|-------------|-----------|-------|
| Small (`px-3 py-1`) | 16px | `text-icon-sm` |
| Default (`px-4 py-2`) | 20px | `text-icon-md` |
| Large (`px-6 py-3`) | 24px | `text-icon-lg` |

### Forms

| Element | Size | Token |
|---------|------|-------|
| Input prefix/suffix | 20px | `text-icon-md` |
| Select chevron | 16px | `text-icon-sm` |
| Validation icon | 16px | `text-icon-sm` |
| Clear button | 16px | `text-icon-sm` |

### Content

| Element | Size | Token |
|---------|------|-------|
| Inline with text | 16px | `text-icon-sm` |
| List item bullet | 16px | `text-icon-sm` |
| Alert/toast icon | 20px | `text-icon-md` |
| Empty state | 32px+ | `text-icon-xl` or larger |

## Implementation

### tokens.ts

```typescript
export const iconSize = {
  'icon-sm': '1rem',      // 16px
  'icon-md': '1.25rem',   // 20px
  'icon-lg': '1.5rem',    // 24px
  'icon-xl': '2rem',      // 32px
} as const;
```

### uno.config.ts

```typescript
theme: {
  fontSize: {
    'icon-sm': '1rem',
    'icon-md': '1.25rem',
    'icon-lg': '1.5rem',
    'icon-xl': '2rem',
  },
},
safelist: [
  'text-icon-sm',
  'text-icon-md',
  'text-icon-lg',
  'text-icon-xl',
],
```

## Anti-Patterns

### Arbitrary Sizes

```svelte
<!-- NEVER -->
<span class="i-lucide-home text-[1.75rem]"></span>
<span class="i-lucide-home text-[22px]"></span>

<!-- ALWAYS -->
<span class="i-lucide-home text-icon-lg"></span>
```

### Inconsistent Sizing

```svelte
<!-- WRONG: Different sizes in same context -->
<nav>
  <a><span class="i-lucide-home text-[1.5rem]"></span> Home</a>
  <a><span class="i-lucide-settings text-[1.25rem]"></span> Settings</a>
</nav>

<!-- RIGHT: Consistent token -->
<nav>
  <a><span class="i-lucide-home text-icon-lg"></span> Home</a>
  <a><span class="i-lucide-settings text-icon-lg"></span> Settings</a>
</nav>
```

### Missing Alignment

```svelte
<!-- Icons can shift baseline -->
<button class="flex items-center gap-2">
  <span class="i-lucide-plus text-icon-sm"></span>
  <span>Add Item</span>
</button>
```

Always use `flex items-center` when combining icons with text.

## Safelist Rule

Icons used in JS data structures (`icon: 'i-lucide-...'` in objects, arrays, props) **must** be added to the `safelist` in `uno.config.ts`. UnoCSS cannot extract class names from JS data at build time. Without safelisting, icons render as invisible zero-width spans. Static icon classes in Svelte templates are extracted automatically and do not need safelisting. See `docs/stack/ui/unocss.md` for details.

## Icon + Text Spacing

| Context | Gap |
|---------|-----|
| Button icon + label | `gap-2` |
| Nav icon + label | `gap-3` |
| List icon + text | `gap-2` |
| Badge icon + count | `gap-1` |

```svelte
<button class="flex items-center gap-2">
  <span class="i-lucide-download text-icon-sm"></span>
  Download
</button>

<a class="flex items-center gap-3">
  <span class="i-lucide-home text-icon-lg"></span>
  <span>Home</span>
</a>
```
