/**
 * CUSTOM EVENT CONTRACT — a closed allowlist of what may be recorded.
 *
 * This file is the cardinality budget. Practitioner reports on hand-rolled
 * analytics converge on one failure mode: not row count, but *cardinality*.
 * Unbounded event names and free-form property values turn every `GROUP BY`
 * into a table scan over millions of distinct keys, and the damage is invisible
 * until dashboards are already slow and the data is already written.
 *
 * So the rule is inverted from the usual "accept and figure it out later":
 * an event name not listed here is DROPPED at ingest, and a property key not
 * listed for that event is STRIPPED. Nothing unknown reaches the database.
 *
 * Adding an event is deliberate: add it here, with its allowed keys.
 */

/** Bounded value domains. `enum` is the strongest — it also bounds cardinality. */
type PropertySpec =
	| { kind: 'enum'; values: readonly string[] }
	| { kind: 'string'; maxLength: number }
	| { kind: 'int'; min: number; max: number }
	| { kind: 'bool' };

interface EventSpec {
	/** What the event means, so the allowlist doubles as the event dictionary. */
	description: string;
	properties: Record<string, PropertySpec>;
}

/** Every custom (`action`) event the system will store. */
export const EVENT_SPECS = {
	rage_click: {
		description: 'Three or more clicks on the same element inside a short window — a frustration signal.',
		properties: {
			target: { kind: 'string', maxLength: 120 },
			count: { kind: 'int', min: 3, max: 50 },
		},
	},
	dead_click: {
		description: 'A click on something that looks interactive but produced no DOM change or navigation.',
		properties: {
			target: { kind: 'string', maxLength: 120 },
		},
	},
	scroll_depth: {
		description: 'Furthest scroll reached on a page, bucketed — not a continuous value.',
		properties: {
			bucket: { kind: 'enum', values: ['25', '50', '75', '100'] },
		},
	},
	form_abandon: {
		description: 'A form was focused but never submitted. Records WHICH field was last touched, never its content.',
		properties: {
			form: { kind: 'string', maxLength: 60 },
			lastField: { kind: 'string', maxLength: 60 },
		},
	},
	engagement: {
		description: 'Time the page was actually visible and focused, in seconds — not wall-clock time on page.',
		properties: {
			seconds: { kind: 'int', min: 0, max: 3600 },
			maxScroll: { kind: 'int', min: 0, max: 100 },
		},
	},
	outbound_click: {
		description: 'A click on a link leaving the site. Stores the destination host only, never the full URL.',
		properties: {
			host: { kind: 'string', maxLength: 120 },
		},
	},
} as const satisfies Record<string, EventSpec>;

export type EventName = keyof typeof EVENT_SPECS;

export function isKnownEvent(name: string): name is EventName {
	return Object.hasOwn(EVENT_SPECS, name);
}

/**
 * Coerce one property value against its spec, or reject it.
 *
 * Returns `undefined` for anything that does not fit — the caller drops the key
 * rather than storing a coerced guess.
 */
function validateValue(spec: PropertySpec, value: unknown): string | number | boolean | undefined {
	switch (spec.kind) {
		case 'enum':
			return typeof value === 'string' && spec.values.includes(value) ? value : undefined;
		case 'string':
			if (typeof value !== 'string' || value.length === 0) return undefined;
			return value.slice(0, spec.maxLength);
		case 'int': {
			const n = typeof value === 'number' ? value : Number(value);
			if (!Number.isFinite(n)) return undefined;
			// Clamp rather than reject: an out-of-range number is still a real
			// observation, just one whose tail we refuse to store precisely.
			return Math.min(spec.max, Math.max(spec.min, Math.round(n)));
		}
		case 'bool':
			return typeof value === 'boolean' ? value : undefined;
	}
}

/**
 * Filter a raw client-supplied property bag down to exactly what the event's
 * spec permits. Unknown keys are dropped silently — a client cannot widen the
 * schema by sending more.
 */
export function sanitizeProperties(name: EventName, raw: unknown): Record<string, string | number | boolean> {
	if (typeof raw !== 'object' || raw === null) return {};
	const spec = EVENT_SPECS[name].properties as Record<string, PropertySpec>;
	const out: Record<string, string | number | boolean> = {};

	for (const [key, propSpec] of Object.entries(spec)) {
		const value = validateValue(propSpec, (raw as Record<string, unknown>)[key]);
		if (value !== undefined) out[key] = value;
	}
	return out;
}

// ── Path templating ──────────────────────────────────────────────────────────

/**
 * Reduce a SvelteKit route id to a stable, low-cardinality template.
 *
 * `/blog/my-first-post` and `/blog/another-post` must aggregate to `/blog/[slug]`,
 * otherwise every published article becomes its own `GROUP BY` key and the
 * dashboard degrades in direct proportion to how much content exists.
 *
 * Route groups `(public)` and the optional locale segment carry no meaning for
 * analytics, so they are stripped: `/de/blog/x` and `/blog/x` are the same page
 * viewed in two languages, not two pages.
 */
export function templateRoute(routeId: string | null): string {
	if (!routeId) return '(unknown)';

	const segments = routeId
		.split('/')
		.filter(Boolean)
		// Drop route groups `(public)` and the optional locale matcher.
		.filter((seg) => !(seg.startsWith('(') && seg.endsWith(')')))
		.filter((seg) => !seg.startsWith('[[locale'))
		// Normalise param matchers: `[slug=string]` and `[slug]` are one key.
		.map((seg) => (seg.startsWith('[') ? seg.replace(/=[^\]]+/, '') : seg));

	return segments.length === 0 ? '/' : `/${segments.join('/')}`;
}
