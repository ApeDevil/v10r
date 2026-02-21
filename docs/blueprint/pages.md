# Page Architecture

Self-documenting template where each page tests the features it documents.

## Concept

Every showcase page serves three purposes:

| Role | Description |
|------|-------------|
| **Documentation** | Explains how the feature works |
| **Test** | Proves the feature works (if page renders, feature works) |
| **Template** | Copy-paste reference for real projects |

No documentation drift. No stale examples. The template validates itself.

---

## Route Structure

```
/                                    # Landing page
│
├── /showcase                        # Living demos
│   ├── +page.svelte                 # Landing with recommended path
│   ├── /theme                       # Theming system
│   ├── /ui                          # Component gallery
│   │   ├── /primitives              # Buttons, inputs, badges
│   │   ├── /composites              # Alerts, toasts, menus
│   │   ├── /typography              # Headings, body, lead
│   │   ├── /layouts                 # Stack, cluster, grid
│   │   ├── /tokens                  # Colors, spacing, shadows
│   │   └── /panes-and-panels        # Resize + dock systems
│   │       ├── /panes               # PaneForge resize primitives
│   │       │   └── /reorderable     # Drag-to-reorder panes
│   │       └── /panels              # Dock (tabs, splits, activity bar)
│   ├── /forms                       # Form patterns
│   ├── /state                       # Reactivity playground
│   ├── /data                        # CRUD & data display
│   │   └── /data/[id]               # Detail view
│   ├── /files                       # File uploads
│   ├── /i18n                        # Internationalization
│   ├── /animations                  # Motion & transitions
│   ├── /3d                          # 3D experiences (Threlte + Three.js)
│   │   ├── +layout.svelte           # Dark theme, fullscreen toggle
│   │   ├── +page.svelte             # 3D showcase landing
│   │   ├── /basic-scene             # Spinning cube (vanilla Three.js)
│   │   ├── /gltf-viewer             # Model viewer with controls
│   │   ├── /interactive             # Click/hover interactions
│   │   └── /physics                 # Rapier physics demo
│   ├── /graph                       # Graph database visualization
│   └── /api                         # API explorer
│
├── /experience                      # Immersive 3D experiences
│   ├── +layout.svelte               # Minimal shell, no sidebar
│   └── /product                     # 3D product configurator
│
├── /app                             # Protected area
│   ├── /dashboard                   # User home
│   ├── /settings                    # Preferences
│   └── /account                     # GDPR (export, delete)
│
├── /auth                            # Authentication
│   ├── /login                       # Email entry + OAuth
│   └── /verify                      # OTP code entry
│
└── /docs                            # Static documentation
    ├── /stack                       # Technology decisions
    └── /architecture                # Codebase structure
```

---

## Error Boundary Structure

Every route group should have an `+error.svelte` file for graceful error handling.

### Required Error Boundaries

| Location | Purpose | Context |
|----------|---------|---------|
| `/+error.svelte` | Root fallback | Generic error, "Go home" link |
| `/app/+error.svelte` | Authenticated area | Maintains app shell, "Back to dashboard" |
| `/(auth)/+error.svelte` | Auth flows | Clean layout, "Try again" link |
| `/showcase/+error.svelte` | Showcase area | Shows error within showcase layout |

### Error Boundary File Structure

```
src/routes/
├── +error.svelte              # Root fallback (REQUIRED)
├── +layout.svelte
│
├── (auth)/
│   ├── +error.svelte          # Auth-specific errors
│   ├── login/+page.svelte
│   └── verify/+page.svelte
│
├── showcase/
│   ├── +error.svelte          # Showcase-specific errors
│   ├── +layout.svelte
│   └── ...
│
└── app/
    ├── +error.svelte          # App-specific (maintains shell)
    ├── +layout.svelte
    ├── dashboard/+page.svelte
    └── settings/
        ├── +error.svelte      # Optional: settings-specific
        └── +page.svelte
```

### Layout Error Gotcha

⚠️ **Important:** Errors in `+layout.server.ts` are caught by `+error.svelte` **above** the layout, not next to it.

```
routes/app/
├── +layout.server.ts   ← Error here
├── +layout.svelte
└── +error.svelte       ← Won't catch it!

routes/
└── +error.svelte       ← Catches it here (parent level)
```

### Error Page Implementation

```svelte
<!-- src/routes/+error.svelte (Root) -->
<script>
  import { page } from '$app/state';
</script>

<div class="error-page">
  <h1>{page.status}</h1>
  <p>{page.error?.message || 'Something went wrong'}</p>
  <a href="/">Go home</a>
</div>
```

