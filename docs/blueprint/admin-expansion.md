# Admin Area Expansion Blueprint

> Synthesized from 12 agent consultations (archy, svey, uxy, daty, resy, scout — 2 rounds with cross-pollination). Branch: `feature/admin-expansion`.

## Current State

The admin area has 3 pages behind a `TabNav`:
- **DB Observation** — connection health for Neon/Neo4j/Upstash/R2
- **Branding** — theme palette editor via Superforms
- **Jobs** — background job dashboard with trigger/health/history

Guard: `routeGuard` in `hooks.server.ts` (primary, runs on every request) + `requireAdmin(locals)` in layout and pages (defense-in-depth). Single-admin via `ADMIN_EMAIL` env var.

---

## Proposed Admin Pages

### Tier 1 — Build Next ✅

| Page | Route | Purpose | Status |
|------|-------|---------|--------|
| **Users** | `/admin/users` | Browse users, ban/unban, role management, session inspector, impersonation | ✅ Core done (session inspector + impersonation deferred) |
| **Feature Flags** | `/admin/flags` | Runtime feature toggles without redeploy (ops + permission types) | ✅ Done |
| **Audit Log** | `/admin/audit` | Immutable record of all admin actions | ✅ Done |

### Tier 2 — After Tier 1 Proves Stable

| Page | Route | Purpose | Status |
|------|-------|---------|--------|
| **Analytics** | `/admin/analytics` | Pageview trends, top paths, consent breakdown, active users | Done |
| **Notifications** | `/admin/notifications` | Channel health (Discord/Telegram), delivery log, failure inspection | Done |
| **Broadcast** | (within Notifications) | System announcements with per-user dismissals | Done |

### Tier 3 — When Justified by Usage

| Page | Route | Purpose | Status |
|------|-------|---------|--------|
| **AI Usage** | `/admin/ai` | Conversation counts, token costs, users at conversation limit | Done |
| **RAG Management** | `/admin/rag` | Document status, reindex trigger (via jobs system) | Done |
| **Cache Inspector** | `/admin/cache` | Redis key browser, memory stats, flush actions | Done |

### Deferred

- **Rate Limits** — operational, use Upstash dashboard until traffic warrants
- **Graph Explorer** — significant UI effort, low immediate ROI
- **Session Inspector / Impersonation** — Phase 2, after audit log proves reliable
- **Maintenance Mode** — flag exists in `system_config`, hook integration not started

---

## Architecture

### Route Tree

```
src/routes/(shell)/admin/
  +layout.server.ts          # requireAdmin (defense-in-depth, unchanged)
  +layout.svelte             # Grouped TabNav (Observe / Manage / System)
  +page.server.ts            # redirect -> /admin/db
  db/                        # [Observe] EXISTS
  analytics/                 # [Observe] streaming load
  audit/                     # [Observe] GET form, URL-as-state
  users/                     # [Manage] Better Auth admin plugin
  flags/                     # [Manage] toggle UI
  branding/                  # [Manage] EXISTS
  jobs/                      # [System] EXISTS
  rag/                       # [System] document status
  cache/                     # [System] Redis key browser
  notifications/             # [System] channel health + delivery log
```

### Navigation: Vertical Sidebar ✅

With 11 pages, switched from horizontal TabNav to vertical sidebar (NNGroup: max 6 flat tabs).

- **Desktop (md+)**: Sticky sidebar (200px) with grouped sections + content area
- **Mobile (<md)**: Collapsible dropdown showing current page name, expands to full nav
- **Component**: `AdminSidebar.svelte` in `$lib/components/shell/`

```
Observe:  DB  |  Analytics  |  Audit Log
Manage:   Users  |  Feature Flags  |  Branding
System:   Jobs  |  Notifications  |  AI Usage  |  RAG  |  Cache
```

### Module Boundaries

