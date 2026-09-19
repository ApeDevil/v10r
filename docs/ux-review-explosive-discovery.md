# UX review — Explosive Discovery, 2026-09-18

Method: `.claude/skills/uxy-explosive-discovery/SKILL.md` over the principle in
`docs/blueprint/design/explosive-discovery.md`. Advisory throughout: nothing here is a
defect unless another requirement makes it one. Counts are at the densest state a real user
sees, not the union of all branches. Paths are relative to `src/lib/components/` unless they
start with `src/`.

This file is a working record (top-level `docs/` is neither served nor RAG-ingested). It
gains a `## Decisions` section once Stas picks, and is then kept or deleted.

## Summary

| # | Surface | Verdict | Size |
|---|---|---|---|
| 1 | Explorer node context menu | reference embodiment — no change | — |
| 2 | Explorer create actions ignore the selected folder; `new-post` has no projection | opportunity | small |
| 3 | Panel kebab ↔ mobile commands sheet | reference embodiment — no change | — |
| 4 | Two menu items close the same panel (Panel → Close Panel, View → Close Active Panel) | opportunity | small |
| 5 | Help is a one-item direction (kebab → Help → About) | opportunity | small |
| 6 | Desk commands have no shell-level discovery signal (`shift+/`, `⌘K` don't know them) | opportunity | medium |
| 7 | Showcases flyout: 25 rows flat while the registry knows five domains | opportunity | medium |
| 8 | Top-nav admin dropdown: 10 curated, flat | direct exposure is right — optional | small |
| 9 | Admin tags page | largely right; a second Refresh duplicates the first | small |
| 10 | `⌘K` launcher, admin sidebar, tab-bar context menu, user menu, account tabs, Vely header | below the trigger or already structured — no change | — |

---

### 1. Explorer node context menu — `desk/panels/explorer/context-menu-items.ts:50-94` [both]
- Observation: the union of possible items is 13 across six groups (Open · AI Context · Edit · Type-specific · Create · Destructive). No node ever renders the union: a spreadsheet shows 7 (`adapters/desk-files.ts:4-12`), a post 7 (`adapters/blog-posts.ts:4-12`), an asset 7 (`adapters/blog-assets.ts:4-12`), a folder 5. Groups with no items are omitted (`:112-116`), so separators never dangle.
- Reasoning: file-manager vocabulary is familiar and repeatedly used; the groups already narrow intent in a fixed, learnable order; on touch the same list is a permanent row kebab (`TreeNode.svelte`), on desktop right-click plus F2 / M keys.
- Opportunity: none — direct exposure is right here.
- Possible Direction: cite as the in-repo reference for *availability ≠ visibility*: the capability `Set` is the model, the builder is the projection.
- Trade-off: nesting Edit or Type-specific under a direction would add a hop to the most repeated actions for no gain in comprehension.
- Evidence: `context-menu-items.ts:96-120`, the three adapters' capability arrays.
- Hand-off: none.
- Size: —

### 2. Explorer create actions — `desk/panels/explorer/ExplorerPanel.svelte:356-373`, `adapters/blog-posts.ts:14,32` [both]
- Observation: blog folders and the blog root declare the capability `new-post` (`blog-posts.ts:14`, `:32`), but `GROUPS` in `context-menu-items.ts` has no entry for it, so no context menu ever shows *New Post*. The only door is File → New Post (`ExplorerPanel.svelte:360-367`), which opens a slug form and creates at the root (`createNewPost`, `:260-290`, posts only `{ slug }`). File → New Spreadsheet always creates in the data root (`:368`) while the folder context menu creates *in* the folder (`onNewSpreadsheet`); File → New Folder does use the selection (`inferSelectedAnchor`, `:350-353`) — three create commands, three different answers to "where".
- Reasoning: this is signal 11 (*context is known but does not affect the action*) and the inverse of invariant 1 — a capability declared in the model with no projection at all. A user who right-clicks a blog folder sees New Folder but not New Post, and after File → New Post must Move the post into the folder they had selected.
- Opportunity: consistent context promotion for creation: the selected folder is the context; every create command should honour it, and every declared capability should have at least one projection.
- Possible Direction: add a `new-post` item to the Create group in `context-menu-items.ts` (label *New Post*, icon `i-lucide-plus`, action `newPost`) and an `onNewPost` callback; `createNewPost` takes the anchor folder (`POST /api/blog/posts` already returns `folderId`, so accepting one is the natural extension); File → New Spreadsheet passes `inferSelectedAnchor()` like New Folder does, falling back to the data root when the selection is not a data folder.
- Trade-off: the slug form is currently a panel-level strip, not a per-folder dialog — the context item would open the same strip with the folder remembered, which is one more piece of state; anchoring New Spreadsheet on the selection changes where a spreadsheet lands for users who select a blog node first (hence the fallback rule).
- Evidence: `context-menu-items.ts:87-91` (Create group has folder + spreadsheet only), `node.ts:21` (`new-post` in the union), `ExplorerPanel.svelte:260-290`, `:368-369`.
- Hand-off: user (behaviour), then uxy.
- Size: small

### 3. Panel kebab ↔ mobile commands sheet — `desk/compose-menus.ts:41-80`, `desk/DockLeafMenu.svelte:37-84`, `desk/DockMobileCommandsDrawer.svelte:1-12,43-70` [both]
- Observation: one pure `composePanelMenus()` builds `[...registered, Panel, View]`; the desktop kebab renders each menu as one `Sub` (a direction), the mobile sheet renders the same array as flat titled sections with hover sub-menus deliberately avoided; `view-menu.ts:37-43` marks Split Right / Split Down `structural` so the single-column sheet omits them. *Switch to <sibling>* and *Close Other Instances* exist only with siblings (`compose-menus.ts:46-73`); the editor's *Save* exists only while dirty; the kebab exists only on the active tab.
- Reasoning: §8, §11 and §12 in one place — depth defines discovery, context promotes, projection differs, capability set does not.
- Opportunity: none.
- Possible Direction: keep; this is what the registry card `ui-explosive-discovery` points at.
- Trade-off: the kebab on the active tab only means a non-active tab's commands are one click further (activate, then kebab); right-click on any tab covers close/split, so the cost is bounded.
- Evidence: `compose-menus.test.ts` pins the projection rules.
- Hand-off: none.
- Size: —

### 4. Two items, one decision: closing the panel — `desk/compose-menus.ts:57-63`, `desk/view-menu.ts:45-50` [both]
- Observation: the same kebab offers Panel → *Close Panel* (the floor menu, `compose-menus.ts:57-63`) and View → *Close Active Panel* `Ctrl+W` (`view-menu.ts:45-50`). The kebab lives on the active tab, so both close the same panel; the mobile sheet shows both rows a few lines apart. The tab's ✕ and right-click → Close make four routes from one spot.
- Reasoning: signal 5 (*several actions are variations of one decision*). Two of the four are expert paths and earn their place (✕ is direct, `Ctrl+W` is keyboard). Two menu rows in one kebab are not two paths; they are the same command filed under two directions, and the reader has to work out whether "active" differs from "this".
- Opportunity: one menu row, with the shortcut on it.
- Possible Direction: move `shortcut: 'Ctrl+W'` onto the floor's *Close Panel* and drop *Close Active Panel* from `buildViewMenu`. `DeskShortcuts.svelte:63-70` matches across every composed menu, so the chord keeps working; on mobile the floor's row already routes through `requestClose` (unsaved-work confirm), which is the behaviour the View item has today.
- Trade-off: View stops being a place to find "close"; users who learned it there re-learn once. A panel with `closable: false` has no floor row, so `Ctrl+W` would correctly do nothing for it — today it closes the focused panel regardless, which is arguably the bug.
- Evidence: `compose-menus.ts:57-63`, `view-menu.ts:45-50`, `DeskShortcuts.svelte:63-70`, `DockMobileCommandsDrawer.svelte:43-56`.
- Hand-off: uxy → user.
- Size: small

### 5. Help is a one-item direction — `desk/DockTabBar.svelte:37-51`, `desk/DockMobileCommandsDrawer.svelte:72-87` [both]
- Observation: both hosts append a `Help` menu whose only item is *About <panel>*. On desktop that is kebab → Help → About: two hops for one row. The mobile sheet shows it as a one-row section (cheap). The composition is duplicated in two files because `compose-menus.ts:6-7` deliberately leaves Help to the host that owns the lazy `InfoDialog`.
- Reasoning: §7 — a direction with one leaf is nesting by convention, not by narrowing; signal 7 (*unnecessary traversal*). The Panel floor menu is already "this panel's own home" (switch, close), which is where *About this panel* semantically belongs.
- Opportunity: fold the leaf into an existing direction and remove the duplicate composition.
- Possible Direction: `ComposeMenusInput.help?: { title: string; open: () => void }`; when present the floor menu ends with a separator and *About <title>*; both hosts pass `help` and drop their `Help` blocks. The `InfoDialog` stays in the host; only the *row* moves. Update the header comment at `compose-menus.ts:6-7`.
- Trade-off: "Help" stops being a top-level word in the kebab; a user scanning for help finds *About* under Panel instead. The floor menu grows by one row for every panel that has help (all seven).
- Evidence: `DockTabBar.svelte:37-51`, `DockMobileCommandsDrawer.svelte:72-87`, `compose-menus.ts:6-7`, `src/lib/desk/help.ts`.
- Hand-off: uxy → user.
- Size: small

### 6. Desk commands have no shell-level discovery signal — `desk/DeskShortcuts.svelte:44-77`, `src/lib/shortcuts/registry.ts:6-15`, `shell/ShortcutsDialog.svelte:79-111` [wide]
- Observation: the desk matches `Ctrl+S`, `Ctrl+N`, `Ctrl+,`, `Ctrl+Shift+X`, `Ctrl+Shift+E`, `Ctrl+Shift+P`, `Ctrl+W`, `Ctrl+Shift+,` from the composed menus and `Ctrl+Alt+1–9` for workspaces. The shell registry knows only its eight shortcuts (`src/routes/[[locale=locale]]/+layout.svelte:87-149`, categories `global · navigation · actions`), so `shift+/` lists none of the desk's. `⌘K` lists the seven desk *panels* (`shell/AppShell.svelte:136-150`) but no desk *command*. The only signal is per-panel Help → About (`src/lib/desk/help.ts`), itself behind the two-hop path in #5.
- Reasoning: §10 — the expert path exists and is derived from the discovery path (good); §9 — but nothing tells a user it exists where users look for shortcuts. Signal 6 (*important capability hard to discover*).
- Opportunity: surface the existing expert path where the shell already promises shortcuts, without creating a second dispatcher.
- Possible Direction (smaller): a display-only `desk` category in the shortcuts registry — `Shortcut.dispatch?: false`, skipped by `findShortcutByKeys` so `keyboard.ts` never fires it — registered by `DeskShortcuts.svelte` from the composed menus while `/desk` is mounted, rendered as a fourth "Desk" section in `ShortcutsDialog`. (Larger alternative: expose the composed commands as `⌘K` items while on `/desk` — a discovery *and* expert path in one, but it duplicates the kebab's contents into a second projection with its own labels.)
- Trade-off: two registries know about desk chords, but one is display-only by construction, so nothing can fire twice; the dialog's Desk section changes as panels open and close, which is honest but slightly unusual for a "cheat sheet".
- Evidence: `DeskShortcuts.svelte:44-77`, `registry.ts:6-15,37-48`, `ShortcutsDialog.svelte:79-111`, `AppShell.svelte:136-150`.
- Hand-off: uxy → user.
- Size: medium

### 7. Showcases flyout: 25 rows, no directions — `src/lib/nav/nav.ts:49-55`, `shell/NavFlyout.svelte:51-53` [wide]
- Observation: `navItems` derives the Showcases children from the registry as one flat list of 25 (`nav.ts:54`); `NavFlyout` estimates 36 px per row (~950 px, taller than many laptops' viewport minus chrome, so it clamps to the top). The hub page and the home grid render the same 25 under five domains (`src/lib/showcases/catalog/registry.ts:47-53`, `groupByDomain()` at `:729`): Frontend 8 · Backend 6 · Data 3 · AI 4 · Security 4.
- Reasoning: signal 4 (*long flat list accumulating*) and signal 11 (*the grouping is known and unused*). The five domains are exactly the "directions" §2 describes, and the reader already learns them on the hub.
- Opportunity: project the hierarchy the hub already uses into the flyout and the mobile drawer.
- Possible Direction: `NavChild.group?: LabelFn` (`src/lib/nav/types.ts`); build the Showcases children from `groupByDomain()` so each child carries its domain label; `NavFlyout` renders a small heading row when the group changes (and counts it in the height estimate); `NavAccordion` does the same in the drawer. Rows stay rows — no sub-menus, no extra click.
- Trade-off: five heading rows make the flyout taller, not shorter; the gain is scannability (find "3D" under Frontend), not length. A regular who jumps by name loses nothing; a "Recent" strip would be the expert-path complement if usage shows repeat visits.
- Evidence: `nav.ts:49-55`, `NavFlyout.svelte:40-56,244`, `registry.ts:47-53,729-734`.
- Hand-off: uxy → laly (projection, height estimate) → user.
- Size: medium

### 8. Top-nav admin dropdown — `src/lib/nav/nav.ts:15-31`, `src/lib/nav/admin.ts:17-18` [wide]
- Observation: a curated 10 (DB, Analytics, Perf, Audit, Users, Flags, Jobs, Notifications, AI, Cache) rendered flat, while `admin.ts` groups all 24 admin pages into six directions for the sidebar; its header says the dropdown is a deliberately curated subset — *do not mirror*.
- Reasoning: §15 — ten familiar destinations for one admin, scanned daily; six headings over ten rows would read heavier than the rows. The full hierarchy is one click away in the admin sidebar.
- Opportunity: low. Direct exposure may be preferable here.
- Possible Direction: if #7 lands, the same `group` field lets this dropdown try group separators in one line; decide by feel, not by rule.
- Trade-off: headings add scannability only when a list is long enough to lose things in; ten is at the edge.
- Evidence: `nav.ts:15-31`, `admin.ts:10-18`.
- Hand-off: user.
- Size: small (optional)

### 9. Admin tags page — `src/routes/[[locale=locale]]/admin/content/tags/+page.svelte:241-247,293-294,310-316,356-357` [wide]
- Observation: two cards (Domains, Tags), each with New + Refresh in its header and per-row Edit (outline) + Delete (ghost, then a confirm dialog). The page-level count is ~20 controls, but each row is two, each header two.
- Reasoning: §15 — repetitive table work favours direct exposure; Delete is already less prominent than Edit and already guarded by a confirm, so the "costly mistake" case is handled. The one variation-of-one-decision is the second *Refresh*: every other admin page has exactly one (`admin_action_refresh` appears once in ten pages, twice here), both call `invalidateAll()`.
- Opportunity: minor — one Refresh for the page.
- Possible Direction: hoist Refresh to the page header (or keep it on the first card only).
- Trade-off: a user refreshing "the tags card" now refreshes the page — which is what `invalidateAll()` already does.
- Evidence: lines above; `grep -c admin_action_refresh` across `admin/**/+page.svelte`.
- Hand-off: user.
- Size: small (low value)

### 10. No change — below the trigger or already structured
- `⌘K` launcher (`shell/AppShell.svelte:136-176`, `composites/command-palette/CommandPalette.svelte`): empty-query view is Recent + Panels + Actions, grouped and searchable, "Opens in Desk" hint only off-desk — §9 search and §10 recents done right.
- Admin sidebar (`src/lib/nav/admin.ts`, `shell/AdminSidebar.svelte`): 24 pages under six labelled groups of 2–6 — directions already.
- Tab-bar context menu (`desk/DockTabBar.svelte:236-275`): six rows in the browser-tab idiom (Close · Close Others · Close All · Split Right · Split Down · Preferences…), *Close Others* disabled with one tab — familiar and gated.
- User menu (`shell/UserMenu.svelte`): four rows, Theme and Language as sub-menus on desktop and stacked with a back row in the drawer — a projection, not a compression.
- Account tabs (`account/+layout.svelte`): four. Vely header (`composites/chatbot/Chatbot.svelte:170-198`): four icons; Sources and Inspect appear only when a turn has them.

---

## Decisions (2026-09-18)

All seven opportunities accepted by Stas and applied the same day; gate green (`validate` exit 0, 253 test files); committed as `ff9ed52d`.

| # | Decision | What changed |
|---|---|---|
| 2 | accepted | `context-menu-items.ts` Create group gains *New Post* (`new-post` finally has a projection); `ExplorerPanel` anchors New Post on the selected blog folder (or a post's parent) and shows the target folder beside the slug input; File → New Spreadsheet lands in the selected data folder (`dataAnchor()`), else the data root. `POST /api/blog/posts` accepts an optional `folderId` (`pfd_*`), ownership-checked in `createPost` like `updatePostMetadata`, clean 404 for a foreign folder. |
| 4 | accepted | `Ctrl+W` moved onto the Panel floor's *Close Panel*; *Close Active Panel* removed from `buildViewMenu` (and `ViewMenuActions.closeFocusedPanel`, `closeCurrent`). `DeskShortcuts` now matches against the full `composePanelMenus()` array (floor included) — the "one composed array, three consumers" claim is now literally true. |
| 5 | accepted | `composePanelMenus({ help })` appends *About <title>* as the floor's last row; the `Help` menu blocks in `DockTabBar` and `DockMobileCommandsDrawer` are gone. `DockLeaf` owns the About dialog for desktop (it composes the array); `DockTabBar` renders `menus` as-is and lost its `panelType` prop. |
| 6 | accepted (smaller direction) | Shell registry: `ShortcutCategory` gains `desk`; `Shortcut.dispatch?: false` makes an entry display-only (`findShortcutByKeys` skips it, `keyboard.ts` fires only entries with an `action`). `DeskShortcuts` registers every composed-menu chord plus `Ctrl+Alt+1–9` while mounted; `ShortcutsDialog` gained a **Desk** section and now snapshots the registry on each open (it was a `$derived` over a plain `Map`, computed once — shell shortcuts registered after first open were invisible too). |
| 7 | accepted | `NavChild.group?: LabelFn`; Showcases children built from `groupByDomain()` in hub order; `NavFlyout` and `NavAccordion` render a heading row where the group changes; flyout height estimate counts headings. |
| 8 | accepted | Admin dropdown children carry the sidebar group of their href (`adminGroupOf`); `/admin/ai` moved before the System trio so each group is one contiguous run. Still the curated ten. |
| 9 | accepted | The Tags card's duplicate *Refresh* removed; the Domains card's remains (`invalidateAll()` reloads both). No page header exists to hoist to. |

Not changed, by design: submenu support in the `ContextMenu` / `DropdownMenu` item types (no finding needed it); the Explorer node menu and the kebab ↔ sheet contract (reference embodiments, cited by `ui-explosive-discovery`).

---

# Round 2 — 2026-09-18, deeper pass

Same method, four lenses round 1 applied lightly or not at all:

| Lens | What it asks | Where it bit |
|---|---|---|
| **Projection vs contract** | does each viewport's projection obey the rules the code states for that viewport, not just render the same labels | the mobile View menu (#11), workspaces (#12) |
| **Expert-path declaration** (invariant 3 of `ui-explosive-discovery`) | is every shortcut declared *beside* its item, or in a second table / a keydown switch nobody can see | About dialogs (#15), the explorer tree (#16) |
| **Continuity** (the fourth factor of Priority = Relevance × Frequency × Context × Continuity) | from an overview row, is the action that *continues* the task one step away | admin posts → editor (#19), docs nav (#17), login (#18) |
| **Agent ↔ human, and evidence** (§13, §19) | what the bot can do vs what the person can reach; what could measure any of this | deskbot scopes (#21), telemetry (#20) |

Counts are again at the densest state a real user sees. Paths relative to `src/lib/components/` unless they start with `src/` or `docs/`.

## Summary

| # | Surface | Verdict | Size |
|---|---|---|---|
| 11 | Mobile commands sheet → View → *Toggle Explorer / Toggle Preview* | contract defect (mandatory by the desk's own rule, not by the heuristic) | small |
| 12 | Workspaces: no mobile projection; desktop actions behind an unsignalled right-click | opportunity | medium |
| 13 | View promotes two of seven panel toggles | direct exposure is right — no change | — |
| 14 | Activity-bar position: right-click only, absent from Desk Preferences | opportunity | small |
| 15 | `DESK_PANEL_HELP`: a second, hand-written table of shortcuts and menu paths; 4 of 7 panels have none | opportunity | small–medium |
| 16 | Explorer *Rename* (F2) and *Move to…* (M): expert paths with no visible declaration | opportunity | small |
| 17 | Docs flyout lists one section; the hub has five | opportunity (drift) | small |
| 18 | Login: five methods, promoted by install mode, nothing remembered | opportunity | small |
| 19 | Admin posts list has no door into the editor | opportunity | medium |
| 20 | Nothing measures human command discovery; every bot tool call is recorded | opportunity | medium |
| 21 | Deskbot capability surface vs the Bot Manager's five rows | reference embodiment of §13 — cite | — |
| 22 | `SelectionBar` has no product consumer | none — do not add multi-select for its own sake | — |
| 23 | Desktop panel close skips the unsaved-work confirm the mobile sheet has | outside the heuristic — hand-off | small–medium |
| 24 | No change: notification matrix, account settings, security, admin posts row actions, Bot Manager, Desk Preferences, palette actions | below the trigger or already structured | — |

---

### 11. Mobile View → *Toggle Explorer / Toggle Preview* — `desk/DockMobileCommandsDrawer.svelte:43-51`, `desk/panel-actions.ts:44-63`, `desk/view-menu.ts:26-38` [narrow]
- Observation: the mobile commands sheet builds its View section with `structural: false` (no Split rows) but binds the two toggles to `togglePanelType` (`DockMobileCommandsDrawer.svelte:46`). That function closes **every** instance of the type when one is open, else adds one, and its own comment reads *"STRUCTURAL — never wire this to a mobile surface; mobile selection goes through openOrCycle"* (`panel-actions.ts:47-48`). The mobile contract is stated three times — `DockMobileView.svelte:8-10`, `DockMobilePanelsDrawer.svelte:6-8`, `docs/blueprint/desk/README.md:45` — and the drawer's tap semantics are explicitly *show, never close*. The close path also calls `dock.closePanel` directly, so it skips the sheet's own unsaved-work confirm (`dock-mobile.state.svelte.ts:49-60`), which the floor's *Close Panel* row honours.
- Reasoning: signal 10 (*mobile merely compresses desktop*) in its sharpest form — the labels project, the semantics don't. On a phone, "Toggle Explorer" with the explorer open discards the explorer from the persisted desktop tree; with an unsaved editor open, "Toggle Preview" is harmless but "Toggle Editor" would not be (there is none — the two toggles happen to be the two safe types, which is luck, not design). Every capability the View section carries on mobile already has a home in the panels drawer: each panel type is a row (`openOrCycle`), and *Preferences* is a row (`DockMobilePanelsDrawer.svelte:139`) — so the sheet's View section is a second door with worse semantics for the toggles and a duplicate for Preferences (the round-1 #4 shape).
- Opportunity: restore the contract; then decide whether View has any mobile projection at all.
- Possible Direction: (b, recommended) the mobile sheet omits View — `composePanelMenus` takes `viewMenu` as optional; the drawer is the dock-level projection on mobile and already renders the same capability set; `buildViewMenu` loses `structural` (its only consumer was the mobile sheet). (a, smaller) keep View on mobile, bind the toggles to `openOrCycle` and label them *Show Explorer / Show Preview* when `!structural`; drop *Desk Preferences…* from the mobile View since the drawer has it.
- Trade-off: (b) touches the story the registry card, the skill and `docs/blueprint/desk/README.md:61` tell about `structural: false` (three text edits plus an excerpt rebuild) and flips the compose-menus test "non-structural contains Desk Preferences…"; the capability set stays identical per viewport, so invariant 2 still holds — projected by the drawer rather than the sheet. (a) keeps two doors to "show explorer" on mobile. Keyboard users on a tablet lose nothing either way: `DeskShortcuts` composes its own View.
- Evidence: `DockMobileCommandsDrawer.svelte:43-51`, `panel-actions.ts:29-63`, `view-menu.ts:26-38,46-51`, `DockMobilePanelsDrawer.svelte:6-8,120-140`, `dock-mobile.state.svelte.ts:49-60`, `docs/blueprint/desk/README.md:45,61`.
- Hand-off: user (a or b) → svey.
- Size: small

### 12. Workspaces — `desk/WorkspaceZone.svelte:107-181,251-300`, `desk/DeskShortcuts.svelte:101-112`, `desk/DockMobilePanelsDrawer.svelte` [both]
- Observation: workspaces are a full capability — switch, create (`+` popover), rename, duplicate, move up/down, delete with undo, `Ctrl+Alt+1–9` — and every action except switch and create lives in a right-click menu on a numbered square (`WorkspaceZone.svelte:129-181`). Nothing signals that the square has a menu (`title={ws.name}` only). On mobile there is **no** projection: `grep -i workspace DockMobile*.svelte` is empty, the panels drawer lists panel types, open instances, Search and Preferences (`DockMobilePanelsDrawer.svelte:59-140`). A user with three workspaces on a phone is in whichever one the desktop left active, with no way to see that or change it. `⌘K` lists the seven panels but no workspace.
- Reasoning: §11 asks for the same hierarchy in a different projection; here a whole level is missing on one device. `switchTo` swaps the persisted tree (`workspace.state.svelte.ts:66-101`) — a non-structural operation from mobile's point of view (mobile never edited the shape, so the capture it snapshots is faithful). On desktop, right-click is the file-manager convention and the repo already uses it on the activity bar, so this is the *unsignalled* half of signal 6 rather than a wrong home.
- Opportunity: a mobile projection for switching first; a continuation signal on desktop.
- Possible Direction: a **Workspaces** section in the panels drawer — one row per workspace with the active one marked, tap → `switchTo`; the create row only when under `MAX_WORKSPACES`; per-row rename/delete via the coarse-pointer kebab idiom `TreeNode.svelte` already uses (permanent ⋮ on touch for the right-click items) or deferred. On desktop, `aria-haspopup="menu"` on the trigger and a tooltip that says the menu exists ("Workspace 2: Writing — right-click for actions").
- Trade-off: the drawer grows a section (it is already types + instances + two rows; a scroll on small phones); switching on mobile re-focuses a panel from another tree, so the first tap after a switch may land on a panel the user did not expect — the tab strip shows it. Rename/delete on touch adds the kebab's inline-confirm step for delete (the `destructive` contract).
- Evidence: `WorkspaceZone.svelte:107-181` (ctx menu), `:188-215` (overflow popover), `:251-300` (create); `workspace.state.svelte.ts:66-101`; `DeskShortcuts.svelte:101-112`; `DockMobilePanelsDrawer.svelte:59-140`; `shell/AppShell.svelte:136-150`.
- Hand-off: uxy → laly (drawer section) → user.
- Size: medium

### 13. View promotes two of seven panel toggles — `desk/view-menu.ts:26-38`, `src/lib/desk/panels.ts:3` [both]
- Observation: the activity bar toggles seven types; View carries *Toggle Explorer* (`Ctrl+Shift+E`) and *Toggle Preview* (`Ctrl+Shift+P`) only; `⌘K` lists all seven as *Opens in Desk*.
- Reasoning: §5 — frequency-based promotion. Explorer and Preview are the two panels a writer opens and closes around the editor; Bot, Spreadsheet, Document, Log are opened from a file or once per session. The palette is the complete expert path; the bar is the complete discovery path.
- Opportunity: none — direct exposure of the two is right; seven toggle rows would push View past the trigger for no gain.
- Possible Direction: keep. If usage ever shows *Toggle Bot* as a daily chord, it is one row.
- Trade-off: —
- Evidence: `view-menu.ts:26-38`, `DockActivityBar.svelte:56-66`, `AppShell.svelte:136-150`.
- Hand-off: none.
- Size: —

### 14. Activity-bar position — `desk/DockActivityBar.svelte:47-105`, `desk/DeskPreferencesDialog.svelte:39-43` [wide]
- Observation: Left / Right / Top / Bottom is a right-click menu on the bar itself (`DockActivityBar.svelte:81-104`); no tooltip, no row anywhere else. Desk Preferences has three tabs — Workspace (four colours), Panels (per-type colour), Presets — and no layout control (`DeskPreferencesDialog.svelte:39-43`). The setting is persisted per workspace (`dock.persistence.ts:23-28`, `workspace.state.svelte.ts:50,80-81`).
- Reasoning: signal 6 and signal 11 together — the capability exists, the direction that would reveal it ("how the desk looks") exists, and they do not meet. Mobile has no bar, so any home that projects to mobile (View) would need stripping; the dialog does not project to mobile at all, which fits.
- Opportunity: give the capability a discovery home; keep right-click as the expert path.
- Possible Direction: a four-way segmented control **Activity bar** in the Preferences → Workspace tab. It applies live (it is layout state, not the theme draft the tab otherwise edits) — say so with the control, or place it above the colour draft with its own heading. Alternative rejected: four checkbox rows under View would take View to nine rows on desktop for a once-a-year decision.
- Trade-off: one dialog mixes draft-then-Apply (colours) with apply-now (bar); the rows must read differently or the user learns the wrong rule from one of them.
- Evidence: `DockActivityBar.svelte:29-34,81-104`, `DeskPreferencesDialog.svelte:39-43,50-75`, `dock.persistence.ts:23-28`.
- Hand-off: uxy → arty (segmented control) → user.
- Size: small

### 15. `DESK_PANEL_HELP` — `src/lib/desk/help.ts:11-60`, `desk/panels/explorer/ExplorerPanel.svelte:395-412` [both]
- Observation: each About dialog renders a hand-written markdown block with a **shortcut table** and **menu paths** (`help.ts:11-60`). It is `Partial` — Explorer, Editor, Preview only; Spreadsheet, Document, Bot and Log have no About row (the floor omits it without help). It already drifts: the Explorer notes say *File > Import from Markdown*; the menu row is *Import Markdown…* (`ExplorerPanel.svelte:409`); the notes name `Ctrl+N` but not F2 or M, the two keys the tree actually handles (#16).
- Reasoning: invariant 3 of the card this code is cited by — *the expert path is declared beside the item, never in a second table*. The `?` dialog now lists desk chords from the composed menus (round 1, #6); the About table is the parallel copy the invariant forbids, and it is the copy that will keep drifting because nothing reads it.
- Opportunity: one source for shortcuts; prose stays prose; About on every panel.
- Possible Direction: About renders its shortcut table from the panel's composed menus (`items.filter((i) => i.shortcut)` from `composePanelMenus`, which `DockLeaf` already holds) and `help.ts` keeps only the prose paragraphs; the prose stops naming menu paths that a screenshot would show anyway (*"use File > …"* → *"from the File menu"*). Add three-line entries for the four panels without help so *About* exists on all seven — the Document panel's read-only decision is exactly the kind of thing a person looks for there.
- Trade-off: the About table becomes viewport-honest (a Save row only while dirty) — which is right but reads as "the table changes"; F2 / M are tree keys, not chords, so they stay in prose unless #16 lands and they become item shortcuts too.
- Evidence: `help.ts:11-60`, `ExplorerPanel.svelte:395-412`, `DockLeaf.svelte` (help wiring), `compose-menus.ts` (About row).
- Hand-off: uxy → cony (four short help texts, prose rewrite) → user.
- Size: small–medium

### 16. Explorer *Rename* (F2) and *Move to…* (M) — `desk/panels/explorer/ExplorerTree.svelte:33-39,112-119`, `desk/panels/explorer/context-menu-items.ts:10-16` [wide]
- Observation: the tree's keydown handles F2 (rename, capability-gated) and M (move, capability-gated). The context-menu item type has no `shortcut` field, so the right-click menu shows *Rename* and *Move to…* bare; the composite `ContextMenuItem` type supports `shortcut` and the composite renders it (`composites/context-menu/types.ts:6`, `ContextMenu.svelte:59-60`), but `TreeNode` renders Bits primitives directly (`TreeNode.svelte:354-366`) and never had a shortcut to show.
- Reasoning: §10 — the expert path exists and is gated exactly like the item; §9 — nothing declares it. Signal 6. These are the two most repeated tree actions after Open.
- Opportunity: declare the key on the item.
- Possible Direction: `MenuItemDef.shortcut?: string`; `Rename → 'F2'`, `Move to… → 'M'` in `GROUPS`; the right-click projection renders `contextMenuShortcutVariants()` beside the label; the touch kebab does not (a key hint on a phone is noise). The keydown switch stays the dispatcher for now; deriving it from the defs is a later tidy.
- Trade-off: two declarations remain (defs + keydown) until the tidy — the hint can lie if one changes without the other; a one-line test that every `shortcut` in `GROUPS` has a `case` in the tree keeps them honest.
- Evidence: `ExplorerTree.svelte:33-39,112-119`, `context-menu-items.ts:10-16,68-74`, `TreeNode.svelte:354-366`, `composites/context-menu/types.ts:6`.
- Hand-off: uxy → user.
- Size: small

### 17. Docs flyout — `src/lib/nav/nav.ts:70-75`, `src/routes/[[locale=locale]]/(public)/docs/+page.svelte:14-45` [wide]
- Observation: the Docs nav item has one child, *Stack* (`nav.ts:74`, unchanged since the first nav commit); the docs hub renders five cards — Pattern Library, Foundation, Stack, Blueprint, Programming — each a level-2 route with its own page. The sidebar's own rule says children are the level-1 dropdown of a hub (`nav.ts:19-25`).
- Reasoning: signal 6 by omission — a reader who hovers Docs learns it has one section. Round 1 fixed the same drift for Showcases by deriving children from the registry; docs has no registry the hub and nav share (`src/lib/docs/types.ts:1` types four sections; the hub hand-lists five, with English literals for four titles and an i18n key for the fifth).
- Opportunity: one list, two consumers.
- Possible Direction: `$lib/docs/sections.ts` — `{ href, icon, title: LabelFn, description: LabelFn }` × 5 in hub order; the hub maps it to `LinkCard`s, `nav.ts` maps it to children. i18n: `nav_docs_stack` and `docs_card_agents_title` exist; three titles need keys (dev-server restart) — or the hub literals become keys in the same pass (cony).
- Trade-off: five rows where there was one — well under the trigger; a new tiny module for a list that changes once a year.
- Evidence: `nav.ts:19-25,70-75`, `docs/+page.svelte:14-45`, `src/lib/docs/types.ts:1`, `src/lib/server/docs/overview-body.ts:62`.
- Hand-off: uxy → cony (keys) → user.
- Size: small

### 18. Login — `src/routes/[[locale=locale]]/auth/login/+page.svelte:20,211-221,309-434` [both]
- Observation: five methods — magic link, code, GitHub, Google, passkey — arranged by **install context**: in the installed app the code is primary and the link demoted with a caveat (`:309-344`), passkey rises above OAuth (`:379-386`); in the browser the link is primary and passkey sits last (`:346-376,430-434`). Passkeys also surface in the email field's autofill (`:211-221`). Nothing remembers which method *this person* used last time.
- Reasoning: §8 in a form round 1 did not look at — context here is the device, and the promotion is already done well; cite it. §10's *remembered choices* is the missing expert path: a returning user who always signs in with Google reads five buttons every time. The page already keeps one piece of local state for exactly this kind of continuity (`OTP_MARKER_KEY`, `:47`).
- Opportunity: remember the last successful method; badge it, do not reorder across the install-mode groups.
- Possible Direction: write `v10r:last-login-method` when a method is *started successfully* (link sent, code sent, OAuth redirect issued, passkey resolved); on mount, render a small *Last used* badge on that button. Install-mode still decides which group is primary; the badge only marks a row.
- Trade-off: on a shared device the badge reveals the previous user's *method* (not identity) — low, and clearable with the OTP marker; a badge on a demoted row ("Last used" on the caveated magic link in the installed app) must not read as a recommendation — the caveat wins.
- Evidence: lines above; `OTP_MARKER_KEY` precedent at `:47-75`.
- Hand-off: uxy → secy (one glance) → cony (badge text) → user.
- Size: small

### 19. Admin posts list → editor — `src/routes/[[locale=locale]]/admin/content/posts/+page.svelte:166-246`, `src/routes/[[locale=locale]]/desk/+page.svelte:25-28` [wide]
- Observation: each row offers the state transitions — Publish (draft), Unpublish (published), Archive (not archived), Delete — plus a preview link for file-managed posts. There is no *Edit*. Editing happens in the desk editor, reached by /desk → Explorer → find the post; the desk's deep links open a panel **type** (`?open=`) or focus a panel **id** (`?panel=`), never a document (`desk/+page.svelte:25-28`). The Explorer's own open path is three lines (`ExplorerPanel.svelte:205-216`: `addPanel` + `editor:document`).
- Reasoning: Continuity — the list is the overview, the editor is the action, and the step between them is a manual search. The row's four buttons are all *about* the post's status; the one action a writer takes most (open it) is absent. This is the shape signal 7 describes (*repeated traversal*), just across pages instead of menus.
- Opportunity: a continuation door on the row and a document deep link for everyone (the palette's search results could use it too).
- Possible Direction: `/desk?post=<id>` — the desk page ensures an Explorer, adds the editor panel and publishes `editor:document`, exactly `openPost`; the row gets *Edit* (outline) first in the cluster, `href` not `onclick`, so middle-click works. File-managed posts keep *preview* instead.
- Trade-off: a third URL parameter on `/desk` with its own clean-up (`:32-36`); on mobile it lands the user in the editor with no Explorer visible, which is what they asked for. Medium because the bus publish must wait for the editor panel to mount (the Explorer does it synchronously after `addPanel`; a fresh page load needs the same ordering).
- Evidence: `posts/+page.svelte:186-246`, `desk/+page.svelte:25-36`, `ExplorerPanel.svelte:205-216`, `AppShell.svelte:136-150`.
- Hand-off: user (product) → svey.
- Size: medium

### 20. Evidence — `src/lib/server/analytics/event-schema.ts:31-66`, `src/lib/analytics/telemetry.ts:1-38`, `src/lib/server/db/schema/ai/turn.ts:134` [—]
- Observation: the consent-gated journey lane stores five event kinds — rage click, dead click, scroll depth, form abandon, engagement — allow-listed with bounded properties. Two of §19's signals (misclicks) exist; none of palette usage, shortcut adoption, menu opening, navigation depth, per-command frequency. The bot's side is fully instrumented: one `ai.tool_call` row per tool execution (`turn.ts:134`). So the repo can rank the deskbot's tools by frequency and cannot rank the kebab's rows.
- Reasoning: every finding above that says "frequency" (#13, #16, #18) is asserted, not measured. The heuristic's own evaluation section says fewer controls is not a result; the only way to close a contested finding is a number. The telemetry header's bar — *each signal earns its place* — is the right bar, and a bounded command event clears it precisely because it answers the question this document keeps asking.
- Opportunity: one event, three emitters that already share one array.
- Possible Direction: `command_invoked { via: enum('menu','sheet','shortcut','palette','context-menu'), command: string ≤ 60 }` in `EVENT_SPECS`; emitted from the three consumers of `composePanelMenus` (`DockLeafMenu`, `DockMobileCommandsDrawer`, `DeskShortcuts`) and the palette's `action`, with `command` = `"<menu> › <item>"` — a closed vocabulary by construction, so cardinality stays bounded like the other events. Consent-gated, batched, no payload beyond the label.
- Trade-off: coverage is only consenting visitors; the desk is one user today, so the first months of data describe one person — still enough to retire or confirm #13/#16/#18. Property values are labels, not content, but a label rename splits the series (accept, or key by a stable id later).
- Evidence: `event-schema.ts:31-66`, `telemetry.ts:1-38,88`, `turn.ts:134-160`.
- Hand-off: user (collection policy) → secy → tesy.
- Size: medium

### 21. Deskbot capability surface — `src/lib/types/ai-tools.ts:103-134`, `desk/panels/bot/BotToolsSection.svelte:14-50`, `desk/bot-config.state.svelte.ts:29-35` [both]
- Observation: the manifest declares 17 tools (3 chatbot, 14 deskbot) in five capability families gated by five scopes; the Bot Manager's Tools tab shows five rows — two *Always on* (browse & search, create files) and three *Policy toggles* (edit, delete, search pinned) — each described in prose (`BotToolsSection.svelte:14-50`). Two agent capabilities have no human twin: `desk_create_markdown` / `desk_update_markdown` / `desk_edit_markdown` — the Document panel is read-only by decision (`MarkdownPanel.svelte:12-14`, 2026-09-12) and no create row exists for a document.
- Reasoning: §12 and §13 exactly — *what can be done* is the manifest, *what should be shown now* is the scope row; the agent inspects the broad surface, the person sets policy. The markdown asymmetry is agent > human by design and documented in code; nothing to nest.
- Opportunity: none for the heuristic. One drift risk: the prose per scope names tools by hand ("Update spreadsheet cells, edit or rewrite documents, rename files") — a second declaration of what a scope contains.
- Possible Direction: cite as the §13 embodiment. If wanted, derive the tool list under each toggle from `TOOL_MANIFEST.filter(scope)` so the row can never omit a tool added later; keep the human sentence as the headline.
- Trade-off: a derived list shows tool ids to a person unless the manifest carries labels.
- Evidence: lines above.
- Hand-off: none (optional: aiy).
- Size: —

### 22. `SelectionBar` — `composites/selection-bar/`, consumers: `showcases/ui/menus` only [—]
- Observation: the context-promotion composite the registry card cites has no product consumer; the Explorer is single-select (`explorer.state.svelte.ts`), admin lists act row by row.
- Reasoning: §15 — do not add multi-select to a solo author's explorer to justify a component. The product's live context promotion is the composed floor menu (siblings), the editor's Save-while-dirty and Publish/Update by status; the card's note on the component is accurate as a component.
- Opportunity: none.
- Possible Direction: keep; the admin posts list is the natural first consumer if bulk publish/archive ever matters.
- Trade-off: —
- Evidence: `grep -rl SelectionBar src` → showcase files only.
- Hand-off: none.
- Size: —

### 23. Desktop close vs mobile close — `desk/DockTabBar.svelte:31-33`, `desk/DockLeaf.svelte:58`, `desk/dock-mobile.state.svelte.ts:49-60` [both]
- Observation: the mobile sheet routes *Close Panel* through `requestClose`, which gates an `unsaved` panel behind a confirm ("undo can restore the panel shell but not a destroyed buffer"). Desktop's four routes — tab ✕, tab context menu, floor *Close Panel*, `Ctrl+W` — call `dock.closePanel` directly; the undo toast restores the shell.
- Reasoning: not an Explosive Discovery finding (no choice structure involved) — a projection difference in *safety*, found while checking #11. Recorded here because round 1 moved `Ctrl+W` onto the floor and the floor's desktop action is the unguarded one.
- Opportunity: same guard on both projections.
- Possible Direction: lift `requestClose` out of the mobile state into a dock-level `requestClose(dock, panelId)` used by every close route; the confirm dialog already exists in `DockLayout`.
- Trade-off: one more dialog on desktop for the case where the user meant it; the editor autosaves nothing on close today, so the dialog is the only thing between a misclick and lost text.
- Evidence: lines above; `DockLayout.svelte:510-520` (confirm), `dock.state.svelte.ts:32-33` (undo hook).
- Hand-off: uxy (recovery) → user.
- Size: small–medium

### 24. No change — below the trigger or already structured
- Notification settings (`account/notifications/settings/+page.svelte:116-232`): 18 switches as four channel groups × categories — a comparison; direct exposure is right. laly may want a matrix projection on wide viewports; not a depth question.
- Account settings (`account/settings/+page.svelte:187-428`): seven cards, danger zone last with a typed confirm. Security (`account/security/+page.svelte:264-519`): three cards, every button state-gated.
- Admin posts row actions: ≤ 3 per row, all state-gated — the reference for prominence by state (the *door* is #19, not the buttons).
- Bot Manager (four tabs), Desk Preferences (three tabs), palette actions (three + seven panels): directions already.

---

## Seen in passing (outside the heuristic, for the record)

- `DeskTheme.workspaceSwitcherMode` (`desk/desk-settings.types.ts:31`) has no writer anywhere; `WorkspaceZone.svelte:38-41` reads it. A persisted setting with no projection — clyn / user.
- 49 hex literals in `desk/**` (`grep -rn '#[0-9a-fA-F]\{6\}' src/lib/components/desk`), nearly all `var(--token, #hex)` fallbacks (`ChatPanel.svelte` error colours, `adapters/desk-files.ts` icon colours) — the fallbacks are hardcoded colours by another name; arty / user.
- Raw `<input>` in `DeskPreferencesDialog.svelte` (preset name), `WorkspaceZone.svelte` (create, rename), `ExplorerPanel.svelte` (slug); raw `<button>` throughout the desk chrome — component-first exceptions or not, `docs/blueprint/design/components.md` decides.

## Decisions (round 2, 2026-09-18)

All ten opportunities accepted by Stas and applied the same day (uncommitted).

| # | Decision | What changed |
|---|---|---|
| 11 | accepted (b) | The mobile commands sheet composes with `viewMenu: null`; `composePanelMenus` appends View only where a projection passes one; `buildViewMenu(actions)` lost `structural` (its only consumer was the sheet). The panels drawer is the mobile projection of every View command. Card, skill, desk README and the design doc updated; excerpt snapshot rebuilt. |
| 12 | accepted | `DockMobilePanelsDrawer` gained a **Workspaces** section — numbered rows (active marked, tap → `switchTo`) and a create row (default name; rename stays desktop). Desktop squares carry `aria-haspopup="menu"` and a tooltip naming the right-click actions. |
| 14 | accepted | Desk Preferences → Workspace tab opens with an **Activity bar** segmented control bound live to `dock.activityBarPosition`, labelled *Applies immediately*; the bar's right-click stays the expert path. |
| 15 | accepted | `DESK_PANEL_HELP` is `Record<DeskPanelType, PanelHelp>` — all seven panels, prose only; About appends `shortcutTableMarkdown(menus)` derived from the composed array in both hosts. |
| 16 | accepted | `MenuItemDef.shortcut`; *Rename* → `F2`, *Move to…* → `M` declared in `GROUPS`; the right-click projection renders the key (the touch kebab does not); `ExplorerTree` reads `treeKeyOf(action)` — one declaration; `context-menu-items.test.ts` pins it. |
| 17 | accepted | `$lib/docs/sections.ts` (`DOCS_SECTIONS`) feeds the hub cards and the Docs flyout/drawer; eight `docs_section_*` keys added, `nav_docs_stack` retired. |
| 18 | accepted | `v10r:last-login-method` written on a successful method start (link/code sent, OAuth redirect issued — forgotten on a reported error, passkey resolved); a *Last used* badge on that button, no reordering. |
| 19 | accepted | `/desk?post=<pst_…>` → `DockLayout.openPostId` focuses the open editor or adds the canonical `editor-<id>` panel (same path as the Explorer and `desk:open_panel`); the admin posts list gained an **Edit** link per DB-managed row. |
| 20 | accepted | `command_invoked { via: menu · sheet · shortcut · palette · context-menu, command ≤ 60 }` allow-listed; `COMMAND_VIA` shared through `$lib/types/journey-events.ts`; `trackCommand()` in `telemetry.ts` (dev- and consent-gated inside `push`); emitted by `DockLeafMenu`, the mobile sheet, `DeskShortcuts` (incl. workspace chords), `CommandPalette` (command rows only, never search hits) and the Explorer menu (action id, never the file name). `activation.md` event list corrected (`outbound_click` never existed). |
| 23 | accepted | The unsaved-close guard moved from the mobile state onto the dock: `dock.requestClose(id)` / `requestClosePanels(ids, close)` / `pendingClose` / `confirmPendingClose` / `cancelPendingClose`; every route — tab ✕ and keyboard, tab context menu Close / Close Others / Close All, floor *Close Panel* and `Ctrl+W`, *Close Other Instances* (new `actions.closePanels` batch), the activity-bar / View toggle, the mobile drawer ✕ and legacy bar — asks it; one `ConfirmDialog` in `DockLayout` for both projections; keys renamed `composites_dock_unsaved_close_*` (+ `_desc_many`). |

Not changed: #13, #21, #22, #24 (cited or declined as recorded).

---

# Round 3 — 2026-09-18, "did round 2 miss something"

Three lenses, each aimed at what the first two rounds took on trust:

| Lens | What it asks | Where it bit |
|---|---|---|
| **Trace to the sink, not the emitter** | does a round-2 change work end to end on the projection it was built for — follow the call to the table, the media query, the keydown target | telemetry never lands from the desk (#27), a Preferences control that does nothing on mobile (#28), View chords still structural on touch (#29) |
| **The third projection** | beyond kebab · sheet · matcher, which hand-built menus and header icons carry desk commands outside the composed array | tab right-click (#30), activity-bar tooltips (#33), the Bot Manager door (#34) |
| **Where the user actually is** | does a declared expert path fire from the element the task keeps focus in; does the terminal action of a flow have a next door | chords dead in the textarea (#26), nothing after *Publish* (#35) |

Two defects fell out on the way (#25 split, #31 separators). Counts and paths as before.

## Summary

| # | Surface | Verdict | Size |
|---|---|---|---|
| 25 | *Split Right / Down* on a file panel opens an empty twin with the file's label | defect (both split routes) | small |
| 26 | Editor chords are dead while the caret is in the text; `Ctrl+S` works only through a second handler that skips the menu's own gating | defect | small |
| 27 | `command_invoked` is dropped at the collect door for every desk event — the round-2 evidence lane records the public palette only | round-2 defect — needs a lane decision | medium |
| 28 | Desk Preferences › *Activity bar* renders on mobile, where the bar does not exist | projection defect | small |
| 29 | `Ctrl+Shift+E/P` reach `togglePanelType` on the mobile projection (hardware keyboard) | contract defect, same rule as #11 | small |
| 30 | Tab right-click: a third, hand-built projection — no chords beside *Close* / *Preferences…*, its own split, no telemetry | opportunity | small |
| 31 | Separator normalisation lives in the mobile host only; the desktop File sub-menu opens with a rule when the post is saved | defect | small |
| 32 | *Sheet › Clear All* is not `destructive`; the `destructive` flag promises a touch confirm no host implements | opportunity | small |
| 33 | Activity-bar icons carry no chord; View hardcodes *Explorer* and *Preview* instead of reading the bar's items | opportunity (invariant 3) | small–medium |
| 34 | The Bot Manager is reachable from the input's gear icon only — outside the composed array | opportunity | small |
| 35 | After *Publish…* / *Update…* the Post menu has no door to the page; drafts have an admin preview route the editor never offers | opportunity (continuity) | small |
| 36 | No change / seen in passing | — | — |

---

### 25. Split duplicates the label, not the document — `desk/panel-actions.ts:70-79`, `desk/DockTabBar.svelte:257-276`, `desk/file-panel.ts:14-24` [wide]
- Observation: both split routes mint `id: \`${type}-${Date.now()}\`` with no `meta`. Editor, Document and Spreadsheet resolve their file from the *panel id* (`fileIdOfPanel`, `EditorPanel.svelte:33`), and the id form the regex accepts for a second instance is `<type>-<fileId>-<ts>` (the Explorer's *Open in new panel*, `ExplorerPanel.svelte:96-108`). *Split Right* on an open post therefore adds a tab titled with the post that loads nothing — the editor's `documentId` is `''`.
- Reasoning: §11 — the projection (a second pane) must carry the same object; a twin that looks like the document and is not one is worse than no split. Found while reading #30; not a choice-structure finding.
- Opportunity: one `duplicatePanel(dock, panelId, zone)` in `panel-actions.ts` that keeps the file (`${filePanelId(type, fileId)}-${ts}`, `meta` copied) and is the only minting site for a twin — View's *Split* and the tab menu's *Split* both call it.
- Possible Direction: as above; `splitFocused` becomes `duplicatePanel(dock, dock.focusedPanelId, zone)`.
- Trade-off: none — a non-file panel keeps today's id form.
- Evidence: lines above; `grep -rn 'Date.now()' desk` shows the three minting sites (`dock.state.svelte.ts:249` is *ensure*, not split).
- Hand-off: user.
- Size: small

### 26. Declared chords are dead where the writer is — `desk/DeskShortcuts.svelte:86-99`, `desk/panels/editor/MarkdownSource.svelte:10-15`, `desk/panels/editor/EditorPanel.svelte:198-200` [both]
- Observation: the matcher returns early when `e.target` is an `INPUT`/`TEXTAREA`/`SELECT` or contenteditable. The editor's text is a textarea. While typing — the state the editor exists for — `Ctrl+Shift+X` (*Export*), `Ctrl+,` (*Metadata…*), `Ctrl+W`, `Ctrl+Shift+E/P/,` do nothing, although every one is printed beside its row. `Ctrl+S` works only because `MarkdownSource` has its own `keydown` handler — a second declaration that calls `save()` even when the File menu has no *Save* row (`saveState === 'saved'`), and `save()` posts a new revision (`EditorPanel.svelte:206`) — so the chord the menu hides still runs.
- Reasoning: invariant 3 is about declaration *and* reach: a chord printed beside a row that fails in the focused element is a false signal, which is worse than an undeclared one. The guard exists to keep plain keys out of text fields, but the matcher already returns on `!ctrl` (`:102`), so the guard only ever blocks modifier chords — and the composed array is scoped to the focused panel, so a chord can only fire for the panel that owns the textarea.
- Opportunity: flatten — drop the `isEditing` guard (declared chords are all modifier chords; none collides with a native text-editing chord — `Ctrl+A/Z/C/V/X` are never declared), delete the `MarkdownSource` handler and its `onsave` prop, so *Save* has one declaration and the menu's gating applies to the chord.
- Possible Direction: as above; a comment on the matcher naming the constraint ("never declare a chord the browser owns in a text field").
- Trade-off: `Ctrl+W` in the textarea now reaches the desk's close route (through the unsaved confirm since #23) — in Chrome the browser closes the tab first anyway; unchanged in practice.
- Evidence: lines above; `normalizeShortcut` ignores Alt, so the workspace chords stay separate.
- Hand-off: user.
- Size: small

### 27. `command_invoked` never leaves the desk — `src/lib/analytics/collect-policy.ts:60,164-168`, `src/routes/api/analytics/journey/collect/+server.ts:77-79,105`, `src/lib/server/db/schema/analytics/user-events.ts:44`, `docs/blueprint/analytics/two-lane-model.md:67` [—]
- Observation: round 2 added the emitter in five hosts and stopped there. The collect endpoint is the anonymous lane: it refuses without the `analytics` consent tier (`:77`) and drops every event whose path starts with `/desk` (`EXCLUDED_PREFIXES`, `:105`). The authenticated lane records page views only, from the server hook, for `/account` (`USER_LANE_PREFIXES`), and its `user_surface` enum is `['account']`. Result: the DockLeafMenu, sheet, DeskShortcuts and Explorer calls are discarded server-side on every request; the only `command_invoked` rows that exist come from the palette on public pages. `telemetry.ts:21-24` and `activation.md:81` describe evidence that does not exist. Nothing reads the event either: `aggregations.ts` has `getFrictionSignals` for rage/dead clicks and no command query; `/admin/analytics/human` has no card.
- Reasoning: §19 — evidence is the only thing that settles a menu review, and round 2 shipped a sensor with no wire. The desk is authenticated, so the right lane is the identified one (no consent tier applies there — `user-events.ts:22-28`), but `two-lane-model.md` records `/desk` as "excluded by decision", and the decision predates the event.
- Opportunity: a decision first, then the wire. (a) Route desk commands into the user lane: `user_surface` gains `desk` (a `db:push`), `/desk` joins `USER_LANE_PREFIXES` (which also starts recording desk page views — the decision being reversed), the collect endpoint gains a user-lane branch (`locals.user` + `isUserLanePath` → `recordUserEvent`, no visitor hash, no consent gate), `getCommandUsage(days)` groups by `command, via` and a *Commands* card joins the authenticated section of `/admin/analytics/human`. (b) Keep the decision: remove the desk emitters, keep the palette one, and correct `telemetry.ts` / `activation.md` to say so.
- Possible Direction: (a) — it is the only version that answers "which rows are daily".
- Trade-off: (a) records the author's own desk usage under their user id (Art 6(1)(b)/(f), 60-day retention, cascade on erasure — the lane already carries this); one enum value to push. (b) is honest and cheap and leaves #13, #33 and every "if usage ever shows…" line in this file unanswerable.
- Evidence: lines above; `user-mutations.ts:15` (`surface: 'account'` literal), `collector.hook.ts:158-190` (server-side page views only), `db-enums.drift.test.ts` (does not mirror `user_surface`).
- Hand-off: user (lane decision) → daty (enum) → user.
- Size: medium

### 28. *Activity bar* in Preferences on mobile — `desk/DeskPreferencesDialog.svelte:67-76`, `desk/DockLayout.svelte:510` [narrow]
- Observation: round 2 put the position control at the top of the Workspace tab, labelled *Applies immediately*. The dialog mounts on both projections (`DockLayout.svelte:513`); the mobile projection ignores the setting (`data-bar-position='mobile'`). On a phone the first control in Preferences changes nothing.
- Reasoning: §11 — a control is part of a projection; one that acts on another projection's chrome is noise at best and a broken control at worst.
- Opportunity: hide the row below the desktop breakpoint (the same `MediaQuery('(min-width: 768px)')` the layout uses).
- Possible Direction: as above.
- Trade-off: a tablet that flips between projections sees the row appear and disappear — correct.
- Evidence: lines above.
- Hand-off: user.
- Size: small

### 29. View chords on the mobile projection — `desk/DeskShortcuts.svelte:21-27`, `desk/DockLayout.svelte:512`, `desk/panel-actions.ts:45-49` [narrow]
- Observation: `DeskShortcuts` mounts outside the `isDesktop` branch and always composes with the View menu, so `Ctrl+Shift+E` / `Ctrl+Shift+P` from a hardware keyboard on the mobile projection run `togglePanelType` — the close-all-of-type verb whose own comment says "never wire this to a mobile surface". #11 removed the sheet's route to it; the keyboard route stayed. The shift+/ dialog on mobile also lists chords the projection has no menu for, and the mobile About table (derived from menus without View) disagrees with the matcher.
- Reasoning: the same contract as #11; touch chrome projects View through the drawer's show-or-open rows.
- Opportunity: pass the projection to the matcher — `viewMenu: null` below the breakpoint, exactly as the sheet composes.
- Possible Direction: `<DeskShortcuts desktop={isDesktop.current} />`.
- Trade-off: an iPad with a keyboard loses two chords on the narrow projection; the drawer is one tap.
- Evidence: lines above.
- Hand-off: user.
- Size: small

### 30. Tab right-click — `desk/DockTabBar.svelte:232-288` [wide]
- Observation: seven rows: *Close · Close Others · Close All · Split Right · Split Down · Preferences…*. *Close* is the floor's *Close Panel* (`Ctrl+W`) without the chord; *Preferences…* is View's row (`Ctrl+Shift+,`) without the chord; the splits are the View rows with their own inline minting (#25); nothing is tracked. Two rows are genuinely leaf-scoped — *Close Others* / *Close All* close *this pane's* tabs, distinct from the floor's *Close Other Instances* (type-scoped).
- Reasoning: §11/§12 — the right-click on a tab is a projection of the same panel's commands; it is where a person looks for *Close* and where the chord should be printed. The leaf-scoped pair is the one thing this menu owns.
- Opportunity: keep the seven rows, take the shared ones from the shared declaration: print the chords (`Ctrl+W`, `Ctrl+Shift+,`) beside *Close* and *Preferences…*, route the splits through `duplicatePanel` (#25), record `trackCommand('context-menu', 'Tab › …')`. Not a full re-composition — the kebab is one click away on the same bar, and no usage evidence (#27) argues for a bigger change.
- Possible Direction: export the two chord strings from where they are declared (`compose-menus.ts`, `view-menu.ts`) rather than typing them a second time.
- Trade-off: none visible; a `ContextMenu` row gains a right-aligned chord like the explorer's.
- Evidence: lines above.
- Hand-off: user.
- Size: small

### 31. Separators are normalised on one projection — `desk/DockMobileCommandsDrawer.svelte:72-83`, `desk/DockLeafMenu.svelte:58-60`, `desk/panels/editor/EditorPanel.svelte:320-326` [wide]
- Observation: the sheet drops leading, trailing and doubled separators (`visibleItems`); the kebab renders whatever the array holds. The editor's File menu on a saved post is `[separator, Export as Markdown]` — the desktop sub-menu opens with a rule above its only row.
- Reasoning: the composer's own header: "a difference between surfaces is a bug". Conditional spreads emit dangling separators by nature; the rule belongs where the array is composed, once.
- Opportunity: move the normalisation into `composePanelMenus` (applied to registered menus and the floor alike), delete the host copy, pin it in `compose-menus.test.ts`.
- Possible Direction: as above.
- Trade-off: —
- Evidence: lines above.
- Hand-off: user.
- Size: small

### 32. *Sheet › Clear All* — `desk/panels/spreadsheet/SpreadsheetPanel.svelte:162-176`, `composites/menu-bar/types.ts:9-10`, `desk/panels/spreadsheet/spreadsheet.state.svelte.ts:375-378` [both]
- Observation: the Sheet menu's only row wipes every cell (`fromJSON({})`, no history) and is not marked `destructive`; on the sheet it is one tap. Meanwhile *Close Other Instances* — undoable through the toast and guarded by the unsaved confirm — is marked destructive. The `destructive` doc comment says "touch surfaces add an inline confirm step"; no host does (`DockMobileCommandsDrawer.svelte:116-134` styles the row and runs it).
- Reasoning: §3 "fewer is better when a wrong choice is costly" — prominence should follow cost. A destructive flag that only colours a row is fine; a comment promising a confirm that does not exist is a second, false declaration.
- Opportunity: mark *Clear All* destructive; either implement the inline confirm the flag promises or correct the comment to what it does. Given the spreadsheet autosaves and keeps no undo, a confirm is the cheaper safety than an undo stack.
- Possible Direction: `destructive: true` + a `ConfirmDialog` from the panel (the desk already has the pattern) — or the comment fix alone if Stas prefers no dialog.
- Trade-off: one dialog on a rare action.
- Evidence: lines above.
- Hand-off: uxy → user.
- Size: small

### 33. Activity-bar icons carry no chord; View hardcodes two types — `desk/DockActivityBar.svelte:61`, `desk/view-menu.ts:26-38`, `src/lib/desk/panels.ts:17-21` [wide]
- Observation: the bar's tooltip is `title={item.label}` — *Explorer*, *Preview* — while View prints `Ctrl+Shift+E` / `Ctrl+Shift+P` beside the same two commands. The bar is the discovery path most people use for the toggle; the chord is declared on the other projection only. `buildViewMenu` names `'explorer'` and `'preview'` as literals, although the host passes its own `activityBarItems` (the dock showcase has five types) — the View menu of a generic `DockLayout` is desk-specific by accident.
- Reasoning: invariant 3 — declare the expert path *beside the item*. #13 decided that two toggles are the right promotion; the declaration just lives in the wrong place: a chord belongs on the bar item, and View's toggle rows are then *derived* (every item with a chord gets a row).
- Opportunity: `ActivityBarItem.shortcut?` declared once in `DESK_ACTIVITY_BAR_ITEMS`; the bar tooltip becomes `Explorer — Ctrl+Shift+E`; `buildViewMenu({ items, … })` emits a toggle row per item with a chord; the dock state carries the items so `DockLeaf` / `DeskShortcuts` reach them without prop drilling.
- Possible Direction: as above; the showcase declares no chords and its View menu has no toggle rows (its bar is the whole projection).
- Trade-off: `buildViewMenu` gains a parameter; the showcase's View shrinks to splits + Preferences.
- Evidence: lines above; `showcases/ui/dock/+page.svelte:88-94`.
- Hand-off: user.
- Size: small–medium

### 34. The Bot Manager door — `desk/panels/bot/ChatPanel.svelte:228-239,317`, `composites/chatbot/ChatInput.svelte:71` [both]
- Observation: the Chat menu registers one row (*New conversation*). The Bot Manager — four tabs: Context, Tools, Provider, Storage — opens from the gear icon inside the chat input and from an error strip; it is absent from the composed array, so the kebab, the sheet, the matcher, the shift+/ dialog and *About Bot*'s table cannot name it.
- Reasoning: §9 — a capability with no continuation signal in the place people look for a panel's commands; the input icon is a context-promoted quick path, which is right, but promotion supplements the menu, it does not replace it.
- Opportunity: a *Bot Manager…* row in the Chat menu (same `openManagerToTab()`), the icon kept.
- Possible Direction: `Chat › New conversation · ─ · Bot Manager…`; optionally a chord later, once #27 says whether anyone opens it.
- Trade-off: —
- Evidence: lines above.
- Hand-off: user.
- Size: small

### 35. Nothing after *Publish…* — `desk/panels/editor/EditorPanel.svelte:350-368,250`, `src/routes/[[locale=locale]]/admin/content/posts/+page.svelte:172` [both]
- Observation: the Post menu ends at *Publish…* / *Update…*; on success `status = 'published'` and the menu re-labels. The task's next step — see the page — has no door: no *Open page* row, no link in the confirm strip. Drafts have a server-rendered admin preview (`/admin/content/posts/preview/<slug>/<locale>`) that only the admin list links to; the desk's Preview panel renders the markdown, not the page.
- Reasoning: continuity (§5) at the end of the flow, and §8 — the row is status-gated by nature: *Open published page* after publishing, *Open draft preview* before.
- Opportunity: one status-promoted row in the Post menu opening a new tab (`localizeHref` with the post's locale), so the desk stays.
- Possible Direction: `Post › Metadata… · ─ · Publish… · Open draft preview` → after publishing `… · Update… · Open published page`.
- Trade-off: a new tab from an SPA workspace is the honest choice; in-place navigation would drop the desk.
- Evidence: lines above; `ChatPanel.svelte:37` already imports `localizeHref` into the desk.
- Hand-off: user.
- Size: small

### 36. No change / seen in passing
- The Chat menu's labels are i18n keys (`composites_desk_bot_menu_chat`, `_new_conversation`); every other desk menu, the floor and View are English literals. Not a depth question — cony decides which way the desk goes. It touches #27: the tracked command string is the label, so a localized label makes one command three cardinality buckets; the fix is an `id` on the item or English-only desk menus.
- Desk Preferences mixes two commit models — draft/Apply for colours, immediate for the bar position (labelled) — acceptable while the immediate row is one; a second immediate control would want its own section.
- `Ctrl+,` (*Metadata…*) and `Ctrl+Shift+,` (*Desk Preferences…*) are adjacent chords for unrelated dialogs; mirrors VS Code's settings pairing loosely, no evidence either way.
- The explorer's `Ctrl+N` (*New Post*) is the only chord in the desk a browser reserves (new window) — it never fires in Chrome; keep or retire once #27 can tell.

## Decisions (round 3, 2026-09-18)

All eleven accepted by Stas and applied the same day (uncommitted). #27 taken as (a).

| # | Decision | What changed |
|---|---|---|
| 25 | accepted | `duplicatePanel(dock, panelId, zone)` in `panel-actions.ts` is the only minting site for a twin: a file panel's twin is `<type>-<fileId>-<ts>` with `meta` copied, so the split editor loads the same post; `splitFocused` and the tab menu's Split both call it; pinned in `dock.state.svelte.test.ts`. |
| 26 | accepted | `DeskShortcuts` lost the INPUT/TEXTAREA guard (every desk chord is a modifier chord, the array is per focused panel); `MarkdownSource` lost its own `Ctrl+S` and `onsave` — *Save* has one declaration and the menu's gating applies to the chord. |
| 27 | accepted (a) | `user_surface` gains `desk` (**needs `db:push`**), mirrored as `USER_SURFACES` in `db-enums.ts` (drift-tested); `collect-policy.ts` maps `/desk` → `desk` (`userLaneSurface`), prefix rules became segment rules (`/desktop` is not `/desk`); the collect endpoint splits each batch — signed-in user-lane rows → `recordUserEvents` (one INSERT, no consent, no visitor hash), the rest through the anonymous gates; the client tags queued events with their lane so a withdrawal drops only anonymous rows (`setTelemetrySession` from the root layout); `getCommandUsage()` + a **Commands** card on `/admin/analytics/human`; `COMMAND_VIA` gains `bar` (activity bar + mobile drawer, recorded under View's row names); `two-lane-model.md`, `activation.md`, `telemetry.ts` say where the event lands; pglite tests cover the split and the aggregation. The hook records desk page views in the same lane. |
| 28 | accepted | `DeskPreferencesDialog` takes `desktop`; the activity-bar row renders on the desktop projection only. |
| 29 | accepted | `DeskShortcuts` takes `desktop`; below the breakpoint it composes with `viewMenu: null` like the sheet, so View's chords and their `shift+/` entries do not exist there. |
| 30 | accepted | The tab right-click prints `CLOSE_PANEL_SHORTCUT` beside *Close* and `PREFERENCES_SHORTCUT` beside *Preferences…* (exported from where they are declared), splits through `duplicatePanel`, and records `context-menu` / `Tab › …`. |
| 31 | accepted | `composePanelMenus` normalises separators for every menu (leading, trailing, doubled) and drops empty menus; the sheet's `visibleItems` copy is gone; pinned in `compose-menus.test.ts`. |
| 32 | accepted | *Sheet › Clear All* is `destructive`, disabled until loaded, and asks a `ConfirmDialog` ("keeps no history — the emptied sheet is saved as-is"); the `destructive` flag's comment now says styling only. |
| 33 | accepted | `ActivityBarItem.shortcut`; `DESK_ACTIVITY_BAR_ITEMS` declares `Ctrl+Shift+E` / `Ctrl+Shift+P` once (`PANEL_TOGGLE_SHORTCUTS`); the bar's tooltip and `aria-label` print it; `buildViewMenu({ items, … })` derives a toggle row per item with a chord (the dock showcase's View keeps splits + Preferences); the dock state carries `activityBarItems` (`DockStateOptions`) so `DockLeaf` / `DeskShortcuts` read them from context. |
| 34 | accepted | `Chat › Bot Manager…` row (`composites_desk_bot_manager_menu`, three locales); the input's gear icon stays. |
| 35 | accepted | `Post › Open Draft Preview` (`/admin/content/posts/preview/<slug>/<locale>`) before publishing, `Open Published Page` (`/blog/<slug>`) after — status-gated, new tab, `localizeHref` with the post's locale. |

Not changed: #36 (recorded).
