---
name: Blog System Blueprint UX Review
description: Full UX review of docs/blueprint/blog.md covering authoring experience, preview latency, cross-panel communication, document lifecycle, content discovery, AI citation UX, error states, accessibility, and mobile. Includes strengths, concerns by severity, suggestions, and open questions.
type: project
---

Formal review of the blog system blueprint. Produced 2026-03-23.

**Why:** Pre-implementation review to catch UX gaps before they become architectural debt.

**How to apply:** Reference during Phase 2 (Desk Editor) and Phase 3 (AI Integration) implementation to ensure the issues raised here are resolved.

---

## Strengths

- Server-side preview API prevents client/server rendering drift by design
- Progressive enhancement editor path (Textarea → CM6 → Lezer) removes risk from day one
- Slash command palette is the right discovery surface for non-obvious syntax
- Shared content-syntax spec prevents Lezer/remark drift structurally, not by convention
- Immutable revisions mean every save is safe — no destructive autosave
- IndexedDB conflict prompt on open ("You have unsaved changes from [date]") is exactly correct
- Citation hallucination mitigation (unmatched [N] renders as plain text) is the right defensive approach
- Files panel scope parameter (blog vs. all) is flexible without complexity for v1
- Admin/desk separation (manage vs. create) is a clean mental model

## Concerns

### Critical

**C1: No explicit "unsaved" state signal in the editor**
The blueprint describes IndexedDB autosave and explicit server-save as two separate actions, but nowhere specifies what the UI shows to distinguish: (a) "saved to IndexedDB only", (b) "saved to server (new revision)", (c) "never saved". On a crash or tab close, the author may not know which state they were in. An author who doesn't know their save state cannot make confident decisions about closing a tab or switching devices.

**C2: Publish is irreversible with no undo path described**
The MetadataDrawer status transition triggers publishPost() → RAG ingest → Neo4j sync. The blueprint treats this as a single action with no rollback UX. If an author accidentally publishes (misclick on a status dropdown), there is no "unpublish" affordance described. The data model supports it (status can revert to 'draft'), but the UX path is absent.

**C3: Preview latency may feel broken without a loading state spec**
300ms debounce + ~100-200ms server round-trip = ~400-500ms from keystroke to updated preview. At typing speed, the preview will frequently be stale. The blueprint mentions the debounce but specifies no loading indicator for the preview pane during pending renders. Without a visible in-flight state, authors will think the preview is broken or that their changes weren't picked up.

### Major

**M1: Files panel metaphor is a weak fit for document browsing**
"Files" as a label (and the i-lucide-folder-tree icon) implies filesystem browsing — folders, paths, file operations. Blog posts are not files. Users arriving at the desk will open "Files" looking for filesystem management and will not think to look there for blog posts. The label and icon need to reflect the actual content ("Documents", "Content", or "Posts" with a document icon). The panel should describe itself clearly from its activity bar icon.

**M2: New Post entry point is ambiguous in the activity bar**
The blueprint says clicking "Editor" icon OR "New Post" action opens the writing layout. If there is both an "Editor" icon and a "New Post" action, where exactly does "New Post" live? Is it a button in the activity bar? A context menu? A command palette action? The activity bar items in desk-panels.ts are panel toggles, not actions. Injecting a create-new action into the same space risks unclear affordances.

**M3: MetadataDrawer is the only publish surface, but it's hidden**
Publishing is a critical, infrequent action. The only way to publish is to open the MetadataDrawer and change the status dropdown. This is low-discoverability for a high-importance action. Authors who don't know to look in the MetadataDrawer will not find publish.

**M4: Document lifecycle for the first post is unclear**
New Post → MetadataDrawer for title/slug → start writing. But: does the post exist in the DB before writing begins, or only after the first explicit save? If the post is not persisted before the first save, and IndexedDB is the only storage, a crash before first save loses everything. If it IS pre-created on "New Post", the UX must handle the case where an author creates a post, never writes anything, and abandons — creating ghost draft records.

**M5: Cross-device editing has no solution beyond the single-device conflict prompt**
The blueprint addresses the case where a user opens the same post on a second device (newer IndexedDB vs. server revision prompt). But it doesn't address two authors editing the same post concurrently (multi-author is explicitly in scope). No locking, no last-write-wins notice, no merge hint. With the multi-author role in the data model, this gap will be hit.

**M6: Embed placeholder cards in the live preview have no visual hierarchy**
The preview pane shows rendered prose alongside embed placeholder cards. The blueprint doesn't specify how placeholder cards look or how they're distinguished from rendered content. If placeholders look like rendered content (same background, same weight), the author won't know which parts of their preview are "real" and which are standing in for embeds. This is especially confusing for callout blocks, which have visual styling that could be mistaken for a rendered callout.

**M7: Slash command palette trigger conflict with undo**
The palette triggers on `/` at line start. CodeMirror's undo stack will undo the `/` insertion when the user presses Cmd+Z — if the palette opened and was dismissed (Escape), this is correct behavior. But if the palette opened, the user typed a filter, and then pressed Escape, Cmd+Z may undo the filter characters, leaving a dangling `/` on the line. The undo-aware insertion behavior in CM6 needs to be specified: the `/` should only enter the undo stack if it's committed (not dismissed).

### Minor

**m1: Revision history has no UI surface described**
Immutable revisions are a strong safety guarantee. But authors who know they can "go back" will look for a way to view and restore past revisions. The blueprint describes the data model for revisions but no UI for browsing or restoring them. Even a minimal "Revision history" link in the MetadataDrawer that shows a list of revisions with their timestamps and a restore button would complete the mental model.

