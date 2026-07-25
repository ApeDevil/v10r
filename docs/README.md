# Documentation

Velociraptor documentation organized into three layers: project foundation, stack decisions, and implementation blueprints. Start with foundation to understand the vision, move to stack to see what we use, then reference blueprint for how to build. Navigation rule: every directory has a README.md hub — drill down through them to find the right file.

## Cross-Cutting Maps

Two maps sit above the three layers. Start here for the whole-system view.

| File | Purpose |
|------|---------|
| **[system-abstraction.md](./system-abstraction.md)** | How the system runs — 7-layer runtime hierarchy, request flow, the 12-stage hooks pipeline |
| **[codebase-organization.md](./codebase-organization.md)** | Where code lives — annotated source tree, canonical homes, import rules |

## Directory Structure

| Directory | Purpose | Key Files |
|-----------|---------|-----------|
| **[foundation/](./foundation/)** | Core project vision, principles, and architecture | • [PRD.md](./foundation/PRD.md) - project concept and goals<br>• [principles.md](./foundation/principles.md) - decision constraints that drive stack choices<br>• [architecture.md](./foundation/architecture.md) - framework-agnostic architecture principles |
| **[stack/](./stack/)** | Technology decisions and vendor choices | • [core/](./stack/core/) - runtime, framework, database<br>• [auth/](./stack/auth/) - authentication<br>• [ui/](./stack/ui/) - styling, components<br>• [capabilities/](./stack/capabilities/) - API, AI/LLM, SEO, notifications, GDPR<br>• [vendors.md](./stack/vendors.md) - provider matrix and cost analysis |
| **[blueprint/](./blueprint/)** | Implementation designs and feature specifications | See [Blueprint Areas](#blueprint-areas) below — every subdirectory, one hop away |
| **[guides/](./guides/)** | Practical how-to guides for common tasks | • [emojis.md](./guides/emojis.md) - emoji usage conventions |

## Blueprint Areas

Every `blueprint/` subdirectory, one line each. Flat blueprint files (api.md, auth.md, blog.md, deployment.md, error-handling.md, forms.md, i18n.md, middleware.md, pages.md, pwa.md, state.md, …) are indexed in [blueprint/README.md](./blueprint/README.md).

| Directory | Topics |
|-----------|--------|
| [3d/](./blueprint/3d/) | Threlte integration, copy-paste quick-reference templates |
| [abuse/](./blueprint/abuse/) | ALTCHA captcha, honeypot, rate limits, AI token budget |
| [admin/](./blueprint/admin/) | Cross-device debug pairing (QR flow, HMAC cookie) |
| [ai/](./blueprint/ai/) | AI assistant, layered RAG (llmwiki + rawrag), provider routing, TOON format |
| [analytics/](./blueprint/analytics/) | Two-lane model (anonymous vs authenticated), consent gating, LIA + DPIA screening, client telemetry, rollups |
| [app-shell/](./blueprint/app-shell/) | Layout, sidebar, navigation, toasts, session lifecycle, settings |
| [architecture/](./blueprint/architecture/) | Multi-client core (hexagonal), background jobs, native-client seam |
| [data/](./blueprint/data/) | Drizzle schema workflow, Neon dev-branch refresh from prod |
| [db/](./blueprint/db/) | Relational + graph database patterns, polyglot freshness |
| [design/](./blueprint/design/) | Design tokens, tonal elevation, styling techniques, component layer system |
| [desk/](./blueprint/desk/) | Desk workspace infrastructure, spreadsheet panel |
| [notifications/](./blueprint/notifications/) | External channel delivery — routing, Telegram/Discord/email, settings, schema |
| [quick-search/](./blueprint/quick-search/) | Two-lane search, command palette, blog FTS |
| [testing/](./blueprint/testing/) | Vitest + Claude Chrome extension testing infrastructure |

## Stack Areas

Every `stack/` subdirectory, one line each. The per-technology file map lives in [stack/README.md](./stack/README.md).

| Directory | Topics |
|-----------|--------|
| [core/](./stack/core/) | Bun, Svelte 5, SvelteKit, Podman |
| [ui/](./stack/ui/) | UnoCSS, Bits UI, images |
| [data/](./stack/data/) | PostgreSQL (Neon), Neo4j, Drizzle, R2, Redis |
| [auth/](./stack/auth/) | Better Auth |
| [forms/](./stack/forms/) | Valibot, Superforms |
| [quality/](./stack/quality/) | Biome |
| [i18n/](./stack/i18n/) | Paraglide JS |
| [ops/](./stack/ops/) | Deployment, dev CLI, logging, caching |
| [ai/](./stack/ai/) | Vercel AI SDK |
| [notifications/](./stack/notifications/) | Resend email, Telegram, Discord |
| [capabilities/](./stack/capabilities/) | 3D web, API, GDPR, PWA, SEO, viz |
| [vendors.md](./stack/vendors.md) | Provider pricing, free tiers, compliance matrix |

---

The complete pattern-to-code map lives in the root [README's Pattern Index](../README.md#pattern-index).
