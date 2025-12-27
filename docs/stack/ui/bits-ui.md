# Bits UI

Headless component library. Accessible, Svelte-native, unstyled.

## Why Bits UI

| Aspect | Bits UI | Melt UI | shadcn-svelte |
|--------|---------|---------|---------------|
| Type | Headless | Headless | Styled |
| Accessibility | Full | Full | Full |
| Styling | Bring your own | Bring your own | Tailwind |
| Bundle | Small | Small | Larger |
| Svelte 5 | Yes | Yes | Yes |

Bits UI wins: accessible primitives, minimal footprint, full styling control.

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| Components | **Bits UI** | Accessible, Svelte-native |
| Styling | **UnoCSS** | Utility classes |
| Icons | **Iconify** | Via UnoCSS preset-icons |

## Philosophy

Headless UI provides behavior and accessibility. You provide styling.

- **Unstyled by default** (no CSS conflicts)
- **ARIA-compliant** (keyboard, screen readers)
- **Composable** (build complex from simple)
- **Svelte-native** (not a port)

## Available Components

| Category | Components |
|----------|------------|
| Overlay | Dialog, Popover, Tooltip, Dropdown |
| Form | Select, Checkbox, Radio, Switch, Slider |
| Navigation | Tabs, Accordion, Menu |
| Feedback | Alert, Toast |
| Layout | Collapsible, Separator |

## Usage Pattern

```svelte
<script>
  import { Dialog } from 'bits-ui';
</script>

<Dialog.Root>
  <Dialog.Trigger class="btn">Open</Dialog.Trigger>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50" />
    <Dialog.Content class="dialog-content">
      <Dialog.Title>Title</Dialog.Title>
      <Dialog.Description>Description</Dialog.Description>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

## Related

- [unocss.md](./unocss.md) - Styling
- [../forms/superforms.md](../forms/superforms.md) - Form handling
- [../../blueprint/ui/](../../blueprint/ui/) - Component examples
