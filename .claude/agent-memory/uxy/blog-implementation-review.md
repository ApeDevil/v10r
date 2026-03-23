---
name: Blog Implementation UX Review
description: Full UX quality audit of the feature/blog implementation — editor, preview, public blog, admin — comparing built code against the blog-final-ux-specs.md design contract. Rating each area GOOD/WARNING/ISSUE with specific observations and recommendations.
type: project
---

Full UX audit completed 2026-03-23 on feature/blog branch.

**Why:** Pre-merge quality gate to catch UX regressions and spec divergences before production.

**How to apply:** Use as a punch-list for Phase 2 polish. Items marked ISSUE block spec compliance; WARNINGs are improvements worth addressing. GOOD items confirm the spec landed correctly.

---

## Overall Verdict

The implementation is a solid, honest first pass. The architecture is correct, the data flows are clean, and the happy path works end to end. The gaps are almost entirely in the polish layer: incomplete spec conformance, accessibility voids in custom interactive elements, and a handful of silent failure modes that erode trust.

Nothing here is a regression from zero — but several items from the design contract (blog-final-ux-specs.md) were deferred or diverged from without replacement patterns.

---

## 1. Error States

**Rating: WARNING**

**What is good:**
- EditorPanel shows an inline dismissible error banner with proper token coloring (--color-error / --color-error-bg).
- DocumentsPanel has a visible error zone for fetch and create failures.
- PreviewPanel shows a preview-specific error stripe with an alert icon.
- save() correctly restores saveState to 'unsaved' on failure, preventing a stuck indicator.

**What is missing or wrong:**

1. Tag save failures are silently swallowed (EditorPanel lines 199-207). Tags are user data. A silent failure here means the user publishes a post, discovers missing tags in production, and has no idea why. At minimum: restore previous tags state on failure and show an inline error in MetadataDrawer.

2. EditorPanel's loadDocument() throws `new Error('Failed to load post')` with no HTTP status context. A 404 (post not found) and a 500 (server error) look identical to the user. Parse `res.status` and produce distinct messages: "Post not found" vs "Server error — try again."

3. The editor error banner sits between toolbar and textarea (lines 233-240), which is correct placement, but it has no ARIA role. Add `role="alert"` so screen readers announce it immediately on appearance.

4. The dismiss button in the error banner (`.dismiss-btn`) has no accessible label — it is a bare `<span class="i-lucide-x">` inside a raw `<button>`. Add `aria-label="Dismiss error"`.

5. PreviewPanel error (line 89-94) has no dismiss and no retry. The spec says "show last render with 'Preview unavailable — showing last render.' + Retry link. Never clear the pane." The current code replaces content with only an error stripe. If the user's last render was 500 words of formatted text and a network hiccup occurs, it disappears. Show error as a transient overlay on the existing content, not a replacement.

---

## 2. Loading States

**Rating: GOOD with caveats**

**What is good:**
- EditorPanel shows Spinner + "Loading document..." text centered in the panel. This is the correct pattern.
- DocumentsPanel shows Spinner centered in the list area.
- PreviewPanel correctly distinguishes two loading tiers: full-panel spinner for first load, small "Updating..." strip for subsequent refreshes.
- Publish button is disabled during save (`disabled={saveState === 'saving'}`).
- The save indicator has a pulsing dot during save — a subtle but effective ambient signal.

**Caveats:**

1. DocumentsPanel empty loading state shows only a spinner with no text label (line 138). Add a short "Loading posts..." label at 11-12px below the spinner, matching the pattern in EditorPanel.

2. When `createNewPost()` is in flight, the slug input is disabled but there is no visual treatment on the form aside from the Spinner/Create button state. The input goes from normal to disabled instantly without any opacity or color cue. Add `opacity-50` or similar to the whole form while `creating` is true.

3. The `saving` state in the toolbar renders a Spinner inside the Save button, which is good, but the save-indicator dot also pulses at the same time. These two signals compete. Consider suppressing the indicator text during save (show only the pulsing dot) since the button itself is the primary save signal.

---

## 3. Empty States

**Rating: GOOD**

**What is good:**
- EditorPanel: centered icon + "Open a document from the Documents panel" — clear instruction.
- PreviewPanel: centered icon + "Open a document to see preview" — matched pattern.
- DocumentsPanel: icon + "No posts yet" — correct.
- Public blog index: uses EmptyState component with "No posts yet" + description.
- Tag page: empty state is tag-specific, not generic.
- Admin posts: distinguishes filtered-empty from truly-empty, providing a "Clear filters" action in the filtered case. This is excellent.

