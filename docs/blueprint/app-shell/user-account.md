# User Account

User account management for identity, security, and GDPR compliance. High-stakes operations requiring careful UX design.

## Route Structure

```
/app/account/
├── +layout.svelte           # Tabbed navigation wrapper
├── +layout.server.ts        # Load user profile data once
├── +page.svelte             # Profile editing (default tab)
├── +page.server.ts          # Profile form actions
├── security/
│   ├── +page.svelte         # OAuth connections, sessions, 2FA
│   └── +page.server.ts      # Security form actions
├── data/
│   ├── +page.svelte         # GDPR data hub
│   ├── +page.server.ts      # Prepare data view
│   └── export/
│       └── +server.ts       # GET handler returns JSON download
└── delete/
    ├── +page.svelte         # Deletion confirmation flow
    └── +page.server.ts      # Delete action with grace period
```

## Tabbed Layout

The account section uses a tabbed layout with sub-routes. Each tab has distinct server load requirements.

```svelte
<!-- /app/account/+layout.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { PageHeader } from '$lib/components/composites';

  let { children, data } = $props();

  const tabs = [
    { href: '/app/account', label: 'Profile', exact: true },
    { href: '/app/account/security', label: 'Security' },
    { href: '/app/account/data', label: 'Your Data' },
  ];

  const isActive = (href: string, exact = false) =>
    exact ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<PageHeader title="Account" />

<nav class="tabs" aria-label="Account sections">
  {#each tabs as tab}
    <a
      href={tab.href}
      class:active={isActive(tab.href, tab.exact)}
      aria-current={isActive(tab.href, tab.exact) ? 'page' : undefined}
    >
      {tab.label}
    </a>
  {/each}
</nav>

<div class="tab-content">
  {@render children()}
</div>
```

---

## Profile Page

**Route:** `/app/account`

**Pattern:** Auto-save on blur + visible Save button for user confidence.

### Wireframe

```
┌────────────────────────────────────────────────┐
│ Account › Profile           [View as Public]   │
├────────────────────────────────────────────────┤
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ Avatar                                 │    │
│ │ ┌──────┐                               │    │
│ │ │  JD  │  Upload new avatar            │    │
│ │ └──────┘  • JPEG, PNG, WebP • Max 5MB  │    │
│ │           [Change]                     │    │
│ └────────────────────────────────────────┘    │
│                                                │
│ ┌────────────────────────────────────────┐    │
│ │ Personal Information                   │    │
│ │                                        │    │
│ │ Display Name                           │    │
│ │ [John Doe________________]  ✓ Saved    │    │
│ │                                        │    │
│ │ Email                                  │    │
│ │ john@example.com (verified) [Change]   │    │
│ │                                        │    │
│ │ Bio (optional)                         │    │
│ │ [Full-stack developer...____]          │    │
│ │ 150/500 characters                     │    │
│ │                                        │    │
│ │ Website (optional)                     │    │
│ │ [https://johndoe.com_____]             │    │
│ └────────────────────────────────────────┘    │
│                                                │
│                              [Save Changes]    │
└────────────────────────────────────────────────┘
```

### UX Decisions

| Decision | Rationale |
|----------|-----------|
| Auto-save on blur with debounce (500ms) | Immediate persistence, no lost work |
| Visible Save button | User confidence (research shows users panic without it) |
| "✓ Saved" indicator with timestamp | Positive feedback after each change |
| Email read-only with [Change] link | Email change requires verification flow |
| Character count on bio | Live feedback on length |

### Implementation

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { valibotClient } from 'sveltekit-superforms/adapters';
  import { profileSchema } from '$lib/schemas/user';

  let { data } = $props();

  const { form, errors, enhance, tainted } = superForm(data.form, {
    validators: valibotClient(profileSchema),
    validationMethod: 'auto',
    delayMs: 500,
    onUpdate({ form }) {
      if (form.message) savedAt = new Date();
    }
  });

  let savedAt = $state<Date | null>(null);
  let savedMessage = $derived(() => {
    if (!savedAt) return null;
    const seconds = Math.floor((Date.now() - savedAt.getTime()) / 1000);
    return seconds < 10 ? `✓ Saved ${seconds}s ago` : null;
  });
