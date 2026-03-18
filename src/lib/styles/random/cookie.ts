/**
 * Style cookie serialization/deserialization.
 * Cookie is non-httpOnly so the app.html blocking script can read it.
 */

import type { PaletteId, StyleConfig, StyleCookie, TypographyId } from './types';

export const STYLE_COOKIE_NAME = 'v10r_style';

export const STYLE_COOKIE_OPTIONS = {
	path: '/',
	httpOnly: false,
	secure: typeof process !== 'undefined' ? process.env.NODE_ENV === 'production' : true,
	sameSite: 'lax' as const,
	maxAge: 60 * 60 * 24 * 365, // 1 year
};

/** Serialize a StyleConfig into a cookie value string */
export function serializeStyleCookie(config: StyleConfig): string {
	const cookie: StyleCookie = {
		pid: config.paletteId,
		tid: config.typographyId,
		lck: config.locked,
		v: 1,
	};
	return JSON.stringify(cookie);
}

/** Parse a cookie value string into a StyleConfig. Returns null on invalid input. */
export function parseStyleCookie(value: string | undefined): StyleConfig | null {
	if (!value) return null;

	try {
		const parsed: StyleCookie = JSON.parse(value);
		if (parsed.v !== 1 || typeof parsed.pid !== 'string' || typeof parsed.tid !== 'string') {
			return null;
		}
		return {
			paletteId: parsed.pid as PaletteId,
			typographyId: parsed.tid as TypographyId,
			locked: Boolean(parsed.lck),
		};
	} catch {
		return null;
	}
}
