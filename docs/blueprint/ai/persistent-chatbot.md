# Persistent / Minimizable Chatbot

> **Status: BUILT + browser-verified, 2026-06-27 (dev, uncommitted).** Converged verdict
> of a 5-lens cross-pollination (sys · svey · uxy · aiy · laly), then implemented across
> all three phases. `bun run validate` green (934 tests). Live-verified the full state
> machine: open (non-modal dock-as-column) → send (grounded answer) → persist across
> navigation → minimize → **minimize-on-link-click** → resume after full reload (DB
> rehydration, zero model calls) → restore → close (destroy).
>
> Two fixes surfaced during browser verification, beyond the original plan:
> 1. **Display conflict** — the panel carried both `flex` and `hidden`; `flex` won the
>    cascade so minimize never hid it. Fixed by making display mutually exclusive
>    (`phase === 'open' ? 'flex flex-col' : 'hidden'`).
> 2. **Internal links opened new tabs** — `renderMarkdown` forced `target="_blank"` on
>    *every* link, so Vely's own `/docs/...` references opened a new tab and never
>    triggered minimize. Now only **external** (`http(s)://`) links get `_blank`;
>    internal/relative links navigate same-tab (SvelteKit-routed) → minimize fires.

## Problem

The "Vely" chatbot loses the conversation the moment you stop looking at it. The
user's scenario: *Vely gives me a link, I open the page, I click into the page — and
the chat closes, taking the live thread with it.* The desired behavior:

- The live conversation is **persistent** — it survives navigation (and reload).
- Following one of Vely's links and engaging the destination page **minimizes** the
  chat (alive, parked) instead of **closing** it.
- The minimized chat surfaces in the **sidebar** via the "Ask Vely" trigger, which
  restores it.

**Mental model:** *Vely stays while you poke around the page you're **on**; Vely steps
aside (still alive) when you **navigate** to a new page; Vely only dies when you
explicitly end it.*

## Root cause (verified in code)

Three independent structural defects:

1. **`AppShell.svelte` (~line 185)** renders the chatbot behind
   `{#if ChatbotComponent && modals.aiAssistantOpen}`. The live thread is
   `const chat = new Chat()` **inside** `Chatbot.svelte` — so closing **unmounts the
   component and garbage-collects the thread** (and aborts any in-flight stream).
2. Open-state lives in the **mutually-exclusive `modals` store** — so opening
   quick-search (Ctrl+K) *already* silently destroys the chat today.
3. It is a **modal** with a full-screen `bg-black/50` overlay + focus trap — the page
   behind is unusable, so "use the linked page" *requires* dismissing (destroying) it.

The fix is structural: **decouple "the thread is alive" from "the panel is visible,"
move the live `Chat` out of component scope, and make OPEN non-modal.**

---

## State machine

A dedicated three-state lifecycle, owned by a **new store — NOT `modals`** (so a
minimized chat coexists with an open search instead of being evicted):

```
                  open() / Ctrl+J / sidebar trigger
   ┌────────┐   ──────────────────────────────────▶   ┌────────┐
   │ CLOSED │                                          │  OPEN  │
   │ (no    │   ◀──────────────────────────────────    │ (non-  │
   │  thread)│        × button only (DESTROY)          │  modal)│
   └────────┘                                          └────────┘
        ▲                                               │   ▲
        │ × / logout (SessionMonitor)                   │   │ restore
        │                                    minimize:  │   │ (trigger /
        │                          nav to new pathname, │   │  bubble /
        │                          — button, Esc, Ctrl+J│   │  Ctrl+J)
        │                          another modal opens  ▼   │
        └──────────────────────────────  ┌────────────────────┐
                                          │     MINIMIZED      │
                                          │ (alive, parked in  │
                                          │  sidebar / bubble) │
                                          └────────────────────┘
```

- **CLOSED** — no live instance, no `conversationId`. Entered only by the explicit
  `×` button or session teardown.