</script>
```

---

## Security Page

**Route:** `/app/account/security`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Account › Security                                 │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Two-Factor Authentication                    │  │
│ │ Add an extra layer of security               │  │
│ │ Status: Not enabled       [Enable 2FA]       │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Connected Accounts                           │  │
│ │                                              │  │
│ │ 🐙 GitHub - Connected as @johndoe            │  │
│ │                              [Disconnect]    │  │
│ │                                              │  │
│ │ 🔵 Google - Not connected    [Connect]       │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Active Sessions                              │  │
│ │                                              │  │
│ │ 💻 Chrome on macOS (current)                 │  │
│ │    San Francisco, US • Active now            │  │
│ │                                              │  │
│ │ 📱 Safari on iOS                             │  │
│ │    Los Angeles, US • 2 hours ago    [Revoke] │  │
│ │                                              │  │
│ │ [Sign out all other sessions]                │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### OAuth Disconnect Safety Check

**Critical:** Prevent user lockout if OAuth is their only login method.

```typescript
// Before allowing OAuth disconnect
const oauthAccounts = user.accounts.filter(a => a.provider !== 'credential');

// Passwordless: user can always sign in via magic link/OTP to verified email
// Only block if disconnecting would leave no verified email
if (oauthAccounts.length === 1 && !user.emailVerified) {
  return fail(400, {
    error: 'Verify your email before disconnecting your only OAuth provider.'
  });
}
```

### Session Revocation

```typescript
// Revoke all other sessions (e.g., after security concern)
await auth.api.revokeOtherSessions({
  headers: event.request.headers,
});
```

---

## GDPR Data Page

**Route:** `/app/account/data`

### Wireframe

```
┌────────────────────────────────────────────────────┐
│ Account › Your Data                                │
├────────────────────────────────────────────────────┤
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Data We Store                                │  │
│ │                                              │  │
│ │ • Profile information (name, email, avatar)  │  │
│ │ • Account activity logs                      │  │
│ │ • Session history                            │  │
│ │ • Created projects and files                 │  │
│ │                                              │  │
│ │ Last updated: January 2025                   │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ Export Your Data                             │  │
│ │                                              │  │
│ │ Download a copy of your data in JSON         │  │
│ │ format. Includes profile, projects, and      │  │
│ │ activity history.                            │  │
│ │                                              │  │
│ │ [Request Export]                             │  │
│ │                                              │  │
│ │ ⏳ Preparing your data... (if pending)       │  │
│ │ ✓ Ready! [Download JSON] (if ready)          │  │
│ └──────────────────────────────────────────────┘  │
│                                                    │
│ ┌──────────────────────────────────────────────┐  │
│ │ ⚠️ Danger Zone                               │  │
│ │                                              │  │
│ │ Permanently delete your account and all      │  │
│ │ associated data. This cannot be undone.      │  │
│ │                                              │  │
│ │ [Delete Account...]                          │  │
│ └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
```

### Data Export Endpoint

**Rate Limited:** Data export is computationally expensive. Limit to prevent abuse.

```typescript
// /app/account/data/export/+server.ts
import { json, error } from '@sveltejs/kit';
import { RateLimiter } from 'sveltekit-rate-limiter/server';
import type { RequestHandler } from './$types';

// Strict rate limiting: 3 exports per day per user
const exportLimiter = new RateLimiter({
  IP: [3, 'd'],        // 3 per day per IP
  cookie: {
    name: 'export_rl',
    secret: EXPORT_RATE_LIMIT_SECRET,
    rate: [3, 'd'],    // 3 per day per cookie
    preflight: true,
  },
});

