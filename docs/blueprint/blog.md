# Blog System Blueprint

> Synthesized from 24 agent consultations (archy, svey, uxy, daty, resy, scout — 2 rounds with cross-pollination, review taskforce with cross-pollination). Branch: `feature/admin-expansion`.

## Vision

A multipurpose markdown editor that lives in the **desk** (DockLayout), with **blog posts as the first content type**. Custom syntax via `remark-directive`, wikilinks for cross-references, rendered through a unified pipeline. DB-backed with immutable revisions, multi-author, i18n, public + authenticated reading.

The editor is content-type-agnostic — blog posts are the first implementation, but the same infrastructure serves notes, docs, announcements, and any future markdown-based content.

---

## Decisions

| Question | Answer | Impact |
|----------|--------|--------|
| Authors | Multi-author | `author` role in Better Auth, per-user draft visibility |
| Reading | Public + authenticated | CDN/ISR for public readers; authenticated users see drafts, edit |
| Comments | Not for now | Keeps schema minimal |
| i18n | Yes | `locale` column on revision — translations are separate revisions |
| Location | Real blog at `/blog/` | Top-level route, not under `/showcases/` |
| Editor host | Desk (DockLayout panels) | Not a standalone admin route |

---

## Custom Markdown Syntax

### Can we extend markdown? Yes.

`remark-directive` implements the [Generic Directives proposal](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444) — a de facto community standard (not formal CommonMark, but implemented across parsers and used in production by Docusaurus, Astro). Three levels:

```markdown
<!-- Inline (single colon) — tagging objects -->
This covers :tag[authentication]{domain=security} concepts.

<!-- Block/leaf (double colon) — embedding components -->
::chart{src="/api/stats/users" type="line"}

<!-- Container (triple colon) — wrapping content -->
:::callout[Warning]
This is **important** content inside the directive.
:::
```

For cross-references between posts: `[[wikilinks]]` via `@flowershow/remark-wiki-link` (Obsidian-compatible). Monitor: Dec 2025 release (v3.3.1) shows active maintenance, but 20 downloads/week means small bug-finding surface. Fallback: `landakram/remark-wiki-link` (500+ stars, 9.5k downloads/week).

**Content portability note**: `::directive` and `:::container` syntax is project-specific, not standard CommonMark. Content exported to other systems will not render these correctly. Document this in the author guide.

### Why not alternatives?

