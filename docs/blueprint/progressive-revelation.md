# Progressive Revelation (ProgRev) Blueprint

Implementation blueprint for the Progressive Revelation system. ProgRev progressively reveals content and features as users demonstrate readiness, reducing cognitive overload while guiding them through the application.

**Foundation:** See [../foundation/progressive-revelation.md](../foundation/progressive-revelation.md) for philosophy and anti-goals.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REQUEST FLOW                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. hooks.server.ts ──► Load guest_id cookie, verify guest exists           │
│          │                                                                   │
│          ▼                                                                   │
│  2. hooks.server.ts ──► Load ProgRev state from DB → event.locals.progrev   │
│          │                                                                   │
│          ▼                                                                   │
│  3. +layout.server.ts ──► Pass progrev to page data                         │
│          │                                                                   │
│          ▼                                                                   │
│  4. +layout.svelte ──► Sync to localStorage cache, provide context          │
│          │                                                                   │
│          ▼                                                                   │
│  5. Components ──► Consume via useProgRev(), gate with <ProgRevGate>        │
│          │                                                                   │
│          ▼                                                                   │
│  6. Form Actions ──► recordAction() → DB update → invalidateAll()           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key Principles:**
- **Server-authoritative**: PostgreSQL is canonical; client cannot lie about progress
- **Write-through cache**: localStorage caches server state; never written by client actions
- **Guest-first**: Create guest on first meaningful action, not page load
- **Atomic merge**: Guest → user data transfer in single transaction

---

## Research Validation

Research validates the proposed architecture:

| Assumption | Validation | Source |
|------------|------------|--------|
| Progressive disclosure reduces cognitive load | Verified - NN/g 1995, reconfirmed 2025 | Nielsen Norman Group |
| Server-authoritative required for feature gating | "Client-side only opens you to abuse cases" | Statsig Documentation |
| Session IDs must regenerate on privilege change | OWASP standard (anonymous → authenticated) | OWASP Cheat Sheet |
| Forced tutorials underperform progressive | 72% abandon apps with too many onboarding steps | UserGuiding 2024 |
| Average onboarding completion: ~19% | Median: 10.1% across 188 companies | Userpilot 2024 |
| Gamification increases completion by 50% | Progress indicators, badges, checklists | Intercom Research |

**Anti-patterns to avoid (verified):**
- Dark patterns found on >10% of popular sites (Princeton/UChicago 2019)
- Epic Games paid $245M settlement for deceptive payment patterns
- Function-oriented onboarding "feels like an information dump"

---

## Database Schema

### Tables Overview

| Table | Purpose | Ownership |
|-------|---------|-----------|
| `guest` | Anonymous visitor identity | Top-level |
| `progrev_progress` | FTUX phases, actions, milestones | Guest XOR User |
| `onboarding_progress` | Post-signup journey | User only |
| `achievement_definition` | Achievement catalog | Reference |
| `user_achievement` | Earned achievements | User only |
| `bookmark` | Saved content | Guest XOR User |
| `seen_content` | Viewed content for muting | Guest XOR User |

### Schema Definition

