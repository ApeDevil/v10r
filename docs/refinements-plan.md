# Architecture Refinements Plan

Comprehensive cleanup focused on making the codebase more **reusable** and **configurable**. Findings from a full-codebase audit across architecture, security, data layer, UI components, SvelteKit patterns, runtime/DX, code quality, error handling, documentation, technology evaluation, and real-world pattern research.

The codebase is structurally sound. The server module pattern, component hierarchy, hooks composition, and showcase-as-documentation approach are well-executed. What follows are refinements, not repairs.

---

## Tier 1: Critical / High Impact

### 1.1 Centralize Configuration ✅

**Problem:** 30+ magic numbers scattered across 15+ files. When someone forks this template, they must hunt through the entire codebase to customize operational limits.

**Affected values:**

| Value | Current Location | Current Setting |
|-------|-----------------|-----------------|
| Auth rate limit | `hooks.server.ts:13` | 5 req / 60s |
| AI rate limit | `server/ai/config.ts:11` | 20 req / 60s |
| Session expiry | `server/auth/index.ts:40` | 7 days |
| Session refresh age | `server/auth/index.ts:41` | 24 hours |
| Cookie cache maxAge | `server/auth/index.ts:44` | 5 minutes |
| Scheduler interval | `server/jobs/scheduler.ts:7` | 3 hours |
| Scheduler startup delay | `server/jobs/scheduler.ts:8` | 5 seconds |
| Log retention | `server/jobs/log-cleanup.ts:5` | 90 days |
| Max showcase rows (DB) | `server/db/showcase/guards.ts:9` | 50 |
| Max showcase keys (cache) | `server/cache/showcase/guards.ts:4` | 50 |
| Max showcase objects (store) | `server/store/showcase/guards.ts:5` | 20 |
| Max conversations per user | `server/db/ai/guards.ts:5` | 50 |
| Max docs per user | `server/retrieval/config.ts:26` | 100 |
| Max upload size | `server/store/showcase/mutations.ts:13` | 2 MB |
| HNSW m/ef_construction | `server/db/rag/setup.ts:52` | m=16, ef=64 |
| Embedding model/dimensions | `server/retrieval/config.ts:2-4` | gemini-embedding-001 / 1536 |
| Cron schedules | `vercel.json` | Daily 3AM, Weekly Sun 4AM |
| Max tokens (AI) | `server/ai/config.ts:19` | 2048 |
| Neo4j timeout | `server/graph/index.ts:31` | 30 seconds |
| HSTS max-age | `hooks.server.ts:33` | 63072000 (2 years) |

**Solution:** Create `src/lib/server/config.ts` that centralizes all operational constants with env-var overrides where appropriate. Each module imports from it. This single file becomes the "customization dashboard" when forking.

```typescript
// src/lib/server/config.ts
import { env } from '$env/dynamic/private';

export const config = {
    auth: {
        sessionExpiresIn: Number(env.SESSION_EXPIRES_IN) || 60 * 60 * 24 * 7,
        sessionRefreshAge: Number(env.SESSION_REFRESH_AGE) || 60 * 60 * 24,
        cookieCacheMaxAge: Number(env.COOKIE_CACHE_MAX_AGE) || 60 * 5,
    },
    rateLimit: {
        auth: { max: 5, window: '60 s' },
        ai: { max: 20, window: '60 s' },
        retrievalSearch: { max: 30, window: '60 s' },
        retrievalIngest: { max: 5, window: '3600 s' },
    },
    jobs: {
        intervalMs: Number(env.JOB_INTERVAL_MS) || 3 * 60 * 60 * 1000,
        startupDelayMs: 5_000,
        logRetentionDays: 90,
    },
    showcase: {
        maxDbRows: 50,
        maxCacheKeys: 50,
        maxStoreObjects: 20,
    },
    ai: {
        maxTokens: 2048,
        maxConversationsPerUser: 50,
    },
    retrieval: {
        maxDocsPerUser: 100,
        maxChunksPerDocument: 50,
        embeddingModel: 'gemini-embedding-001',
        embeddingDimensions: 1536,
    },
} as const;
```

**Why this matters for a template:** A single file becomes the customization dashboard when forking. The `retrieval/config.ts` is already partially doing this for its own domain — extend the pattern project-wide.

> **Implementation notes:** Created `src/lib/server/config.ts` with flat named exports (not a nested object) grouped by section comments. No `$env/dynamic/private` import at top level — env overrides stay at usage sites (e.g. `JOB_INTERVAL_MS` in scheduler.ts) to avoid build-time evaluation issues. `retrieval/config.ts` became a pure re-export shim; `ai/config.ts` re-exports with aliased names and keeps `SYSTEM_PROMPT` locally. All 15 consumer files wired up.

---

### 1.2 Unified Error System ✅

**Problem:** 6 independent error classes with identical constructors, copy-pasted across modules. No shared base means no unified error handling middleware.

**Current state:**

| Module | Class | Has `code`? | Has `classify*()`? | Has `*ToStatus()`? |
|--------|-------|:-----------:|:-------------------:|:------------------:|
| ai | `AIError` | yes | `classifyAIError(err)` | `aiErrorToStatus()` |
| auth | `AuthError` | yes | `classifyAuthError(err)` | **no** |
| cache | `CacheError` | yes | `classifyCacheError(err)` | **no** |
| graph | `Neo4jError` | yes | `classifyError(code)` | **no** |
| retrieval | `RetrievalError` | **no** | **no** | `retrievalErrorToStatus()` |
| store | `StoreError` | yes | `classifyS3Error(err)` | **no** |
| **db** | **none** | — | — | — |

**Inconsistencies found:**