```
Route Adapters (thin)
  src/routes/(shell)/admin/[page]/+page.server.ts
  Responsibilities: auth guard, form parsing, SvelteKit error/redirect
      |
      v
Domain Modules (pure, no SvelteKit imports)
  $lib/server/admin/audit.ts      -- recordAuditEvent()
  $lib/server/admin/flags.ts      -- getFlag(), setFlag()
  $lib/server/auth/               -- Better Auth admin plugin (listUsers, ban, etc.)
  $lib/server/analytics/          -- aggregate queries (existing + new)
  $lib/server/notifications/      -- existing service layer
```

### Guard Pattern (Already Correct)

```
hooks.server.ts routeGuard       <- PRIMARY: runs every request, checks /admin prefix
  +layout.server.ts              <- SECONDARY: defense-in-depth
    +page.server.ts              <- TERTIARY: per-page, especially for form actions
```

Scout confirmed this is the right architecture. SvelteKit #6315 (layout bypass) does NOT apply here because the primary guard is in hooks, not layout.

**Evolution path**: When roles are needed beyond single-admin, update `routeGuard` to check `locals.user.role` instead of `ADMIN_EMAIL`. The `requireAdmin(locals, capability?)` signature supports future fine-grained checks.

---

## Data Model

### New Schema: `admin`

All admin tables in a dedicated `pgSchema('admin')`, following the existing pattern (auth, ai, analytics, showcase each have their own schema).

### New Tables

#### `admin.audit_log` (Migration 1) ✅

| Column | Type | Notes |
|--------|------|-------|
| id | integer | PK, generated always as identity |
| action | text | NOT NULL, e.g. 'user.ban', 'flag.toggle' |
| actor_id | text | NOT NULL, no FK (survives user deletion) |
| actor_email | text | NOT NULL, denormalized for display |
| target_type | text | nullable, e.g. 'user', 'feature_flag' |
| target_id | text | nullable, polymorphic |
| detail | jsonb | nullable, before/after diff per EnterpriseReady spec |
| ip_address | text | nullable |
| occurred_at | timestamptz | NOT NULL, DEFAULT now() |

Indexes: `(occurred_at DESC)`, `(actor_id, occurred_at DESC)`, `(target_type, target_id, occurred_at DESC)`, `(action)`.

Design: text action (not enum) for extensibility. No FK on actor_id — audit trail must survive user deletion. JSONB detail with `{before, after, meta}` structure. Append-only, no `updated_at`.

#### `admin.system_config` (Migration 1) ✅

| Column | Type | Notes |
|--------|------|-------|
| key | text | PK, e.g. 'maintenance_mode', 'feature.ai_chat' |
| value | jsonb | NOT NULL |
| description | text | nullable, human-readable |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_by | text | nullable, admin actor ID |

Unified feature flags + system config. Deliberately simple — no percentage rollouts, no user targeting. Fowler's taxonomy: only ops + permission toggles needed at this scale.

Cache strategy: in-process Map with 30s TTL. No Redis dual-write (scout validated this is RISKY — PostHog outage post-mortem from Oct 2025 documents cascading failures from dual-write under load).

#### `admin.announcements` (Migration 2) — Not started

| Column | Type | Notes |
|--------|------|-------|
| id | text | PK, prefixed 'ann_...' |
| title | text | NOT NULL |
| body | text | NOT NULL |
| severity | text | NOT NULL, CHECK IN ('info', 'warning', 'critical') |
| active | boolean | NOT NULL, DEFAULT true |
| starts_at | timestamptz | nullable (NULL = immediately) |
| ends_at | timestamptz | nullable (NULL = until deactivated) |
| created_by | text | NOT NULL |
| created_at | timestamptz | NOT NULL, DEFAULT now() |
| updated_at | timestamptz | NOT NULL, DEFAULT now() |

Partial index on `(starts_at, ends_at) WHERE active = true`.

#### `admin.announcement_dismissals` (Migration 2) — Not started

