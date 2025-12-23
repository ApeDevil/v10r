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
│   ├── /theme                       # Theming system
│   ├── /ui                          # Component gallery
│   ├── /forms                       # Form patterns
│   ├── /state                       # Reactivity playground
│   ├── /data                        # CRUD & data display
│   │   └── /data/[id]               # Detail view
│   ├── /files                       # File uploads
│   ├── /i18n                        # Internationalization
│   ├── /animations                  # Motion & transitions
│   ├── /graph                       # Neo4j visualization
│   └── /api                         # API explorer
│
├── /app                             # Protected area
│   ├── /dashboard                   # User home
│   ├── /settings                    # Preferences
│   └── /account                     # GDPR (export, delete)
│
├── /auth                            # Authentication
│   ├── /login
│   ├── /register
│   └── /forgot-password
│
└── /docs                            # Static documentation
    ├── /stack                       # Technology decisions
    └── /architecture                # Codebase structure
```

---

## Showcase Pages

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

**Structure:**
```
/showcase/ui
├── +page.svelte              # Overview with links
├── buttons/+page.svelte      # Button variants
├── inputs/+page.svelte       # Input types
├── feedback/+page.svelte     # Alerts, toasts
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

| Tests | Stack |
|-------|-------|
| Upload handling | SvelteKit form actions |
| Storage | Cloudflare R2 |
| Image processing | Sharp |
| Presigned URLs | S3 SDK |

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

Neo4j visualization and graph queries.

| Tests | Stack |
|-------|-------|
| Graph queries | Neo4j driver |
| Visualization | D3-force or similar |
| Relationships | Cypher queries |

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

| Tests | Stack |
|-------|-------|
| Session | Better Auth (Postgres) |
| User data | `auth.api.getSession()` |
| Protected content | Per-route guards |

### /app/settings

User preferences with form handling.

| Tests | Stack |
|-------|-------|
| Form + auth | Combined patterns |
| User updates | Drizzle mutations |
| Theme preference | Stored in DB |

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

| Tests | Stack |
|-------|-------|
| Credentials | Better Auth `signIn.email()` |
| OAuth | Better Auth `signIn.social()` |
| Session creation | Better Auth (Postgres) |
| Redirect | Return to previous page |
| Rate limiting | Better Auth built-in |

### /auth/register

| Tests | Stack |
|-------|-------|
| User creation | Better Auth `signUp.email()` |
| Password hashing | Better Auth (bcrypt/Argon2) |
| Validation | Valibot + Better Auth |
| Email verification | Better Auth plugin |

### /auth/forgot-password

| Tests | Stack |
|-------|-------|
| Reset flow | Better Auth `forgetPassword()` |
| Email sending | Better Auth + Resend |
| Token validation | Better Auth built-in |

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
│   ├── register/+page.svelte
│   └── forgot-password/+page.svelte
│
└── docs/
    ├── +layout.ts                    # prerender = true
    └── [slug]/+page.svelte           # Markdown renderer
```

---

## Navigation

### Main Nav

```
┌─────────────────────────────────────────────────────┐
│  🦖 Velociraptor    Showcase  Docs  [Theme] [Auth]  │
└─────────────────────────────────────────────────────┘
```

### Showcase Sidebar

```
┌──────────────┐
│ Showcase     │
├──────────────┤
│ Theme        │
│ UI           │
│   └ Buttons  │
│   └ Inputs   │
│   └ ...      │
│ Forms        │
│ State        │
│ Data         │
│ Files        │
│ i18n         │
│ Animations   │
│ Graph        │
│ API          │
└──────────────┘
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
