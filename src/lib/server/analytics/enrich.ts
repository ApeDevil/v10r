/**
 * SESSION ENRICHMENT — derives `country`, `device` and `browser` for a session.
 *
 * The collector must populate all three, or every dashboard split renders
 * `unknown` / `??` against real traffic while looking fine against seed data.
 *
 * ## Consent tiers differ per field, and the reason is legal, not stylistic
 *
 * - **country** comes from `x-vercel-ip-country`, which the edge derives from
 *   the *connection*. Nothing is read from or written to the visitor's device,
 *   so ePrivacy Art 5(3) / TDDDG §25 does not engage and it is collectable at
 *   the `necessary` tier. It remains personal data under GDPR (an IP-derived
 *   attribute), covered by the same Art 6(1)(f) basis as the rest of the lane.
 *
 * - **device + browser** are parsed from the User-Agent, which reports the
 *   terminal's own configuration. That is squarely the material Art 29 WP
 *   Opinion 9/2014 treats as device information, so these are gated at the
 *   `analytics` tier — matching what the sessions schema already promises.
 *
 * ## Deliberately coarse
 *
 * The classifier returns a small closed set, never the raw UA string and never
 * a version number. Two reasons: bounded cardinality on `GROUP BY`, and — more
 * importantly — precision here is fingerprinting surface. The visitor hash is
 * built from `ip:ua` and its defensibility depends on adding NO further
 * entropy; storing a richer device profile alongside it would undercut exactly
 * that argument. Coarse is the point, not a limitation.
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type BrowserFamily = 'chrome' | 'safari' | 'firefox' | 'edge' | 'opera' | 'samsung' | 'other';

export interface UserAgentClass {
	device: DeviceType;
	browser: BrowserFamily;
}

/**
 * Two-letter ISO 3166-1 country from the Vercel edge, or undefined off-platform.
 *
 * Validated against the column's `char(2)` shape rather than trusted: the header
 * is absent in local dev and in the container, and `ZZ`/empty values appear for
 * unroutable addresses.
 */
export function geoFromHeaders(headers: Headers): string | undefined {
	const raw = headers.get('x-vercel-ip-country');
	if (!raw) return undefined;
	const code = raw.trim().toUpperCase();
	if (!/^[A-Z]{2}$/.test(code)) return undefined;
	// Vercel emits ZZ for addresses it cannot place; storing it would be noise
	// dressed up as a country.
	return code === 'ZZ' ? undefined : code;
}

/**
 * Coarse device + browser family from a User-Agent string.
 *
 * Order is load-bearing: Edge advertises `Chrome` and `Safari`, Chrome
 * advertises `Safari`, and Opera advertises `Chrome` — so the most specific
 * token has to win first.
 *
 * Known and accepted blind spot: iPadOS 13+ Safari identifies as `Macintosh`
 * and is counted as desktop. Distinguishing it needs a touch-points or
 * screen-size probe, which is precisely the added entropy this module refuses
 * to collect. A small, honest undercount of tablets beats a fingerprint.
 */
export function classifyUserAgent(userAgent: string): UserAgentClass {
	const ua = userAgent.toLowerCase();

	let browser: BrowserFamily = 'other';
	if (ua.includes('edg/') || ua.includes('edga/') || ua.includes('edgios/')) browser = 'edge';
	else if (ua.includes('opr/') || ua.includes('opera')) browser = 'opera';
	else if (ua.includes('samsungbrowser')) browser = 'samsung';
	else if (ua.includes('firefox') || ua.includes('fxios')) browser = 'firefox';
	else if (ua.includes('chrome') || ua.includes('crios') || ua.includes('chromium')) browser = 'chrome';
	else if (ua.includes('safari')) browser = 'safari';

	let device: DeviceType = 'desktop';
	if (ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile')) || ua.includes('tablet')) {
		device = 'tablet';
	} else if (ua.includes('mobi') || ua.includes('iphone') || ua.includes('ipod') || ua.includes('android')) {
		device = 'mobile';
	}

	return { device, browser };
}
