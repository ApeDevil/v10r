---
name: security-hardening-2026-06
description: security-hardening branch (4 waves) — what landed and which docs were updated to match
metadata:
  type: project
---

Security-hardening pass landed on the `security-hardening` branch (4 waves; 861 tests green, type-clean, biome-clean, DB migration applied + live-verified). Docs-only update done 2026-06-18.

**Why:** harden the reference stack against cross-tenant leaks, header gaps, and unbounded inputs. The RAG graph cross-tenant leak was the headline (flagged HIGH in the June 2026 review — see [[review-2026-06-11]] if present).

**How to apply:** when documenting middleware/RAG/auth/rate-limits, the post-hardening reality is the baseline. Key facts:
- **RAG graph is per-tenant.** Neo4j `:Chunk` has `ownerId`; `:Entity` keyed `{name, ownerId}`. Reads scoped `WHERE ownerId IN $ownerIds` with `[user.id, SYSTEM_DOCS_USER_ID]`. Canonical doc section: `blueprint/ai/layered-rag.md#graph-tenancy-neo4j`. The OLD `graph-rag.md` example code (Mistral/LangChain/name-only Entity) is ASPIRATIONAL, not live — flagged inline, not rewritten.
- **graph/rag/ real files:** `queries.ts`, `mutations.ts` (`deleteDocumentGraph(documentId, ownerId)`, `deleteUserGraph(ownerId)` — note param is `ownerId` not `userId`).
- **privacy erasure** (`privacy/mutations.ts`) now imports `deleteUserGraph` from `graph/rag` — best-effort try/catch (Aura outage must not block relational erasure). This is the ONE sanctioned cross-domain reach in privacy/; the READ aggregator (`report.ts`) still reads only from db/.
- **Security headers** live in `hooks.server.ts` `securityHeaders` handler (handler #1 of 12). Full table now in `system-abstraction.md#security-headers-set`. CSP (restricted `img-src`) is in `svelte.config.js`, NOT the hook. `style-src` still needs `unsafe-inline` (Svelte transitions) — known constraint.
- **Extracted modules:** `$lib/server/security/csrf.ts` (NEW domain folder), `$lib/styles/random/palette-sanitize.ts`, `twoFactorVerifyLimitKey()` in `auth/step-up.ts`, `auth/public-user.ts` (`publicUser()` projector, leak-gate-enforced — `security/load-leak-gate.test.ts`).
- **better-auth bumped 1.6.17 → 1.6.19** (OTP-replay + cookie-splitting). `useSecureCookies` now explicit = NODE_ENV==='production'.
- **rate-limit fail-closed at RUNTIME too** (was only boot-time): `createLimiter` wraps `.limit()`, prod 429 on Redis throw; `timeout: 1000`. AI circuit breaker has symmetric in-memory fallback.
- **API:** `/api/ai/chat/stream` REMOVED. New input bounds on desk spreadsheets PUT, chat array caps, proposals approve rate-limit, analytics SSE connection caps. `sharp limitInputPixels: 25M`.

**Docs note:** `blueprint/middleware.md` and `blueprint/ai/graph-rag.md` are generic/aspirational pattern docs with placeholder handler names + old example code. The ACCURATE live homes are `system-abstraction.md` (per-handler table) and `layered-rag.md` (real RAG). When in doubt, trust those two over the pattern docs.
