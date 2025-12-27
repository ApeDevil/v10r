# Settings

App-level preferences for appearance, language, privacy, and accessibility. Low-stakes toggles that apply immediately.

## Route Structure

```
/app/settings/
├── +page.svelte             # Settings hub with cards
├── +page.server.ts          # Load current preferences
├── appearance/
│   ├── +page.svelte         # Theme, display options
│   └── +page.server.ts
├── language/
│   ├── +page.svelte         # Locale, timezone, date format
│   └── +page.server.ts
├── privacy/
│   ├── +page.svelte         # Profile visibility, activity
│   └── +page.server.ts
└── accessibility/
    ├── +page.svelte         # Motion, contrast, keyboard
    └── +page.server.ts
```

**Note:** Start with single page, split into sub-routes when settings exceed ~10 options.

---

## Settings Hub

**Route:** `/app/settings`

Overview page with cards linking to sub-pages. Each card shows current value for quick scanning.

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Settings                                           │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌──────────────────┐  ┌──────────────────┐        │
│ │ 🎨 Appearance    │  │ 🌍 Language      │        │
│ │                  │  │                  │        │
│ │ Theme: Dark      │  │ English (US)     │        │
│ │                  │  │ PST timezone     │        │
│ └──────────────────┘  └──────────────────┘        │
│                                                    │
│ ┌──────────────────┐  ┌──────────────────┐        │
│ │ 🔒 Privacy       │  │ ♿ Accessibility │        │
│ │                  │  │                  │        │
│ │ Profile: Public  │  │ Reduced motion   │        │
│ │                  │  │ enabled          │        │
│ └──────────────────┘  └──────────────────┘        │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Why Cards (Not Tabs)?

- Better mobile UX (tappable cards vs cramped tabs)
- Progressive disclosure (see current values without opening)
- Clearer hierarchy for different preference categories

---

## Appearance Settings

**Route:** `/app/settings/appearance`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Settings › Appearance                              │
├────────────────────────────────────────────────────┤
│                                                    │
│ Theme                                              │
│                                                    │
│ ┌────────┐  ┌────────┐  ┌────────┐               │
│ │  ☀️    │  │  🌙    │  │  🖥️    │               │
│ │ Light  │  │ Dark   │  │ System │               │
│ └────────┘  └────────┘  └────────┘               │
│   (active)                                         │
│                                                    │
│ Color Accent                                       │
│                                                    │
│ ○ Blue  ● Purple  ○ Green  ○ Orange               │
│                                                    │
│ Display                                            │
│                                                    │
│ Font size                                          │
│ [────●───────] Medium                             │
│ Small   ↔   Large                                 │
│                                                    │
│ Interface density                                  │
│ ○ Compact  ● Comfortable  ○ Spacious              │
│                                                    │
└────────────────────────────────────────────────────┘
```

### Theme Implementation

Theme changes apply **immediately** with localStorage + async DB persist.

```svelte
<script lang="ts">
  import { browser } from '$app/environment';

  let { data } = $props();
  let theme = $state<'light' | 'dark' | 'system'>(data.settings.theme);

  function applyTheme(value: typeof theme) {
    if (!browser) return;

    if (value === 'system') {
      const systemPreference = window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
      document.documentElement.classList.toggle('dark', systemPreference === 'dark');
    } else {
      document.documentElement.classList.toggle('dark', value === 'dark');
    }

    // Persist to cookie (for SSR hydration)
    // Security: SameSite=Lax prevents CSRF, Secure ensures HTTPS-only
    document.cookie = `theme=${value};path=/;max-age=31536000;SameSite=Lax;Secure`;

    // Persist to DB (async, fire-and-forget)
    fetch('/api/user/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ theme: value }),
    });
  }

  $effect(() => {
    applyTheme(theme);
  });
</script>

