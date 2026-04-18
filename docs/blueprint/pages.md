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
├── /showcases                       # Living demos
│   ├── +page.svelte                 # Landing with recommended path
│   ├── /shell                       # App shell features
│   │   ├── /theme                   # Design tokens, dark/light mode
│   │   ├── /sidebar                 # Sidebar navigation
│   │   ├── /modals                  # Modal dialogs
│   │   ├── /toasts                  # Toast notifications
│   │   ├── /shortcuts               # Keyboard shortcuts
│   │   ├── /errors                  # Error boundaries
│   │   └── /session                 # Session state
│   ├── /ui                          # Component gallery
│   │   ├── /components
│   │   │   ├── /primitives          # Buttons, inputs, badges
│   │   │   └── /composites          # Alerts, cards, menus
│   │   ├── /decorative
│   │   │   ├── /backgrounds         # Background patterns
│   │   │   └── /ornaments           # Decorative elements
│   │   ├── /typography              # Headings, body, lead
│   │   ├── /layouts                 # Stack, cluster, grid
│   │   ├── /tokens                  # Colors, spacing, shadows
│   │   └── /panes
│   │       ├── /panels              # Dock system (tabs, splits, activity bar)
│   │       ├── /resizable           # PaneForge resize primitives
│   │       └── /reorderable         # Drag-to-reorder panes
│   ├── /forms                       # Form patterns
│   │   ├── /basics
│   │   │   ├── /contact             # Simple contact form
│   │   │   └── /settings            # Settings form
│   │   ├── /validation
│   │   │   ├── /realtime            # Client-side live validation
│   │   │   ├── /async               # Async field validation
│   │   │   └── /server              # Server-side validation errors
│   │   ├── /advanced
│   │   │   ├── /confirm             # Confirmation dialogs
│   │   │   ├── /edit                # Edit-in-place
│   │   │   └── /reset               # Form reset patterns
│   │   └── /patterns
│   │       ├── /dependent           # Dependent field logic
│   │       ├── /dynamic             # Dynamic field lists
│   │       └── /wizard              # Multi-step wizard
│   ├── /db                          # Database showcases
│   │   ├── /relational              # PostgreSQL (Neon)
│   │   │   ├── /connection          # Health check + latency
│   │   │   ├── /types               # Full type system demo
│   │   │   └── /mutability          # CRUD, versioning, soft delete
│   │   ├── /graph                   # Graph database (Neo4j Aura)
│   │   │   ├── /connection          # Health check + stats
│   │   │   ├── /model               # Labels, relationships, graph viz
│   │   │   └── /traversal           # Path finding, recommendations
│   │   ├── /storage                 # Object storage (Cloudflare R2)
│   │   │   ├── /connection          # Bucket health + stats
│   │   │   ├── /objects             # List, inspect, presigned downloads
│   │   │   └── /transfer            # Presigned upload, byte-range reads
│   │   └── /cache                   # Cache layer (Redis/Upstash)
│   │       ├── /connection          # Cache health check
│   │       ├── /ephemeral           # Short-lived keys, TTL
│   │       └── /patterns            # Caching strategies
│   ├── /ai                          # AI integration
│   │   ├── /connection              # Provider health + config
│   │   ├── /chat                    # Basic chat interface
│   │   ├── /streaming               # Streaming text responses
│   │   └── /retrieval               # RAG pipeline
│   │       ├── /ingest              # Document ingestion
│   │       ├── /chat                # RAG-augmented chat
│   │       ├── /contextual          # Contextual retrieval
│   │       ├── /parent-child        # Parent-child chunking
│   │       └── /graph               # Graph-based retrieval
│   ├── /auth                        # Authentication showcase
│   │   ├── /connection              # Provider health check
│   │   ├── /security                # Security features demo
│   │   └── /session                 # Session inspection
│   ├── /i18n                        # Internationalization
│   ├── /jobs                        # Background jobs
│   ├── /viz                         # Data visualization
│   │   ├── /charts                  # Chart types
│   │   ├── /plots                   # Plot types
│   │   ├── /graphs                  # Graph/network viz
│   │   ├── /diagrams                # Diagram types
│   │   └── /maps                    # Map visualizations
│   └── /3d                          # 3D experiences (Threlte + Three.js)
│       ├── /static-scene            # Static 3D scene
│       └── /animated-scene          # Animated 3D scene
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

