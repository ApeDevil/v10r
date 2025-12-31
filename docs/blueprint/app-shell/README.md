# App Shell

The app shell is the persistent UI skeleton that wraps all pages. It loads instantly and remains consistent across navigation.

## Files

| File | Main Topics |
|------|-------------|
| **[layout.md](./layout.md)** | • Shell structure and component overview<br>• Breakpoints and tablet-specific patterns<br>• Focus management and skip links<br>• Breakpoint transition behavior |
| **[sidebar.md](./sidebar.md)** | • Sidebar anatomy (header/body/footer zones)<br>• Responsive behavior (desktop rail, mobile drawer)<br>• FAB trigger for mobile<br>• User menu and dropdown |
| **[navigation.md](./navigation.md)** | • Progressive disclosure pattern<br>• Compound nav buttons (split action/dropdown)<br>• Nav item states<br>• Example nav structure |
| **[quick-search.md](./quick-search.md)** | • QuickSearch modal (command palette)<br>• Action safety (confirmation for destructive)<br>• Search categories (recent, pages, actions)<br>• Keyboard navigation |
| **[ai-assistant.md](./ai-assistant.md)** | • AI chat modal<br>• Rate limiting (per-user limits)<br>• Input/output sanitization (XSS, prompt injection)<br>• Streaming and error states |
| **[page-header.md](./page-header.md)** | • Per-page header (not global)<br>• Breadcrumbs and title<br>• XSS prevention for dynamic content<br>• Sticky option |
| **[user-account.md](./user-account.md)** | • Profile editing (auto-save + Save button)<br>• Security (2FA, OAuth, sessions)<br>• GDPR data export (rate limited)<br>• Multi-step deletion with grace period |
| **[notifications.md](./notifications.md)** | • Notification center (full page)<br>• SSE security (auth, heartbeat, IDOR)<br>• Per-type preferences<br>• Real-time strategy (polling → SSE) |
| **[settings.md](./settings.md)** | • Theme (immediate apply)<br>• Language & timezone<br>• Privacy settings<br>• Accessibility options |
| **[toast.md](./toast.md)** | • Ephemeral feedback messages<br>• Toast types (success, error, warning, info)<br>• Stacking behavior<br>• Undo/retry patterns |
| **[loading-states.md](./loading-states.md)** | • Skeleton screens<br>• Navigation progress bar<br>• Streaming with SvelteKit<br>• Shell initialization sequence |
| **[session-lifecycle.md](./session-lifecycle.md)** | • Session expiry warning and modal<br>• Re-authentication flow<br>• Form state preservation<br>• Sensitive action re-auth |
| **[keyboard-shortcuts.md](./keyboard-shortcuts.md)** | • Central shortcut registry<br>• Help modal (`?` key)<br>• Conflict resolution<br>• Platform detection (Mac/Windows) |
| **[shell-state.md](./shell-state.md)** | • State orchestration between components<br>• Sidebar, theme, modal state<br>• Notification polling<br>• Initialization order |
| **[empty-states.md](./empty-states.md)** | • Empty state component<br>• First-run/onboarding patterns<br>• Search no results<br>• Filter cleared states |
| **[component-organization.md](./component-organization.md)** | • Shell vs composites vs ui rules<br>• Directory structure conventions<br>• Naming patterns<br>• Import patterns |

## Overview

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Sidebar        Main Content                            │
│   (Nav)          (+page.svelte)                          │
│                                                          │
│                                                          │
│                  ┌────────────────────────────────────┐  │
│                  │            Footer                  │  │
│                  └────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**No global header.** The sidebar handles all navigation. This maximizes vertical content space. Individual pages use a `PageHeader` component inside the main content area for page-specific titles and actions.

## Related

- [../design/tokens.md](../design/tokens.md) - Sidebar dimensions, z-index values
- [../design/components.md](../design/components.md) - Component specifications
- [../state.md](../state.md) - Sidebar state management
