---
name: Admin Phase 3 UX Specification
description: Detailed UX design for Analytics, Notifications, and Broadcast Announcements pages plus user-facing announcement banner (Phase 3 of admin expansion) — Wave 2 refinement with cross-agent findings
type: project
---

Phase 3 admin expansion UX design. Builds on Phase 1 & 2 patterns established in audit, flags, users, and jobs pages.

**Why:** Analytics + Notifications + Announcements are the "visibility" tier — they make the system legible to the admin and to users.

**How to apply:** Use as the design contract when implementing individual Phase 3 pages.

---

## Established Patterns (from Phase 1 & 2 — do not deviate)

- **Page wrapper**: `Stack gap="6"`, each section in a `Card`
- **Card header**: `Cluster justify="between" align="center"` with `h2 text-fluid-lg font-semibold`
- **Refresh button**: always top-right, `variant="outline" size="sm"`, `i-lucide-refresh-cw` icon
- **Expandable detail rows**: single `$state<id | null>` toggle — audit and jobs both use this pattern
- **Relative time**: `timeAgo()` with `title` attribute for ISO absolute timestamp
- **Empty states**: `EmptyState` composite with `icon`, `title`, `description`, optional CTA
- **Status indicators**: `Tag` component variants (`success`, `warning`, `error`, `secondary`)
- **Inline health dots**: 8px circle, `background: var(--color-success/error/muted)`
- **Error expansion**: `color-mix(in srgb, var(--color-error) 8%, transparent)` background on error detail rows
- **Skeletons**: shape-matched `Skeleton` inside the Card's await-pending block

---

## 1. Analytics Page (`/admin/analytics`)

### Mental model

This is a personal ops dashboard, not a product analytics suite. The admin is checking:
1. "Is traffic normal?" (trend, not precision)
2. "What are people actually visiting?"
3. "Do I have consent coverage problems?"
4. "Who's actively using the app right now?"

These are 4 distinct questions with different urgency. Headline cards answer 1 and 4 immediately. Charts answer 2 in detail. The consent breakdown answers 3.

### Information hierarchy

**Level 1 — Headline stat cards (4 cards, 2x2 grid on desktop, 1 column mobile)**
Each card: big number + label + sparkline (7-day or 30-day trend) + delta badge (↑ vs previous period).

Cards:
- "Pageviews today" — today's total vs yesterday (delta %)
- "Pageviews this month" — MTD vs last month same period
- "Active users (7d)" — unique visitors in past 7 days
- "Consent rate" — % of visitors who accepted cookies (warn if < 50%)

Use `Sparkline` component (already exists, accepts `number[]` and `type='area'`). The delta badge uses `Tag` variant `success` for positive, `warning` for negative, `secondary` for flat.

**Level 2 — Trend chart (full width)**
LineChart showing daily pageviews for the selected range. X-axis: dates. Y-axis: pageviews. Single dataset. No legend needed (single series).

Title: "Pageview Trend" with the date range shown in muted text to the right.

**Date range selector**: NOT a calendar picker — use a segmented control (anchor links, same pattern as the Jobs page filter bar: `.filter-link` / `.filter-link.active`). Options: "7d", "30d", "90d". Default: 30d. This is URL-as-state: `?range=30d`. No custom date range — custom ranges would add complexity for a single-admin tool that doesn't need precision audit.

