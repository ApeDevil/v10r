/**
 * Resolve a User-Agent to a bounded (family, category) pair, and say which
 * operator — if any — publishes IP ranges that can verify the claim.
 *
 * ## Bounded by OUR list, never by caller text
 *
 * `family` is the grouping key of every panel in the bot lane, so it must not be
 * caller-controlled. Nothing here ever returns a substring of the User-Agent;
 * every return value is a literal from `BOT_FAMILIES` below. An unrecognised
 * crawler becomes `other`, which is a slightly less useful row and not a
 * cardinality incident.
 *
 * ## Order matters
 *
 * Most specific first, and the ordering is load-bearing in three places:
 *  - `chatgpt-user` before `gptbot`: both contain neither's token, but OpenAI's
 *    agent UA also carries `ChatGPT`, and conflating a live user-driven fetch
 *    with training-corpus collection destroys the distinction the `ai_agent`
 *    category exists to draw.
 *  - `claude-user` / `claude-searchbot` before `claudebot`, same reason.
 *  - `oai-searchbot` before both OpenAI entries.
 *
 * ## What this does NOT do
 *
 * It does not decide truth. Every value here is self-asserted and trivially
 * spoofable; the containment test inside `recordBotHit` is what turns a claim
 * into a verdict. Read `family` and `verification` together or not at all.
 */

import type { BotCategory, BotRangeSource } from '$lib/server/db/schema/analytics/bot-hits';

export interface BotIdentity {
	family: string;
	category: BotCategory;
	/** Operator whose published prefixes can verify this family, if any. */
	rangeSource: BotRangeSource | null;
}

/**
 * The closed list. `match` is a lowercase substring of the User-Agent.
 *
 * `rangeSource` is null wherever the operator publishes no machine-readable
 * prefix list — that yields `unpublished`, which means "unknowable", NOT
 * "suspicious". Treating unverifiable as bad would flag every honest crawler
 * whose operator simply has no feed.
 */
