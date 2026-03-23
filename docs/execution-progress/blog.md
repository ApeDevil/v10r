# Blog System Implementation

What was built from `docs/blueprint/blog.md`.

## Implementation Status

**Branch**: `feature/blog` (from `feature/admin-expansion`)
**Blueprint**: `docs/blueprint/blog.md`

| Phase | Status | Description |
|-------|--------|-------------|
| 1. Database Schema + Domain Module | Done | 8 tables, queries, mutations, auth guards |
| 2. Markdown Pipeline | Done | unified/remark/rehype, Shiki, directives, content-syntax |
| 3. Public Routes | Done | /blog/, /blog/[slug], RSS, tag filter, Renderer, PostCard |
| 4. Admin Content Management | Done | Posts + Tags admin pages, sidebar Content group |
| 5. Desk Editor Integration | Done | Editor, Preview, Documents panels, DeskBus, API routes |

## Phase 1: Database Schema + Domain Module

### Drizzle Config
**File**: `drizzle.config.ts`
- Added `'blog'` to `schemaFilter` array

### ID Generation
**File**: `src/lib/server/db/id.ts`
- `post` -> `pst_` prefix
- `revision` -> `rev_` prefix
- `tag` -> `tag_` prefix
- `asset` -> `ast_` prefix

### Blog Schema (8 tables)
**Directory**: `src/lib/server/db/schema/blog/`

| File | Tables | Key Details |
|------|--------|-------------|
| `post.ts` | `blog.post` | Aggregate root. `blogSchema = pgSchema('blog')`, `postStatusEnum` (draft/published/archived). Slug CHECK constraint, 4 indexes, soft delete via `deleted_at`. `author_id` FK RESTRICT to `auth.user`. |
| `revision.ts` | `blog.revision` | Immutable content snapshots. `revision_number` per (post, locale). `rendered_html` + `embed_descriptors` cached at save time. `content_hash` for RAG skip gate. Locale CHECK constraint. |
| `published-revision.ts` | `blog.published_revision` | Locale-aware publish pointers. Composite PK `(post_id, locale)`. One published revision per post per locale. `revision_id` FK RESTRICT. |
| `tag.ts` | `blog.tag`, `blog.post_tag` | Lightweight taxonomy. Tag slug CHECK. Junction with CASCADE on both FKs. |
| `asset.ts` | `blog.asset`, `blog.post_asset` | File metadata (blobs in R2). `file_size` CHECK > 0. `uploader_id` SET NULL on user deletion. `post_asset` uses RESTRICT on asset deletion. |
| `index.ts` | — | Barrel re-exports |

**Registered in**: `src/lib/server/db/schema/index.ts`

### Relations
**File**: `src/lib/server/db/schema/relations.ts`

Added 7 relation definitions:
- `postRelations` — author, coverImage, revisions, publishedRevisions, postTags, postAssets
- `revisionRelations` — post, author
- `publishedRevisionRelations` — post, revision
- `tagRelations` — postTags
- `postTagRelations` — post, tag
- `blogAssetRelations` — uploader, postAssets
- `postAssetRelations` — post, asset

Extended `userRelations` with: `posts`, `revisions`, `blogAssets`

### Domain Module
**Directory**: `src/lib/server/blog/`

| File | Exports |
|------|---------|
| `types.ts` | `BlogPost`, `BlogRevision`, `BlogTag`, `BlogAsset`, `PostListItem`, `PostDetail`, `PublishedPost`, `TagWithCount`, `ListPostsOptions` |
| `queries.ts` | `listPosts`, `getPublishedPostForSlug`, `getPostById`, `getPostBySlug`, `getRevisions`, `getLatestRevision`, `listTags`, `searchPosts`, `isSlugTaken`, `getTagBySlug`, `listPublishedPostsForFeed` |
| `mutations.ts` | `createPost`, `updatePostMetadata`, `softDeletePost`, `createRevision`, `publishRevision`, `unpublishPost`, `createTag`, `renameTag`, `deleteTag`, `setPostTags`, `createAsset`, `linkAssetToPost`, `unlinkAssetFromPost` |
| `index.ts` | Barrel re-exports |

### Auth Guards
**File**: `src/lib/server/auth/guards.ts`
- `requireAuthor(locals)` — allows admin (via `ADMIN_EMAIL`) or `role === 'author'`. Redirects to login if unauthenticated, 403 if unauthorized.
- `requireApiAuthor(locals)` — same logic, returns 401/403 instead of redirect.

