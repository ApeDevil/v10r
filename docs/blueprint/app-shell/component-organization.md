# Component Organization

Rules for organizing components using the **Atomic Design** pattern: atoms → molecules → organisms → templates.

---

## Atomic Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ATOMS           MOLECULES        ORGANISMS        TEMPLATES    │
│  primitives/     ui/              composites/      shell/       │
│                                                                 │
│  ┌───┐           ┌─────────┐      ┌───────────┐   ┌──────────┐ │
│  │ ○ │  Button   │ ○ Label │      │ Form      │   │ AppShell │ │
│  └───┘           │ ─────── │      │ ┌───────┐ │   │ ┌──────┐ │ │
│                  │ [     ] │      │ │ Field │ │   │ │ Side │ │ │
│  ┌───┐           └─────────┘      │ │ Field │ │   │ │ bar  │ │ │
│  │───│  Input    FormField        │ │ [Btn] │ │   │ └──────┘ │ │
│  └───┘                            │ └───────┘ │   │ ┌──────┐ │ │
│                  ┌─────────┐      └───────────┘   │ │ Main │ │ │
│  ┌───┐           │ < 1 2 > │      ProfileForm     │ └──────┘ │ │
│  │ A │  Avatar   └─────────┘                      └──────────┘ │
│  └───┘           Pagination                                    │
└─────────────────────────────────────────────────────────────────┘
```

| Level | Directory | Description | Examples |
|-------|-----------|-------------|----------|
| **Atoms** | `primitives/` | Smallest building blocks. Single purpose, no composition. | Button, Input, Badge, Avatar, Icon |
| **Molecules** | `ui/` | Atoms combined into functional units. Still generic, no business logic. | FormField, Pagination, EmptyState, Skeleton |
| **Organisms** | `composites/` | Molecules + atoms forming distinct features. May have business logic. | QuickSearch, ProfileForm, NotificationCard |
| **Templates** | `shell/` | Page-level layout structure. Singletons that define the app skeleton. | AppShell, Sidebar, Footer |

---

## Directory Structure

```
src/lib/components/
├── primitives/            # Atoms: indivisible UI elements
│   ├── button/
│   ├── input/
│   ├── badge/
│   ├── avatar/
│   ├── checkbox/
│   ├── select/
│   ├── dialog/
│   ├── drawer/
│   ├── dropdown-menu/
│   ├── tabs/
│   ├── tooltip/
│   ├── popover/
│   └── table/
├── ui/                    # Molecules: composed generic patterns
│   ├── form-field/
│   ├── pagination/
│   ├── skeleton/
│   ├── empty-state/
│   ├── card/
│   ├── alert/
│   └── confirm-dialog/
├── composites/            # Organisms: feature-scoped components
│   ├── quick-search/
│   ├── chatbot/
│   ├── page-header/
│   ├── notifications/
│   ├── account/
│   ├── settings/
│   └── toast/
└── shell/                 # Templates: app skeleton (singletons)
    ├── AppShell.svelte
    ├── Sidebar.svelte
    ├── Footer.svelte
    └── ...
```

---

## Decision Rules

### Use `primitives/` (Atoms) When:

| Criterion | Example |
|-----------|---------|
| **Indivisible** - Cannot be broken down further without losing meaning | `Button`, `Input`, `Icon` |
| **Single purpose** - Does exactly one thing | `Checkbox`, `Badge`, `Avatar` |
| **No composition** - Doesn't combine other components | `Select`, `Tooltip` |
| **Framework wrapper** - Wraps Bits UI or native elements | `Dialog`, `Drawer`, `Tabs` |

### Use `ui/` (Molecules) When:

| Criterion | Example |
|-----------|---------|
| **Composed of atoms** - Combines 2+ primitives into a unit | `FormField` (Label + Input + Error) |
| **Generic pattern** - Reusable across many features | `Pagination`, `EmptyState` |
| **No business logic** - Pure UI composition | `Skeleton`, `Card` |
| **Layout helper** - Arranges content in a specific way | `Alert`, `ConfirmDialog` |

### Use `composites/` (Organisms) When:

| Criterion | Example |
|-----------|---------|
| **Feature-scoped** - Belongs to a specific domain | `QuickSearch`, `ProfileForm` |
| **Has business logic** - Contains feature-specific behavior | `NotificationCard`, `ChatMessage` |
| **Multi-instance** - Can appear multiple times | `SettingsCard`, `SessionCard` |
| **Modal/overlay** - Opens over content | `QuickSearch`, `Chatbot` |

### Use `shell/` (Templates) When:

| Criterion | Example |
|-----------|---------|
| **Singleton** - Only one instance in the app | `Sidebar`, `Footer` |
| **Layout structure** - Defines app skeleton | `AppShell`, `SidebarRail` |
| **Always visible** - Present on every page | `UserMenu`, `NavigationProgress` |
| **Root-level** - Instantiated in root layout | `ToastContainer`, `SessionMonitor` |

---

## Shell Components

Components that define the app shell structure (singletons):

```
src/lib/components/shell/
├── AppShell.svelte           # Main wrapper
├── Sidebar.svelte            # Sidebar container
├── SidebarRail.svelte        # Desktop collapsed state
├── SidebarDrawer.svelte      # Mobile full drawer
├── SidebarFab.svelte         # Mobile trigger button
├── SidebarLogo.svelte        # Logo in sidebar header
├── SidebarNav.svelte         # Navigation container
├── SidebarTriggers.svelte    # QuickSearch + AI trigger buttons
├── NavItem.svelte            # Single nav item (compound)
├── NavDropdown.svelte        # Dropdown submenu
├── UserMenu.svelte           # User avatar + dropdown
├── Footer.svelte             # App footer
├── ToastContainer.svelte     # Toast notifications renderer
├── NavigationProgress.svelte # Page load progress bar
├── ShortcutsModal.svelte     # Keyboard shortcuts help
├── SessionMonitor.svelte     # Session expiry detection
└── session/
    ├── SessionWarningBanner.svelte
    └── SessionExpiryModal.svelte