- **OPEN** — non-modal, page interactive. The only state that participates in modal
  mutual-exclusion (a real modal opening demotes it to MINIMIZED).
- **MINIMIZED** — instance + in-flight stream fully alive; surfaced in the sidebar.

`×` (destroy) is the **only** gesture that ends a thread. Esc, navigation,
modal-contention, and page interaction never destroy.

---

## Architecture

### Ownership: a client-only module singleton

The decisive decision (sys initially wanted to hoist the *mount* to the root layout;
svey + aiy argued to hoist the *instance* into a module singleton — **singleton won**,
sys conceded):

`src/lib/state/chatbot-session.svelte.ts` (NEW) owns:

| Field | Notes |
|-------|-------|
| `phase: 'closed' \| 'open' \| 'minimized'` | `$state`, default `'closed'` |
| `chat: Chat \| null` | the live `@ai-sdk/svelte` instance; **`null` until first open** |
| `conversationId` | captured from `X-Conversation-Id`; travels with the instance |
| transport | the `DefaultChatTransport` + `fetch` wrapper move here (the wrapper closes over `conversationId`, so it must live with the instance) |
| `answerReady` | unread flag; set by the singleton's `onFinish` when a turn completes while `phase !== 'open'`; reset on restore |
| `ensureChat() / open() / minimize() / restore() / reset()` | all browser-gated |

