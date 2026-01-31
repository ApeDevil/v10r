import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Mock endpoint: Extend session expiry time
 * In production, this would refresh the session cookie/token
 */
export const POST: RequestHandler = async () => {
	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Mock: extend session by 30 minutes
	const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

	return json({
		success: true,
		expiresAt: newExpiresAt.toISOString(),
	});
};
