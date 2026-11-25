/**
 * Egress address policy — may a server-side request go to this address?
 *
 * Every outbound client v10r runs on behalf of a configured peer (the MCP client, the A2A
 * client) faces the same SSRF question: a URL that names, or resolves to, loopback, a private
 * network, link-local (the cloud metadata service at 169.254.169.254 among them), CGNAT,
 * documentation, benchmarking, multicast or reserved space must not be reached unless the
 * operator said so. The two clients were built separately and each wrote this
 * classification; it is one responsibility, so it lives here once, and each client keeps
 * only its own policy (allowlists, schemes, credentials) on top.
 *
 * Two ways to use it. `resolvePublicAddresses` answers "is this host public?" and leaves the
 * connect to `fetch`, which resolves again — so a rebinding resolver is narrowed (callers check
 * per request), not closed; the A2A client still works this way, bounded by its allowlist.
 * `resolvePinnedAddress` answers "which address may this request connect to?": it resolves
 * once, validates every answer, and returns the one address the caller must connect to
 * (`pinned-fetch.ts`), so there is no second lookup to rebind. The MCP client uses that one.
 *
 * Private access is never a blanket flag: an operator lists exact `PrivateDestination`s (a
 * narrow CIDR and one port), default none, and link-local space — the cloud metadata service —
 * cannot be listed at all.
 */
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/** Resolve a host name to its addresses. Injected in tests; `node:dns` otherwise. */
export type ResolveHost = (hostname: string) => Promise<string[]>;

export const resolveWithDns: ResolveHost = async (hostname) =>
	(await lookup(hostname, { all: true, verbatim: true })).map((entry) => entry.address);

function ipv4Octets(address: string): number[] | null {
	const parts = address.split('.');
	if (parts.length !== 4) return null;
	const octets = parts.map(Number);
	return octets.every((o, i) => /^\d{1,3}$/.test(parts[i] ?? '') && o <= 255) ? octets : null;
}

function isNonPublicIpv4([a = 0, b = 0, c = 0]: number[]): boolean {
	return (
		a === 0 || // "this network"
		a === 10 ||
		a === 127 ||
		(a === 100 && b >= 64 && b <= 127) || // CGNAT, shared address space
		(a === 169 && b === 254) || // link-local, incl. the 169.254.169.254 metadata service
		(a === 172 && b >= 16 && b <= 31) ||
		(a === 192 && b === 168) ||
		(a === 192 && b === 0 && (c === 0 || c === 2)) || // IETF assignments, TEST-NET-1
		(a === 198 && (b === 18 || b === 19)) || // benchmarking
		(a === 198 && b === 51 && c === 100) || // TEST-NET-2
		(a === 203 && b === 0 && c === 113) || // TEST-NET-3
		a >= 224 // multicast, reserved, broadcast
	);
}