- `RetrievalError` is the only class missing the `code` property
- Graph's `classifyError(code: string)` takes a different argument type than all others (`err: unknown`)
- `classifyAuthError()` is dead code — never imported anywhere outside its own file
- Only AI and Retrieval have `toStatus()` mappers; the other 4 modules require hardcoded status codes at call sites
- PostgreSQL has NO error classification at all — raw Neon SDK errors propagate unclassified

**Solution:** Create a shared base in `src/lib/server/errors/`:

```
src/lib/server/errors/
  base.ts          — ServiceError base class
  http-mapping.ts  — kind -> HTTP status mapping
  index.ts         — re-export
```

```typescript
// base.ts
export abstract class ServiceError extends Error {
    abstract readonly domain: string;
    abstract readonly kind: string;

    constructor(
        message: string,
        public readonly code?: string,
    ) {
        super(message);
        this.name = this.constructor.name;
    }

    abstract toStatus(): number;
}
```

Each module still defines its own error kinds (domain-specific), but the class structure, classification, and HTTP mapping are shared. Route handlers get a single `catch (err) { if (err instanceof ServiceError) ... }` path.

**Also add:** `src/lib/server/db/errors.ts` — the missing PostgreSQL error classification with PG error codes.

> **Implementation notes:** Created `src/lib/server/errors/index.ts` with `ServerError` (concrete, not abstract) extending `Error` with `kind: string`, optional `code: string`, `toStatus(): number` (default 500), and `toJSON()`. Used flat single-file approach instead of proposed `base.ts`/`http-mapping.ts` split — simpler for 35 lines of code. All 6 error classes migrated to extend `ServerError` with `toStatus()` overrides. `RetrievalError` kept without `code` parameter (no breaking change). Added `classifyNeo4jError(err: unknown)` wrapper to graph errors. PostgreSQL `DbError` deferred to later phase.

---

### 1.3 Security Fixes ✅

#### 1.3a Cron Secret Timing Attack (High) ✅

**File:** `src/routes/api/cron/[job]/+server.ts`

The string comparison `auth !== `Bearer ${secret}`` uses `!==`, which short-circuits on the first differing byte. An attacker can brute-force the `CRON_SECRET` character by character via timing side-channel.

**Fix:** Use `crypto.timingSafeEqual()`:

```typescript
import { timingSafeEqual } from 'crypto';

function safeCompare(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) return false;
    return timingSafeEqual(bufA, bufB);
}
```

#### 1.3b JSON CSRF Protection Missing (High) ✅

**Files:** All `/api/*` endpoints accepting POST/DELETE

SvelteKit's built-in CSRF protection only covers form submissions (`application/x-www-form-urlencoded`, `multipart/form-data`). JSON API endpoints have no CSRF check. DELETE requests on `/api/ai/conversations/[id]` and `/api/retrieval/documents/[id]` have no body and no CSRF verification.

**Fix:** Add a CSRF hook that requires `X-Requested-With` header on all API mutations:

```typescript
const csrfProtection: Handle = async ({ event, resolve }) => {
    const method = event.request.method;
    const path = event.url.pathname;

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method) && path.startsWith('/api/')) {
        if (path.startsWith('/api/auth/') || path.startsWith('/api/cron/')) {
            return resolve(event);
        }
        if (!event.request.headers.get('x-requested-with')) {
            return json({ error: 'Missing CSRF header' }, { status: 403 });
        }
    }
    return resolve(event);
};
```

Create a shared `apiFetch()` utility that includes the header automatically.

#### 1.3c Job Trigger Has No Authorization (High) ✅

**File:** `src/routes/app/jobs/+page.server.ts`

The `trigger` action does not check `locals.user` and has no role-based check. Any authenticated user can trigger any registered job (session cleanup, log cleanup).

**Fix:** Create `src/lib/server/auth/guard.ts`:

```typescript
export function requireAuth(event: RequestEvent) {
    if (!event.locals.user) {
        redirect(303, `/auth/login?returnTo=...`);
    }
    return { user: event.locals.user, session: event.locals.session! };
}

const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS ?? '').split(',').filter(Boolean),
);

export function requireAdmin(event: RequestEvent) {
    const { user, session } = requireAuth(event);
    if (!ADMIN_EMAILS.has(user.email)) {
        error(403, 'Forbidden');
    }
    return { user, session };
}
```

#### 1.3d Session IDs Exposed to Client (Medium) ✅

**File:** `src/routes/app/account/+page.server.ts`

Full `session.id` (the authentication token) is sent in page data. It appears in HTML, gets cached, and is accessible to XSS.

**Fix:** Hash session IDs to display-only tokens:

```typescript
function sessionDisplayId(id: string): string {
    return createHash('sha256').update(id).digest('hex').slice(0, 8);
}
```

Use the display ID in the UI and for revocation (look up by user ownership + hash comparison).

#### 1.3e Account Deletion Has No Confirmation (Medium) ✅

**File:** `src/routes/app/account/+page.server.ts`

A single POST request irreversibly deletes the user and all cascaded data. No re-auth, no CAPTCHA, no confirmation token.

**Fix:** Require typing `"delete my account"` to confirm, or add re-authentication.

#### 1.3f Data Export Leaks Full User Record (Medium) ✅

**File:** `src/routes/app/account/+page.server.ts`

`select()` with no column specification returns ALL columns from the `user` table, including internal fields. If email/password auth is ever enabled, this would leak password hashes.

**Fix:** Explicit column selection:

```typescript
const userData = await db
    .select({ id: user.id, name: user.name, email: user.email, image: user.image, createdAt: user.createdAt })
    .from(user)
    .where(eq(user.id, locals.user.id));
```

#### 1.3g CSP Missing Critical Directives (Medium) ✅

**File:** `svelte.config.js`