### /showcases (Landing Page)

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
| 1 | Fundamentals | Shell | Theme, sidebar, modals, toasts |
| 2 | Fundamentals | UI | Component library, accessibility |
| 3 | Fundamentals | Forms | Validation, progressive enhancement |
| 4 | Core | DB: PostgreSQL | Types, mutability patterns, Neon connection |
| 5 | Core | DB: Neo4j | Graph modeling, traversal, recommendations |
| 6 | Core | DB: Storage | R2 objects, presigned URLs, byte-range requests |
| 7 | Core | DB: Cache | Redis patterns, TTL, cache strategies |
| 8 | Core | Auth | Authentication flows, session inspection |
| 9 | Advanced | AI | Chat, streaming, RAG pipeline |
| 10 | Advanced | i18n | Translations, locale routing |
| 11 | Advanced | Viz | Charts, plots, graphs, diagrams, maps |
| 12 | Specialized | 3D | Threlte scenes, Three.js |
| 13 | Specialized | Jobs | Background job patterns |

---

### /showcases/shell

App shell features: theming, navigation, overlays, and session.

| Tests | Stack |
|-------|-------|
| Theme toggle | `$state`, localStorage, `prefers-color-scheme` |
| Sidebar navigation | SvelteKit routing, Svelte 5 state |
| Modal system | Bits UI dialog primitives |
| Toast system | Notification stack, auto-dismiss |
| Keyboard shortcuts | `$effect`, `keydown` listeners |
| Error boundaries | `<svelte:boundary>`, `+error.svelte` |
| Session display | Better Auth session data |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/theme` | Color palette, design tokens, dark/light toggle, CSS variables |
| `/sidebar` | Sidebar navigation patterns, collapsible groups, active states |
| `/modals` | Dialog, drawer, popover, alert dialog |
| `/toasts` | Success, error, info toasts with queue management |
| `/shortcuts` | Global keyboard shortcut registration and display |
| `/errors` | Error boundary patterns, fallback UI, recovery flows |
| `/session` | Session inspection, user data display, sign-out |

---

### /showcases/ui

Component gallery covering every UI primitive and composite.

| Tests | Stack |
|-------|-------|
| Headless components | Bits UI |
| Atomic CSS | UnoCSS utilities |
| Accessibility | ARIA, keyboard navigation |
| Decorative | Background patterns, ornaments |
| Layout primitives | Stack, cluster, grid, center |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/components/primitives` | Buttons, inputs, badges, avatars, checkboxes, radios |
| `/components/composites` | Alerts, cards, menus, tables, navigation |
| `/decorative/backgrounds` | Background pattern components |
| `/decorative/ornaments` | Decorative shape and divider elements |
| `/typography` | Headings, body copy, lead text, prose |
| `/layouts` | Stack, cluster, grid, sidebar, center layouts |
| `/tokens` | Color swatches, spacing scale, shadow scale |
| `/panes/panels` | Dock system with tabs, splits, activity bar |
| `/panes/resizable` | PaneForge resize primitives |
| `/panes/reorderable` | Drag-to-reorder panes |

---

### /showcases/forms

Form handling with validation and progressive enhancement.