/** The eight 16-bit groups of an IPv6 address, or null. Handles `::` and an embedded IPv4 tail. */
function ipv6Groups(address: string): number[] | null {
	let text = address.toLowerCase().replace(/%.*$/, '');
	const v4Tail = text.match(/(\d{1,3}(?:\.\d{1,3}){3})$/);
	if (v4Tail?.[1]) {
		const octets = ipv4Octets(v4Tail[1]);
		if (!octets) return null;
		const [a = 0, b = 0, c = 0, d = 0] = octets;
		text = `${text.slice(0, -v4Tail[1].length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
	}
	const halves = text.split('::');
	if (halves.length > 2) return null;
	const parse = (part: string) => (part === '' ? [] : part.split(':').map((g) => Number.parseInt(g, 16)));
	const head = parse(halves[0] ?? '');
	const tail = halves.length === 2 ? parse(halves[1] ?? '') : [];
	const fill = 8 - head.length - tail.length;
	if (halves.length === 1 ? head.length !== 8 : fill < 1) return null;
	const groups = [...head, ...Array(halves.length === 2 ? fill : 0).fill(0), ...tail];
	return groups.every((g) => Number.isInteger(g) && g >= 0 && g <= 0xffff) ? groups : null;
}

function embeddedIpv4(g6: number, g7: number): number[] {
	return [g6 >> 8, g6 & 0xff, g7 >> 8, g7 & 0xff];
}

function isNonPublicIpv6(groups: number[]): boolean {
	const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
	const leadingZero = g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0;
	if (leadingZero && g5 === 0 && g6 === 0 && (g7 === 0 || g7 === 1)) return true; // :: and ::1
	// IPv4-mapped (::ffff:a.b.c.d, also in hex form) and IPv4-compatible: judge the IPv4 address.
	if (leadingZero && (g5 === 0xffff || g5 === 0)) return isNonPublicIpv4(embeddedIpv4(g6, g7));
	if ((g0 & 0xfe00) === 0xfc00) return true; // fc00::/7 unique-local (fd00:ec2::254 metadata included)
	if ((g0 & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
	if ((g0 & 0xffc0) === 0xfec0) return true; // fec0::/10 site-local (deprecated, still routable inside)
	if ((g0 & 0xff00) === 0xff00) return true; // multicast
	if (g0 === 0x2001 && g1 === 0x0db8) return true; // documentation
	if (g0 === 0x64 && g1 === 0xff9b) return isNonPublicIpv4(embeddedIpv4(g6, g7)); // NAT64
	return false;
}

/** True for an address no public peer can have. A string that is not an IP address is non-public. */
export function isNonPublicAddress(address: string): boolean {
	const host = address.replace(/^\[|\]$/g, '');
	const family = isIP(host);
	if (family === 4) {
		const octets = ipv4Octets(host);
		return octets ? isNonPublicIpv4(octets) : true;
	}
	if (family === 6) {
		const groups = ipv6Groups(host);
		return groups ? isNonPublicIpv6(groups) : true;
	}
	return true;
}

/** True for 127.0.0.0/8, ::1 and their IPv4-mapped forms. */
export function isLoopbackAddress(address: string): boolean {
	const host = address.replace(/^\[|\]$/g, '');
	if (isIP(host) === 4) return host.startsWith('127.');
	const groups = isIP(host) === 6 ? ipv6Groups(host) : null;
	if (!groups) return false;
	if (groups.slice(0, 7).every((g) => g === 0) && groups[7] === 1) return true;
	const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === 0xffff;
	return mapped && groups[6] >> 8 === 127;
}

export type PublicResolution =
	| { ok: true; addresses: string[] }
	| { ok: false; reason: 'unresolvable'; message: string }
	| { ok: false; reason: 'non_public'; message: string; address: string };

/**
 * Resolve `hostname` (an IP literal resolves to itself) and require every answer to be public.
 * One non-public answer refuses the host: a resolver returning a public and a private address
 * must not get to choose.
 */
export async function resolvePublicAddresses(
	hostname: string,
	resolveHost: ResolveHost = resolveWithDns,
): Promise<PublicResolution> {
	const host = hostname.replace(/^\[|\]$/g, '');
	let addresses: string[];
	if (isIP(host) !== 0) {
		addresses = [host];
	} else {
		try {
			addresses = await resolveHost(host);
		} catch {
			return { ok: false, reason: 'unresolvable', message: `${host} does not resolve` };
		}
	}
	if (addresses.length === 0) return { ok: false, reason: 'unresolvable', message: `${host} does not resolve` };
	const blocked = addresses.find(isNonPublicAddress);
	if (blocked) return { ok: false, reason: 'non_public', address: blocked, message: `${host} resolves to ${blocked}` };
	return { ok: true, addresses };
}

// ── private destinations: the operator's explicit exceptions ──────────────────────────────

/**
 * One private destination an operator vouches for: an address range in CIDR form and the one
 * port it may be reached on. Matched against the RESOLVED address, never a host name — a name
 * is exactly what a rebinding resolver controls.
 */
export interface PrivateDestination {
	cidr: string;
	port: number;
}

export type PrivateDestinationProblem = 'invalid_cidr' | 'invalid_port' | 'too_broad' | 'link_local';

/** The widest range a private destination may name: a /24 (IPv4), a /120 (IPv6). */
export const MIN_PRIVATE_PREFIX = { 4: 24, 6: 120 } as const;

interface AddressBits {
	family: 4 | 6;
	value: bigint;
}

/** The address as an integer; an IPv4-mapped IPv6 address is read as its IPv4 address. */
function addressBits(address: string): AddressBits | null {
	const host = address.replace(/^\[|\]$/g, '');
	const family = isIP(host);
	if (family === 4) {
		const octets = ipv4Octets(host);
		return octets ? { family: 4, value: octets.reduce((acc, o) => (acc << 8n) | BigInt(o), 0n) } : null;
	}
	if (family !== 6) return null;
	const groups = ipv6Groups(host);
	if (!groups) return null;
	const [g0 = 0, g1 = 0, g2 = 0, g3 = 0, g4 = 0, g5 = 0, g6 = 0, g7 = 0] = groups;
	if (g0 === 0 && g1 === 0 && g2 === 0 && g3 === 0 && g4 === 0 && g5 === 0xffff) {
		return { family: 4, value: (BigInt(g6) << 16n) | BigInt(g7) };
	}
	return { family: 6, value: groups.reduce((acc, g) => (acc << 16n) | BigInt(g), 0n) };
}

interface ParsedCidr {
	family: 4 | 6;
	/** The network bits, shifted down: `address >> (width - prefix)`. */
	network: bigint;
	prefix: number;
}

function parseCidr(cidr: string): ParsedCidr | null {
	const [address = '', prefixText, extra] = cidr.split('/');
	if (extra !== undefined) return null;
	const bits = addressBits(address);
	if (!bits) return null;
	const width = bits.family === 4 ? 32 : 128;
	if (prefixText !== undefined && !/^\d{1,3}$/.test(prefixText)) return null;
	const prefix = prefixText === undefined ? width : Number(prefixText);
	if (prefix > width) return null;
	return { family: bits.family, network: bits.value >> BigInt(width - prefix), prefix };
}

function inRange(bits: AddressBits, range: ParsedCidr): boolean {
	const width = bits.family === 4 ? 32 : 128;
	return bits.family === range.family && bits.value >> BigInt(width - range.prefix) === range.network;
}

/** 169.254.0.0/16 and fe80::/10: where the metadata service lives; never reachable by exception. */
function isLinkLocal(bits: AddressBits): boolean {
	if (bits.family === 4) return bits.value >> 16n === 0xa9fen;
	return bits.value >> 118n === 0x3fan;
}

/** Problems with one destination entry, empty when it is usable. */
export function privateDestinationProblems(destination: PrivateDestination): PrivateDestinationProblem[] {
	const problems: PrivateDestinationProblem[] = [];
	if (!Number.isInteger(destination.port) || destination.port < 1 || destination.port > 65_535) {
		problems.push('invalid_port');
	}
	const range = parseCidr(destination.cidr);
	if (!range) return [...problems, 'invalid_cidr'];
	if (range.prefix < MIN_PRIVATE_PREFIX[range.family]) problems.push('too_broad');
	const width = range.family === 4 ? 32 : 128;
	if (isLinkLocal({ family: range.family, value: range.network << BigInt(width - range.prefix) })) {
		problems.push('link_local');
	}
	return problems;
}

/**
 * True when the operator listed this exact address and port. Link-local is refused whatever the
 * list says, and so is an entry that fails `privateDestinationProblems`.
 */
export function isAllowedPrivateDestination(
	address: string,
	port: number,
	destinations: readonly PrivateDestination[] = [],
): boolean {
	const bits = addressBits(address);
	if (!bits || isLinkLocal(bits)) return false;
	return destinations.some((destination) => {
		if (destination.port !== port || privateDestinationProblems(destination).length > 0) return false;
		const range = parseCidr(destination.cidr);
		return range !== null && inRange(bits, range);
	});
}

// ── connect-time pinning ──────────────────────────────────────────────────────────────────

export type PinnedResolution =
	| { ok: true; address: string; addresses: string[] }
	| { ok: false; reason: 'unresolvable'; message: string }
	| { ok: false; reason: 'non_public'; message: string; address: string };

export interface PinOptions {
	resolveHost?: ResolveHost;
	/** The operator's exceptions for private addresses; default none. */
	privateDestinations?: readonly PrivateDestination[];
}

/**
 * Resolve `hostname` ONCE and return the address the request must connect to. Every answer
 * must be public or a listed private destination on this `port` — one bad answer refuses the
 * host, so a resolver cannot mix a private address in and let the socket pick it. The caller
 * connects to `address` (`fetchPinned`), never to the name again.
 */
export async function resolvePinnedAddress(
	hostname: string,
	port: number,
	options: PinOptions = {},
): Promise<PinnedResolution> {
	const host = hostname.replace(/^\[|\]$/g, '');
	let addresses: string[];
	if (isIP(host) !== 0) {
		addresses = [host];
	} else {
		try {
			addresses = await (options.resolveHost ?? resolveWithDns)(host);
		} catch {
			return { ok: false, reason: 'unresolvable', message: `${host} does not resolve` };
		}
	}
	const [first] = addresses;
	if (first === undefined) return { ok: false, reason: 'unresolvable', message: `${host} does not resolve` };
	const blocked = addresses.find(
		(address) =>
			isNonPublicAddress(address) && !isAllowedPrivateDestination(address, port, options.privateDestinations),
	);
	if (blocked !== undefined) {
		return { ok: false, reason: 'non_public', address: blocked, message: `${host} resolves to ${blocked}` };
	}
	return { ok: true, address: first, addresses };
}