Missing: `frame-ancestors: 'none'`, `base-uri: 'self'`, `form-action: 'self'`, `object-src: 'none'`. Also add `mode: 'auto'` for nonce-based script loading.

> **Implementation notes:** All 7 security fixes applied in a single pass. (a) `timingSafeEqual` via `safeEqual()` helper in cron endpoint. (b) `csrfProtection` handle added to `hooks.server.ts` between `sessionPopulate` and `routeGuard`; created `src/lib/api.ts` with `apiFetch()` wrapper and `CSRF_HEADER` export; updated 10 client call sites (3 `Chat` constructors via `headers: CSRF_HEADER`, 7 `fetch` calls via `apiFetch`). (c) Created `src/lib/server/auth/guards.ts` with `requireAuth` and `requireAdmin` (uses `ADMIN_EMAIL` env var); added `requireAdmin(locals)` to jobs trigger action. (d) Added `hashForDisplay()` using SHA-256 truncated to 12 hex chars; session map includes `displayId` alongside `id` (id still needed for revocation form). (e) Server requires `confirmation === 'DELETE'` in formData; UI adds text input + hidden field, submit disabled until match. (f) User export whitelisted to `id, name, email, emailVerified, image, createdAt`; account export whitelisted to `providerId, createdAt`. (g) Added `object-src: none`, `base-uri: self`, `form-action: self`, `frame-ancestors: none` to CSP directives; deferred `mode: 'auto'` (nonce support) to avoid breaking inline styles.

---

### 1.4 Graph Showcase Seed is Destructive ✅

**File:** `src/lib/server/graph/showcase/seed.ts`

`MATCH (n) DETACH DELETE n` deletes ALL Neo4j data including RAG entities. The showcase seed and the RAG system share the same database with no namespace separation.

**Fix:** Scope deletion by label:

```cypher
MATCH (n) WHERE n:Technology OR n:Concept OR n:Layer OR n:Showcase
DETACH DELETE n
```

> **Implementation notes:** Replaced `MATCH (n) DETACH DELETE n` with label-scoped `MATCH (n) WHERE n:Layer OR n:Technology OR n:Concept OR n:Showcase DETACH DELETE n` in `seed.ts`. RAG nodes (`Entity`, `Chunk`, `Document`) are now preserved when reseeding showcase data.

---

## Tier 2: Consistency / DRY

### 2.1 Server Module Pattern Alignment ✅

The four data stores and feature modules follow inconsistent conventions:

| Gap | Module | Action |
|-----|--------|--------|
| No `errors.ts` | db (Postgres) | Add `DbError` with PG error code classification |
| No `types.ts` | db (Postgres) | Add inferred query result types |
| No `showcase/queries.ts` | db (Postgres) | Separate reads from writes (all other modules do this) |
| No `showcase/guards.ts` | graph (Neo4j) | Add node count limits (cache + store both have this) |
| No credential validation | db (Postgres) | Fail at startup if `DATABASE_URL` is missing (cache + store do this) |
| Mixed concerns in `types.ts` | graph (Neo4j) | Split domain types, wire format types, and view mapper into separate files |
| `mutations.ts` contains queries | db/ai | Add `queries.ts` or rename to `operations.ts` |

Also: `graph/types.ts` imports `KnowledgeData` from `$lib/components/viz/graph/knowledge/knowledge-types` — a server module importing a client component type. Move shared types to `$lib/types/`.

> **Implementation notes:** Addressed the high-value items from this list. (1) Created `src/lib/server/db/errors.ts` with `DbError` extending `ServerError` — PG error code classification (23xxx→constraint, 08xxx→connection, 40001/40P01→serialization, 57014→timeout, 42501/28xxx→permission) plus heuristic fallbacks for timeout/connection strings. (2) Split `db/ai/mutations.ts` — moved `listConversations` and `getConversation` to new `db/ai/queries.ts`; updated 3 consumer routes. (3) Split `db/rag/mutations.ts` — moved `listDocuments`, `getDocument`, `countDocuments`, `listCollections` to new `db/rag/queries.ts`; updated 3 consumer files. (4) Moved `KnowledgeNode`, `KnowledgeEdge`, `KnowledgeData` to `$lib/types/knowledge.ts`; `knowledge-types.ts` became a re-export shim; server imports updated to `$lib/types/knowledge`. Deferred items: `db/types.ts` (low value — Drizzle infers), `showcase/guards.ts` for graph (new functionality), DB credential validation (better as 4.7 startup validation), `db/showcase/queries.ts` (showcase queries are inline in page.server.ts loads).

---

### 2.2 Guard Pattern Standardization ✅

Two distinct concerns mixed under "guards":

1. **Namespace assertion** (`assertShowcaseKey`) — validates a key belongs to a namespace
2. **Resource limit checking** (`checkRowLimit`, `checkKeyLimit`, etc.) — prevents unbounded growth

Problems:

- Showcase guards return `string | null`, feature guards return `boolean` — inconsistent return type
- `SHOWCASE_PREFIX` is declared 3 times in the cache module and 4 times in the store module

**Fix:**

1. Standardize the limit check return type:

```typescript
interface LimitCheck {
    allowed: boolean;
    current: number;
    max: number;
    message?: string;
}
```

2. Export `SHOWCASE_PREFIX` from `guards.ts` once, import everywhere else within the same module.

3. Each showcase module should define its prefix in one place. The store module already does this correctly; the cache module does not.

