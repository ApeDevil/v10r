# Blog System Blueprint

> Synthesized from 12 agent consultations (archy, svey, uxy, daty, resy, scout — 2 rounds with cross-pollination). Branch: `feature/admin-expansion`.

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

`remark-directive` implements the [Generic Directives proposal](https://talk.commonmark.org/t/generic-directives-plugins-syntax/444) — a de facto community standard (not formal CommonMark, but implemented across parsers and used in production). Three levels:

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

For cross-references between posts: `[[wikilinks]]` via `@flowershow/remark-wiki-link` (Obsidian-compatible).

### Why not alternatives?

| Approach | Verdict | Reason |
|----------|---------|--------|
| MDsveX | Rejected | Broken with Svelte 5 (generates Svelte 4 component format), 164 open issues, `@sveltejs/enhanced-img` incompatible, uncertain Bun support |
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
- **No global state problem**: marked's `setOptions()` writes to a global object; concurrent SSR requests can interfere. Unified pipelines are instance-scoped.
- **remark-directive**: standardized custom syntax via the Generic Directives proposal
- **Plugin ecosystem**: 200+ composable plugins for GFM, frontmatter, math, footnotes, etc.

### What stays on marked

`renderMarkdown()` in `$lib/utils/markdown.ts` stays as-is for chat rendering. Simple, synchronous, client-safe. No directives or AST access needed there.

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
┌─────────────────────────┬──────────────────────────┐
│                         │                          │
│   Editor (markdown)     │   Preview (rendered)     │
│                         │                          │
│                         │                          │
│                         │                          │
│                         │                          │
└─────────────────────────┴──────────────────────────┘
```

The user can then drag Chat, Files, or anything else into the layout — but the **starting point is opinionated**. No need to assemble panels manually for the primary authoring flow.

Layout presets are a desk-level concept, not blog-specific. The writing preset is the first; others (reviewing, dashboard) follow as use cases emerge.

```typescript
interface LayoutPreset {
  id: string;
  label: string;
  icon: string;
  buildLayout: (context?: { documentId?: string }) => DockNode;
}
```

### Files Panel as Document Browser

The existing `files` panel becomes a **generic document browser** — the place to find, open, and organize content:

- **Blog posts**: drafts, published, archived — filterable by status, tag, author
- **Notes**: when note-taking lands (future)
- **Documents**: when docs land (future)

Clicking a document opens it in the editor panel. The panel shows a tree/list view grouped by content type, with blog posts as the only type in v1.

The files panel accepts an optional scope (when opened from a layout preset, it shows blog posts; standalone shows everything), but the simplest v1 just lists all documents the user can edit.

### Desk Workflow

```
Author opens /desk
  -> Activity bar: click "Editor" icon (or "New Post" action)
  -> Desk auto-arranges writing layout preset: Editor | Preview
  -> Files panel available in activity bar to browse/open posts
  -> Drag "Chat" tab into layout -> AI assistant for writing help

Save -> POST /api/blog/[id]/revision (creates new revision)
Preview -> preview panel auto-updates on save (cross-panel pub/sub)
Publish -> MetadataDrawer -> set status to "published"
        -> triggers Neo4j sync + RAG ingest
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

**Live preview**: the preview panel subscribes to content changes from the editor panel via cross-panel pub/sub (see below). Debounced rendering (300ms after last keystroke). The pipeline runs server-side via `/api/blog/preview` to guarantee the preview is identical to the published output — no bundle size trade-off, no client/server drift.

**Full preview** (toolbar button): server-rendered view via the same route the public uses. Honest preview for posts with 3D embeds or `asset://` media that require presigned URL resolution.

### Cross-Panel Communication

The DockLayout needs lightweight pub/sub for panels to communicate without direct coupling:

```typescript
interface DeskBus {
  /** Editor publishes content changes */
  publish(channel: string, payload: unknown): void;
  /** Preview subscribes to content changes */
  subscribe(channel: string, handler: (payload: unknown) => void): () => void;
}
```

Channels:
- `editor:content` — editor emits `{ content, type, metadata }` on change (debounced)
- `editor:document` — editor emits `{ documentId, type }` when a different document opens
- `editor:save` — editor emits after successful save (preview can refresh from server)

This is valuable beyond editor/preview — the chat panel can subscribe to `editor:document` to know what the user is working on, enabling contextual writing suggestions about the current post.

### Content Management (Admin)

The admin area gets a new **Content** tab group for post management (list, filter, bulk actions, status changes). The desk is where authoring happens. Clean separation: **admin = management, desk = creation**.

```
Observe:  DB  |  Analytics  |  Audit Log
Manage:   Users  |  Feature Flags  |  Branding
Content:  Posts  |  Tags  |  Media Library
System:   Jobs  |  Notifications  |  RAG  |  Cache
```

Posts list follows the canonical admin data table pattern: URL-as-state, GET form for search/filter, anchor links for sort headers, Pagination composite.

### Accessibility

- Textarea is the most accessible editing surface (native form element, unambiguous tab order, screen reader compatible)
- Slash command palette: ARIA combobox pattern (same as existing Combobox primitive)
- Embed placeholder cards: `aria-label="Chart embed: sales-2024"` for screen reader users
- Focus management: palette open/close returns focus to editor cursor, Drawer traps focus
- Preview pane: `role="region"` with `aria-label="Post preview"` and `aria-live="polite"`

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

### Schema: `blog` (6 Tables for v1)

All tables in `pgSchema('blog')`, following the existing pattern.

#### `blog.post` — Aggregate Root

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | `pst_` prefix |
| `slug` | text | NOT NULL, UNIQUE | URL-friendly identifier |
| `author_id` | text | NOT NULL, FK -> auth.user(id) | |
| `status` | enum | NOT NULL, DEFAULT 'draft' | `draft`, `review`, `published`, `archived` |
| `published_at` | timestamptz | nullable | Set when first published |
| `published_revision_id` | text | nullable | Points to active published revision |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |
| `updated_at` | timestamptz | NOT NULL, DEFAULT now() | |

Indexes: `(slug)` unique, `(author_id)`, `(status, published_at DESC)`, `(created_at) WHERE deleted_at IS NULL`.

`review` state is latent until multi-author workflow is activated. Building the enum now avoids retrofitting the schema.

#### `blog.revision` — Immutable Content Snapshots

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PK | `rev_` prefix |
| `post_id` | text | NOT NULL, FK -> post(id) CASCADE | |
| `title` | text | NOT NULL | Title can change per revision |
| `summary` | text | nullable | Excerpt / meta description |
| `markdown` | text | NOT NULL | Raw markdown source |
| `locale` | text | NOT NULL, DEFAULT 'en' | i18n: translations are separate revisions |
| `rendered_html` | text | nullable | Cached pipeline output |
| `embed_descriptors` | jsonb | nullable | `EmbedDescriptor[]` cached from pipeline |
| `author_id` | text | NOT NULL, FK -> auth.user(id) | Who made this revision |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

Indexes: `(post_id, created_at DESC)`, `(post_id, locale, created_at DESC)`.

**Key design**: revisions are immutable. Rendered HTML is cached at save time, never invalidated. No `updated_at` column — you never update a revision, only create new ones.

**i18n**: a post has multiple revisions per locale. Current published content per locale: `WHERE post_id = $1 AND locale = $2 ORDER BY created_at DESC LIMIT 1`.

#### `blog.tag`

| Column | Type | Constraints |
|--------|------|-------------|
| `id` | text | PK, `tag_` prefix |
| `slug` | text | NOT NULL, UNIQUE |
| `name` | text | NOT NULL |

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
| `uploader_id` | text | NOT NULL, FK -> auth.user(id) | |
| `file_name` | text | NOT NULL | Original filename |
| `mime_type` | text | NOT NULL | |
| `file_size` | integer | NOT NULL | Bytes |
| `storage_key` | text | NOT NULL, UNIQUE | R2 key |
| `public_url` | text | nullable | Resolved CDN URL |
| `created_at` | timestamptz | NOT NULL, DEFAULT now() | |

#### `blog.post_asset` — Junction (Orphan Tracking)

| Column | Type | Constraints |
|--------|------|-------------|
| `post_id` | text | FK -> post(id) CASCADE |
| `asset_id` | text | FK -> asset(id) RESTRICT |
| PK | | `(post_id, asset_id)` |

RESTRICT on asset deletion — don't delete assets that posts reference.

### Deferred to v2

| Table | Purpose | When |
|-------|---------|------|
| `blog.category` | Hierarchical taxonomy | When flat tags prove insufficient |
| `blog.series` | Ordered post groupings | When multi-part content exists |
| `blog.post_reference` | Wikilink backlinks (`[[slug]]` resolution) | When cross-referencing is active |
| `blog.post_embed` | Queryable embed tracking | When "which posts use this embed?" is needed |

All additive — no existing tables need modification.

### `asset://` Protocol

Markdown references media via `asset://ast_abc123`. Resolution happens at render time (revision save), not read time. For a public blog, resolve to stable CDN URLs baked into cached HTML. For private content, leave as placeholder and resolve per-request.

### Full-Text Search: Dual Strategy

**PostgreSQL tsvector** — keyword search (the search bar):

```sql
-- Generated tsvector with weighted fields
setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
setweight(to_tsvector('english', coalesce(markdown, '')), 'C')
```

**RAG embeddings** — semantic search (AI assistant, related posts):

Blog posts ingested as RAG documents via existing pipeline. Embed directives include `altText` for RAG indexing (e.g., "Chart showing revenue Q4 data").

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

---

## AI Integration: Blog Posts as Entity Objects

### Strategy: Hybrid (Option C)

Blog posts are both **RAG documents** (chunked, embedded, searchable) and **first-class graph entities** (structured nodes with typed relationships). The chatbot can retrieve blog content semantically AND navigate the blog's content structure.

Two operations run on `publishPost()`:

1. **`ingest()`** — existing RAG pipeline: chunk → embed → store in `rag.document` + `rag.chunk` + pgvector + extract entities → Neo4j `Chunk`/`Entity` nodes
2. **`syncBlogGraph()`** — new: create/update `Post`, `Tag`, `Author` nodes + relationships + bridge edges linking `Post` to its `Chunk` nodes

### Source Type: `'blog'`

Extend the `rag.document_source` enum:

```sql
ALTER TYPE rag.document_source ADD VALUE 'blog';
```

Blog posts are ingested with `sourceType: 'blog'` and `sourcePath: '/blog/{slug}'`. This enables:
- **Filtering**: retrieval can scope to blog-only or exclude blog content
- **Boosting**: the chatbot can prioritize blog posts in answers
- **Attribution**: the source type appears in citations

### Neo4j Bridge: Post → Chunk

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
Query → Entity → Chunk → Post → Tag → other Posts → their Chunks
Query → Author → Post → Chunk (content)
Query → Tag → Post → Chunk (content)
```

The `publishPost()` function orchestrates both systems:

```typescript
async function publishPost(postId: string, revisionId: string): Promise<void> {
  const post = await getPost(postId);
  const revision = await getRevision(revisionId);

  // 1. RAG ingest (existing pipeline)
  const ingestResult = await ingest({
    title: revision.title,
    content: revision.markdown,
    sourcePath: `/blog/${post.slug}`,
    sourceType: 'blog',
    userId: post.authorId,
  });

  // 2. Blog graph sync (new)
  await syncBlogGraph(post, revision, ingestResult.documentId);

  // 3. Link Post node to its Chunk nodes
  await linkPostToChunks(post.id, ingestResult.documentId);
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
  // --- new: source attribution ---
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
<!-- "[1]" → clickable chip with source icon + link -->
<a href="/blog/auth-deep-dive" class="citation-link">
  <span class="citation-badge">blog</span>
  <span class="citation-number">[1]</span>
</a>
```

Each citation shows:
- **Source type badge**: visual indicator (blog post, uploaded document, web page)
- **Clickable link**: navigates to the original content (`/blog/{slug}`, download link, external URL)
- **Hover tooltip**: document title + relevance score

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
    score: c.score,
  })),
});
```

The chat UI reads this annotation to build the citation link map before rendering the message.

### What the Chatbot Can Answer

With blog posts as entity objects, the chatbot handles:

| Query | Retrieval path |
|-------|---------------|
| "What did we write about auth?" | Vector search → blog chunks → cite posts |
| "Posts tagged 'security'" | Graph: `(:Tag {slug:'security'})<-[:TAGGED_WITH]-(:Post)` |
| "What has [author] written?" | Graph: `(:Author)<-[:AUTHORED_BY]-(:Post)-[:HAS_CHUNK]->(:Chunk)` |
| "Summarize the auth guide" | Vector search → specific post's chunks → full context |
| "What's related to rate limiting?" | Graph: `(:Post)-[:TAGGED_WITH]->(:Tag)<-[:TAGGED_WITH]-(:Post)` + entity traversal |
| "Where is X documented?" | Hybrid: vector + graph → cite source type + link |

Every answer includes source attribution: entity type (blog post, document, entity) + clickable link to the original object.

### Collection-Based Scoping

Blog posts auto-join a `"blog"` collection in `rag.collection` on publish. This enables scoped retrieval:
- "Search blog posts only" → `collectionId: 'blog'`
- "Search everything" → no collection filter (default)
- Future: per-author or per-tag collections for focused retrieval

---

## Module Structure

```
$lib/server/blog/                  # Domain module (multi-client core pattern)
  index.ts                          # Public API: getPosts, getPost, createPost, updatePost, publishPost
  queries.ts                        # Drizzle queries (blog schema)
  render.ts                         # Unified pipeline: markdown -> {html, embeds, toc}
  types.ts                          # Blog domain types
  pipeline/
    extensions.ts                   # Directive handlers, wikilink config
    highlight.ts                    # @shikijs/rehype/core integration
    sanitize.ts                     # rehype-sanitize schema

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
  MarkdownSource.svelte             # Textarea (Phase 1) -> CM6 (Phase 2)
  SlashMenu.svelte                  # Slash command palette
  MetadataDrawer.svelte             # Title, slug, tags, status (Drawer)
  types.ts                          # EditorDocument interface

$lib/components/preview/           # Multipurpose preview (desk panel)
  PreviewPanel.svelte               # Subscribes to editor:content, delegates to renderer
  renderers.ts                      # type -> dynamic import() registry

$lib/components/composites/dock/
  desk-bus.svelte.ts                # Cross-panel pub/sub (Svelte 5 reactive)
  layout-presets.ts                 # Writing, reviewing, dashboard presets

$lib/server/blog/
  ai-sync.ts                        # syncBlogGraph(), linkPostToChunks()

$lib/config/desk-panels.ts         # Add 'editor' + 'preview' + 'files' panel types
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

- **New post**: Activity bar → "New Post" action → desk opens writing layout preset → MetadataDrawer for title/slug → start writing
- **Existing post**: Files panel → browse/search → click to open in editor panel
- **Autosave**: client-side autosave to IndexedDB (prevents lost work on tab close). Explicit save to server creates a new immutable revision — no 30s autosave to avoid revision bloat.
- **Publish**: MetadataDrawer → set status to "published" → triggers `publishPost()` → RAG ingest + Neo4j blog graph sync

---

## Route Structure

### Public Blog

```
src/routes/(shell)/blog/
  +page.server.ts                   # Paginated post list
  +page.svelte                      # Blog index, tag cloud
  [slug]/
    +page.server.ts                 # Load post (pre-rendered HTML from DB)
    +page.svelte                    # Post renderer (blog/Renderer.svelte)
  tag/[tag]/
    +page.server.ts                 # Posts filtered by tag
    +page.svelte
  feed.xml/
    +server.ts                      # RSS/Atom feed (RequestHandler, no page)
```

### Admin Content Management

```
src/routes/(shell)/admin/content/
  +page.server.ts                   # Post list (canonical data table pattern)
  +page.svelte                      # Management table: filter, bulk actions, status
```

### API

```
src/routes/api/blog/
  preview/+server.ts                # POST: render markdown, return {html, embeds}
  [id]/revision/+server.ts          # POST: save new revision
  [id]/publish/+server.ts           # POST: publish post (triggers Neo4j sync + RAG)
```

### Desk (Authoring)

```
src/routes/(desk)/desk/
  +page.svelte                      # Add 'editor' + 'preview' to panel registry
```

### Rendering Modes

| Route | Strategy | Reason |
|-------|----------|--------|
| `/blog/` (index) | SSR | Dynamic, paginated |
| `/blog/[slug]` | ISR (Vercel, 1h expiration) | Content rarely changes, CDN-cached |
| `/blog/tag/[tag]` | SSR | Dynamic filter |
| `/blog/feed.xml` | ISR (1h) | Stable, cacheable |

### Auth Gating

- Public: `/blog/*` readable by everyone
- Author: `/desk` editor panels, `/api/blog/*/revision` — requires `role === 'admin' || role === 'author'`
- Admin: `/admin/content` — requires `role === 'admin'`

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

Approximate bundle: ~40-60KB minified + gzipped (including micromark). Only needed client-side for editor preview; public pages use pre-rendered HTML.

---

## Implementation Sequence

### Phase 1: Pipeline + Public Blog

1. Install unified ecosystem packages
2. `blog` schema migration (6 tables) + `'blog'` source enum value in `rag.document_source`
3. `$lib/server/blog/` domain module with render pipeline
4. `$lib/content-syntax/` with initial directive definitions (callout, chart, code)
5. `$lib/components/blog/Renderer.svelte` + embed registry
6. Public routes: `/blog/`, `/blog/[slug]`, `/blog/tag/[tag]`, `/blog/feed.xml`
7. Admin content page: `/admin/content` (post list + status management)
8. CLI import script: `scripts/blog-import.ts` (`.md` files -> DB)

### Phase 2: Desk Editor + Preview

9. Cross-panel pub/sub: `desk-bus.svelte.ts`
10. Layout presets: `layout-presets.ts` with writing preset (Editor | Preview)
11. `$lib/components/editor/` — EditorPanel, MarkdownSource (Textarea), SlashMenu
12. `$lib/components/preview/` — PreviewPanel + renderer registry (multipurpose)
13. Files panel: document browser (blog posts as first content type)
14. Add `editor` + `preview` panel types to desk configuration
15. Preview API endpoint: `/api/blog/preview`
16. MetadataDrawer: title, slug, tags, status, locale
17. Revision save API: `/api/blog/[id]/revision` (+ IndexedDB client autosave)
18. Publish flow: status transition + RAG ingest + Neo4j blog graph sync

### Phase 3: AI Integration

19. `$lib/server/blog/ai-sync.ts` — `syncBlogGraph()`, `linkPostToChunks()`
20. Neo4j blog nodes: `:Post`, `:Tag`, `:Author` + `HAS_CHUNK` bridge edges
21. Auto-join `"blog"` collection in `rag.collection` on publish
22. Extend `RankedChunk` with `sourceType` + `sourceUri` (propagate from `rag.document`)
23. Update `formatContextForPrompt()` with source attribution format
24. Stream source annotations via `dataStream.writeMessageAnnotation()`
25. Chat UI: citation rendering with source type badges + clickable links

### Phase 4: Editor Enhancement

26. Upgrade MarkdownSource to CodeMirror 6
27. Lezer grammar extensions for custom syntax highlighting
28. `$lib/content-syntax/codemirror-adapter.ts`
29. Inline Combobox for embed parameter autocompletion

### Phase 5: Content Graph (v2 Tables)

30. `blog.post_reference` table + wikilink extraction at render time
31. `blog.category` + `blog.series` tables
32. `blog.post_embed` table for queryable embed tracking
33. Neo4j backlink queries + "related posts" recommendations

---

## Risks

### 1. Custom Syntax in Editor Gap
Nobody has shipped a complete solution for custom syntax highlighting in a source editor. **Mitigation**: Phase 1-2 work without it (slash commands auto-insert syntax, preview renders correctly). Phase 3 adds Lezer grammar when justified. `lezer-markdown-obsidian` proves the extension mechanism works.

### 2. Unified Bundle in Browser
~40-60KB gzipped if the unified pipeline ran client-side. **Mitigation**: preview panel hits `/api/blog/preview` server-side — zero pipeline code ships to the browser. Public blog pages use pre-rendered HTML from DB. The only trade-off is preview latency (~100-200ms round-trip), which is acceptable with 300ms debounce.

### 3. Lezer/Remark Syntax Drift
Two parser implementations for the same custom syntax. **Mitigation**: shared `$lib/content-syntax/` definitions + integration tests comparing parse output for identical input.

### 4. Bun + Unified Compatibility
Unified is ESM-only, which is actually a better fit for Bun than Node/CJS. No known issues. **Mitigation**: run pipeline server-side in SvelteKit load functions, not in Vite transform steps where Bun/Vite interaction adds complexity.

### 5. Revision Storage Growth
~2x storage per revision (raw markdown + rendered HTML). **Mitigation**: negligible for a blog — 10,000 revisions at 50KB average = 500MB. PostgreSQL TOAST compression handles text columns well.

### 6. Wikilink Resolution in Pipeline
`remark-wiki-link`'s `pageResolver` is synchronous — no `await db.query()` inside it. **Mitigation**: pre-fetch `SELECT slug FROM blog.post` before pipeline run and pass as `permalinks` array.

### 7. RAG Dual-Write on Publish
`publishPost()` writes to both `rag.document`/`rag.chunk` (Postgres) and Neo4j blog graph. If one succeeds and the other fails, data is inconsistent. **Mitigation**: Postgres ingest first (critical path — retrieval works without graph). Neo4j sync is fire-and-forget with outbox retry. Blog works fine without Neo4j — graph queries degrade gracefully, vector search still returns blog chunks.

### 8. Citation Hallucination
The LLM may fabricate `[N]` references that don't correspond to actual retrieved sources. **Mitigation**: the chat UI only renders citation links for `[N]` values that match a source in the stream annotation. Unmatched `[N]` renders as plain text. The system prompt explicitly lists which `[N]` values are valid.

### 9. Cross-Panel State Coupling
The desk bus creates implicit coupling between panels. A bug in the editor's publish event could break the preview panel. **Mitigation**: the bus is fire-and-forget (no return values, no blocking). Panels subscribe defensively — a failed handler doesn't propagate to the publisher. Integration tests verify editor→preview and editor→chat flows.

### 10. IndexedDB Autosave vs. Server Revision Conflict
Client-side autosave may hold a newer version than the last server revision. If the user opens the same post on another device, they see the server version. **Mitigation**: on editor open, compare IndexedDB timestamp with latest revision's `created_at`. If local is newer, prompt: "You have unsaved changes from [date]. Restore or discard?" No silent override.
