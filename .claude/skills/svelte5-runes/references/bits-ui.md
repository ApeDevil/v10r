# Bits UI

Headless component library. Uses snippets for render delegation. Style with data attributes.

## Contents

- [Dialog](#dialog) - Modal dialogs with Portal
- [Dropdown Menu](#dropdown-menu) - Trigger, items, separators
- [Select](#select) - Single select with options
- [Tabs](#tabs) - Tab navigation
- [Switch](#switch) - Toggle switches
- [Checkbox](#checkbox) - Checkbox with custom indicator
- [Tooltip](#tooltip) - Hover tooltips
- [Accordion](#accordion) - Collapsible sections
- [Data Attributes](#data-attributes) - State-based styling

## Dialog

```svelte
<script lang="ts">
  import { Dialog } from 'bits-ui';
  let open = $state(false);
</script>

<Dialog.Root bind:open>
  <Dialog.Trigger>
    {#snippet child({ props })}
      <button {...props}>Open</button>
    {/snippet}
  </Dialog.Trigger>

  <Dialog.Portal>
    <Dialog.Overlay class="overlay" />
    <Dialog.Content class="content">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
      <Dialog.Close>Close</Dialog.Close>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  :global(.overlay) { position: fixed; inset: 0; background: rgba(0,0,0,0.5); }
  :global(.content) { position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%); }
</style>
```

## Dropdown Menu

```svelte
<script lang="ts">
  import { DropdownMenu } from 'bits-ui';
</script>

<DropdownMenu.Root>
  <DropdownMenu.Trigger>
    {#snippet child({ props })}<button {...props}>Menu</button>{/snippet}
  </DropdownMenu.Trigger>

  <DropdownMenu.Portal>
    <DropdownMenu.Content>
      <DropdownMenu.Label>Settings</DropdownMenu.Label>
      <DropdownMenu.Separator />
      <DropdownMenu.Item onclick={() => console.log('Profile')}>Profile</DropdownMenu.Item>
      <DropdownMenu.Item onclick={() => console.log('Settings')}>Settings</DropdownMenu.Item>
    </DropdownMenu.Content>
  </DropdownMenu.Portal>
</DropdownMenu.Root>
```

## Select

```svelte
<script lang="ts">
  import { Select } from 'bits-ui';

  let options = [
    { value: 'apple', label: 'Apple' },
    { value: 'banana', label: 'Banana' }
  ];

  let selected = $state(undefined);
</script>

<Select.Root bind:selected type="single">
  <Select.Trigger>{selected?.label ?? 'Select...'}</Select.Trigger>

  <Select.Portal>
    <Select.Content>
      {#each options as option}
        <Select.Item value={option.value} label={option.label}>
          {#snippet children({ selected })}
            {#if selected}✓{/if} {option.label}
          {/snippet}
        </Select.Item>
      {/each}
    </Select.Content>
  </Select.Portal>
</Select.Root>
```

## Tabs

```svelte
<script lang="ts">
  import { Tabs } from 'bits-ui';
  let activeTab = $state('account');
</script>

<Tabs.Root bind:value={activeTab}>
  <Tabs.List>
    <Tabs.Trigger value="account">Account</Tabs.Trigger>
    <Tabs.Trigger value="password">Password</Tabs.Trigger>
  </Tabs.List>

  <Tabs.Content value="account"><h3>Account</h3></Tabs.Content>
  <Tabs.Content value="password"><h3>Password</h3></Tabs.Content>
</Tabs.Root>

<style>
  :global([data-state="active"]) { border-bottom: 2px solid blue; }
</style>
```

## Switch

```svelte
<script lang="ts">
  import { Switch } from 'bits-ui';
  let enabled = $state(false);
</script>

<Switch.Root bind:checked={enabled} class="switch">
  <Switch.Thumb class="thumb" />
</Switch.Root>

<style>
  :global(.switch) { width: 2.5rem; height: 1.5rem; background: #ddd; border-radius: 9999px; }
  :global(.switch[data-state="checked"]) { background: blue; }
  :global(.thumb) { width: 1.25rem; height: 1.25rem; background: white; border-radius: 9999px; }
  :global(.switch[data-state="checked"] .thumb) { transform: translateX(1rem); }
</style>
```

## Checkbox

```svelte
<script lang="ts">
  import { Checkbox } from 'bits-ui';
  let checked = $state(false);
</script>

<Checkbox.Root bind:checked>
  {#snippet children({ checked })}
    {#if checked}✓{/if}
  {/snippet}
</Checkbox.Root>
```

## Tooltip

```svelte
<script lang="ts">
  import { Tooltip } from 'bits-ui';
</script>

<Tooltip.Root>
  <Tooltip.Trigger>
    {#snippet child({ props })}<button {...props}>Hover</button>{/snippet}
  </Tooltip.Trigger>

  <Tooltip.Portal>
    <Tooltip.Content class="tooltip">
      Helpful info
      <Tooltip.Arrow />
    </Tooltip.Content>
  </Tooltip.Portal>
</Tooltip.Root>

<style>
  :global(.tooltip) { background: #333; color: white; padding: 0.5rem; border-radius: 0.25rem; }
</style>
```

## Accordion

```svelte
<script lang="ts">
  import { Accordion } from 'bits-ui';

  let items = [
    { value: '1', title: 'What is Svelte?', content: 'A compiler...' },
    { value: '2', title: 'What are runes?', content: 'Symbols...' }
  ];
</script>

<Accordion.Root type="single" collapsible>
  {#each items as item}
    <Accordion.Item value={item.value}>
      <Accordion.Trigger>{item.title}</Accordion.Trigger>
      <Accordion.Content>{item.content}</Accordion.Content>
    </Accordion.Item>
  {/each}
</Accordion.Root>

<style>
  :global([data-state="open"] .icon) { transform: rotate(180deg); }
  :global([data-state="closed"]) { display: none; }
</style>
```

## Data Attributes

Bits UI exposes component state via data attributes:

| Attribute | Values | Components |
|-----------|--------|------------|
| `data-state` | `open`, `closed` | Dialog, Dropdown, Accordion |
| `data-state` | `checked`, `unchecked` | Checkbox, Switch |
| `data-state` | `active`, `inactive` | Tabs |
| `data-highlighted` | (present) | Menu items when focused |
| `data-disabled` | (present) | Disabled elements |

```css
.dialog[data-state="open"] { animation: fadeIn 0.2s; }
.item[data-highlighted] { background: #f3f4f6; }
button[data-disabled] { opacity: 0.5; cursor: not-allowed; }
```