<div class="theme-selector">
  {#each ['light', 'dark', 'system'] as option}
    <button
      class:active={theme === option}
      onclick={() => theme = option}
      aria-pressed={theme === option}
    >
      {option === 'light' ? '☀️' : option === 'dark' ? '🌙' : '🖥️'}
      {option}
    </button>
  {/each}
</div>
```

### Hydration Mismatch Prevention

Theme must use cookie-based SSR sync to avoid hydration mismatch.

```typescript
// +layout.server.ts
export const load = async ({ cookies }) => {
  return {
    theme: cookies.get('theme') ?? 'system',
  };
};
```

```svelte
<!-- +layout.svelte -->
<script>
  let { data, children } = $props();
</script>

<div class:dark={data.theme === 'dark'}>
  {@render children()}
</div>
```

---

## Language Settings

**Route:** `/app/settings/language`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Settings › Language                                │
├────────────────────────────────────────────────────┤
│                                                    │
│ Display Language                                   │
│                                                    │
│ ┌────────────────────────────────┐                │
│ │ English (US)                ▼  │                │
│ └────────────────────────────────┘                │
│                                                    │
│ Date & Time                                        │
│                                                    │
│ Timezone                                           │
│ ┌────────────────────────────────┐                │
│ │ America/Los_Angeles (PST)   ▼  │                │
│ └────────────────────────────────┘                │
│                                                    │
│ Date format                                        │
│ ○ MM/DD/YYYY (01/15/2025)                         │
│ ● DD/MM/YYYY (15/01/2025)                         │
│ ○ YYYY-MM-DD (2025-01-15)                         │
│                                                    │
│ Time format                                        │
│ ○ 12-hour (3:30 PM)                               │
│ ● 24-hour (15:30)                                 │
│                                                    │
│                              [Save Changes]        │
└────────────────────────────────────────────────────┘
```

### Locale/Timezone Storage

Locale and timezone are stored in `userProfile` (not `userSettings`) because they affect content display.

```typescript
// userProfile table
locale: text('locale').notNull().default('en'),
timezone: text('timezone').notNull().default('UTC'),
```

---

## Privacy Settings

**Route:** `/app/settings/privacy`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Settings › Privacy                                 │
├────────────────────────────────────────────────────┤
│                                                    │
│ Profile Visibility                                 │
│                                                    │
│ ● Public — Anyone can view your profile           │
│ ○ Private — Only you can view your profile        │
│                                                    │
│ Activity                                           │
│                                                    │
│ ☐ Show online status                              │
│ ☐ Show recently active projects                   │
│ ☐ Allow others to see my activity                 │
│                                                    │
│ Search Engines                                     │
│                                                    │
│ ☐ Allow search engines to index my profile        │
│                                                    │
│                              [Save Changes]        │
└────────────────────────────────────────────────────┘
```

---

## Accessibility Settings

**Route:** `/app/settings/accessibility`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Settings › Accessibility                           │
├────────────────────────────────────────────────────┤
│                                                    │
│ Motion                                             │
│                                                    │
│ ☑ Reduce motion and animations                    │
│   (Respects system preference by default)         │
│                                                    │
│ Visual                                             │
│                                                    │
│ ☑ Increase contrast                               │
│ ☐ Underline links                                 │
│                                                    │
│ Keyboard Navigation                                │
│                                                    │
│ ☑ Show focus indicators                           │
│ ☑ Enable keyboard shortcuts                       │
│                                                    │
│ Screen Reader                                      │
│                                                    │
│ ☐ Announce page changes                           │
│ ☐ Verbose button labels                           │
│                                                    │
│                              [Save Changes]        │
└────────────────────────────────────────────────────┘
```

### Reduced Motion Implementation

Respect system preferences + manual override.

```css
/* Respect system preferences */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Manual override via class */
html.reduce-motion *,
html.reduce-motion *::before,
html.reduce-motion *::after {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}
```

---

## Data Model

### User Settings Table

```typescript
export const themeEnum = pgEnum('theme', ['light', 'dark', 'system']);

export const userSettings = pgTable('user_settings', {
  userId: text('user_id').primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  // Appearance
  theme: themeEnum('theme').notNull().default('system'),
  accentColor: text('accent_color').default('blue'),
  fontSize: text('font_size').notNull().default('medium'), // 'small' | 'medium' | 'large'
  density: text('density').notNull().default('comfortable'), // 'compact' | 'comfortable' | 'spacious'

  // Accessibility
  reducedMotion: boolean('reduced_motion').notNull().default(false),
  highContrast: boolean('high_contrast').notNull().default(false),
  underlineLinks: boolean('underline_links').notNull().default(false),
  showFocusIndicators: boolean('show_focus_indicators').notNull().default(true),
  enableKeyboardShortcuts: boolean('enable_keyboard_shortcuts').notNull().default(true),

  // Privacy
  profileVisibility: text('profile_visibility').notNull().default('public'),
  showOnlineStatus: boolean('show_online_status').notNull().default(true),
  showActivityHistory: boolean('show_activity_history').notNull().default(true),
  allowSearchIndexing: boolean('allow_search_indexing').notNull().default(true),

  // Behavior
  autoplayMedia: boolean('autoplay_media').notNull().default(true),

  // Feature flags (experimental)
  featureFlags: jsonb('feature_flags').$type<Record<string, boolean>>().default({}),

  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});
```

### Storage Strategy

| Category | Strategy | Reason |
|----------|----------|--------|
| Theme, accessibility | Explicit columns | Applied every page load, need defaults |
| Feature flags | JSONB | Rarely queried, highly variable |
| Privacy settings | Explicit columns | Need to query for filtering |

---

## Server-Side Preferences Loading

Load settings in root layout for global access.

```typescript
// src/routes/(app)/+layout.server.ts
export const load = async ({ locals, cookies }) => {
  const user = locals.user;

  if (!user) {
    return { settings: null };
  }

  const settings = await db.query.userSettings.findFirst({
    where: eq(userSettings.userId, user.id)
  });

  // Fallback to defaults if no settings row exists
  return {
    settings: settings ?? {
      theme: cookies.get('theme') ?? 'system',
      reducedMotion: false,
      highContrast: false,
      // ... other defaults
    }
  };
};
```

---

## Sidebar Integration

```svelte
<NavItem href="/app/settings" icon={Settings} hasChildren>
  Settings
  {#snippet children()}
    <NavDropdown>
      <NavLink href="/app/settings/appearance">Appearance</NavLink>
      <NavLink href="/app/settings/language">Language</NavLink>
      <NavLink href="/app/settings/privacy">Privacy</NavLink>
      <NavLink href="/app/settings/accessibility">Accessibility</NavLink>
    </NavDropdown>
  {/snippet}
</NavItem>
```

---

## User Menu Quick Theme Toggle

The user menu dropdown (sidebar footer) includes a quick theme toggle.

```
┌────────────────────────┐
│  👤 Profile            │ → /app/account
│  🎨 Theme: Dark    ▸   │ → Quick toggle (no navigation)
│  ⚙️ Settings           │ → /app/settings
│  ───────────────────   │
│  🚪 Sign out           │
└────────────────────────┘
```

```svelte
<!-- UserMenuDropdown.svelte -->
<DropdownMenu.Sub>
  <DropdownMenu.SubTrigger>
    <span class="i-lucide-palette" />
    Theme: {currentTheme}
  </DropdownMenu.SubTrigger>
  <DropdownMenu.SubContent>
    <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
      <DropdownMenu.RadioItem value="light">Light</DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="dark">Dark</DropdownMenu.RadioItem>
      <DropdownMenu.RadioItem value="system">System</DropdownMenu.RadioItem>
    </DropdownMenu.RadioGroup>
  </DropdownMenu.SubContent>
</DropdownMenu.Sub>
```

---

## Components

```
src/lib/components/composites/settings/
├── SettingsCard.svelte       # Hub card with current value
├── ThemeSelector.svelte      # Radio buttons for theme
├── LanguageSelector.svelte   # Dropdown for language
├── TimezoneSelector.svelte   # Dropdown with search
├── PrivacyToggles.svelte     # Checkbox group
├── AccessibilityToggles.svelte
└── ToggleRow.svelte          # Reusable toggle row
```

---

## Mobile Responsiveness

| Pattern | Desktop | Mobile |
|---------|---------|--------|
| Settings hub | 2x2 card grid | Single column stack |
| Card touch targets | N/A | Minimum 44x44px |
| Font size slider | Standard | Larger hit area |
| Radio buttons | Inline | Stacked |

---

## Related

- [./sidebar.md](./sidebar.md) - User menu theme toggle
- [../state.md](../state.md) - Cookie-based theme sync
- [../forms.md](../forms.md) - Superforms patterns
- [../design/tokens.md](../design/tokens.md) - Theme tokens