### Migration Note
The `search_vector` GENERATED STORED column on `blog.revision` and its GIN index must be added via raw SQL after `drizzle-kit generate` — Drizzle does not support generated columns. The manual SQL:
```sql
ALTER TABLE blog.revision ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(markdown, '')), 'C')
  ) STORED;

CREATE INDEX blog_revision_search_idx ON blog.revision USING GIN(search_vector);
```

## Phase 2: Markdown Pipeline

### Dependencies Added
15 packages added to `package.json`: unified, remark-parse, remark-gfm, remark-frontmatter, remark-extract-frontmatter, yaml, remark-directive, @flowershow/remark-wiki-link, remark-rehype, rehype-slug, rehype-sanitize, rehype-stringify, @shikijs/rehype, unist-util-visit, hast-util-to-string.

### Content Syntax Definitions
**Directory**: `src/lib/content-syntax/`

| File | Exports |
|------|---------|
| `index.ts` | `SyntaxDefinition` interface, `syntaxes` registry (callout, chart, scene, video), `SyntaxName` type |
| `remark-adapter.ts` | `remarkDirectiveHandlers` — unified plugin that walks directive nodes, validates attrs, extracts `EmbedDescriptor[]`, transforms to HTML placeholders with `data-embed-*` attributes |

### Pipeline Files
**Directory**: `src/lib/server/blog/`

| File | Exports |
|------|---------|
| `pipeline.ts` | `RenderResult` interface, `renderBlogPost(markdown, permalinks?)` — lazy-initialized unified processor with remarkParse→remarkGfm→remarkFrontmatter→remarkDirective→remarkRehype→rehypeSlug→rehypeToc→rehypeShiki→rehypeSanitize→rehypeStringify |
| `content-hash.ts` | `contentHash(markdown)` — SHA-256 via Web Crypto API |
| `sanitize-schema.ts` | `blogSanitizeSchema` — extends GitHub default to allow embed data attrs, heading IDs, Shiki classes/styles |

### Modifications
- **`src/lib/server/shiki.ts`** — exported `getHighlighter()` (was module-private)
- **`src/lib/server/blog/types.ts`** — added `EmbedDescriptor`, `TocEntry` interfaces
- **`src/lib/server/blog/mutations.ts`** — `createRevision` now auto-renders markdown and computes content hash internally. Simplified signature (removed `renderedHtml`, `embedDescriptors`, `contentHash` from caller input)
- **`src/lib/server/blog/index.ts`** — barrel now exports `renderBlogPost` and `contentHash`

## Phase 3: Public Routes

### Blog Components
**Directory**: `src/lib/components/blog/`

| File | Purpose |
|------|---------|
| `Renderer.svelte` | Renders pre-built HTML as styled `<article>` with scoped `:global()` prose styles. Covers h1-h6, p, a, lists, blockquotes, code/pre (Shiki), tables, images, hr, embeds. Embed placeholders styled as dashed-border blocks. |
| `PostCard.svelte` | Post list item with full-card link, title, truncated summary, author, date, tag links. |
| `PostList.svelte` | Reusable list of PostCards + URL-based Pagination via `goto()`. Accepts `basePath` prop for reuse on tag pages. |
| `embeds/registry.ts` | Placeholder embed registry (empty for Phase 3). |
| `index.ts` | Barrel re-exports |

### Routes
**Directory**: `src/routes/(shell)/blog/`

| Route | Files | Description |
|-------|-------|-------------|
| `/blog` | `+layout.svelte`, `+page.server.ts`, `+page.svelte` | Layout adds RSS `<link>`. Index loads published posts paginated (12/page), sorted by `publishedAt desc`. Uses PageContainer, PageHeader, PostList, EmptyState. |
| `/blog/[slug]` | `+page.server.ts`, `+page.svelte` | Single post via `getPublishedPostForSlug`. Full SEO: `<title>`, `<meta description>`, OG tags, JSON-LD `BlogPosting`, `<link canonical>`. Article header + Renderer + back link. |
| `/blog/tag/[tag]` | `+page.server.ts`, `+page.svelte` | Tag-filtered posts via `getTagBySlug` + `listPosts({tagSlug})`. 404 if tag not found. Reuses PostList with `basePath="/blog/tag/{slug}"`. |
| `/blog/feed.xml` | `+server.ts` | RSS 2.0 feed via `listPublishedPostsForFeed(20)`. CDATA-wrapped, `dc:creator`, `atom:link` self-reference. `Cache-Control: public, max-age=3600`. |

