# Keyboard Shortcuts

Platform-aware keyboard shortcuts system with sequence support and accessibility.

## Overview

The keyboard shortcuts system provides:

- **Platform detection** - Adapts to macOS (⌘) vs other platforms (Ctrl)
- **Single key combos** - `mod+k`, `shift+?`, `escape`
- **Key sequences** - `g h` (press g, then h within 500ms)
- **Context awareness** - Ignores shortcuts when typing in inputs
- **Accessibility** - Help modal with all shortcuts
- **Type safety** - Full TypeScript support

## Architecture

```
src/lib/shortcuts/
├── platform.ts      # Platform detection (Mac vs other)
├── registry.ts      # Shortcut registration and lookup
├── handler.ts       # Keyboard event handling
└── index.ts         # Public exports
```

## Usage

### 1. Register Shortcuts

```typescript
import { registerShortcut } from '$lib/shortcuts';

// In $effect for cleanup
$effect(() => {
  const unregister = registerShortcut({
    id: 'search',
    keys: 'mod+k',              // 'mod' becomes Cmd or Ctrl
    description: 'Search anything',
    category: 'global',          // 'global' | 'navigation' | 'actions'
    action: () => modals.open('search')
  });

  return () => unregister();     // Cleanup on unmount
});
```

### 2. Key Formats

**Single combos:**
```typescript
'mod+k'       // Cmd+K (Mac) or Ctrl+K (other)
'shift+/'     // ? key
'escape'      // Escape key
'mod+shift+p' // Multiple modifiers
```

**Sequences:**
```typescript
'g h'         // Press 'g', then 'h' within 500ms
'g s'         // Press 'g', then 's'
```

### 3. Platform Detection

```typescript
import { isMac, getModifierKey, formatShortcut } from '$lib/shortcuts';

isMac()              // true on macOS
getModifierKey()     // 'Cmd' | 'Ctrl'
formatShortcut('mod+k') // '⌘K' or 'Ctrl+K'
```

### 4. Display Shortcuts

```svelte
<script>
  import { getShortcuts, formatShortcut } from '$lib/shortcuts';

  const shortcuts = getShortcuts();
</script>

{#each shortcuts as shortcut}
  <div>
    <span>{shortcut.description}</span>
    <kbd>{formatShortcut(shortcut.keys)}</kbd>
  </div>
{/each}
```

## Default Shortcuts

### Global
| Keys | Action | Description |
|------|--------|-------------|
| `Cmd/Ctrl+K` | Open QuickSearch | Search anything |
| `Cmd/Ctrl+J` | Open AI Assistant | AI help |
| `?` | Open Shortcuts Help | Show all shortcuts |
| `Esc` | Close Modal | Close current modal |

### Navigation
| Keys | Action | Description |
|------|--------|-------------|
| `g h` | Navigate Home | Go to homepage |
| `g s` | Navigate Settings | Go to settings |
| `g d` | Navigate Docs | Go to documentation |

## Implementation Details

### Keyboard Handler

The handler (`handler.ts`) listens for `keydown` events and:

1. **Ignores input elements** - Shortcuts don't fire when typing
2. **Normalizes keys** - Converts to lowercase, sorts modifiers
3. **Handles sequences** - Tracks multi-key combos with timeout
4. **Prevents defaults** - Blocks browser shortcuts when matched

### Sequence Handling

```typescript
// User presses 'g', then 'h' within 500ms
1. 'g' pressed → Start sequence, set timeout
2. 'h' pressed → Match 'g h' → Execute action
3. Timeout or different key → Reset sequence
```

### Context Safety

```typescript
// Shortcuts ignored when focused on:
- <input>
- <textarea>
- contenteditable elements

// Exception: Escape key works everywhere (for modals)
```

## Shortcuts Modal

The help modal (`ShortcutsModal.svelte`) displays all registered shortcuts grouped by category.

**Features:**
- Opens with `?` key
- Closes with `Esc` or click outside
- Shows platform-appropriate symbols
- Groups shortcuts by category
- Fully keyboard accessible

## SSR Safety

All shortcuts are initialized in `$effect`, which only runs on the client. No server-side issues.

## Accessibility

### ARIA Support
- Shortcuts help is keyboard accessible
- Screen readers announce shortcut keys
- Modal has proper `role="dialog"` and `aria-labelledby`

### Visual Indicators
- `<kbd>` elements for key display
- Platform-appropriate symbols (⌘ vs Ctrl)
- Clear descriptions for each shortcut

### Reduced Motion
- No animations when `prefers-reduced-motion` is set

## Pattern: Registering in Components

```svelte
<script lang="ts">
  import { registerShortcut } from '$lib/shortcuts';

  $effect(() => {
    const unregister1 = registerShortcut({
      id: 'feature-action',
      keys: 'mod+shift+f',
      description: 'Trigger feature',
      category: 'actions',
      action: () => doSomething()
    });

    const unregister2 = registerShortcut({
      id: 'feature-nav',
      keys: 'g f',
      description: 'Go to feature',
      category: 'navigation',
      action: () => goto('/feature')
    });

    // Cleanup both
    return () => {
      unregister1();
      unregister2();
    };
  });
</script>
```

## Testing Checklist

- [ ] Shortcuts work on macOS (⌘)
- [ ] Shortcuts work on Windows/Linux (Ctrl)
- [ ] Shortcuts ignored in input fields
- [ ] Escape works even in inputs
- [ ] Sequences work (e.g., 'g h')
- [ ] Timeout resets sequences
- [ ] Help modal opens with `?`
- [ ] Help modal closes with Escape
- [ ] All shortcuts display correctly
- [ ] Platform symbols are correct

## Integration

The keyboard handler is initialized in the root layout (`+layout.svelte`):

```svelte
<script lang="ts">
  import { initKeyboardHandler, registerShortcut } from '$lib/shortcuts';

  $effect(() => {
    const cleanup = initKeyboardHandler();

    // Register default shortcuts here...
    const unregister = registerShortcut(...);

    return () => {
      cleanup();
      unregister();
    };
  });
</script>
```

## Future Enhancements

- [ ] Shortcut conflicts detection
- [ ] User-customizable shortcuts
- [ ] Shortcut cheat sheet printable view
- [ ] Shortcut recording/macro system
- [ ] Per-route shortcut scopes