```svelte
<!-- src/routes/app/+error.svelte (App area - keeps shell) -->
<script>
  import { page } from '$app/state';
</script>

<!-- This renders inside AppShell layout -->
<div class="error-content">
  <h1>Error {page.status}</h1>
  <p>{page.error?.message || 'Something went wrong'}</p>
  <a href="/app/dashboard">Back to dashboard</a>
</div>
```

### Component-Level Errors (Svelte 5)

Use `<svelte:boundary>` for component rendering errors:

```svelte
<svelte:boundary onerror={(error) => logToSentry(error)}>
  <ComplexChart data={chartData} />

  {#snippet failed(error, reset)}
    <div class="error-state">
      <p>Chart failed to load</p>
      <button onclick={reset}>Retry</button>
    </div>
  {/snippet}
</svelte:boundary>
```

**Limitations:** Only catches rendering/effect errors, not event handlers or async code.

---

## Showcase Pages

### /showcase (Landing Page)

The showcase landing page provides first-time visitors with a clear entry point and recommended learning path.

**Purpose:**
- Prevent decision paralysis (10+ demos can overwhelm)
- Guide new users through fundamentals first
- Show progress/completion status

**Page content:**
- Brief intro to the showcase concept
- Recommended path with categorization
- Visual cards for each section
- Optional: visited/completed indicators

**Recommended Learning Path:**

| Order | Category | Page | Focus |
|-------|----------|------|-------|
| 1 | Fundamentals | Theme | Design tokens, dark mode, CSS variables |
| 2 | Fundamentals | UI | Component library, accessibility |
| 3 | Fundamentals | Forms | Validation, progressive enhancement |
| 4 | Core | State | Svelte 5 runes, reactivity |
| 5 | Core | Data | Load functions, CRUD patterns |
| 6 | Advanced | Files | Upload, R2 storage |
| 7 | Advanced | i18n | Translations, locale routing |
| 8 | Advanced | Animations | Transitions, Motion One |
| 9 | Specialized | Graph | Graph database visualization |
| 10 | Specialized | API | REST, interactive docs |

**Implementation:**

```svelte
<!-- src/routes/showcase/+page.svelte -->
<script>
  const categories = [
    {
      name: 'Fundamentals',
      description: 'Start here — core patterns you\'ll use everywhere',
      pages: [
        { href: '/showcase/theme', title: 'Theme', description: 'Design tokens & dark mode' },
        { href: '/showcase/ui', title: 'UI', description: 'Component library' },
        { href: '/showcase/forms', title: 'Forms', description: 'Validation & submission' },
      ],
    },
    {
      name: 'Core Patterns',
      description: 'Essential SvelteKit patterns for any app',
      pages: [
        { href: '/showcase/state', title: 'State', description: 'Svelte 5 runes' },
        { href: '/showcase/data', title: 'Data', description: 'CRUD & load functions' },
      ],
    },
    {
      name: 'Advanced',
      description: 'Specialized features for production apps',
      pages: [
        { href: '/showcase/files', title: 'Files', description: 'Upload & storage' },
        { href: '/showcase/i18n', title: 'i18n', description: 'Internationalization' },
        { href: '/showcase/animations', title: 'Animations', description: 'Transitions & motion' },
      ],
    },
    {
      name: 'Specialized',
      description: 'Domain-specific integrations',
      pages: [
        { href: '/showcase/graph', title: 'Graph', description: 'Graph database visualization' },
        { href: '/showcase/api', title: 'API', description: 'REST documentation' },
      ],
    },
  ];
</script>

<h1>Showcase</h1>
<p>Self-documenting pages that test the features they document.</p>

{#each categories as category}
  <section>
    <h2>{category.name}</h2>
    <p>{category.description}</p>
    <div class="card-grid">
      {#each category.pages as page}
        <a href={page.href} class="card">
          <h3>{page.title}</h3>
          <p>{page.description}</p>
        </a>
      {/each}
    </div>
  </section>
{/each}
```

---

### /showcase/theme

Theming system with dark/light mode and design tokens.

| Tests | Stack |
|-------|-------|
| Theme toggle | `$state`, localStorage |
| CSS variables | UnoCSS theme config |
| Design tokens | Color, spacing, typography scales |
| System preference | `prefers-color-scheme` |
| Persistence | Cookie or localStorage |

**Page content:**
- Theme toggle button
- Color palette display
- Typography scale
- Spacing scale
- Component variants in both themes

---

### /showcase/ui

Component gallery with all UI primitives.