### Domain Module Additions
**File**: `src/lib/server/blog/queries.ts`
- `getTagBySlug(slug)` — single tag lookup by slug
- `listPublishedPostsForFeed(limit)` — lightweight published posts for RSS (slug, title, summary, publishedAt, authorName)

### Navigation
**File**: `src/lib/nav/nav.ts`
- Added `{ href: '/blog', label: 'Blog', icon: 'i-lucide-newspaper' }` at index 1 (between Home and Desk)

### Deferred
- ISR configuration (requires `split: true` in adapter)
- Sitemap (`/blog/sitemap.xml`)
- Interactive embed hydration (Renderer shows placeholders)
- Cover images / `og:image` (R2 URL resolution not built)
- Locale routing (`?locale=fr`)
- Search UI on blog index

## Phase 4: Admin Content Management

### Config
**File**: `src/lib/server/config.ts`
- Added `ADMIN_BLOG_PAGE_SIZE = 25`

### Admin Sidebar
**File**: `src/routes/(shell)/admin/+layout.svelte`
- Added **Content** group between Manage and System with Posts + Tags items

### Posts Admin Page
**Directory**: `src/routes/(shell)/admin/content/posts/`

| File | Description |
|------|-------------|
| `+page.server.ts` | Load: `listPosts()` with status/search/page/sort/dir filters. Form actions: `publish` (get latest revision → publish), `unpublish`, `archive`, `delete` (soft). All with audit events. |
| `+page.svelte` | Data table with sortable columns (title, status, published, updated), status filter tabs (All/Draft/Published/Archived), search, pagination, ConfirmDialog for destructive actions. |

### Tags Admin Page
**Directory**: `src/routes/(shell)/admin/content/tags/`

| File | Description |
|------|-------------|
| `+page.server.ts` | Load: `listTags()`. Form actions: `create` (with slug validation), `rename`, `delete`. All with audit events. |
| `+page.svelte` | Table with post counts, inline create form, inline rename mode, ConfirmDialog for delete. |

### Deferred
- Media Library (R2 asset management not built)
- Bulk actions (per-row only for now)

## Phase 5: Desk Editor Integration

### DeskBus
**File**: `src/lib/components/composites/dock/desk-bus.svelte.ts`
- Typed pub/sub with `DeskEvents` interface (3 channels: `editor:content`, `editor:document`, `editor:save`)
- Factory `createDeskBus()` + context pattern (`setDeskBusContext` / `getDeskBus`)
- `replayLast` option replays last payload per channel to new subscribers
- Context set in `DockLayout.svelte` alongside dock state

### Layout Presets
**File**: `src/lib/components/composites/dock/layout-presets.ts`
- `LayoutPreset` interface with `buildLayout(context?)` returning `{ root, panels }`
- **Writing** preset: Documents (20%) | Editor (40%) | Preview (40%)

### Editor Components
**Directory**: `src/lib/components/editor/`

| File | Purpose |
|------|---------|
| `types.ts` | `EditorDocument`, `SaveState` interfaces |
| `EditorPanel.svelte` | Orchestrator: loads post via API, manages editor state, DeskBus publishing, save/publish flow |
| `EditorToolbar.svelte` | 3-zone toolbar: save button + indicator (left), empty center, metadata + publish (right). Inline publish confirmation. |
| `MarkdownSource.svelte` | Textarea wrapper: monospace, full-height, Cmd+S keyboard shortcut |
| `MetadataDrawer.svelte` | Slide-over via Drawer primitive: title, slug (auto-generate + manual), summary, tags (chip toggle), status, locale |
| `DocumentsPanel.svelte` | Post browser: fetches via API, "New Post" creates draft + opens editor, status badges, relative time |
| `index.ts` | Barrel re-exports |

### Preview Panel
**Directory**: `src/lib/components/preview/`

| File | Purpose |
|------|---------|
| `PreviewPanel.svelte` | Subscribes to DeskBus `editor:content` (replayLast). Debounced 300ms POST to `/api/blog/preview`. Uses `blog/Renderer.svelte`. Loading/error/empty states. AbortController for in-flight cancellation. |
| `index.ts` | Barrel re-export |

### API Routes
**Directory**: `src/routes/api/blog/`

