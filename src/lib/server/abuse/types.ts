/**
 * Outcome of an abuse-prevention check (captcha, rate-limit, honeypot).
 *
 * `allowed: true` means the request may proceed.
 * Layered checks compose by short-circuiting on the first denial.
 */
export type Decision =
	| { allowed: true }
	| {
			allowed: false;
			layer: 'altcha' | 'honeypot' | 'rate-limit';
			reason: string;
			status: 400 | 403 | 429;
			retryAfterMs?: number;
	  };
