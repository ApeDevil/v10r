# Component Organization

Rules for organizing shell components: when to use `shell/` vs `composites/` vs `ui/`.

---

## Directory Structure

```
src/lib/components/
├── ui/                    # Primitives: Button, Input, Dialog, etc.
├── shell/                 # App shell structure (singleton)
└── composites/            # Composed components (reusable, multi-instance)
    ├── quick-search/
    ├── chatbot/
    ├── page-header/
    ├── notifications/
    ├── account/
    └── settings/
```

---

## Decision Rules

### Use `shell/` When:

| Criterion | Example |
|-----------|---------|
| **Singleton** - Only one instance exists in the app | `Sidebar.svelte`, `Footer.svelte` |
| **Layout structure** - Defines app skeleton | `AppShell.svelte`, `SidebarRail.svelte` |
| **Always visible** - Present on every authenticated page | `UserMenu.svelte`, `SidebarNav.svelte` |
| **Tight coupling** - Depends on app shell context | `SidebarFab.svelte` (mobile trigger) |

### Use `composites/` When:

| Criterion | Example |
|-----------|---------|
| **Multi-instance** - Can have multiple instances | `NotificationCard.svelte` |
| **Page-specific** - Used in specific routes, not globally | `ProfileForm.svelte` |
| **Modal/overlay** - Opens over content | `QuickSearch.svelte`, `Chatbot.svelte` |
| **Feature-scoped** - Belongs to a feature domain | `SettingsCard.svelte`, `SessionCard.svelte` |

### Use `ui/` When:

| Criterion | Example |
|-----------|---------|
| **Primitive** - Basic building block | `Button.svelte`, `Input.svelte` |
| **Design system** - Part of visual language | `Dialog.svelte`, `Tooltip.svelte` |
| **Highly reusable** - Used across many features | `Skeleton.svelte`, `Badge.svelte` |
| **No business logic** - Pure presentation | `Card.svelte`, `Avatar.svelte` |

---

## Shell Components

Components that define the app shell structure:

```
src/lib/components/shell/
├── AppShell.svelte           # Main wrapper
├── Sidebar.svelte            # Sidebar container
├── SidebarRail.svelte        # Desktop collapsed state
├── SidebarDrawer.svelte      # Mobile full drawer
├── SidebarFab.svelte         # Mobile trigger button
├── SidebarLogo.svelte        # Logo in sidebar header
├── SidebarNav.svelte         # Navigation container
├── NavItem.svelte            # Single nav item (compound)
├── NavDropdown.svelte        # Dropdown submenu
├── UserMenu.svelte           # User avatar + dropdown
├── Footer.svelte             # App footer
├── ToastContainer.svelte     # Toast notifications renderer
├── NavigationProgress.svelte # Page load progress bar
├── SessionMonitor.svelte     # Session expiry detection
└── session/
    ├── SessionWarningBanner.svelte
    └── SessionExpiryModal.svelte
```

**Key characteristic:** These are instantiated once in the root layout.

---

## Composite Components

Feature-scoped composed components:

```
src/lib/components/composites/
├── quick-search/
│   ├── QuickSearch.svelte        # Modal + logic
│   ├── QuickSearchTrigger.svelte # Sidebar trigger
│   ├── QuickSearchItem.svelte    # Result item
│   └── index.ts
├── chatbot/
│   ├── Chatbot.svelte            # Modal + chat logic
│   ├── ChatbotTrigger.svelte     # Sidebar trigger
│   ├── ChatMessage.svelte        # Message bubble
│   ├── ChatInput.svelte          # Input + send
│   └── index.ts
├── page-header/
│   ├── PageHeader.svelte
│   └── index.ts
├── notifications/
│   ├── NotificationCenter.svelte
│   ├── NotificationCard.svelte
│   ├── NotificationPreview.svelte
│   ├── NotificationBadge.svelte
│   └── index.ts
├── account/
│   ├── ProfileForm.svelte
│   ├── AvatarUpload.svelte
│   ├── TwoFactorSetup.svelte
│   ├── OAuthConnections.svelte
│   ├── ActiveSessions.svelte
│   ├── DataExportCard.svelte
│   └── DeleteAccountFlow.svelte
└── settings/
    ├── SettingsCard.svelte
    ├── ThemeSelector.svelte
    ├── LanguageSelector.svelte
    ├── TimezoneSelector.svelte
    ├── PrivacyToggles.svelte
    └── AccessibilityToggles.svelte
```

**Key characteristic:** Scoped to a feature, can have multiple instances.

---

## Naming Conventions

| Pattern | Use For | Example |
|---------|---------|---------|
| `{Feature}.svelte` | Main component | `QuickSearch.svelte` |
| `{Feature}Trigger.svelte` | Button/link that opens it | `ChatbotTrigger.svelte` |
| `{Feature}Item.svelte` | List item within feature | `NotificationCard.svelte` |
| `{Feature}Modal.svelte` | Modal variant | `SessionExpiryModal.svelte` |
| `{Feature}Form.svelte` | Form variant | `ProfileForm.svelte` |
| `{Feature}List.svelte` | List container | `ActiveSessions.svelte` |

---

## Index Files

Each composite directory exports its public API:

```typescript
// src/lib/components/composites/quick-search/index.ts
export { default as QuickSearch } from './QuickSearch.svelte';
export { default as QuickSearchTrigger } from './QuickSearchTrigger.svelte';

// Internal components not exported (QuickSearchItem is used only by QuickSearch)
```

---

## Import Patterns

```typescript
// ✅ Good: Import from composites index
import { QuickSearch, QuickSearchTrigger } from '$lib/components/composites/quick-search';

// ✅ Good: Import from shell (flat structure)
import { Sidebar, UserMenu, Footer } from '$lib/components/shell';

// ✅ Good: Import primitives from ui
import { Button, Dialog, Input } from '$lib/components/ui';

// ❌ Bad: Deep imports into component internals
import QuickSearchItem from '$lib/components/composites/quick-search/QuickSearchItem.svelte';
```

---

## When to Create a New Composite Directory

Create a new composite directory when:

1. **3+ related components** - If a feature has 3+ components, group them
2. **Shared internal state** - Components share context or stores
3. **Clear feature boundary** - Components belong to a distinct feature

Don't create a directory for:

- Single components (put in parent or `ui/`)
- Components with no relationship

---

## Shell vs Composite Edge Cases

### QuickSearch Trigger

**Where:** `composites/quick-search/QuickSearchTrigger.svelte`
**Why not shell?** The trigger is rendered inside the sidebar, but it's logically part of the QuickSearch feature. The sidebar imports it.

### User Menu

**Where:** `shell/UserMenu.svelte`
**Why not composites?** It's a singleton that's always in the sidebar footer. It's part of the shell structure.

### Notification Badge

**Where:** `composites/notifications/NotificationBadge.svelte`
**Why not shell?** The badge is part of the notification feature. The sidebar imports and renders it.

### Toast Container

**Where:** `shell/ToastContainer.svelte`
**Why not composites?** It's a singleton rendered once in the root layout. The toast store (`$lib/stores/toast.svelte.ts`) is separate.

---

## Moving Components

When refactoring, update imports:

```bash
# Use IDE refactoring or
find src -name "*.svelte" -exec sed -i '' 's|old/path|new/path|g' {} \;
```

Always update the index.ts exports when moving components.

---

## Related

- [./layout.md](./layout.md) - Shell structure
- [../design/components.md](../design/components.md) - Component specifications
