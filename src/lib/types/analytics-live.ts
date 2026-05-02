/**
 * Shared types for the live admin activity feed. Importable from both server
 * and client (no runtime code).
 */
export interface LiveEvent {
	id: number;
	ts: string;
	sessionId: string;
	visitorFragment: string;
	path: string;
	device: string | null;
	country: string | null;
	consentTier: 'necessary' | 'analytics' | 'full';
	isPaired: boolean;
}
