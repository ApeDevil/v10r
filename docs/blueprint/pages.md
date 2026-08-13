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
├── /offline                         # Offline fallback (prerendered, top-level)
├── /manifest.webmanifest            # Web app manifest (+server.ts, localized)
│
├── /showcases                       # Living demos
│   ├── +page.svelte                 # Landing with recommended path
│   ├── /shell                       # App shell features
│   │   ├── /style                   # Design tokens, dark/light mode
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
│   │   ├── /menus                   # Dropdown, context, menubar
│   │   ├── /tables                  # Data tables
│   │   ├── /workbench               # Dock workspace (tabs, activity bar)
│   │   └── /splits
│   │       ├── /resizable           # PaneForge resize primitives
│   │       └── /reorderable         # Drag-to-reorder panes
│   ├── /forms                       # Form patterns
│   │   ├── /auth                    # Auth-style form patterns
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
│   ├── /cycle                       # End-to-end create/read/update/delete cycle
│   │   ├── /api                     # CRUD via API
│   │   ├── /form                    # CRUD via forms
│   │   └── /ai                      # CRUD via AI tool calls
│   ├── /db                          # Database showcases
│   │   ├── /relational              # PostgreSQL (Neon)
│   │   │   ├── /types               # Full type system demo
│   │   │   ├── /mutability          # CRUD, versioning, soft delete
│   │   │   └── /connection          # Health check + latency
│   │   ├── /graph                   # Graph database (Neo4j Aura)
│   │   │   ├── /model               # Labels, relationships, graph viz
│   │   │   ├── /traversal           # Path finding, recommendations
│   │   │   └── /connection          # Health check + stats
│   │   ├── /storage                 # Object storage (Cloudflare R2)
│   │   │   ├── /objects             # List, inspect, presigned downloads
│   │   │   ├── /transfer            # Presigned upload, byte-range reads
│   │   │   └── /connection          # Bucket health + stats
│   │   └── /cache                   # Cache layer (Redis/Upstash)
│   │       ├── /patterns            # Caching strategies
│   │       ├── /ephemeral           # Short-lived keys, TTL
│   │       └── /connection          # Cache health check
│   ├── /ai                          # AI integration
│   │   ├── /chat                    # Basic streaming chat interface
│   │   ├── /image-metadata          # Vision: AI proposes metadata, human approves
│   │   │   └── /analyze             # Run a single image analysis
│   │   └── /retrieval               # RAG pipeline
│   │       ├── /rag-chat            # RAG-augmented chat
│   │       ├── /explorer            # Inspect chunks, embeddings, scores
│   │       └── /ingest              # Document ingestion
│   ├── /toolkits                    # Bundled multi-step tools
│   │   └── /image-kit               # Metadata + AI cropper + embedder (no persistence)
│   │       ├── /vision              # AI metadata reader
│   │       ├── /embed               # Image/text embedder
│   │       ├── /crop                # AI frame-cropper
│   │       └── /discard             # Clear and reset the session
│   ├── /auth                        # Authentication showcase
│   │   ├── /authn                   # Authentication: sign-in, sessions
│   │   ├── /authz                   # Authorization: roles, route guards
│   │   └── /users                   # User management
│   ├── /admin                       # Operator transparency (single page)
│   ├── /privacy                     # Data-protection surface
│   │   ├── /data                    # Stored-data inventory
│   │   ├── /retention               # Retention policies
│   │   ├── /rights                  # GDPR rights (access, export, erase)
│   │   └── /cookies                 # Cookie inventory and consent
│   ├── /analytics                   # Privacy-aware analytics
│   │   ├── /overview                # Metrics summary
│   │   ├── /live                    # Real-time activity
│   │   ├── /funnels                 # Conversion funnels
│   │   ├── /journeys                # User journey paths
│   │   ├── /my-data                 # Per-user data view
│   │   └── /privacy                 # Privacy controls, opt-out
│   ├── /abuse                       # Abuse prevention
│   │   ├── /rate-limits             # Rate limiting
│   │   ├── /captcha                 # CAPTCHA challenge
│   │   ├── /honeypot                # Honeypot field trap
│   │   └── /ai-budget               # AI spend caps
│   ├── /notifications               # Notification delivery
│   │   ├── /send                    # Send a notification
│   │   ├── /channels                # Channel configuration
│   │   └── /pipeline                # Delivery pipeline
│   ├── /i18n                        # Internationalization
│   ├── /jobs                        # Background jobs
│   ├── /pwa                         # Installable app shell: manifest, SW, offline, push
│   ├── /viz                         # Data visualization
│   │   ├── /charts                  # Chart types
│   │   ├── /plots                   # Plot types
│   │   ├── /graphs                  # Graph/network viz
│   │   ├── /diagrams                # Diagram types
│   │   └── /maps                    # Map visualizations
│   └── /3d                          # 3D experiences (Threlte 8)
│       ├── /static-scene            # Static 3D scene
│       ├── /animated-scene          # Animated 3D scene (useTask)
│       ├── /customize               # Configure a model
│       │   └── /[model]             # Per-model customizer
│       └── /[model]                 # Per-model viewer
│
├── /account                         # Protected personal area (4 tabs)
│   ├── /dashboard                   # User home
│   ├── /settings                    # Preferences + data & danger zone
│   ├── /notifications               # Notification center (+ /settings)
│   ├── /security                    # Passkeys, TOTP, sessions
│   └── /data                        # GDPR transparency mirror (export)
│
├── /auth                            # Authentication
│   ├── /login                       # Email entry + OAuth
│   └── /verify                      # OTP code entry
│
└── /docs                            # Static documentation
    ├── /blueprint                   # System patterns ([...slug])
    ├── /foundation                  # Project goals ([slug])
    ├── /programming                 # Language/runtime notes ([slug])
    └── /stack                       # Technology decisions ([slug])
