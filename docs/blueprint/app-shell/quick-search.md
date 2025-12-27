# QuickSearch

Global navigation and search via keyboard shortcut or sidebar trigger.

---

## Why "QuickSearch"?

"Command palette" comes from code editors where you execute commands ("Format Document"). Our use case is primarily **navigation and search**, so we use the simpler, more descriptive name "QuickSearch".

---

## Trigger Locations

| Location | Element | Behavior |
|----------|---------|----------|
| **Sidebar header** | Search input (visual) | Click opens QuickSearch |
| **Keyboard** | `⌘K` / `Ctrl+K` | Opens QuickSearch from anywhere |
| **Mobile FAB** | Optional 🔍 button | Opens QuickSearch |

---

## QuickSearch Modal

```
┌─────────────────────────────────────────────┐
│  🔍 [Search pages, actions...]              │  ← Actual input
├─────────────────────────────────────────────┤
│  Recent                                     │
│  ├── 📊 Dashboard                           │
│  ├── ⚙️ Settings                            │
│  └── 📁 Project Alpha                       │
├─────────────────────────────────────────────┤
│  Pages                                      │
│  ├── 🏠 Home                                │
│  ├── 📊 Dashboard                           │
│  └── 📁 Projects                            │
├─────────────────────────────────────────────┤
│  Actions                                    │
│  ├── ➕ Create new project                  │
│  ├── 🚪 Sign out                            │
│  └── 🎨 Toggle theme                        │
└─────────────────────────────────────────────┘
```

---

## Search Categories

| Category | Content | Example |
|----------|---------|---------|
| **Recent** | Recently visited pages | Dashboard, Settings |
| **Pages** | All navigable routes | /projects, /settings |
| **Actions** | Quick actions | Create project, Sign out, Toggle theme |

---

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `↑` / `↓` | Navigate results |
| `Enter` | Select highlighted item |
| `Escape` | Close QuickSearch |
| `⌘K` / `Ctrl+K` | Open QuickSearch (global) |

---

## Action Safety

Actions in QuickSearch can be destructive (Sign out) or state-changing (Toggle theme). Handle with care.

### Action Categories

| Category | Behavior | Examples |
|----------|----------|----------|
| **Navigation** | Immediate, no confirmation | Go to Dashboard, Open Settings |
| **Toggle** | Immediate, reversible | Toggle theme, Toggle sidebar |
| **Destructive** | Requires confirmation | Sign out, Delete project |

### Confirmation Pattern

For destructive actions, show inline confirmation before executing:

```
┌─────────────────────────────────────────────┐
│  🔍 [sign out_______________________]        │
├─────────────────────────────────────────────┤
│  Actions                                     │
│  ├── 🚪 Sign out                            │
│  │   ┌─────────────────────────────────┐   │
│  │   │ Sign out of your account?       │   │
│  │   │ [Cancel]  [Sign out]            │   │
│  │   └─────────────────────────────────┘   │
│  └── ...                                    │
└─────────────────────────────────────────────┘
```

### Implementation

```svelte
<script lang="ts">
  import type { QuickSearchItem } from './types';

  let { item, onSelect } = $props<{
    item: QuickSearchItem;
    onSelect: () => void;
  }>();

  let confirming = $state(false);

  function handleSelect() {
    if (item.requiresConfirmation && !confirming) {
      confirming = true;
      return;
    }
    onSelect();
  }

  function cancel() {
    confirming = false;
  }
</script>

<div class="quick-search-item" class:confirming>
  {#if confirming}
    <div class="confirmation">
      <p>{item.confirmationMessage ?? `${item.label}?`}</p>
      <div class="actions">
        <button onclick={cancel}>Cancel</button>
        <button onclick={onSelect} class="destructive">
          {item.confirmationAction ?? item.label}
        </button>
      </div>
    </div>
  {:else}
    <button onclick={handleSelect}>
      <span class={item.icon} />
      {item.label}
    </button>
  {/if}
</div>
```

### Action Type Definition

```typescript
interface QuickSearchItem {
  id: string;
  type: 'page' | 'action';
  label: string;
  icon: string;
  action: () => void | Promise<void>;

  // For destructive actions
  requiresConfirmation?: boolean;
  confirmationMessage?: string;
  confirmationAction?: string; // Button text, defaults to label
}

// Example actions
const actions: QuickSearchItem[] = [
  {
    id: 'theme-toggle',
    type: 'action',
    label: 'Toggle theme',
    icon: 'i-lucide-sun-moon',
    action: () => theme.toggle(),
    // No confirmation - reversible
  },
  {
    id: 'sign-out',
    type: 'action',
    label: 'Sign out',
    icon: 'i-lucide-log-out',
    action: () => signOut(),
    requiresConfirmation: true,
    confirmationMessage: 'Sign out of your account?',
    confirmationAction: 'Sign out',
  },
];
```

---

## Component Location

QuickSearch is a **composite component** (see [../design/components.md](../design/components.md#quicksearch)):

```
src/lib/components/
├── composites/
│   └── quick-search/
│       ├── QuickSearch.svelte         # Modal + search logic
│       ├── QuickSearchTrigger.svelte  # Sidebar trigger (fake input)
│       ├── QuickSearchItem.svelte     # Result item
│       └── index.ts
```
