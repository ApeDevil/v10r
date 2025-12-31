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
│   ░   │ Your session has expired.                  │   ░ │
│   ░   │ We've sent a code to john@example.com      │   ░ │
│   ░   │                                            │   ░ │
│   ░   │ Enter code: [______]                       │   ░ │
│   ░   │                                            │   ░ │
│   ░   │           [Verify]                         │   ░ │
│   ░   │                                            │   ░ │
│   ░   │ [Resend code]  [Sign in as different user] │   ░ │
│   ░   └────────────────────────────────────────────┘   ░ │
│   ░                                                    ░ │
│   ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │
└──────────────────────────────────────────────────────────┘

░ = Blurred/dimmed background (shell still visible)
```

**Key UX decisions:**
- Modal overlay, not redirect (preserves context)
- Auto-send verification code when modal opens
- OTP entry (6 digits) for quick re-authentication
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

  async function sendReauthCode() {
    try {
      await fetch('/api/auth/send-reauth-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      console.error('Failed to send code:', error);
    }
  }

  async function handleReauthenticate(code: string) {
    try {
      const res = await fetch('/api/auth/reauthenticate', {
        method: 'POST',
        body: JSON.stringify({ code }),
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        showExpiredModal = false;
        await invalidateAll();
      } else {
        throw new Error('Invalid or expired code');
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
    onsendcode={sendReauthCode}
    onswitchuser={() => goto('/auth/login')}
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

  let { email, onreauthenticate, onsendcode, onswitchuser } = $props();

  let code = $state('');
  let error = $state('');
  let loading = $state(false);
  let codeSent = $state(false);
  let resendCooldown = $state(0);

  // Auto-send code when modal opens
  $effect(() => {
    if (!codeSent) {
      sendCode();
    }
  });

  async function sendCode() {
    codeSent = true;
    resendCooldown = 60;

    const interval = setInterval(() => {
      resendCooldown--;
      if (resendCooldown <= 0) clearInterval(interval);
    }, 1000);

    await onsendcode();
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    try {
      await onreauthenticate(code);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Verification failed';
    } finally {
      loading = false;
    }
  }

  // Auto-submit when 6 digits entered
  $effect(() => {
    if (code.length === 6 && !loading) {
      handleSubmit(new Event('submit') as SubmitEvent);
    }
  });
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
          We've sent a verification code to <strong>{email}</strong>
        </Dialog.Description>

        <form onsubmit={handleSubmit}>
          <div class="mb-4">
            <label for="code" class="block text-sm mb-1">Enter 6-digit code</label>
            <input
              id="code"
              type="text"
              inputmode="numeric"
              pattern="[0-9]*"
              maxlength="6"
              bind:value={code}
              class="input w-full text-center text-2xl tracking-widest"
              placeholder="000000"
              autocomplete="one-time-code"
              autofocus
            />
          </div>

          {#if error}
            <p class="text-error text-sm mb-4" role="alert">{error}</p>
          {/if}

          <button type="submit" class="btn btn-primary w-full" disabled={loading || code.length !== 6}>
            {#if loading}
              <span class="i-lucide-loader-2 animate-spin" />
            {/if}
            Verify
          </button>
        </form>

        <div class="mt-4 flex justify-between text-sm">
          {#if resendCooldown > 0}
            <span class="text-muted">Resend in {resendCooldown}s</span>
          {:else}
            <button class="text-primary hover:underline" onclick={sendCode}>
              Resend code
            </button>
          {/if}

          <button class="text-muted hover:text-foreground" onclick={onswitchuser}>
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

## Re-authentication Endpoints

> **Use Better Auth's emailOTP plugin** for re-authentication. Don't manually generate/verify codes.

### Send Re-auth Code

```typescript
// src/routes/api/auth/send-reauth-code/+server.ts
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ cookies }) => {
  // Get user email from expired session cookie
  const sessionToken = cookies.get('session_token');
  if (!sessionToken) {
    throw error(401, 'No session to restore');
  }

  const expiredSession = await db.query.session.findFirst({
    where: eq(session.token, sessionToken),
    with: { user: true },
  });

  if (!expiredSession?.user) {
    throw error(401, 'Session not found');
  }

  // Use Better Auth's emailOTP plugin to send verification code
  // The plugin handles storage, expiration, and rate limiting
  await auth.api.sendVerificationOtp({
    body: {
      email: expiredSession.user.email,
      type: 'sign-in',
    },
  });

  return json({ success: true, email: expiredSession.user.email });
};
```

### Verify Re-auth Code

```typescript
// src/routes/api/auth/reauthenticate/+server.ts
import { json, error } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, cookies }) => {
  const { code } = await request.json();

  // Get user email from expired session cookie
  const sessionToken = cookies.get('session_token');
  if (!sessionToken) {
    throw error(401, 'No session to restore');
  }

  const expiredSession = await db.query.session.findFirst({
    where: eq(session.token, sessionToken),
    with: { user: true },
  });

  if (!expiredSession?.user) {
    throw error(401, 'Session not found');
  }

  // Use Better Auth's emailOTP plugin to verify
  // This handles attempt tracking, expiration, and creates a new session on success
  const result = await auth.api.verifyEmailOtp({
    body: {
      email: expiredSession.user.email,
      otp: code,
    },
  });

  if (!result?.session) {
    throw error(401, 'Invalid or expired code');
  }

  // Better Auth sets the session cookie automatically
  // Clean up the old expired session
  await db.delete(session).where(eq(session.token, sessionToken));

  return json({ success: true });
};
```

> **Security notes:**
> - Better Auth's emailOTP plugin enforces `allowedAttempts: 3` per code
> - Failed attempts are tracked server-side (not bypassable)
> - After 3 failures, user must request a new code
> - Rate limiting is configured via `customRules` in auth config

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

When session is explicitly revoked (security event, admin action):

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
      message: 'Please verify your identity to continue',
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
| Auto-focus | Code input focused on open |
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
