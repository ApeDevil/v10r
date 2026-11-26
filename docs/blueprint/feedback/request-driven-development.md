# Request-Driven Development: Slice 0 proposal

**Status:** approved 2026-11-26 with the refinements in §R, which take precedence over the
sections below where they differ. Slice 1 is built (§R.7 records where it differs from the
plan); Slices 2–4 are not.
**Date:** 2026-11-26 · **Base:** `main` at 50da2f7
**Governing rule:** automate the work, not the authority.

---

## R. Review decisions and resolved edge cases (2026-11-26)

ApeDevil approved the proposal with these decisions: keep the name `feedback`; reuse the
existing form, schema, inbox, abuse protection, audit log and development procedures; omit
GitHub Issues, GitHub Agentic Workflows, AI triage and embeddings; defer routine initiation;
add no service, subscription, dependency or expenditure. The eight-state lifecycle and the
separation of the two gates are approved. What follows resolves the edge cases he raised.

### R.1 Account deletion and engineering continuity

One rule, decided by the row's status at the moment of erasure, inside the existing
`deleteUserData` transaction:

| The user's feedback is… | On erasure |
|---|---|
| `received`, `deferred`, `accepted`, `closed` (never reached development, or left it) | **deleted**, by the `user_id … ON DELETE CASCADE` FK |
| `in_development`, `ready_for_review`, `release_approved`, `released` | **kept as an engineering shell**: cleared are `user_id`, `subject`, `body`, `rating`, `contact_email`, `page_of_origin`, `session_id` and `error_id` (both join to logs about the person's requests), `triage_note`; the `nonce` is replaced with a random value; `submitted_at` is cut to the day (the exact second correlates with request logs); `erased_at` is set. Kept: `status`, `category`, `route_id` (a route pattern, `/blog/[slug]`, never parameter values), `app_version`, and Slice 2's development record |

Why that holds every constraint:

- **The single-active constraint** keys on `status`, which the shell keeps, so erasure can't free
  the slot. Releasing it takes an explicit admin transition.
- **The reviewed SHA, scope and report** live in Slice 2's `feedback.development` row, keyed
  by `feedback_id`. The shell row survives, so its development row survives too. Nothing
  pending is invalidated without a decision.
- **Duplicate links**: `duplicate_of` is a self-FK `ON DELETE SET NULL`. A row closed as a
  duplicate of a deleted row stays `closed/duplicate` with no target. The only `CHECK` runs one
  way (a set target requires reason `duplicate`), so the null target stays valid. A shell is
  never deleted, so links to it stay intact.
- **Admin delete** refuses development and released rows for the same reasons; such a row
  leaves the lifecycle only by a transition.
- **Erasure racing a development approval.** `eraseSubmitterFeedback` locks the user's
  feedback rows (`SELECT … FOR UPDATE`) before deciding. An approval that committed first is
  seen and the row is shelled; an approval that comes second waits, then finds the row gone
  and is refused. The cascade can never delete a row that entered development mid-erasure.
  Run 25 times each way on Postgres 16 (§R.7); removing the lock makes the check fail.

Where user text could linger, and the rule for each:

- **Audit records** (`admin.audit_log.detail`) carry ids, states, reasons and SHAs only, never
  the subject, body or note. A test asserts it.
- **Triage note**: written by the admin, but it may quote the user, so it's blanked with the
  rest of the shell.
- **Slice 2's scope and implementation report**: written by the admin and the agent. The brief
  tells the agent not to copy submitter text or personal data into the report, and the admin
  reads it before importing it. That's a procedural rule, not a technical one, and it's
  documented as such. On erasure the development record's "include the submitter's text"
  flag is cleared, so a brief generated afterwards cannot quote anything (and the text is
  gone anyway).
- **Anonymous feedback** (no `user_id`) can't be matched to an account. It stays erasable by
  hand (admin delete) and by the on-demand purge (R.2).

Privacy export: the report gains a `feedback` section (portable, the user's own rows in full:
category, subject, body, rating, contact email, status, submitted at, and the technical
context they chose to attach: page, route, error reference, app version, and whether the
analytics journey was linked — the session key itself is internal and stays out).

**Admin notes and access rights.** Two different things:

- The **portability export** (the "Download my data" report, Art. 20) carries what the user
  provided. The `triage_note` is the admin's internal working note, so it is not in that
  export and never shown under My feedback.
- A **formal access request** (Art. 15) is answered by hand, and it covers personal data
  wherever it sits, notes included. Notes are not categorically exempt; the admin reads them
  out on request.

So notes stay about engineering (what to build, why deferred), not assessments of the
person, and they are cleared when the submitter's account is erased.

### R.2 Resource protection: zero money is not zero consumption

Every safeguard reuses something that already runs, and none adds a scheduled job:

| Resource | Safeguard | Mechanism |
|---|---|---|
| Submission size | subject ≤ 120, body ≤ 4000, note ≤ 2000, route ≤ 200, version ≤ 64, error id ≤ 64 | valibot + DB `CHECK` backstops (existing pattern) |
| Per-IP submissions | 3 per hour for anonymous submitters (existing) | `createLimiter` (Upstash) |
| Per-user submissions | 10 per 24 h for signed-in submitters, instead of the IP limit | the same `createLimiter`, keyed by user id. A new key prefix in the existing Upstash database: more keys and commands there, no new service |
| Untriaged backlog | new submissions are refused while 500 items wait in `received` ("inbox full, try later") | counted in the submission's one `count(*)` |
| Total storage | a hard ceiling of 5,000 stored items in every state (about 5 MB); the admin inbox warns from 4,000 and says when the form is refusing | the same `count(*)` (a `FILTER` gives both numbers); the inbox sums the per-status counts it already loads. Both limits live in `feedback/config.ts` |
| Submission path | exactly one Upstash call (user or IP limiter, never both) and two queries (the count, an `INSERT … ON CONFLICT DO NOTHING` on the nonce); a replayed nonce costs one more read | — |
| Closed and anonymous retention | an on-demand **"Delete closed feedback older than 180 days"** admin action, one confirmation, one audit event | no cron; the window lives in `config.ts` |
| Report size (Slice 2) | `report` ≤ 20000 chars | DB `CHECK` |
| Query efficiency | list and count on `(status, submitted_at)`; "My feedback" on `(user_id, submitted_at)`; duplicate suggestions are an FTS query over open rows, `LIMIT 5` | indexes, pagination at 50 |
| Repeated admin actions | every transition checks its from-state inside a locking transaction, so a double click changes nothing the second time and writes no second audit row | `SELECT … FOR UPDATE` + from-state check |

**Paid-overage verification (2026-11-26):**

- **Neon:** project `broad-night-71900850` is on `free_v3` with a 1 GiB logical-size limit
  (read via the Neon connector). The free plan has no billed overage; writes stop at the limit.
- **Vercel:** the team is on Pro. Pro bills on-demand usage beyond the included amount unless
  Spend Management caps it. I could not read the spend-management setting through the Vercel
  connector (`get_team` returns no billing fields), so **zero cost on Vercel is not verified**.
  The feature's added load is a few function invocations per submission.
- **Upstash:** no connector here, so the plan and its overage behavior are **not verified**.
  The per-user limiter is additional consumption of that existing service (its own keys and
  commands); since a submission now calls one limiter, never both, the commands per
  submission did not grow.
- **Claude:** whether usage credits (metered overage) are on is a claude.ai account setting
  that no tool here can read. **Not verified.**

**What "no external calls" means here, precisely.**

- **No new external service integrations:** no new provider, account, API key, SDK or
  dependency.
- **Additional calls to existing infrastructure:** yes. Neon (the new columns, counts and
  locks), Upstash (the per-user limiter keys), Vercel (the same function invocations). Small,
  but not zero.
- **No additional AI spend:** nothing in feedback calls a model; no triage, no embeddings.
- **Unverified overage settings:** Vercel, Upstash and Claude, as listed above.
- The gate test `feedback-boundary.gate.test.ts` scans the feedback files for `fetch`, AI
  clients, agent/MCP clients and external hosts. It catches a direct call written into this
  feature. It is not proof that nothing in the transitive dependency graph can make a network
  call; it is a structural check, not a network audit.

**One approved item is not one running session.** The partial unique index guarantees that
only one item is *approved* for development at a time. Nothing in a manual handoff can stop the
same brief from being pasted into two sessions. The brief says "one session only", and the admin
is that control. The Capacity Scheduler may help later; feedback doesn't depend on it.

### R.3 Untrusted text in the development brief (Slice 2)

- The "quote the original text" checkbox is **off by default for every category**.
- The admin-written scope is the instruction; the original text is optional data.
- When it's included, it's embedded as one **JSON string literal** (`JSON.stringify`), with
  control and bidi-override characters removed first. JSON escaping means no newline, quote,
  backtick fence or heading in the user text can leave the literal, whatever it contains.
- Contact email, user id, IP, session journey and triage note are never in the brief.
- Wording isn't the security boundary. The boundaries are: the admin reads the brief before
  pasting; cloud sessions hold no secrets, DB or deploy credentials; the agent can't push
  `main` (the ship step needs ApeDevil's message); and both gates are server-side.

Technical context on the form: an **"Include technical context" checkbox, off by default**,
shows exactly the values it would attach (app version, area, error reference). Unchecked
means none of them is stored, and the analytics-journey link is not stored either.
`page_of_origin` keeps its existing sanitizer and now also drops any query string or fragment.

### R.4 Transactional integrity

- Each transition is one domain function: `SELECT … FOR UPDATE` → check the from-state → update
  → audit row, all **in one transaction**. `recordAuditEvent` gains an optional transaction
  handle for this.
- Concurrent approvals can't bypass the one-active rule: the partial unique index rejects the
  second commit (23505), and the transaction rolls back with its audit row.
- Rework (Slice 2) clears any release approval in the same transaction that moves the item back.
- `deferred`, `accepted` and `closed` behave alike: each can be reopened to `received`, and
  `closed` always carries a reason (`CHECK`).
- **Status migration:** production holds 2 feedback rows, both `new` (read-only count,
  2026-11-26). The enum change is not additive, so it's a hand-written SQL file
  (`scripts/db/changes/feedback-lifecycle.sql`): rename the old type, create the new one,
  convert with `new|read → received` and `archived → closed + close_reason archived`, drop
  the old type. A PGlite test runs it on old-shape rows and compares the result with the
  Drizzle schema. Applying it to production needs ApeDevil's word (`cloud-db-change`).
  The `read` marker is dropped, because opening an item no longer changes its status. No other
  data is lost.

**Release sequence (Slice 1).** The migration replaces the status enum, so the order matters:

| Application running | Old schema | Migrated schema |
|---|---|---|
| **Old** (before Slice 1) | fine | public form inserts still work (new columns are nullable or defaulted, and the status default is `received`); the admin inbox fails on its `new`/`read` filters and the detail page's auto-"read" until the new code is live |
| **New** (Slice 1) | every feedback page fails (missing columns) | fine |

So: **migrate first, then ship.** The window between them only affects the admin's own inbox.

1. Gate the branch (`validate`, `validate:build`); check production's schema is still the
   pre-Slice-1 shape (read-only query).
2. Rehearse the migration on a temporary Neon branch (`prepare_database_migration`), check the
   rows map and a new-shape row inserts; apply it (`complete_database_migration`); verify on
   production that the rows are still there, mapped.
3. Ship (`squash-into-main.sh`), check the GitLab sync and the Vercel deployment.
4. Verify live: form, a test submission, inbox, My feedback, the deployed version, no runtime
   errors. Remove the test submission through the admin delete.

**If the deployment fails after the migration:** production keeps serving the old deployment
against the migrated schema, as in the table: public form fine, admin inbox impaired. Fix
forward and redeploy. Only if Slice 1 is abandoned, `scripts/db/changes/feedback-lifecycle.down.sql`
puts the old shape back (received → new, closed/archived → archived, everything else → read;
the new columns are dropped). It was run up → down → up on Postgres 16; after the down step the
schema is identical to the original (`pg_dump -s`) and every row survives.

### R.5 Release binding and the shipping receipt (Slice 2)

- `squash-into-main.sh --expect-sha <sha>` fetches `origin/<branch>` and refuses unless
  **both** the local `HEAD` and the remote branch tip equal `<sha>`. A stale local branch
  or a newer remote push stops the ship.
- The script already squashes the branch's own tree (which must contain current `main`), so
  binding the SHA binds the integration tree. If `main` moved, the branch must merge it, the
  SHA changes, and the ship refuses until a renewed approval names the new SHA.
- **Receipt:** with `--feedback <id>`, the script prints a fixed block at the end
  (`feedback`, `branch`, `approved_sha`, `ship_commit`, `gate`), and the `ship` skill adds
  `gitlab_sync` and `deployment` from the checks it already runs. ApeDevil pastes that block
  into "Confirm release".
- **Live check, not proof:** at confirmation the server records whether its own
  `VERCEL_GIT_COMMIT_SHA` equals the ship commit. That shows which deployment answered; it
  doesn't prove the approved change is inside it. If a later legitimate deployment already
  replaced the release commit, the confirmation still succeeds on the receipt and records
  "superseded by <running sha>".
- The app never holds credentials to push `main`, deploy or authorize a release.

### R.6 Fewer manual steps (Slice 2)

One approval → one brief → one copy. The agent ends its report with one fenced JSON block,
tagged `v10r-implementation-report/1` (feedback id, branch, head SHA, validate,
validate:build and browser results, and the report text). The admin pastes the whole report
once. The server takes the single block with that tag and validates it with valibot. No parser
framework is involved. Then one release approval → one handoff → one pasted receipt.

---

### R.7 Slice 1 as built

Where the implementation settled something the plan left open, or differs from it:

- **Technical context is one opt-in.** The page of origin joined route, error reference, app
  version and journey link behind the single "attach technical context" checkbox, off by
  default. Unticked, the row stores none of them (`page_of_origin` is `''`). The form lists the
  exact values the box would attach.
- **App version** is `VERCEL_GIT_COMMIT_SHA`; off Vercel it is absent and nothing is attached.
- **Route** is the SvelteKit route pattern (`/blog/[slug]`), never the concrete path's
  parameters. The page of origin keeps its pathname only: query and fragment are dropped.
- **Reopen** is allowed from `deferred` and from `closed` (any reason), back to `received`.
- **The `read` marker is gone.** Opening an item no longer changes it; triage state is the
  status. The two production rows (`new`) migrate to `received`, `archived` to
  `closed`/`archived` (`scripts/db/changes/feedback-lifecycle.sql`, hand-written because the
  generated diff casts `new` straight to the new enum and fails).
- **Closed purge is on demand:** an admin button deletes closed items unchanged for 180 days.
  No job was added.
- **Inbox capacity and storage ceiling:** new submissions are refused while 500 items wait in
  `received`, or once 5,000 are stored in any state (§R.2).
- **Duplicates are one hop.** An original is never itself a duplicate, and an item that has
  duplicates cannot become one (`has_duplicates`), so there are no chains and no cycles.
  Marking a duplicate locks both rows in id order, so opposite or chaining links made at the
  same moment queue up: whoever comes second reads the first link and is refused. Reopening a
  duplicate clears its link. Deleting an original sets its duplicates' target to null (they
  stay closed as duplicates). Checked on Postgres 16 with the domain code itself racing on
  several connections (a throwaway harness on Bun's SQL driver and a local server, not part
  of the gate): opposite links on one pair, chain attempts,
  three-way cycle attempts and fan-in against an original, 25 rounds each, all held; with
  the lock removed, every one of them failed.
- **One limiter call per submission:** user limiter when signed in, IP limiter otherwise.
- **Related items** search the 200 most recent items, so a detail view costs the same at any
  inbox size.
- **The single development slot's index** spells its state list as a literal (the SQL-injection
  guard forbids `sql.raw`); a test iterates `ACTIVE_DEVELOPMENT_STATUSES` against it.
