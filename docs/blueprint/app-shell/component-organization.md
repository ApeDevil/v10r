# Component Organization

Rules for organizing components using the **Atomic Design** pattern: atoms → molecules → organisms → templates.

---

## Atomic Design Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  ATOMS           MOLECULES + ORGANISMS            TEMPLATES     │
│  primitives/     composites/                      shell/        │
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
| **Atoms** | `primitives/` | Smallest building blocks. Single purpose, no composition. | Button, Input, Badge, Avatar, Skeleton |
| **Molecules + Organisms** | `composites/` | Atoms combined into functional units, up to feature-scoped components with business logic. | FormField, Pagination, EmptyState, CommandPalette, ProfileForm |
| **Standalone widgets** | `ui/` | A few widgets that don't fit the primitive/composite split. | ContrastBadge, OklchColorInput |
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
│   ├── skeleton/
│   └── table/
├── ui/                    # Small home for a few standalone widgets
│   ├── ContrastBadge.svelte
│   └── OklchColorInput.svelte
├── composites/            # Molecules + organisms: composed components
│   ├── form-field/
│   ├── pagination/
│   ├── empty-state/
│   ├── card/
│   ├── alert/
│   ├── confirm-dialog/
│   ├── command-palette/
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

### Use `composites/` (Molecules + Organisms) When:

| Criterion | Example |
|-----------|---------|
| **Composed of atoms** - Combines 2+ primitives into a unit | `FormField` (Label + Input + Error) |
| **Generic pattern** - Reusable across many features | `Pagination`, `EmptyState`, `Card` |
| **Feature-scoped** - Belongs to a specific domain | `CommandPalette`, `ProfileForm` |
| **Has business logic** - Contains feature-specific behavior | `NotificationCard`, `ChatMessage` |
| **Modal/overlay** - Opens over content | `CommandPalette` |

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
├── SidebarTriggers.svelte    # Quick Search + Vely trigger (state-aware: open-or-restore)
├── VelyMinimizedBubble.svelte # Mobile floating restore bubble for a minimized chat
├── NavItem.svelte            # Single nav item (compound)
├── NavLink.svelte            # Single nav link
├── NavFlyout.svelte          # Desktop hover flyout submenu
├── NavAccordion.svelte       # Expand/collapse submenu
├── UserMenu.svelte           # User avatar + dropdown
├── Footer.svelte             # App footer
├── NavigationProgress.svelte # Page load progress bar
├── ShortcutsModal.svelte     # Keyboard shortcuts help
└── session/
    ├── SessionMonitor.svelte         # Session expiry detection
    ├── SessionWarningBanner.svelte
    └── SessionExpiryModal.svelte
```

`ToastContainer` is re-exported through `shell/index.ts` but lives in `composites/toast/`.

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
├── combobox/Combobox.svelte  # Searchable select
└── skeleton/
    ├── Skeleton.svelte       # Loading placeholder
    ├── SkeletonText.svelte   # Text placeholder
    ├── SkeletonCard.svelte   # Card placeholder
    └── SkeletonAvatar.svelte # Avatar placeholder
```

**Key characteristic:** Cannot be broken down further. Wrap Bits UI primitives.

---

## UI Components

A small home for a few standalone widgets that don't fit the primitive/composite split:

```
src/lib/components/ui/
├── ContrastBadge.svelte    # WCAG contrast indicator
└── OklchColorInput.svelte  # OKLCH color picker input
```

The composed molecule layer (form-field, pagination, empty-state, card, alert, confirm-dialog) lives under `composites/`, and the skeleton placeholders live under `primitives/skeleton/`.

---

## Composite Components (Organisms)

Feature-scoped composed components:

```
src/lib/components/composites/
├── form-field/FormField.svelte   # Label + Input + Error
├── pagination/Pagination.svelte  # Page navigation
├── empty-state/EmptyState.svelte # No content state
├── card/Card.svelte              # Content container
├── alert/Alert.svelte            # Feedback message
├── confirm-dialog/ConfirmDialog.svelte  # Action confirmation
├── command-palette/
│   ├── CommandPalette.svelte     # Modal + grouped result list
│   ├── command-palette.ts        # CVA variants
│   ├── types.ts                  # CommandPaletteItem, CommandPaletteItemType
│   └── index.ts
├── chatbot/
│   ├── Chatbot.svelte            # Non-modal docked panel; projects the chatbot-session singleton
│   ├── ChatMessage.svelte        # Message bubble
│   ├── ChatInput.svelte          # Input + send
│   ├── PlanCard.svelte           # Plan/proposal card
│   ├── ToolCallStatus.svelte     # Tool-call status row
│   ├── harness-types.ts          # Shared chat harness types
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
| `{Feature}.svelte` | Main component | `CommandPalette.svelte` |
| `{Feature}Triggers.svelte` | Button/link that opens it | `SidebarTriggers.svelte` |
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

// src/lib/components/composites/form-field/index.ts
export { default as FormField } from './FormField.svelte';

// src/lib/components/composites/command-palette/index.ts
export { default as CommandPalette } from './CommandPalette.svelte';
export type { CommandPaletteItem } from './types';
// CVA variant functions also exported (commandPaletteContentVariants, etc.)
```

---

## Import Patterns

```typescript
// ✅ Good: Import atoms from primitives
import { Button, Input, Avatar } from '$lib/components/primitives';

// ✅ Good: Import molecules and organisms from composites
import { FormField, Pagination, EmptyState } from '$lib/components/composites';
import { CommandPalette } from '$lib/components/composites/command-palette';

// ✅ Good: Import templates from shell
import { Sidebar, UserMenu, Footer } from '$lib/components/shell';

// ❌ Bad: Deep imports into component internals
import CommandPalette from '$lib/components/composites/command-palette/CommandPalette.svelte';

// ❌ Bad: Importing atom when you need molecule
import { Input } from '$lib/components/primitives';  // Use FormField instead for forms
```

---

## Component Promotion Flow

Components can be promoted up the hierarchy as they mature:

```
primitives/ → composites/
   (atom)    (molecule → organism)

Example: A generic Card starts as a molecule in composites/
         If it gains feature-specific logic, it stays in composites/
         and grows into an organism
```

**Never demote:** Once a component has business logic, don't move it back to `primitives/`.

---

## When to Create a New Directory

### New primitive (atom):
- Wrapping a new Bits UI component
- Creating a new indivisible element

### New composite directory (molecule or organism):
- Combining 2+ atoms into a reusable pattern, or
- A feature-scoped component, when:
1. **3+ related components** - Group them together
2. **Shared internal state** - Components share context or stores
3. **Clear feature boundary** - Components belong to a distinct domain

Don't create a directory for single components with no relationships.

---

## Edge Cases

### Toast Architecture

| Component | Location | Role |
|-----------|----------|------|
| `ToastContainer.svelte` | `composites/toast/` | Singleton renderer in root layout |
| `Toaster.svelte` | `composites/toast/` | Alternate display variant |

Both live in `composites/toast/`. `shell/index.ts` re-exports `ToastContainer` so the root layout can import it from `$lib/components/shell` — there is no `shell/ToastContainer.svelte` file.

### Quick Search Trigger

**Where:** `shell/SidebarTriggers.svelte`
**Why shell?** The trigger is a singleton always present in the sidebar, adapting between rail (icon) and expanded (fake-input) states. It calls `modals.open('quickSearch')` directly — no separate composites file exists for it.

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