```

---

## Error Boundary Structure

Every route group should have an `+error.svelte` file for graceful error handling.

### Required Error Boundaries

| Location | Purpose | Context |
|----------|---------|---------|
| `/+error.svelte` | Root fallback | Generic error, "Go home" link |
| `/account/+error.svelte` | Authenticated area | Maintains app shell, "Back to dashboard" |
| `/auth/+error.svelte` | Auth flows | Clean layout, "Try again" link |
| `/showcases/+error.svelte` | Showcase area | Shows error within showcase layout |

### Error Boundary File Structure

```
src/routes/
├── +error.svelte              # Root fallback (REQUIRED)
├── +layout.svelte
│
├── auth/
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
routes/[[locale=locale]]/account/
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
<!-- src/routes/[[locale=locale]]/account/+error.svelte (App area - keeps shell) -->
<script>
  import { page } from '$app/state';
</script>

<!-- This renders inside AppShell layout -->
<div class="error-content">
  <h1>Error {page.status}</h1>
  <p>{page.error?.message || 'Something went wrong'}</p>
  <a href="/account/dashboard">Back to dashboard</a>
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

Entry point into all 19 showcase cards, grouped into five domain sections derived from each card's `domain` field (`groupByDomain()` in the registry).

**Page content:**
- Sticky `PageHeader` (title + description), height bound for anchor scroll-margin
- Jump-nav linking to each domain section's anchor
- One `<section>` per domain, cards rendered as `LinkCard`s (icon, title, description, sublinks) in a `NavGrid`

**Domains (registry order):**