**Minor issues:**

1. DocumentsPanel empty state (lines 139-143) does not include a CTA to create the first post. The "New" button is in the panel header, but it's easy to miss. When the list is empty, add a link or button inside the empty state: "Create your first post" that triggers `showNewForm = true`. Reduce cognitive scan.

2. The spec's blog empty state (blog-final-ux-specs.md) specified: "No posts published yet. Check back soon, or subscribe to the feed." with /blog/feed.xml link. The implementation reads "No posts yet / Published posts will appear here." — close but missing the RSS link that positions the feed as an alternative.

---

## 4. Save/Publish Flow

**Rating: WARNING**

**What is good:**
- The two-step inline confirmation for publish is implemented and correct in structure: first click → confirm/cancel pair appear. This matches the spec and is the right UX pattern.
- save() runs automatically before publish() if there are unsaved changes.
- The save indicator has three meaningful states: saved (green dot), unsaved (amber dot), saving (pulsing neutral dot).
- The button label is status-aware: "Publish" for drafts, "Update" for already-published posts.

**What is missing or wrong:**

1. The spec requires a 5-second countdown ring on the confirm button that reverts automatically. The implementation has no timeout. A user who accidentally clicks Publish and walks away has an indefinitely open "Confirm publish" state. Add a `setTimeout` in `handlePublishClick()` that calls `cancelPublish()` after 5000ms, and animate the button border as a progress ring.

2. The Metadata icon is a generic settings gear (`i-lucide-settings`). The spec called for `i-lucide-sliders-horizontal`. The gear is a system settings affordance — it reads as "editor settings" not "post metadata." The sliders icon is semantically closer to "adjustable properties."

3. The toolbar center zone is empty (line 83: `<!-- Center zone: empty in Phase 1 -->`). This is intentional per the spec but creates a visually unbalanced toolbar at narrow panel widths. The save indicator and metadata/publish buttons collide at approximately 480px panel width. Consider at minimum testing what this looks like at 300px (narrow panel) and at 800px (wide panel) and ensuring nothing wraps or overflows.

4. The save indicator uses color-only signaling for states. The green dot = saved, amber dot = unsaved distinction relies entirely on hue. Users with deuteranopia cannot distinguish green from amber at 6px. Add a secondary shape or letter cue: a checkmark for saved, an exclamation for unsaved. Alternatively, the text label ("Saved 2m ago" vs "Unsaved changes") is sufficient but the dot itself must not be the sole indicator.

5. Auto-save is not implemented. The spec specified that Title, Slug, Summary, and Tags autosave on blur to the post row (not creating a revision). The current implementation requires an explicit Save action for all content. This is lower risk than missing auto-save on the body, but means a slug or title change is lost if the user navigates away without saving.

---

## 5. Keyboard Shortcuts

**Rating: WARNING**

**What is good:**
- Cmd+S / Ctrl+S is correctly intercepted in MarkdownSource (line 11) via `e.preventDefault()` and calls `onsave()`. This is the right binding location.

**What is missing:**

1. Cmd+S only works when focus is inside the textarea. If the user's cursor is in the MetadataDrawer (e.g. title field), Cmd+S falls through to the browser save-as dialog. The spec's resolution was CM6-owned Cmd+S binding — but since we're using a raw textarea, a global keydown listener on the editor panel container is needed as a fallback. Mount it on `.editor-panel` with `onkeydown` and check `!e.defaultPrevented`.

2. The spec planned Cmd+\ (toggle preview), Cmd+Shift+P (command palette). Neither is implemented. At minimum, document that these are Phase 2 — users discovering them via muscle memory will expect them.

3. Tab key in the textarea has no custom behavior. Standard browser Tab will leave the textarea. For a markdown editor, Tab is commonly used for list indentation. The spec mentioned this as a CM6 concern — but for a raw textarea, add a `handleKeydown` Tab case that inserts two spaces and calls `e.preventDefault()`.

4. Escape does not close the MetadataDrawer when focus is inside it. The Drawer component should handle this via its own Escape binding (likely already present in Bits UI Drawer), but confirm it does not require manual wiring.

---

## 6. Form Usability (MetadataDrawer)

**Rating: WARNING**

**What is good:**
- Title-to-slug auto-generation works on every keystroke via `slugify()`. The pattern is correct.
- "Reset to auto" button appears inline next to the slug label only when manually overridden — clean progressive disclosure.
- Tag chips show selection state via background fill.
- Status is displayed as a read-only Badge. This prevents accidental status changes.