| Approach | Verdict | Reason |
|----------|---------|--------|
| MDsveX | Rejected | Broken with Svelte 5 (generates Svelte 4 component format, issue #555 confirmed), 164 open issues, `@sveltejs/enhanced-img` incompatible, uncertain Bun support |
| marked custom extensions | Rejected for blog | No persistent AST — can't extract references, TOC, or embed metadata without re-parsing. Keep for chat rendering only. |
| Custom regex parser | Rejected | Maintenance burden, edge cases, no ecosystem |
| MDX/JSX in markdown | Rejected | Mixes concerns, XSS surface area, not Svelte-native |

---

## Processing Pipeline

### Architecture: Unified Ecosystem (Server-Side)

```
Markdown (DB text column)
  |
  v
unified()
  .use(remarkParse)                     // markdown -> mdast
  .use(remarkGfm)                       // tables, strikethrough, task lists
  .use(remarkFrontmatter, ['yaml'])     // parse ---yaml--- blocks
  .use(remarkExtractFrontmatter)        // surface frontmatter to vfile.data
  .use(remarkDirective)                 // ::embed[...]{...} syntax
  .use(remarkDirectiveHandlers)         // CUSTOM: visit directives, extract embed descriptors
  .use(remarkWikiLink, { permalinks })  // [[slug]] cross-references
  .use(remarkRehype)                    // mdast -> hast
  .use(rehypeSlug)                      // heading IDs
  .use(rehypeShikiFromHighlighter, h)   // reuse existing Shiki singleton via @shikijs/rehype/core
  .use(rehypeSanitize, schema)          // server-side hast sanitization (replaces DOMPurify)
  .use(rehypeStringify)                 // hast -> HTML string
  |
  v
Output: { html: string, embeds: EmbedDescriptor[], toc: TocEntry[] }
  |
  v
Cached on immutable revision row (never re-processed on read)
```

### Why unified over marked

- **Full AST access**: walk the tree to collect wikilinks (for `post_reference` rows), extract TOC from headers, build cross-reference maps
- **No global state problem**: marked's `setOptions()` writes to a global object; concurrent SSR requests can interfere. Unified pipelines are instance-scoped. (Note: marked now has `new Marked()` instance API, but unified is the correct choice for AST access + plugins regardless.)
- **remark-directive**: standardized custom syntax via the Generic Directives proposal
- **Plugin ecosystem**: 200+ composable plugins for GFM, frontmatter, math, footnotes, etc.
- **Production proven**: 4.4B monthly npm downloads, used by Next.js, Gatsby, Astro, Docusaurus, GitHub, Mozilla, Adobe, Google

### What stays on marked

`renderMarkdown()` in `$lib/utils/markdown.ts` stays as-is for chat rendering. Simple, synchronous, client-safe. No directives or AST access needed there. **Important**: verify that `marked` passes `[1]`, `[2]` citation notation through as literal text without attempting link resolution — if it converts them, the citation system breaks silently.

### Shiki Integration

The project already has a Shiki singleton in `$lib/server/shiki.ts`. Use `@shikijs/rehype/core` which accepts an external `Highlighter` instance — no second instantiation.

```typescript
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { getHighlighter } from '$lib/server/shiki';

const highlighter = await getHighlighter();
// ...pass to unified pipeline
```

### Client-Side Rendering

Blog posts use `{@html}` for prose content + dynamic `import()` for embed components:

```svelte
<!-- blog/[slug]/+page.svelte -->
<article class="prose">
  {@html data.post.html}
</article>

<!-- Embeds hydrated via onMount -->
<!-- Each embed placeholder: <div data-embed="id" data-embed-tag="chart"> -->
```

The embed registry maps `kind -> () => import('$lib/components/blog/embeds/ChartEmbed.svelte')`. Vite tree-shakes unused embeds. Heavy components (charts, 3D) only download when a post actually contains them.

### svelte-exmarkdown: Rejected

Svelte 5 `$state` incompatibility (#296), no async plugin support (#274), only 7 npm dependents. The `{@html}` + hydration approach is lower-risk and production-proven.

---

## Editor: Desk Integration

### Why the desk, not a standalone route

The desk already has a **DockLayout** with a binary split tree (resizable, persistent, drag-and-drop tabs), a panel registry, and an activity bar. The editor fits as a new panel type — not a separate page.

Benefits:
- **Side-by-side everything** — edit markdown in one pane, preview in another, chat with AI about the content in a third, browse assets in a fourth
- **Multipurpose from day one** — the editor panel renders any markdown document. Blog posts first, then notes, docs, announcements
- **No new route for editing** — the desk is already a full-page immersive route in the `(desk)` layout group
- **Existing infrastructure** — `notes` panel is already in the registry, just needs real content

### Default Editor Layout

Opening a blog post for editing (or clicking "New Post") auto-arranges the desk into a **writing layout preset**:

```
+----------------------------+-----------------------------+
|                            |                             |
|   Editor (markdown)        |   Preview (rendered)        |
|                            |                             |
|                            |                             |
|                            |                             |
|                            |                             |
+----------------------------+-----------------------------+
```

The user can then drag Chat, Documents, or anything else into the layout — but the **starting point is opinionated**. No need to assemble panels manually for the primary authoring flow.

Layout presets are a desk-level concept, not blog-specific. The writing preset is the first; others (reviewing, dashboard) follow as use cases emerge.

```typescript
interface LayoutPreset {
  id: string;
  label: string;
  icon: string;
  buildLayout: (context?: { documentId?: string }) => DockNode;
}
```

### Documents Panel (formerly "Files")

The existing `files` panel is renamed to **Documents** (`i-lucide-file-text` icon) — a **generic document browser** where authors find, open, and organize content:

- **Blog posts**: drafts, published, archived — filterable by status, tag, author
- **Notes**: when note-taking lands (future)
- **Documents**: when docs land (future)

Clicking a document opens it in the editor panel. The panel shows a list view grouped by content type, with blog posts as the only type in v1.

**"New Post" button** lives in the Documents panel header — not injected into the activity bar. The activity bar toggles panels; the panel header creates documents.

The Documents panel accepts an optional scope (when opened from a layout preset, it shows blog posts; standalone shows everything), but the simplest v1 just lists all documents the user can edit.

### Editor Toolbar

Three zones:

| Left | Center | Right |
|------|--------|-------|
| Documents button (opens panel), Save button, Save indicator | Bold, Italic, Code, Slash command button, Image button | Preview toggle, Publish/Update button |

**Save indicator** (3-state, always visible):
- Green dot + "Saved 4m ago" — server revision exists, no local changes
- Amber dot + "Unsaved changes" — IndexedDB only, not yet on server
- Spinner + "Saving..." — save in flight

### Publish Flow

1. Author clicks **Publish** button in toolbar (or changes status in MetadataDrawer)
2. Button transitions to inline **"Confirm publish" / "Cancel"** (persistent, not timed — accessible to keyboard/screen reader users)
3. On confirm: triggers `publishPost()` (RAG ingest + Neo4j sync + ISR revalidation)
4. Button label changes to **"Update"** (for already-published posts)
5. **"Unpublish"** available in MetadataDrawer status control

No modal for publish — inline confirmation is sufficient for a reversible action. No timed auto-dismiss — fails WCAG keyboard accessibility (W3C thread #3726).

### Desk Workflow

```
Author opens /desk
  -> Documents panel: click "New" button in panel header
  -> Desk auto-arranges writing layout preset: Editor | Preview
  -> Start writing (no DB record yet — IndexedDB autosave protects)

First explicit save (Cmd+S):
  -> Creates post record + first revision in DB
  -> Save indicator: green "Saved just now"

Subsequent saves: POST /api/blog/[id]/revision (creates new revision)
Preview: auto-updates on content change (cross-panel pub/sub, debounced 300ms)
Publish: toolbar button -> inline confirm -> publishPost()
```

### Editor Paradigm: Source Editor, Never WYSIWYG

WYSIWYG is rejected. Custom syntax (`::chart[]`, `::scene[]`) requires a bespoke ProseMirror node view per embed type. Failures are silent — the editor renders fine but produces corrupted markdown. Source editors have visible, author-recoverable failures.

Scout confirmed: nobody has solved custom syntax round-trip editing cleanly in WYSIWYG. The pragmatic path is source editing with slash commands that auto-insert the syntax.

### Progressive Enhancement (Three Phases)

| Phase | Surface | What it adds |
|-------|---------|-------------|
| **1** | Existing `Textarea` primitive | Slash command palette via Popover, split-pane via PaneGroup |
| **2** | CodeMirror 6 | Atomic undo for slash insertions, `coordsAtPos()` for palette positioning |
| **3** | + Lezer grammar extensions | Custom syntax highlighting in the source pane (~100-300 lines per syntax type) |

Content is paradigm-agnostic — same markdown text, same pipeline, same renderer across all phases. Upgrading the editor surface requires zero content migration.

**CM6 keyboard conflict policy** (Phase 2): CM6 owns shortcuts when the editor is focused; desk shell owns shortcuts when editor is unfocused. `Cmd+S` registered as a CM6 keymap entry — handler calls save function and returns `true` to prevent default. Slash palette `/` must not enter undo stack until a command is committed; dismissal removes `/` via transaction, not undo.

**CM6 build requirement**: `optimizeDeps.exclude: ['@codemirror/*']` in vite.config. Spike this integration before committing to Phase 2.

### Why not Carta

Carta (737 stars, Svelte 5 compatible) was considered but **cannot do custom syntax highlighting** — it's a textarea with its own coloring system, not CodeMirror. No Lezer extension path. Going directly to Textarea -> CodeMirror 6 avoids a dead-end dependency. Skip Carta.

### Slash Commands

Type `/` at line start (or after whitespace) in the editor. A floating Popover opens with a filterable command list:

- **Text**: heading 1-3, paragraph, quote, horizontal rule, code block, callout
- **Embeds**: chart, 3D scene, interactive component, video
- **Content references**: link to post, tag reference

Selecting a command inserts the directive syntax with cursor positioned at the first parameter. For medium-complexity embeds (chart by ID), the Popover transitions to a second panel with a Combobox to search available items. For complex embeds (3D scene with config), a Drawer opens with full FormField configuration.

### Multipurpose Preview Panel

The preview panel is **content-type-agnostic** — it renders whatever the editor panel is showing, delegating to a renderer registry based on document type:

```typescript
const renderers: Record<string, () => Promise<typeof import('*.svelte')>> = {
  'blog-post': () => import('$lib/components/blog/Renderer.svelte'),
  'note':      () => import('$lib/components/editor/SimpleRenderer.svelte'),
  'doc':       () => import('$lib/components/editor/SimpleRenderer.svelte'),
};
```

For blog posts, it runs the unified pipeline and renders with `blog/Renderer.svelte` (prose + hydrated embeds). For notes and docs, a simpler markdown renderer. New content types register a renderer — the preview panel itself never changes.

**Live preview**: the preview panel subscribes to content changes from the editor panel via cross-panel pub/sub (see below). Debounced rendering (300ms after last keystroke). The pipeline runs server-side via `/api/blog/preview` to guarantee the preview is identical to the published output — no bundle size trade-off, no client/server drift. No optimistic client-side `marked` preview — `marked` can't render directives or wikilinks, so the "optimistic" output would be visibly wrong for custom syntax.

**Preview states**:
- **Loading**: spinner with "Updating..." label (appears when debounce fires, before network request)
- **Success**: rendered HTML
- **Error**: last successful render with error banner ("Preview failed: [error]. Fix and save again.")
- **Embed placeholders**: three distinct visual states — skeleton (loading), dashed-border card with type label (placeholder), red-border card with error message (error)

**Full preview** (toolbar button): server-rendered view via the same route the public uses. Honest preview for posts with 3D embeds or `asset://` media that require presigned URL resolution.

### Cross-Panel Communication (DeskBus)

The DockLayout needs typed pub/sub for panels to communicate without direct coupling:

```typescript
// desk-bus.svelte.ts
interface DeskEvents {
  'editor:content': { content: string; type: string; metadata: Record<string, unknown> };
  'editor:document': { documentId: string; type: string };
  'editor:save': { documentId: string; revisionId: string };
}

interface DeskBus {
  publish<K extends keyof DeskEvents>(channel: K, payload: DeskEvents[K]): void;
  subscribe<K extends keyof DeskEvents>(
    channel: K,
    handler: (payload: DeskEvents[K]) => void,
    options?: { replayLast?: boolean }
  ): () => void;
}
```

`replayLast: true` replays the last payload per channel to new subscribers — essential for panels that are closed and re-opened mid-session (preview panel needs current document state on mount).

**Why not `invalidate()`**: SvelteKit's `invalidate()` scopes to the current page's load functions. DockLayout panels are Svelte components within a single page, not separate routes with their own load functions. `invalidate()` is architecturally inapplicable here.

**Why not reactive `$state` store**: The bus serves both continuously-updated values (`editor:content`) and discrete events (`editor:save`). A typed pub/sub handles both use cases cleanly. If splitting becomes necessary later, the typed event map makes that migration straightforward.

Channels:
- `editor:content` — editor emits `{ content, type, metadata }` on change (debounced)
- `editor:document` — editor emits `{ documentId, type }` when a different document opens
- `editor:save` — editor emits after successful save (preview can refresh from server)

This is valuable beyond editor/preview — the chat panel can subscribe to `editor:document` to know what the user is working on, enabling contextual writing suggestions about the current post.

### MetadataDrawer

Accessible via toolbar button. Fields:

| Field | Behavior |
|-------|----------|
| **Title** | Autosaves on blur to `blog.post` (not a revision). Required. |
| **Slug** | Auto-generates from title. Editable with "manual mode" toggle. "Reset to auto" escape. CHECK: `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` |
| **Summary** | Optional excerpt / meta description |
| **Tags** | Multi-select Combobox with chip display. "Create new" affordance when tag not found. |
| **Status** | Segmented control: Draft / Published / Archived. Changing to "Published" triggers inline confirm (same as toolbar Publish). |
| **Locale** | Select for revision locale |
| **Revision history** | Collapsible section showing timestamps + author. "Restore" loads content as unsaved-in-editor (safe, reversible). |

### Content Management (Admin)

The admin area gets a new **Content** tab group for post management (list, filter, bulk actions, status changes). The desk is where authoring happens. Clean separation: **admin = management, desk = creation**.

```
Observe:  DB  |  Analytics  |  Audit Log
Manage:   Users  |  Feature Flags  |  Branding
Content:  Posts  |  Tags  |  Media Library
System:   Jobs  |  Notifications  |  RAG  |  Cache
```

Posts list follows the canonical admin data table pattern: URL-as-state, GET form for search/filter, anchor links for sort headers, Pagination composite. Admin content management uses **form actions** for CSRF protection and `use:enhance`.

### Accessibility

- Textarea is the most accessible editing surface (native form element, unambiguous tab order, screen reader compatible)
- Slash command palette: ARIA combobox pattern (same as existing Combobox primitive)
- Embed placeholder cards: `aria-label="Chart embed: sales-2024"` for screen reader users
- Focus management: palette open/close returns focus to editor cursor, Drawer traps focus
- Preview pane: `role="region"` with `aria-label="Post preview"` and `aria-live="polite"`
- Publish confirmation: persistent inline (not timed) — keyboard and screen reader accessible

---

## Shared Syntax Definitions

Custom syntax must be understood by both the remark pipeline (server rendering) and CodeMirror (editor highlighting). If these drift, authors see one thing in the editor and another in the preview.

Dual-definition is structurally unavoidable — Lezer and micromark are architecturally incompatible parser models. The mitigation is a **shared specification** that both consumers translate independently.

```
$lib/content-syntax/
  index.ts              # Canonical syntax definitions (declarative)
  remark-adapter.ts     # Definitions -> remark-directive handlers
  codemirror-adapter.ts # Definitions -> CM6 decorations (Phase 3)
```

The canonical definition:

```typescript
export const syntaxes = {
  callout: {
    directive: 'container',    // remark-directive type (:::)
    name: 'callout',
    requiredAttrs: ['type'],   // 'info' | 'warning' | 'error'
    hasContent: true,
    embedKind: 'callout',
  },
  chart: {
    directive: 'leaf',         // remark-directive type (::)
    name: 'chart',
    requiredAttrs: ['src'],
    hasContent: false,
    embedKind: 'chart',
  },
} as const;
```

Adding a new syntax = add one entry to the definition + one embed component. Both adapters pick it up automatically.

Drift prevention: integration tests comparing Lezer's detected node ranges to remark's mdast node positions for the same input.

---

## Data Model

### Schema: `blog` (8 Tables for v1)

All tables in `pgSchema('blog')`, following the existing pattern.

#### `blog.post` — Aggregate Root

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | `pst_` prefix |
| `slug` | text | NOT NULL, UNIQUE, CHECK `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` | URL-friendly identifier |
| `author_id` | text | NOT NULL, FK -> auth.user(id) ON DELETE RESTRICT | RESTRICT: force explicit reassignment before user deletion |
| `cover_image_id` | text | nullable, FK -> blog.asset(id) ON DELETE SET NULL | Social cards, RSS, index listings |
| `status` | enum | NOT NULL, DEFAULT 'draft' | `draft`, `published`, `archived` |
| `published_at` | timestamptz | nullable | Set when first published |
| `deleted_at` | timestamptz | nullable | Soft delete |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | Application must set explicitly on update |

Indexes: `(slug)` unique, `(author_id)`, `(status, published_at DESC)`, `(created_at) WHERE deleted_at IS NULL`.

**Changes from initial design** (taskforce review):
- Removed `published_revision_id` single pointer — replaced by `blog.published_revision` junction table for per-locale publishing
- Removed `review` status — no workflow, no UI, no guard. Add via `ALTER TYPE ADD VALUE` when multi-author review is designed
- Added `deleted_at` for soft delete (partial index referenced it but column was missing)
- Added `cover_image_id` FK for social cards, RSS, index listings
- `author_id` uses RESTRICT (not CASCADE) — don't orphan posts on user deletion

#### `blog.revision` — Immutable Content Snapshots

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | `rev_` prefix |
| `post_id` | text | NOT NULL, FK -> post(id) CASCADE | |
| `revision_number` | integer | NOT NULL | Auto-incremented per `(post_id, locale)` |
| `title` | text | NOT NULL | Title can change per revision |
| `summary` | text | nullable | Excerpt / meta description |
| `markdown` | text | NOT NULL | Raw markdown source |
| `locale` | text | NOT NULL, DEFAULT 'en', CHECK `^[a-z]{2}(-[A-Z]{2})?$` | i18n: translations are separate revisions |
| `rendered_html` | text | nullable | Cached pipeline output (contains `asset://` URIs) |
| `embed_descriptors` | jsonb | nullable | `EmbedDescriptor[]` cached from pipeline |
| `content_hash` | text | NOT NULL | SHA-256 of markdown, used as re-ingest gate |
| `search_vector` | tsvector | GENERATED STORED | Weighted: title(A), summary(B), markdown(C) |
| `author_id` | text | nullable, FK -> auth.user(id) ON DELETE SET NULL | Who made this revision. Nullable: user deletion sets null, revision stays. |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

Indexes: `(post_id, created_at DESC)`, `(post_id, locale, created_at DESC)`, `(post_id, locale, revision_number)` unique, `USING GIN(search_vector)`, `(author_id)`.

**Key design**: revisions are immutable. Rendered HTML is cached at save time, never invalidated. No `updated_at` column — you never update a revision, only create new ones.

**revision_number**: assigned in application code via `SELECT COALESCE(MAX(revision_number), 0) + 1 FROM blog.revision WHERE post_id = $1 AND locale = $2` within the insert transaction.

**content_hash**: SHA-256 of markdown. On republish, compare with existing `rag.document.content_hash` — skip re-embedding if unchanged.

**search_vector**: stored generated column (raw SQL migration — Drizzle doesn't support `GENERATED ALWAYS AS STORED`):
```sql
ALTER TABLE blog.revision ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(markdown, '')), 'C')
  ) STORED;
```

#### `blog.published_revision` — Locale-Aware Publish Pointers

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `post_id` | text | NOT NULL, FK -> post(id) CASCADE | |
| `locale` | text | NOT NULL, CHECK `^[a-z]{2}(-[A-Z]{2})?$` | |
| `revision_id` | text | NOT NULL, FK -> revision(id) RESTRICT | Never delete a published revision |
| PK | | `(post_id, locale)` | One published revision per post per locale |

Index: `(revision_id)` for reverse lookups.

**Rationale**: a single `published_revision_id` column cannot represent per-locale publication. This junction table stores exactly one published revision per `(post_id, locale)` pair. Publishing a new revision for a locale is an UPSERT on this table.

#### `blog.tag`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK, `tag_` prefix |
| `slug` | text | NOT NULL, UNIQUE, CHECK `^[a-z0-9]([a-z0-9-]*[a-z0-9])?$` |
| `name` | text | NOT NULL |

No soft delete, no timestamps. Tags are lightweight reference data.

#### `blog.post_tag` — Junction

| Column | Type | Constraints |
|--------|------|-------------|
| `post_id` | text | FK -> post(id) CASCADE |
| `tag_id` | text | FK -> tag(id) CASCADE |
| PK | | `(post_id, tag_id)` |

Index: `(tag_id)` for "find all posts with tag".

#### `blog.asset` — File Metadata (Blobs in R2)

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK, `ast_` prefix | |
| `uploader_id` | text | nullable, FK -> auth.user(id) ON DELETE SET NULL | Assets survive user deletion |
| `file_name` | text | NOT NULL | Original filename |
| `mime_type` | text | NOT NULL | |
| `file_size` | integer | NOT NULL, CHECK `file_size > 0` | Bytes |
| `storage_key` | text | NOT NULL, UNIQUE | R2 key |
| `alt_text` | text | nullable | Accessibility, RAG indexing |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

**Changes from initial design**: removed `public_url` column — resolve URLs dynamically from `storage_key` + base URL config. Avoids stale CDN URLs on domain/bucket change.

#### `blog.post_asset` — Junction (Orphan Tracking)

| Column | Type | Constraints |
|--------|------|-------------|
| `post_id` | text | FK -> post(id) CASCADE |
| `asset_id` | text | FK -> asset(id) RESTRICT |
| PK | | `(post_id, asset_id)` |

Index: `(asset_id)` for reverse lookups ("which posts use this asset?").

RESTRICT on asset deletion — don't delete assets that posts reference.

### Cascade Behavior Summary

| FK | ON DELETE | Rationale |
|----|-----------|-----------|
| `post.author_id` -> user | RESTRICT | Force explicit reassignment before user deletion |
| `post.cover_image_id` -> asset | SET NULL | Losing cover is cosmetic, not data loss |
| `revision.post_id` -> post | CASCADE | Revisions are owned by the post |
| `revision.author_id` -> user | SET NULL | Immutable history must survive user deletion |
| `published_revision.post_id` -> post | CASCADE | Publish pointers die with the post |
| `published_revision.revision_id` -> revision | RESTRICT | Cannot delete a revision that is currently published |
| `post_tag.post_id` -> post | CASCADE | Tag associations die with the post |
| `post_tag.tag_id` -> tag | CASCADE | Removing a tag removes all associations |
| `post_asset.post_id` -> post | CASCADE | Asset associations die with the post |
| `post_asset.asset_id` -> asset | RESTRICT | Cannot delete an asset still linked to posts |
| `asset.uploader_id` -> user | SET NULL | Assets survive user deletion |

### Deferred to v2

| Table | Purpose | When |
|-------|---------|------|
| `blog.category` | Hierarchical taxonomy | When flat tags prove insufficient |
| `blog.series` | Ordered post groupings | When multi-part content exists |
| `blog.post_reference` | Wikilink backlinks (`[[slug]]` resolution) | When cross-referencing is active |
| `blog.post_embed` | Queryable embed tracking | When "which posts use this embed?" is needed |

All additive — no existing tables need modification.

### `asset://` Protocol

Markdown references media via `asset://ast_abc123`. Resolution happens at render time (revision save). The `rendered_html` stores `asset://` URIs; resolution to CDN URLs happens at serve time via a thin string replacement pass (~1ms). This makes asset URL changes zero-cost — no re-rendering needed on CDN domain changes.

### Full-Text Search: Dual Strategy

**PostgreSQL tsvector** — keyword search (the search bar): stored generated column on `blog.revision` with weighted fields (title A, summary B, markdown C) + GIN index. See revision table definition above.

**RAG embeddings** — semantic search (AI assistant, related posts): blog posts ingested as RAG documents via existing pipeline. Embed directives include `altText` for RAG indexing (e.g., "Chart showing revenue Q4 data").

### Neo4j Content Graph

**Sync on publish only.** Fire-and-forget with outbox fallback.

Nodes:
```
(:Post {pgId, slug, title, status})
(:Tag {pgId, slug, name})
(:Author {pgId, name})
```

Relationships:
```
(post)-[:TAGGED_WITH]->(tag)
(post)-[:AUTHORED_BY]->(author)
(post)-[:REFERENCES]->(otherPost)     // from [[wikilinks]], v2
```

Key queries:
- **Related posts**: shared tag traversal (2 hops)
- **Backlinks**: `MATCH (source)-[:REFERENCES]->(target {slug: $slug})`
- **RAG integration**: blog chunks link to existing `Entity` nodes via the ingest pipeline

Failure handling: if Neo4j sync fails, log and retry via outbox. Blog works fine without Neo4j — recommendations degrade gracefully.

### ID Generation

Add to `src/lib/server/db/id.ts`:

```typescript
export const createId = {
  // ...existing
  post: () => `pst_${shortId()}`,
  revision: () => `rev_${shortId()}`,
  tag: () => `tag_${shortId()}`,
  asset: () => `ast_${shortId()}`,
} as const;
```

---

## AI Integration: Blog Posts as Entity Objects

### Strategy: Hybrid (Option C)

Blog posts are both **RAG documents** (chunked, embedded, searchable) and **first-class graph entities** (structured nodes with typed relationships). The chatbot can retrieve blog content semantically AND navigate the blog's content structure.

Two operations run on `publishPost()`:

1. **`ingest()`** — existing RAG pipeline: chunk -> embed -> store in `rag.document` + `rag.chunk` + pgvector + extract entities -> Neo4j `Chunk`/`Entity` nodes
2. **`syncBlogGraph()`** — new: create/update `Post`, `Tag`, `Author` nodes + relationships + bridge edges linking `Post` to its `Chunk` nodes

### Source Type: `'blog'`

Extend the `rag.document_source` enum:

```sql
-- STANDALONE MIGRATION: non-transactional, must run outside BEGIN/COMMIT
ALTER TYPE rag.document_source ADD VALUE IF NOT EXISTS 'blog';
```

Blog posts are ingested with `sourceType: 'blog'` and `sourcePath: '/blog/{slug}'`. This enables:
- **Filtering**: retrieval can scope to blog-only or exclude blog content
- **Boosting**: the chatbot can prioritize blog posts in answers
- **Attribution**: the source type appears in citations

### Neo4j Bridge: Post -> Chunk

The key architectural addition — linking the blog content graph to the RAG chunk graph:

```
(:Post {pgId, slug, title, status})
  -[:HAS_CHUNK]-> (:Chunk {pgId, documentId, level})
    -[:MENTIONS]-> (:Entity {name, type})

(:Post) -[:TAGGED_WITH]-> (:Tag {pgId, slug, name})
(:Post) -[:AUTHORED_BY]-> (:Author {pgId, name})
(:Post) -[:REFERENCES]-> (:Post)        // from [[wikilinks]]
```

This enables graph traversal paths the chatbot can follow:

```
Query -> Entity -> Chunk -> Post -> Tag -> other Posts -> their Chunks
Query -> Author -> Post -> Chunk (content)
Query -> Tag -> Post -> Chunk (content)
```

### Publish / Unpublish Orchestration

```typescript
async function publishPost(postId: string, locale: string, revisionId: string): Promise<void> {
  const post = await getPost(postId);
  const revision = await getRevision(revisionId);

  // 1. Check if re-embedding is needed (hash-based gate)
  const existingDoc = await findRagDocument(`/blog/${post.slug}`, 'blog');
  const needsReIngest = !existingDoc || existingDoc.contentHash !== revision.contentHash;

  // 2. PG transaction: status + publish pointer
  await db.transaction(async (tx) => {
    await tx.insert(publishedRevision)
      .values({ postId, locale, revisionId })
      .onConflictDoUpdate({
        target: [publishedRevision.postId, publishedRevision.locale],
        set: { revisionId },
      });

    await tx.update(blogPost).set({
      status: 'published',
      publishedAt: post.publishedAt ?? new Date(),
      updatedAt: new Date(),
    }).where(eq(blogPost.id, postId));
  });

  // 3. RAG ingest (only if content changed)
  if (needsReIngest) {
    if (existingDoc) {
      await softDeleteRagDocument(existingDoc.id);
    }

    const ingestResult = await ingest({
      title: revision.title,
      content: revision.markdown,
      sourcePath: `/blog/${post.slug}`,
      sourceType: 'blog',
      contentHash: revision.contentHash,
      userId: post.authorId,
    });

    // Add to blog collection (singleton, created by migration seed)
    await db.insert(collectionDocument)
      .values({ collectionId: 'col_blog', documentId: ingestResult.documentId })
      .onConflictDoNothing();

    // 4. Neo4j sync (fire-and-forget with outbox)
    try {
      await syncBlogGraph(post, revision, ingestResult.documentId);
      await linkPostToChunks(post.id, ingestResult.documentId);
    } catch (err) {
      console.error('[blog] Neo4j sync failed, queuing for retry:', err);
      // Queue for outbox retry — blog works without Neo4j
    }
  }

  // 5. ISR revalidation (fire-and-forget)
  await revalidatePublicRoutes(post.slug);
}

async function unpublishPost(postId: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.update(blogPost)
      .set({ status: 'archived', updatedAt: new Date() })
      .where(eq(blogPost.id, postId));

    await tx.delete(publishedRevision)
      .where(eq(publishedRevision.postId, postId));
  });

  // Soft-delete RAG document (eventual consistency OK)
  const post = await getPost(postId);
  await softDeleteRagDocumentBySource(`/blog/${post.slug}`, 'blog');

  // Remove from Neo4j (fire-and-forget)
  try {
    await removeBlogFromGraph(postId);
  } catch (err) {
    console.error('[blog] Neo4j cleanup failed:', err);
  }

  await revalidatePublicRoutes(post.slug);
}
```

**Slug change handling**: when a post's slug changes, update `rag.document.source_uri` in-place — do NOT create a new document row. Otherwise old chunks remain with stale source path.

### ISR Revalidation

```typescript
async function revalidatePublicRoutes(slug: string): Promise<void> {
  const token = process.env.VERCEL_REVALIDATE_TOKEN;
  if (!token) return; // local dev: skip

  const paths = [`/blog/${slug}`, '/blog', '/blog/feed.xml'];
  await Promise.allSettled(
    paths.map(path =>
      fetch(`${process.env.VERCEL_URL}/blog/${slug}`, {
        method: 'HEAD',
        headers: { 'x-prerender-revalidate': token },
      })
    )
  );
}
```

### Source Attribution in Chat

The chatbot must tell the user **exactly** where information came from — entity type, source, and a clickable link to the original object.

#### Extended Retrieval Types

The `RankedChunk` type gains source attribution:

```typescript
interface RankedChunk {
  chunkId: string;
  documentId: string;
  documentTitle: string;
  content: string;
  score: number;
  source: 'vector' | 'bm25' | 'graph';
  tier: 1 | 2 | 3;
  // --- source attribution ---
  sourceType: 'blog' | 'upload' | 'web' | 'text' | 'api';
  sourceUri: string | null;   // /blog/my-post, URL, or filename
}
```

`sourceType` and `sourceUri` are read from `rag.document` and propagated through retrieval. No new tables — the data is already there, just not surfaced.

#### Context Format for LLM

`formatContextForPrompt()` includes source attribution so the LLM can cite correctly:

```
[1] Authentication Deep Dive (blog: /blog/auth-deep-dive)
Blog post content about authentication patterns...

[2] Security Checklist (upload: security-checklist.pdf)
Uploaded document about security best practices...

[3] Rate Limiting (blog: /blog/rate-limiting)
Blog post about Upstash rate limiting setup...
```

The system prompt instructs the LLM: "Cite sources using [N] notation. Always include the source type and link."

#### Citation Rendering in Chat UI

When the chatbot responds with `[1]`, `[2]` references, the chat message component renders them as interactive citations:

```svelte
<!-- ChatMessage.svelte: citation rendering -->
<!-- "[1]" -> clickable chip with source icon + link -->
<a href="/blog/auth-deep-dive" class="citation-link">
  <span class="citation-badge">blog</span>
  <span class="citation-number">[1]</span>
</a>
```

Each citation shows:
- **Source type badge**: visual indicator (blog post, uploaded document, web page)
- **Clickable link**: navigates to the original content (`/blog/{slug}`, download link, external URL)
- **Hover tooltip**: document title only (no raw relevance score — erodes user trust)

#### Retrieval Metadata in Stream

The chat endpoint already sends pipeline annotations via `dataStream.writeMessageAnnotation()`. Extend with source attribution:

```typescript
// In chat endpoint, after retrieval
dataStream.writeMessageAnnotation({
  type: 'sources',
  sources: retrievalResult.chunks.map((c, i) => ({
    index: i + 1,
    title: c.documentTitle,
    sourceType: c.sourceType,
    sourceUri: c.sourceUri,
  })),
});
```

The chat UI reads this annotation to build the citation link map before rendering the message.

### What the Chatbot Can Answer

With blog posts as entity objects, the chatbot handles:

| Query | Retrieval path |
|-------|---------------|
| "What did we write about auth?" | Vector search -> blog chunks -> cite posts |
| "Posts tagged 'security'" | Graph: `(:Tag {slug:'security'})<-[:TAGGED_WITH]-(:Post)` |
| "What has [author] written?" | Graph: `(:Author)<-[:AUTHORED_BY]-(:Post)-[:HAS_CHUNK]->(:Chunk)` |
| "Summarize the auth guide" | Vector search -> specific post's chunks -> full context |
| "What's related to rate limiting?" | Graph: `(:Post)-[:TAGGED_WITH]->(:Tag)<-[:TAGGED_WITH]-(:Post)` + entity traversal |
| "Where is X documented?" | Hybrid: vector + graph -> cite source type + link |

Every answer includes source attribution: entity type (blog post, document, entity) + clickable link to the original object.

### Collection-Based Scoping

Blog posts auto-join a `"blog"` collection (`col_blog`) in `rag.collection` on publish. This collection is created by migration seed (not on first publish) to prevent race conditions. This enables scoped retrieval:
- "Search blog posts only" -> `collectionId: 'col_blog'`
- "Search everything" -> no collection filter (default)
- Future: per-author or per-tag collections for focused retrieval

---

## Module Structure

```
$lib/server/blog/                  # Domain module (multi-client core pattern)
  index.ts                          # Public API: getPosts, getPost, createPost, updatePost,
                                    #   publishPost, unpublishPost
  queries.ts                        # Drizzle queries (blog schema)
  render.ts                         # Unified pipeline: markdown -> {html, embeds, toc}
  ai-sync.ts                        # syncBlogGraph(), linkPostToChunks(), removeBlogFromGraph()
  types.ts                          # Blog domain types

$lib/server/blog/pipeline/
  extensions.ts                     # Directive handlers, wikilink config
  highlight.ts                      # @shikijs/rehype/core integration
  sanitize.ts                       # rehype-sanitize schema

$lib/content-syntax/               # Shared syntax definitions
  index.ts                          # Canonical directive specs
  remark-adapter.ts                 # Specs -> remark-directive handlers
  codemirror-adapter.ts             # Specs -> CM6 decorations (Phase 3)

$lib/components/blog/              # Rendering
  Renderer.svelte                   # {html, embeds} -> prose + hydrated embeds
  EmbedHost.svelte                  # Mounts single embed by kind
  embeds/
    registry.ts                     # kind -> dynamic import()
    CodeBlock.svelte
    Callout.svelte
    ChartEmbed.svelte
    ...

$lib/components/editor/            # Authoring (desk panel)
  EditorPanel.svelte                # Panel wrapper (documentId, documentType)
  EditorToolbar.svelte              # 3-zone toolbar with save indicator + publish button
  MarkdownSource.svelte             # Textarea (Phase 1) -> CM6 (Phase 2)
  SlashMenu.svelte                  # Slash command palette
  MetadataDrawer.svelte             # Title, slug, tags, status, locale, revision history
  types.ts                          # EditorDocument interface

$lib/components/preview/           # Multipurpose preview (desk panel)
  PreviewPanel.svelte               # Subscribes to editor:content, delegates to renderer
  renderers.ts                      # type -> dynamic import() registry

$lib/components/composites/dock/
  desk-bus.svelte.ts                # Typed cross-panel pub/sub (DeskEvents)
  layout-presets.ts                 # Writing, reviewing, dashboard presets

$lib/config/desk-panels.ts         # Add 'editor' + 'preview' + 'documents' panel types
```

### EditorDocument Interface

The editor is content-type-agnostic:

```typescript
interface EditorDocument {
  id: string;
  type: 'blog-post' | 'note' | 'doc';  // extensible
  content: string;                       // raw markdown
  metadata: Record<string, unknown>;     // type-specific
  locale?: string;                       // i18n
}
```

Blog posts are the first implementation. The domain module (`$lib/server/blog/`) handles persistence. The editor delegates save/publish to the appropriate domain module via the `type` discriminator.

### Document Lifecycle

- **New post**: Documents panel -> "New" button -> desk opens writing layout preset -> start writing -> IndexedDB autosave protects -> first explicit save (Cmd+S) creates post record + first revision in DB
- **Existing post**: Documents panel -> browse/search -> click to open in editor panel
- **Autosave**: client-side autosave to IndexedDB (prevents lost work on tab close). Call `navigator.storage.persist()` opportunistically on editor open. Explicit save to server creates a new immutable revision — no 30s autosave to avoid revision bloat.
- **Publish**: toolbar Publish button -> inline confirm -> `publishPost()` -> RAG ingest + Neo4j blog graph sync + ISR revalidation
- **Unpublish**: MetadataDrawer -> status to "Archived" -> `unpublishPost()` -> soft-delete RAG document + remove Neo4j nodes + ISR revalidation

---

## Route Structure

### Public Blog

```
src/routes/(shell)/blog/
  +page.server.ts                   # SSR: paginated post list (stream sidebar)
  +page.svelte                      # Blog index
  [slug]/
    +page.server.ts                 # ISR: load post (pre-rendered HTML from DB)
    +page.svelte                    # Post renderer + JSON-LD + OG meta
  tag/[tag]/
    +page.server.ts                 # SSR: posts filtered by tag
    +page.svelte
  feed.xml/
    +server.ts                      # ISR: RSS/Atom feed
  sitemap.xml/
    +server.ts                      # Prerendered sitemap
```

### Admin Content Management

```
src/routes/(shell)/admin/content/
  +page.server.ts                   # load + form actions (status changes, bulk ops)
  +page.svelte                      # Management table: filter, bulk actions, status
```

### API

```
src/routes/api/blog/
  +layout.server.ts                 # Auth guard: author|admin for all blog API routes
  +server.ts                        # POST: create post
  [id]/
    +server.ts                      # PATCH: update metadata (slug, tags)
    revision/+server.ts             # POST: save new revision
    publish/+server.ts              # POST: publish (triggers RAG + Neo4j + ISR)
  preview/+server.ts                # POST: render markdown pipeline, return {html, embeds}
```

### Desk (Authoring)

```
src/routes/(desk)/
  +layout.server.ts                 # Auth guard: author|admin
  desk/
    +page.svelte                    # Panel registry: editor + preview + documents
```

### Rendering Modes

| Route | Strategy | Config | Reason |
|-------|----------|--------|--------|
| `/blog/` (index) | SSR | default | Dynamic, paginated |
| `/blog/[slug]` | ISR (1h) | `isr: { expiration: 3600, bypassToken }` | Content rarely changes; `publishPost()` triggers on-demand revalidation |
| `/blog/tag/[tag]` | SSR | default | Dynamic filter |
| `/blog/feed.xml` | ISR (1h) | same as slug | Stable, cacheable; revalidated on publish |
| `/admin/content` | SSR | `prerender = false` | Dynamic management UI |
| `/desk` | SSR then CSR | default | SSR for shell; heavy JS hydration for editor |
| `api/blog/*` | Dynamic | N/A | Mutations, never cached |

**ISR per-route config** requires `split: true` in Vercel adapter — each route is a separate function. The desk route (long-lived SSR, no ISR) and blog post route (ISR) need different function configs.

### Auth Gating

```
hooks.server.ts routeGuard          <- PRIMARY: /api/blog/* requires author|admin
  +layout.server.ts (desk)          <- SECONDARY: defense-in-depth
  +layout.server.ts (api/blog)      <- SECONDARY: defense-in-depth
    +page.server.ts (admin/content) <- TERTIARY: admin-only

Public: /blog/* readable by everyone
Author: /desk, /api/blog/* — requires role === 'admin' || role === 'author'
Admin: /admin/content — requires role === 'admin'
```

**Prerequisite**: add `author` role to Better Auth configuration before Phase 1. The admin plugin added `role` to `auth.user`, but `author` must be a valid value.

### Form Actions vs API Endpoints

| Caller | Mechanism | Why |
|--------|-----------|-----|
| Admin content page (HTML forms) | Form actions in `+page.server.ts` | CSRF, `ActionData`, `use:enhance`, Superforms |
| Desk panels (JS, programmatic) | `+server.ts` API routes | No form context, called from component event handlers |
| AI tool calls / background jobs | `+server.ts` API routes | No browser context |

### SEO

**Per-post meta** (`/blog/[slug]/+page.svelte`):
- `<title>`, `<meta name="description">`, Open Graph tags (`og:title`, `og:type=article`, `og:url`, `article:published_time`, `article:tag`)
- `<link rel="canonical">` using `page.url.href` (handles locale query param)
- JSON-LD `BlogPosting` schema via `{@html}` in `<svelte:head>` (escape `</script>` sequences)

**Blog layout** (`/blog/+layout.svelte`):
- `<link rel="alternate" type="application/rss+xml" href="/blog/feed.xml">`

**Locale routing**: query parameter (`?locale=fr`) for v1. Paraglide subpath routing (`/fr/blog/[slug]`) deferred to v2.

---

## Migration Order

| Step | Content | Notes |
|------|---------|-------|
| 0001 | `ALTER TYPE rag.document_source ADD VALUE IF NOT EXISTS 'blog'` | **Non-transactional, standalone**. Cannot run inside `BEGIN/COMMIT`. Must precede blog schema. |
| 0002 | `CREATE SCHEMA IF NOT EXISTS blog` + `CREATE TYPE blog.post_status AS ENUM ('draft', 'published', 'archived')` | |
| 0003 | `CREATE TABLE blog.tag` | No FK dependencies |
| 0004 | `CREATE TABLE blog.asset` | FK to `auth.user` only |
| 0005 | `CREATE TABLE blog.post` | FK to `auth.user` + `blog.asset` |
| 0006 | `CREATE TABLE blog.revision` + generated `search_vector` column | FK to `blog.post` + `auth.user`. Generated column via `ALTER TABLE`. |
| 0007 | `CREATE TABLE blog.published_revision` | FK to `blog.post` + `blog.revision` |
| 0008 | `CREATE TABLE blog.post_tag` + `blog.post_asset` | Junction tables, FK to existing tables |
| 0009 | `INSERT INTO rag.collection` — seed `col_blog` | Idempotent with `ON CONFLICT DO NOTHING`. Requires at least one user to exist for `user_id`. |

---

## Packages to Add

New dependencies (none currently in `package.json` for unified):

| Package | Purpose |
|---------|---------|
| `unified` | Pipeline runner |
| `remark-parse` | Markdown -> mdast |
| `remark-gfm` | Tables, strikethrough, task lists |
| `remark-frontmatter` | YAML frontmatter parsing |
| `remark-directive` | Custom `::directive` syntax |
| `@flowershow/remark-wiki-link` | `[[wikilink]]` cross-references |
| `remark-rehype` | mdast -> hast |
| `rehype-slug` | Heading IDs |
| `@shikijs/rehype` | Code highlighting (via `/core` with existing singleton) |
| `rehype-sanitize` | Server-side HTML sanitization |
| `rehype-stringify` | hast -> HTML string |

Approximate bundle: ~40-60KB minified + gzipped (server-side only). Public pages use pre-rendered HTML from DB — zero pipeline code ships to the browser.

---

## Implementation Sequence

### Phase 0: Prerequisites

1. Add `author` role to Better Auth configuration
2. Extend `routeGuard` in hooks to handle `/api/blog/*` with role-based access
3. Add `'blog'` value to `rag.document_source` enum (non-transactional migration 0001)

### Phase 1: Pipeline + Public Blog

4. `blog` schema migration (0002-0009: 8 tables + seed)
5. `$lib/server/blog/` domain module with render pipeline
6. `$lib/content-syntax/` with initial directive definitions (callout, chart, code)
7. `$lib/components/blog/Renderer.svelte` + embed registry
8. Public routes: `/blog/`, `/blog/[slug]` (with JSON-LD + OG meta), `/blog/tag/[tag]`, `/blog/feed.xml`, `/blog/sitemap.xml`
9. Admin content page: `/admin/content` (post list + status management via form actions)
10. API endpoints: `POST /api/blog` (create), `PATCH /api/blog/[id]` (metadata), `POST /api/blog/[id]/revision`, `POST /api/blog/[id]/publish`
11. `publishPost()` + `unpublishPost()` orchestration with ISR revalidation
12. CLI import script: `scripts/blog-import.ts` (`.md` files -> DB)

### Phase 2: Desk Editor + Preview

13. Typed DeskBus: `desk-bus.svelte.ts` with `DeskEvents` interface + `replayLast` option
14. Layout presets: `layout-presets.ts` with writing preset (Editor | Preview)
15. `$lib/components/editor/` — EditorPanel, EditorToolbar (3-zone with save indicator + publish button), MarkdownSource (Textarea), SlashMenu
16. `$lib/components/preview/` — PreviewPanel with loading/error/placeholder states + renderer registry
17. Documents panel: renamed from Files, `i-lucide-file-text`, "New" button in header
18. Add `editor` + `preview` + `documents` panel types to desk configuration
19. Preview API endpoint: `/api/blog/preview`
20. MetadataDrawer: title (autosave on blur), slug (auto-generate), tags (Combobox), status (inline confirm), locale, revision history
21. Revision save API: `/api/blog/[id]/revision` (+ IndexedDB client autosave + `navigator.storage.persist()`)

### Phase 3: AI Integration

22. `$lib/server/blog/ai-sync.ts` — `syncBlogGraph()`, `linkPostToChunks()`, `removeBlogFromGraph()`
23. Neo4j blog nodes: `:Post`, `:Tag`, `:Author` + `HAS_CHUNK` bridge edges
24. Slug-change handling: update `rag.document.source_uri` in-place
25. Extend `RankedChunk` with `sourceType` + `sourceUri` (propagate from `rag.document`)
26. Update `formatContextForPrompt()` with source attribution format
27. Stream source annotations via `dataStream.writeMessageAnnotation()`
28. Chat UI: citation rendering with source type badges + clickable links (no raw relevance score in tooltips)

### Phase 4: Editor Enhancement

29. Upgrade MarkdownSource to CodeMirror 6 (spike `optimizeDeps.exclude` first)
30. CM6 keyboard policy: editor-focused vs desk shortcuts, `Cmd+S` as keymap entry
31. Lezer grammar extensions for custom syntax highlighting
32. `$lib/content-syntax/codemirror-adapter.ts`
33. Inline Combobox for embed parameter autocompletion

### Phase 5: Content Graph (v2 Tables)

34. `blog.post_reference` table + wikilink extraction at render time
35. `blog.category` + `blog.series` tables
36. `blog.post_embed` table for queryable embed tracking
37. Neo4j backlink queries + "related posts" recommendations
38. Multi-author soft lock (DB field `locked_by` + `locked_at` + polling, when >1 author exists)
39. Permalink cache for wikilink resolution (invalidate on post creation/slug change)

---

## Risks

### 1. Custom Syntax in Editor Gap
Nobody has shipped a complete solution for custom syntax highlighting in a source editor. **Mitigation**: Phase 1-2 work without it (slash commands auto-insert syntax, preview renders correctly). Phase 4 adds Lezer grammar when justified. `lezer-markdown-obsidian` proves the extension mechanism works.

### 2. Unified Bundle in Browser
~40-60KB gzipped if the unified pipeline ran client-side. **Mitigation**: preview panel hits `/api/blog/preview` server-side — zero pipeline code ships to the browser. Public blog pages use pre-rendered HTML from DB. The only trade-off is preview latency (~300ms debounce + ~200ms round-trip = ~500ms), which is acceptable for a writing tool. No optimistic client-side preview — `marked` can't render directives/wikilinks, so the output would be visibly wrong.

### 3. Lezer/Remark Syntax Drift
Two parser implementations for the same custom syntax. **Mitigation**: shared `$lib/content-syntax/` definitions + integration tests comparing parse output for identical input.

### 4. Bun + Unified Compatibility
Unified is ESM-only, which is actually a better fit for Bun than Node/CJS. No known issues. **Mitigation**: run pipeline server-side in SvelteKit load functions, not in Vite transform steps where Bun/Vite interaction adds complexity.

### 5. Revision Storage Growth
~2x storage per revision (raw markdown + rendered HTML). **Mitigation**: negligible for a blog — 10,000 revisions at 50KB average = 500MB. PostgreSQL TOAST compression handles text columns well.

### 6. Wikilink Resolution in Pipeline
`remark-wiki-link`'s `pageResolver` is synchronous — no `await db.query()` inside it. **Mitigation**: pre-fetch `SELECT slug FROM blog.post` before pipeline run and pass as `permalinks` array. Sufficient for v1 post count. Permalink cache with invalidation on post creation/slug change deferred to Phase 5.

### 7. RAG Dual-Write on Publish
`publishPost()` writes to both `rag.document`/`rag.chunk` (Postgres) and Neo4j blog graph. If one succeeds and the other fails, data is inconsistent. **Mitigation**: Postgres transaction first (status + publish pointer + RAG ingest — critical path). Neo4j sync is fire-and-forget with outbox retry. Blog works fine without Neo4j — graph queries degrade gracefully, vector search still returns blog chunks.

### 8. Citation Hallucination
The LLM may fabricate `[N]` references that don't correspond to actual retrieved sources. **Mitigation**: the chat UI only renders citation links for `[N]` values that match a source in the stream annotation. Unmatched `[N]` renders as plain text. The system prompt explicitly lists which `[N]` values are valid.

### 9. Cross-Panel State Coupling
The desk bus creates implicit coupling between panels. A bug in the editor's publish event could break the preview panel. **Mitigation**: the bus is fire-and-forget (no return values, no blocking). Panels subscribe defensively — a failed handler doesn't propagate to the publisher. Integration tests verify editor->preview and editor->chat flows. Typed `DeskEvents` interface prevents silent payload mismatches.

### 10. IndexedDB Autosave vs. Server Revision Conflict
Client-side autosave may hold a newer version than the last server revision. If the user opens the same post on another device, they see the server version. **Mitigation**: on editor open, compare IndexedDB timestamp with latest revision's `created_at`. If local is newer, prompt: "You have unsaved changes from [date]. Restore or discard?" No silent override. Call `navigator.storage.persist()` on editor open — Safari evicts IndexedDB after 7 days of inactivity; persist() grant is probabilistic but favorable for high-engagement users (authenticated authors).

### 11. Non-Transactional Enum Migration
`ALTER TYPE rag.document_source ADD VALUE 'blog'` cannot run inside a PostgreSQL transaction block. **Mitigation**: standalone migration file (0001) run before blog schema tables. Drizzle's `migrate()` wraps migrations in transactions by default — this step must use raw `db.execute()` outside the transaction wrapper.

---

## Review Provenance

This blueprint was reviewed by a taskforce of 6 specialized agents across 2 rounds with cross-pollination (24 total consultations):

**Round 1** (independent review): archy (architecture), svey (SvelteKit), uxy (UX), daty (data model), resy (research), scout (real-world implementations)

**Round 2** (cross-pollinated): each agent received all R1 findings, resolved disagreements, and produced final recommendations

Key decisions from review:
- `published_revision` junction table replaces single-pointer column (archy + daty consensus)
- `review` status removed from v1 enum (archy, no dissent)
- DeskBus typed with `DeskEvents` interface (archy + svey + resy consensus)
- `unpublishPost()` required alongside `publishPost()` (scout + resy)
- Optimistic `marked` preview rejected — can't render directives (resy R2)
- `invalidate()` rejected for cross-panel — inapplicable to DockLayout (resy R2)
- Timed publish confirmation rejected — fails WCAG accessibility (scout R2)
- Pre-create DB record rejected — IndexedDB autosave is sufficient safety net (scout R2)
- Revision display: timestamps + author, not sequential numbers (scout R2, validated across Ghost/Payload/Craft/Brightspot)