| Route | Methods | Description |
|-------|---------|-------------|
| `posts/+server.ts` | GET, POST | List author's posts, create draft. Slug validation + uniqueness check. |
| `posts/[id]/+server.ts` | GET | Load post + latest revision + tags for editing |
| `posts/[id]/revisions/+server.ts` | POST | Save new revision (title, summary, markdown, locale) |
| `posts/[id]/publish/+server.ts` | POST | Publish latest revision for locale |
| `posts/[id]/tags/+server.ts` | PUT | Set post tags (delete-then-insert) |
| `tags/+server.ts` | GET | List all tags (for metadata drawer picker) |
| `preview/+server.ts` | POST | Server-side markdown rendering via unified pipeline |

All routes use `requireApiAuthor(locals)` — allows admin or author role.

### Panel Config
**File**: `src/lib/config/desk-panels.ts`
- Added `documents`, `editor`, `preview` to `DESK_PANEL_TYPES`, `DESK_PANELS`, `DESK_ACTIVITY_BAR_ITEMS`

### Desk Page Integration
**File**: `src/routes/(desk)/desk/+page.svelte`
- Imports `DocumentsPanel`, `EditorPanel`, `PreviewPanel`
- Added rendering branches in `panelContent` snippet for `documents`, `editor`, `preview` types
- Editor receives `panelId` to extract encoded document ID (e.g., `editor-pst_abc123`)

### Deferred
- Slash command palette (requires CodeMirror for cursor positioning)
- CodeMirror 6 integration (Phase 2 of progressive editor enhancement)
- Lezer grammar extensions for custom syntax highlighting (Phase 3)
- IndexedDB autosave (protect against tab close)
- Revision history in MetadataDrawer (view/compare/restore)
- Layout preset selector UI
- Full preview mode (server-rendered via public route)
- Asset upload / image insertion

## Review Fixes

Post-implementation review by 5 specialized agents (archy, svey, uxy, daty, secy).

### Security
- **Ownership checks** on all `/api/blog/posts/[id]/*` routes — `requirePostOwnership()` helper in `guards.ts`
- **XSS hardening** — removed `style` from `<span>` in sanitize schema, removed `allowDangerousHtml` from `rehypeStringify`
- **RSS CDATA escape** — `escapeCdata()` on all interpolated values in `feed.xml`
- **Input validation** — `tagIds` type/prefix/length validation, 500KB markdown size limit on revision + preview, generic preview error message
- **JSON-LD escaping** — added `<!--` escape alongside existing `</script` escape

### Data Integrity
- **Publish double-update** — removed redundant `updatePostMetadata` call after `publishRevision` in both API route and admin action (was resetting `publishedAt`)
- **Slug partial index** — `blog_post_slug_idx` now filters `WHERE deleted_at IS NULL` to allow slug reuse after soft-delete
- **Revision ownership** — `publishRevision()` now verifies revision belongs to post before UPSERT
- **coverImageId FK** — deferred (circular import between `post.ts` and `asset.ts`; requires raw SQL migration)

### SvelteKit Patterns
- **Timer cleanup** — `onDestroy` in `EditorPanel` clears `contentTimer` and `tagTimer`
- **`getPostId` helper** — changed `throw fail(400)` to `error(400)` so status propagates correctly from helper
- **Domain module boundary** — inline tag query in `posts/[id]/+server.ts` replaced with `getTagsForPost()` from queries.ts

### Accessibility
- `aria-label` on icon-only buttons in `DocumentsPanel` (refresh, new post)
- `<label>` for slug input in new-post form
- `role="alert"` on error banners in `EditorPanel` and `PreviewPanel`
- `aria-label="Dismiss error"` on dismiss button
- `aria-pressed` on tag chip toggles in `MetadataDrawer`
- `:focus-visible` outline on `.reset-btn`
- `role="status"` + `aria-live="polite"` on save indicator
- Title fallback `(untitled)` in `DocumentsPanel` for posts without titles

### UX
- **Publish confirmation timeout** — auto-cancels after 5 seconds
- **Tag save feedback** — restores previous tags on failure, surfaces error message

### Deferred (Query Efficiency — separate PR)
- `listPosts` latest-revision: replace JS dedup with `DISTINCT ON (post_id)`
- `listPublishedPostsForFeed`: add `post.id` to first select to eliminate redundant round-trip
- `searchPosts`: add `DISTINCT ON (post_id)` for deduplication

## Future Phases

See `docs/blueprint/blog.md` for Phase 5 (Content Graph v2 tables) specifications.
