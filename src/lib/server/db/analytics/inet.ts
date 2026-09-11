/**
 * What may reach an `::inet` / `::cidr` cast.
 *
 * Both casts throw, and they throw inside the INSERT that carries them — so a bad
 * value from a feed document or a request header would fail the range refresh or the
 * session write that happened to carry it, not the input that caused it. These checks
 * stand between third-party text and the cast, and they belong to the sink because
 * the cast is the sink's: the `<<=` containment test in `upsertSession` is where the
 * family rule below bites, and the in-process crawler check (`analytics/ip-prefix.ts`)
 * mirrors that rule on purpose.
 */

/**
 * Shape-check a CIDR string before it can reach a `::cidr` cast.
 *
 * These documents are third-party input. A malformed prefix stored here would not
 * be a security problem — it is bound as a parameter, never spliced — but it
 * would make the verification query throw on a cast deep inside an INSERT, which
 * fails the hit that tripped over it rather than the feed that caused it.
 * Rejecting at ingest keeps the bad value out of the table entirely.
 */
export function isValidPrefix(prefix: string): boolean {
	const slash = prefix.indexOf('/');
	if (slash < 1) return false;
	const addr = prefix.slice(0, slash);
	const bits = Number(prefix.slice(slash + 1));
	if (!Number.isInteger(bits) || bits < 0) return false;

	if (addr.includes(':')) {
		if (bits > 128) return false;
		return /^[0-9a-fA-F:.]+$/.test(addr) && !addr.includes(':::');
	}

	if (bits > 32) return false;
	const octets = addr.split('.');
	if (octets.length !== 4) return false;
	return octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/**
 * Shape-check a bare IP address before it can reach an `::inet` cast.
 *
 * Deliberately NOT `normalizeIpKey` from `$lib/server/abuse`: that function
 * returns a `/64` CIDR for IPv6 because it exists to build rate-limit buckets.
 * Containment needs the full host address — a `/64` would both fail the `::inet`
 * cast and, if it survived one, silently widen every IPv6 comparison to a whole
 * allocation.
 *
 * Permissive by design. Postgres is the real parser; this only has to keep
 * obvious junk from a header away from a cast that throws inside an INSERT.
 */
export function isPlausibleIpAddress(ip: string): boolean {
	if (ip.length === 0 || ip.length > 45) return false;

	if (ip.includes(':')) {
		if (!/^[0-9a-fA-F:.]+$/.test(ip)) return false;
		// `::` may appear once; three colons in a row is never valid.
		if (ip.includes(':::')) return false;
		return ip.split('::').length <= 2;
	}

	const octets = ip.split('.');
	if (octets.length !== 4) return false;
	return octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255);
}

/**
 * Reduce a client address to the exact form the `<<= cidr` test needs, or null.
 *
 * ## The IPv4-mapped IPv6 trap
 *
 * Postgres treats `::ffff:1.2.3.4` as a member of the IPv6 family, and `<<=`
 * returns FALSE when the two operands are different families — silently, with no
 * error. Verified against Neon on 2026-08-03:
 *
 *   '132.196.86.42'::inet       <<= '132.196.86.0/24'::cidr  → true
 *   '::ffff:132.196.86.42'::inet <<= '132.196.86.0/24'::cidr  → FALSE
 *
 * Every operator publishes plain IPv4 prefixes. So an unwrapped mapped address
 * matches nothing, and the verdict falls through to `spoofed` — reporting a
 * legitimate GPTBot as an impersonator. A verification column whose
 * failure mode is inventing attacks is worse than no verification column, so the
 * unwrapping happens here, before the value can reach the comparison.
 *
 * Also strips a zone id and brackets, which arrive from proxy and Host-style
 * sources. Returns null when nothing usable survives, which the caller renders as
 * `unchecked` — never as a verdict about the caller.
 */
export function normalizeIpForVerification(ip: string | null | undefined): string | null {
	if (!ip) return null;

	let addr = ip.trim().toLowerCase().split('%')[0] ?? '';
	if (addr.startsWith('[')) {
		const close = addr.indexOf(']');
		if (close > 0) addr = addr.slice(1, close);
	}

	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
	if (mapped?.[1]) addr = mapped[1];

	return isPlausibleIpAddress(addr) ? addr : null;
}
