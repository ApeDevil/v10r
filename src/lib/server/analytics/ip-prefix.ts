/**
 * IP-in-prefix containment for bot verification, in JS.
 *
 * The containment test used to be Postgres' `$ip::inet <<= prefix::cidr`, evaluated
 * inside the per-hit INSERT. That was one operator and always right — and it meant
 * every crawler request woke the database. Bot hits now go through a Redis buffer
 * (`bot-hit-buffer.ts`), so the comparison happens here, against the prefixes the
 * ranges job publishes to Redis.
 *
 * Both families are compared as integers over their full width. An IPv4 address
 * therefore never matches an IPv6 prefix and vice versa — the same rule Postgres
 * applies (`<<=` is false across families), which is why callers unwrap
 * IPv4-mapped IPv6 first (see `normalizeIpForVerification`).
 */

interface ParsedAddress {
	family: 4 | 6;
	value: bigint;
}

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const HEX_GROUP_RE = /^[0-9a-fA-F]{1,4}$/;

function parseIpv4(text: string): bigint | null {
	const match = IPV4_RE.exec(text);
	if (!match) return null;
	let value = 0n;
	for (let i = 1; i <= 4; i++) {
		const octet = Number(match[i]);
		if (octet > 255) return null;
		value = (value << 8n) | BigInt(octet);
	}
	return value;
}

function parseIpv6(text: string): bigint | null {
	if (!/^[0-9a-fA-F:.]+$/.test(text) || text.includes(':::')) return null;

	// An embedded IPv4 tail (`::ffff:1.2.3.4`) is two trailing hex groups.
	let normalized = text;
	if (normalized.includes('.')) {
		const lastColon = normalized.lastIndexOf(':');
		const tail = parseIpv4(normalized.slice(lastColon + 1));
		if (tail === null) return null;
		normalized = `${normalized.slice(0, lastColon + 1)}${(tail >> 16n).toString(16)}:${(tail & 0xffffn).toString(16)}`;
	}

	const halves = normalized.split('::');
	if (halves.length > 2) return null;
	const head = halves[0] ? halves[0].split(':') : [];
	const tail = halves.length === 2 && halves[1] ? halves[1].split(':') : [];

	let groups: string[];
	if (halves.length === 2) {
		// `::` stands for at least one zero group.
		if (head.length + tail.length > 7) return null;
		groups = [...head, ...new Array<string>(8 - head.length - tail.length).fill('0'), ...tail];
	} else {
		groups = head;
	}
	if (groups.length !== 8) return null;

	let value = 0n;
	for (const group of groups) {
		if (!HEX_GROUP_RE.test(group)) return null;
		value = (value << 16n) | BigInt(Number.parseInt(group, 16));
	}
	return value;
}

/** Parse a bare host address. Returns null for anything that is not one. */
export function parseIpAddress(text: string): ParsedAddress | null {
	const v4 = parseIpv4(text);
	if (v4 !== null) return { family: 4, value: v4 };
	const v6 = parseIpv6(text);
	if (v6 !== null) return { family: 6, value: v6 };
	return null;
}

/**
 * Whether `ip` lies inside `prefix` (`a.b.c.d/n` or `x::/n`).
 *
 * False — never a throw — for junk on either side. A malformed feed entry must cost
 * one non-match, not the hit that tripped over it.
 */
export function ipInPrefix(ip: string, prefix: string): boolean {
	const slash = prefix.indexOf('/');
	if (slash < 1) return false;
	const bits = Number(prefix.slice(slash + 1));
	const address = parseIpAddress(ip);
	const network = parseIpAddress(prefix.slice(0, slash));
	if (!address || !network || address.family !== network.family) return false;

	const width = address.family === 4 ? 32 : 128;
	if (!Number.isInteger(bits) || bits < 0 || bits > width) return false;
	const shift = BigInt(width - bits);
	return address.value >> shift === network.value >> shift;
}
