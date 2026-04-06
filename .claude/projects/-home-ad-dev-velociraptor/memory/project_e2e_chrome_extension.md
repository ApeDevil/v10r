---
name: E2E via Claude Code Chrome Extension
description: Project uses Claude Code Chrome extension for E2E testing, not Playwright
type: project
---

E2E testing is handled by the Claude Code Chrome extension, not Playwright or Cypress.

**Why:** Integrated into the Claude Code workflow — no separate E2E framework needed.

**How to apply:** Don't recommend Playwright/Cypress setup. Don't create an e2e skill. The testing skill and Tesy agent should focus on unit, integration, and component testing with Vitest. E2E coverage comes from the Chrome extension.