> **2.2a** ✅ Guard return type standardized to `string | null` (null = allowed, string = error message). Updated `db/ai/guards.ts` and `db/rag/guards.ts` from `Promise<boolean>` to `Promise<string | null>` — guards now return descriptive error messages including the limit value. Updated 3 consumer routes (`api/ai/chat`, `api/ai/conversations`, `api/retrieval/ingest`) from `const allowed = …; if (!allowed)` + hardcoded message to `const limitError = …; if (limitError)` + `{ error: limitError }`. Chose `string | null` over the proposed `LimitCheck` interface — simpler, matches the 3 existing showcase/cache/store guards, and the `current`/`max` fields are not consumed by any caller.
>
> **2.2b** ✅ `SHOWCASE_PREFIX` dedup: Cache module — `queries.ts` and `seed.ts` now import from `guards.ts` (which already exported it). Store module — `guards.ts` changed `const` → `export const`; `queries.ts` and `seed.ts` now import from `guards.ts`. Total declarations reduced from 6 to 2 (one per module).

---

### 2.3 API Route Boilerplate Extraction ✅

Every API route duplicates three patterns:

**a) Auth check** — 8 copies of:
```typescript
if (!locals.user) {
    return json({ error: 'Sign in to ...' }, { status: 401 });
}
```

**b) Rate limiter instantiation** — each endpoint creates its own `new Ratelimit({...})` with inline config:
```typescript
const ratelimit = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(N, 'window'),
    prefix: 'rl:...',
});
```

**c) 429 response** — identical `Retry-After` header pattern repeated everywhere.

Also: `api/showcases/check-username/+server.ts` uses an in-memory `Map` rate limiter that does not work on serverless (fresh `Map` per invocation).

**Fix:** Create `src/lib/server/api/`:

```typescript
// guards.ts
export function requireUser(locals: App.Locals) { ... }

// rate-limit.ts
export function createLimiter(config: RateLimitConfig): Ratelimit { ... }
export function rateLimitResponse(reset: number): Response { ... }
```

> **Implementation notes:** (a) Added `requireApiUser(locals)` to `src/lib/server/auth/guards.ts` — throws `error(401)` instead of redirecting (API-appropriate). Replaced 11 inline auth checks across 8 route files (`api/ai/conversations`, `api/ai/conversations/[id]`, `api/ai/streaming`, `api/ai/chat`, `api/retrieval/documents`, `api/retrieval/documents/[id]`, `api/retrieval/ingest`, `api/retrieval/search`). Routes now destructure `const { user } = requireApiUser(locals)` and use `user.id` directly. (b+c) Created `src/lib/server/api/rate-limit.ts` with `createLimiter(prefix, max, window)` and `rateLimitResponse(reset, message?)`. Updated 4 rate-limited routes (`ai/streaming`, `ai/chat`, `retrieval/ingest`, `retrieval/search`) — removed direct `@upstash/ratelimit` and `$lib/server/cache` imports from route files. Not touched: `api/cron/[job]` (Bearer token auth), `api/showcases/check-username` (public GET with in-memory Map).

---

### 2.4 Retrieval Duplication ✅

**Files:** `src/lib/server/retrieval/index.ts` and `src/lib/server/retrieval/instrumented.ts`

`instrumented.ts` reimplements the entire retrieval flow (160+ lines) with event emission interleaved. The two implementations can drift silently.

**Fix:** Refactor `retrieve()` to accept an optional event callback, or make the instrumented version the canonical implementation with a no-op emitter as default.

> **Implementation notes:** Merged `instrumented.ts` into `index.ts` — `retrieve()` now takes an optional third parameter `onEvent?: EmitFn`. All `emit()` calls are guarded with `onEvent &&`, so the non-instrumented path has zero overhead. Helpers `toSummary()` and `emit()` moved as module-private functions. Deleted `instrumented.ts`. Updated `api/ai/chat/+server.ts` to import `retrieve` from `'$lib/server/retrieval'` instead of `retrieveWithEvents` from the deleted module.

---

### 2.5 Schema Barrel for Showcase Stripping ✅

**File:** `src/lib/server/db/schema/index.ts`

Currently exports showcase schemas unconditionally (`export * from './showcase'`). Stripping showcase code from a fork requires editing this barrel.

**Fix:** Add a core barrel:

```typescript
// src/lib/server/db/schema/core.ts
export * from './auth';
export * from './ai';
export * from './rag';
export * from './jobs';
```

Forks import `schema/core` to skip showcase tables cleanly.

> **Implementation notes:** Created `src/lib/server/db/schema/core.ts` re-exporting `auth`, `ai`, `rag`, `jobs`. Existing `index.ts` unchanged (still exports everything including showcase).

---

### 2.6 Neo4j Ingestion Performance ✅

**File:** `src/lib/server/retrieval/ingest/graph-store.ts`

`storeChunkStructure()` makes individual `cypher()` calls in for-loops — one per parent, one per child, one per NEXT_CHUNK edge. For a 50-chunk document, that is 50+ sequential HTTP round trips.

**Fix:** Batch with `UNWIND`:

```cypher
UNWIND $chunks AS c
MERGE (chunk:Chunk {id: c.id})
SET chunk.text = c.text, chunk.order = c.order
```

> **Implementation notes:** Replaced 6 individual mutation functions (`upsertEntity`, `createChunkNode`, `createMentions`, `createRelatedTo`, `createHasChild`, `createNextChunk`) with 3 batch functions (`batchCreateChunks`, `batchCreateHasChild`, `batchCreateNextChunk`) using UNWIND. `storeDocumentGraph` rewritten to batch entities, relationships, and mentions in 3 calls max (vs N+M+K sequential). `storeChunkStructure` in `graph-store.ts` collects all data first, then makes 3 batch calls. `deleteDocumentGraph` unchanged.

---

### 2.7 Neo4j Auth Header Memoization ✅

**File:** `src/lib/server/graph/index.ts`

Credentials are re-encoded to base64 on every `cypher()` call.

**Fix:** Memoize the `Authorization` header at module level.

