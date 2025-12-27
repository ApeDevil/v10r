# Empty States

UI patterns for when there's no data to display. Critical for first-run experience and edge cases.

---

## When Empty States Occur

| Scenario | Examples |
|----------|----------|
| **First-time user** | No projects, no activity, no notifications |
| **Zero results** | Search returns nothing, filtered list is empty |
| **Deleted content** | Last item removed from list |
| **Feature not used** | No connected OAuth accounts, no saved preferences |
| **Error recovery** | Failed to load, showing empty instead of error |

---

## Empty State Anatomy

```
┌─────────────────────────────────────────────────┐
│                                                 │
│               ┌─────────────┐                   │
│               │     🔔      │  ← Icon (optional)│
│               └─────────────┘                   │
│                                                 │
│            No notifications yet                 │  ← Title
│                                                 │
│       We'll notify you when something           │  ← Description
│       needs your attention.                     │     (optional)
│                                                 │
│              [Configure alerts]                 │  ← Action (optional)
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Component

```svelte
<!-- src/lib/components/ui/EmptyState.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';

  interface Props {
    icon?: string;
    title: string;
    description?: string;
    action?: Snippet;
    size?: 'sm' | 'md' | 'lg';
    variant?: 'default' | 'card' | 'inline';
  }

  let {
    icon,
    title,
    description,
    action,
    size = 'md',
    variant = 'default',
  }: Props = $props();

  const sizeClasses = {
    sm: 'py-6',
    md: 'py-12',
    lg: 'py-20',
  };

  const iconSizes = {
    sm: 'text-3xl',
    md: 'text-5xl',
    lg: 'text-6xl',
  };
</script>

<div
  class="empty-state flex flex-col items-center justify-center text-center {sizeClasses[size]}"
  class:border={variant === 'card'}
  class:rounded-lg={variant === 'card'}
  class:bg-muted/30={variant === 'card'}
  class:p-6={variant === 'card'}