| Column | Type | Notes |
|--------|------|-------|
| announcement_id | text | FK -> announcements(id) CASCADE |
| user_id | text | FK -> auth.user(id) CASCADE |
| dismissed_at | timestamptz | NOT NULL, DEFAULT now() |
| PK | | (announcement_id, user_id) |

Index on `(user_id)`.

#### Better Auth Admin Plugin (Migration 3) ✅

Adds `role`, `banned`, `bannedAt`, `banReason` to `auth.user` and `impersonatedBy` to `auth.session`.

### Tables NOT Needed

- **user_admin_metadata** — Better Auth admin plugin handles roles and bans natively
- **Analytics aggregates** — existing `daily_page_stats` covers it; extend when needed
- **AI message_metadata** — defer until conversation volume justifies cost tracking
- **job_registry** — job metadata already lives in code (`jobs/index.ts` record)

### Migration Order

1. `admin` schema + `audit_log` + `system_config` (no dependencies)
2. `announcements` + `announcement_dismissals` (depends on admin schema)
3. Better Auth admin plugin schema changes (modifies auth.user)

---

## Key Implementation Patterns

### Canonical Admin Data Table (Community Gap)

No canonical Svelte 5 + Drizzle admin table exists. This project defines one:

1. **URL is the single source of truth** — `?q=smith&page=2&sort=email&dir=desc`
2. **Load function reads URL, queries Drizzle** — `limit/offset/orderBy/where`
3. **GET forms for search/filter** — native browser behavior, progressive enhancement
4. **Anchor links for sort headers** — toggle direction, preserve other params
5. **Existing Pagination composite** — pass `totalPages`, `currentPage`, `buildHref`
6. **No client-side data libraries** — server owns the data, client renders what arrives

Reference implementation: `/admin/jobs` page (already follows this pattern).

### Streaming vs Polling vs SSE

| Page | Strategy | Rationale |
|------|----------|-----------|
| DB Observation | Streaming load | Already implemented, queries complete within timeout |
| Analytics | Streaming load (aggregates) + 5s polling (live feed) | Summary stats eager via streaming; Live Activity feed polls every 5s for new raw events |
| Users | On-demand only | User data doesn't change in real-time |
| Feature Flags | On-demand + optimistic UI | Admin is the one making changes |
| Audit Log | On-demand only | Historical data, stable snapshot |
| Jobs | Manual refresh via invalidate | Append-only, infrequent updates |
| Notifications | Streaming for initial load | Channel health eager, history deferred |

**SSE: do not introduce yet.** Vercel serverless has 10s (Hobby) / 60s (Pro) timeout limits. Polling via `invalidate()` is simpler, more reliable on serverless, and sufficient for all current use cases.

### Impersonation

Better Auth admin plugin provides `impersonateUser`. Three parts:

1. **Session**: Plugin creates session with `impersonatedBy` field. Admin's own session preserved.
2. **Banner**: Full-width sticky bar in shell layout (`+layout.svelte`), driven by `data.impersonatedBy`. Warning color, "End session" button, `role="alert"` + `aria-live="assertive"`.
3. **Audit**: Every impersonation start/stop writes to `admin.audit_log`.

Known bugs to mitigate:
- Issue #2183: session expiry not restored after stop — verify fix in installed version
- Issue #6448: admin-to-admin impersonation ambiguity — restrict to non-admin users only
- Issue #3547: server-side impersonation doesn't work — use client-side only

### Audit Log Integration

```
recordAuditEvent({
  actorId, actorEmail, action,
  targetType?, targetId?, detail?, ipAddress?
})
```

Called explicitly in form actions (not middleware). Form actions know what changed; hooks don't. Enforce via code review. The multi-client core architecture means audit writes in domain functions automatically cover all callers (UI, AI tools, API).

---

## UX Patterns

### Feature Flags Page