**What is missing or wrong:**

1. Summary textarea is a raw `<textarea>` (MetadataDrawer line 99), not the Textarea component from `$lib/components/primitives`. This violates the component-first rule and produces a visually inconsistent input — it has a custom bottom-border focus style while all other fields use the Input component's ring style. Use the Textarea primitive.

2. There is no character count on the Summary field. The spec specified a 200-char limit with visible count. Without it: users write 800-word summaries that get truncated silently in SEO previews and post cards (which clamp at 2 lines).

3. Slug field shows the raw slug string but no URL preview. The spec said "URL preview below" — showing `yoursite.com/blog/[slug]` gives the author confidence they're writing the correct path. At this field width, even a truncated `…/blog/my-post-title` helps.

4. The Locale field is a free-text Input (MetadataDrawer line 118). A user can type anything — "EN", "english", "en-gb". The spec said to use a select and hide it until i18n is active. A free-text locale field will produce malformed data. Either replace with a select of valid BCP47 codes, or add inline validation that normalizes input to lowercase BCP47 format.

5. Tag chips lack keyboard accessibility. They are raw `<button>` elements without `aria-pressed` to communicate selection state to screen readers. Add `aria-pressed={isTagSelected(t.id)}` to each tag chip button.

6. The `reset-btn` for slug is a raw unstyled `<button>` (line 90) with no focus ring. This falls outside the design system. Replace with a Button variant="ghost" size="xs" or apply a `:focus-visible` outline.

7. When `availableTags.length === 0`, the hint says "Create tags in admin." — good. But there is no link to `/admin/content/tags`. The author is forced to navigate there manually, losing their editor context. Make "admin" a hyperlink.

---

## 7. Navigation

**Rating: WARNING**

**What is good:**
- openPost() adds a new editor panel to the dock and switches to it. This works.
- After creating a new post, the panel opens automatically — no extra click needed.
- The breadcrumbs on public blog pages (Blog > Posts tagged "X") are correct.
- Single post has a "All posts" back link at the bottom.

**What is missing or wrong:**

1. DocumentsPanel has no "currently open" indicator. If the user has two posts open in editor panels, the Documents panel list shows no visual distinction between the one currently focused and others. A left border accent or bold title for the active document would orient the user.

2. Creating a new post requires the author to type a slug. Slug is an internal technical concept — most writing tools ask for a title first, then derive the slug. The new-post form should ask for a Title (mapped to `title` field), derive the slug automatically, and present the slug as secondary information. The current UX puts slug as the first thing a new author types, which is backwards.

3. The DocumentsPanel `doc-title` field (line 148) displays `p.title` directly. For new posts with no revision, `title` is empty — the DocumentsPanel will show a blank entry. The admin Posts table handles this with `p.title ?? '(untitled)'`. DocumentsPanel should do the same.

4. There is no way to navigate from the editor to the public-facing post URL. After publishing, the author has no one-click path to see their post live. Add a "View live" link/button in the toolbar that becomes active when `status === 'published'`, linking to `/blog/${slug}` in a new tab.

---

## 8. Accessibility

**Rating: ISSUE**

This is the most under-served area.

**Missing or wrong:**

1. DocumentsPanel custom buttons (`.document-item`, `.header-btn`) are raw `<button>` elements without accessible names beyond their visible text content. The refresh button (`title="Refresh"`) has a tooltip but no `aria-label`. The new post button (`title="New Post"`) similarly. `title` attributes are not reliable for screen readers. Add `aria-label="Refresh documents"` and `aria-label="New post"` explicitly.

2. Tag chips in MetadataDrawer have no `aria-pressed` state (discussed in section 6). A screen reader user cannot determine which tags are selected.

3. The save-dot color indicator is color-only (discussed in section 4). WCAG 1.4.1 requires that color is not the sole means of conveying information.

4. The MetadataDrawer `<textarea>` for Summary has no focus ring that matches the rest of the design system. It uses a raw `border-bottom: 2px solid var(--color-primary)` which works for sighted users but provides no `:focus-visible` indicator for keyboard navigation.

5. The error dismiss button in EditorPanel (line 236-238) has no `aria-label`. It is `<button class="dismiss-btn"><span class="i-lucide-x"></span></button>` — the icon carries no text equivalent.

6. The `new-post-form` slug input in DocumentsPanel (line 119-125) is a raw `<input type="text">` with no `<label>` — only a `placeholder`. Placeholders disappear on input, leaving no persistent label. This violates WCAG 1.3.1. Add a visually hidden `<label>` or use aria-label on the input.

