# Accordion Component Usage

An accessible, animated accordion component built with Bits UI and CVA variants.

## Basic Usage

### Simple String Content

```svelte
<script lang="ts">
  import { Accordion } from '$lib/components/primitives';

  let value = $state('item-1');

  const items = [
    {
      value: 'item-1',
      title: 'Is it accessible?',
      content: 'Yes. It adheres to the WAI-ARIA design pattern.'
    },
    {
      value: 'item-2',
      title: 'Is it styled?',
      content: 'Yes. It uses design tokens from app.css for theming.'
    },
    {
      value: 'item-3',
      title: 'Is it animated?',
      content: 'Yes. It uses CSS animations for smooth expand/collapse.'
    }
  ];
</script>

<Accordion {items} bind:value />
```

## Advanced Usage

### Multiple Open Items

```svelte
<script lang="ts">
  import { Accordion } from '$lib/components/primitives';

  let value = $state(['item-1', 'item-2']);

  const items = [
    { value: 'item-1', title: 'Item 1', content: 'Content 1' },
    { value: 'item-2', title: 'Item 2', content: 'Content 2' },
    { value: 'item-3', title: 'Item 3', content: 'Content 3' }
  ];
</script>

<Accordion type="multiple" {items} bind:value />
```

### Snippet Content

```svelte
<script lang="ts">
  import { Accordion } from '$lib/components/primitives';

  let value = $state('');

  const items = [
    {
      value: 'item-1',
      title: 'Rich Content',
      content: () => {
        return {
          render() {
            return `
              <div class="space-y-2">
                <p>This is <strong>rich content</strong> with:</p>
                <ul class="list-disc pl-5">
                  <li>Formatted text</li>
                  <li>Lists</li>
                  <li>Any HTML/components</li>
                </ul>
              </div>
            `;
          }
        };
      }
    }
  ];
</script>

<Accordion {items} bind:value />
```

### With Svelte 5 Snippets

```svelte
<script lang="ts">
  import { Accordion } from '$lib/components/primitives';

  let value = $state('');
</script>

<Accordion
  {value}
  items={[
    {
      value: 'item-1',
      title: 'First Item',
      content: () => {
        return {
          #snippet content() {
            <div>
              <p class="font-semibold">Rich snippet content</p>
              <button class="mt-2 px-3 py-1 bg-primary text-white rounded">
                Click me
              </button>
            </div>
          }
        };
      }
    }
  ]}
/>
```

## Variants

### Default (Borderless)

```svelte
<Accordion {items} bind:value />
```

### Bordered

```svelte
<Accordion {items} bind:value variant="bordered" />
```

### Filled

```svelte
<Accordion {items} bind:value variant="filled" />
```

## Sizes

```svelte
<!-- Small -->
<Accordion {items} bind:value size="sm" />

<!-- Medium (default) -->
<Accordion {items} bind:value size="md" />

<!-- Large -->
<Accordion {items} bind:value size="lg" />
```

## Disabled Items

```svelte
<script lang="ts">
  const items = [
    { value: 'item-1', title: 'Enabled', content: 'This is enabled' },
    { value: 'item-2', title: 'Disabled', content: 'This is disabled', disabled: true }
  ];
</script>

<Accordion {items} bind:value />
```

## Non-collapsible (always one open)

```svelte
<Accordion {items} bind:value collapsible={false} />
```

This ensures at least one item is always open when using `type="single"`.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `type` | `'single' \| 'multiple'` | `'single'` | Single allows one open at a time, multiple allows many |
| `value` | `string \| string[]` | `''` or `[]` | Current value(s) - bindable |
| `items` | `AccordionItem[]` | required | Array of items with value, title, content, disabled |
| `variant` | `'default' \| 'bordered' \| 'filled'` | `'default'` | Visual style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Size of text and padding |
| `class` | `string` | `undefined` | Additional CSS classes for root |
| `collapsible` | `boolean` | `true` | Allow closing the active item (single only) |

## AccordionItem Type

```typescript
interface AccordionItem {
  value: string;           // Unique identifier
  title: string;           // Header text
  content: string | Snippet; // Content (string or Svelte snippet)
  disabled?: boolean;      // Disable this item
}
```

## Accessibility

- Full keyboard navigation (Tab, Enter, Space, Arrow keys)
- ARIA attributes handled by Bits UI
- Focus management
- Screen reader support
- Respects `prefers-reduced-motion`

## Animation

The accordion uses CSS animations with design tokens:
- Duration: `var(--duration-normal)` (250ms)
- Easing: `var(--ease-out)`
- Animates height using Bits UI's content height variable
- Chevron rotates 180deg when open

## Design Tokens Used

From `app.css`:
- `--color-fg`, `--color-muted`, `--color-border`
- `--color-primary`
- `--color-subtle` (filled variant)
- `--text-fluid-*` (responsive text sizing)
- `--duration-normal`, `--ease-out`
- `--spacing-*`
- `--radius-*`
