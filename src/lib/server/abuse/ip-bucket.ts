/**
 * Bucket keys for IP-keyed rate limiters.
 *
 * Framework-free by design: the same key must be derivable from a job, an AI tool, or a
 * request. Reading the address off a request is the adapter's job (`http/client-ip.ts`).
 */

/**
 * Collapse an address to the unit we are willing to rate-limit.
 *
 * A raw address string is the wrong bucket key for IPv6. Residential IPv6
 * allocations are a /64 or larger, so keying the full address hands one client
 * 2^64 independent buckets — the per-IP limiter becomes decorative against
 * anyone who can rotate within their own prefix. (Better Auth shipped the same
 * bug as CVE-2026-45364; v10r keys its own buckets, so the fix belongs here.)
 * Masking to /64 makes the bucket track the allocation rather than the address.
 *
 * Also folds the three ways one address can be spelled differently — case, a
 * zone id, and IPv4-mapped form — so they cannot each claim a fresh bucket.
 *
 * Deliberately NOT applied to `locals.clientIp`: audit records and abuse logs
 * want the address that actually connected. This is only ever a bucket key.
 */
/**
 * The bucket key an IP-keyed limiter should actually use.
 *
 * Two things every call site was getting wrong on its own:
 *
 *  1. Passing the raw address, which makes the limiter decorative against an
 *     IPv6 client (see `normalizeIpKey`).
 *  2. Skipping the limiter entirely when the address is unknown — several
 *     routes wrapped the call in `if (ip)`, so "no IP" meant "no limit", which
 *     is the wrong way round. An unknown origin is the one you least want to
 *     serve without a bound. They now share a single `anon` bucket: coarse, and
 *     coarse is correct, because we cannot tell those callers apart.
 *
 * The `ip:` prefix keeps the namespace distinct from user-id buckets on the
 * routes that key by either.
 */
export function ipLimitKey(ip: string | null | undefined): string {
	return `ip:${normalizeIpKey(ip) ?? 'anon'}`;
}

export function normalizeIpKey(ip: string | null | undefined): string | null {
	if (!ip) return null;

	// A zone id (`fe80::1%eth0`) is link-local routing metadata, never identity.
	let addr = ip.trim().toLowerCase().split('%')[0];
	if (!addr) return null;

	// `[::1]:443` → `::1`. Bracketed form shows up in Host-style sources.
	if (addr.startsWith('[')) {
		const close = addr.indexOf(']');
		if (close > 0) addr = addr.slice(1, close);
	}

	// IPv4-mapped IPv6 (`::ffff:1.2.3.4`) is an IPv4 client; key it as IPv4 so
	// it shares a bucket with the same client arriving unmapped.
	const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(addr);
	if (mapped) return mapped[1];

	// No colon ⇒ IPv4 (or unparseable). Key it whole — IPv4 scarcity makes
	// per-address the right granularity.
	if (!addr.includes(':')) return addr;

	return `${ipv6Prefix64(addr)}::/64`;
}

/**
 * First four hextets of an IPv6 address, normalised — i.e. its /64.
 *
 * Avoids needing a full address parser: a `::` run only ever expands to
 * zeroes, so it is enough to know how many are missing.
 */
function ipv6Prefix64(addr: string): string {
	const [head, tail] = addr.includes('::') ? addr.split('::', 2) : [addr, null];
	const headParts = head ? head.split(':').filter(Boolean) : [];

	let parts: string[];
	if (tail === null) {
		parts = headParts;
	} else {
		const tailParts = tail ? tail.split(':').filter(Boolean) : [];
		const zeros = Math.max(0, 8 - headParts.length - tailParts.length);
		parts = [...headParts, ...Array(zeros).fill('0'), ...tailParts];
	}

	while (parts.length < 4) parts.push('0');
	// Re-render each hextet so `0db8` and `db8` cannot key differently.
	return parts
		.slice(0, 4)
		.map((h) => (Number.parseInt(h, 16) || 0).toString(16))
		.join(':');
}