**m2: Tag input in MetadataDrawer needs a UX spec**
Tags are a junction table. The MetadataDrawer handles tags, but no spec exists for the tag input surface. The two expected patterns are: (a) a Combobox that searches existing tags and creates new ones inline, or (b) a token input (multi-select). These are meaningfully different interactions. The existing Combobox primitive can handle this but needs a clear "create if not found" affordance.

**m3: RSS/Atom feed discoverability**
/blog/feed.xml exists but there's no mention of the <link rel="alternate"> in the blog index page head, or a feed icon in the blog layout. Both RSS readers and crawlers discover feeds via the meta tag. This is a one-liner but easy to miss.

**m4: Empty state for the blog index**
The /blog/ index with zero published posts needs a defined empty state — what does the page show before any content exists? Particularly important because early access to the blog system means authors will see this state often.

**m5: Citation tooltip shows relevance score — is that user-facing language?**
The hover tooltip is specified as "document title + relevance score". A raw similarity score (e.g., 0.73) is meaningless to most users and could erode trust if it looks arbitrary. Consider "high relevance", "related", or simply omitting the score from the hover and keeping it for debugging.

## Suggestions

**S1: Add a persistent save status indicator to the editor toolbar**
Three states, clearly labeled:
- "Saved" (last server revision timestamp) — green dot or checkmark with relative time
- "Unsaved changes" — amber dot, to communicate IndexedDB-only state
- "Saving..." — in-flight indicator

This answers "did my save work?" without requiring the author to check anywhere else.

**S2: Promote Publish to a dedicated toolbar button**
A "Publish" button (or "Publish..." that opens MetadataDrawer pre-scrolled to status) in the editor toolbar makes the action discoverable. Inside MetadataDrawer, keep the status field as the authoritative control. The toolbar button is a shortcut, not a duplicate. It should not exist when status is already 'published' — replace it with "Update" or "Unpublish".

**S3: Define three explicit embed states in the preview pane**
- Rendering: skeleton with embed-type label ("Chart loading...")
- Placeholder: the embed token is present but preview doesn't render it live — show a labeled card with the embed type, its ID, and a "Preview in full mode" link
- Error: embed configuration is invalid — show the card in error state with the specific problem ("Chart ID not found")

**S4: Add a soft confirmation before publish, not a modal**
Rather than a confirmation modal (which adds a step to the happy path), consider an inline confirmation: clicking "Publish" transitions the button to "Confirm publish" + "Cancel" for 3 seconds. One extra click, no modal, no focus trap. This pattern prevents accidental publish while keeping the action discoverable.

**S5: Rename "Files" panel to "Documents" in activity bar**
i-lucide-file-text or i-lucide-notebook is a more accurate icon. The label "Documents" (or "Content") communicates what's inside without requiring the user to open it to find out. When notes and docs land as future content types, "Documents" scales; "Files" does not.

**S6: Specify a loading indicator pattern for the preview pane**
The preview pane header should show a subtle in-progress indicator (a thin progress bar at the top of the pane, or a "Updating..." label replacing the pane title) when a server render is in flight. Dismiss it when the new HTML arrives. This closes the "did my change get picked up?" loop.

**S7: Autosave-to-server for title + metadata only (not content)**
The current model saves content only on explicit server-save. Consider saving title and metadata (slug, tags, status) on blur from MetadataDrawer fields. These are small payloads, don't create revision bloat (they live on blog.post, not blog.revision), and prevent the painful case where an author spends 30 minutes on metadata setup, closes the tab, and loses it all because IndexedDB wasn't protecting the drawer fields.

**S8: Define the DeskBus error handling contract explicitly**
The blueprint says "panels subscribe defensively — a failed handler doesn't propagate to the publisher." This is correct but needs a corresponding spec: what does the preview panel show when it has received no content update for >5s? A stale indicator? A "Preview unavailable" state? The bus being fire-and-forget is the right architectural choice; the UX for what subscribers show when the publisher goes silent is the missing piece.

## Questions for the Team

**Q1: Who are the authors?**
The blueprint supports multi-author and an 'author' role. Are these trusted internal contributors (admins giving themselves the author role), or external contributors who shouldn't see admin tools? The answer changes the access model for the desk: does an 'author'-role user have desk access but not admin/content access? The current auth gating spec (`role === 'admin' || role === 'author'` for desk) covers access but the desk itself exposes all panels — should authors see terminal, dashboard, and spreadsheet panels, or only editor/preview/files/chat?

**Q2: What is the expected concurrency model for drafts?**
The multi-author data model is present (author_id per revision) but concurrent editing is not addressed. Is the expectation "one author at a time per post, enforced by convention" or "we will add optimistic locking later"? The answer determines whether the conflict prompt on multi-device open should say "Someone else may be editing this" or only reference the user's own devices.

**Q3: Should the writing layout preset be discoverable from the blog reading experience?**
A reader who clicks "Edit" on a published post (if they have author role) — where do they land? The blueprint says the desk, but is there a direct route `/desk?open=blog-post:pst_abc123` that deep-links into the writing layout preset with that document pre-loaded? Or does the author always navigate to desk and then open via the Files panel? The former is a much better authoring entry point from a reader's perspective.

**Q4: What happens when /api/blog/preview returns an error?**
The preview pane calls the preview API on every debounced change. The blueprint mentions server-side rehype-sanitize and the unified pipeline running server-side — what are the expected failure modes? A syntax error in a directive? A malformed embed descriptor? These will happen frequently during authoring. The preview pane needs a defined degraded state: show last good render with an error banner, or clear the pane with an error message?

**Q5: Is the DeskBus scoped to the current browser session or persisted?**
If a user opens the desk, opens the editor, then closes the preview panel and re-opens it, does the re-opened preview panel receive the current document content immediately (via a replay of the last `editor:document` and `editor:content` events), or does it start blank until the next keystroke? This matters for the "I accidentally closed a panel and re-opened it" case, which is common.
