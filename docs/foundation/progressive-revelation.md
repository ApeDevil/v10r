# Progressive Revelation (ProgRev)

A foundational UX and architecture pattern that progressively reveals content and features as users demonstrate readiness, reducing cognitive overload while guiding them through the application structure.

---

## Core Philosophy

| Principle | Description |
|-----------|-------------|
| **Gradual revelation** | Show only what's relevant at each stage |
| **User-paced progression** | Advance through explicit actions, not time |
| **Persistent progress** | Resume where you left off, even without an account |
| **Visual history** | Completed stages appear muted, not hidden |
| **Optional depth** | Users can skip or explore freely |

**Anti-goals:**
- Forced tutorials that block content
- Hidden navigation that disorients users
- Progress gates that frustrate experienced users
- Scroll-jacking or time-based triggers

---

## The ProgRev State Machine

ProgRev (Progressive Revelation) operates on two orthogonal dimensions:

```
IDENTITY AXIS (horizontal)
─────────────────────────────────────────────────►
ANONYMOUS      GUEST           AUTHENTICATED

    │             │                  │
    ▼             ▼                  ▼
┌────────┐   ┌────────┐        ┌────────────┐
│ FTUX   │   │ FTUX   │        │ ONBOARDING │
│ Phase  │   │ Phase  │        │ Stages     │
│ 1-3    │   │ 1-3    │        │ 1-N        │
└────────┘   └────────┘        └────────────┘

PROGRESS AXIS (vertical)
```

A guest can be at FTUX phase 3. An authenticated user might be at onboarding stage 1. These are independent states.

---

## Main Stages

### Stage 1: FTUX (First-Time User Experience)

**Goal:** Introduce value without overwhelming. Convert curiosity into engagement.

| Phase | Trigger | Reveals |
|-------|---------|---------|
| 1. Landing | Page load | Hero, primary CTA, theme/language toggle |
| 2. Exploration | First CTA click | Content accordion, value propositions |
| 3. Commitment | Content completion | Sign-up prompt, "Ready for next steps" |

**Guest account creation:** On first meaningful action (CTA click, not page view), silently create a guest account to persist progress.

**What counts as an action:**
- Clicking a CTA button
- Completing a content section
- Changing theme/language
- Bookmarking content

**What does NOT count:**
- Page views
- Scrolling (accessibility issues)
- Time on page

### Stage 2: Sign-Up

**Goal:** Minimal friction authentication that feels safe.

| Aspect | Approach |
|--------|----------|
| Method | Email + OTP (passwordless) |
| UI hierarchy | "Log in" prominent, "or Create Account" muted |
| Form | Single email field + "Get Access" button |
| Trust signals | "We'll never spam you" + philosophy accordion |
| First achievement | PIONEER badge on email confirmation |

**Privacy promise:** The sign-up email includes: "Adjust your notification settings" with direct link. Only user-approved notifications will ever be sent.

### Stage 3: Onboarding

**Goal:** Optional guided journey that feels like discovery, not homework.

| Principle | Implementation |
|-----------|----------------|
| Optional | "Explore freely" vs "Take guided tour" |
| Gamified | Tied to achievements, not progress gates |
| Skippable | Every step has visible skip option |
| Celebratory | Toast notifications, not modals |

---

## Achievement Philosophy

**Core principle:** Every choice is the right choice. Achievements validate user identity, not compliance.

### Milestone Achievements

| Achievement | Trigger | Message |
|-------------|---------|---------|
| **PIONEER** | Email confirmed | "You're in. Welcome to the frontier." |
| **NAVIGATOR** | Completed onboarding | "You charted the course. Methodical explorer." |
| **TRAILBLAZER** | Skipped onboarding | "You forge your own path. Self-guided adventurer." |

Both NAVIGATOR and TRAILBLAZER are equally positive — one celebrates thoroughness, the other celebrates independence. Neither implies the other choice was wrong.

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **No negative framing** | "Skipped" internally, but user sees "forged own path" |
| **Equal visual weight** | Same badge tier, same celebration animation |
| **Personality reflection** | Achievements describe who the user is, not what they did |
| **Optional visibility** | Users can hide achievements if they prefer |


---

## ProgRev UI Patterns

### The Sidebar Problem

**Wrong approach:** Hide sidebar until "it's useful" (disorients users).

**Right approach:** Collapsed icon visible from page load; expands to reveal unlocked sections.

```
Phase 1:     [ ≡ ]  ← Visible but collapsed

Phase 2+:    [ ≡ ]  ← Same icon, now opens to:
              ├─ Welcome (✓ muted)
              ├─ Explore (current)
              └─ Sign Up (upcoming)
```

### Visual Treatment of Stages

| State | Visual Treatment |
|-------|------------------|
| Completed | Muted text, checkmark icon, lower opacity, line-through optional |
| Current | Primary color, left border accent, bold weight |
| Upcoming | Secondary text color, slightly reduced opacity |