> **Implementation notes:** Added `let cachedAuthHeader: string | undefined` at module scope. `getAuthHeader()` now returns the cached value on subsequent calls, computing and caching the base64 encoding only once.

---

## Tier 3: Structural Refinements

### 3.1 Route & Layout Cleanup ✅

| Issue | Location | Action |
|-------|----------|--------|
| Pass-through layout does nothing | `showcases/+layout.svelte` | Delete — SvelteKit doesn't require a layout at every level |
| 6 showcase layouts repeat identical structure | `showcases/{db,forms,ai,auth,shell,ui}/+layout.svelte` | Extract `ShowcaseLayout` component with `title`, `description`, `breadcrumbs`, `tabs` props |
| Mixed redirect codes | Showcase `+page.ts` files | Standardize `redirect(307)` to `redirect(303)` — `307` is wrong for permanent index redirects |
| `sessionPopulate` fires on every request | `hooks.server.ts` | Guard behind cookie existence check to avoid unnecessary DB round-trip on static/unauthenticated requests |
| Showcase error hints use `if/else if` chain | `showcases/+error.svelte` | Convert to declarative config map `[prefix, hint][]` |
| Conversation API routes have no try/catch | `api/ai/conversations/+server.ts`, `api/ai/conversations/[id]/+server.ts` | Add error handling — currently throws propagate as HTML, not JSON |

> **Implementation notes:** (1) Deleted pass-through `showcases/+layout.svelte`. (2) Created `ShowcaseLayout` component at `composites/showcase-layout/` with props for `title`, `description`, `breadcrumbs`, `tabs`, `ariaLabel`, `width`, `containerClass`, `wrapperClass`; updated 5 layouts (auth, db, shell, ai, forms) — UI layout kept custom (floating theme toggle FAB). AI uses `width="wide" containerClass="pt-7"`, forms uses `wrapperClass="forms-showcase"` with scoped CSS preserved. (3) Changed `redirect(307)` → `redirect(303)` in 13 showcase `+page.ts` files. (4) Added cookie check guard to `sessionPopulate` in `hooks.server.ts` — skips `auth.api.getSession()` when no `better-auth.session_token` cookie is present. (5) Replaced 6-branch if/else chain with `HINT_MAP: [string, string][]` + `.find()` in `showcases/+error.svelte`. (6) Added try/catch with `classifyDbError` to GET/POST in `api/ai/conversations/+server.ts` and GET/DELETE in `api/ai/conversations/[id]/+server.ts`.

---

### 3.2 Naming & Organization ✅

| Current | Problem | Proposed |
|---------|---------|----------|
| `src/lib/stores/` | Svelte 5 runes, not Svelte 4 stores | `src/lib/state/` |
| `src/lib/services/fonts/` | Category with one member | `src/lib/utils/fonts/` |
| `src/lib/types/pipeline.ts` | Lone file consumed by retrieval | Move to `src/lib/server/retrieval/types.ts` or co-locate with route's `_components/rag-pipeline/` |
| `src/lib/schemas/forms-showcase/` | Doesn't match `server/*/showcase/` convention | `src/lib/schemas/showcase/` or co-locate schemas with routes |
| `composites/nav-section/SectionNav.svelte` | Naming inversion: `SectionNav` vs `TabNav` vs `NavGrid` | Prefix-first: `NavSection`, `NavTab`, `NavGrid` (groups in autocomplete) |
| `primitives/separator/` | Empty directory | Delete |
| Shell index `// Phase 3A` comments | Build-phase artifacts | Replace with functional groupings or remove |
| `db/ai/guards.ts` / `db/rag/guards.ts` | Domain guards named like showcase guards | Rename to `limits.ts` to distinguish from showcase safety guards |

> **Implementation notes:** (1) Renamed `stores/` → `state/`; updated 34 consumer files. (2) Moved `services/fonts/` → `utils/fonts/`; deleted empty `services/` directory; updated 4 consumer files. (3) Renamed `schemas/forms-showcase/` → `schemas/showcase/`. (4) Renamed `SectionNav.svelte` → `NavSection.svelte`; updated barrel export and 18 consumer files. (5) Deleted empty `primitives/separator/` directory. (6) Replaced phase comments (`Phase 3A`, `Phase 4`, etc.) in `shell/index.ts` with functional groupings (Core shell, Sidebar, Navigation, Toasts, Utilities, Session lifecycle). (7) Renamed `db/ai/guards.ts` → `limits.ts` and `db/rag/guards.ts` → `limits.ts`; updated 3 consumer routes. Deferred: `pipeline.ts` relocation (imported by both server and client code, current `$lib/types/` location is correct).

---

### 3.3 Component Barrel Cleanup ✅

**Problem:** `composites/index.ts` uses three distinct export styles:

```typescript
// Style A — re-export from sub-barrel
export * from './empty-state';

// Style B — bypass sub-barrel, reach into file
export { default as Card } from './card/Card.svelte';

// Style C — named export from sub-barrel
export { DatePicker } from './date-picker';
```

**Fix:** Standardize to Style A. Ensure every component folder's `index.ts` exports what it needs. The composites barrel becomes a pure aggregator.

**Also:**

- Primitives barrel over-exports CVA internals (`accordionItemVariants`, `scrollAreaVariants`, etc.) that nobody uses externally. Keep only `buttonVariants` and `badgeVariants` (legitimately external). Internalize the rest.
- Add comments to `components/index.ts` documenting intentional exclusions:

```typescript
// Note: viz/ is NOT exported here — import from '$lib/components/viz' directly
//       to avoid bundling Chart.js in the default component footprint.
// Note: shell/ is NOT exported here — app-specific, import from '$lib/components/shell'.
```

