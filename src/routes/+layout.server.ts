import type { LayoutServerLoad } from './$types';
import type { Session } from '$lib/stores/session.svelte';

export const load: LayoutServerLoad = async ({ cookies }) => {
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

	// Read theme preference from cookie to prevent flash on full-page reload
	const raw = cookies.get('theme');
	const themeMode: 'light' | 'dark' | 'system' =
		raw === 'light' || raw === 'dark' || raw === 'system' ? raw : 'system';

	return {
		session,
		themeMode,
	};
};
