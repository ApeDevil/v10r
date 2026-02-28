import { createAuthClient } from 'better-auth/svelte';
import { magicLinkClient, emailOTPClient } from 'better-auth/client/plugins';

export const authClient = createAuthClient({
	baseURL: typeof window !== 'undefined' ? window.location.origin : '',
	plugins: [magicLinkClient(), emailOTPClient()],
});