| Tests | Stack |
|-------|-------|
| Headless components | Bits UI |
| Atomic CSS | UnoCSS utilities |
| Icons | Iconify |
| Accessibility | ARIA, keyboard navigation |

**Page content:**
- Buttons (variants, sizes, states)
- Inputs (text, select, checkbox, radio)
- Cards, badges, avatars
- Modals, drawers, popovers
- Tables, lists
- Navigation (tabs, breadcrumbs)
- Feedback (alerts, toasts, progress)
- QuickSearch (`⌘K` global search)

**Structure:**
```
/showcase/ui
├── +page.svelte                          # Overview with links
├── primitives/+page.svelte               # Buttons, inputs, badges, etc.
├── composites/+page.svelte               # Alerts, toasts, cards, menus
├── typography/+page.svelte               # Headings, body, lead text
├── layouts/+page.svelte                  # Stack, cluster, grid, center
├── tokens/+page.svelte                   # Colors, spacing, shadows
├── panes-and-panels/
│   ├── +page.svelte                      # Landing with links
│   ├── panes/+page.svelte               # PaneForge resize primitives
│   ├── panes/reorderable/+page.svelte   # Drag-to-reorder panes
│   └── panels/+page.svelte              # Dock system (tabs, splits, drag-to-split)
└── ...
```

---

### /showcase/forms

Form handling with validation and progressive enhancement.

| Tests | Stack |
|-------|-------|
| Form library | Superforms |
| Validation | Valibot schemas |
| Server actions | SvelteKit form actions |
| Error handling | Field errors, form errors |
| Loading states | Submission pending |

**Page content:**
- Simple form (text inputs)
- Complex form (nested data, arrays)
- Multi-step form (wizard)
- File upload form
- Real-time validation
- Server-side validation errors

**Demonstrates:**
```svelte
<!-- Client -->
<form method="POST" use:enhance>
  <input name="email" bind:value={$form.email} />
  {#if $errors.email}<span>{$errors.email}</span>{/if}
  <button disabled={$submitting}>Submit</button>
</form>
```

```ts
// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const form = await superValidate(request, valibot(schema));
    if (!form.valid) return fail(400, { form });
    // Process...
    return { form };
  }
};
```

---

### /showcase/state

Svelte 5 reactivity playground.

| Tests | Stack |
|-------|-------|
| Reactive state | `$state` |
| Derived values | `$derived`, `$derived.by` |
| Side effects | `$effect` |
| Shared state | `.svelte.ts` modules |

**Page content:**
- Counter (basic `$state`)
- Computed values (`$derived`)
- Complex derivations (`$derived.by`)
- Effect demos (logging, localStorage sync)
- Shared store pattern
- Deep reactivity (arrays, objects)

**Demonstrates:**
```ts
// stores.svelte.ts
export function createTodoStore() {
  let todos = $state<Todo[]>([]);
  let completed = $derived(todos.filter(t => t.done));

  return {
    get todos() { return todos; },
    get completed() { return completed; },
    add(text: string) { todos.push({ text, done: false }); }
  };
}
```

---

### /showcase/data

CRUD operations with master-detail pattern.

#### Streaming for Large Datasets

For expensive queries, stream data to show initial content immediately:

```typescript
// +page.server.ts
export async function load({ locals }) {
  // Fast query: return immediately
  const recentItems = await db.query.items.findMany({
    where: eq(items.userId, locals.user!.id),
    orderBy: desc(items.createdAt),
    limit: 10,
  });

  // Slow query: return promise to stream later
  const analytics = getAnalytics(locals.user!.id); // Returns Promise

  return {
    items: recentItems,     // Available immediately
    analytics,              // Streamed when ready
  };
}
```

```svelte
<!-- +page.svelte -->
<script lang="ts">
  let { data } = $props();
</script>

<!-- Immediate: Show items right away -->
{#each data.items as item}
  <ItemCard {item} />
{/each}

<!-- Streamed: Show loading state, then content -->
{#await data.analytics}
  <div class="skeleton">Loading analytics...</div>
{:then analytics}
  <AnalyticsDashboard {analytics} />
{:catch error}
  <p>Failed to load analytics</p>
{/await}
```

#### Streaming Guidelines

| Scenario | Pattern |
|----------|---------|
| Primary content | `await` before return |
| Secondary/slow data | Return promise, use `{#await}` |
| Optional analytics | Return promise |
| Critical data | Always `await` |

**Note:** Streaming requires `edge: true` or Node.js 18+ runtime.

| Tests | Stack |
|-------|-------|
| Database queries | Drizzle ORM |
| Server load | `+page.server.ts` load functions |
| Dynamic routes | `[id]` params |
| Mutations | Form actions |
| Optimistic UI | Instant feedback |

