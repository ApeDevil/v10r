# Keyboard Shortcuts

Central registry for all keyboard shortcuts in the app shell. Enables discoverability, conflict resolution, and accessibility.

---

## Shortcut Registry

### Global Shortcuts (Always Active)

| Shortcut | Action | Component |
|----------|--------|-----------|
| `⌘K` / `Ctrl+K` | Open QuickSearch | QuickSearch |
| `⌘J` / `Ctrl+J` | Open AI Assistant | AI Assistant |
| `?` | Open keyboard shortcuts help | ShortcutsModal |
| `Escape` | Close current modal/overlay | Global |

### Navigation Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `G` then `H` | Go to Home/Dashboard | Global |
| `G` then `S` | Go to Settings | Global |
| `G` then `N` | Go to Notifications | Global |
| `G` then `P` | Go to Profile | Global |

### QuickSearch Shortcuts (When Open)

| Shortcut | Action |
|----------|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted item |
| `Tab` | Cycle through categories |
| `Escape` | Close QuickSearch |

### AI Assistant Shortcuts (When Open)

| Shortcut | Action |
|----------|--------|
| `Enter` | Send message |
| `Shift+Enter` | New line |
| `⌘↑` / `Ctrl+↑` | Previous message (edit) |
| `Escape` | Close AI Assistant |

### Form Shortcuts

| Shortcut | Action | Context |
|----------|--------|---------|
| `⌘S` / `Ctrl+S` | Save form | When form is focused |
| `⌘Enter` / `Ctrl+Enter` | Submit form | When form is focused |
| `Escape` | Cancel/close form modal | In modal forms |

---

## Shortcuts Help Modal

Triggered by pressing `?` from anywhere in the app. Shows all available shortcuts organized by category.

### Wireframe

```
┌─────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                     [✕]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ General                                                     │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⌘K        Open QuickSearch                              ││
│ │ ⌘J        Open AI Assistant                             ││
│ │ ?         Show this help                                ││
│ │ Esc       Close modal/overlay                           ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Navigation                                                  │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ G H       Go to Home                                    ││
│ │ G S       Go to Settings                                ││
│ │ G N       Go to Notifications                           ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ Forms                                                       │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ ⌘S        Save form                                     ││
│ │ ⌘Enter    Submit form                                   ││
│ └─────────────────────────────────────────────────────────┘│
│                                                             │
│ ☐ Show shortcuts on startup                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Implementation

### Shortcut Registry

```typescript
// src/lib/shortcuts/registry.ts
export interface Shortcut {
  id: string;
  keys: string[];           // ['meta', 'k'] or ['g', 'h']
  label: string;
  description: string;
  category: 'general' | 'navigation' | 'forms' | 'search' | 'ai';
  action: () => void;
  when?: () => boolean;     // Context predicate
  preventDefault?: boolean;
}

const shortcuts = new Map<string, Shortcut>();

export function registerShortcut(shortcut: Shortcut) {
  const key = shortcut.keys.join('+');

  // Check for conflicts
  if (shortcuts.has(key)) {
    console.warn(`Shortcut conflict: ${key} already registered`);
  }

  shortcuts.set(key, shortcut);
  return () => shortcuts.delete(key); // Unregister function
}

export function getShortcuts(): Shortcut[] {
  return [...shortcuts.values()];
}

export function getShortcutsByCategory(): Record<string, Shortcut[]> {
  const byCategory: Record<string, Shortcut[]> = {};

  for (const shortcut of shortcuts.values()) {
    if (!byCategory[shortcut.category]) {
      byCategory[shortcut.category] = [];
    }
    byCategory[shortcut.category].push(shortcut);
  }

  return byCategory;
}
```

### Keyboard Handler

```typescript
// src/lib/shortcuts/handler.ts
import { browser } from '$app/environment';

let sequenceBuffer: string[] = [];
let sequenceTimeout: ReturnType<typeof setTimeout>;

export function initKeyboardHandler() {
  if (!browser) return;

  document.addEventListener('keydown', handleKeydown);

  return () => {
    document.removeEventListener('keydown', handleKeydown);
  };
}

function handleKeydown(event: KeyboardEvent) {
  // Ignore if user is typing in an input
  if (isTypingContext(event.target)) {
    // Allow specific shortcuts even in inputs
    if (!isAllowedInInput(event)) return;
  }

  const key = normalizeKey(event);

  // Handle sequence shortcuts (G then H)
  if (sequenceBuffer.length > 0 || key === 'g') {
    handleSequence(key, event);
    return;
  }

  // Handle direct shortcuts
  handleDirect(event);
}

function isTypingContext(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  const isEditable = target.isContentEditable;
  const isInput = ['input', 'textarea', 'select'].includes(tagName);

  return isInput || isEditable;
}

