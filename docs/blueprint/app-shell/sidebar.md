# Sidebar

The sidebar is the primary navigation element, adapting responsively for desktop and mobile.

---

## Responsive Behavior

The sidebar adapts asymmetrically for ergonomics:

| Viewport | Position | Behavior |
|----------|----------|----------|
| **Desktop** | Left | Persistent rail, expands on hover |
| **Mobile** | Right | Off-canvas drawer, thumb-accessible |

### Desktop: Rail + Expand

```
Collapsed (Rail):          Expanded (Hover):
┌────┬─────────────┐       ┌──────────┬─────────────┐
│ 🏠 │             │       │ 🏠 Home  │             │
│ 📊 │   Content   │  →    │ 📊 Stats │   Content   │
│ ⚙️ │             │       │ ⚙️ Settings            │
└────┴─────────────┘       └──────────┴─────────────┘
  56px                        240px
```

Dimensions from [../design/tokens.md](../design/tokens.md#sidebar):
- **Rail width:** `--sidebar-rail-width` — 56px is the SSR default; at runtime it is derived from the expanded width by `railWidth()`/`itemSize()`/`iconSize()` in `state/sidebar.svelte.ts` and set on `documentElement`.
- **Expanded width:** `--sidebar-expanded-width` — user-configurable 160–320px (default 240px).
- **Trigger:** Hover or click to pin open
- **Position:** Left side (LTR reading flow)

### Mobile: Right-Side Drawer

```
Closed:                    Open:
┌─────────────────┐        ┌─────────────┬─────┐
│                 │        │             │     │
│     Content     │   →    │   Overlay   │ Nav │
│                 │        │   (dimmed)  │     │
│             [⚙] │        │             │     │
└─────────────────┘        └─────────────┴─────┘
           FAB                          Drawer
```

- **Position:** Right side (thumb-friendly for right-handed users)
- **Trigger:** Floating Action Button (FAB) in bottom-right corner
- **Animation:** Slides in from right
- **Overlay:** Dimmed backdrop, tap to close
- **Drawer width:** `--sidebar-mobile-width` = min(320px, 85vw) — see [../design/tokens.md](../design/tokens.md#sidebar)

---

## FAB Trigger

```
┌─────────────────────────┐
│                         │
│                         │
│                         │
│                     ┌──┐│
│                     │☰ ││  ← 56x56px, 16px from edges
│                     └──┘│
└─────────────────────────┘
```

- **Size:** 56x56px (Material Design standard)
- **Position:** Fixed, bottom-right, 16px margin
- **Icon:** Hamburger (☰) when closed, X when open
- **Z-index:** Above content, below drawer

---

## Sidebar Anatomy

The sidebar is divided into three zones:

```
┌──────────────────────┐
│  🦖 Logo             │  ← Header: Branding
│  🔍 Search...    ⌘K  │  ← Search trigger (opens Quick Search)
│  💬 Ask AI...    ⌘J  │  ← AI trigger (opens AI Assistant)
├──────────────────────┤
│  🏠 Dashboard        │
│  📁 Projects      ▼  │  ← Body: Navigation
│  📊 Analytics        │
│  ⚙️ Settings      ▼  │
│                      │
│                      │
│      (flexible)      │
│                      │
├──────────────────────┤
│  ┌────┐              │
│  │ JD │ John Doe     │  ← Footer: User menu
│  └────┘ john@ex.com  │
└──────────────────────┘
```

### Zones

| Zone | Content | Behavior |
|------|---------|----------|
| **Header** | Logo/branding | Fixed, always visible |
| **Body** | Navigation items | Scrollable if overflow |
| **Footer** | User avatar + menu | Fixed, always visible |

### Header Triggers

The sidebar header contains triggers for both Quick Search and AI Assistant, adapting to sidebar state:

```
Rail (56px):              Expanded (240px):
┌────┐                    ┌──────────────────────┐
│ 🦖 │                    │  🦖 Velociraptor     │
│ 🔍 │ ← icon only        │  🔍 Search...    ⌘K  │ ← styled as input
│ 💬 │ ← icon only        │  💬 Ask AI...    ⌘J  │ ← styled as input
├────┤                    ├──────────────────────┤
```

- **Rail mode**: Search icon button, click opens Quick Search
- **Expanded mode**: Fake input (styled like Input but not editable), shows `⌘K` hint
- **Both**: Clicking opens Quick Search

---

## User Menu

The user menu sits at the bottom of the sidebar, anchored to the viewport:

```
┌────────────────────────────┐
│  ┌────┐                    │
│  │ AV │  Display Name    ▼ │  ← Dropdown trigger
│  └────┘  email@example     │
└────────────────────────────┘
```

- **Avatar:** 32-40px, initials or image
- **Name:** Truncated if too long
- **Email:** Muted, smaller text
- **Dropdown:** Account, preferences, logout

### User Menu Dropdown

```
┌────────────────────────┐
│  👤 Profile            │
│  🎨 Theme: Dark    ▸   │  ← Submenu for theme
│  ───────────────────   │
│  🚪 Sign out           │
└────────────────────────┘
```

Side submenus (▸) are anchored flyouts on the **rail only** (`data-elevation="3"`,
8px offset). In the mobile drawer the menu itself is a **static surface pinned to
the bottom-left screen edge** (`ContentStatic`, plain fixed CSS — clear of the
right-anchored drawer), and Theme/Language open a second static panel **stacked
on top of it**, staggered 8px right / 12px up, with a back row as the touch
dismissal. Elevation strata: drawer E1 → menu E2 → panel E3. The drawer, each
open menu, and the stacked panel register in the layer-stack singleton
(`$lib/state/layer-stack.svelte.ts`), so Escape/overlay-click peel exactly one
layer at a time — the panel stops Bits UI's escape-defer chain with
`escapeKeydownBehavior="close"`. See the elevation ladder in
[design/tokens.md](../design/tokens.md).

**Sign out** does not act immediately — it opens a destructive `ConfirmDialog`
(itself registered as a `confirm-dialog` layer, so on mobile Escape peels the
dialog before the drawer).