**Why the singleton beats root-mount:** ESM module caching makes it survive *exactly*
what root-mounting was for — cross-group `AppShell` remount **and** the
`{#key page.data.locale}` switch — while still letting the heavy view fully unmount
(no "AI SDK bundle on every route incl. marketing/auth" tax, no SSR surface). The
stream lives on the `Chat` instance's `fetch`+reader, **not the DOM**, so mount churn
never affects continuity as long as the instance survives (aiy's load-bearing finding).

The desk `ChatPanel` keeps its own snapshot-cache (`chat-state-cache.ts`, separate
endpoint + lifecycle) — **do not unify** the two in this work.

### View: a projection, not an owner

`Chatbot.svelte` stops calling `new Chat()` and **binds to `session.chat`**. It stays
dynamically-imported in `AppShell` (keeps the AI graph out of the initial payload). It
is free to unmount/remount; on (re)mount it reads `phase` from the singleton and
projects the current state — no open-state flash, even across a group boundary.

Within a group, minimize keeps the view **mounted but CSS-hidden** (`display:none`) so
live tokens keep rendering and restore is an instant repaint; across a group boundary
the view unmounts and the singleton carries the stream until the new view re-binds.
(The `answerReady` flag comes from the singleton's `onFinish` regardless of mount, so
the unread indicator is correct either way — the mounted-hidden choice is purely a
restore-paint nicety and may be simplified to plain unmount if preferred.)

### SSR-safety contract

Module `$state` is shared per-process on the server, so the contract is **the server
never writes it and never branches on it**:

1. Module top-level declares only inert primitives (`phase = 'closed'`, `chat = null`).
   **No `@ai-sdk/svelte` import at top level.**
2. `@ai-sdk/svelte` + `ai` are pulled **only** via `await import()` inside
   `ensureChat()`, whose first line is `if (!browser) return` (`$app/environment`) — a
   dynamic import behind a browser gate never enters the SSR module graph.
3. Every mutator is browser-gated (server no-op). The view that reads `session.chat`
   is client-dynamic-imported. `SidebarTriggers` *does* SSR but reads only the inert
   `'closed'` default → no leak, **no hydration mismatch**.
4. Storage rehydration runs in `AppShell`'s `onMount` (post-hydration), not at module
   init — SSR render === first client render (`'closed'`), then the effect flips it.

### Teardown owner

A module singleton has no component lifecycle, so teardown is **named, not assumed**:
`SessionMonitor` (already mounted in `AppShell` with the live `session`) calls
`session.reset()` on logout / session-expiry → aborts the stream (`chat.stop()`), nulls
the instance, clears the sessionStorage pointer, sets `phase = 'closed'`. This closes a
**real** same-tab user-switch leak (logout → different login without a full reload).

---

## Trigger table (the interaction contract)

| Transition | Gesture / event |
|---|---|
| **open → minimized** | Any internal client-side nav to a **different pathname** (a Vely link, CitationChip, sidebar item, palette result, programmatic `goto`); the explicit **Minimize (—)** button; **Esc** (focus within panel, no sources Drawer open); **Ctrl+J**; another mutually-exclusive modal opening (yield, never die) |
| **stays OPEN (NOT minimized)** | Plain click / scroll / text-select / form-focus on the *current* page; same-page `#hash` jump (same pathname); `target=_blank` / external-origin links |
| **open → closed (DESTROY)** | the **× button only** — nothing else destroys (mid-stream `×` allowed; thread already persisted → recoverable from History; no confirm dialog) |
| **minimized → open (RESTORE)** | sidebar trigger click (desktop) / bubble tap (mobile) / **Ctrl+J** / palette "Ask Vely" — always deliberate; no auto-restore on nav or modal-close |

**Minimize wiring (svey, conceding to uxy):** a **synchronous delegated click handler
on the chat messages container** sets `minimize()` *before* the link navigates:

```
onclick (delegated, on the scroll container):
  if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target).closest('a[href]')
  if (!a || a.target === '_blank' || !sameOrigin(a.href)) return
  session.minimize()          // do NOT preventDefault — let SvelteKit's <a> nav proceed
```

The global `onNavigate` catch-all was **dropped** — the synchronous set beats any
remount, and minimizing on *non-chat* navigations was judged surprising. (Chat links
are plain `<a href>`, so a delegated handler is complete coverage.)

`Ctrl+J` is a non-destructive toggle: closed→open, open→minimized, minimized→open.

---

## Spatial spec

OPEN is **non-modal** (uxy; laly conceded) — the `bg-black/50` overlay + focus trap are
deleted (this also removes the Esc-double-close hack). A new **`z-panel: 25`** token
(between `fab 20` and `overlay 30`) lets a real modal correctly dim the chat.

### Desktop (≥768px) — OPEN = **dock-as-column** (user decision, 2026-06-27)

The panel pins full-height to the right edge and **content reflows** (never overlaps —
avoids covering sticky bottom-right CTAs):

- Panel: `fixed top-0 right-0 h-[100dvh] w-[28rem] max-w-[calc(100vw-var(--sidebar-rail-width))]`,
  `z-panel`, `border-l`; appearance via `data-elevation="2"` (E2 in both modes —
  see the elevation ladder in [design/tokens.md](../design/tokens.md)).
- Main reserves space while open: `md:pr-[28rem]` on the `<main>` content (transition
  the padding; respect `prefers-reduced-motion`).
- The full-height column gives the header ample room for the 4th (**—**) button.

### Mobile (<768px) — OPEN = bottom sheet

`fixed inset-x-2 bottom-0 max-h-[85svh] rounded-t-lg z-panel
pb-[max(env(safe-area-inset-bottom),12px)]`. (`inset-x-2` fixes a real pre-existing
−12px horizontal-overflow bug; `svh` replaces a raw `vh` that slid under the iOS URL
bar.) Dock-as-column does not apply on mobile. The sheet registers as a
`chatbot-sheet` dismissal layer in `$lib/state/layer-stack.svelte.ts`, so Escape
peels anything stacked above it (e.g. the ⌘K palette) before minimizing; the
desktop dock never registers.

### MINIMIZED — sidebar indicators (desktop) / bubble (mobile)

Indicators are **non-color** (shape / numeral / motion; color reinforces only — WCAG
1.4.1). Two meanings: *alive* vs *answer-ready* (a stream finished while minimized).

| Surface | alive | answer-ready |
|---|---|---|
| Desktop **rail** (bot button) | 8px dot, `absolute top-0 right-0`, `ring-2 ring-surface-1`, static | numeral **count badge** `min-w-[16px] h-[16px]` + one-shot pulse |
| Desktop **expanded** pill | dot on icon + one-line preview `text-fluid-xs truncate` + `chevron-up` glyph | preview bolds; chevron → count badge + pulse |
| **Mobile bubble** (48px) | bot icon + 8px corner dot `ring-2 ring-bg` | corner dot → count badge `min-w-[18px] h-[18px]` + pulse ring |

**Mobile FAB collision:** the existing `SidebarFab` is `fixed bottom-4 right-4` (56px,
`z-fab`). The minimized bubble stacks **8px above it**:
`fixed right-4 bottom-[calc(env(safe-area-inset-bottom,0px)+76px)] w-[48px] h-[48px]
rounded-full z-fab` (bubble bottom = 12+56+8 = 76px; both right-aligned at 12px).

**Restore coverage (laly; svey concurs the fix is cheap):** mount the minimized
**bubble at the root layout** (`[[locale]]/+layout.svelte`) reading the **singleton**
(AI-SDK-free — it only reads `phase` and calls `restore()`), so restore works even on
the one authenticated AppShell-less route (`/auth/*`). Suppress the bubble on desktop
AppShell routes (`md:hidden` where the sidebar trigger already serves as restore).

**Tap targets:** the rail trigger is ~30–40px — enforce a `min-h-[44px] min-w-[44px]`
hit area when it carries an indicator. Bubble 48px ✓. On restore, focus lands on
`ChatInput`; the unread badge clears to the alive dot.

---

## Persistence & resume

- **Within-session continuity** (minimize, in-group nav, cross-group remount): the live
  singleton instance — **zero round-trips, zero model calls**.
- **Reload-resume (two steps):** a **sessionStorage** pointer `{ conversationId, userId }`
  (per-tab — localStorage would make two tabs append to one server thread →
  interleaved/duplicate turns). (1) `hydratePointer()` runs in `AppShell`'s `onMount`,
  reads the pointer, and — AI-SDK-free — sets `phase = 'minimized'` + `conversationId`
  to surface the indicator (no DB read, no instance built). (2) On open/restore,
  `#resumeMessagesIfNeeded()` does the owner-scoped `GET /api/ai/conversations/[id]`
  (Postgres) → assigns `chat.messages`. **No `streamText`, no `generateEmbedding`.**
- **Singleton-precedence rule (load-bearing):** if the singleton already holds a
  non-empty `chat`, bind to it and **skip** the DB read. Only a `null` singleton (fresh
  module post-reload) reads storage → DB. Prevents clobbering a live thread and
  prevents double-restore.
- **No duplicate turns:** the only POST path is the user's explicit
  `submitMessage → chat.sendMessage`. Rehydration is a pure assignment; no mount-time
  `$effect` may call `sendMessage` / `reload` / `experimental_resume`.

## Security (non-negotiable — secy)

`GET /api/ai/conversations/[id]` **must** enforce
`conversation.userId === session.user.id` (403/404 otherwise). The sessionStorage
`conversationId` is client-forgeable — the owner check is the tenant boundary that makes
the whole resume path safe. **Verify the existing endpoint already does this** before
relying on it; add the userId-stamped pointer guard in `ensureChat` as defense in depth.

---

## File-by-file changes

| File | Change |
|---|---|
| `src/lib/state/chatbot-session.svelte.ts` | **NEW** singleton — `phase`, `chat`, `conversationId`, transport, `answerReady`, `ensureChat/open/minimize/restore/toggle/close/newChat/submit/adoptConversation/reset`, `hydratePointer` (all browser-gated) |
| `src/lib/components/composites/chatbot/Chatbot.svelte` | stop `new Chat()` → bind to singleton; non-modal (drop overlay + focus trap → `role="complementary"`); add **—** button; delegated link-click → `minimize()` on the scroll container; desktop dock-as-column |
| `src/lib/components/shell/AppShell.svelte` | gate the view on `phase !== 'closed'` (not `aiAssistantOpen`); `onMount` → `setUser` + `hydratePointer`; main `md:pr-[28rem]` while open; `SessionMonitor` wires `reset` |
| `src/lib/components/shell/SidebarTriggers.svelte` | state-aware: open-or-restore + alive/answer-ready indicator |
| `src/routes/[[locale=locale]]/+layout.svelte` | global minimized **bubble** (reads singleton, AI-SDK-free); `Ctrl+J` toggle moves to `session.toggle` |
| `src/lib/state/modals.svelte.ts` | remove `aiAssistant` from the modal stack (no longer a mutually-exclusive modal) |
| `src/app.html` | add `viewport-fit=cover` to the viewport meta (so `env(safe-area-inset-*)` resolves) |
| `src/lib/styles/tokens.ts` | add `z-panel: 25` |
| `src/lib/components/shell/SessionMonitor.svelte` | call `session.reset()` on logout/expiry |

## Phased implementation

1. **Phase 1 — kill the data-loss bug.** New singleton + lifecycle decoupling; view
   binds to the singleton; close = `×` only; opening a modal minimizes (not destroys).
   Ships the core "conversation no longer dies" win on its own.
2. **Phase 2 — minimize UX.** Non-modal OPEN (dock-as-column desktop / sheet mobile);
   delegated link-click minimize; sidebar indicator + global mobile bubble;
   `viewport-fit=cover` + `z-panel`.
3. **Phase 3 — resume + safety.** sessionStorage pointer + owner-scoped DB rehydration
   with precedence rule; verify/add the `conversations/[id]` owner check; teardown via
   `SessionMonitor`.

## Risks & open items

- **`@ai-sdk/svelte` `Chat` constructed outside any component** (transport + `onFinish`
  in the module) must be supported — high confidence (it's a plain reactive class), but
  validate the in-flight stream keeps draining across a cross-group view unmount.
- **`afterNavigate` focus target** (svey): confirm focus never drops to `<body>` for a
  frame on the link-follow minimize path.
- **`ConsentBanner`** — verify it isn't bottom-fixed full-width (would stack into the
  FAB/bubble/sheet cluster on mobile).
- **Safe-area** math is inert until `viewport-fit=cover` lands; confirm on real iOS.
- **mounted-hidden vs unmount on minimize** — a marginal restore-paint tradeoff, not a
  correctness one (the unread signal is mount-independent). Pick during build.

## Deferred / out of scope

- **`experimental_resume`** (true mid-stream resume after a *hard reload*) — needs a
  server-side resumable-stream registry; the orchestrator has no streamId store today.
  Phase 2-future, not this work.
- **Citation chips on a reloaded thread** — `GET /api/ai/conversations/[id]` returns
  text-only parts, so `catalogSources` / `sourceChunks` chips are absent after a reload
  (the *live* thread keeps them). Fixing needs the endpoint to return parts+metadata.
- **Desk `ChatPanel` convergence** onto this singleton model — separate surface,
  separate lifecycle; leave as-is.

## Related

- [site-awareness.md](./site-awareness.md) — Vely's **site-awareness**: the current public
  route as a thin server-resolved page label, so deixis ("how does *this* work?") resolves to
  the page in front of you. Adds a disclosure chip above the input (public pages only) and
  records the resolved route on each user message (`ai.message.route` column; per-bubble
  rendering deferred). *v1 built (dev, uncommitted).*
- [../app-shell/ai-assistant.md](../app-shell/ai-assistant.md) — the app-shell view of this panel.

## Provenance

Converged via two-round agent cross-pollination, 2026-06-27:
sys (state ownership/lifecycle) · svey (SvelteKit mechanism) · uxy (interaction/a11y) ·
aiy (AI-SDK continuity) · laly (spatial/layout). Deferred to **cony** (all wording:
aria-live strings, trigger label, preview, placeholder) and **arty** (indicator
visuals: dot/badge hue, contrast, pulse).