```typescript
// src/lib/server/db/schema/progrev.ts
import {
  pgTable, text, timestamp, integer, boolean, pgEnum,
  index, unique, check
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { user } from './_better-auth';

// ============================================================================
// ENUMS
// ============================================================================

export const ftuxPhaseEnum = pgEnum('ftux_phase', [
  'landing',      // Phase 1: Initial view
  'exploration',  // Phase 2: After first CTA click
  'commitment'    // Phase 3: Ready for signup
]);

export const achievementTierEnum = pgEnum('achievement_tier', [
  'bronze', 'silver', 'gold', 'platinum'
]);

// ============================================================================
// GUEST (Anonymous Visitor Identity)
// ============================================================================

export const guest = pgTable('guest', {
  id: text('id').primaryKey(),  // gst_xxxxxxxxxxxx
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),

  // Merge tracking (audit trail)
  mergedToUserId: text('merged_to_user_id').references(() => user.id, { onDelete: 'set null' }),
  mergedAt: timestamp('merged_at', { withTimezone: true }),
}, (table) => [
  index('guest_last_seen_at_idx').on(table.lastSeenAt),
  index('guest_merged_to_user_id_idx').on(table.mergedToUserId),
]);

// ============================================================================
// PROGREV PROGRESS (FTUX State - Guest or User)
// ============================================================================

export const progrevProgress = pgTable('progrev_progress', {
  id: text('id').primaryKey(),  // prg_xxxxxxxxxxxx

  // Dual ownership: exactly one must be non-null
  guestId: text('guest_id').references(() => guest.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),

  // FTUX state
  ftuxPhase: ftuxPhaseEnum('ftux_phase').notNull().default('landing'),

  // TEXT[] for actions - simple, fast, no JSON parsing
  completedActions: text('completed_actions').array().notNull().default(sql`'{}'::text[]`),
  milestones: text('milestones').array().notNull().default(sql`'{}'::text[]`),

  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('progrev_progress_guest_id_idx').on(table.guestId),
  index('progrev_progress_user_id_idx').on(table.userId),

  // Exactly one owner
  check('progrev_progress_owner_check', sql`
    (guest_id IS NOT NULL AND user_id IS NULL) OR
    (guest_id IS NULL AND user_id IS NOT NULL)
  `),

  // One progress record per owner
  unique('progrev_progress_guest_unique').on(table.guestId),
  unique('progrev_progress_user_unique').on(table.userId),
]);

// ============================================================================
// ONBOARDING PROGRESS (Post-Signup - User Only)
// ============================================================================

export const onboardingProgress = pgTable('onboarding_progress', {
  userId: text('user_id')
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),

  currentStage: integer('current_stage').notNull().default(1),
  completedStages: integer('completed_stages').array().notNull().default(sql`'{}'::int[]`),
  skipped: boolean('skipped').notNull().default(false),

  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

// ============================================================================
// ACHIEVEMENTS
// ============================================================================

export const achievementDefinition = pgTable('achievement_definition', {
  id: text('id').primaryKey(),
  key: text('key').notNull().unique(),  // 'PIONEER', 'NAVIGATOR', 'TRAILBLAZER'
  name: text('name').notNull(),
  description: text('description').notNull(),
  tier: achievementTierEnum('tier').notNull().default('bronze'),
  iconUrl: text('icon_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('achievement_definition_key_idx').on(table.key),
]);

export const userAchievement = pgTable('user_achievement', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, { onDelete: 'cascade' }),
  achievementId: text('achievement_id').notNull()
    .references(() => achievementDefinition.id, { onDelete: 'cascade' }),
  earnedAt: timestamp('earned_at', { withTimezone: true }).notNull().defaultNow(),
  context: text('context'),  // JSON string for metadata
}, (table) => [
  index('user_achievement_user_id_idx').on(table.userId),
  unique('user_achievement_user_achievement_unique').on(table.userId, table.achievementId),
]);

// ============================================================================
// CONTENT TRACKING (Guest or User)
// ============================================================================

export const bookmark = pgTable('bookmark', {
  id: text('id').primaryKey(),
  guestId: text('guest_id').references(() => guest.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  contentKey: text('content_key').notNull(),
  label: text('label'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('bookmark_guest_id_idx').on(table.guestId),
  index('bookmark_user_id_idx').on(table.userId),
  check('bookmark_owner_check', sql`
    (guest_id IS NOT NULL AND user_id IS NULL) OR
    (guest_id IS NULL AND user_id IS NOT NULL)
  `),
  unique('bookmark_guest_content_unique').on(table.guestId, table.contentKey),
  unique('bookmark_user_content_unique').on(table.userId, table.contentKey),
]);

export const seenContent = pgTable('seen_content', {
  id: text('id').primaryKey(),
  guestId: text('guest_id').references(() => guest.id, { onDelete: 'cascade' }),
  userId: text('user_id').references(() => user.id, { onDelete: 'cascade' }),
  contentKey: text('content_key').notNull(),
  seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('seen_content_guest_id_idx').on(table.guestId),
  index('seen_content_user_id_idx').on(table.userId),
  check('seen_content_owner_check', sql`
    (guest_id IS NOT NULL AND user_id IS NULL) OR
    (guest_id IS NULL AND user_id IS NOT NULL)
  `),
  unique('seen_content_guest_content_unique').on(table.guestId, table.contentKey),
  unique('seen_content_user_content_unique').on(table.userId, table.contentKey),
]);
```