const BOT_FAMILIES: ReadonlyArray<{
	match: string;
	family: string;
	category: BotCategory;
	source: BotRangeSource | null;
}> = [
	// ── OpenAI ── most specific first; see the ordering note above.
	{ match: 'oai-searchbot', family: 'oai-searchbot', category: 'ai_search', source: 'openai' },
	{ match: 'chatgpt-user', family: 'chatgpt-user', category: 'ai_agent', source: 'openai' },
	{ match: 'gptbot', family: 'gptbot', category: 'ai_training', source: 'openai' },

	// ── Anthropic ── one feed covers all three families.
	{ match: 'claude-searchbot', family: 'claude-searchbot', category: 'ai_search', source: 'anthropic' },
	{ match: 'claude-user', family: 'claude-user', category: 'ai_agent', source: 'anthropic' },
	{ match: 'claudebot', family: 'claudebot', category: 'ai_training', source: 'anthropic' },
	{ match: 'anthropic-ai', family: 'claudebot', category: 'ai_training', source: 'anthropic' },

	// ── Other AI ──
	{ match: 'perplexity-user', family: 'perplexity-user', category: 'ai_agent', source: 'perplexity' },
	{ match: 'perplexitybot', family: 'perplexitybot', category: 'ai_search', source: 'perplexity' },
	{ match: 'ccbot', family: 'ccbot', category: 'ai_training', source: null },
	{ match: 'bytespider', family: 'bytespider', category: 'ai_training', source: null },
	{ match: 'amazonbot', family: 'amazonbot', category: 'ai_training', source: null },
	{ match: 'meta-externalagent', family: 'meta-external', category: 'ai_training', source: null },
	{ match: 'meta-externalfetcher', family: 'meta-external', category: 'ai_agent', source: null },
	{ match: 'google-extended', family: 'google-extended', category: 'ai_training', source: 'google' },
	{ match: 'cohere-ai', family: 'cohere-ai', category: 'ai_training', source: null },
	{ match: 'diffbot', family: 'diffbot', category: 'ai_training', source: null },
	{ match: 'youbot', family: 'youbot', category: 'ai_search', source: null },

	// ── Classic search ──
	{ match: 'googlebot', family: 'googlebot', category: 'search', source: 'google' },
	{ match: 'bingbot', family: 'bingbot', category: 'search', source: 'bing' },
	{ match: 'duckduckbot', family: 'duckduckbot', category: 'search', source: null },
	{ match: 'yandexbot', family: 'yandexbot', category: 'search', source: null },
	{ match: 'baiduspider', family: 'baiduspider', category: 'search', source: null },
	{ match: 'applebot', family: 'applebot', category: 'search', source: null },
	{ match: 'slurp', family: 'slurp', category: 'search', source: null },

	// ── Commercial SEO ──
	{ match: 'ahrefs', family: 'ahrefs', category: 'seo', source: null },
	{ match: 'semrush', family: 'semrush', category: 'seo', source: null },
	{ match: 'mj12bot', family: 'mj12bot', category: 'seo', source: null },
	{ match: 'dotbot', family: 'dotbot', category: 'seo', source: null },
	{ match: 'petalbot', family: 'petalbot', category: 'seo', source: null },
	{ match: 'blexbot', family: 'blexbot', category: 'seo', source: null },

	// ── Link-preview unfurlers ──
	{ match: 'facebookexternalhit', family: 'facebook', category: 'social', source: null },
	{ match: 'twitterbot', family: 'twitter', category: 'social', source: null },
	{ match: 'linkedinbot', family: 'linkedin', category: 'social', source: null },
	{ match: 'slackbot', family: 'slack', category: 'social', source: null },
	{ match: 'discordbot', family: 'discord', category: 'social', source: null },
	{ match: 'telegrambot', family: 'telegram', category: 'social', source: null },
	{ match: 'whatsapp', family: 'whatsapp', category: 'social', source: null },
	{ match: 'embedly', family: 'embedly', category: 'social', source: null },
	{ match: 'mastodon', family: 'mastodon', category: 'social', source: null },

	// ── Uptime / synthetic monitoring ──
	{ match: 'uptimerobot', family: 'uptimerobot', category: 'monitor', source: null },
	{ match: 'pingdom', family: 'pingdom', category: 'monitor', source: null },
	{ match: 'statuscake', family: 'statuscake', category: 'monitor', source: null },
	{ match: 'datadog', family: 'datadog', category: 'monitor', source: null },
	{ match: 'newrelic', family: 'newrelic', category: 'monitor', source: null },
	{ match: 'checkly', family: 'checkly', category: 'monitor', source: null },
	{ match: 'site24x7', family: 'site24x7', category: 'monitor', source: null },
	{ match: 'lighthouse', family: 'lighthouse', category: 'monitor', source: null },

	// ── Scanners and internet-wide measurement ──
	{ match: 'zgrab', family: 'scanner', category: 'scanner', source: null },
	{ match: 'masscan', family: 'scanner', category: 'scanner', source: null },
	{ match: 'nuclei', family: 'scanner', category: 'scanner', source: null },
	{ match: 'sqlmap', family: 'scanner', category: 'scanner', source: null },
	{ match: 'nikto', family: 'scanner', category: 'scanner', source: null },
	{ match: 'wpscan', family: 'scanner', category: 'scanner', source: null },
	{ match: 'acunetix', family: 'scanner', category: 'scanner', source: null },
	{ match: 'gobuster', family: 'scanner', category: 'scanner', source: null },
	{ match: 'feroxbuster', family: 'scanner', category: 'scanner', source: null },
	{ match: 'censys', family: 'censys', category: 'scanner', source: null },
	{ match: 'expanse', family: 'expanse', category: 'scanner', source: null },
	{ match: 'internetmeasurement', family: 'internetmeasurement', category: 'scanner', source: null },
	{ match: 'netsystemsresearch', family: 'netsystemsresearch', category: 'scanner', source: null },
	{ match: 'paloaltonetworks', family: 'expanse', category: 'scanner', source: null },
	{ match: 'l9explore', family: 'scanner', category: 'scanner', source: null },

	// ── Human-driven HTTP clients ──
	{ match: 'curl', family: 'curl', category: 'tool', source: null },
	{ match: 'wget', family: 'wget', category: 'tool', source: null },
	{ match: 'httpie', family: 'httpie', category: 'tool', source: null },
	{ match: 'postman', family: 'postman', category: 'tool', source: null },
	{ match: 'insomnia', family: 'insomnia', category: 'tool', source: null },
	{ match: 'python-requests', family: 'python', category: 'tool', source: null },
	{ match: 'python-httpx', family: 'python', category: 'tool', source: null },
	{ match: 'aiohttp', family: 'python', category: 'tool', source: null },
	{ match: 'scrapy', family: 'scrapy', category: 'tool', source: null },
	{ match: 'go-http-client', family: 'go', category: 'tool', source: null },
	{ match: 'java/', family: 'java', category: 'tool', source: null },
	{ match: 'okhttp', family: 'java', category: 'tool', source: null },
	{ match: 'node-fetch', family: 'node', category: 'tool', source: null },
	{ match: 'axios', family: 'node', category: 'tool', source: null },
	{ match: 'undici', family: 'node', category: 'tool', source: null },
	{ match: 'headless', family: 'headless-browser', category: 'tool', source: null },
];

/** Everything recognised as non-human but matching no entry above. */
const OTHER: BotIdentity = { family: 'other', category: 'unclassified', rangeSource: null };

/**
 * Classify a caller.
 *
 * Returns `other`/`unclassified` for anything unrecognised — including an empty
 * User-Agent, which is itself a strong non-browser signal. The caller decides
 * whether a request reaches here at all; this function does not re-litigate it.
 */
export function classifyBot(userAgent: string): BotIdentity {
	const ua = userAgent.toLowerCase();
	for (const entry of BOT_FAMILIES) {
		if (ua.includes(entry.match)) {
			return { family: entry.family, category: entry.category, rangeSource: entry.source };
		}
	}
	return OTHER;
}

/** Every family this classifier can emit — the closed domain, for tests and UI legends. */
export const KNOWN_BOT_FAMILIES: readonly string[] = [...new Set(BOT_FAMILIES.map((e) => e.family)), OTHER.family];
