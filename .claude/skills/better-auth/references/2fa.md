# Two-Factor Authentication

TOTP-based 2FA with Better Auth.

## Contents

- [Enable 2FA Plugin](#enable-2fa-plugin) - Server config
- [Client Setup](#client-setup) - twoFactorClient
- [2FA Setup Flow](#2fa-setup-flow) - Generate secret, verify and enable
- [2FA Login Flow](#2fa-login-flow) - Handle TWO_FACTOR_REQUIRED
- [Backup Codes](#backup-codes) - Account recovery
- [Disable 2FA](#disable-2fa) - Remove 2FA from account
- [Check 2FA Status](#check-2fa-status) - UI for 2FA state
- [Trusted Devices (Optional)](#trusted-devices-optional) - Remember devices

## Enable 2FA Plugin

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { twoFactor } from 'better-auth/plugins';

export const auth = betterAuth({
  // ... base config

  plugins: [
    twoFactor({
      issuer: 'Velociraptor', // Shown in authenticator app
    }),
  ],
});
```

## Client Setup

```typescript
// src/lib/auth-client.ts
import { createAuthClient } from 'better-auth/svelte';
import { twoFactorClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
  plugins: [twoFactorClient()],
});
```

## 2FA Setup Flow

### Generate Secret

```svelte
<!-- src/routes/app/settings/2fa/+page.svelte -->
<script lang="ts">
  import { authClient } from '$lib/auth-client';

  let qrCode = $state('');
  let secret = $state('');
  let step = $state<'initial' | 'verify' | 'complete'>('initial');

  async function generateSecret() {
    const result = await authClient.twoFactor.generate();

    if (result.data) {
      qrCode = result.data.qrCode;    // Base64 QR code image
      secret = result.data.secret;     // Manual entry backup
      step = 'verify';
    }
  }
</script>

{#if step === 'initial'}
  <h2>Enable Two-Factor Authentication</h2>
  <p>Add an extra layer of security to your account.</p>
  <button onclick={generateSecret}>Set up 2FA</button>
{/if}
```

### Verify and Enable

```svelte
<script lang="ts">
  let code = $state('');
  let error = $state('');

  async function enable2FA() {
    error = '';

    const result = await authClient.twoFactor.enable({ code });

    if (result.error) {
      error = result.error.message;
      return;
    }

    step = 'complete';
  }
</script>

{#if step === 'verify'}
  <h2>Scan QR Code</h2>

  <img src={qrCode} alt="2FA QR Code" />

  <details>
    <summary>Can't scan? Enter manually</summary>
    <code>{secret}</code>
  </details>

  <form onsubmit={enable2FA}>
    <label>
      Enter code from authenticator app
      <input
        type="text"
        bind:value={code}
        placeholder="123456"
        pattern="[0-9]{6}"
        maxlength="6"
        required
      />
    </label>

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit">Verify and Enable</button>
  </form>
{/if}

{#if step === 'complete'}
  <h2>2FA Enabled!</h2>
  <p>Your account is now protected with two-factor authentication.</p>
  <a href="/app/settings">Back to settings</a>
{/if}
```

## 2FA Login Flow

When 2FA is enabled, login requires additional verification:

```svelte
<!-- src/routes/auth/login/+page.svelte -->
<script lang="ts">
  import { signIn, authClient } from '$lib/auth-client';
  import { goto } from '$app/navigation';

  let email = $state('');
  let password = $state('');
  let totpCode = $state('');
  let requires2FA = $state(false);
  let error = $state('');

  async function handleLogin() {
    error = '';

    const result = await signIn.email({ email, password });

    if (result.error) {
      // Check if 2FA is required
      if (result.error.code === 'TWO_FACTOR_REQUIRED') {
        requires2FA = true;
        return;
      }
      error = result.error.message;
      return;
    }

    goto('/app/dashboard');
  }

  async function verify2FA() {
    error = '';

    const result = await authClient.twoFactor.verify({ code: totpCode });

    if (result.error) {
      error = result.error.message;
      return;
    }

    goto('/app/dashboard');
  }
</script>

{#if !requires2FA}
  <form onsubmit={handleLogin}>
    <input type="email" bind:value={email} placeholder="Email" required />
    <input type="password" bind:value={password} placeholder="Password" required />

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit">Sign In</button>
  </form>
{:else}
  <form onsubmit={verify2FA}>
    <h2>Two-Factor Authentication</h2>
    <p>Enter the code from your authenticator app.</p>

    <input
      type="text"
      bind:value={totpCode}
      placeholder="123456"
      pattern="[0-9]{6}"
      maxlength="6"
      required
      autofocus
    />

    {#if error}
      <p class="error">{error}</p>
    {/if}

    <button type="submit">Verify</button>
  </form>
{/if}
```

## Backup Codes

Generate backup codes for account recovery:

```svelte
<script lang="ts">
  let backupCodes = $state<string[]>([]);

  async function generateBackupCodes() {
    const result = await authClient.twoFactor.generateBackupCodes();

    if (result.data) {
      backupCodes = result.data.codes;
    }
  }
</script>

<button onclick={generateBackupCodes}>Generate Backup Codes</button>

{#if backupCodes.length > 0}
  <div class="backup-codes">
    <h3>Save these backup codes</h3>
    <p>Each code can only be used once.</p>
    <ul>
      {#each backupCodes as code}
        <li><code>{code}</code></li>
      {/each}
    </ul>
  </div>
{/if}
```

## Disable 2FA

```svelte
<script lang="ts">
  let code = $state('');
  let password = $state('');

  async function disable2FA() {
    const result = await authClient.twoFactor.disable({
      code,      // Current TOTP code
      password,  // Account password for confirmation
    });

    if (!result.error) {
      goto('/app/settings');
    }
  }
</script>

<form onsubmit={disable2FA}>
  <h2>Disable 2FA</h2>

  <input
    type="password"
    bind:value={password}
    placeholder="Your password"
    required
  />

  <input
    type="text"
    bind:value={code}
    placeholder="Current 2FA code"
    required
  />

  <button type="submit">Disable 2FA</button>
</form>
```

## Check 2FA Status

```svelte
<script lang="ts">
  import { page } from '$app/state';

  // 2FA status comes from user data
  const has2FA = $derived(page.data.user?.twoFactorEnabled ?? false);
</script>

{#if has2FA}
  <p>Two-factor authentication is enabled.</p>
  <a href="/app/settings/2fa/disable">Disable 2FA</a>
{:else}
  <p>Two-factor authentication is not enabled.</p>
  <a href="/app/settings/2fa">Enable 2FA</a>
{/if}
```

## Trusted Devices (Optional)

Remember devices to skip 2FA:

```typescript
export const auth = betterAuth({
  plugins: [
    twoFactor({
      issuer: 'Velociraptor',
      trustedDevices: {
        enabled: true,
        duration: 60 * 60 * 24 * 30, // 30 days
      },
    }),
  ],
});
```

```svelte
<!-- During 2FA verification -->
<label>
  <input type="checkbox" bind:checked={trustDevice} />
  Trust this device for 30 days
</label>

<script>
  async function verify2FA() {
    await authClient.twoFactor.verify({
      code: totpCode,
      trustDevice,
    });
  }
</script>
```
