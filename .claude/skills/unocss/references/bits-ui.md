# Bits UI with UnoCSS

Styling patterns for Bits UI headless components.

## Contents

- [Overview](#overview)
- [Installation](#installation)
- [Basic Pattern](#basic-pattern)
- [Component Examples](#component-examples) - Accordion, Dialog, Select, Tabs, Tooltip
- [Data Attribute Styling](#data-attribute-styling) - In class strings, style blocks, common attributes
- [CSS Variables](#css-variables) - Select width, Popover positioning
- [Animation Patterns](#animation-patterns) - Fade, Scale + Fade
- [Reusable Shortcuts](#reusable-shortcuts) - Buttons, inputs, cards, dialog, select
- [Accessibility](#accessibility) - Focus management, keyboard navigation
- [Dark Mode](#dark-mode) - Consistent dark variants

## Overview

Bits UI provides **unstyled, accessible** components. Apply UnoCSS classes directly - no style conflicts to fight.

## Installation

```bash
bun add bits-ui
```

## Basic Pattern

Apply classes directly to Bits UI components:

```svelte
<script>
  import { Button } from 'bits-ui';
</script>

<Button.Root class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</Button.Root>
```

## Component Examples

### Accordion

```svelte
<script>
  import { Accordion } from 'bits-ui';

  const items = [
    { id: '1', title: 'Section 1', content: 'Content 1' },
    { id: '2', title: 'Section 2', content: 'Content 2' },
  ];
</script>

<Accordion.Root class="w-full space-y-2">
  {#each items as item}
    <Accordion.Item value={item.id} class="border rounded-lg overflow-hidden">
      <Accordion.Trigger
        class="w-full px-4 py-3 flex justify-between items-center
               bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700
               font-medium text-left"
      >
        {item.title}
        <span class="i-mdi-chevron-down transition-transform duration-200
                     [[data-state=open]_&]:rotate-180"></span>
      </Accordion.Trigger>
      <Accordion.Content class="px-4 py-3 bg-white dark:bg-gray-900">
        {item.content}
      </Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>
```

### Dialog

```svelte
<script>
  import { Dialog } from 'bits-ui';
</script>

<Dialog.Root>
  <Dialog.Trigger class="btn btn-primary">
    Open Dialog
  </Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm" />
    <Dialog.Content
      class="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
             w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl"
    >
      <Dialog.Title class="text-xl font-bold mb-4">
        Dialog Title
      </Dialog.Title>
      <Dialog.Description class="text-gray-600 dark:text-gray-300 mb-6">
        Dialog description text here.
      </Dialog.Description>
      <div class="flex justify-end gap-3">
        <Dialog.Close class="btn btn-secondary">Cancel</Dialog.Close>
        <button class="btn btn-primary">Confirm</button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

### Select

```svelte
<script>
  import { Select } from 'bits-ui';

  const options = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' },
    { value: 'cherry', label: 'Cherry' },
  ];
</script>

<Select.Root>
  <Select.Trigger
    class="w-64 px-3 py-2 flex items-center justify-between
           border rounded-lg bg-white dark:bg-gray-800
           hover:border-gray-400 focus:ring-2 focus:ring-primary"
  >
    <Select.Value placeholder="Select a fruit" />
    <span class="i-mdi-chevron-down"></span>
  </Select.Trigger>
  <Select.Content
    class="w-[var(--bits-select-anchor-width)] mt-1 p-1
           bg-white dark:bg-gray-800 border rounded-lg shadow-lg"
  >
    {#each options as option}
      <Select.Item
        value={option.value}
        class="px-3 py-2 rounded cursor-pointer
               hover:bg-gray-100 dark:hover:bg-gray-700
               data-[highlighted]:bg-gray-100 dark:data-[highlighted]:bg-gray-700"
      >
        {option.label}
      </Select.Item>
    {/each}
  </Select.Content>
</Select.Root>
```

### Tabs

```svelte
<script>
  import { Tabs } from 'bits-ui';
</script>

<Tabs.Root value="tab1" class="w-full">
  <Tabs.List class="flex border-b">
    <Tabs.Trigger
      value="tab1"
      class="px-4 py-2 border-b-2 border-transparent
             data-[state=active]:border-primary data-[state=active]:text-primary"
    >
      Tab 1
    </Tabs.Trigger>
    <Tabs.Trigger
      value="tab2"
      class="px-4 py-2 border-b-2 border-transparent
             data-[state=active]:border-primary data-[state=active]:text-primary"
    >
      Tab 2
    </Tabs.Trigger>
  </Tabs.List>
  <Tabs.Content value="tab1" class="p-4">
    Content for tab 1
  </Tabs.Content>
  <Tabs.Content value="tab2" class="p-4">
    Content for tab 2
  </Tabs.Content>
</Tabs.Root>
```

### Tooltip

```svelte
<script>
  import { Tooltip } from 'bits-ui';
</script>

<Tooltip.Root>
  <Tooltip.Trigger class="btn btn-secondary">
    Hover me
  </Tooltip.Trigger>
  <Tooltip.Content
    class="px-3 py-2 bg-gray-900 text-white text-sm rounded shadow-lg"
    sideOffset={5}
  >
    Tooltip content
    <Tooltip.Arrow class="fill-gray-900" />
  </Tooltip.Content>
</Tooltip.Root>
```

## Data Attribute Styling

Bits UI exposes state via data attributes. Target them with UnoCSS:

### In Class Strings

```svelte
<!-- Using attribute selectors in class -->
<Accordion.Trigger
  class="[[data-state=open]_&]:bg-blue-100"
>
```

### In Style Blocks

```svelte
<style>
  :global([data-accordion-trigger]) {
    @apply w-full px-4 py-3 text-left;
  }

  :global([data-accordion-trigger][data-state="open"]) {
    @apply bg-blue-100 font-bold;
  }

  :global([data-accordion-content][data-state="closed"]) {
    @apply hidden;
  }
</style>
```

### Common Data Attributes

| Component | Attribute | Values |
|-----------|-----------|--------|
| Accordion | `data-state` | `open`, `closed` |
| Dialog | `data-state` | `open`, `closed` |
| Select Item | `data-highlighted` | present when highlighted |
| Select Item | `data-selected` | present when selected |
| Checkbox | `data-state` | `checked`, `unchecked`, `indeterminate` |
| Switch | `data-state` | `checked`, `unchecked` |
| Tabs Trigger | `data-state` | `active`, `inactive` |

## CSS Variables

Bits UI exposes useful CSS variables:

### Select Width Matching

```svelte
<Select.Content class="w-[var(--bits-select-anchor-width)]">
  <!-- Content matches trigger width -->
</Select.Content>
```

### Popover Positioning

```svelte
<Popover.Content class="max-h-[var(--bits-popover-available-height)]">
  <!-- Respects viewport bounds -->
</Popover.Content>
```

## Animation Patterns

### Fade In/Out

```svelte
<Dialog.Overlay
  class="fixed inset-0 bg-black/50
         data-[state=open]:animate-fade-in
         data-[state=closed]:animate-fade-out"
/>
```

Add to uno.config.ts:

```typescript
theme: {
  animation: {
    keyframes: {
      'fade-in': '{ from { opacity: 0 } to { opacity: 1 } }',
      'fade-out': '{ from { opacity: 1 } to { opacity: 0 } }',
    },
    durations: {
      'fade-in': '150ms',
      'fade-out': '150ms',
    },
  },
},
```

### Scale + Fade

```svelte
<Dialog.Content
  class="data-[state=open]:animate-dialog-in
         data-[state=closed]:animate-dialog-out"
/>
```

```typescript
theme: {
  animation: {
    keyframes: {
      'dialog-in': '{ from { opacity: 0; transform: translate(-50%, -50%) scale(0.95) } to { opacity: 1; transform: translate(-50%, -50%) scale(1) } }',
      'dialog-out': '{ from { opacity: 1; transform: translate(-50%, -50%) scale(1) } to { opacity: 0; transform: translate(-50%, -50%) scale(0.95) } }',
    },
  },
},
```

## Reusable Shortcuts

Define component shortcuts in uno.config.ts:

```typescript
shortcuts: {
  // Buttons
  'btn': 'px-4 py-2 rounded font-medium transition-colors',
  'btn-primary': 'btn bg-primary text-white hover:bg-primary-dark',
  'btn-secondary': 'btn bg-gray-200 text-gray-800 hover:bg-gray-300',
  'btn-ghost': 'btn hover:bg-gray-100 dark:hover:bg-gray-800',

  // Inputs
  'input': 'w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent',

  // Cards
  'card': 'bg-white dark:bg-gray-800 rounded-lg shadow-md p-6',

  // Dialog
  'dialog-overlay': 'fixed inset-0 bg-black/50 backdrop-blur-sm',
  'dialog-content': 'fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-lg shadow-xl',

  // Select
  'select-trigger': 'w-full px-3 py-2 flex items-center justify-between border rounded-lg hover:border-gray-400',
  'select-content': 'mt-1 p-1 bg-white dark:bg-gray-800 border rounded-lg shadow-lg',
  'select-item': 'px-3 py-2 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700',
}
```

Usage:

```svelte
<Dialog.Content class="dialog-content">
<Select.Trigger class="select-trigger">
<Select.Item class="select-item">
```

## Accessibility

Bits UI handles accessibility automatically:
- Focus management
- ARIA attributes
- Keyboard navigation

Your job is just visual styling:

```svelte
<!-- Focus ring for keyboard users -->
<Button.Root class="... focus:ring-2 focus:ring-primary focus:ring-offset-2">

<!-- Visible focus indicator -->
<Select.Trigger class="... focus-visible:ring-2 focus-visible:ring-primary">
```

## Dark Mode

Apply dark variants consistently:

```svelte
<Dialog.Content
  class="bg-white dark:bg-gray-800
         text-gray-900 dark:text-gray-100
         border border-gray-200 dark:border-gray-700"
>
```
