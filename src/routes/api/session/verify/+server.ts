import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Mock endpoint: Verify OTP code and restore session
 * In production, this would validate the OTP and issue a new session
 */
export const POST: RequestHandler = async ({ request }) => {
	const { code } = await request.json();

	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 800));

	// Mock: accept code "123456"
	if (code === '123456') {
		// Mock: restore session with new 30-minute expiry
		const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000);

		return json({
			success: true,
			expiresAt: newExpiresAt.toISOString(),
		});
	}

	// Invalid code
	error(400, 'Invalid verification code');
};
