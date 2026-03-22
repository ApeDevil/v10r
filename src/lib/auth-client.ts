import { adminClient, emailOTPClient, magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/svelte';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	plugins: [adminClient(), magicLinkClient(), emailOTPClient()],
});