export const GET: RequestHandler = async (event) => {
  const { locals } = event;

  if (!locals.user) {
    throw error(401, 'Unauthorized');
  }

  // Check rate limit
  const { limited, retryAfter } = await exportLimiter.check(event);
  if (limited) {
    throw error(429, {
      message: 'Export limit reached. Try again tomorrow.',
      retryAfter,
    });
  }

  // Log export for audit trail
  await db.insert(auditLog).values({
    userId: locals.user.id,
    action: 'data_export',
    ip: event.getClientAddress(),
    userAgent: event.request.headers.get('user-agent'),
    createdAt: new Date(),
  });

  const userData = await collectUserData(locals.user.id);

  return new Response(JSON.stringify(userData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="velociraptor-data-${Date.now()}.json"`,
    },
  });
};
```

### Large Export Handling

For accounts with significant data, use background job + notification:

```typescript
// For large exports, queue a job instead of blocking
export const POST: RequestHandler = async ({ locals }) => {
  if (!locals.user) throw error(401);

  // Check if export already in progress
  const pendingExport = await db.query.exportJobs.findFirst({
    where: and(
      eq(exportJobs.userId, locals.user.id),
      eq(exportJobs.status, 'pending'),
    ),
  });

  if (pendingExport) {
    return json({ status: 'already_pending', jobId: pendingExport.id });
  }

  // Create export job
  const job = await db.insert(exportJobs).values({
    userId: locals.user.id,
    status: 'pending',
    createdAt: new Date(),
  }).returning();

  // Trigger background job (e.g., via Upstash QStash)
  await queueExportJob(job[0].id);

  return json({ status: 'queued', jobId: job[0].id });
};
```

---

## Account Deletion Flow

**Multi-step confirmation with 7-day grace period.**

### Step 1: Initial Warning (Modal)

```
┌─────────────────────────────────────────┐
│ Delete Account?                         │
│                                         │
│ This will permanently delete:           │
│ • Your profile and settings             │
│ • All projects and files                │
│ • Your activity history                 │
│                                         │
│ This action cannot be undone.           │
│                                         │
│ [Cancel]  [Continue to Delete]          │
└─────────────────────────────────────────┘
```

### Step 2: Confirmation Page

**Route:** `/app/account/data/delete`

```
┌────────────────────────────────────────────────────┐
│ Delete Account                                     │
├────────────────────────────────────────────────────┤
│                                                    │
│ ⚠️ Final Confirmation                              │
│                                                    │
│ Your account will be scheduled for deletion.      │
│ You have 7 days to cancel before it's permanent.  │
│                                                    │
│ 1. Type your email address below                  │
│    [_________________________________]            │
│    ⚠️ Email doesn't match (if wrong)              │
│                                                    │
│ 2. Tell us why you're leaving (optional)          │
│    [_________________________________]            │
│                                                    │
│ □ I understand this action cannot be undone       │
│                                                    │
│ [Cancel]  [Schedule Deletion]                     │
│           (disabled until all conditions met)     │
└────────────────────────────────────────────────────┘
```

> **No password step.** With passwordless auth, email confirmation is sufficient identity verification. The user must type their email address to confirm intent.

### Grace Period Implementation

```typescript
// Mark account for deletion (7-day grace period)
await db.update(user)
  .set({
    deletionScheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  })
  .where(eq(user.id, userId));

// Send confirmation email with cancel link
await sendEmail({
  to: user.email,
  subject: 'Account deletion scheduled',
  template: 'account-deletion-scheduled',
  data: { cancelUrl: `${BASE_URL}/app/account/cancel-deletion` }
});

// Cron job: Actually delete after grace period
await db.delete(user)
  .where(
    and(
      isNotNull(user.deletionScheduledAt),
      lt(user.deletionScheduledAt, new Date())
    )
  );
```

---

## Components

```
src/lib/components/composites/account/
├── ProfileForm.svelte           # Profile editing with auto-save
├── AvatarUpload.svelte          # Avatar with preview + crop
├── TwoFactorSetup.svelte        # 2FA setup with QR code
├── OAuthConnections.svelte      # Connected accounts list
├── ActiveSessions.svelte        # Session list with revoke
├── DataExportCard.svelte        # Export request UI
└── DeleteAccountFlow.svelte     # Multi-step deletion
```

---

## Data Model

See [../db/relational.md](../db/relational.md) for full schema.

```typescript
// userProfile (1:1 extension of Better Auth user)
export const userProfile = pgTable('user_profile', {
  userId: text('user_id').primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text('display_name'),
  bio: text('bio'),
  avatarUrl: text('avatar_url'),
  timezone: text('timezone').notNull().default('UTC'),
  locale: text('locale').notNull().default('en'),
  website: text('website'),
  location: text('location'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow()
});
```

---

## Sidebar Integration

```svelte
<NavItem href="/app/account" icon={User} hasChildren>
  Account
  {#snippet children()}
    <NavDropdown>
      <NavLink href="/app/account">Profile</NavLink>
      <NavLink href="/app/account/security">Security</NavLink>
      <NavLink href="/app/account/data">Your Data</NavLink>
    </NavDropdown>
  {/snippet}
</NavItem>
```

---

## Related

- [./sidebar.md](./sidebar.md) - User menu dropdown
- [./page-header.md](./page-header.md) - PageHeader component
- [../forms.md](../forms.md) - Superforms patterns
- [../auth.md](../auth.md) - Better Auth integration