- **Privacy:** the policy's feedback section, the form's privacy note and the account data page
  describe the opt-in, the account link, export and erasure. The export includes the attached
  technical context; the triage note stays out of it (§R.1).
- **Form fix found on the way:** `main`'s form failed with a 500 on every submission (its
  union-typed `rating` made superforms refuse the FormData). The rating is now one nullable
  number; a test posts the form's real FormData.

## 0. The short answer

v10r already has most of this feature. A public `/feedback` form, a `feedback` schema, an
admin inbox at `/admin/feedback`, honeypot plus per-IP rate limiting, nonce idempotency, error-ID
prefill from 5xx pages and a sanitized page-of-origin all exist today. So the smallest useful
version is an **extension of the existing feedback domain**, not a new request system:

1. **Slice 1:** add a category, an owner link, the deploy version, a real triage lifecycle and
   a "My feedback" view to what exists. That's one schema change and no new service, dependency,
   cron, AI call or external call.
2. **Slice 2:** add the two approval gates as admin server actions that **generate text**: a
   development brief and a release handoff, which ApeDevil pastes into a Claude Code session he
   already uses. The ship script gets one new guard, `--expect-sha`, so a release approval is
   bound to the exact reviewed commit mechanically, not by convention.
3. **No GitHub Issues, no automatic agent launch, no AI triage.** Each one is evaluated below.
   Claude Code routines (option B) work technically and bill to the subscription, but they save
   one paste per request at a cost of a long-lived spend token in Vercel and a prompt-injection
   path into an agent with repository write access. Defer it.