| Domain | Cards |
|--------|-------|
| Frontend | Shell, UI, Forms, Viz, 3D, i18n, PWA |
| Backend | Cycle, Jobs, Notifications |
| Data | DB, Analytics |
| AI | AI, Toolkits, MCP |
| Security & Privacy | Auth, Abuse, Privacy, Admin |

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
| `/style` | Color palette, design tokens, dark/light toggle, CSS variables |
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
| `/layouts` | Stack, cluster, grid, sidebar, center layouts; Surface (Tonal) Elevation demo — rim/glow/fill channels, relative `parent + 1` engine (see [design/tokens.md](./design/tokens.md#surface-tonal-elevation)) |
| `/tokens` | Color swatches, spacing scale, shadow scale |
| `/menus` | Dropdown, context, and menubar menus |
| `/tables` | Data tables: sorting, selection, density |
| `/workbench` | Dock workspace with tabs and activity bar |
| `/splits/resizable` | PaneForge resize primitives |
| `/splits/reorderable` | Drag-to-reorder panes |

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
| `/auth` | Auth-style form patterns (sign-in fields, validation) |
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

### /showcases/cycle

End-to-end create/read/update/delete cycle, demonstrated three ways over the same entity.

| Tests | Stack |
|-------|-------|
| API CRUD | SvelteKit endpoints, JSON contract |
| Form CRUD | Superforms + Valibot + form actions |
| AI CRUD | AI SDK tool calls drive the same mutations |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/api` | Create, read, update, delete through API endpoints |
| `/form` | The same cycle through progressively-enhanced forms |
| `/ai` | The same cycle driven by AI tool calls |

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
| `/types` | Full Postgres type system: JSON, arrays, enums, UUID, timestamps |
| `/mutability` | CRUD operations, soft delete, versioning, audit trail |
| `/connection` | Neon health check, connection latency, pool stats |

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
| `/model` | Labels, relationship types, full graph visualization |
| `/traversal` | Path finding, shortest path, recommendations |
| `/connection` | Aura health check, driver stats |

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
| `/objects` | List objects, inspect metadata, generate presigned download URLs |
| `/transfer` | Presigned upload flow, byte-range requests with hex dump |
| `/connection` | R2 health check, bucket stats, object count, reseed action |

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
| `/patterns` | Cache-aside, write-through, invalidation strategies |
| `/ephemeral` | Short-lived keys, TTL demonstration, expiry inspection |
| `/connection` | Cache provider health check, latency, key count |

---

### /showcases/ai

Architecture x-ray of the two AI surfaces (see [ai/surfaces.md](./ai/surfaces.md)). Two sibling pages with an identical 8-anchor skeleton (`#spine #guard #prompt #nrag #tools #verify|#approval #stream #awareness`), driven by recorded trace fixtures — fully readable signed-out, zero `+page.server.ts` (leak-gate enforced).

| Tests | Stack |
|-------|-------|
| Recorded trace playback | Pure `reduceTurn` reducer, seekable scrubber |
| Manifest-derived tool matrix | `TOOL_MANIFEST` (`$lib/types/ai-tools.ts`), drift tests |
| Interactive approval halt | Real `PlanCard` at the deskbot fixture's one-door stop |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/chatbot` | The v10r-expert surface layer by layer: guard chain, prompt tape, retrieval profile (tier-1 live, tiers 2–3 dormant), read-only tool set, citation verification |
| `/deskbot` | The in-desk operator layer by layer: scoped desk tools, proposal state machine, approval replay as a second stack, desk-awareness |

Retired 2026-08 (308 stubs until 2026-11): `/chat`, `/retrieval`, `/retrieval/rag-chat`, `/retrieval/explorer`, `/retrieval/ingest` (retrieval pedagogy lives in each page's `#nrag` section); `/image-metadata` moved to `/showcases/toolkits/image-metadata`.

---

### /showcases/toolkits

Bundled, multi-step tools: upload once, run an AI pipeline, adjust the results, then approve. **Nothing is saved.** The first toolkit is Image Kit.

| Tests | Stack |
|-------|-------|
| Merged vision call | Vercel AI SDK v6 `generateText` + `Output.object` |
| Server-authoritative geometry | Pure `snapToAspect` (model gives a hint, server derives pixels) |
| Image processing | sharp (crop derivatives + `attention` saliency baseline) |
| Embeddings | `gemini-embedding-001` (text) / `gemini-embedding-2-preview` (image) |
| Ephemeral storage | Cloudflare R2 (`showcase/imagekit/` prefix, TTL-expirable) |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/image-kit` | One upload → Run → adjust → Approve over three tools: AI metadata reader, AI frame-cropper (1:1 / 16:9 / 9:16), image embedder with cosine-similarity viz. Auth-gated, persists nothing. See [ai/image-kit.md](./ai/image-kit.md) |
| `/image-kit/vision` | AI metadata reader step |
| `/image-kit/embed` | Image/text embedder with cosine-similarity viz |
| `/image-kit/crop` | AI frame-cropper (1:1 / 16:9 / 9:16) |
| `/image-kit/discard` | Clear the session and reset all tools |
| `/image-metadata` | Vision: upload an image, AI proposes metadata, human reviews + approves before save (opt-in GPS). Analysis runs via `POST /api/ai/images/[id]/analyze` (behind `guardAiRequest`). See [ai/image-metadata.md](./ai/image-metadata.md) |

---

### /showcases/auth

Authentication showcase using Better Auth. Demonstrates authentication, authorization, and user management.

| Tests | Stack |
|-------|-------|
| Authentication | Better Auth sessions, sign-in/out |
| Authorization | Roles, admin gating, route guards |
| User management | User listing and admin actions |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/authn` | Sign-in flow, live session data, token inspection, sign-out |
| `/authz` | Roles, admin gating, per-route guards, access denial |
| `/users` | User listing and management |

---

### /showcases/admin

Operator transparency: what the single admin can see and do, and the code-enforced guarantees that limit it. Single page, no sub-routes.

| Tests | Stack |
|-------|-------|
| Role gating | `ADMIN_USER_ID` gate, `isAdmin`, 404-not-403, append-only audit |

---

### /showcases/privacy

The data-protection surface: controller, lawful basis, retention, and your rights.

| Tests | Stack |
|-------|-------|
| Data governance | Cookie/data inventory, retention, GDPR rights |

**Sub-pages:**

| Route | Purpose |
|-------|-------|
| `/cookies` | Cookie inventory and consent state |
| `/data` | Inventory of data stored about a user |
| `/retention` | Retention policies and schedules |
| `/rights` | GDPR rights: access, export, erase |

---

### /showcases/analytics

Privacy-aware analytics: metrics with per-user transparency and opt-out.

| Tests | Stack |
|-------|-------|
| Aggregate metrics | Server-side aggregation |
| Real-time activity | Live event stream |
| Privacy controls | Per-user view, opt-out |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/overview` | Headline metrics summary |
| `/live` | Real-time activity feed |
| `/funnels` | Conversion funnel analysis |
| `/journeys` | User journey paths |
| `/my-data` | Per-user view of collected analytics |
| `/privacy` | Privacy controls and opt-out |

---

### /showcases/abuse

Abuse prevention: rate limiting, bot defenses, and AI spend caps.

| Tests | Stack |
|-------|-------|
| Rate limiting | Redis counters, sliding window |
| Bot defense | CAPTCHA, honeypot field |
| Cost control | AI budget caps |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/rate-limits` | Request rate limiting and throttling |
| `/captcha` | CAPTCHA challenge flow |
| `/honeypot` | Hidden honeypot field bot trap |
| `/ai-budget` | AI spend caps and budget enforcement |

---

### /showcases/notifications

Notification delivery: send, channel routing, and the delivery pipeline.

| Tests | Stack |
|-------|-------|
| Send | Notification dispatch |
| Channels | Channel configuration and routing |
| Pipeline | Multi-stage delivery |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/send` | Send a notification |
| `/channels` | Channel configuration |
| `/pipeline` | Delivery pipeline stages |

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

### /showcases/pwa

Installable app shell: manifest, service worker, offline fallback, update flow, and web push. Single page — the living demo for [blueprint/pwa.md](./pwa.md).

| Tests | Stack |
|-------|-------|
| Installability | Web app manifest, generated icons |
| Offline fallback | Service worker precache, `/offline` |
| Update flow | `$app/state` `updated`, toast action |
| Web push | Subscribe/unsubscribe, VAPID |

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

3D experiences with Threlte 8. No vanilla Three.js render loop and no physics engine.

| Tests | Stack |
|-------|-------|
| 3D scene setup | Threlte 8 (declarative Three.js) |
| Static geometry | Meshes, materials, lighting |
| Animations | Threlte `useTask` per-frame updates |
| Model loading | GLTF, interaction |
| Part explorer | Click-to-inspect: theme-accent outline + ghosting, camera fly-to, photo info panel + lightbox (sofa) |

**Sub-pages:**

| Route | Purpose |
|-------|---------|
| `/static-scene` | Static geometry, lighting, camera controls |
| `/animated-scene` | Per-frame animation via `useTask`, interaction |
| `/customize` | Configure a model |
| `/customize/[model]` | Per-model customizer |
| `/[model]` | Per-model viewer; `glam-velvet-sofa` adds click-to-inspect part exploration (`?part=` deep-link) |

---

## Protected Pages

### /account/*

All routes under `/account` require authentication.

**Protection per-route** (not layout - see [auth.md](./auth.md#route-protection)):
```ts
// /account/dashboard/+page.server.ts
import { requireAuth } from '$lib/server/auth/guard';

export async function load(event) {
  const { user } = await requireAuth(event);
  return { user };
}
```

### /account/dashboard

User's authenticated home.

| Tests | Technology | Provider |
|-------|------------|----------|
| Session | Database sessions | Better Auth + [Neon](../stack/vendors.md#neon) |
| User data | `auth.api.getSession()` | Better Auth |
| Protected content | Per-route guards | SvelteKit |

### /account/settings

User configuration (preferences & settings) with form handling.

| Tests | Technology | Provider |
|-------|------------|----------|
| Form + auth | Combined patterns | Superforms + Better Auth |
| User updates | ORM mutations | Drizzle |
| Theme preference | Database storage | [Neon](../stack/vendors.md#neon) |

### /account

GDPR compliance routes.

| Route | Purpose |
|-------|---------|
| `/account` | Account overview |
| `/account/data` | View stored data; data export served by `/api/me/data/export` |
| `/account/security` | Sessions, passkeys, account deletion |

---

## Auth Pages

### /auth/login

| Tests | Technology | Provider |
|-------|------------|----------|
| Magic link | Email link auth | Better Auth |
| OTP | 6-digit code | Better Auth |
| OAuth | OAuth 2.0 | Better Auth (20+ providers) |
| Session creation | Database sessions | [Neon](../stack/vendors.md#neon) |
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

## PWA Routes

Top-level — outside the locale tree, supporting the installable app shell. See [blueprint/pwa.md](./pwa.md) for the full design.

| Route | Purpose |
|-------|---------|
| `/offline` | Prerendered, self-contained, tri-lingual fallback the service worker serves for offline navigation |
| `/manifest.webmanifest` | `+server.ts` — dynamic manifest; `name`/`description` follow the Paraglide cookie locale |

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
├── offline/+page.svelte               # Offline fallback (prerendered)
├── manifest.webmanifest/+server.ts    # Web app manifest
│
├── showcases/
│   ├── +page.svelte                  # Showcase landing
│   ├── +error.svelte                 # Showcase error boundary
│   ├── shell/                        # App shell features
│   │   ├── style/+page.svelte
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
│   │   ├── menus/+page.svelte
│   │   ├── tables/+page.svelte
│   │   ├── workbench/+page.svelte
│   │   └── splits/
│   │       ├── resizable/+page.svelte
│   │       └── reorderable/+page.svelte
│   ├── forms/
│   │   ├── auth/+page.svelte
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
│   ├── cycle/
│   │   ├── api/+page.svelte
│   │   ├── form/+page.svelte
│   │   └── ai/+page.svelte
│   ├── db/                           # Database showcases
│   │   ├── relational/
│   │   │   ├── types/+page.svelte
│   │   │   ├── mutability/+page.svelte
│   │   │   └── connection/+page.svelte
│   │   ├── graph/
│   │   │   ├── model/+page.svelte
│   │   │   ├── traversal/+page.svelte
│   │   │   └── connection/+page.svelte
│   │   ├── storage/
│   │   │   ├── objects/+page.svelte
│   │   │   ├── transfer/+page.svelte
│   │   │   └── connection/+page.svelte
│   │   └── cache/
│   │       ├── patterns/+page.svelte
│   │       ├── ephemeral/+page.svelte
│   │       └── connection/+page.svelte
│   ├── ai/
│   │   ├── chat/+page.svelte
│   │   ├── image-metadata/
│   │   │   ├── +page.svelte
│   │   │   └── analyze/+page.svelte
│   │   └── retrieval/
│   │       ├── +page.svelte
│   │       ├── rag-chat/+page.svelte
│   │       ├── explorer/+page.svelte
│   │       └── ingest/+page.svelte
│   ├── toolkits/
│   │   └── image-kit/
│   │       ├── +page.svelte
│   │       ├── vision/+page.svelte
│   │       ├── embed/+page.svelte
│   │       ├── crop/+page.svelte
│   │       └── discard/+page.svelte
│   ├── auth/
│   │   ├── authn/+page.svelte
│   │   ├── authz/+page.svelte
│   │   └── users/+page.svelte
│   ├── admin/+page.svelte
│   ├── privacy/
│   │   ├── data/+page.svelte
│   │   ├── retention/+page.svelte
│   │   ├── rights/+page.svelte
│   │   └── cookies/+page.svelte
│   ├── analytics/
│   │   ├── overview/+page.svelte
│   │   ├── live/+page.svelte
│   │   ├── funnels/+page.svelte
│   │   ├── journeys/+page.svelte
│   │   ├── my-data/+page.svelte
│   │   └── privacy/+page.svelte
│   ├── abuse/
│   │   ├── rate-limits/+page.svelte
│   │   ├── captcha/+page.svelte
│   │   ├── honeypot/+page.svelte
│   │   └── ai-budget/+page.svelte
│   ├── notifications/
│   │   ├── send/+page.svelte
│   │   ├── channels/+page.svelte
│   │   └── pipeline/+page.svelte
│   ├── i18n/+page.svelte
│   ├── jobs/+page.svelte
│   ├── pwa/+page.svelte
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
│       ├── animated-scene/+page.svelte
│       ├── customize/
│       │   ├── +page.svelte
│       │   └── [model]/+page.svelte
│       └── [model]/+page.svelte
│
├── app/
│   ├── +layout.server.ts             # Auth guard
│   ├── dashboard/+page.svelte
│   ├── settings/+page.svelte
│   └── account/
│       ├── +page.svelte
│       ├── data/+page.svelte         # View stored data
│       └── security/+page.svelte     # Sessions, passkeys, deletion
│
├── auth/
│   ├── login/+page.svelte
│   └── verify/+page.svelte
│
└── docs/
    ├── blueprint/[...slug]/+page.svelte    # Markdown renderer (+page.server.ts)
    ├── foundation/[slug]/+page.svelte
    ├── programming/[slug]/+page.svelte
    └── stack/[slug]/+page.svelte
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
│   └ Style          │
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
│   └ Menus          │
│   └ Tables         │
│   └ Workbench      │
│   └ Splits         │
│ Forms              │
│   └ Auth           │
│   └ Basics         │
│   └ Validation     │
│   └ Advanced       │
│   └ Patterns       │
│ Cycle              │
│   └ API            │
│   └ Form           │
│   └ AI             │
│ DB                 │
│   └ Relational     │
│   └ Graph          │
│   └ Storage        │
│   └ Cache          │
│ AI                 │
│   └ Chat           │
│   └ Image Metadata │
│   └ Retrieval      │
│ Toolkits           │
│   └ Image Kit      │
│ Auth               │
│   └ Authn          │
│   └ Authz          │
│   └ Users          │
│ Admin              │
│ Privacy            │
│   └ Data           │
│   └ Retention      │
│   └ Rights         │
│   └ Cookies        │
│ Analytics          │
│ Abuse              │
│ Notifications      │
│ i18n               │
│ Jobs               │
│ Pwa                │
│ Viz                │
│ 3D                 │
└────────────────────┘
```

---

## Summary

| Area | Routes | Primary Tests |
|------|--------|---------------|
| Showcase | 90+ pages | All stack features |
| Protected | 4 pages | Sessions, GDPR |
| Auth | 2 pages | Sessions, forms |
| Docs | Dynamic | Prerendering, markdown |

The showcase pages form a comprehensive test suite. If all pages render correctly, the entire stack works.