### ID Generation

```typescript
// src/lib/server/db/id.ts
import { nanoid } from 'nanoid';

export const createId = {
  guest: () => `gst_${nanoid(12)}`,
  progrevProgress: () => `prg_${nanoid(12)}`,
  achievement: () => `ach_${nanoid(8)}`,
  userAchievement: () => `uac_${nanoid(12)}`,
  bookmark: () => `bmk_${nanoid(12)}`,
  seenContent: () => `scn_${nanoid(12)}`,
};
```

---

## SvelteKit Implementation

### Type Definitions

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      guest: Guest | null;
      progrev: ProgRevState;
    }

    interface PageData {
      progrev: ProgRevState;
    }
  }
}

export interface Guest {
  id: string;
  createdAt: Date;
  lastSeenAt: Date;
  mergedToUserId: string | null;
}

export type FtuxPhase = 'landing' | 'exploration' | 'commitment';

export interface ProgRevState {
  identity: 'anonymous' | 'guest' | 'authenticated';
  guestId?: string;
  userId?: string;
  ftuxPhase: FtuxPhase;
  completedActions: string[];
  milestones: string[];
  onboardingStage: number | null;
  onboardingSkipped: boolean;
  achievements: string[];
}

export {};
```

### Server Hooks

```typescript
// src/hooks.server.ts
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { guest, progrevProgress } from '$lib/server/db/schema/progrev';
import { eq, and, isNull } from 'drizzle-orm';

const GUEST_COOKIE = 'guest_id';
const GUEST_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

/**
 * Load guest identity from cookie.
 * Does NOT create guest - that happens on first meaningful action.
 */
const loadGuestIdentity: Handle = async ({ event, resolve }) => {
  const guestId = event.cookies.get(GUEST_COOKIE);

  if (guestId) {
    const [guestRecord] = await db
      .select()
      .from(guest)
      .where(and(
        eq(guest.id, guestId),
        isNull(guest.mergedToUserId)
      ))
      .limit(1);

    if (guestRecord) {
      event.locals.guest = guestRecord;

      // Touch lastSeenAt (fire-and-forget)
      db.update(guest)
        .set({ lastSeenAt: new Date() })
        .where(eq(guest.id, guestId))
        .execute()
        .catch(console.error);
    } else {
      // Guest merged or deleted
      event.cookies.delete(GUEST_COOKIE, { path: '/' });
    }
  }

  return resolve(event);
};

/**
 * Load ProgRev state from database.
 */
const loadProgRevState: Handle = async ({ event, resolve }) => {
  const user = event.locals.user;
  const guestRecord = event.locals.guest;

  // Default state for anonymous users
  let state: ProgRevState = {
    identity: 'anonymous',
    ftuxPhase: 'landing',
    completedActions: [],
    milestones: [],
    onboardingStage: null,
    onboardingSkipped: false,
    achievements: []
  };

  try {
    if (user) {
      // Authenticated user
      const [progress] = await db
        .select()
        .from(progrevProgress)
        .where(eq(progrevProgress.userId, user.id))
        .limit(1);

      state = {
        identity: 'authenticated',
        userId: user.id,
        ftuxPhase: progress?.ftuxPhase ?? 'commitment', // Auth users skip FTUX
        completedActions: progress?.completedActions ?? [],
        milestones: progress?.milestones ?? [],
        onboardingStage: progress?.onboardingStage ?? 1,
        onboardingSkipped: false,
        achievements: [] // Load separately if needed
      };
    } else if (guestRecord) {
      // Guest user
      const [progress] = await db
        .select()
        .from(progrevProgress)
        .where(eq(progrevProgress.guestId, guestRecord.id))
        .limit(1);

      if (progress) {
        state = {
          identity: 'guest',
          guestId: guestRecord.id,
          ftuxPhase: progress.ftuxPhase,
          completedActions: progress.completedActions,
          milestones: progress.milestones,
          onboardingStage: null,
          onboardingSkipped: false,
          achievements: []
        };
      }
    }
  } catch (err) {
    console.error('Failed to load ProgRev state:', err);
  }

  event.locals.progrev = state;
  return resolve(event);
};