> **Implementation notes:** (1) Standardized `composites/index.ts` to all `export * from './...'` style (sub-barrels already existed for card, form-field, confirm-dialog, quick-search, alert). (2) Trimmed primitives barrel — removed internal-only CVA variant exports: all accordion (4 variants + 5 types), scroll-area (3 variants + 3 types), carousel (6 variants + 6 types), calendar (8 variants + 8 types), toggle-group (2 variants + 2 types), switch, pane resizer, chip close/filter variants, kbd, spinner, typography. Kept externally-used: `buttonVariants`, `ButtonVariants`, `badgeVariants`, `BadgeVariants`, `chipVariants`, `ChipVariants`, `toggleVariants`, `ToggleVariants`. Verified zero external consumers of removed exports via grep. (3) Added exclusion comments to `components/index.ts` for viz/ and shell/.

---

### 3.4 Toast System Co-location ✅

The toast system is split:

- `composites/toast/Toaster.svelte` — the individual toast popup
- `shell/ToastContainer.svelte` — the shell-level mount point

A developer looking for the toast system finds half in each place.

**Fix:** Move `ToastContainer` into `composites/toast/` alongside `Toaster`. Re-export from `shell/index.ts` for the AppShell to consume. The toast system becomes a coherent directory.

> **Implementation notes:** Moved `shell/ToastContainer.svelte` → `composites/toast/ToastContainer.svelte`. Updated `composites/toast/index.ts` to export both `Toaster` and `ToastContainer`. `shell/index.ts` re-exports `ToastContainer` from `'$lib/components/composites/toast'` — preserving all existing import paths.

---

### 3.5 Component-Level Fixes ✅

| Component | Issue | Fix |
|-----------|-------|-----|
| `EmptyState` | Class application bug | One-line fix in class attribute |
| `NavItem` | `isActive` is a function-returning-derived instead of plain `$derived` | Simplify |
| `DropdownMenu` | href items use `window.location.href` instead of anchor tags | Use `<a>` for proper navigation |
| `Accordion` | Duplicated branches for open/closed | Shared snippet |
| `Toaster` | Duplicates variant styles from `Alert` | Compose from Alert |
| `ScrollArea` | No-variant CVA (only one variant: default) | Replace with string constants |
| `PageContainer` vs `Center` | Purpose overlap not documented | Add JSDoc distinguishing their intent |

> **Implementation notes:** (a) `EmptyState`: replaced `class="empty-state {className || ''}"` with `class={cn('empty-state', className)}` + `cn` import. (b) `NavItem`: changed `$derived(() => { ... })` to `$derived.by(() => { ... })`; updated 3 usages from `isActive()` to `isActive` (now a boolean, not a function). (c) `DropdownMenu`: replaced `window.location.href = item.href` with `goto(item.href)` from `$app/navigation` for SPA-correct navigation. (d) `Accordion`: extracted `{#snippet accordionItems()}` containing the shared `{#each}` block; single and multiple branches now render only the Root wrapper + `{@render accordionItems()}`. (e) Toaster composition deferred — legacy component may still be used in showcase demos. (f) `ScrollArea`: replaced empty-variant `scrollAreaVariants` CVA with `SCROLL_AREA_CLASS` string constant; replaced empty-variant `scrollThumbVariants` CVA with `SCROLL_THUMB_CLASS` string constant; updated `ScrollArea.svelte` and sub-barrel exports. (g) Added JSDoc to `PageContainer` ("Full-page wrapper with design-token widths, use for top-level page shells") and `Center` ("Simple centering with Tailwind max-w-* classes, use for content sections within a page"), with cross-references.

---

## Tier 4: Strategic Improvements

### 4.1 Replace Custom AI Provider Registry — SKIPPED

**File:** `src/lib/server/ai/providers.ts`

The Vercel AI SDK ships `createProviderRegistry` from `ai/core` which provides:
- `registry.languageModel('groq:llama-3.3-70b-versatile')`
- `registry.embeddingModel('mistral:mistral-embed')`
- `languageModelMiddleware` hooks for cross-cutting concerns

The current `buildProviderRegistry()` / `resolveActiveProvider()` / `getFallbackProviders()` reimplements this. The custom implementation works but misses embedding/image model registries and SDK-level middleware.

**Fix:** Replace with `createProviderRegistry`. Less code, covers all model types, free middleware hooks.

> **Skipped:** Custom impl provides per-provider `configured` boolean, fallback ordering, and UI metadata that the SDK registry lacks.

---

### 4.2 Code-Based Feature Flags ✅

No feature flag system exists. Optional services either work or crash.

**Fix:** Create `src/lib/server/features.ts`:

```typescript
import { env } from '$env/dynamic/private';

export const features = {
    neo4j: !!env.NEO4J_URI,
    r2Storage: !!(env.R2_ACCOUNT_ID && env.R2_ACCESS_KEY_ID),
    upstashCache: !!(env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN),
    ai: !!env.ANTHROPIC_API_KEY || !!env.OPENAI_API_KEY || !!env.GOOGLE_GENERATIVE_AI_API_KEY,
} as const;
```

Graceful degradation: if a service's env vars aren't set, the feature turns off. In hooks or load functions: `if (!features.neo4j) return { graph: null }`. This is how real SaaS templates handle optional services.

> **Implementation notes:** Created `src/lib/server/features.ts` with flags for `redis`, `r2`, `neo4j`, `ai` using `$env/dynamic/private`. Added `logFeatureStatus()` for startup logging — called from `hooks.server.ts` at module scope. Combined with 4.7 (startup validation) into a single pass: cache/store switched from `$env/static/private` to `$env/dynamic/private` with nullable exports (`Redis | null`, `S3Client | null`). Rate limiting degrades gracefully via `Limiter` interface + passthrough no-op in `api/rate-limit.ts`. Auth rate limiter in `hooks.server.ts` conditionally created (null when no Redis). All 6 showcase files (cache + store: queries, seed, mutations) plus 2 guard files updated with `requireRedis()`/`requireS3()` guards that throw domain errors (`CacheError('credentials')`, `StoreError('credentials')`) instead of crashing — showcase pages' existing try/catch displays "not configured".

