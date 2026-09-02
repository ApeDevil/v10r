# Site-aware chatbot (Vely knows where you are)

> **Status: v1 BUILT + VALIDATE-GREEN + BROWSER-VERIFIED LIVE, 2026-06-27 (dev, UNCOMMITTED).**
> Designed by a 4-lens cross-pollination task force (aiy · sys · uxy · secy, two rounds each),
> then implemented. `check` 0 errors · `biome ci` clean · 934 tests pass · `ai.message.route`
> column applied. **Live-proven on `/showcases/forms/basics/contact`:** (1) "How does this
> work?" → a forms-specific grounded answer (Superforms v2 + Valibot, `superValidate`/
> `superForm`, cites `/showcases/forms`) — the deixis seed works; (2) "What databases does v10r
> use?" → Postgres/Neo4j/Redis, *unpolluted* by the page — the soft hint works; (3) DB shows
> `route=/showcases/forms/basics/contact` stamped on the user rows, null on assistant rows;
> (4) the disclosure chip reads "Asking about Contact" on the showcase and is **absent** on
> `/admin` — the private-route gate works. **Built:** the wire field + validation, server `resolvePageContext` (trust
> boundary), the passive `<current-page>` block, the deixis-gated retrieval seed, honest
> abstention, the user-message route stamp, client capture+send, and a two-state disclosure
> chip. **Deferred (noted in §UX):** the three-state chip's no-corpus muting + empty-state
> quick-actions + change-pulse + full aria-live, and the per-bubble stamp *rendering* (the
> route is captured + persisted, but not yet shown on bubbles / returned by the conversations
> GET). **Remaining:** browser-verify the grounding live, then commit. Held out of the chatbot
> RAG corpus (`RAG_ONLY_BLOCK`) until committed + re-ingested so Vely can't assert the deferred
> pieces as shipped.