export const handle = sequence(
  // betterAuthHandle, // Better Auth (populates event.locals.user)
  loadGuestIdentity,
  loadProgRevState,
  // rateLimitHandle, // Rate limiting
);
```

### Root Layout

```typescript
// src/routes/+layout.server.ts
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
  return {
    user: locals.user,
    session: locals.session,
    progrev: locals.progrev
  };
};
```

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
  import { setContext, onMount } from 'svelte';
  import { page } from '$app/state';
  import type { ProgRevState } from '$lib/types';

  let { children } = $props();

  // Cache management
  let cachedProgRev = $state<ProgRevState | null>(null);

  // Write-through: server state → localStorage
  $effect(() => {
    const serverProgRev = page.data.progrev;
    if (serverProgRev) {
      localStorage.setItem('progrev_cache', JSON.stringify(serverProgRev));
      cachedProgRev = serverProgRev;
    }
  });

  // Read cache on mount (prevent flash)
  onMount(() => {
    const cached = localStorage.getItem('progrev_cache');
    if (cached) {
      try {
        cachedProgRev = JSON.parse(cached);
      } catch {}
    }
  });

  // Server data wins when available
  const progrev = $derived(page.data.progrev ?? cachedProgRev);

  // Provide context
  setContext('progrev', {
    get state() { return progrev; }
  });
</script>

{@render children()}
```

### Action Recording

```typescript
// src/lib/server/progrev/actions.ts
import { db, createId } from '$lib/server/db';
import { guest, progrevProgress } from '$lib/server/db/schema/progrev';
import { eq, and } from 'drizzle-orm';
import type { RequestEvent } from '@sveltejs/kit';
import type { FtuxPhase } from '$lib/types';

const GUEST_COOKIE = 'guest_id';
const GUEST_MAX_AGE = 60 * 60 * 24 * 90;

/**
 * Creates a guest on first meaningful action.
 */
export async function createGuest(event: RequestEvent): Promise<string> {
  const id = createId.guest();

  await db.insert(guest).values({
    id,
    createdAt: new Date(),
    lastSeenAt: new Date()
  });

  await db.insert(progrevProgress).values({
    id: createId.progrevProgress(),
    guestId: id,
    ftuxPhase: 'landing',
    completedActions: [],
    milestones: []
  });

  event.cookies.set(GUEST_COOKIE, id, {
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: GUEST_MAX_AGE
  });

  return id;
}

/**
 * Records a meaningful action.
 * Creates guest if anonymous.
 */
export async function recordAction(
  event: RequestEvent,
  actionId: string,
  options: {
    advancePhase?: FtuxPhase;
    addMilestones?: string[];
  } = {}
): Promise<void> {
  const user = event.locals.user;
  let guestRecord = event.locals.guest;

  // Create guest for anonymous users
  if (!user && !guestRecord) {
    const guestId = await createGuest(event);
    guestRecord = { id: guestId, createdAt: new Date(), lastSeenAt: new Date(), mergedToUserId: null };
    event.locals.guest = guestRecord;
  }

  const ownerId = user?.id ?? guestRecord!.id;
  const ownerField = user ? 'userId' : 'guestId';

  // Get existing progress
  const [existing] = await db
    .select()
    .from(progrevProgress)
    .where(eq(progrevProgress[ownerField], ownerId))
    .limit(1);

  if (!existing) {
    // Create progress record
    await db.insert(progrevProgress).values({
      id: createId.progrevProgress(),
      [ownerField]: ownerId,
      ftuxPhase: options.advancePhase ?? 'landing',
      completedActions: [actionId],
      milestones: options.addMilestones ?? []
    });
  } else {
    // Update existing
    const updates: Partial<typeof progrevProgress.$inferInsert> = {
      completedActions: [...new Set([...existing.completedActions, actionId])],
      updatedAt: new Date()
    };

    if (options.advancePhase) {
      updates.ftuxPhase = options.advancePhase;
    }

    if (options.addMilestones) {
      updates.milestones = [...new Set([...existing.milestones, ...options.addMilestones])];
    }

    await db
      .update(progrevProgress)
      .set(updates)
      .where(eq(progrevProgress[ownerField], ownerId));
  }
}
```

