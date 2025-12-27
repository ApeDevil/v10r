# UnoCSS

Atomic CSS engine. On-demand generation, smaller than Tailwind.

## Why UnoCSS

| Aspect | UnoCSS | Tailwind CSS |
|--------|--------|--------------|
| Generation | On-demand | Full scan |
| Bundle Size | Only used classes | Purged but larger |
| Customization | Presets, rules | Config file |
| Speed | Fastest | Fast |
| Tailwind Compat | Full (via preset) | N/A |

UnoCSS wins: on-demand generation, smaller bundles, fully customizable.

## Stack Integration

| Layer | Technology | Why |
|-------|------------|-----|
| CSS Engine | **UnoCSS** | On-demand, smaller than Tailwind |
| Preset | **preset-wind** | Tailwind-compatible utilities |
| Icons | **preset-icons** | Iconify integration |
| Typography | **preset-typography** | Prose styling |

## Key Features

- **On-demand** (generates only used classes)
- **Tailwind-compatible** (use familiar classes)
- **Attributify mode** (cleaner markup)
- **Icons as classes** (`i-lucide-home`)
- **Shortcuts** (define reusable class groups)

## Philosophy

Utility-first CSS, custom design tokens, no library bloat.

```html
<!-- Standard utilities -->
<div class="flex items-center gap-4 p-4">

<!-- Attributify mode -->
<div flex items-center gap-4 p-4>

<!-- Icons as classes -->
<span class="i-lucide-settings w-5 h-5" />
```

## Configuration

`uno.config.ts` at project root. See [../../blueprint/ui/](../../blueprint/ui/) for configuration details.

## Related

- [bits-ui.md](./bits-ui.md) - Component library
- [images.md](./images.md) - Image optimization
- [../../blueprint/ui/](../../blueprint/ui/) - Configuration examples
