---
name: transparency-my-data-showcase
description: A "my data" transparency surface already exists as a public showcase — reuse it, don't build a post-signup data-dump from scratch
metadata:
  type: project
---

A transparency/"what we know about you" surface already exists at `src/routes/[[locale=locale]]/(public)/showcases/analytics/my-data/` (plus a sibling `privacy/` page). It implements: a reveal gate ("Show My Data" button, default hidden), three consent-tier cards (necessary/analytics/full) with per-field collected/not-collected state, a SHA-256 hashing demo (masked IP+UA → visitor ID), a consent banner re-open/reset control, and demo Export/Delete (GDPR Art 20/17) buttons that currently only toast.

**Why:** The "first page after first sign-up = a data-dump transparency page" brainstorm (2026-06-11 consultation) is ~80% already built as a public showcase. Building a second copy under /app would duplicate it and diverge.

**How to apply:** If this idea is pursued, treat it as (a) reusing/extracting the my-data tier-card + hashing-demo components into a shared place, then (b) a post-signup variant that adds account-scoped rows (auth.session raw IP/UA, OAuth account scopes, empty preference/AI/desk stores). Do NOT recommend a forced full-screen data dump — make it a reveal-gated, skippable surface. Known a11y debt to fix on reuse: tier cards and `.verification-item.pass` signal state with `color: var(--color-success)` + a check icon but the "not collected" state is color+icon only (forbidden color-only risk is borderline — icon shape differs check vs minus, so it passes, but the green/muted text color must not be the ONLY differentiator). Note /app is excluded from analytics tracking, so a transparency page under /app shows a frozen anonymous trail, not a live one. App post-signup landing today = `/app/dashboard`; no first-run/onboarding detection exists. App shell uses NavTab (see [[navtab-role-tab-defect]]).
