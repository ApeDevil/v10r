---
title: "Deployment (Vercel primary, tri-target)"
description: "Covers the tri-target deployment strategy — Vercel Node.js (stable), Vercel Bun (experimental), and Koyeb Bun container — sharing one codebase with per-target…"
category: "Architecture & Request Pipeline"
---

# Deployment (Vercel primary, tri-target)

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** Architecture & Request Pipeline · **Tier:** light · **Risk:** medium — deployment configuration spans external hosting targets (Vercel, Koyeb)

Covers the tri-target deployment strategy — Vercel Node.js (stable), Vercel Bun (experimental), and Koyeb Bun container — sharing one codebase with per-target adapter configuration.

**When to use:** Reach for it when configuring or switching the deployment adapter/target for the app.

## Docs

- [docs/blueprint/deployment.md](/docs/blueprint/deployment) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/deployment.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/deployment.md))
- [docs/stack/ops/deployment.md](/docs/stack/deployment) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/stack/ops/deployment.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/stack/ops/deployment.md))

## Code

- `svelte.config.js` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/svelte.config.js) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/svelte.config.js))
- `vercel.json` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/vercel.json) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/vercel.json))

---

_Machine-readable record: `architecture-deployment` in `mcp/patterns.registry.json`._