| Tests | Stack |
|-------|-------|
| Form library | Superforms |
| Validation | Valibot schemas |
| Server actions | SvelteKit form actions |
| Error handling | Field errors, form errors |
| Loading states | Submission pending |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/basics/contact` | Simple contact form, text inputs, submit |
| `/basics/settings` | Settings form with toggles and selects |
| `/validation/realtime` | Live client-side validation as user types |
| `/validation/async` | Async field validation (e.g. username availability) |
| `/validation/server` | Server-side validation errors returned to client |
| `/advanced/confirm` | Confirmation dialog before destructive submit |
| `/advanced/edit` | Edit-in-place with inline form |
| `/advanced/reset` | Form reset and dirty-state detection |
| `/patterns/dependent` | Fields that depend on other field values |
| `/patterns/dynamic` | Dynamic field arrays (add/remove rows) |
| `/patterns/wizard` | Multi-step form with progress and back navigation |

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

### /showcases/db/relational

PostgreSQL showcase using Neon serverless. Three sub-pages under the DB hub.

| Tests | Technology | Provider |
|-------|------------|----------|
| Serverless connection | `@neondatabase/serverless` | Neon |
| Schema + queries | Drizzle ORM | Neon |
| Type system | Full Postgres type coverage | Drizzle |
| CRUD | Insert, select, update, delete | Drizzle |
| Versioning | Temporal tables, audit log | Drizzle |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | Neon health check, connection latency, pool stats |
| `/types` | Full Postgres type system: JSON, arrays, enums, UUID, timestamps |
| `/mutability` | CRUD operations, soft delete, versioning, audit trail |

---

### /showcases/db/graph

Graph database showcase using Neo4j Aura.

| Tests | Technology | Provider |
|-------|------------|----------|
| Graph queries | Cypher | Neo4j Aura |
| Visualization | Graph rendering | neo4j-driver |
| Relationships | Graph traversal | neo4j-driver |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | Aura health check, driver stats |
| `/model` | Labels, relationship types, full graph visualization |
| `/traversal` | Path finding, shortest path, recommendations |

---

### /showcases/db/storage

Object storage showcase (Cloudflare R2). Three sub-pages under the DB hub.

| Tests | Technology | Provider |
|-------|------------|----------|
| S3 client setup | @aws-sdk/client-s3 | Cloudflare R2 |
| Presigned URLs | @aws-sdk/s3-request-presigner | Cloudflare R2 |
| Byte-range reads | GetObject with Range header | Cloudflare R2 |
| Upload flow | Presigned PUT + confirm | SvelteKit form actions |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | R2 health check, bucket stats, object count, reseed action |
| `/objects` | List objects, inspect metadata, generate presigned download URLs |
| `/transfer` | Presigned upload flow, byte-range requests with hex dump |

**Upload flow:**
```
Client                    Server                    R2
  │                         │                        │
  ├── Request upload URL ──▶│                        │
  │                         ├── Validate + presign ─▶│
  │◀── Presigned PUT URL ───┤                        │
  │                         │                        │
  ├── PUT file directly ────┼───────────────────────▶│
  │                         │                        │
  ├── Confirm upload ──────▶│                        │
  │                         ├── HeadObject verify ──▶│
  │◀── Upload result ───────┤                        │
