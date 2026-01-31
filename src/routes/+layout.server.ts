import type { LayoutServerLoad } from './$types';
import type { Session } from '$lib/stores/session.svelte';

export const load: LayoutServerLoad = async () => {
	// Mock session data for demo
	// In production, this would come from cookies/auth middleware
	const session: Session = {
		expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes from now
		user: {
			id: 'demo-user',
			email: 'demo@example.com',
			name: 'Demo User',
		},
	};

	return {
		session,
	};
};