### Guest-to-User Merge

```typescript
// src/lib/server/progrev/merge.ts
import { db, createId } from '$lib/server/db';
import {
  guest, progrevProgress, bookmark, seenContent,
  userAchievement, achievementDefinition, onboardingProgress
} from '$lib/server/db/schema/progrev';
import { eq, and, isNull } from 'drizzle-orm';

interface MergeResult {
  success: boolean;
  achievementsGranted: string[];
  bookmarksMerged: number;
  seenContentMerged: number;
}

/**
 * Merges guest data into user account.
 * Called after successful signup.
 *
 * Conflict resolution:
 * - FTUX phase: take higher (further along)
 * - Actions/milestones: union of sets
 * - Bookmarks: union (skip duplicates)
 */
export async function mergeGuestToUser(
  guestId: string,
  userId: string
): Promise<MergeResult> {
  return db.transaction(async (tx) => {
    const result: MergeResult = {
      success: false,
      achievementsGranted: [],
      bookmarksMerged: 0,
      seenContentMerged: 0,
    };

    // 1. Verify guest exists and not merged
    const [guestRecord] = await tx
      .select()
      .from(guest)
      .where(and(eq(guest.id, guestId), isNull(guest.mergedToUserId)))
      .limit(1);

    if (!guestRecord) return result;

    // 2. Get guest progress
    const [guestProgress] = await tx
      .select()
      .from(progrevProgress)
      .where(eq(progrevProgress.guestId, guestId))
      .limit(1);

    // 3. Get or create user progress
    const [userProgress] = await tx
      .select()
      .from(progrevProgress)
      .where(eq(progrevProgress.userId, userId))
      .limit(1);

    if (!userProgress && guestProgress) {
      // Transfer guest progress to user
      await tx.update(progrevProgress)
        .set({
          guestId: null,
          userId: userId,
          ftuxPhase: 'commitment', // Auth users complete FTUX
          updatedAt: new Date(),
        })
        .where(eq(progrevProgress.guestId, guestId));
    } else if (userProgress && guestProgress) {
      // Merge progress (take higher phase, union of actions)
      const phaseOrder = { landing: 1, exploration: 2, commitment: 3 };
      const higherPhase = phaseOrder[guestProgress.ftuxPhase] > phaseOrder[userProgress.ftuxPhase]
        ? guestProgress.ftuxPhase
        : 'commitment';

      await tx.update(progrevProgress)
        .set({
          ftuxPhase: higherPhase,
          completedActions: [...new Set([
            ...userProgress.completedActions,
            ...guestProgress.completedActions
          ])],
          milestones: [...new Set([
            ...userProgress.milestones,
            ...guestProgress.milestones
          ])],
          updatedAt: new Date(),
        })
        .where(eq(progrevProgress.userId, userId));

      // Delete guest progress
      await tx.delete(progrevProgress)
        .where(eq(progrevProgress.guestId, guestId));
    }

    // 4. Transfer bookmarks (skip duplicates)
    const guestBookmarks = await tx
      .select()
      .from(bookmark)
      .where(eq(bookmark.guestId, guestId));

    for (const bm of guestBookmarks) {
      const [exists] = await tx
        .select()
        .from(bookmark)
        .where(and(
          eq(bookmark.userId, userId),
          eq(bookmark.contentKey, bm.contentKey)
        ))
        .limit(1);

      if (!exists) {
        await tx.update(bookmark)
          .set({ guestId: null, userId: userId })
          .where(eq(bookmark.id, bm.id));
        result.bookmarksMerged++;
      } else {
        await tx.delete(bookmark).where(eq(bookmark.id, bm.id));
      }
    }

    // 5. Transfer seen content (skip duplicates)
    const guestSeen = await tx
      .select()
      .from(seenContent)
      .where(eq(seenContent.guestId, guestId));

    for (const sc of guestSeen) {
      const [exists] = await tx
        .select()
        .from(seenContent)
        .where(and(
          eq(seenContent.userId, userId),
          eq(seenContent.contentKey, sc.contentKey)
        ))
        .limit(1);

      if (!exists) {
        await tx.update(seenContent)
          .set({ guestId: null, userId: userId })
          .where(eq(seenContent.id, sc.id));
        result.seenContentMerged++;
      } else {
        await tx.delete(seenContent).where(eq(seenContent.id, sc.id));
      }
    }

    // 6. Mark guest as merged (keep for audit)
    await tx.update(guest)
      .set({ mergedToUserId: userId, mergedAt: new Date() })
      .where(eq(guest.id, guestId));

    // 7. Grant PIONEER achievement
    const [pioneer] = await tx
      .select()
      .from(achievementDefinition)
      .where(eq(achievementDefinition.key, 'PIONEER'))
      .limit(1);

    if (pioneer) {
      await tx.insert(userAchievement)
        .values({
          id: createId.userAchievement(),
          userId,
          achievementId: pioneer.id,
          context: JSON.stringify({ trigger: 'signup', fromGuest: guestId }),
        })
        .onConflictDoNothing();
      result.achievementsGranted.push('PIONEER');
    }

    // 8. Create onboarding progress
    await tx.insert(onboardingProgress)
      .values({ userId })
      .onConflictDoNothing();

    result.success = true;
    return result;
  });
}
```

