# UXY Agent Memory

## Style Randomizer UX
- [style-randomizer-plan.md](style-randomizer-plan.md) - Original + refined UX plan for the Style Randomizer / DiceRollButton feature, including contrast preferences, GDPR cookie consent, and accessibility checklist

## Color Hierarchy
- [color-hierarchy-spec.md](color-hierarchy-spec.md) - Distribution philosophy (60–70% neutral / 5–8% primary / 2–4% secondary), token-to-element mapping, secondary-fg diagnosis across all 8 palettes, and accessibility risk table

## Hover Background Token
- [hover-bg-token.md](hover-bg-token.md) - Analysis of hover:bg-border anti-pattern; recommendation to introduce --color-hover-bg dedicated token; migration plan for 20+ components

## Blog System Editor UX
- [blog-editor-ux.md](blog-editor-ux.md) - Paradigm recommendation (split-pane), custom syntax via slash commands, preview strategy per embed complexity, content management flows, embed insertion UX, mobile scope, and accessibility patterns

## Blog System Blueprint Review
- [blog-system-review.md](blog-system-review.md) - Full UX review of docs/blueprint/blog.md: strengths, concerns (3 critical / 7 major / 5 minor), suggestions, and 5 open questions for the team

## Blog Editor Final UX Specifications (Round 2)
- [blog-final-ux-specs.md](blog-final-ux-specs.md) - Binding design contract: toolbar layout, save/publish inline confirmation, Documents panel spec, two-tier optimistic preview, MetadataDrawer fields, keyboard shortcut ownership policy, multi-author soft-lock, role-based panel visibility

## Blog Implementation UX Review
- [blog-implementation-review.md](blog-implementation-review.md) - Full UX audit of feature/blog implementation: error states, loading, empty states, save/publish flow, keyboard shortcuts, MetadataDrawer usability, navigation, accessibility, responsive, and feedback loops. Rated GOOD/WARNING/ISSUE with specific observations.

## Files Panel (Explorer) UX
- [files-panel-ux.md](files-panel-ux.md) - Unified Explorer panel design: tree structure, click behaviors per file type, upload UX, image-insertion mechanisms, file actions, visual hierarchy (DB vs R2), empty states, DocumentsPanel replacement recommendation, new DeskBus events, accessibility checklist
- [explorer-final-spec.md](explorer-final-spec.md) - FINAL implementation-ready spec: resolves image preview location (FilePreview inside FilesPanel), image insertion MVP (drag + copy-markdown), exact row anatomy, component wireframes, upload flow with presigned URL gotcha, all empty states, inline delete/rename patterns, DeskBus additions, layout-presets update, accessibility checklist

## Desk Menu System
- [desk-menu-final-spec.md](desk-menu-final-spec.md) - FINAL spec: 3-label fixed MenuBar (File/View/Post), tab-dot save indicator (no StatusStrip), context menus with exact item lists, publish confirmation strip pattern, focusedLeafId in DockState, keyboard shortcut ownership table, accessibility checklist

## Blog 3D Embed UX
- [blog-3d-embed-ux.md](blog-3d-embed-ux.md) - Round 1 UX analysis: loading states, click-to-activate scroll pattern, fallback, fullscreen, mobile, multi-embed lazy init, author syntax spec, aria/keyboard/reduced-motion patterns
- [blog-3d-embed-final-spec.md](blog-3d-embed-final-spec.md) - FINAL implementation contract: resolved alt semantics (optional), exact 7-state machine with transitions, mobile always-poster strategy, fullscreen re-mount rationale, render mode table, multi-embed coordination store, full accessibility annotation table

## Domain Icon Customization UX
- [domain-icon-ux.md](domain-icon-ux.md) - UX spec: two-tier icon input (Lucide preset grid + paste SVG), Edit modal per domain row, live preview chip, initial-letter fallback, chart color swatches, SVG sanitization contract, DB schema additions

## AI Chat Panel + Spreadsheet Context UX
- [ai-context-ux.md](ai-context-ux.md) - Context tray design, spreadsheet panel, DeskBus extensions, multi-panel context flow, progressive disclosure strategy, accessibility

## Spreadsheet Explorer Integration
- [spreadsheet-explorer-ux.md](spreadsheet-explorer-ux.md) - Full UX spec: data/ folder section, sheet row anatomy, single-click open, multi-sheet management, inline preview, context menu actions, creation flow (auto-name+rename), drag-and-drop scope, DeskBus additions, SpreadsheetPanel props change, API additions, accessibility checklist

## Panel Color Settings
- [panel-color-settings-spec.md](panel-color-settings-spec.md) - Full UX spec: floating dialog, tab context menu entry, 12-swatch palette + intensity slider, live preview, preset gallery, type-level color keying, session undo, contrast warnings, accessibility, responsive behavior

## AI Actions + I/O Log UX
- [ai-actions-io-log-spec.md](ai-actions-io-log-spec.md) - Full spec: AI-as-actor in the desk — 4-class action model, panel tab dots, in-panel streaming banner, cell highlighting, confirmation cards for destructive actions, undo model (60s inline + I/O Log + panel context menu), I/O Log panel design (READ/WRITE/TOOL/ERROR/NAV entries with diff previews), context transparency ("what AI sees" chip popover), permission model (5 levels via tab context menu), progressive disclosure (5 layers), all DeskBus additions, full accessibility spec

## Bot Manager Dialog UX
- [bot-manager-ux.md](bot-manager-ux.md) - Icon tab navigation, tool scope rows grouped by risk, desk:delete three-layer confirmation (inline icon + wording + strip), trigger button, 480px sizing, density strategy, accessibility

## Admin Panel Expansion
- [admin-expansion-round2.md](admin-expansion-round2.md) - Round 2 refined UX: navigation reconciliation, impersonation banner, feature flags, maintenance mode, announcements, canonical data table pattern, prioritized page list
- [admin-phase3-ux.md](admin-phase3-ux.md) - Phase 3 UX spec: Analytics page, Notifications page, Broadcast Announcements compose/list, user-facing announcement banner, empty/loading/error states, accessibility patterns
