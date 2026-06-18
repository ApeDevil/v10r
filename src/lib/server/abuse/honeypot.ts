import { allowed, denied } from './decision';
import type { Decision } from './types';

/**
 * Honeypot field name. Hidden from real users via CSS but picked up by naive
 * bots that fill every form field. Field names like `website`, `url`,
 * `homepage` are in solver blocklists — pick something innocuous that doesn't
 * pattern-match a known honeypot. Rotate this constant if a particular form
 * starts seeing zero blocks (signal of a form-aware scraper).
 */
export const HONEYPOT_FIELD_NAME = 'bookmark';

/** Minimum form-fill time. Bots submit instantly; humans take seconds. */
export const HONEYPOT_MIN_FILL_MS = 2_000;

interface HoneypotInput {
	honeypot: string | undefined | null;
	renderedAt: number;
}

export function checkHoneypot(input: HoneypotInput): Decision {
	if (input.honeypot && input.honeypot !== '') {
		return denied('honeypot', 'Bot detected', 400);
	}
	// A forged/absent renderedAt yields a non-finite elapsed; treat that as a bot
	// rather than letting it slip the speed check.
	const elapsed = Date.now() - input.renderedAt;
	if (!Number.isFinite(elapsed) || elapsed < HONEYPOT_MIN_FILL_MS) {
		return denied('honeypot', 'Form submitted too quickly', 400);
	}
	return allowed;
}