function isAllowedInInput(event: KeyboardEvent): boolean {
  // Allow Escape, Cmd+K, Cmd+J even in inputs
  if (event.key === 'Escape') return true;
  if ((event.metaKey || event.ctrlKey) && ['k', 'j'].includes(event.key.toLowerCase())) {
    return true;
  }
  return false;
}

function handleSequence(key: string, event: KeyboardEvent) {
  clearTimeout(sequenceTimeout);
  sequenceBuffer.push(key);

  // Find matching shortcut
  const sequenceKey = sequenceBuffer.join('+');
  const shortcut = shortcuts.get(sequenceKey);

  if (shortcut) {
    if (!shortcut.when || shortcut.when()) {
      event.preventDefault();
      shortcut.action();
    }
    sequenceBuffer = [];
    return;
  }

  // Reset after timeout (500ms between keys)
  sequenceTimeout = setTimeout(() => {
    sequenceBuffer = [];
  }, 500);
}

function handleDirect(event: KeyboardEvent) {
  const keys: string[] = [];

  if (event.metaKey) keys.push('meta');
  if (event.ctrlKey) keys.push('ctrl');
  if (event.altKey) keys.push('alt');
  if (event.shiftKey) keys.push('shift');
  keys.push(event.key.toLowerCase());

  const key = keys.join('+');
  const shortcut = shortcuts.get(key);

  if (shortcut && (!shortcut.when || shortcut.when())) {
    if (shortcut.preventDefault !== false) {
      event.preventDefault();
    }
    shortcut.action();
  }
}

function normalizeKey(event: KeyboardEvent): string {
  return event.key.toLowerCase();
}
```

### Shell Integration

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { initKeyboardHandler, registerShortcut } from '$lib/shortcuts';
  import { ShortcutsModal } from '$lib/components/shell';

  let showShortcuts = $state(false);
  let showQuickSearch = $state(false);
  let showAiAssistant = $state(false);

  onMount(() => {
    const cleanup = initKeyboardHandler();

    // Register global shortcuts
    registerShortcut({
      id: 'quick-search',
      keys: ['meta', 'k'],
      label: '⌘K',
      description: 'Open QuickSearch',
      category: 'general',
      action: () => { showQuickSearch = true; },
    });

    registerShortcut({
      id: 'ai-assistant',
      keys: ['meta', 'j'],
      label: '⌘J',
      description: 'Open AI Assistant',
      category: 'general',
      action: () => { showAiAssistant = true; },
    });

    registerShortcut({
      id: 'shortcuts-help',
      keys: ['?'],
      label: '?',
      description: 'Show keyboard shortcuts',
      category: 'general',
      action: () => { showShortcuts = true; },
      when: () => !showQuickSearch && !showAiAssistant, // Only when no modal open
    });

    registerShortcut({
      id: 'go-home',
      keys: ['g', 'h'],
      label: 'G H',
      description: 'Go to Home',
      category: 'navigation',
      action: () => goto('/app/dashboard'),
    });

    registerShortcut({
      id: 'go-settings',
      keys: ['g', 's'],
      label: 'G S',
      description: 'Go to Settings',
      category: 'navigation',
      action: () => goto('/app/settings'),
    });

    return cleanup;
  });
</script>

<ShortcutsModal bind:open={showShortcuts} />
```

### Shortcuts Modal Component

```svelte
<!-- src/lib/components/shell/ShortcutsModal.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';
  import { getShortcutsByCategory } from '$lib/shortcuts';

  let { open = $bindable(false) } = $props();

  const categories = $derived(getShortcutsByCategory());

  const categoryLabels: Record<string, string> = {
    general: 'General',
    navigation: 'Navigation',
    forms: 'Forms',
    search: 'Search',
    ai: 'AI Assistant',
  };
</script>

<Dialog.Root bind:open>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 z-modal-overlay" />
    <Dialog.Content class="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:max-w-lg md:w-full bg-surface rounded-lg shadow-xl z-modal overflow-hidden">
      <div class="flex items-center justify-between p-4 border-b">
        <Dialog.Title class="text-lg font-semibold">
          Keyboard Shortcuts
        </Dialog.Title>
        <Dialog.Close class="btn-icon">
          <span class="i-lucide-x" />
        </Dialog.Close>
      </div>

      <div class="p-4 max-h-[60vh] overflow-y-auto space-y-6">
        {#each Object.entries(categories) as [category, shortcuts]}
          <div>
            <h3 class="text-sm font-medium text-muted mb-2">
              {categoryLabels[category] ?? category}
            </h3>
            <div class="space-y-1">
              {#each shortcuts as shortcut}
                <div class="flex items-center justify-between py-1.5">
                  <span class="text-sm">{shortcut.description}</span>
                  <kbd class="shortcut-key">{shortcut.label}</kbd>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>

      <div class="p-4 border-t bg-muted/30">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" class="checkbox" />
          Show shortcuts on startup
        </label>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>

<style>
  .shortcut-key {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    padding: 0.25rem 0.5rem;
    background: var(--color-muted);
    border-radius: 0.25rem;
    border: 1px solid var(--color-border);
  }
</style>
```