**Accessibility requirement:** Never rely on color alone. Use icons (checkmarks), text decorations, or structural differences.

### Progress Indicators

**Ambient, not demanding.** Users check progress when they want, not when we show it.

Options:
1. **Mini-indicator:** Top-right corner `(●●○○) 2/4`
2. **Sidebar state:** Progress visible when navigation is open
3. **Achievement count:** `🏆 3/5` badge that expands on click

---

## Architecture

### State Management

**Server-authoritative with client cache:**

```
Browser (Cache)  ◄──►  SvelteKit (Derive)  ◄──►  PostgreSQL (Source)
localStorage          Load functions           progrev_progress table
Svelte 5 runes        compute from DB          canonical state
```

- Server is canonical (ProgRev state controls feature access)
- Client caches for UX (avoid flash of locked content)
- Mutations via form actions, then `invalidateAll()`

### Route Strategy

**Adapted content, not locked routes:**

| Approach | Why |
|----------|-----|
| ✓ Same route, different content | Users see what's possible, motivated to progress |
| ✗ Locked routes with redirects | Users hit walls, shared links fail |

Exception: True protected routes (settings, billing) require authentication.

### Data Flow

```
+layout.server.ts
    │
    ├─► Load ProgRev state alongside auth
    │
    ▼
event.locals.progrev
    │
    ├─► Available in all load functions
    │
    ▼
data.progrev in components
    │
    ├─► Render conditionally via <ProgRevGate requires="feature">
```

---

## Guest Account Lifecycle

### Creation

| Trigger | Action |
|---------|--------|
| First meaningful action | Create guest, set `guest_id` cookie (30-90 days) |
| Return visit | Recognize via cookie, load progress |

### Merge on Sign-Up

Atomic transaction:
1. Create authenticated user (Better Auth)
2. Transfer all guest data to user (UPDATE owner_id)
3. Preserve guest record as audit trail
4. Grant PIONEER achievement
5. Clear guest_id cookie

### Conflict Resolution

If user already has progress (returning user, second device):
- Take HIGHER progress level
- Union of unlocked features
- Union of bookmarks and seen content

### Cleanup

Daily job: DELETE guests with `last_seen_at > 30 days` AND `merged_to_user_id IS NULL`.

---

## Data Model (Summary)

| Entity | Purpose | Owner |
|--------|---------|-------|
| `guest` | Anonymous visitor identity | — |
| `progrev_progress` | FTUX phases, actions, milestones | Guest or User |
| `onboarding_progress` | Post-signup guided journey | User only |
| `achievement_definition` | Catalog of possible achievements | Reference |
| `user_achievement` | Earned achievements | User only |
| `bookmark` | Saved content sections | Guest or User |
| `seen_content` | What's been viewed (for muting) | Guest or User |
| `unlocked_element` | UI elements revealed | Guest or User |

**Polymorphic ownership:** `owner_id` + `owner_type` ('guest' | 'user') enables single-table queries and simple merge.

See [blueprint/progrev/](../blueprint/progrev/) for full schema and implementation details.

---

## Accessibility Requirements

| Concern | Requirement |
|---------|-------------|
| Screen readers | ARIA live regions announce new content |
| Keyboard navigation | All stages navigable via Tab/Arrow keys |
| Focus management | Focus moves to newly revealed content |
| Reduced motion | Respect `prefers-reduced-motion` |
| Color independence | Never rely on color alone for state |

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why It Fails | Alternative |
|--------------|--------------|-------------|
| Hiding "Skip" button | Traps expert users | Always visible, secondary style |
| Scroll-as-action | Accessibility failure, false signals | Explicit CTA buttons |
| Modal onboarding | Blocks exploration | Inline, dismissible |
| Progress bars that regress | Violates mental model | Stages, not percentages |
| Unskippable animations | Frustrates repeat visitors | `prefers-reduced-motion` + skip |
| "Complete profile" nags | Feels like homework | Optional achievements |

---

## Implementation Checklist

Before launch:

- [ ] First-time user completes FTUX in <2 minutes
- [ ] Screen reader users can navigate all stages
- [ ] Keyboard-only navigation works throughout
- [ ] Touch targets ≥44px on mobile
- [ ] `prefers-reduced-motion` respected
- [ ] Guest progress survives browser close
- [ ] Guest-to-user merge preserves all data
- [ ] Every stage can be skipped
- [ ] Error states have clear recovery paths

---

## Related Documentation

- [architecture.md](./architecture.md) — State layers and routing patterns
- [user-data.md](./user-data.md) — Data taxonomy for user information
- [blueprint/progrev/](../blueprint/progrev/) — ProgRev implementation specifications
- [blueprint/auth.md](../blueprint/auth.md) — Better Auth integration