```

**Key characteristic:** Instantiated once in the root layout.

---

## Primitive Components (Atoms)

Indivisible UI building blocks:

```
src/lib/components/primitives/
├── button/Button.svelte      # Click actions
├── input/Input.svelte        # Text entry
├── badge/Badge.svelte        # Status indicators
├── avatar/Avatar.svelte      # User images
├── checkbox/Checkbox.svelte  # Boolean toggle
├── select/Select.svelte      # Option picker
├── dialog/Dialog.svelte      # Modal container
├── drawer/Drawer.svelte      # Slide-out panel
├── dropdown-menu/            # Context menus
├── tabs/Tabs.svelte          # Tab navigation
├── tooltip/Tooltip.svelte    # Hover hints
├── popover/Popover.svelte    # Click popovers
├── table/Table.svelte        # Data tables
└── combobox/Combobox.svelte  # Searchable select
```

**Key characteristic:** Cannot be broken down further. Wrap Bits UI primitives.

---

## UI Components (Molecules)

Composed generic patterns:

```
src/lib/components/ui/
├── form-field/FormField.svelte   # Label + Input + Error
├── pagination/Pagination.svelte  # Page navigation
├── skeleton/
│   ├── Skeleton.svelte           # Loading placeholder
│   ├── SkeletonText.svelte       # Text placeholder
│   ├── SkeletonCard.svelte       # Card placeholder
│   └── SkeletonAvatar.svelte     # Avatar placeholder
├── empty-state/EmptyState.svelte # No content state
├── card/Card.svelte              # Content container
├── alert/Alert.svelte            # Feedback message
└── confirm-dialog/ConfirmDialog.svelte  # Action confirmation
```

**Key characteristic:** Combines atoms into reusable units. No business logic.

---

## Composite Components (Organisms)

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
├── toast/
│   ├── Toaster.svelte            # Toast display logic
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

**Key characteristic:** Feature-scoped, may have business logic, can have multiple instances.

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

Each directory exports its public API:

```typescript
// src/lib/components/primitives/button/index.ts
export { default as Button } from './Button.svelte';

// src/lib/components/ui/form-field/index.ts
export { default as FormField } from './FormField.svelte';

// src/lib/components/composites/quick-search/index.ts
export { default as QuickSearch } from './QuickSearch.svelte';
export { default as QuickSearchTrigger } from './QuickSearchTrigger.svelte';
// Internal components not exported (QuickSearchItem is used only by QuickSearch)
```

---

## Import Patterns

```typescript
// ✅ Good: Import atoms from primitives
import { Button, Input, Avatar } from '$lib/components/primitives';

// ✅ Good: Import molecules from ui
import { FormField, Pagination, EmptyState } from '$lib/components/ui';

// ✅ Good: Import organisms from composites
import { QuickSearch, QuickSearchTrigger } from '$lib/components/composites/quick-search';

// ✅ Good: Import templates from shell
import { Sidebar, UserMenu, Footer } from '$lib/components/shell';

// ❌ Bad: Deep imports into component internals
import QuickSearchItem from '$lib/components/composites/quick-search/QuickSearchItem.svelte';

// ❌ Bad: Importing atom when you need molecule
import { Input } from '$lib/components/primitives';  // Use FormField instead for forms
```

---

## Component Promotion Flow

Components can be promoted up the hierarchy as they mature:

```
primitives/ → ui/ → composites/
   (atom)    (molecule)  (organism)

Example: A generic Card starts as a molecule in ui/
         If it gains feature-specific logic, it becomes an organism
         and moves to composites/
```

**Never demote:** Once a component has business logic, don't move it back to `ui/` or `primitives/`.

---

## When to Create a New Directory

### New primitive (atom):
- Wrapping a new Bits UI component
- Creating a new indivisible element

### New ui component (molecule):
- Combining 2+ atoms into a reusable pattern
- No feature-specific logic

### New composite directory (organism):
1. **3+ related components** - Group them together
2. **Shared internal state** - Components share context or stores
3. **Clear feature boundary** - Components belong to a distinct domain

Don't create a directory for single components with no relationships.

---

## Edge Cases

### Toast Architecture

| Component | Location | Role |
|-----------|----------|------|
| `ToastContainer.svelte` | `shell/` | Singleton renderer in root layout |
| `Toaster.svelte` | `composites/toast/` | Display logic and animations |

The shell component (`ToastContainer`) imports and renders the composite (`Toaster`).

### QuickSearch Trigger

**Where:** `composites/quick-search/QuickSearchTrigger.svelte`
**Why not shell?** The trigger is logically part of the QuickSearch feature. The sidebar imports it.

### User Menu

**Where:** `shell/UserMenu.svelte`
**Why not composites?** It's a singleton always in the sidebar footer. Part of the template.

### Notification Badge

**Where:** `composites/notifications/NotificationBadge.svelte`
**Why not shell?** The badge belongs to the notification feature. The sidebar imports it.

---

## Related

- [./layout.md](./layout.md) - Shell structure
- [../design/components.md](../design/components.md) - Component specifications