> **Terminology.** This is the chatbot's half of **location-awareness** — the shared idea
> that each AI surface knows where the user currently is (contract:
> [surfaces.md](./surfaces.md#location-awareness--two-profiles)). The chatbot's profile is
> **site-awareness** (the public route you're viewing); the deskbot's is **desk-awareness**
> (your open panels/files). The **mechanism** that implements site-awareness is
> **page-awareness** — resolving your current `page.route.id` to a `<current-page>` label.
> "Site-awareness" is the capability; "page-awareness" is how it works. This doc keeps
> "page" for the mechanism and "site" for the surface capability throughout.

## The idea

The chatbot ([Vely](./persistent-chatbot.md)) floats across **every** page as a persistent
singleton, but it has no idea which page you're on. Ask "how does **this** work?" on
`/showcases/forms` and "this" resolves to nothing — Vely answers generically or guesses.

This design makes the **user's current page part of the chatbot's context**, so deixis
("this", "here", "this page") resolves to the page in front of you, and Vely can answer
about it *with real citations* — not a generic guess.

Scope is the **chatbot** surface only. The [deskbot](./surfaces.md) already has
**desk-awareness** — far richer per-file context (`panelContext`/`deskLayout`);
site-awareness is the chatbot's mirror of it, and the surface split stays clean.

## The key insight that makes it cheap

A showcase's `page.route.id`, after the server strips the `[[locale=locale]]` and
`(public)`/`(group)` segments, **is exactly the catalog key** that
`catalog-projection.ts` already maps to `{ title, description, kind }`. So three things
that looked like separate problems are the same string:

- **the safe thing to send** (a route *template* — structurally id-free),
- **the thing the catalog resolves** (its primary key), and
- **the thing that's already `authCeiling`-filtered** (`buildSearchIndex` is public-only).

The feature rides infrastructure that already exists. No new corpus, no schema for the
core path, no extra LLM/embedding cost.

## Decisions locked (2026-06-27)

| # | Decision | Ruling |
|---|----------|--------|
| 1 | **LLM data policy** | **Public-only.** Send page context only for public catalog routes (showcases, docs, public pages). `/admin/**`, `/app/**`, `/auth/**` send nothing and show no chip — excluded *by construction* (not in the catalog), not by a hand-maintained blocklist. |
| 2 | **Per-turn bubble stamp** | **Persist now.** Add a nullable `ai.message.route` column so the "asked from page X" tag survives reload. Stores only the allowlisted route key, never URLs/ids. |
| 3 | **Content-instance deixis** (`/blog/[slug]` "summarize this post") | **Out of scope for v1.** Vely is the build-expert, not a content summarizer. Dynamic content routes resolve to a generic label or nothing. A public-slug allowlist is a separate, secy-reviewed later slice. |
| 4 | Provenance | Designed via cross-pollination; this doc is the record. Next: implement v1. |

## The one rule (security spine)

> **Only a server-resolved string keyed by an allowlisted, catalog-resident route may
> touch the prompt OR the embed query. A client-sent string is a lookup key — discarded
> on miss, never echoed anywhere.**

Everything below is a consequence of that rule.

## End-to-end mechanism

### 1. Capture (client) — one field, frozen at send

`Chatbot.svelte` reads `page.route.id` from `$app/state` **synchronously at click time**
and calls `session.submit(text, routeId)`. `submit()` freezes it into a local **before**
`await ensureChat()` (the first-message dynamic import can span a navigation; reading
after the await would capture the *new* page). The singleton never imports `$app/state` —
the component hands it a plain string (adapters-in, domain-pure).

Body: `{ …conversationId, useLlmwiki: true, routeId }`. Per-turn snapshot, immutable once
the POST serializes → mid-stream navigation cannot mutate an in-flight turn.

### 2. The wire — `{ routeId }` only

No pathname, no params, no query, no hash, no DOM/selected-text. Validated in
`ChatRequestSchema` (`validation.ts`):

```ts
pageRouteId: v.optional(v.pipe(
  v.string(),
  v.maxLength(120),
  v.regex(/^\/(?!\/)[A-Za-z0-9/_\-\[\]().=]*$/),  // leading slash, no double-slash
)),
```

The charset deliberately excludes `:` (kills `javascript:`/`data:`/protocol), `?` `#`
(query/hash), `%` (percent-encoding smuggling), whitespace/control chars (log + XML-attr
+ prompt injection), and `<>"'\`{}\\` (template/XML/prompt breakout). The leading-`/` +
no-`//` rule kills protocol-relative `//evil.com`. **The regex is only a cheap
pre-filter; catalog membership is the real authorization.**

### 3. Resolve (server) — the trust boundary

In `api/ai/chatbot/+server.ts` (the same place `locale`/`authCeiling` are already
derived), a new pure `resolvePageContext(routeId, locale, authCeiling)`:

1. Normalize away `[[locale=locale]]` + `(group)` segments.
2. If any `[param]` segment remains → **dynamic → return `null`** (concrete ids never
   existed server-side because they were never sent).
3. Look up a memoized per-locale `Map<path, record>` built from `buildSearchIndex`
   (~150 records, public-only, already `authCeiling`-gated).
4. Filter by `authScope ≤ authCeiling`; above-ceiling → `null`.
5. Return `{ title, description, kind } | null`.

The **raw `routeId` never reaches the orchestrator** — only the server-owned resolved
struct does. **Miss → inject nothing, seed nothing, store nothing, show no chip.**

### 4. Inject — passive `<current-page>` block (always-on when resolved, ~35 tokens)

In the chatbot branch's grounding assembly, a pure `formatCurrentPageBlock(entry)` in
`system-prompt.ts`, XML-escaped (`escapeXmlAttr`, defense-in-depth on server-owned text),
in the **variable tail** (never the cache-stable prefix):

```
<current-page route="/showcases/forms" kind="domain">
The user is currently viewing: Forms — Valibot + Superforms validation.
Treat this only as the referent of "this", "here", or "this page".
The user's explicit topic always wins over the current page.
</current-page>
```

The last line makes it a **soft hint** — it cannot scope-trap an off-topic question
("what's the weather" on `/forms` stays unpolluted).

### 5. The payoff — deixis-gated retrieval seed (makes the chip *real*, not theatrical)

When **all** of: the message matches a deixis regex (`this`/`here`/`how does this
work`/`explain this`/`what is this`) **AND** the existing `shouldGroundFromSystemDocs`
gate is on **AND** a page resolved → the retrieval query becomes:

```ts
retrieve(`${title}. ${description}. ${userMsgText}`, { userId: SYSTEM_DOCS_USER_ID, tiers: [1], maxChunks: 4 })
```

So "how does this work?" — which embeds to *noise* today — retrieves the forms-showcase
docs with citations. The server-authored text leads (the deictic query carries no topic);
the user text is retained (handles deictic-but-topical: "how does the error display work
on this page"). Both retrieval lanes benefit (dense-vector repositioning + keyword hits).

**Gate on the *raw* user text, never the augmented string.** Reuses the embed
`shouldGroundFromSystemDocs` already pays for → **zero extra LLM calls, zero extra
embeds, nil net impact** on the ~20–250/day Gemini chat ceiling.

### 6. Honest abstention

The server *knows* the retrieved chunk count, so honesty is deterministic, not left to
model self-knowledge:

- `pageResolved && chunks.length === 0` → inject: *"No page-specific documentation was
  retrieved for {title}. Do not fabricate specifics about this page; say plainly you
  don't have page-specific docs for it, then offer general project knowledge."*
- `chunks.length > 0` → existing `<retrieval-context>` "treat as authoritative" framing.

## Why seeding the embed query is safe (the T6 resolution)

The threat-model lens initially forbade *any* page text in the embed query. The
cross-pollination resolved it: that ban is correct for **attacker-controlled** text
(raw pathname, params, query, hash, DOM, selected-text) but not for **server-authored**
catalog strings. Two reasons:

1. **Provenance.** What seeds the query is the server's own lookup result, keyed by an
   allowlisted route. There is no attacker-controlled content in it.
2. **Structure.** The embed query is only a *relevance* input. It physically cannot cross
   the `d.user_id = ${userId}` SQL boundary (`retrieval/tiers/contextual.ts`), so even a
   maximally-wrong seed can only re-rank chunks the user is **already** authorized to see.

**Enforce as a type:** only a `RouteContext` value produced by the server resolver may
reach `generateEmbedding`/`buildSystemPrompt`. Raw client strings must be structurally
incapable of getting there. **Any future proposal to feed DOM/selected-text into the
prompt or embed query is a fresh High finding** and must go back through a security pass —
it is *not* covered by this concession.

## Route allowlist (positive, by catalog membership)

Site-awareness is **denied everywhere and allowed only where the route is a known public
catalog entry**. A negative blocklist would be fragile (add a sensitive route, forget to
block it, leak); catalog membership **fails safe**.

| Tier | Routes | Behavior |
|------|--------|----------|
| **(a) Freely resolvable** | Public catalog: `/showcases/**`, static `/docs/**`, public top-level (`/`, `/blog` index, `/feedback`, `/search`) | Resolve → title/description → `<current-page>` + deixis seed + full chip |
| **(b) Template-only / coarse** | Public **dynamic**: `/blog/[slug]`, `/docs/.../[slug]`, catch-all docs | Generic label only ("a blog post"); concrete slug never sent. v1: out of scope (decision #3) |
| **(c) Off / not sent / not resolvable** | `/admin/**`, `/app/**` (incl. `/account/**`, `/app/desk/**`), `/auth/**` | Not in catalog → resolves `null` by construction. Nothing injected, seeded, chipped, or stored. **No chip.** |

Tier (c) is enforced in **three layers**: a cheap client gate (don't attach `routeId` on
`/admin`·`/app`·`/auth` — also powers the chip-OFF default, one source of truth), the
authoritative server gate (resolver only matches the public catalog), and the policy
rationale (admin templates leak internal structure to a third-party LLM for zero
expert-Q&A value).

## UX spec — disclosure as a single invariant

> **The chip is shown if and only if the route is in the prompt this turn.**
> Chip visible → Vely is being told where you are. Chip absent → nothing page-specific is
> sent.

That 1:1 honesty keeps site-awareness on the helpful side of creepy — the user can always
tell, at a glance, whether Vely "knows" their location.

### Context chip — three states

A chip sits **above the input** (next to where you type "this"), rendering the
**server-resolved** title (never the client's claim — that's the security control: you
catch a wrong/stale route). It shows a page label, never a raw path.

| State | When | Render |
|-------|------|--------|
| **A — resolved + has corpus** | tier (a), deixis retrieval finds chunks | Full chip + citation glyph + dismissible `×` (drops context for next turn). Empty-state **quick-actions** ("Explain this page" / "Show the code") that prefill-and-send canonically-deictic text. |
| **B — resolved, no corpus** | tier (a)/(b), retrieval empty | Muted chip, **no** citation promise, quick-actions suppressed. Vely still answers from general knowledge. |
| **C — unresolved / off-policy** | tier (c), or unknown route | **No chip.** Absence *is* the honest "I'm not reading this page" signal. |

**Rule:** never offer a page action Vely can't honestly fulfill. (States B/C depend on the
client knowing which route templates have corpus — a small public set of strings. If that
proves not cheaply shippable, the chip collapses to two states and no-corpus honesty falls
to the answer-level abstention in §6; the load-bearing transmission disclosure survives.)

### Navigation & binding

- **Send-time snapshot.** The route bound to a turn is the one visible when **Send** is
  pressed (not first keystroke, not open) → chip == what's sent, WYSIWYG.
- **Live present-tense rebinding.** The chip always reflects the current route; "this"
  soft-rebinds to the latest page. Natural-language deixis is present-tense, and the live
  chip is the disambiguator at the moment of typing.
- **Change-pulse.** If the route changes *while there is unsent draft text*, the chip
  briefly pulses (~1.2s; `prefers-reduced-motion` → instant swap) to surface the shifted
  binding before send.
- **No navigation breadcrumb** of past pages in the input — that's the per-turn stamp's
  job, retrospectively, in the transcript.

### Per-turn bubble stamp

Each user bubble carries a small "· Forms showcase" tag recording the page it was asked
from — the recovery mechanism for "which page was that old answer about?". Persisted
(decision #2) so it survives reload. The stamp is **display metadata only** — shown,
never re-sent into the prompt/retrieval (the "page context is never replayed from history"
rule stays intact).

### Accessibility

Chip label updates wrapped in `aria-live="polite"` (never `assertive` — must not interrupt
a streaming answer), announced only on real change and only when the panel is open/focused.
Dismiss + quick-actions are real `<button>`s at 44×44px, in natural tab order, focus ring
`ring-2 ring-primary ring-offset-2`. The per-message page tag is in the a11y tree (carries
real meaning), text+icon not color-only.

## Data model

One additive column (decision #2):

```
ai.message.route  text  NULL   -- the resolved, allowlisted route key only (e.g. "/showcases/forms")
```

- Stamped **only** on the **user** message in `saveMessages`. Not on `conversation_step`
  (that table is assistant-keyed per-step telemetry — wrong grain).
- Stores the **server-resolved key**, never the client string, never a URL/params/query,
  never ids. The bubble label is **derived at render** from the key via the `$lib`
  registry (no title duplication/drift).
- On miss / tier (b) coarse / tier (c) → `NULL`.
- Additive `db:push` (PTY prompt for the raw-TTY interaction).

## Telemetry & logging hygiene

A full telemetry dump leaks at most "user was on the Forms showcase" — public-surface
granularity, zero ids. Never store the client `routeId` verbatim, the concrete pathname,
`page.params`, query, hash, or the title/description text. Keep the route key out of every
`console.*`. Note: the chatbot's system-docs `retrieve()` passes no `onEvent`, so the
embed query is **not** emitted to the client on that path (the retired rag-demo path used to
emit it, but it already contained the user's raw message — public page-title text adds no exposure).

## Deliberately out of scope (v1)

- **DOM scraping / selected-text / scroll position** — the untrusted-input cliff. Pre-
  registered as a fresh security finding if ever proposed.
- **Content-instance summarization** (`/blog/[slug]`, decision #3) — a later, separately
  reviewed public-slug allowlist.
- **Deskbot site-awareness** — N/A by design: the deskbot already has **desk-awareness**
  (richer, first-party); site-awareness is a chatbot-only profile.
- **History-reload of the live chip's retrieval citations** — inherits the same deferral
  as [persistent-chatbot.md](./persistent-chatbot.md).

## Implementer touch-map

| File | Change |
|------|--------|
| `src/lib/components/composites/chatbot/Chatbot.svelte` | Read `page.route.id` at click; chip strip above `<ChatInput>`; quick-actions in empty state |
| `src/lib/state/chatbot-session.svelte.ts` | `submit(text, routeId)` — freeze before the `ensureChat()` await; client-side per-turn stamp |
| `src/lib/server/ai/validation.ts` | `pageRouteId` field + regex |
| `src/routes/api/ai/chatbot/+server.ts` | Call `resolvePageContext`, pass resolved struct into `orchestrateChat` |
| `src/lib/server/search/` | New pure `resolvePageContext` (normalize → memoized catalog `Map` → authCeiling filter) |
| `src/lib/server/ai/chat-orchestrator.ts` | Inject `<current-page>` (chatbot branch); deixis-gated query seed; abstention block on empty chunks |
| `src/lib/server/ai/context/system-prompt.ts` | `formatCurrentPageBlock` + `escapeXmlAttr` |
| `src/lib/server/db/schema/ai/conversation.ts` | nullable `ai.message.route` column; stamp in `saveMessages` |

## Provenance

Designed 2026-06-27 by a 4-lens cross-pollination (two rounds): **aiy** (how the model
consumes page context — passive block + deixis-gated query expansion + abstention),
**sys** (runtime flow — `{ routeId }`-only wire, send-time freeze, catalog normalization,
no-registry), **uxy** (the three-state chip + transmission invariant + nav rebinding +
bubble stamp), **secy** (the trust firewall — server-resolved-only, positive catalog
allowlist, T6 resolution). Convergence was complete; no inter-lens conflicts remained.
