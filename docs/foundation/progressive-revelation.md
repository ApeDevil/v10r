# Progressive Revelation (ProgRev)

A foundational UX pattern that progressively reveals content and features as users demonstrate readiness, reducing cognitive overload while guiding them through the application.

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

## The Two-Axis Model

ProgRev operates on two orthogonal dimensions:

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

## Journey Stages

### Stage 1: FTUX (First-Time User Experience)

**Goal:** Introduce value without overwhelming. Convert curiosity into engagement.

| Phase | Trigger | Reveals |
|-------|---------|---------|
| 1. Landing | Page load | Hero, primary CTA, preferences |
| 2. Exploration | First meaningful action | Content sections, value propositions |
| 3. Commitment | Content completion | Sign-up prompt, "Ready for next steps" |

**What counts as a meaningful action:**
- Clicking a CTA button
- Completing a content section
- Changing preferences (theme, language)
- Bookmarking content

**What does NOT count:**
- Page views
- Scrolling (accessibility issues)
- Time on page

### Stage 2: Sign-Up

**Goal:** Minimal friction authentication that feels safe.

| Aspect | Approach |
|--------|----------|
| Method | Passwordless (magic link, OTP, or OAuth) |
| UI hierarchy | "Log in" prominent, "Create Account" secondary |
| Form | Single field + action button |
| Trust signals | Privacy promise, philosophy explanation |
| First reward | Achievement badge on confirmation |

**Privacy commitment:** Users control their notification preferences from day one. Only user-approved communications are sent.

### Stage 3: Onboarding

**Goal:** Optional guided journey that feels like discovery, not homework.

| Principle | Approach |
|-----------|----------|
| Optional | Offer both "Explore freely" and "Take guided tour" |
| Gamified | Tied to achievements, not progress gates |
| Skippable | Every step has visible skip option |
| Celebratory | Brief positive feedback, not blocking modals |

---

## Achievement Philosophy

**Core principle:** Every choice is the right choice. Achievements validate user identity, not compliance.

### Milestone Achievements

| Achievement | Trigger | Message |
|-------------|---------|---------|
| **PIONEER** | Account confirmed | "You're in. Welcome to the frontier." |
| **NAVIGATOR** | Completed onboarding | "You charted the course. Methodical explorer." |
| **TRAILBLAZER** | Skipped onboarding | "You forge your own path. Self-guided adventurer." |

Both NAVIGATOR and TRAILBLAZER are equally positive — one celebrates thoroughness, the other celebrates independence.

### Design Principles

| Principle | Rationale |
|-----------|-----------|
| **No negative framing** | "Skipped" internally, but user sees "forged own path" |
| **Equal visual weight** | Same badge tier, same celebration |
| **Personality reflection** | Achievements describe who the user is, not what they did |
| **Optional visibility** | Users can hide achievements if they prefer |

---

## UI Patterns

### Navigation Revelation

**Wrong approach:** Hide navigation until "it's useful" (disorients users).

**Right approach:** Navigation affordance visible from the start; expands to reveal unlocked sections.

```
Phase 1:     [ ≡ ]  ← Visible but collapsed

Phase 2+:    [ ≡ ]  ← Same affordance, now opens to:
              ├─ Welcome (✓ completed)
              ├─ Explore (current)
              └─ Sign Up (upcoming)
```

### Visual Treatment of Stages

| State | Visual Treatment |
|-------|------------------|
| Completed | Muted text, checkmark, lower opacity |
| Current | Primary color, accent border, bold weight |
| Upcoming | Secondary color, reduced opacity |

**Accessibility:** Never rely on color alone. Use icons, text decorations, or structural differences.

### Progress Indicators

**Ambient, not demanding.** Users check progress when they want.

Options:
1. **Mini-indicator:** Subtle dots or fraction (2/4)
2. **Navigation state:** Progress visible when navigation is open
3. **Achievement count:** Badge that expands on interaction

---

## Guest Identity

### Concept

Anonymous visitors can become "guests" — recognized returning visitors whose progress persists without requiring an account.

### Lifecycle

| Event | Behavior |
|-------|----------|
| First meaningful action | Create guest identity, persist for recognition |
| Return visit | Recognize guest, restore progress |
| Sign-up | Merge guest data into authenticated account |
| Inactivity (30+ days) | Clean up orphaned guest data |

### Merge on Sign-Up

When a guest creates an account:
1. Transfer all guest progress to the user
2. Preserve audit trail
3. Grant first achievement
4. Resolve conflicts by taking higher progress / union of data

### Conflict Resolution

If user already has progress (returning user, second device):
- Take HIGHER progress level
- Union of unlocked features
- Union of bookmarks and seen content

---

## Data Concepts

| Concept | Purpose | Ownership |
|---------|---------|-----------|
| Guest identity | Anonymous visitor recognition | — |
| Progress state | FTUX phases, milestones | Guest or User |
| Onboarding state | Post-signup guided journey | User only |
| Achievements | Earned milestone badges | User only |
| Bookmarks | Saved content references | Guest or User |
| Seen content | What's been viewed (for muting) | Guest or User |

**Ownership model:** Data can belong to either a guest or a user. On sign-up, guest data transfers to the user account.

---

## Route Strategy

**Adapted content, not locked routes:**

| Approach | Why |
|----------|-----|
| ✓ Same route, different content | Users see what's possible, motivated to progress |
| ✗ Locked routes with redirects | Users hit walls, shared links fail |

Exception: True protected routes (settings, billing, personal data) require authentication.

---

## Accessibility Requirements

| Concern | Requirement |
|---------|-------------|
| Screen readers | Announce newly revealed content |
| Keyboard navigation | All stages navigable via keyboard |
| Focus management | Focus moves to newly revealed content |
| Motion sensitivity | Respect user motion preferences |
| Color independence | Never rely on color alone for state |

---

## Anti-Patterns

| Anti-Pattern | Why It Fails | Alternative |
|--------------|--------------|-------------|
| Hiding "Skip" button | Traps expert users | Always visible, secondary style |
| Scroll-as-action | Accessibility failure, false signals | Explicit action buttons |
| Modal onboarding | Blocks exploration | Inline, dismissible |
| Progress bars that regress | Violates mental model | Stages, not percentages |
| Unskippable animations | Frustrates repeat visitors | Respect motion preferences + skip |
| "Complete profile" nags | Feels like homework | Optional achievements |

---

## Success Criteria

- First-time user completes FTUX in <2 minutes
- Screen reader users can navigate all stages
- Keyboard-only navigation works throughout
- Touch targets meet accessibility standards
- Guest progress survives browser close
- Guest-to-user merge preserves all data
- Every stage can be skipped
- Error states have clear recovery paths

---

## Related Documentation

- [architecture.md](./architecture.md) — State layers and routing patterns
- [user-data.md](./user-data.md) — Data taxonomy for user information
- [../blueprint/progressive-revelation.md](../blueprint/progressive-revelation.md) — Implementation blueprint
