# Session Lifecycle

Managing authentication state within the app shell: session expiry, re-authentication, and graceful degradation.

---

## Session States

| State | Condition | Shell Behavior |
|-------|-----------|----------------|
| **Valid** | Session exists, not expired | Normal operation |
| **Expiring soon** | Session expires in < 5 min | Show warning, offer extend |
| **Expired** | Session invalid/missing | Show modal, preserve form state |
| **Revoked** | Session explicitly terminated | Immediate redirect to login |

---

## Session Expiry Flow

### Warning State (5 minutes before expiry)

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   ┌────────────────────────────────────────────────────┐│
│   │ ⚠️ Your session will expire in 4 minutes          ││
│   │                                                    ││
│   │ [Stay signed in]  [Sign out]                       ││
│   └────────────────────────────────────────────────────┘│
│                                                          │
│   Sidebar        Main Content                            │
│                  (user continues working)                │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Expired State (Session invalid)

```
┌──────────────────────────────────────────────────────────┐
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
│   ░                                                    ░ │
│   ░   ┌────────────────────────────────────────────┐   ░ │
│   ░   │ 🔒 Session Expired                         │   ░ │
│   ░   │                                            │   ░ │
│   ░   │ Your session has expired. Sign in again    │   ░ │
│   ░   │ to continue where you left off.            │   ░ │
│   ░   │                                            │   ░ │
│   ░   │ Password: [••••••••••••]                   │   ░ │
│   ░   │                                            │   ░ │
│   ░   │           [Sign In]                        │   ░ │
│   ░   │                                            │   ░ │
│   ░   │ Not you? [Sign in as different user]       │   ░ │
│   ░   └────────────────────────────────────────────┘   ░ │
│   ░                                                    ░ │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────────────┘

░ = Blurred/dimmed background (shell still visible)
```

**Key UX decisions:**
- Modal overlay, not redirect (preserves context)
- Only ask for password (email pre-filled from last session)
- Form data in background is preserved
- Option to sign in as different user

---

## Implementation

### Session Monitor

```svelte
<!-- src/lib/components/shell/SessionMonitor.svelte -->
<script lang="ts">
  import { page } from '$app/state';
  import { invalidateAll } from '$app/navigation';
  import { SessionExpiryModal, SessionWarningBanner } from './session';

  let { session } = $props();

  let showWarning = $state(false);
  let showExpiredModal = $state(false);
  let timeRemaining = $state(0);

  const WARNING_THRESHOLD = 5 * 60 * 1000; // 5 minutes
  const CHECK_INTERVAL = 30 * 1000; // Check every 30 seconds

  $effect(() => {
    if (!session?.expiresAt) return;

    const checkSession = () => {
      const now = Date.now();
      const expiresAt = new Date(session.expiresAt).getTime();
      const remaining = expiresAt - now;

      timeRemaining = Math.max(0, Math.floor(remaining / 1000));

      if (remaining <= 0) {
        showWarning = false;
        showExpiredModal = true;
      } else if (remaining <= WARNING_THRESHOLD) {
        showWarning = true;
      }
    };

    checkSession();
    const interval = setInterval(checkSession, CHECK_INTERVAL);

    return () => clearInterval(interval);
  });

  async function extendSession() {
    try {
      await fetch('/api/auth/extend-session', { method: 'POST' });
      await invalidateAll();
      showWarning = false;
    } catch (error) {
      // If extend fails, session may already be expired
      showExpiredModal = true;
    }
  }

  async function handleReauthenticate(password: string) {
    try {
      const res = await fetch('/api/auth/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({ password }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        showExpiredModal = false;
        await invalidateAll();
      } else {
        throw new Error('Invalid password');
      }
    } catch (error) {
      throw error; // Let modal handle error display
    }
  }
</script>

{#if showWarning}
  <SessionWarningBanner
    {timeRemaining}
    onextend={extendSession}
    onsignout={() => goto('/auth/signout')}
  />
{/if}

{#if showExpiredModal}
  <SessionExpiryModal
    email={session?.user?.email}
    onreauthenticate={handleReauthenticate}
    onswitchuser={() => goto('/auth/signin')}
  />
{/if}
```

### Warning Banner