7. The preview-content region (PreviewPanel line 103) has `role="region"` and `aria-label="Post preview"` — good. The `aria-live="polite"` is also correct. No changes needed here.

8. Focus management when opening the MetadataDrawer is not visible in the component code. When `showMetadata` transitions from false to true, focus should move to the first interactive field in the Drawer (the Title input). If Bits UI Drawer handles this automatically, it is fine — but it should be confirmed.

---

## 9. Responsive Considerations

**Rating: WARNING**

The desk editor is inherently a wide-screen tool, which is acceptable, but several specific concerns apply:

1. The desk layout at `/desk` has no mobile gate. On a 375px viewport, the DockLayout panel system will be unusable. There should be a route-level guard or `<svelte:head>` viewport meta that prevents scaling issues, or a "Desk requires a desktop browser" interstitial below a breakpoint (e.g. < 768px).

2. The toolbar in EditorToolbar uses a three-zone flex layout. At narrow panel widths (< ~350px), the right zone (Metadata + Publish + Cancel) will wrap or overflow. The toolbar has `min-height: 36px` but no `flex-wrap: wrap` or overflow handling. Test at 280px panel width.

3. Public blog pages use `PageContainer` with `width="content"` and `width="wide"` which presumably handles max-width and responsive padding. These look fine.

4. The admin posts table has `overflow-x: auto` on the wrapping div — correct. The table itself is wide (8 columns including Tags and Actions). On a 768px screen, the horizontal scroll will be frequent. Consider hiding less-critical columns (Slug, Author) behind a show/hide toggle at narrower widths.

5. MetadataDrawer is a slide-over Drawer. On mobile, it should take full width. The underlying Bits UI Drawer likely handles this via CSS — confirm it does not have a fixed `width: 400px` that cuts off on small screens.

---

## 10. Feedback Loops

**Rating: GOOD with gaps**

**What is good:**
- The save indicator provides continuous ambient status — the user always knows if their work is saved.
- The preview "Updating..." strip during re-render is excellent ambient feedback.
- Admin tables use toast notifications via `getToast()` for action success/failure.
- The publish confirm pattern gives the user a moment to reconsider.
- The `relativeTime()` function produces human-readable timestamps in both DocumentsPanel and admin Posts.

**Gaps:**

1. After successfully publishing a post, there is no positive confirmation. `status` updates to 'published' and the button label changes to "Update" — but nothing announces "Your post is now live." A brief toast ("Post published") closes the feedback loop and gives the author a moment of satisfaction. The spec described this flow but the code has no toast import in EditorPanel.

2. After saving (on success), `saveState` becomes 'saved' and the indicator updates — this is good. But there is no transient positive signal. The dot goes from pulsing to green silently. A brief 200ms scale animation on the green dot on state transition would provide satisfying confirmation without being intrusive.

3. Tag save operations are entirely silent — no indicator that the tag toggle was persisted (see section 1, item 1). The only feedback is the chip's visual selection state, which is optimistic. If the debounced PUT fails, the chip stays selected but the server has not been updated.

4. When `createNewPost()` succeeds, the panel opens and the user sees an empty editor. There is no text or cue telling them "this is your new post." The empty state fallback ("Open a document from the Documents panel") does not show because `documentId` is set — but the `latestRevision` block is null, so `markdown` is empty and the textarea is blank. A first-time user might wonder if the post was created at all. A first-use hint: "Start writing your post below. Use Cmd+S to save." would help.

---

## Summary Table

| Area | Rating | Key Action |
|------|--------|------------|
| Error States | WARNING | Add `role="alert"`, accessible dismiss label, preview error overlay |
| Loading States | GOOD | Minor: loading text on DocumentsPanel, form opacity during create |
| Empty States | GOOD | Add CTA in doc panel empty state, RSS link in public empty state |
| Save/Publish Flow | WARNING | Add 5s countdown timeout, fix metadata icon, color-only dot |
| Keyboard Shortcuts | WARNING | Global Cmd+S fallback, Tab indentation, document Phase 2 shortcuts |
| Form Usability | WARNING | Textarea component, char count, URL preview, locale select, aria-pressed |
| Navigation | WARNING | Active doc indicator, title-first new post, "View live" button |
| Accessibility | ISSUE | aria-labels on icon buttons, aria-pressed on tags, label on slug input |
| Responsive | WARNING | Mobile gate on desk, toolbar overflow at narrow widths |
| Feedback Loops | GOOD | Add publish success toast, tag save confirmation |