```

---

### /showcases/db/cache

Cache layer showcase. Three sub-pages covering connection, ephemeral keys, and caching strategies.

| Tests | Stack |
|-------|-------|
| Cache connection | Redis/Upstash client |
| Key-value operations | GET, SET, DEL |
| TTL management | Expiring keys |
| Caching patterns | Cache-aside, write-through, invalidation |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | Cache provider health check, latency, key count |
| `/ephemeral` | Short-lived keys, TTL demonstration, expiry inspection |
| `/patterns` | Cache-aside, write-through, invalidation strategies |

---

### /showcases/ai

AI integration showcase using the Vercel AI SDK. Covers basic chat through full RAG pipelines.

| Tests | Stack |
|-------|-------|
| Provider connection | Vercel AI SDK |
| Chat interface | Streaming text, message history |
| Streaming | Server-sent events, partial rendering |
| RAG pipeline | Embeddings, vector search, retrieval |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | AI provider health check, model list, token counts |
| `/chat` | Basic chat interface with message history |
| `/streaming` | Streaming text responses, token-by-token rendering |
| `/retrieval/ingest` | Document ingestion: chunking, embedding, indexing |
| `/retrieval/chat` | RAG-augmented chat with source attribution and pipeline visualization (modes: retrieve / llmwiki, selectable from UI) |
| `/retrieval/contextual` | Contextual retrieval: context-enriched chunk embedding |
| `/retrieval/parent-child` | Parent-child chunking: small retrieval, large context |
| `/retrieval/graph` | Graph-based retrieval: entity extraction, relationship traversal |

---

### /showcases/auth

Authentication showcase using Better Auth. Demonstrates connection health, security features, and session state.

| Tests | Stack |
|-------|-------|
| Provider health | Better Auth |
| Security features | Rate limiting, CSRF, session rotation |
| Session inspection | Better Auth session API |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/connection` | Auth provider health check, adapter status |
| `/security` | Rate limiting, CSRF protection, brute-force defense |
| `/session` | Live session data, token inspection, sign-out |

---

### /showcases/i18n

Internationalization with Paraglide JS. Single page covering the full i18n feature set.

| Tests | Stack |
|-------|-------|
| Translation loading | Paraglide JS |
| Language switching | Route-based locale |
| Date/number formatting | Native `Intl` API |
| Pluralization | Paraglide message variants |

**Page content:**
- Language switcher
- Translated strings
- Pluralization examples
- Date/number formatting
- RTL support demo

---

### /showcases/jobs

Background job patterns. Single page demonstrating job scheduling and status tracking.

| Tests | Stack |
|-------|-------|
| Job enqueueing | SvelteKit server actions |
| Status polling | Periodic fetch |
| Job results | Async resolution display |

---

### /showcases/viz

Data visualization hub. Five sub-pages covering the full range of chart and diagram types.