Zero added cost holds by construction, because nothing new talks to a paid service. Per
submission, the only new consumption is one row of roughly 1–2 KB in Neon and the Upstash
rate-limit call that already runs.

---

## 1. What already exists (inventory)

| Need from the brief | What v10r has today | Where |
|---|---|---|
| Submission form | `/feedback` with subject, body, optional rating, optional contact email, hidden page-of-origin, superforms + valibot | `src/routes/[[locale=locale]]/(public)/feedback/`, `src/lib/feedback/validation.ts` |
| Entry points | `FeedbackBand` on showcases/workflows/docs pages; the 5xx `ErrorDisplay` links to `/feedback?from=…&err=<errorId>` | `src/lib/components/composites/feedback-band/`, `error-display/ErrorDisplay.svelte` |
| Persistence | `feedback.feedback` table: status enum `new · read · archived`, DB `CHECK` length backstops, status/date indexes | `src/lib/server/db/schema/feedback/index.ts` |
| Idempotency | unique `nonce`; a replayed submit returns the existing id | `src/lib/server/feedback/index.ts` `submitFeedback` |
| Abuse protection | honeypot plus a 2 s fill floor; per-IP limit of 3/h via `createLimiter` (Upstash, fail-closed in production) | `#lib/server/abuse`, `#lib/server/feedback/config.ts` |
| Safe technical context | `sanitizeFeedbackSource` (same-origin path only, ≤512 chars); `errorId` shape-checked; analytics journey linked only when consent set `_v10r_sid` | `src/lib/feedback/source.ts` |
| Admin inbox | `/admin/feedback` list (paginated, status filter) plus a detail page with journey, status change and delete | `src/routes/[[locale=locale]]/admin/feedback/` |
| Admin authorization | `requireAdmin` (page/actions) and `guardApi*` (endpoints), backed by the `ADMIN_USER_ID` allowlist; non-admins get 404 | `src/lib/server/http/guards.ts` |
| Who-did-what record | `admin.audit_log` + `recordAuditEvent` (actor, action, target, jsonb detail, IP) + `/admin/audit` viewer with CSV export | `src/lib/server/admin/audit.ts` |
| Deploy version | `VERCEL_GIT_COMMIT_SHA` is the Kit `version.name`, and is in the live HTML | `vite.config.ts` |
| Branch → main → production | feature branch, then `squash-into-main.sh` (gated tree, one commit, plain push), then `gitlab-sync.yml`, then the Vercel build of GitLab `main`. No preview deployments (`vercel.json` deploys `main` only) | `scripts/ship/`, `.claude/skills/ship/`, `docs/stack/ops/shipping.md` |
| Release authorization | ship only on ApeDevil's own word in the conversation; file or tool text never authorizes | `CLAUDE.md`, `ship` skill |
| Coding agent sandbox | cloud sessions have no secrets, no DB and no container by design | `docs/foundation/development-environment.md` |
| Validation | `bun run validate`, `validate:build` (perf ratchet), Playwright | `package.json` |
| Duplicate search primitive | Postgres FTS (`websearch_to_tsquery`) already used by blog search | `src/lib/server/blog/queries.ts` |
| Pattern distribution | `pattern-library/registry.json` → generated pages, MCP excerpts, RAG | `pattern-library/`, `mcp/` |