---

## UI Components

### ProgRevGate

Conditionally renders content based on ProgRev state.

```svelte
<!-- src/lib/progrev/ProgRevGate.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { Snippet } from 'svelte';
  import type { FtuxPhase, ProgRevState } from '$lib/types';

  interface Props {
    /** Required FTUX phase */
    phase?: FtuxPhase;

    /** Required identity level */
    identity?: 'guest' | 'authenticated';

    /** Required action completion */
    requiresAction?: string;

    /** Content when unlocked */
    children: Snippet;

    /** Content when locked */
    fallback?: Snippet;
  }

  let { phase, identity, requiresAction, children, fallback }: Props = $props();

  const progrev = getContext<{ state: ProgRevState }>('progrev');

  const phaseOrder = { landing: 1, exploration: 2, commitment: 3 };

  const isUnlocked = $derived(() => {
    const state = progrev.state;
    if (!state) return false;

    // Check identity
    if (identity === 'authenticated' && state.identity !== 'authenticated') return false;
    if (identity === 'guest' && state.identity === 'anonymous') return false;

    // Check phase
    if (phase && phaseOrder[state.ftuxPhase] < phaseOrder[phase]) return false;

    // Check action
    if (requiresAction && !state.completedActions.includes(requiresAction)) return false;

    return true;
  });
</script>

{#if isUnlocked()}
  {@render children()}
{:else if fallback}
  {@render fallback()}
{/if}
```

**Usage:**

```svelte
<ProgRevGate phase="exploration">
  <ContentSection />

  {#snippet fallback()}
    <LockedPreview onclick={handleCTA} />
  {/snippet}
</ProgRevGate>
```

### ProgressIndicator

Ambient progress display for sidebar.