>
  {#if icon}
    <span class="{icon} {iconSizes[size]} text-muted mb-4" aria-hidden="true" />
  {/if}

  <h3 class="text-lg font-medium text-foreground mb-1">{title}</h3>

  {#if description}
    <p class="text-sm text-muted max-w-sm">{description}</p>
  {/if}

  {#if action}
    <div class="mt-4">
      {@render action()}
    </div>
  {/if}
</div>
```

---

## Shell Component Empty States

### Notifications (No Unread)

```svelte
<EmptyState
  icon="i-lucide-bell"
  title="You're all caught up!"
  description="We'll notify you when something needs your attention."
/>
```

### QuickSearch (No Results)

```svelte
<EmptyState
  icon="i-lucide-search-x"
  title="No results found"
  description="Try a different search term or check your spelling."
  size="sm"
/>
```

### QuickSearch (No Recent)

For first-time users with no recent pages:

```svelte
<EmptyState
  icon="i-lucide-clock"
  title="No recent pages"
  description="Pages you visit will appear here for quick access."
  size="sm"
/>
```

### AI Assistant (New Conversation)

```svelte
<div class="flex flex-col items-center justify-center h-full text-center p-8">
  <span class="i-lucide-bot text-5xl text-muted mb-4" />
  <h3 class="text-lg font-medium mb-2">How can I help?</h3>
  <p class="text-sm text-muted mb-6">
    Ask me anything about using the app.
  </p>

  <div class="grid grid-cols-2 gap-2 max-w-md">
    <button class="suggestion-chip" onclick={() => ask('How do I create a project?')}>
      Create a project
    </button>
    <button class="suggestion-chip" onclick={() => ask('Show me keyboard shortcuts')}>
      Keyboard shortcuts
    </button>
    <button class="suggestion-chip" onclick={() => ask('How do I invite teammates?')}>
      Invite teammates
    </button>
    <button class="suggestion-chip" onclick={() => ask('Export my data')}>
      Export data
    </button>
  </div>
</div>
```

---

## Page Empty States

### Dashboard (New User)

```
┌─────────────────────────────────────────────────────────────┐
│ Dashboard                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    ┌───────────────┐                        │
│                    │     🚀       │                        │
│                    └───────────────┘                        │
│                                                             │
│               Welcome to Velociraptor!                      │
│                                                             │
│         Let's get started with your first project.         │
│                                                             │
│                   [Create Project]                          │
│                                                             │
│     ─────────────────────────────────────────────────      │
│                                                             │
│     Quick Start Guide                                       │
│     ┌─────────┐  ┌─────────┐  ┌─────────┐                 │
│     │ 1. Create│  │ 2. Invite│  │ 3. Build │                 │
│     │ project │  │ team    │  │ together│                 │
│     └─────────┘  └─────────┘  └─────────┘                 │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

```svelte
<!-- First-time dashboard with onboarding -->
{#if projects.length === 0}
  <div class="max-w-2xl mx-auto py-12">
    <EmptyState
      icon="i-lucide-rocket"
      title="Welcome to Velociraptor!"
      description="Let's get started with your first project."
    >
      {#snippet action()}
        <a href="/app/projects/new" class="btn btn-primary">
          Create Project
        </a>
      {/snippet}
    </EmptyState>

    <div class="mt-12">
      <h3 class="text-sm font-medium text-muted mb-4">Quick Start Guide</h3>
      <OnboardingSteps />
    </div>
  </div>
{:else}
  <ProjectList {projects} />
{/if}
```

### Projects List (Empty)

```svelte
<EmptyState
  icon="i-lucide-folder-plus"
  title="No projects yet"
  description="Projects help you organize your work. Create your first one to get started."
>
  {#snippet action()}
    <a href="/app/projects/new" class="btn btn-primary">
      <span class="i-lucide-plus" />
      New Project
    </a>
  {/snippet}
</EmptyState>
```

### Activity Feed (Empty)

```svelte
<EmptyState
  icon="i-lucide-activity"
  title="No activity yet"
  description="Your recent actions and updates will appear here."
  size="sm"
  variant="card"
/>
```

---

## Filter/Search Empty States

When filters result in no matches:

```svelte
<script lang="ts">
  let { query, filters, onClear } = $props();

  const hasFilters = filters.length > 0 || query.length > 0;
</script>

{#if hasFilters}
  <EmptyState
    icon="i-lucide-filter-x"
    title="No matches"
    description="No items match your current filters."
  >
    {#snippet action()}
      <button class="btn btn-ghost" onclick={onClear}>
        Clear filters
      </button>
    {/snippet}
  </EmptyState>
{:else}
  <EmptyState
    icon="i-lucide-inbox"
    title="Nothing here"
    description="Items you create will appear here."
  />
{/if}
```

---

## Error vs Empty

Distinguish between "no data" and "failed to load":

```svelte
{#await data.items}
  <Skeleton />
{:then items}
  {#if items.length === 0}
    <EmptyState
      icon="i-lucide-inbox"
      title="No items"
      description="Create your first item to get started."
    />
  {:else}
    <ItemList {items} />
  {/if}
{:catch error}
  <!-- This is an error state, not empty state -->
  <div class="error-state" role="alert">
    <span class="i-lucide-alert-circle text-error" />
    <h3>Failed to load items</h3>
    <p>{error.message}</p>
    <button onclick={() => invalidate('items')}>Try again</button>
  </div>
{/await}
```

---

## Connected Accounts (None)

```
┌─────────────────────────────────────────────────────────────┐
│ Connected Accounts                                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│     🔵 Google                           [Connect]           │
│     Sign in faster with your Google account                 │
│                                                             │
│     🐙 GitHub                           [Connect]           │
│     Link your GitHub for seamless integration               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

When no accounts are connected, show available options with benefits:

```svelte
{#if connectedAccounts.length === 0}
  <div class="space-y-4">
    <p class="text-sm text-muted">
      Connect accounts for faster sign-in and enhanced features.
    </p>

    {#each availableProviders as provider}
      <div class="flex items-center justify-between p-4 border rounded-lg">
        <div class="flex items-center gap-3">
          <span class={provider.icon} />
          <div>
            <p class="font-medium">{provider.name}</p>
            <p class="text-sm text-muted">{provider.benefit}</p>
          </div>
        </div>
        <button class="btn btn-outline" onclick={() => connect(provider.id)}>
          Connect
        </button>
      </div>
    {/each}
  </div>
{:else}
  <ConnectedAccountsList accounts={connectedAccounts} />
{/if}
```

---

## Active Sessions (Only Current)

```svelte
{#if sessions.length === 1}
  <div class="p-4 border rounded-lg">
    <div class="flex items-center gap-3">
      <span class="i-lucide-monitor text-xl text-muted" />
      <div>
        <p class="font-medium">This device</p>
        <p class="text-sm text-muted">
          {sessions[0].device} • {sessions[0].location}
        </p>
      </div>
      <span class="ml-auto text-xs text-success">Current session</span>
    </div>
  </div>

  <p class="text-sm text-muted mt-4">
    You're only signed in on this device. Sign in from another device to see it here.
  </p>
{:else}
  <SessionList {sessions} />
{/if}
```

---

## Table Empty States

For data tables with no rows:

```svelte
<table>
  <thead>
    <tr>
      <th>Name</th>
      <th>Status</th>
      <th>Actions</th>
    </tr>
  </thead>
  <tbody>
    {#if items.length === 0}
      <tr>
        <td colspan="3">
          <EmptyState
            icon="i-lucide-table"
            title="No data"
            description="Add items to see them in this table."
            size="sm"
          />
        </td>
      </tr>
    {:else}
      {#each items as item}
        <tr><!-- ... --></tr>
      {/each}
    {/if}
  </tbody>
</table>
```

---

## Card Grid Empty States

```svelte
{#if items.length === 0}
  <div class="col-span-full">
    <EmptyState
      icon="i-lucide-grid"
      title="No items"
      variant="card"
    >
      {#snippet action()}
        <button class="btn btn-primary" onclick={createNew}>
          Add First Item
        </button>
      {/snippet}
    </EmptyState>
  </div>
{:else}
  {#each items as item}
    <Card {item} />
  {/each}
{/if}
```

---

## Illustration Guidelines

For larger empty states (like dashboard first-run), consider illustrations:

| Scenario | Illustration Style |
|----------|-------------------|
| First-time user | Welcoming, celebratory |
| No search results | Searching, looking |
| Error | Broken, confused |
| Success (completed all) | Achievement, celebration |

```svelte
<!-- With custom illustration -->
<div class="empty-state">
  <img
    src="/illustrations/welcome.svg"
    alt=""
    class="w-48 h-48 mb-6"
  />
  <h3>Welcome aboard!</h3>
  <p>Let's create something amazing together.</p>
</div>
```

---

## Copy Guidelines

| Type | Good | Bad |
|------|------|-----|
| Title | "No notifications" | "Error: Empty" |
| Description | "We'll notify you when..." | "There is nothing here" |
| Action | "Create project" | "Click here" |
| Tone | Helpful, forward-looking | Blame, technical |

### Writing Principles

1. **Be helpful** - Explain what would normally appear here
2. **Suggest action** - Guide user to fix the empty state
3. **Stay positive** - Frame as opportunity, not failure
4. **Be concise** - Short title, brief description

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Icons | `aria-hidden="true"` (decorative) |
| Structure | Use heading for title |
| Screen reader | Announce empty state context |
| Focus | Focus action button when appropriate |

```svelte
<div class="empty-state" role="status" aria-label="No items to display">
  <span class="i-lucide-inbox" aria-hidden="true" />
  <h3>No items</h3>
  <p>Create your first item to get started.</p>
  <button autofocus>Create Item</button>
</div>
```

---

## Component Location

```
src/lib/components/ui/
└── EmptyState.svelte

src/lib/components/composites/
├── dashboard/
│   └── WelcomeOnboarding.svelte
├── notifications/
│   └── NotificationsEmpty.svelte
└── search/
    └── SearchNoResults.svelte
```

---

## Related

- [./loading-states.md](./loading-states.md) - Skeleton screens (before data loads)
- [../error-handling.md](../error-handling.md) - Error states (load failed)
- [./toast.md](./toast.md) - Feedback after actions