---

### 4.3 Drop `ws` Dependency ✅

**File:** `src/lib/server/db/index.ts`

Bun has native `WebSocket`. Replace:

```typescript
// Before
import ws from 'ws';
neonConfig.webSocketConstructor = ws;

// After
neonConfig.webSocketConstructor = WebSocket;
```

Drops `ws` and `@types/ws` — two fewer dependencies. Verify `WebSocket` is globally available in the container's Bun version first.

> **Implementation notes:** Used `neonConfig.poolQueryViaFetch = true` instead of Bun's native WebSocket — same pattern already proven in `drizzle.config.ts` (which had the same comment about Bun's ws issues). Applied to both `db/index.ts` and `scripts/setup-rag.ts`. Removed `ws` from dependencies and `@types/ws` from devDependencies. Trade-off: HTTP per query instead of persistent WebSocket — slightly higher latency but simpler and works identically on serverless (Vercel) and container.

---

### 4.4 Add Biome to devDependencies ✅

Biome is listed in the stack docs and CLAUDE.md but is **not in `package.json`**. Either it is installed globally in the container (fragile) or has been dropped.

**Fix:**

```json
"devDependencies": {
    "@biomejs/biome": "^1.9.0"
}
```

Add scripts:

```json
"lint": "biome check src",
"format": "biome format --write src",
"test": "bun test"
```

> **Implementation notes:** Added `@biomejs/biome: ^2.0.0` to devDependencies. Created `biome.json` with: tabs, 120 line width, single quotes, trailing commas, LF line endings, recommended rules, `noUnusedImports: error`, `noUnusedVariables: warn`, `noNonNullAssertion: warn`, import organization enabled. Svelte overrides disable `useConst` (Svelte `$state()` requires `let`) and `noUnusedVariables` (template usage not detected). Excludes `.svelte-kit/`, `node_modules/`, `src/lib/paraglide/` (auto-generated). VCS integration enabled with git ignore file. Added 4 scripts: `lint` (check), `lint:fix` (check --write), `format` (format --write), `check:biome` (ci mode).

---

### 4.5 Vite Dev Warmup ✅

**File:** `vite.config.ts`

Pre-transform commonly imported modules on dev server start to cut first-page-load time:

```typescript
server: {
    warmup: {
        clientFiles: [
            './src/routes/+layout.svelte',
            './src/lib/components/index.ts',
            './src/lib/styles/tokens.ts',
        ]
    }
}
```

> **Implementation notes:** Added `server.warmup.clientFiles` to `vite.config.ts` with the three files listed above.

---

### 4.6 CSP Audit for Client-Side Fetches ✅

**File:** `svelte.config.js`

`connect-src: ['self']` will block client-side fetches to external services. MapLibre GL loads tiles from CDNs. If AI streaming ever goes client-side, external APIs would be blocked.

**Fix:** Enumerate required external domains or move CSP to response headers (hosting platform) for easier maintenance:

```javascript
'connect-src': ['self', 'https://*.maptiler.com', 'https://*.openstreetmap.org'],
```

> **Implementation notes:** Added `'https://basemaps.cartocdn.com'` to `connect-src` (MapLibre loads tiles/styles/glyphs from this CDN, found in `map-theme.ts`). Added `'worker-src': ['self', 'blob:']` for MapLibre web workers. AI API calls are server-side — no additional CSP changes needed.

---

### 4.7 Startup Configuration Validation ✅

No centralized startup check validates required env vars. Each module either throws on first import (cache, store), checks lazily per-request (graph), or fails at query time with an opaque SDK error (db).

**Fix:** Validate a config schema at app initialization using Valibot (already in the stack). Provide a structured error message listing all missing required configuration at once, rather than one-at-a-time scattered throws.

> **Implementation notes:** Merged with 4.2 (feature flags). Instead of a Valibot schema that would error on missing optional vars, the approach is: `features.ts` detects which services are configured, `logFeatureStatus()` prints enabled/disabled at startup, and optional modules (`cache/index.ts`, `store/index.ts`) return `null` instead of throwing. This provides the same visibility without blocking app startup when optional services are unconfigured.

---

### 4.8 Platform Detection Extension ✅

**File:** `src/lib/server/platform/index.ts`

Currently detects Vercel and container. Common SvelteKit deployment targets Fly.io and Railway are missing.

**Fix:**

```typescript
function detect(): PlatformInfo {
    if (env.VERCEL) return { id: 'vercel', persistent: false };
    if (env.FLY_APP_NAME) return { id: 'fly', persistent: true };
    if (env.RAILWAY_ENVIRONMENT) return { id: 'railway', persistent: true };
    return { id: 'container', persistent: true };
}
```

> **Implementation notes:** Extended `PlatformId` type with `'fly' | 'railway'`. Added `FLY_APP_NAME` and `RAILWAY_ENVIRONMENT` env var detection to `detect()` function.

---

### 4.9 Primitive Token Layer for Theming — SKIPPED

**File:** `src/app.css`

Current tokens map semantic names directly to hex values. No primitive palette layer. To rebrand, you must hunt through every semantic token.

**Fix:** Add a primitive palette above the semantic layer:

```css
/* Primitive palette — raw values */
:root {
    --palette-purple-500: #5416e6;
    --palette-purple-800: #270b47;
    --palette-teal-600: #09516d;
}

/* Semantic tokens — meaning layer */
:root {
    --color-primary: var(--palette-purple-500);
    --color-primary-hover: var(--palette-purple-800);
    --color-fg: var(--palette-teal-600);
}
```