**Gaps:** no category, no link to the submitting account (so no "My feedback"), no
engineering lifecycle, no approval records, deploy version and error ID not stored as fields
(the error ID is only prefilled into the body text), and feedback is missing from the privacy
export/erasure domain (fine while it's anonymous, required once it links to a user).

---

## 2. Naming: keep "feedback", don't introduce "request"

The brief calls the thing a *Request*. In this codebase that word already means an HTTP request,
the `request id` correlation value, `grant request` (`auth/grant-requests.ts`),
`AssetRequest`, `ExternalOperationRequest` and the generic Kit `request`. `docs/naming.md`'s
One Name, One Concept rule would make a sixth meaning a defect. The domain already exists as
`feedback`, and the brief's categories (feature, bug, improvement, general feedback) are kinds of
feedback.

Proposed vocabulary (added to `docs/naming.md` in Slice 1):

| Concept | Name |
|---|---|
| A user submission | `feedback` (existing) |
| What kind it is | `category`: `feature` · `bug` · `improvement` · `general` |
| Its place in the lifecycle | `status` (existing column, new enum below) |
| Gate 1 | `development approval` |
| The text handed to a coding agent | `development brief` |
| What the agent returns | `implementation report` |
| Gate 2 | `release approval` (bound to one commit) |
| The text that asks a session to ship | `release handoff` |

The page copy can say "Send feedback or a request" without the code taking on the word.
**Decision for you:** keep `feedback` (recommended), or rename the whole domain.

---

## 3. Minimal architecture

```
/feedback form ──(existing action: honeypot, IP limit, nonce)──▶ feedback.feedback row
                                                                     │
/admin/feedback  ◀── admin reads, triages (server actions, requireAdmin, audit_log) ──┘
     │
     │ Gate 1 "Approve development"  → feedback.development row + development brief (text)
     ▼
ApeDevil pastes the brief into an existing Claude Code / Codex session
     │  agent: investigate → scope check → branch claude/cloud/feedback-<id>-<slug>
     │         → implement → validate → implementation report → STOP
     ▼
ApeDevil pastes branch + HEAD SHA + report into the admin "Record implementation" form
     │
     │ Gate 2 "Approve release" (binds the reviewed SHA) → release handoff (text)
     ▼
ApeDevil pastes the handoff → ship skill → squash-into-main.sh --expect-sha <sha>
     → gitlab-sync → Vercel → admin "Mark released" checks the running deployment's commit
```

Every arrow that leaves the app is a human paste. The app never calls GitHub, an agent, a
model or a deploy API.

### 3.1 Ownership of information

| Information | Owner (single source) |
|---|---|
| User's text, category, contact email, owner | `feedback.feedback` |
| Triage state and duplicate link | `feedback.feedback.status`, `duplicate_of` |
| Approved scope, branch, reported SHA, report, release-approved SHA, released ship SHA | `feedback.development` (one row per feedback that reached Gate 1) |
| Who approved what, when (history) | `admin.audit_log` (existing): no new history table |
| Code, branch, commits | Git (GitHub). The app stores names and SHAs, not copies of code |
| Whether a release is live | the running deployment's `VERCEL_GIT_COMMIT_SHA` |

Nothing is mirrored to GitHub, so there's no state to keep in sync.

### 3.2 Data model (Slice 1 + 2), one schema, additive except the status enum

`feedback.feedback`, new columns:

- `category` enum `feature · bug · improvement · general`, not null, default `general`
- `user_id` text, nullable, FK `auth.user` **on delete cascade** (erasure removes the user's
  own submissions; anonymous rows stay `null`)
- `app_version` text, nullable: the server's `VERCEL_GIT_COMMIT_SHA` at submit time, filled
  server-side and never taken from the client
- `route_id` text, nullable: SvelteKit `page.route.id` (`/blog/[slug]`), which has no params by
  construction. It replaces raw paths as the area marker; `page_of_origin` stays as is
- `error_id` text, nullable, `CHECK` `^[\w-]{1,64}$`, moved out of the body prefill
- `duplicate_of` text, nullable, self-FK
- `close_reason` enum `rejected · duplicate · archived`, nullable, `CHECK` set iff status `closed`
- `triage_note` text ≤ 2000, admin-only, never shown to the submitter
- `status` enum replaced (see §4). Existing rows map `new → received`, `read → received`,
  `archived → closed/archived`, in the same push.

`feedback.development` (new, 1:1 with feedback, created at Gate 1):

- `feedback_id` PK/FK, `branch` (unique), `scope` text ≤ 8000 (written by the admin, not the user)
- `include_user_text` boolean (whether the brief quotes the submission)
- `development_approved_by`, `development_approved_at`
- `reported_sha` (`CHECK` 40-hex), `report` text ≤ 20000, `reported_at`
- `release_approved_sha`, `release_approved_by`, `release_approved_at`
- `released_sha`, `released_at`

**"One active task" constraint:** a partial unique index,
`CREATE UNIQUE INDEX ON feedback.feedback ((true)) WHERE status IN ('in_development','ready_for_review','release_approved')`.
The database refuses a second active item, so no UI or race can get around it. Constraints
express the rules.

**Volume:** a row is about 1–2 KB. 1,000 submissions is about 2 MB, against a Neon project at
about 295 MB of 1 GiB (measured 2026-11-25). Admin queries hit the existing
`(status, submitted_at)` index and paginate at 50.

---

## 4. Lifecycle (8 states, not 9+)

| State | Meaning | Enters from | Who | Guard |
|---|---|---|---|---|
| `received` | submitted, not triaged | submit | anyone | existing abuse checks |
| `deferred` | parked: needs analysis or a reply from the submitter (reason in `triage_note`) | received, accepted | admin | `requireAdmin` |
| `accepted` | worth doing, **not** authorized to build | received, deferred, in_development (scope returned), ready_for_review (rework declined) | admin | — |
| `in_development` | **Gate 1 granted**; brief issued; holds the single slot | accepted | admin | partial unique index; `development` row inserted in the same transaction |
| `ready_for_review` | branch + SHA + report recorded | in_development | admin (pasting the agent's output) | SHA format; branch matches the issued branch |
| `release_approved` | **Gate 2 granted** for exactly `release_approved_sha` | ready_for_review | admin | `release_approved_sha = reported_sha`; a different actor action from Gate 1 |
| `released` | ship SHA verified as the running deployment | release_approved | admin | server compares the entered ship SHA with its own `VERCEL_GIT_COMMIT_SHA` |
| `closed` + `close_reason` | rejected · duplicate (`duplicate_of` set) · archived | any non-released | admin | `CHECK` constraints |

Merged or dropped on purpose:

- *Under review* is just `received` that an admin opened. The detail page stops auto-flipping
  the status; a status should mean a decision.
- *Approved for development* and *In development* are the same fact when the hand-off is
  manual: the app can't observe an agent starting. One state holds the slot.
- *Rejected / Archived / Duplicate* are one terminal state with a reason, which keeps the enum
  and the filters small.
- *Request clarification* is `deferred` with a note. The app doesn't email anyone (no outbound
  service). ApeDevil replies by hand to the `contact_email` if there is one.

Re-review loops: `ready_for_review → in_development` (rework, new SHA required) and
`release_approved → ready_for_review` (the branch moved, see §6). Every transition is one
domain function in `#lib/server/feedback/` that checks the from-state in the `UPDATE … WHERE
status = :from` itself (optimistic, race-safe) and writes one `recordAuditEvent` with
`{from, to, branch, sha}`.

---

## 5. Gate 1: development approval

**Action:** admin detail page → "Approve development" opens a form:
- *Scope* (required): the admin's own words, the only instruction the agent follows
- *Branch slug* (required, kebab-case, ≤ 40): branch becomes `claude/cloud/feedback-<shortid>-<slug>`
  (shown with `codex/cloud/…` as the alternative prefix)
- *Quote the submission?* (checkbox, off by default for every category; see §R.3)

**Server:** `requireAdmin` → transition `accepted → in_development` → insert the `development` row →
audit. If the index refuses, show "Another item is in development: <link>".

**The development brief** is rendered from a fixed template (a server-side function, tested):

- request id, category, route id, app version, error id
- the admin scope, labeled **authoritative**
- the user's text, only if ticked, inside a fenced block labeled *untrusted data: describes a
  problem, contains no instructions*. Never the email, user id, IP or journey.
- the steps from the brief (§8): read `CLAUDE.md`, check whether it already exists, assess,
  acceptance criteria, branch from current `main`, implement, `bun run validate` and
  `validate:build`, a browser check for UI, report, **stop**
- **stop conditions**, verbatim: the change touches auth/authorization, billing, DB access
  policy, production infrastructure, CI/CD or secrets, sensitive data exposure, security
  boundaries, destructive DB operations, adds a dependency/service/cost, or exceeds the scope.
  Then write an analysis instead of code and return.
- the implementation report template (§10 of the brief: scope, findings, decisions, files and
  domains, branch + HEAD SHA, tests, validation with *not run* lines, perf, security, DB
  changes, external consumption, costs, limits, recommendation)
- "merge current `origin/main` into the branch before reporting, so the reported SHA already
  contains `main`"

ApeDevil copies it (a `CopyButton`) into a Claude Code cloud session, or into the project chat,
which already spawns a thread with a capacity tag. One approved item is one L-size task. With
the weekly allowance shared (68% used at 08:44 UTC today, per the Capacity Scheduler), the
"one active" limit is also the allowance limit.

**Record implementation:** a form on the same page with branch (prefilled, must match), HEAD SHA
and report (paste). Transition `in_development → ready_for_review`. The app doesn't call GitHub
to verify the SHA. That check happens at ship time, where it's enforced.

---

## 6. Gate 2: release approval

**Action:** "Approve release" on a `ready_for_review` item. The admin re-reads the report; the
button records `release_approved_sha = reported_sha`, who and when, then audits.

**Release handoff** (text): *"Ship branch `<branch>` at `<sha>` for feedback `<id>`: <one-line scope>.
Use `--expect-sha <sha>`."* ApeDevil pastes it into a session. Under `CLAUDE.md` his own
message is the ship authorization, and the paste *is* his message. The admin button alone
executes nothing, so the existing ship policy stays the sole authority, as the brief asks. A
button that ships directly is not part of this proposal.

**Binding to the reviewed commit (the one code change outside the app):**
`squash-into-main.sh --expect-sha <sha>` refuses (exit 1) unless the branch `HEAD` equals
`<sha>`, and the `ship` skill passes it whenever a handoff names a SHA. So:

- a branch that moved after approval cannot ship under that approval;
- if `main` moved and the branch needs `git merge origin/main`, the HEAD changes, the ship
  refuses, and the item goes back to `ready_for_review` for a new SHA and a new click. The gate
  re-runs `validate` + `validate:build` on the final tree anyway.

**Mark released:** after the ship report, ApeDevil enters the ship commit SHA. The server
compares it to its own `VERCEL_GIT_COMMIT_SHA`. That only matches when the request is served
by the new production deployment, which is a real live-version check at zero cost. A mismatch
leaves the item `release_approved` and says why.

**The agent can't approve its own release:** approvals live behind `requireAdmin` in the
production DB; cloud sessions have no DB, no admin session and no secrets; the ship needs
ApeDevil's own message; and the script checks the SHA.

---

## 7. Agent integration: options compared

| | A. Manual handoff (paste) | B. Claude Code routine fired from the app | C. GitHub Agentic Workflows / Codex or Claude Action |
|---|---|---|---|
| Financial cost | none | none if usage credits stay off; runs bill to subscription usage | Claude/Codex engines bill **API keys** (gh-aw: subscription OAuth "is not supported"); Copilot engine bills Copilot entitlements/AI credits |
| Allowance use | one session, when ApeDevil chooses | same session cost; up to 30 fires/h per routine if abused | Actions minutes (free on standard runners in public repos) **plus** paid inference |
| New secret in Vercel | none | a per-routine `sk-ant-oat01-` fire token (long-lived, spends subscription) | a GitHub token able to dispatch workflows |
| Status visible to app | via the report paste | **no status API**; fire returns only a session id/URL | via the Actions API (polling or webhooks) |
| Prompt-injection surface | the admin reads the brief before pasting | the payload is wrapped as untrusted, but no human sees the final prompt | user text enters a runner with repo write paths |
| Privacy | text stays between the app and the session | same | **public repo: Actions logs and artifacts (prompt.txt, agent logs) are readable by anyone** |
| Maturity | — | "experimental API", research preview | product works; billing model is the blocker |
| Fits both gates | yes | yes (fire only from Gate 1) | yes, but adds a second backlog/trigger surface |

**Recommendation:** A now. B stays a documented Slice 3 candidate. Turn it on only after you have
confirmed usage credits are off at claude.ai/settings/usage (I can't read that setting from
here), and only if paste friction proves real across several items. Reject C: it can't run on
the Claude subscription, it means paid inference, and it puts private feedback in public logs.

Sources: [Routines](https://code.claude.com/docs/en/routines),
[Routines fire API](https://platform.claude.com/docs/en/api/claude-code/routines-fire),
[gh-aw billing](https://github.github.com/gh-aw/reference/billing/),
[gh-aw auth](https://github.github.com/gh-aw/reference/auth/),
[gh-aw engines](https://github.github.com/gh-aw/reference/engines/).

---

## 8. GitHub Issues: not needed

- The standing project rule is no GitHub issues, ever.
- The repo is public (`visibility: public`, checked). Even sanitized issues are a second,
  public copy of the backlog that must be kept in sync.
- The admin inbox already is the engineering backlog. With one active item there's nothing
  for an issue tracker to coordinate.

Verdict: omit. Don't defer it as a "later" item either, unless the solo-developer rule changes.

---

## 9. AI triage: not now

Expected volume is a handful per week. Deterministic help is enough:

- **Duplicates:** on the detail page, a `websearch_to_tsquery` over `subject || body` of open
  items in the same category, top 5, no index (a sequential scan of a few hundred rows takes
  milliseconds). Same `error_id` or same `route_id` + category is shown as "possibly related".
- **Grouping:** list filters by category, status and route id.
- **Complexity/risk:** done by the coding agent after Gate 1, as the brief says.

No embeddings, no model calls, no RAG ingest of feedback (that would also put private text in
the retrieval index).

---

## 10. Cost and allowance policy

| Resource | Policy | How it's enforced |
|---|---|---|
| New money | 0 | no new service, dependency or paid API in the design |
| AI calls on submit | 0 | the feedback action imports no AI module (a Slice 1 gate test asserts it) |
| Agent launches | 0 automatic | the app holds no agent credential |
| Concurrent development | 1 | partial unique index |
| Automatic retries / releases | 0 | no job, cron or webhook is added |
| Background workers, polling | none | `vercel.json` crons unchanged |
| Neon | about 1–2 KB per submission | existing length `CHECK`s; the daily cleanup cron covers retrieval only, and feedback is never auto-expired |
| Upstash | the existing limiter call per submit; none for admin | — |
| Vercel | one function invocation per submit or admin action, inside the Pro plan | no new routes outside `/feedback`, `/account`, `/admin` |
| Browser bundle | the public form gains one `Select` and one `Checkbox`; admin code stays in admin route chunks | the existing perf ratchet in `validate:build` |
| Claude allowance | one session per Gate 1, started by hand | the Capacity Scheduler tag on any delegated thread |

Where a provider limit can't be read programmatically (the Claude subscription, the Upstash
monthly command count), the app shows nothing rather than an estimate.

---

## 11. Security model

- **Submissions are data.** They only reach an agent quoted inside a labeled untrusted block
  of an admin-written brief, after the admin has read it, and only when the admin ticks
  "quote". The admin scope is the instruction.
- **Abuse:** the existing honeypot, the 3/h per-IP limit and length checks. Authenticated
  users additionally get a per-user limit through the same `createLimiter` (for example 10/day),
  so a signed-in spammer can't rotate IPs. ALTCHA is not needed at this volume. It's one flag
  away if abuse shows up.
- **Authorization:** every transition is a server action behind `requireAdmin`, with the
  from-state checked in SQL. A button, a client state or a label is never the authority.
- **Coding agent:** a cloud session already has no production DB, deploy, billing or GitLab
  credentials. The brief carries no email, user id, IP or journey.
- **Escalation:** the stop list in the brief. An approval never covers auth, billing, DB
  policy, infrastructure, CI/CD, data exposure, security boundaries or destructive DB work.
- **Separation of gates:** Gate 1 and Gate 2 are distinct actions bound to distinct facts
  (scope versus SHA). Shipping still needs ApeDevil's message plus `--expect-sha`.
- **Privacy:** linking `user_id` puts feedback under GDPR export and erasure, so Slice 1 adds it
  to `#lib/server/privacy` (report + cascade). "My feedback" shows the user's own rows and a
  coarse status (Received · Considering · Planned · In progress · Released · Closed), never
  `triage_note` or scope.

---

## 12. What's omitted

Screenshot upload, votes, public roadmap, comment threads, email notifications to submitters,
GitHub Issues, AI triage and embeddings, automatic agent launch (until Slice 3 is approved),
Actions-based agents, preview deployments per request, a new admin app, a new MCP server, a
transitions table (the audit log covers it), multi-repository support.

---

## 13. Slices, revised

**Slice 1: Feedback lifecycle** (one branch, M–L)
- Schema: the columns and status enum above (one Drizzle change; production push through the
  `cloud-db-change` skill on your word only)
- Form: category `Select`, a "include technical context" `Checkbox` listing exactly what is
  sent (version, area, error reference), server-filled `app_version`, `route_id` from the band
  and error page
- Owner link for signed-in users + `/account/feedback` ("My feedback") + per-user limit
- Admin: status/category filters, triage actions (defer, accept, close with reason, duplicate
  of), duplicate suggestions, `triage_note`, audit events; remove the auto-mark-read
- Privacy export/erasure; `docs/naming.md` entries; i18n; pglite tests for every transition;
  a Playwright check of the form and the inbox

**Slice 2: Gates and handoffs** (one branch, M)
- `feedback.development` table + one-active index
- Gate 1 form + development brief generator (snapshot-tested), record implementation form
- Gate 2 + release handoff + mark released (deploy SHA check)
- `squash-into-main.sh --expect-sha` + `ship` skill step + `shipping.md` row

That completes the semi-autonomous lifecycle with zero automation spend.

**Slice 3: Routine trigger** (optional, only after you approve it and confirm usage credits
are off): one server-only `fetch` from the Gate 1 action, a fire token in Vercel env, the
session URL stored on `development`, the manual brief kept as fallback.

**Slice 4: Pattern:** a registry entry ("request-driven development", depending on feedback,
admin audit and ship), generated pages, MCP excerpts. Adoption notes for Densho/LYNXware: the
state table, the partial unique index, the two text templates and the SHA-bound ship guard are
stack-neutral.

---

## 14. Answers to the ten review questions

1. **Existing infrastructure:** feedback form/domain/table/admin inbox, abuse stack, admin
   guard, audit log, deploy SHA, ship script/skill, secret-less cloud sessions (§1).
2. **Reuse directly:** all of the above, plus Postgres FTS for duplicates.
3. **Genuinely new:** category/owner/version/route/error columns, the lifecycle enum, the
   `development` table and index, two text templates, "My feedback", `--expect-sha`.
4. **Omit:** §12.
5. **Zero cost:** nothing new calls a paid service; no deps, crons, workers or keys.
6. **Allowances:** one row per submit, the existing limiter, one active development item, and
   agent sessions started only by hand.
7. **Gates:** admin server actions with SQL-checked from-states, audit events, Gate 2 bound to
   a SHA, the ship guarded by `--expect-sha` and still requiring ApeDevil's own message.
8. **Handoffs:** two generated texts pasted into an existing session; results come back by
   pasting branch, SHA and report.
9. **GitHub Issues:** no.
10. **Automatic agent start:** not justified yet; routines are the only zero-cost candidate,
    deferred to Slice 3 behind your check of usage credits.

## 15. Decisions for ApeDevil

1. Keep the domain name `feedback` (recommended) or rename it.
2. On account erasure, delete the user's feedback (recommended) or keep it anonymized
   (`set null`; but the body may contain personal text).
3. Approve Slice 1 to start.