**Routes:**
```
/showcase/data
├── +page.svelte              # List view (cards/table)
├── +page.server.ts           # Load items, handle create
├── [id]/
│   ├── +page.svelte          # Detail view
│   ├── +page.server.ts       # Load item, handle update/delete
│   └── edit/
│       ├── +page.svelte      # Edit form
│       └── +page.server.ts   # Handle update
└── new/
    ├── +page.svelte          # Create form
    └── +page.server.ts       # Handle create
```

**Page content:**
- Item grid with cards
- Table view toggle
- Search and filters
- Pagination
- Sort controls
- Create/Edit/Delete flows
- Empty states
- Loading skeletons

**Object Card Pattern:**
```svelte
<Card>
  <CardHeader>
    <Avatar src={item.image} />
    <CardTitle>{item.title}</CardTitle>
  </CardHeader>
  <CardContent>
    <p>{item.description}</p>
    <TagList tags={item.tags} />
  </CardContent>
  <CardFooter>
    <Button href="/showcase/data/{item.id}">View</Button>
    <DropdownMenu>
      <DropdownItem on:click={edit}>Edit</DropdownItem>
      <DropdownItem on:click={delete}>Delete</DropdownItem>
    </DropdownMenu>
  </CardFooter>
</Card>
```

---

### /showcase/files

File upload and image processing.

