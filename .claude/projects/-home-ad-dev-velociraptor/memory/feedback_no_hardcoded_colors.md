---
name: No hardcoded colors
description: Never use hardcoded color values in components — always use CSS custom property tokens from app.css
type: feedback
---

Never hardcode colors (like `black`, `#000`, `#0c0e10`) directly in component styles or classes. All colors must come from CSS custom properties defined in `src/app.css`.

**Why:** The project has a design token system with light/dark theme support. Hardcoded values bypass this system and can't be themed.

**How to apply:** When a new color is needed that doesn't fit existing tokens, add a new CSS custom property to `app.css` (in both `:root` and `.dark` blocks) and reference it via `var(--token-name)` in component styles.