Rebranding becomes changing primitive values only.

> **Skipped:** ~80 color values to restructure across `:root` and `.dark`; high effort, low ROI for a template.

---

### 4.10 Orphaned Entity Cleanup in RAG ✅

**File:** `src/lib/server/graph/rag/mutations.ts`

When `deleteDocumentGraph()` removes Chunk nodes, it does not clean up orphaned Entity nodes that may no longer have any MENTIONS relationships. Over time, the graph accumulates orphaned entities.

**Fix:** Add a cleanup step after chunk deletion:

```cypher
MATCH (e:Entity)
WHERE NOT (e)<-[:MENTIONS]-()
DETACH DELETE e
```

> **Implementation notes:** Added the orphan cleanup query as a second `cypher()` call after chunk deletion in `deleteDocumentGraph()`.

---

## Tier 5: Documentation Fixes

### 5.1 Stale Route Documentation

**File:** `docs/blueprint/pages.md`

Significantly stale. Documents routes that don't exist (`/showcase/state`, `/showcase/animations`, `/showcase/data`) and misses routes that do exist (entire `ai/`, `shell/`, `forms/` sub-groups, `viz/`, `db/cache/`, `db/storage/`).

**Fix:** Update to match `src/routes/showcases/` or mark as aspirational with a clear note about drift.

---

### 5.2 CLAUDE.md Bugs

1. **Duplicate row:** Lines 12 and 21 both say `| Container | Podman | docs/stack/core/podman.md |`. Remove one.
2. **Duplicate delegation section:** "Mandatory Delegation Rules" table and "Delegation Triggers" keyword list say the same thing twice. Keep the keyword triggers (more scannable), remove the table.
3. **Missing AI subsystem:** The RAG/retrieval system (`docs/blueprint/ai/graph-rag.md`) is not referenced anywhere in CLAUDE.md.

---

### 5.3 Unsurfaced Documentation

**`docs/blueprint/ai/`** exists with `graph-rag.md` and `toon.md` but is NOT referenced in:
- `docs/README.md`
- `docs/blueprint/README.md`
- `CLAUDE.md`

Anyone looking for AI/RAG documentation will miss it entirely.

---

### 5.4 Directory Identity Issues

| Problem | Fix |
|---------|-----|
| `docs/features/` has 1 file (`keyboard-shortcuts.md`), overlaps with `docs/implementation/` | Merge into `docs/implementation/`, delete orphan directory |
| `docs/stack/features/` collides with `docs/features/` in name | Rename to `docs/stack/capabilities/` |
| `docs/blueprint/deployment.md` duplicates `docs/stack/ops/deployment.md` | Move or deduplicate |
| `docs/blueprint/development-environment.md` is a setup principle, not a feature design | Move to `docs/foundation/` |
| `docs/blueprint/progressive-revelation.md` and `style-randomizer.md` are product concepts | Move to `docs/foundation/` |

---

### 5.5 Missing Documentation

| Feature | Routes exist | Docs exist | Action |
|---------|:---:|:---:|--------|
| AI / RAG / retrieval | 8+ routes | `stack/ai/ai-sdk.md` only | Write `implementation/ai-showcase.md` |
| Visualization | 5 showcase pages | none | Write `stack/capabilities/viz.md` |
| Decorative UI | 2 showcase pages | none | Low priority — self-documenting via showcases |

---

## What NOT to Do

These were evaluated and deliberately rejected:

| Temptation | Why to resist |
|------------|---------------|
| Cache/store adapter abstractions | One provider each — insufficient use cases. S3 protocol is already the adapter. The "two concrete use cases" rule is not met. |
| Monorepo extraction | Single-app template with no second consumer. Adds workspace tooling, versioning, and `svelte-package` configuration pain. Revisit only when a second app exists. |
| Composable viz (Layer Cake pattern) | Chart.js wrappers are correct for a template/sandbox. Full composability is architectural overkill for the stated purpose. |
| W3C DTCG design tokens / Style Dictionary | Spec still evolving, tooling has gaps. Current CSS custom properties are simpler and equally effective. |
| `tailwind-variants` migration from CVA | Working workarounds exist (`color-mix()`). Migration cost exceeds benefit given the established pattern. |
| Formal plugin architecture | The dominant real-world SvelteKit pattern is `sequence()` + env-based feature detection, not a WordPress-style plugin system. |
| Context-based dependency injection for server clients | Module-level singletons are correct for both serverless (fresh per invocation) and container (persistent per process). DI would matter only for per-request tenancy or mock injection, neither of which is a current goal. |

---

## Execution Order

Recommended implementation sequence:

**Phase 1 — Foundation (Tier 1)**
Config centralization, error system unification, security fixes, graph seed fix. Highest leverage: affects every module and every route.

**Phase 2 — Consistency (Tier 2)**
Server module alignment, guard standardization, API boilerplate extraction, retrieval dedup, schema barrel, Neo4j batching. Mostly additive — filling gaps and removing duplication.

**Phase 3 — Structure (Tier 3)**
Route/layout cleanup, naming normalization, barrel cleanup, component fixes. Renames, deletes, and small refactors.

**Phase 4 — Strategy (Tier 4)** ✅
Feature flags + optional services, `ws` removal, Biome setup, Vite warmup, CSP audit, platform detection, RAG cleanup. Skipped: AI provider registry swap (custom impl has needed features), primitive token layer (high effort, low ROI).

**Phase 5 — Docs (Tier 5)**
Route docs update, CLAUDE.md fixes, surface hidden docs, directory cleanup, fill gaps. Can be done in parallel with any phase.