| Tests | Technology | Provider |
|-------|------------|----------|
| Upload handling | Form actions | SvelteKit |
| Storage | S3 API | [Cloudflare R2](../../stack/vendors.md#cloudflare-r2) |
| Image processing | Sharp | Library |
| Presigned URLs | S3 SDK | @aws-sdk/client-s3 |

**Page content:**
- Single file upload
- Multi-file upload
- Drag and drop zone
- Image preview
- Progress indicator
- File type validation
- Size limits
- Image gallery (from R2)

**Flow:**
```
Client                    Server                    R2
  │                         │                        │
  ├── Upload file ─────────▶│                        │
  │                         ├── Process (Sharp) ────▶│
  │                         │◀── Store URL ──────────┤
  │◀── Return URL ──────────┤                        │
  │                         │                        │
  ├── Request image ───────▶│                        │
  │                         ├── Presigned URL ──────▶│
  │◀── Redirect to CDN ─────┤                        │
```

---

### /showcase/i18n

Internationalization with lazy-loaded translations.

| Tests | Stack |
|-------|-------|
| Translation loading | sveltekit-i18n |
| URL-based locale | `/en/`, `/de/` |
| Language switching | Route-based |
| Date/Number formatting | Native `Intl` API |

**Routes:**
```
/showcase/i18n
├── +layout.ts                # Init i18n
├── +page.svelte              # Language demo
└── [[lang]]/                 # Optional locale prefix
    └── ...
```

**Page content:**
- Language switcher
- Translated strings
- Pluralization
- Date/number formatting
- RTL support demo
- Translation key inspector (dev mode)

---

### /showcase/animations

Motion and transitions.

| Tests | Stack |
|-------|-------|
| Enter/exit | Svelte `transition:` |
| Tweening | Svelte `tweened`, `spring` |
| Keyframes | Motion One |
| Scroll-triggered | Motion One |

**Page content:**
- Fade, slide, scale transitions
- List animations (flip)
- Spring physics
- Stagger animations
- Scroll-triggered reveals
- Page transitions
- Gesture animations

---

### /showcase/graph

Graph database visualization and queries.

| Tests | Technology | Provider |
|-------|------------|----------|
| Graph queries | Cypher | [Neo4j Aura](../../stack/vendors.md#neo4j-aura) |
| Visualization | D3-force | Library |
| Relationships | Graph traversal | neo4j-driver |

**Page content:**
- Interactive graph visualization
- Node search
- Relationship explorer
- Path finding
- Graph of this template's own structure

**Meta visualization:**
```
(Theme)──[:USES]──▶(UnoCSS)
   │                  │
   └──[:RELATES_TO]───┘
          │
          ▼
      (UI Components)
```

---

### /showcase/api

Interactive API documentation.

| Tests | Stack |
|-------|-------|
| REST endpoints | SvelteKit `+server.ts` |
| Documentation | OpenAPI/Scalar |
| Testing | Interactive requests |

**Page content:**
- Endpoint list
- Request builder
- Response viewer
- Authentication helper
- Code snippets (curl, fetch, etc.)

---

## Protected Pages

### /app/*

All routes under `/app` require authentication.

**Protection per-route** (not layout - see [auth.md](./auth.md#route-protection)):
```ts
// /app/dashboard/+page.server.ts
import { requireAuth } from '$lib/server/auth/guard';

export async function load(event) {
  const { user } = await requireAuth(event);
  return { user };
}
```

### /app/dashboard

User's authenticated home.

| Tests | Technology | Provider |
|-------|------------|----------|
| Session | Database sessions | Better Auth + [Neon](../../stack/vendors.md#neon) |
| User data | `auth.api.getSession()` | Better Auth |
| Protected content | Per-route guards | SvelteKit |

### /app/settings

User configuration (preferences & settings) with form handling.

| Tests | Technology | Provider |
|-------|------------|----------|
| Form + auth | Combined patterns | Superforms + Better Auth |
| User updates | ORM mutations | Drizzle |
| Theme preference | Database storage | [Neon](../../stack/vendors.md#neon) |

### /app/account

GDPR compliance routes.

| Route | Purpose |
|-------|---------|
| `/app/account` | View stored data |
| `/app/account/export` | Download JSON |
| `/app/account/delete` | Delete account |

---

## Auth Pages

### /auth/login

| Tests | Technology | Provider |
|-------|------------|----------|
| Magic link | Email link auth | Better Auth |
| OTP | 6-digit code | Better Auth |
| OAuth | OAuth 2.0 | Better Auth (20+ providers) |
| Session creation | Database sessions | [Neon](../../stack/vendors.md#neon) |
| Redirect | URL handling | SvelteKit |
| Rate limiting | Request limiting | Better Auth built-in |

**Flow:** User enters email → receives email with both magic link AND OTP code → chooses how to authenticate.

### /auth/verify

| Tests | Technology | Provider |
|-------|------------|----------|
| OTP entry | 6-digit code validation | Better Auth |
| Code expiry | 10-minute TTL | Better Auth |
| Resend throttling | Rate limiting | Better Auth built-in |
| Email verification | Token verification | Better Auth plugin |

---

## Static Documentation

### /docs/*

Pre-rendered documentation pages.

```ts
// /docs/+layout.ts
export const prerender = true;
```

Markdown content rendered with syntax highlighting.

---

## File Structure

```
src/routes/
├── +layout.svelte                    # Root layout
├── +layout.server.ts                 # Auth check, theme
├── +page.svelte                      # Landing
│
├── showcase/
│   ├── +layout.svelte                # Showcase layout (sidebar nav)
│   ├── theme/+page.svelte
│   ├── ui/
│   │   ├── +page.svelte
│   │   ├── buttons/+page.svelte
│   │   ├── quick-search/+page.svelte
│   │   └── ...
│   ├── forms/+page.svelte
│   ├── state/+page.svelte
│   ├── data/
│   │   ├── +page.svelte
│   │   ├── +page.server.ts
│   │   ├── [id]/+page.svelte
│   │   └── new/+page.svelte
│   ├── files/+page.svelte
│   ├── i18n/+page.svelte
│   ├── animations/+page.svelte
│   ├── graph/+page.svelte
│   └── api/+page.svelte
│
├── app/
│   ├── +layout.server.ts             # Auth guard
│   ├── dashboard/+page.svelte
│   ├── settings/+page.svelte
│   └── account/
│       ├── +page.svelte
│       ├── export/+server.ts
│       └── delete/+page.svelte
│
├── auth/
│   ├── login/+page.svelte
│   └── verify/+page.svelte
│
└── docs/
    ├── +layout.ts                    # prerender = true
    └── [slug]/+page.svelte           # Markdown renderer
```

---

## Navigation

> **No global header.** Navigation lives in the sidebar. See [app-shell/](./app-shell/) for details.

### Showcase Sidebar

```
┌────────────────┐
│ Showcase       │
├────────────────┤
│ Theme          │
│ UI             │
│   └ Primitives │
│   └ Composites │
│   └ Typography │
│   └ Layouts    │
│   └ Panes & Panels │
│   └ Tokens     │
│ Forms          │
│ State          │
│ Data           │
│ Files          │
│ i18n           │
│ Animations     │
│ Graph          │
│ API            │
└────────────────┘
```

---

## Summary

| Area | Routes | Primary Tests |
|------|--------|---------------|
| Showcase | 10+ pages | All stack features |
| Protected | 4 pages | Sessions, GDPR |
| Auth | 3 pages | Sessions, forms |
| Docs | Dynamic | Prerendering, markdown |

The showcase pages form a comprehensive test suite. If all pages render correctly, the entire stack works.
