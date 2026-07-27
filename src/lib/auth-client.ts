import { passkeyClient } from '@better-auth/passkey/client';
import { emailOTPClient, magicLinkClient, twoFactorClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';

// No adminClient(): the server-side admin() plugin is deliberately not enabled
// (see server/auth/index.ts). It had zero call sites here and only widened the
// client surface toward endpoints that no longer exist.
export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	plugins: [magicLinkClient(), emailOTPClient(), twoFactorClient(), passkeyClient()],
});