Card-based layout (not table). Each flag card: name, description, Switch toggle, rollout indicator. Edit via Sheet/Drawer. Flags ON with rollout < 100% show partial indicator. Flags OFF with user overrides show warning badge.

### Maintenance Mode

Prominent card at top of System tab. INACTIVE = default card. ACTIVE = warning background, status label in warning color. No confirmation modal — visual state change IS the confirmation. Editable message textarea for users.

### Broadcast Announcements

Two-column: compose form (left) + active announcements list (right). Severity as segmented control (Info/Warning/Critical). Live preview using Alert component. Active list shows announcement count.

### Data Table Empty States (3 distinct)

1. No data at all: "No users yet" + CTA
2. No search results: "No results for 'ada'" + "Clear search" link
3. No filter results: "No users match these filters" + "Clear filters" link

### Cross-Cutting

- Skeleton loading matching content shape (not centered spinners)
- Alert with "Try again" for errors
- Time display with `title` tooltip for absolute timestamps
- `ConfirmDialog` for destructive actions (ban, delete, flush)

---

## Implementation Sequence

### Phase 1: Foundations ✅
1. ✅ Better Auth admin plugin integration + schema regen
2. ✅ `admin.audit_log` table + `recordAuditEvent()` function
3. ✅ `admin.system_config` table + in-process cache
4. ✅ Grouped TabNav refactor in admin layout

### Phase 2: Core Pages ✅
5. ✅ Users page (leverages admin plugin + canonical table pattern)
6. ✅ Feature Flags page (toggle UI + system_config reads)
7. ✅ Audit Log page (URL-as-state, GET form, CSV export)
8. ✅ Retroactive audit wiring on Jobs + Branding pages

### Phase 3: Visibility ✅
9. ✅ Analytics page (streaming load, headline stats, range selector, consent caveat)
10. ✅ Notifications page (channel health with live probes, delivery log, needs attention section)
11. ✅ Announcements (compose form, live preview, active list, user-facing banners, per-user dismissal)

### Phase 4: System ✅
12. ✅ AI Usage page (conversation/message metrics, provider status, users near limit, message volume chart)
13. ✅ RAG Management page (document status overview, error reset, admin delete, collections)
14. ✅ Cache Inspector page (Redis key browser, prefix filters, inspect values, flush by prefix, in-process cache invalidation)
15. Impersonation (after audit log proves reliable) — deferred

---

## Risks

### 1. Better Auth Admin Plugin Integration
Plugin adds columns to `auth.user`. Must regenerate schema. May conflict with custom column names (issue #4408). **Mitigation**: install plugin, inspect schema changes before building anything.

### 2. Audit Log Write Discipline
Manual `recordAuditEvent()` calls will be forgotten on new pages. **Mitigation**: code review checklist — every form action that mutates state must include an audit call.

### 3. Analytics Query Performance
Raw `analytics.events` table grows unbounded. **Mitigation**: the analytics page uses aggregates (`daily_page_stats`) for historical ranges; the Live Activity feed reads raw events for a 5-minute window only (via `getRecentEvents()`). Bounded-cost controls: a 5-minute time window cap on the raw query, a partial index on `(debug_owner_id, id) WHERE debug_owner_id IS NOT NULL` for the paired-session filter, and consent-tier gating on returned fields. Extend the rollup job when new historical aggregates are needed.

---

## Differentiation

What makes this admin area stand out vs competing templates (next-shadcn, MakerKit, Apptension):

- **Feature Flags** — absent from ALL surveyed templates
- **Broadcast Announcements** — absent from ALL surveyed templates
- **Audit Log from day one** — only Apptension has partial coverage
- **AI Usage monitoring** — no template includes LLM cost tracking
- **Self-documenting** — admin pages are live operational tools, not demos. The AI usage page shows real token consumption from the project's own AI subsystem.
- **Canonical data table pattern** — fills a community gap (no Svelte 5 + Drizzle admin table example exists)