```svelte
<!-- src/lib/progrev/ProgressIndicator.svelte -->
<script lang="ts">
  import { getContext } from 'svelte';
  import type { ProgRevState } from '$lib/types';

  interface Props {
    density?: 'compact' | 'default' | 'detailed';
    orientation?: 'vertical' | 'horizontal';
  }

  let { density = 'default', orientation = 'vertical' }: Props = $props();

  const progrev = getContext<{ state: ProgRevState }>('progrev');

  const stages = [
    { id: 'landing', label: 'Welcome', phase: 'landing' },
    { id: 'exploration', label: 'Explore', phase: 'exploration' },
    { id: 'commitment', label: 'Ready', phase: 'commitment' }
  ] as const;

  const phaseOrder = { landing: 1, exploration: 2, commitment: 3 };

  function getStageState(phase: string) {
    const current = progrev.state?.ftuxPhase ?? 'landing';
    const currentNum = phaseOrder[current];
    const stageNum = phaseOrder[phase];

    if (stageNum < currentNum) return 'completed';
    if (stageNum === currentNum) return 'current';
    return 'upcoming';
  }
</script>

<nav class="progress-indicator {orientation}" aria-label="Progress">
  <ol class="stage-list">
    {#each stages as stage}
      {@const state = getStageState(stage.phase)}
      <li class="stage {state}">
        <div class="stage-dot">
          {#if state === 'completed'}
            <span class="i-mdi-check"></span>
          {/if}
        </div>
        {#if density !== 'compact'}
          <span class="stage-label">{stage.label}</span>
        {/if}
      </li>
    {/each}
  </ol>
</nav>

<style>
  .progress-indicator { --completed: hsl(142 71% 45%); --current: hsl(221 83% 53%); }
  .stage-list { list-style: none; padding: 0; margin: 0; display: flex; }
  .vertical .stage-list { flex-direction: column; gap: 1.5rem; }
  .horizontal .stage-list { justify-content: space-around; }

  .stage-dot {
    w-8 h-8 rounded-full flex items-center justify-center;
    transition: all 200ms;
  }
  .completed .stage-dot { background: var(--completed); color: white; }
  .current .stage-dot { background: var(--current); color: white; box-shadow: 0 0 0 4px hsl(221 83% 53% / 0.15); }
  .upcoming .stage-dot { background: hsl(0 0% 80%); }

  .completed .stage-label { opacity: 0.6; }
  .upcoming .stage-label { opacity: 0.4; }
</style>
```

### AchievementToast

Celebratory notification for milestones.

```svelte
<!-- src/lib/progrev/AchievementToast.svelte -->
<script lang="ts">
  interface Props {
    achievement: 'PIONEER' | 'NAVIGATOR' | 'TRAILBLAZER';
    duration?: number;
    onDismiss?: () => void;
  }

  let { achievement, duration = 5000, onDismiss }: Props = $props();

  let visible = $state(true);

  const config = {
    PIONEER: { icon: 'i-mdi-rocket-launch', title: 'Pioneer', desc: "You're in. Welcome to the frontier." },
    NAVIGATOR: { icon: 'i-mdi-compass', title: 'Navigator', desc: 'You charted the course.' },
    TRAILBLAZER: { icon: 'i-mdi-terrain', title: 'Trailblazer', desc: 'You forge your own path.' }
  };

  const { icon, title, desc } = config[achievement];

  $effect(() => {
    if (duration > 0) {
      const timeout = setTimeout(() => {
        visible = false;
        onDismiss?.();
      }, duration);
      return () => clearTimeout(timeout);
    }
  });
</script>

{#if visible}
  <div class="achievement-toast" role="status" aria-live="polite">
    <span class={icon}></span>
    <div>
      <strong>{title}</strong>
      <p>{desc}</p>
    </div>
    <button onclick={() => { visible = false; onDismiss?.(); }} aria-label="Dismiss">
      <span class="i-mdi-close"></span>
    </button>
  </div>
{/if}

<style>
  .achievement-toast {
    position: fixed; top: 1rem; right: 1rem; z-index: 1000;
    display: flex; align-items: center; gap: 1rem;
    background: white; border: 1px solid hsl(0 0% 90%);
    border-radius: 0.5rem; padding: 1rem; max-width: 24rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    animation: slide-in 300ms ease-out;
  }
  @keyframes slide-in {
    from { transform: translateX(calc(100% + 1rem)); opacity: 0; }
  }
  @media (max-width: 640px) {
    .achievement-toast { left: 1rem; right: 1rem; max-width: none; }
  }
</style>
```

