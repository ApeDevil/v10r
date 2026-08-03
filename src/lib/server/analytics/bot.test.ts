/**
 * The bot lane's pure logic: classification, admission, and the two shape checks
 * that stand between third-party text and a Postgres cast.
 *
 * No mocks and no database — everything here is a pure function over strings, and
 * that is deliberate. The parts that touch the DB (`recordBotHit`) put their
 * guarantees in CHECK constraints instead, where a caller cannot forget them.
 */

import { describe, expect, it } from 'vitest';
import { isAgentSurface, isBotTrackablePath } from '$lib/analytics/collect-policy';
import { classifyBot, KNOWN_BOT_FAMILIES } from './bot-classify';
import { isPlausibleIpAddress, isValidPrefix, normalizeIpForVerification, parsePrefixes } from './bot-ranges';

describe('classifyBot — ordering', () => {
	it('separates a live user-driven fetch from training-corpus collection', () => {
		// THE ordering hazard. Both OpenAI UAs contain "GPT"; if `gptbot` were tested
		// first, every ChatGPT-User fetch would be filed as ai_training and the
		// distinction the ai_agent category exists to draw would silently vanish.
		expect(classifyBot('Mozilla/5.0 ChatGPT-User/1.0; +https://openai.com/bot')).toMatchObject({
			family: 'chatgpt-user',
			category: 'ai_agent',
		});
		expect(classifyBot('Mozilla/5.0 (compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toMatchObject({
			family: 'gptbot',
			category: 'ai_training',
		});
	});

	it('separates Claude-User from ClaudeBot', () => {
		expect(classifyBot('Claude-User/1.0')).toMatchObject({ family: 'claude-user', category: 'ai_agent' });
		expect(classifyBot('ClaudeBot/1.0')).toMatchObject({ family: 'claudebot', category: 'ai_training' });
	});

	it('routes OAI-SearchBot to ai_search, not to the GPTBot bucket', () => {
		expect(classifyBot('Mozilla/5.0 OAI-SearchBot/1.0')).toMatchObject({
			family: 'oai-searchbot',
			category: 'ai_search',
		});
	});
});

describe('classifyBot — verification routing', () => {
	it.each([
		['Mozilla/5.0 (compatible; GPTBot/1.2)', 'openai'],
		['ClaudeBot/1.0', 'anthropic'],
		['Mozilla/5.0 (compatible; Googlebot/2.1)', 'google'],
		['Mozilla/5.0 (compatible; bingbot/2.0)', 'bing'],
		['PerplexityBot/1.0', 'perplexity'],
	])('%s is checkable against %s', (ua, source) => {
		expect(classifyBot(ua).rangeSource).toBe(source);
	});

	it('leaves rangeSource null for operators that publish no list', () => {
		// null must yield `unpublished`, NOT `spoofed`. Marking an honest crawler as
		// an impersonator because its operator has no feed is the single most
		// damaging way this column could be wrong.
		expect(classifyBot('CCBot/2.0').rangeSource).toBeNull();
		expect(classifyBot('Bytespider').rangeSource).toBeNull();
	});
});

describe('classifyBot — bounded output', () => {
	it('never echoes caller text back as a family', () => {
		const hostile = classifyBot(`Mozilla/5.0 (compatible; ${'A'.repeat(500)}/1.0)`);
		expect(hostile.family).toBe('other');
		expect(hostile.category).toBe('unclassified');
	});

	it('only ever emits a family from the closed list', () => {
		const uas = ['GPTBot/1.2', 'curl/8.5.0', 'Googlebot/2.1', '', 'something novel', 'ZGrab'];
		for (const ua of uas) {
			expect(KNOWN_BOT_FAMILIES).toContain(classifyBot(ua).family);
		}
	});

	it('every family fits the 32-char database CHECK', () => {
		for (const family of KNOWN_BOT_FAMILIES) {
			expect(family.length).toBeLessThanOrEqual(32);
		}
	});
});

describe('isBotTrackablePath', () => {
	it.each(['/llms.txt', '/robots.txt', '/sitemap.xml', '/docs/stack/bun.md'])('admits the agent surface %s', (p) => {
		// The human lane refuses every one of these — it treats any dot as a static
		// asset. Reusing that rule here would discard the highest-signal fetches on
		// the whole site.
		expect(isBotTrackablePath(p)).toBe(true);
	});

	it.each(['/admin', '/account/security', '/desk'])('admits the authenticated surface %s', (p) => {
		// Barred from the anonymous human lane to keep identified people out of it.
		// A crawler is not a person, and a probe of /admin is the row worth having.
		expect(isBotTrackablePath(p)).toBe(true);
	});

	it.each(['/api/analytics/journey', '/_app/immutable/chunk.js'])('refuses the internal path %s', (p) => {
		expect(isBotTrackablePath(p)).toBe(false);
	});

	it.each(['/favicon.ico', '/og.png', '/fonts/inter.woff2', '/app.css'])('refuses the asset %s', (p) => {
		expect(isBotTrackablePath(p)).toBe(false);
	});

	it('admits ordinary pages', () => {
		expect(isBotTrackablePath('/')).toBe(true);
		expect(isBotTrackablePath('/blog/some-post')).toBe(true);
	});

	it('is locale-blind, like every other rule in the policy', () => {
		expect(isBotTrackablePath('/de/llms.txt')).toBe(true);
		expect(isBotTrackablePath('/ru/og.png')).toBe(false);
	});

	it('treats a dot in a directory segment as a page, not an extension', () => {
		// The extension test compares the last dot against the last slash, so a dotted
		// directory does not make the final segment look like a file.
		expect(isBotTrackablePath('/v1.2/changelog')).toBe(true);
	});
});