| Tests | Stack |
|-------|-------|
| Charts | Chart library integration |
| Plots | Statistical plots |
| Network graphs | Force-directed layouts |
| Diagrams | Flow and sequence diagrams |
| Maps | Geographic data rendering |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/charts` | Bar, line, area, pie, donut charts |
| `/plots` | Scatter, bubble, histogram, box plots |
| `/graphs` | Force-directed graph, node-link diagrams |
| `/diagrams` | Flowcharts, sequence diagrams, tree diagrams |
| `/maps` | Geographic maps, choropleth, point data |

---

### /showcases/3d

3D experiences with Threlte and Three.js.

| Tests | Stack |
|-------|-------|
| 3D scene setup | Threlte (Svelte + Three.js) |
| Static geometry | Three.js meshes, materials, lighting |
| Animations | Three.js animation loop, Threlte `useFrame` |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/static-scene` | Static geometry, lighting, camera controls |
| `/animated-scene` | Animated objects, physics, interaction |

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
├── showcases/
│   ├── +page.svelte                  # Showcase landing
│   ├── +error.svelte                 # Showcase error boundary
│   ├── shell/                        # App shell features
│   │   ├── theme/+page.svelte
│   │   ├── sidebar/+page.svelte
│   │   ├── modals/+page.svelte
│   │   ├── toasts/+page.svelte
│   │   ├── shortcuts/+page.svelte
│   │   ├── errors/+page.svelte
│   │   └── session/+page.svelte
│   ├── ui/                           # Component gallery
│   │   ├── components/
│   │   │   ├── primitives/+page.svelte
│   │   │   └── composites/+page.svelte
│   │   ├── decorative/
│   │   │   ├── backgrounds/+page.svelte
│   │   │   └── ornaments/+page.svelte
│   │   ├── typography/+page.svelte
│   │   ├── layouts/+page.svelte
│   │   ├── tokens/+page.svelte
│   │   └── panes/
│   │       ├── panels/+page.svelte
│   │       ├── resizable/+page.svelte
│   │       └── reorderable/+page.svelte
│   ├── forms/
│   │   ├── basics/
│   │   │   ├── contact/+page.svelte
│   │   │   └── settings/+page.svelte
│   │   ├── validation/
│   │   │   ├── realtime/+page.svelte
│   │   │   ├── async/+page.svelte
│   │   │   └── server/+page.svelte
│   │   ├── advanced/
│   │   │   ├── confirm/+page.svelte
│   │   │   ├── edit/+page.svelte
│   │   │   └── reset/+page.svelte
│   │   └── patterns/
│   │       ├── dependent/+page.svelte
│   │       ├── dynamic/+page.svelte
│   │       └── wizard/+page.svelte
│   ├── db/                           # Database showcases
│   │   ├── relational/
│   │   │   ├── connection/+page.svelte
│   │   │   ├── types/+page.svelte
│   │   │   └── mutability/+page.svelte
│   │   ├── graph/
│   │   │   ├── connection/+page.svelte
│   │   │   ├── model/+page.svelte
│   │   │   └── traversal/+page.svelte
│   │   ├── storage/
│   │   │   ├── connection/+page.svelte
│   │   │   ├── objects/+page.svelte
│   │   │   └── transfer/+page.svelte
│   │   └── cache/
│   │       ├── connection/+page.svelte
│   │       ├── ephemeral/+page.svelte
│   │       └── patterns/+page.svelte
│   ├── ai/
│   │   ├── connection/+page.svelte
│   │   ├── chat/+page.svelte
│   │   ├── streaming/+page.svelte
│   │   └── retrieval/
│   │       ├── ingest/+page.svelte
│   │       ├── chat/+page.svelte
│   │       ├── contextual/+page.svelte
│   │       ├── parent-child/+page.svelte
│   │       └── graph/+page.svelte
│   ├── auth/
│   │   ├── connection/+page.svelte
│   │   ├── security/+page.svelte
│   │   └── session/+page.svelte
│   ├── i18n/+page.svelte
│   ├── jobs/+page.svelte
│   ├── viz/
│   │   ├── +page.svelte
│   │   ├── charts/+page.svelte
│   │   ├── plots/+page.svelte
│   │   ├── graphs/+page.svelte
│   │   ├── diagrams/+page.svelte
│   │   └── maps/+page.svelte
│   └── 3d/
│       ├── +page.svelte
│       ├── static-scene/+page.svelte
│       └── animated-scene/+page.svelte
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
┌────────────────────┐
│ Showcase           │
├────────────────────┤
│ Shell              │
│   └ Theme          │
│   └ Sidebar        │
│   └ Modals         │
│   └ Toasts         │
│   └ Shortcuts      │
│   └ Errors         │
│   └ Session        │
│ UI                 │
│   └ Components     │
│   └ Decorative     │
│   └ Typography     │
│   └ Layouts        │
│   └ Tokens         │
│   └ Panes          │
│ Forms              │
│   └ Basics         │
│   └ Validation     │
│   └ Advanced       │
│   └ Patterns       │
│ DB                 │
│   └ Relational     │
│   └ Graph          │
│   └ Storage        │
│   └ Cache          │
│ AI                 │
│   └ Chat           │
│   └ Streaming      │
│   └ Retrieval      │
│ Auth               │
│ i18n               │
│ Jobs               │
│ Viz                │
│ 3D                 │
└────────────────────┘
```

---

## Summary

| Area | Routes | Primary Tests |
|------|--------|---------------|
| Showcase | 50+ pages | All stack features |
| Protected | 4 pages | Sessions, GDPR |
| Auth | 2 pages | Sessions, forms |
| Docs | Dynamic | Prerendering, markdown |

The showcase pages form a comprehensive test suite. If all pages render correctly, the entire stack works.
