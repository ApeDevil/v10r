# UXY Memory Index

## Feedback
- [NavTab role=tab defect](feedback_navtab_role_tab_defect.md) — NavTab puts role=tab on navigating anchors (WCAG 4.1.2); use link-nav + aria-current instead
- [AI control room a11y floor](feedback_ai_control_room_a11y_floor.md) — diagrams need table equivalents, no color-only, focus-to-heading on route change; verified gaps in current /admin/ai page
- [my-data color-only state](feedback_mydata_color_only_state.md) — transparency showcase signals collected/not by color alone AND aria-hides the icon; double-fix before signup-flow reuse

## Project
- [Transparency my-data showcase](project_transparency_my_data_showcase.md) — a reveal-gated "what we know about you" surface already exists at showcases/analytics/my-data; reuse, don't rebuild as post-signup data dump
- [PlanCard approval precedent](project_plancard_approval_precedent.md) — v10r's existing AI propose→human-approve UI; non-modal during stream, streamReady-gated focus, aria-live, text+shape risk cues — extend for any AI-fills/human-verifies surface