```svelte
<!-- src/lib/components/shell/session/SessionWarningBanner.svelte -->
<script lang="ts">
  let { timeRemaining, onextend, onsignout } = $props();

  let formatted = $derived(() => {
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = timeRemaining % 60;
    return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
  });
</script>

<div
  class="fixed top-0 left-0 right-0 z-session-warning bg-warning-subtle p-3"
  role="alert"
>
  <div class="flex items-center justify-center gap-4">
    <span class="i-lucide-clock text-warning" />
    <p>Your session will expire in {formatted}</p>
    <button class="btn btn-sm btn-primary" onclick={onextend}>
      Stay signed in
    </button>
    <button class="btn btn-sm btn-ghost" onclick={onsignout}>
      Sign out
    </button>
  </div>
</div>
```

### Expiry Modal

```svelte
<!-- src/lib/components/shell/session/SessionExpiryModal.svelte -->
<script lang="ts">
  import { Dialog } from 'bits-ui';

  let { email, onreauthenticate, onswitchuser } = $props();

  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await onreauthenticate(password);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Authentication failed';
    } finally {
      loading = false;
    }
  }
</script>

<Dialog.Root open={true} closeOnOutsideClick={false} closeOnEscape={false}>
  <Dialog.Portal>
    <Dialog.Overlay class="fixed inset-0 bg-black/50 backdrop-blur-sm z-session-modal" />
    <Dialog.Content class="fixed inset-0 flex items-center justify-center z-session-modal">
      <div class="bg-surface rounded-lg shadow-xl p-6 w-full max-w-md">
        <div class="flex items-center gap-3 mb-4">
          <span class="i-lucide-lock text-2xl text-muted" />
          <Dialog.Title class="text-xl font-semibold">
            Session Expired
          </Dialog.Title>
        </div>

        <Dialog.Description class="text-muted mb-6">
          Your session has expired. Sign in again to continue where you left off.
        </Dialog.Description>

        <form onsubmit={handleSubmit}>
          <div class="mb-4">
            <label class="text-sm text-muted">Email</label>
            <p class="font-medium">{email}</p>
          </div>

          <div class="mb-4">
            <label for="password" class="block text-sm mb-1">Password</label>
            <input
              id="password"
              type="password"
              bind:value={password}
              class="input w-full"
              required
              autofocus
            />
          </div>

          {#if error}
            <p class="text-error text-sm mb-4" role="alert">{error}</p>
          {/if}

          <button type="submit" class="btn btn-primary w-full" disabled={loading}>
            {#if loading}
              <span class="i-lucide-loader-2 animate-spin" />
            {/if}
            Sign In
          </button>
        </form>

        <div class="mt-4 text-center">
          <button class="text-sm text-muted hover:text-foreground" onclick={onswitchuser}>
            Sign in as different user
          </button>
        </div>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

---

## Server-Side Session Extension

```typescript
// src/routes/api/auth/extend-session/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, cookies }) => {
  const session = locals.session;

  if (!session) {
    throw error(401, 'No active session');
  }

  // Check if session is still valid (not expired)
  const now = new Date();
  if (new Date(session.expiresAt) < now) {
    throw error(401, 'Session already expired');
  }

  // Extend session by default duration (e.g., 7 days)
  const newExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  await db.update(session)
    .set({ expiresAt: newExpiresAt })
    .where(eq(session.id, session.id));

  // Update cookie
  cookies.set('session_token', session.token, {
    expires: newExpiresAt,
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  return json({ success: true, expiresAt: newExpiresAt.toISOString() });
};
```

---

## Re-authentication Endpoint

```typescript
// src/routes/api/auth/reauthenticate/+server.ts
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { password } = await request.json();

  // Get user from expired session cookie (if exists)
  const sessionToken = cookies.get('session_token');
  if (!sessionToken) {
    throw error(401, 'No session to restore');
  }

  // Find the expired session to get user ID
  const expiredSession = await db.query.session.findFirst({
    where: eq(session.token, sessionToken),
    with: { user: true },
  });

  if (!expiredSession?.user) {
    throw error(401, 'Session not found');
  }

  // Verify password
  const isValid = await verifyPassword(password, expiredSession.user.hashedPassword);
  if (!isValid) {
    throw error(401, 'Invalid password');
  }

  // Create new session
  const newSession = await auth.api.createSession({
    userId: expiredSession.user.id,
  });

  // Set new session cookie
  cookies.set('session_token', newSession.token, {
    expires: new Date(newSession.expiresAt),
    path: '/',
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
  });

  return json({ success: true });
};
```

---

## Preserving Form State

The key advantage of the modal approach: unsaved form data is preserved.

```svelte
<!-- User filling out a form when session expires -->
<form method="POST" use:enhance>
  <input name="title" value="My important work..." />
  <textarea name="content">Hours of writing preserved...</textarea>
  <button type="submit">Save</button>