**Level 3 — Two-column lower section (stacks to single column on mobile)**
Left: "Top Paths" table — path, views, % of total. Max 10 rows. No pagination. Simple table (not the canonical sortable table — no need here, it's a read-only top-10).

Right: "Consent Breakdown" — DiagGrid (not PieChart). Diagnostic data, not exploration. Three rows: Accepted / Declined / No decision, each with count and percentage.

### Consent caveat: ambient, not repetitive (Wave 2 refinement)

All analytics numbers are qualified by consent coverage. The challenge: showing this context without it becoming visual noise on every number.

**Solution: single persistent caveat line, not per-card annotations.**

Place one line immediately below the headline cards row, before the range selector. Muted text, `text-fluid-sm`:

> "Counts reflect consented sessions only. Consent rate: 74% — 26% of traffic is untracked."

This line is always visible and always current. The specific consent rate number in that line updates with the range selector (it's derived from the same data). Color the percentage: `text-warning` if consent rate < 60%, `text-error` if < 40%, `text-muted` otherwise.

This approach: one caveat, seen once on load, remains in view during scroll to charts. Never repeated on individual cards. If the admin wants detail, the Consent Breakdown section below has it.

Do NOT add footnote markers (`*`) or info tooltips to individual cards — that trains admins to ignore the markers.

### Streaming load strategy

Follow DB Observation's `{#await data.promise}...{:then}` pattern. Load order:
1. **Eager** (no await): date range, page metadata
2. **Fast streaming**: headline stats (single aggregate query)
3. **Deferred**: trend chart data (potentially heavier query), top paths, consent breakdown

Each deferred block gets a shape-matched skeleton in its pending state.

Neon connection pressure note: analytics runs against aggregate tables (`daily_page_stats`), not raw events — query cost is predictable. Do not eagerly fire multiple independent queries in parallel; use a single aggregate query that returns all headline stats together, then a second query for chart data. Two queries max per page load.

### Date range — where it lives

The date range control sits between the headline cards (plus the consent caveat line) and the trend chart. It controls the chart and the lower section but NOT the headline cards (today/MTD are always absolute). This separation is intentional — the admin can scan "is today normal" without the range control affecting the answer.

---

## 2. Notifications Page (`/admin/notifications`)

### Structure: sections not tabs (Wave 2 refinement)

Wave 1 suggested internal Tabs ("Delivery" / "Announcements"). Wave 2 rejects this.

**Reason**: Channel health cards must remain visible regardless of what the admin is inspecting. If channels are in a "Channels & Delivery" tab, an admin reviewing the delivery log loses sight of the health summary when they switch to the Announcements tab. Health is ambient — it should persist.

**Revised structure**: a single scrolling page with three sections in `Stack gap="6"`:
1. **Channel Health** — always visible at the top, compact cards grid
2. **Delivery Log** — canonical table below health
3. **Announcements** — full compose + active list, at bottom

On mobile the Announcements section stacks naturally. The health cards are always at the top, which means an admin who loads `/admin/notifications` gets an immediate "system healthy / not healthy" read before doing anything else.

This page will be long. That is acceptable — the admin is using it for a specific task (check health, inspect a failure, or publish an announcement). Sectioned scrolling beats tab-switching for infrequent admin use.

**Visual separator** between Delivery Log and Announcements: `<hr>` with `border-color: var(--color-border)` and generous vertical margin.

### Channel Health Card — 4-state model (Wave 2 refinement)

Wave 1 defined 4 states (Connected, Degraded, Down, Not configured). Wave 2 adds precision on the "Dead" state that scout identified, and clarifies the distinction from "Down".

**5 states** (the 4 wave-1 states plus an explicit Dead state):

| State | Tag variant | Dot color | Meaning | Recovery |
|---|---|---|---|---|
| **Healthy** | `success` | `--color-success` | Last delivery recent and successful | N/A |
| **Degraded** | `warning` | `--color-warning` | Slow responses, or > threshold since last success | Admin attention, not emergency |
| **Down** | `error` | `--color-error` | Last delivery failed, webhook may be alive | Retry possible |
| **Dead** | `error` | `--color-error` | Webhook 404 (Discord) or silently disabled (Telegram high pending_update_count) | Manual intervention required — no retry |
| **Not configured** | `secondary` | none | Env vars missing | Configure in .env |

"Down" and "Dead" use the same color because both are error states. They differ in the action they imply.

**Distinguishing Dead from Down**: Dead channels show a distinct message instead of a retry button. The channel card footer reads:
- Down: "Last attempt failed · [error message]" + `[Send test]` button
- Dead: "Dead — manual intervention required" (no retry button, no test button) + a link `[How to fix]` that opens an inline info callout explaining the specific dead channel type (e.g. "This Discord webhook no longer exists. Create a new webhook and update DISCORD_WEBHOOK_URL.")

The "Dead" determination is a server-side classification: HTTP 404 from Discord = Dead. Telegram `pending_update_count` > 100 without a recent success = Dead.

**Telegram-specific**: Show `pending_update_count` as a metric on the Telegram card when it's elevated. "Pending updates: 247" in `text-warning` color. This is the early warning signal scout identified.

### Delivery Log — Needs Attention section (Wave 2 refinement)

Wave 1 used a single filterable table. Scout confirmed the master-detail pattern is standard, but adds that "Dead" entries need a separate "Needs Attention" section ABOVE the main log.

**Revised delivery log layout**:

```
[Needs Attention]   ← only shown when dead/unresolved failures exist
[Delivery Log]      ← filterable canonical table
```

**Needs Attention** is a non-scrollable card (shown above the delivery log card) with a `Tag variant="error"` in its header. It lists only entries that represent permanently failed or unresolvable deliveries — specifically:
- Webhook Dead (404) entries
- Entries that have exhausted all retry attempts (max retries hit, still failing)

Each row in Needs Attention is compact: channel icon + "Webhook dead as of [timestamp]" + "Mark resolved" action button. "Mark resolved" is an optimistic update that moves the entry out of this section (admin acknowledges they've read it and are handling it). It does not delete the delivery log entry — just removes it from the attention queue.

When Needs Attention is empty: hide the section entirely. Do not show "All clear" — empty sections are cleaner than confirmations.

**Main delivery log columns** (revised from Wave 1 using scout's standard):

| Column | Width | Notes |
|---|---|---|
| Timestamp | auto | relative + absolute in `title` |
| Channel | 120px | Tag with channel name |
| Event type | auto | what triggered the notification |
| HTTP Status | 80px | code only (200, 404, 500) |
| Latency | 80px | Xms |
| Attempt | 60px | attempt number when retried |
| Status | 90px | Tag `success`/`error`/`dead` |
| Detail | 60px | expand toggle |

Expandable row: inline detail spanning full width, same `color-mix(in srgb, var(--color-error) 8%, transparent)` background for error rows, neutral for success rows. Shows full error message, request/response bodies if logged.

**Filter bar**: channel (select), status (all/success/failed/dead), date range. Same GET form + anchor pattern as audit log.

**Discord 50007 per-user errors**: Do NOT surface in the main delivery log as channel-health issues. These are user-state failures (user has blocked the bot or left the server). If logged, they appear in the delivery log with status "failed" and a distinct error code "50007 — User not contactable." They do NOT trigger the Needs Attention section. The channel card stays Healthy when 50007s appear — they are not channel failures.

### Announcements section (within Notifications page)

**Layout**: two-column on desktop (`grid-template-columns: 1fr 1fr`), stacked on mobile. Compose form left, active list right.

**Section header**: `h2 text-fluid-lg font-semibold` reading "Announcements" — same header pattern as the Channel Health section above it. This visually separates it as a named section, not a tab.

---

## 3. Broadcast Announcements — Compose Form

### Compose form

Left column (or full width on mobile):

**Title field**: Input, required, max 120 chars. Show character count as muted text below: "87 / 120".

**Body field**: Textarea, required. Helper text: "Plain text. No markdown."

**Severity selector**: Segmented control rendered as 3 radio buttons styled as a button group. Each option shows its color identity:
- "Info" — neutral/primary
- "Warning" — warning color
- "Critical" — error color

Implement as hidden radio inputs + styled labels. Use Bits UI RadioGroup. No raw `<input type="radio">` visible.

**Scheduling (starts_at / ends_at)**: Two date+time inputs in a row labeled "Active from" and "Until". Both nullable. Helper text: "Leave blank to activate immediately / keep active until manually deactivated."

**Live preview**: Below the form, a preview section with a subtle separator. Label "Preview" in muted uppercase. Renders using the same `AnnouncementBanner` component used in the shell. Purely `$derived` from form state — no server round trip.

**Submit button**: "Publish" for new, "Save changes" for edit. Disabled while submitting.

### Publish as background job — post-submit state (Wave 2 refinement)

Archy confirmed that "send to all users" fan-out is a background job. The admin pressing "Publish" does NOT wait for delivery to complete. The UX must communicate this correctly.

**What the admin sees after clicking Publish**:

1. Button shows loading state: "Publishing..." with spinner (uses `$submitting`)
2. Server creates the announcement record and enqueues the fan-out job — fast response (< 200ms)
3. On success, the compose form clears, the active announcements list refreshes
4. A toast appears: "Announcement published. Delivering to users in the background."
5. The new announcement card in the active list immediately shows with a "Delivering..." badge (Tag variant `secondary`, text "Delivering") next to the dismiss stats

**Delivery progress on the announcement card**:

The announcement card in the active list shows delivery progress as a passive indicator:
- While job is running: "Delivering to users..." in muted text where dismiss stats would appear
- After job completes: "X dismissed / Y active users" (dismiss stats)
- If job fails: "Delivery failed — [Retry delivery]" link in `text-error`

The progress updates on page refresh (no polling). Refresh is manual via the Refresh button in the card header. There is no live polling — see architecture decision on SSE (Vercel serverless limits).

**Why no progress bar**: a background job that sends N notifications is not a task the admin is waiting on. They publish and move on. Progress bars imply "wait here." A passive status on the card is appropriate — the admin checks back if curious.

---

## 4. Broadcast Announcements — Active List

Right column (or below compose on mobile). Title: "Active (N)" — count updates live on publish via `invalidateAll()`.

Each active announcement rendered as a compact card (same `.flag-card` pattern):
- Title in semibold
- Severity Tag (top-right corner of card)
- Body preview (truncated to 2 lines, `overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2`)
- Muted metadata row: "Published Xm ago · Expires in Xh" or "No expiry"
- Delivery status or dismiss stats: "Delivering..." or "12 dismissed / 89 active users" or "Delivery failed — [Retry delivery]"
- Actions row: "Edit" (ghost button, populates compose form) + "Deactivate" (ghost button, `ConfirmDialog`)

**Deactivate** uses `ConfirmDialog` — consequence (all users lose the banner) warrants one confirmation.

---

## 5. Critical Announcements — Non-dismissible UX (Wave 2 refinement)

Both resy and scout confirm: critical announcements must not be dismissible by users. GitHub and Vercel both use this pattern. The server-side `active` flag is the only way to remove them.

**What changes for critical announcements in the user-facing banner**:

1. No dismiss button. The `x` button is absent entirely.
2. The banner has a left border `4px solid var(--color-error)` (already in Wave 1 spec) — this visual treatment signals "this is not closeable" without any text.
3. The banner ends with a link: "Learn more" if the announcement body references an action, or nothing.

**What admins see in the Announcements compose form for critical severity**:

When "Critical" is selected in the severity segmented control, an inline callout appears below the severity control (not a modal, not a toast — inline, immediate):

> "Critical announcements cannot be dismissed by users. They will remain visible until you deactivate this announcement."

This is a `Alert variant="info"` rendered inline between the severity control and the scheduling fields. It appears/disappears reactively as severity changes (`$derived` from form state). It does not block submission.

**What admins see in the active announcements list for a critical announcement**:

The dismiss stats row reads: "Non-dismissible · X active users" instead of "X dismissed / Y active users." The "Deactivate" button is the only removal action.

**Why "non-dismissible" label matters**: An admin who published a critical announcement last month and returns to the page needs to understand immediately why the dismiss count is zero. Without this label they might assume delivery failed.

---

## 6. User-Facing Announcement Banner

### Placement

Inside `AppShell.svelte`, between `<NavigationProgress />` and `<Sidebar>` / main content. Specifically: rendered as a stack of banners at the very top of `<main>`, INSIDE the main content area (not `position: fixed`). The `SessionWarningBanner` already uses `position: fixed; top: 3px; z-index: calc(var(--z-modal) - 1)` — announcement banners must be document-flow positioned to avoid z-index conflicts.

**Data loading**: Shell layout server (`+layout.server.ts`) fetches active announcements for the current user — filtered by `starts_at <= now AND (ends_at IS NULL OR ends_at >= now) AND active = true`, minus already-dismissed ones for authenticated users. Pass as `data.announcements: Announcement[]`.

### Banner component: `AnnouncementBanner`

New component at `src/lib/components/shell/AnnouncementBanner.svelte`.

Props: `announcement: Announcement`.

Visual structure (mimics `Alert` component but full-width):
```
[severity-icon]  [title]  [body]  [dismiss-button or nothing for critical]
```

Full width, no border-radius (edge-to-edge), 1px border-bottom only.

Severity → visual treatment:
- **info**: `--color-info-bg` background, `--color-info-fg` text, `i-lucide-info` icon
- **warning**: `--color-warning-bg` background, `--color-warning-fg` text, `i-lucide-alert-triangle` icon
- **critical**: `--color-error-bg` background, `--color-error-fg` text, `i-lucide-alert-octagon` icon, left border `4px solid var(--color-error)`, NO dismiss button

### Multiple active announcements

Stacked vertically. Order: critical first, then warning, then info. Within same severity: `created_at DESC`. Ordering done server-side.

No carousel, no pagination. Show all active (non-dismissed) announcements.

### Dismissal (info and warning only)

Each non-critical banner has an `x` button (44x44px tap target, `i-lucide-x`). `aria-label="Dismiss: [announcement title]"`.

Dismiss flow:
1. User clicks dismiss
2. Banner animates out immediately (optimistic)
3. POST to `/api/announcements/[id]/dismiss`
4. For unauthenticated users: do not show dismiss at all for critical; for info/warning, store dismissed IDs in a session cookie using the existing consent/cookie infrastructure.

If dismiss POST fails after 3 retries: banner reappears with a very small "Could not dismiss" text below the dismiss button. No toast — a toast for a failed dismiss is more disruptive than the banner itself.

### Accessibility

`role="region"` wrapping the entire banner stack. `aria-label="System announcements"`.

Each banner: `role="alert"` for `critical` and `warning` severity (announces immediately), `role="status"` for `info` (polite).

The dismiss button is the LAST focusable element in the banner (after the content). Tab order: icon region → content → dismiss.

After dismissal: focus moves to the next banner's dismiss button if one exists, or to the first main content focusable element if not. This prevents focus loss (WCAG 2.4.3).

---

## 7. Empty States

### Analytics

- **No data yet**: `i-lucide-bar-chart-2`, "No analytics data yet", "Pageviews will appear here once users visit the app." — no CTA
- **No data for range**: `i-lucide-calendar-x`, "No data for this period", "Try selecting a wider date range." with "7d / 30d / 90d" buttons as CTA links
- **Top paths empty**: inline `<p class="text-muted text-fluid-sm">No paths recorded yet.</p>` — not a full EmptyState

### Notifications

- **No channels configured**: `i-lucide-plug-zap`, "No notification channels configured", "Add webhook URLs to your environment variables."
- **Delivery log empty (no history)**: `i-lucide-send`, "No notifications sent yet", "Delivery history will appear here once notifications are triggered."
- **Delivery log empty (filtered)**: `i-lucide-search-x`, "No deliveries match these filters", "Clear filters" button link
- **Needs Attention section**: hidden entirely when empty (no "all clear" messaging)

### Announcements

- **No active announcements**: `i-lucide-megaphone`, "No active announcements", "Create an announcement to notify all users." — no CTA button (compose form is right there)

---

## 8. Loading States (Skeleton Patterns)

All follow the DB Observation page pattern: skeletons live inside `{#await ...}` pending blocks.

### Analytics headline cards (4 cards)

Each skeleton card:
```
Card header: Skeleton text 6rem (stat name)
Inside: Skeleton rectangular 2.5rem height (big number)
        Skeleton text 4rem (delta badge)
        Skeleton rectangular 24px height 80px width (sparkline)
```

Consent caveat line: show as `Skeleton text 20rem` while headline stats are loading.

### Trend chart

Single card: `Skeleton rectangular height="200px"`.

### Channel health cards

Same skeleton shape as DB Observation provider cards:
```
Card header: icon placeholder + Skeleton text 5rem + Skeleton rectangular (tag)
Inside: Skeleton text 60% + Skeleton text 70%
```

### Delivery log

Show 5 skeleton rows (matches default page size). Each row: cells with `Skeleton text` at varying widths.

### Announcement list

Show 2 skeleton cards at `.flag-card` dimensions.

---

## 9. Error States

### Analytics

- **Aggregate query failed**: `Alert variant="error"` with "Could not load analytics data." + "Try again" button calling `invalidateAll()`.
- **Partial failure** (headline ok, chart failed): Alert inside the chart card only. Headline stats remain visible.

### Notifications

- **Channel health check failed**: Inline `Alert variant="error"` inside the channel card. Include a "Check configuration" hint.
- **Delivery log query failed**: Alert inside the Delivery Log card — "Could not load delivery history." + Refresh button.

### Announcements

- **Publish failed**: Superforms `$errors` surface on fields. Also toast via `getToast().error(...)`.
- **Dismiss failed**: Silent retry x3. If all fail: reappear banner with small "Could not dismiss" below dismiss button. No toast.
- **Background delivery job failed**: passive indicator on announcement card in active list — "Delivery failed — [Retry delivery]" in `text-error`. Admin can trigger re-run.

---

## 10. Accessibility Notes

### Analytics live data

Do NOT use `aria-live` on headline stat cards. They load once on page load (streaming), not on a polling interval. If a Refresh button is added: use `aria-live="polite"` on a visually-hidden status span only after refresh: "Analytics refreshed. Showing data from [date]."

### Status indicators (channel health)

Every status: color AND text (Tag label). The 8px health dot is decorative (`aria-hidden="true"`). Each channel card: `role="region"` with `aria-labelledby` pointing to the channel name `<h3>`.

### Announcement dismissal

`aria-label="Dismiss: {announcement.title}"` on every dismiss button. Without this, screen readers announce just "button" with no context when multiple announcements are stacked.

After dismissal: focus moves to next banner's dismiss button, or to first main content focusable element.

### Segmented severity control (announcements compose form)

`role="radiogroup"` with `aria-labelledby` pointing to "Severity" label. Each option: `role="radio"` with `aria-checked`. Bits UI RadioGroup handles this automatically.

### Date inputs

Visible labels (not just placeholder text). `aria-describedby` linking to helper text.
