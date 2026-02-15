import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Mock endpoint: Send verification code via email
 * In production, this would generate and email an OTP
 */
export const POST: RequestHandler = async ({ request }) => {
	const { email } = await request.json();

	// Simulate email sending delay
	await new Promise((resolve) => setTimeout(resolve, 1000));

	return json({
		success: true,
		message: 'Verification code sent',
	});
};