describe('isAgentSurface', () => {
	it.each(['/llms.txt', '/robots.txt', '/sitemap.xml', '/docs/anything.md', '/de/llms.txt'])('flags %s', (p) => {
		expect(isAgentSurface(p)).toBe(true);
	});

	it.each(['/', '/blog/post', '/admin'])('does not flag the human page %s', (p) => {
		expect(isAgentSurface(p)).toBe(false);
	});
});

describe('parsePrefixes', () => {
	it('reads the shape every operator publishes', () => {
		// Google defined this format for Googlebot verification and OpenAI,
		// Microsoft, Anthropic and Perplexity all adopted it — hence one parser.
		expect(
			parsePrefixes({
				creationTime: '2026-08-01T00:00:00.000000',
				prefixes: [{ ipv4Prefix: '192.0.2.0/24' }, { ipv6Prefix: '2001:db8::/32' }],
			}),
		).toEqual(['192.0.2.0/24', '2001:db8::/32']);
	});

	it('drops malformed entries instead of storing them', () => {
		// A bad prefix in the table becomes a failed ::cidr cast inside an INSERT,
		// which fails the crawler hit that tripped over it rather than the feed.
		expect(
			parsePrefixes({ prefixes: [{ ipv4Prefix: 'not-an-ip' }, { ipv4Prefix: '10.0.0.0/33' }, { other: 'x' }, null] }),
		).toEqual([]);
	});

	it.each([null, undefined, 'string', 42, {}, { prefixes: 'nope' }])('returns [] for %j', (payload) => {
		expect(parsePrefixes(payload)).toEqual([]);
	});
});

describe('isValidPrefix', () => {
	it.each(['192.0.2.0/24', '10.0.0.1/32', '2001:db8::/32', '::/0'])('accepts %s', (p) => {
		expect(isValidPrefix(p)).toBe(true);
	});

	it.each(['192.0.2.0', '192.0.2.0/33', '256.0.0.1/24', '2001:db8::/129', '/24', 'x/24'])('rejects %s', (p) => {
		expect(isValidPrefix(p)).toBe(false);
	});
});

describe('isPlausibleIpAddress', () => {
	it.each(['203.0.113.5', '2001:db8::1', '::1'])('accepts %s', (ip) => {
		expect(isPlausibleIpAddress(ip)).toBe(true);
	});

	it.each(['', 'localhost', '203.0.113', '999.0.0.1', '1.2.3.4.5', 'a'.repeat(50)])('rejects %s', (ip) => {
		expect(isPlausibleIpAddress(ip)).toBe(false);
	});

	it('accepts a bare IPv4-mapped IPv6 address as an address', () => {
		// Plausible as an ADDRESS; whether it can be compared is a separate question,
		// answered by normalizeIpForVerification below.
		expect(isPlausibleIpAddress('::ffff:132.196.86.42')).toBe(true);
	});

	it('rejects a /64 CIDR — the rate limiter shape, which is not an address', () => {
		// normalizeIpKey returns this for IPv6. Using it for containment would fail
		// the ::inet cast, and if it survived one it would widen every IPv6
		// comparison to an entire allocation.
		expect(isPlausibleIpAddress('2001:db8:1:2::/64')).toBe(false);
	});
});

describe('normalizeIpForVerification', () => {
	it('unwraps IPv4-mapped IPv6 to bare IPv4', () => {
		// THE bug this function exists for, confirmed against Neon on 2026-08-03:
		//   '132.196.86.42'::inet        <<= '132.196.86.0/24'::cidr → true
		//   '::ffff:132.196.86.42'::inet <<= '132.196.86.0/24'::cidr → FALSE
		// Postgres treats the mapped form as IPv6, and `<<=` is false across address
		// families — silently. Every operator publishes plain IPv4 prefixes, so an
		// unwrapped mapped address matches nothing and the verdict falls through to
		// `spoofed`: a fabricated impersonation alert against a real crawler.
		expect(normalizeIpForVerification('::ffff:132.196.86.42')).toBe('132.196.86.42');
	});

	it('strips a zone id and brackets', () => {
		expect(normalizeIpForVerification('fe80::1%eth0')).toBe('fe80::1');
		expect(normalizeIpForVerification('[2001:db8::1]')).toBe('2001:db8::1');
	});

	it('passes ordinary addresses through unchanged', () => {
		expect(normalizeIpForVerification('203.0.113.5')).toBe('203.0.113.5');
		expect(normalizeIpForVerification('2001:db8::1')).toBe('2001:db8::1');
	});

	it.each([null, undefined, '', 'not-an-ip', '2001:db8:1:2::/64'])('returns null for %j', (ip) => {
		// null must render as `unchecked` — an operational gap — and never as a
		// verdict about the caller.
		expect(normalizeIpForVerification(ip)).toBeNull();
	});
});
