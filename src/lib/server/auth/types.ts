import type { auth } from './index';

export type AuthSession = typeof auth.$Infer.Session.session;
export type AuthUser = typeof auth.$Infer.Session.user;

/** Shape passed to layout for client-side consumption */
export type SessionData = {
	expiresAt: Date | string;
	user: {
		id: string;
		email: string;
		name: string | null;
		image: string | null;
	};
} | null;
