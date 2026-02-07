# Resizable

Custom resizable panel components for creating split layouts with draggable dividers.

## Components

- **ResizablePaneGroup** - Container for resizable panels
- **ResizablePane** - Individual resizable panel
- **ResizableHandle** - Draggable divider between panels

## Quick Start

```svelte
<script>
  import { ResizablePaneGroup, ResizablePane, ResizableHandle } from '$lib/components/primitives';
</script>

<ResizablePaneGroup direction="horizontal">
  <ResizablePane defaultSize={50}>
    <div>Left panel</div>
  </ResizablePane>

  <ResizableHandle withHandle={true} />

  <ResizablePane defaultSize={50}>
    <div>Right panel</div>
  </ResizablePane>
</ResizablePaneGroup>
```

## Props

### ResizablePaneGroup

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `direction` | `'horizontal' \| 'vertical'` | `'horizontal'` | Split direction |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Snippet` | - | Child components |

### ResizablePane

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `defaultSize` | `number` | `50` | Initial size percentage (0-100) |
| `minSize` | `number` | `10` | Minimum size percentage |
| `maxSize` | `number` | `90` | Maximum size percentage |
| `collapsible` | `boolean` | `false` | Allow pane to collapse to 0 |
| `class` | `string` | - | Additional CSS classes |
| `children` | `Snippet` | - | Panel content |

### ResizableHandle

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `withHandle` | `boolean` | `false` | Show visual grip indicator |
| `class` | `string` | - | Additional CSS classes |

## Examples

### Horizontal Split

```svelte
<ResizablePaneGroup direction="horizontal">
  <ResizablePane defaultSize={30} minSize={20} maxSize={50}>
    <nav>Sidebar</nav>
  </ResizablePane>

  <ResizableHandle withHandle={true} />

  <ResizablePane defaultSize={70}>
    <main>Content</main>
  </ResizablePane>
</ResizablePaneGroup>
```

### Vertical Split

```svelte
<ResizablePaneGroup direction="vertical">
  <ResizablePane defaultSize={60}>
    <div>Top content</div>
  </ResizablePane>

  <ResizableHandle withHandle={true} />

  <ResizablePane defaultSize={40}>
    <div>Bottom content</div>
  </ResizablePane>
</ResizablePaneGroup>
```

### Three-Panel Layout

```svelte
<ResizablePaneGroup direction="horizontal">
  <ResizablePane defaultSize={20}>
    <nav>Navigation</nav>
  </ResizablePane>

  <ResizableHandle withHandle={true} />

  <ResizablePane defaultSize={60}>
    <main>Content</main>
  </ResizablePane>

  <ResizableHandle withHandle={true} />

  <ResizablePane defaultSize={20}>
    <aside>Inspector</aside>
  </ResizablePane>
</ResizablePaneGroup>
```

## Accessibility

- **Keyboard Support**: Focus handle with Tab, resize with Arrow keys (5% per keystroke)
- **ARIA**: `role="separator"` and `aria-orientation` on handles
- **Visual Feedback**: Cursor changes, hover states, focus rings

## Implementation Notes

This is a visual-only implementation. The drag handlers are functional but currently log to console rather than updating pane sizes. For production use, consider:

- Integrating a library like `paneforge` for full resize functionality
- Adding state persistence to localStorage
- Implementing collapse/expand animations
- Adding touch/mobile gesture support

## CVA Variants

The component uses class-variance-authority for styling:

- `resizablePaneGroupVariants` - Container with flex direction
- `resizablePaneVariants` - Pane with overflow and transitions
- `resizableHandleVariants` - Handle with cursor, hover states, and direction variants

## Design Tokens

Uses standard Velociraptor design tokens:
- `--color-border` - Default handle background
- `--color-primary` - Active/hover states
- `--duration-fast` - Transition timing
- `--color-fg` - Grip indicator dots