---

## Cleanup Job

```typescript
// src/lib/server/jobs/guest-cleanup.ts
import { db } from '$lib/server/db';
import { guest } from '$lib/server/db/schema/progrev';
import { lt, and, isNull } from 'drizzle-orm';

const STALE_DAYS = 30;

export async function cleanupStaleGuests(): Promise<{ deleted: number }> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - STALE_DAYS);

  const result = await db
    .delete(guest)
    .where(and(
      lt(guest.lastSeenAt, cutoff),
      isNull(guest.mergedToUserId)
    ))
    .returning({ id: guest.id });

  return { deleted: result.length };
}
```

```typescript
// src/routes/api/cron/guest-cleanup/+server.ts
import { json, error } from '@sveltejs/kit';
import { timingSafeEqual } from 'crypto';
import { CRON_SECRET } from '$env/static/private';
import { cleanupStaleGuests } from '$lib/server/jobs/guest-cleanup';

export async function GET({ request }) {
  const auth = request.headers.get('authorization');
  const expected = `Bearer ${CRON_SECRET}`;

  if (!auth || auth.length !== expected.length ||
      !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) {
    error(401, 'Unauthorized');
  }

  const result = await cleanupStaleGuests();
  return json({ success: true, ...result });
}
```

**Vercel cron:**

```json
{
  "crons": [{
    "path": "/api/cron/guest-cleanup",
    "schedule": "0 2 * * *"
  }]
}
```

---

## File Structure

```
src/
├── app.d.ts                          # ProgRev types in App namespace
├── hooks.server.ts                   # Guest + ProgRev loading
├── routes/
│   ├── +layout.server.ts             # Pass progrev to page data
│   ├── +layout.svelte                # Cache management, context
│   └── api/cron/guest-cleanup/       # Daily cleanup endpoint
├── lib/
│   ├── types.ts                      # FtuxPhase, ProgRevState
│   ├── progrev/
│   │   ├── ProgRevGate.svelte        # Conditional rendering
│   │   ├── ProgressIndicator.svelte  # Progress display
│   │   ├── AchievementToast.svelte   # Celebration notifications
│   │   └── context.svelte.ts         # useProgRev() helper
│   └── server/
│       ├── db/schema/progrev.ts      # Database schema
│       ├── progrev/
│       │   ├── actions.ts            # recordAction(), createGuest()
│       │   └── merge.ts              # mergeGuestToUser()
│       └── jobs/guest-cleanup.ts     # Stale guest cleanup
```

---

## Implementation Checklist

### Phase 1: Database
- [ ] Create schema in `src/lib/server/db/schema/progrev.ts`
- [ ] Add ID generators to `id.ts`
- [ ] Generate and run migration
- [ ] Seed achievement definitions

### Phase 2: Server Infrastructure
- [ ] Add hooks for guest identity loading
- [ ] Add hooks for ProgRev state loading
- [ ] Implement `recordAction()` helper
- [ ] Implement `mergeGuestToUser()` transaction
- [ ] Create cleanup cron endpoint

### Phase 3: Client Components
- [ ] `ProgRevGate.svelte` - Conditional rendering
- [ ] `ProgressIndicator.svelte` - Progress display
- [ ] `AchievementToast.svelte` - Celebrations
- [ ] Context provider in root layout
- [ ] localStorage cache sync

### Phase 4: Integration
- [ ] Landing page FTUX flow
- [ ] Sign-up flow with merge
- [ ] Onboarding flow (optional)
- [ ] Sidebar with ProgRev state

---

## Related Documentation

- [../foundation/progressive-revelation.md](../foundation/progressive-revelation.md) - Philosophy and anti-goals
- [auth.md](./auth.md) - Better Auth integration
- [state.md](./state.md) - Svelte 5 runes patterns
- [forms.md](./forms.md) - Superforms for actions
- [db/relational.md](./db/relational.md) - Schema conventions