---

## Conflict Resolution

### Priority Rules

1. **Modal shortcuts** take precedence when modal is open
2. **Input context** disables most shortcuts (except Escape, ⌘K, ⌘J)
3. **Component-specific** shortcuts only active when component is mounted
4. **Sequence shortcuts** (G+H) have lower priority than direct shortcuts

### Handling Conflicts

```typescript
// When registering, check for conflicts
export function registerShortcut(shortcut: Shortcut) {
  const key = shortcut.keys.join('+');

  const existing = shortcuts.get(key);
  if (existing) {
    // Option 1: Warn and override
    console.warn(`Shortcut ${key} replaced: ${existing.id} -> ${shortcut.id}`);

    // Option 2: Context-based coexistence
    // Both can exist if their `when` predicates don't overlap
  }

  shortcuts.set(key, shortcut);
}
```

---

## Platform Detection

Display platform-appropriate symbols:

```typescript
// src/lib/shortcuts/platform.ts
import { browser } from '$app/environment';

export function isMac(): boolean {
  if (!browser) return false;
  return navigator.platform.toLowerCase().includes('mac');
}

export function formatShortcut(keys: string[]): string {
  const mac = isMac();

  return keys.map(key => {
    switch (key) {
      case 'meta': return mac ? '⌘' : 'Ctrl';
      case 'ctrl': return mac ? '⌃' : 'Ctrl';
      case 'alt': return mac ? '⌥' : 'Alt';
      case 'shift': return mac ? '⇧' : 'Shift';
      case 'enter': return mac ? '↵' : 'Enter';
      case 'escape': return 'Esc';
      case 'arrowup': return '↑';
      case 'arrowdown': return '↓';
      default: return key.toUpperCase();
    }
  }).join(mac ? '' : '+');
}
```

---

## Discoverability

### Inline Hints

Show keyboard hints in UI elements:

```svelte
<!-- Button with shortcut hint -->
<button class="btn">
  <span class="i-lucide-search" />
  Search
  <kbd class="shortcut-hint">⌘K</kbd>
</button>

<style>
  .shortcut-hint {
    margin-left: auto;
    opacity: 0.5;
    font-size: 0.75rem;
  }
</style>
```

### Tooltip Hints

```svelte
<!-- Tooltip showing shortcut -->
<Tooltip.Root>
  <Tooltip.Trigger>
    <button class="btn-icon">
      <span class="i-lucide-settings" />
    </button>
  </Tooltip.Trigger>
  <Tooltip.Content>
    Settings <kbd>G S</kbd>
  </Tooltip.Content>
</Tooltip.Root>
```

### First-Run Overlay

For new users, show a brief overlay highlighting key shortcuts:

```svelte
{#if showFirstRunHints}
  <div class="fixed inset-0 bg-black/70 z-overlay">
    <div class="absolute top-4 right-4 text-white">
      <p>Press <kbd>⌘K</kbd> to search</p>
      <p>Press <kbd>⌘J</kbd> for AI help</p>
      <p>Press <kbd>?</kbd> for all shortcuts</p>
      <button onclick={() => showFirstRunHints = false}>Got it</button>
    </div>
  </div>
{/if}
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Screen reader | Announce shortcut when focused |
| Settings | Option to disable all shortcuts |
| Documentation | `aria-keyshortcuts` attribute on elements |
| Alternative | All actions accessible via mouse/touch |

```svelte
<!-- Accessible button with shortcut -->
<button
  aria-keyshortcuts="Control+k"
  aria-label="Search (Control+K)"
>
  Search
</button>
```

### Disable Shortcuts Setting

```typescript
// Check user preference before executing
function handleKeydown(event: KeyboardEvent) {
  if (!userSettings.enableKeyboardShortcuts) return;
  // ... rest of handler
}
```

---

## Component Location

```
src/lib/
├── shortcuts/
│   ├── registry.ts       # Shortcut registration
│   ├── handler.ts        # Keyboard event handling
│   ├── platform.ts       # Platform detection
│   └── index.ts          # Exports
└── components/
    └── shell/
        └── ShortcutsModal.svelte
```

---

## Related

- [./quick-search.md](./quick-search.md) - QuickSearch modal
- [./ai-assistant.md](./ai-assistant.md) - AI Assistant modal
- [./settings.md](./settings.md) - Enable/disable shortcuts setting
- [./layout.md](./layout.md) - Shell integration