</form>

<!--
  When session expires:
  1. Modal appears OVER the form
  2. User re-authenticates
  3. Modal closes
  4. Form is still there with all data
  5. User can continue and submit
-->
```

### Handling Submit During Expiry

```svelte
<script lang="ts">
  import { superForm } from 'sveltekit-superforms';
  import { sessionExpired } from '$lib/stores/session.svelte';

  const { enhance, submitting } = superForm(data.form, {
    onError({ result }) {
      // Check if error is due to session expiry
      if (result.status === 401) {
        sessionExpired.set(true);
        // Form data is preserved in the form element
        // User re-authenticates via modal
        // Then can retry submit
      }
    },
  });
</script>
```

---

## Session Revocation

When session is explicitly revoked (password change, admin action):

```typescript
// On 401 with specific revocation code
if (response.status === 401) {
  const data = await response.json();

  if (data.code === 'SESSION_REVOKED') {
    // No re-auth possible - must sign in fresh
    goto('/auth/signin?reason=revoked');
  } else if (data.code === 'SESSION_EXPIRED') {
    // Can re-authenticate
    showExpiredModal = true;
  }
}
```

---

## Security Considerations

### Re-authentication Rate Limiting

```typescript
// Apply strict rate limiting to re-auth endpoint
const reauthLimiter = new RateLimiter({
  IP: [5, '15m'],    // 5 attempts per 15 minutes
  IPUA: [3, '15m'],  // 3 attempts per IP+UA
});
```

### Sensitive Action Re-authentication

For high-stakes actions, require recent authentication:

```typescript
// src/lib/server/auth/require-recent-auth.ts
export async function requireRecentAuth(session: Session, maxAge = 15 * 60 * 1000) {
  const sessionAge = Date.now() - new Date(session.createdAt).getTime();

  if (sessionAge > maxAge) {
    throw error(403, {
      code: 'REAUTH_REQUIRED',
      message: 'Please re-enter your password to continue',
    });
  }
}
```

```typescript
// Usage in sensitive endpoints
export const DELETE: RequestHandler = async ({ locals }) => {
  await requireRecentAuth(locals.session, 15 * 60 * 1000); // 15 minutes

  // Proceed with account deletion
};
```

---

## Shell Integration

Add SessionMonitor to root app layout:

```svelte
<!-- src/routes/(app)/+layout.svelte -->
<script lang="ts">
  import { SessionMonitor } from '$lib/components/shell';

  let { data, children } = $props();
</script>

<div class="app-shell">
  <Sidebar />
  <main>
    {@render children()}
  </main>
  <ToastContainer />
  <SessionMonitor session={data.session} />
</div>
```

---

## Z-Index Layers

```css
:root {
  --z-session-warning: 90;  /* Below modals, above content */
  --z-session-modal: 100;   /* Above everything */
}
```

---

## Accessibility

| Requirement | Implementation |
|-------------|----------------|
| Focus trap | Modal traps focus when open |
| Auto-focus | Password input focused on open |
| Screen reader | `role="dialog"`, `aria-labelledby` |
| No escape | Cannot dismiss without action (security) |
| Live region | Warning banner uses `role="alert"` |

---

## Component Location

```
src/lib/components/shell/
├── SessionMonitor.svelte
└── session/
    ├── SessionWarningBanner.svelte
    ├── SessionExpiryModal.svelte
    └── index.ts
```

---

## Related

- [./user-account.md](./user-account.md) - Security settings, session management
- [../auth.md](../auth.md) - Better Auth session configuration
- [../middleware.md](../middleware.md) - Session validation in hooks
- [../error-handling.md](../error-handling.md) - 401 error handling
