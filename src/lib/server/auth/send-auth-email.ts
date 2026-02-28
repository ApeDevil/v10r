import { env } from '$env/dynamic/private';

interface AuthEmailParams {
	to: string;
	subject: string;
	html: string;
}

export async function sendAuthEmail({ to, subject, html }: AuthEmailParams): Promise<void> {
	const apiKey = env.RESEND_API_KEY;
	const from = env.RESEND_FROM_EMAIL ?? 'noreply@example.com';

	if (!apiKey) {
		throw new Error('RESEND_API_KEY not configured — cannot send auth emails');
	}

	const res = await fetch('https://api.resend.com/emails', {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ from, to: [to], subject, html }),
	});

	if (!res.ok) {
		const error = await res.json().catch(() => ({ message: res.statusText }));
		throw new Error(`Auth email failed (${res.status}): ${error.message ?? 'Unknown error'}`);
	}
}

export function magicLinkTemplate(url: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sign in</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 8px;">Sign in to Velociraptor</h2>
  <p style="color: #666; line-height: 1.5; margin: 0 0 24px;">Click the button below to sign in. This link expires in 5 minutes.</p>
  <a href="${url}" style="display: inline-block; background: #18181b; color: #fff; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: 500;">Sign in</a>
  <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}

export function otpTemplate(otp: string): string {
	return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Verification code</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px; color: #1a1a1a;">
  <h2 style="margin: 0 0 8px;">Your verification code</h2>
  <p style="color: #666; line-height: 1.5; margin: 0 0 24px;">Enter this code to sign in. It expires in 5 minutes.</p>
  <div style="font-size: 32px; font-weight: 700; letter-spacing: 6px; background: #f4f4f5; padding: 16px 24px; border-radius: 8px; display: inline-block; font-family: monospace;">${otp}</div>
  <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">If you didn't request this, you can safely ignore this email.</p>
</body>
</html>`;
}
