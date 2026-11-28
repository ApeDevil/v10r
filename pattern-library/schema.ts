/**
 * The shape of the pattern library, and the rules a record must satisfy.
 *
 * Framework-free and filesystem-free on purpose: this is the ONE declaration of
 * `PatternRecord` & co. Both readers import it — the stdio server under bare Bun
 * (relative path, no bundler) and the app under Vite (via the `$patterns` alias) —
 * so the two runtimes cannot drift in their idea of what a pattern is.
 *
 * Reading the registry off disk lives in `load.ts`, which is Bun-only.
 */
export type RefKind = 'file' | 'dir' | 'route' | 'approute' | 'anchor';

/** `deep` = full emulation card (invariants + emulation notes required);
 *  `light` = index row (pointers only — both depth fields must stay empty). */
export type PatternTier = 'deep' | 'light';

/**
 * Machine-checkable evidence grade, orthogonal to tier (tier = documentation
 * depth, maturity = proof). Every value is verifiable from the record itself:
 * `proven` ⇔ at least one tests/showcases ref (whose existence patterns:validate
 * already enforces) plus a `verifiedAt`/`verifiedSha` attestation;
 * `planned` ⇔ no proof refs at all; `implemented` = code exists, no linked
 * proof surface yet. Finer self-declared rungs (unit- vs browser-verified)
 * were deliberately rejected: a grade no machine can check will rot.
 */
export type PatternMaturity = 'planned' | 'implemented' | 'proven';

/**
 * Entity kinds: what a record IS, and therefore what adopting it means. Every consumer (plan,
 * card, docs page, skill) reads the same semantics; documentation depth (`tier`) never decides it.
 *
 * - `pattern`: a reusable engineering solution. Adopting it means BUILDING it in the target; it can
 *   be a plan step, declares infrastructure needs, and other patterns can build on it.
 * - `principle`: a rule or review lens. Adopting it means APPLYING it to the work at hand; it builds
 *   nothing, so it declares no infrastructure needs and builds on nothing. It is never a
 *   prerequisite to build first (until typed relationships exist, an incoming edge means "follows").
 * - `workflow`: an operational procedure. Adopting it means PERFORMING it, repeatedly, against a
 *   project that already exists; it may need infrastructure to run against, and nothing builds on it.
 *
 * Implementation inventories, documentation views and showcases are not kinds: they are evidence
 * and refs of the pattern they implement, document or demonstrate.
 */
export const ENTITY_KINDS = ['pattern', 'principle', 'workflow'] as const;

export type EntityKind = (typeof ENTITY_KINDS)[number];

/** What adopting a record of each kind means — the one sentence every surface prints. */
export const ADOPTION_SEMANTICS: Record<EntityKind, string> = {
	pattern: 'build it in the target project',
	principle: 'apply it to the work; it builds nothing and is never a step to build first',
	workflow: 'perform it as a procedure against an existing project; nothing builds on it',
};

/**
 * Infrastructure needs: the capabilities a pattern can need the TARGET project to run, named for
 * the capability (a relational database), never for the product v10r happens to use (Postgres).
 * `binding` is v10r's reference implementation; `technologies` are the words a target may name
 * instead of the capability (`target_infra: ["postgres"]`). Frameworks are not listed: every
 * pattern assumes the v10r stack's runtime. Closed on purpose: a recommender unions needs across a
 * plan, and a reader rules a pattern out before reading it.
 */
export const INFRASTRUCTURE_NEEDS = [
	{
		id: 'relational-db',
		title: 'Relational database',
		binding: 'PostgreSQL (Neon) through Drizzle',
		technologies: ['postgres', 'mysql', 'sqlite'],
	},
	{ id: 'vector-search', title: 'Vector search', binding: 'pgvector inside PostgreSQL', technologies: ['pgvector'] },
	{ id: 'graph-db', title: 'Graph database', binding: 'Neo4j Aura over the HTTP Query API', technologies: ['neo4j'] },
	{ id: 'key-value-store', title: 'Shared key-value store', binding: 'Redis (Upstash, REST)', technologies: ['redis'] },
	{ id: 'object-storage', title: 'Object storage', binding: 'Cloudflare R2 over the S3 API', technologies: ['s3'] },
	{ id: 'scheduler', title: 'Scheduler', binding: 'Vercel cron calling the jobs runner', technologies: ['cron'] },
	{ id: 'llm-provider', title: 'LLM provider', binding: 'provider-agnostic AI SDK adapters', technologies: [] },
	{ id: 'email-delivery', title: 'Email delivery', binding: 'Resend', technologies: ['resend'] },
	{ id: 'external-api', title: 'External API', binding: 'per pattern, named in when/why', technologies: [] },
	{ id: 'web-worker', title: 'Web worker', binding: 'browser dedicated workers', technologies: [] },
	{ id: 'service-worker', title: 'Service worker', binding: 'SvelteKit service worker', technologies: [] },
	{ id: 'wasm-toolchain', title: 'WebAssembly toolchain', binding: 'Rust compiled with wasm-pack', technologies: [] },
	// A second deploy target that runs an OCI container next to the app (Podman locally,
	// a container host such as Render remotely) — for a separately deployed service.
	{
		id: 'container-host',
		title: 'Container host',
		binding: 'Podman locally, a container host remotely',
		technologies: ['podman', 'docker'],
	},
] as const satisfies readonly { id: string; title: string; binding: string; technologies: readonly string[] }[];

export type InfrastructureNeed = (typeof INFRASTRUCTURE_NEEDS)[number]['id'];
export const INFRASTRUCTURE_NEED_IDS: readonly InfrastructureNeed[] = INFRASTRUCTURE_NEEDS.map((entry) => entry.id);

/** Technology word → the need it provides (`postgres` → `relational-db`). */
export const TECHNOLOGY_NEED: ReadonlyMap<string, InfrastructureNeed> = new Map(
	INFRASTRUCTURE_NEEDS.flatMap((entry) => entry.technologies.map((technology) => [technology, entry.id] as const)),
);

/**
 * How strictly a pattern needs a capability. `required`: it cannot work without it.
 * `conditional`: required only when `when` holds for the target. `optional`: improves the pattern
 * but is not needed (`why`). `implementation`: v10r's reference implementation uses it, the
 * pattern does not (`why`) — a technology never becomes mandatory merely because v10r uses it.
 */
export const NEED_LEVELS = ['required', 'conditional', 'optional', 'implementation'] as const;
export type NeedLevel = (typeof NEED_LEVELS)[number];

/** One declared need. `pinned` says the capability is not substitutable: only that technology fits. */
export interface NeedDeclaration {
	need: InfrastructureNeed;
	level: NeedLevel;
	when?: string;
	why?: string;
	pinned?: string;
}

/** As authored: a bare need id is shorthand for `{need, level: "required"}`. */
export type NeedEntry = InfrastructureNeed | NeedDeclaration;

export function needDeclaration(entry: NeedEntry): NeedDeclaration {
	return typeof entry === 'string' ? { need: entry, level: 'required' } : entry;
}

/** A considered alternative and the condition under which it beats this pattern. */
export interface RegAlternative {
	approach: string;
	prefer_when: string;
}

export interface RegRef {
	path: string;
	note?: string;
	kind?: RefKind;
}

/** Meta-group for the generated Pattern Index TOC (Foundations, Data, …). */
export interface RegGroup {
	id: string;
	title: string;
}

/** Category = one generated Pattern Index section; order here IS section order. */
export interface RegCategory {
	id: string;
	title: string;
	group: string;
}

/**
 * Numerals that are part of a concept's name, not a count or a version (D-09). Anything else with
 * a digit in a title — "14-stage", "~40 wrappers", "Svelte 5" — is a volatile fact.
 */
export const TITLE_NUMERALS_ALLOWED = ['N+1', '3D', 'OAuth 2.1', 'A2A', 'A2UI', 'S3', 'i18n', 'Neo4j'] as const;

/**
 * A title names the concept. Returns what does not belong in one: numerals outside the allow-list
 * and a parenthetical (a summary squeezed into the name). Empty = canonical.
 */
export function volatileTitleFacts(title: string): string[] {
	let rest = title;
	for (const allowed of TITLE_NUMERALS_ALLOWED) rest = rest.split(allowed).join(' ');
	const facts = [...rest.matchAll(/[~#]?\S*\d\S*/g)].map((match) => match[0]);
	if (/[()]/.test(title)) facts.push('(…)');
	return facts;
}

export interface PatternRecord {
	id: string;
	/** What the record is and what adopting it means (`ENTITY_KINDS`, `ADOPTION_SEMANTICS`). */
	kind: EntityKind;
	tier: PatternTier;
	title: string;
	category: string;
	summary: string;
	when_to_use: string;
	/**
	 * Contraindications: situations where adopting the pattern is the wrong call. The
	 * first entry is the headline the generated index prints, so keep it to one clause.
	 * Author judgement, not measurement — required on deep cards so the fitness question
	 * ("is this the smallest thing that works here?") is answered before the how.
	 */
	avoid_when: string[];
	/** Simpler or different approaches the pattern was chosen over, and when they win instead. */
	alternatives: RegAlternative[];
	/** Infrastructure the pattern needs, each at a level (see `INFRASTRUCTURE_NEEDS`, `NEED_LEVELS`). */
	needs: NeedEntry[];
	capabilities: string[];
	keywords: string[];
	depends_on: string[];
	docs: RegRef[];
	code: RegRef[];
	tests: RegRef[];
	showcases: RegRef[];
	invariants: string[];
	emulation_notes: string[];
	risk: string;
	maturity: PatternMaturity;
	/** ISO date (YYYY-MM-DD) the proof surface was last verified. Required on `proven`, forbidden otherwise. */
	verifiedAt?: string;
	/** Short git sha of the verifying commit (`-dirty` suffix allowed, matching the perf snapshot convention). */
	verifiedSha?: string;
}

/**
 * The registry's schema format. Readers refuse any other value: a format change renames or
 * reshapes fields, and every reader changes with it in the same commit (no compatibility layer).
 * Content identity is not a version number — see `registry-digest.ts`.
 */
export const REGISTRY_FORMAT = 4;

export interface Registry {
	format: typeof REGISTRY_FORMAT;
	note?: string;
	groups: RegGroup[];
	categories: RegCategory[];
	patterns: PatternRecord[];
}

export const REGISTRY_FILENAME = 'registry.json';

const REF_KINDS: readonly string[] = ['file', 'dir', 'route', 'approute', 'anchor'];
const TIERS: readonly string[] = ['deep', 'light'];
const KINDS: readonly string[] = ENTITY_KINDS;
const MATURITIES: readonly string[] = ['planned', 'implemented', 'proven'];
const NEEDS_BY_ID = new Map<string, (typeof INFRASTRUCTURE_NEEDS)[number]>(
	INFRASTRUCTURE_NEEDS.map((entry) => [entry.id, entry]),
);
const LEVELS: readonly string[] = NEED_LEVELS;
const VERIFIED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STRING_LIST_FIELDS = [
	'avoid_when',
	'capabilities',
	'keywords',
	'depends_on',
	'invariants',
	'emulation_notes',
] as const;
const REF_LIST_FIELDS = ['docs', 'code', 'tests', 'showcases'] as const;
const STRING_FIELDS = ['id', 'title', 'category', 'summary', 'when_to_use', 'risk'] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function validateRef(value: unknown, where: string, errors: string[]): void {
	if (!isRecord(value)) {
		errors.push(`${where}: ref must be an object`);
		return;
	}
	if (typeof value.path !== 'string' || value.path.length === 0) {
		errors.push(`${where}: ref.path must be a non-empty string`);
	}
	if (value.note !== undefined && typeof value.note !== 'string') {
		errors.push(`${where}: ref.note must be a string when present`);
	}
	if (value.kind !== undefined && (typeof value.kind !== 'string' || !REF_KINDS.includes(value.kind))) {
		errors.push(`${where}: ref.kind must be one of ${REF_KINDS.join('|')}`);
	}
}

const nonEmpty = (value: unknown) => typeof value === 'string' && value.trim().length > 0;

/**
 * Needs contract: one declaration per need; the level decides which explanation is mandatory —
 * `conditional` states its condition (`when`), `optional` and `implementation` state their reason
 * (`why`), and a pin names one of the need's technologies and says why it cannot be substituted.
 */
function validateNeeds(value: unknown, where: string, errors: string[]): void {
	if (!Array.isArray(value)) {
		errors.push(`${where}.needs: must be an array`);
		return;
	}
	const seen = new Set<string>();
	value.forEach((entry, index) => {
		const at = `${where}.needs[${index}]`;
		const declaration = typeof entry === 'string' ? { need: entry, level: 'required' } : entry;
		if (!isRecord(declaration)) {
			errors.push(`${at}: must be a need id or {need, level, when?, why?, pinned?}`);
			return;
		}
		const definition = typeof declaration.need === 'string' ? NEEDS_BY_ID.get(declaration.need) : undefined;
		if (!definition) {
			errors.push(`${at}.need: '${String(declaration.need)}' is not one of ${[...NEEDS_BY_ID.keys()].join('|')}`);
			return;
		}
		if (seen.has(definition.id)) errors.push(`${at}: '${definition.id}' is declared twice — keep one level`);
		seen.add(definition.id);
		const level = declaration.level;
		if (typeof level !== 'string' || !LEVELS.includes(level)) {
			errors.push(`${at}.level: must be one of ${LEVELS.join('|')}`);
			return;
		}
		if (level === 'conditional' && !nonEmpty(declaration.when)) {
			errors.push(`${at}: a conditional need states its condition in "when"`);
		}
		if (level !== 'conditional' && declaration.when !== undefined) {
			errors.push(`${at}: "when" belongs to conditional needs only`);
		}
		if ((level === 'optional' || level === 'implementation') && !nonEmpty(declaration.why)) {
			errors.push(`${at}: an ${level} need states its reason in "why"`);
		}
		if (declaration.pinned !== undefined) {
			const technologies: readonly string[] = definition.technologies;
			if (level !== 'required' && level !== 'conditional') {
				errors.push(`${at}.pinned: only a required or conditional need can be pinned`);
			} else if (typeof declaration.pinned !== 'string' || !technologies.includes(declaration.pinned)) {
				errors.push(
					`${at}.pinned: must be one of ${definition.id}'s technologies (${technologies.join('|') || 'none'})`,
				);
			}
			if (!nonEmpty(declaration.why)) errors.push(`${at}: a pinned need says why the technology cannot be substituted`);
		}
		for (const key of Object.keys(declaration)) {
			if (!['need', 'level', 'when', 'why', 'pinned'].includes(key)) errors.push(`${at}: unknown field '${key}'`);
		}
	});
}

function validatePattern(value: unknown, index: number, errors: string[]): void {
	const where = `patterns[${index}]`;
	if (!isRecord(value)) {
		errors.push(`${where}: must be an object`);
		return;
	}
	for (const field of STRING_FIELDS) {
		if (typeof value[field] !== 'string' || value[field].length === 0) {
			errors.push(`${where}.${field}: must be a non-empty string`);
		}
	}
	if (typeof value.id === 'string' && !ID_PATTERN.test(value.id)) {
		errors.push(`${where}.id: '${value.id}' is not kebab-case`);
	}
	if (typeof value.tier !== 'string' || !TIERS.includes(value.tier)) {
		errors.push(`${where}.tier: must be one of ${TIERS.join('|')}`);
	}
	if (typeof value.kind !== 'string' || !KINDS.includes(value.kind)) {
		errors.push(`${where}.kind: must be one of ${KINDS.join('|')}`);
	}
	// A principle is applied, not built: nothing to run, nothing to build first.
	if (value.kind === 'principle') {
		if (Array.isArray(value.needs) && value.needs.length > 0) {
			errors.push(`${where}.needs: a principle builds nothing, so it declares no infrastructure needs`);
		}
		if (Array.isArray(value.depends_on) && value.depends_on.length > 0) {
			errors.push(`${where}.depends_on: a principle builds on nothing — it is applied to the work`);
		}
	}
	for (const field of STRING_LIST_FIELDS) {
		if (!isStringArray(value[field])) {
			errors.push(`${where}.${field}: must be an array of strings`);
		}
	}
	if (!Array.isArray(value.alternatives)) {
		errors.push(`${where}.alternatives: must be an array`);
	} else {
		value.alternatives.forEach((alt, altIndex) => {
			if (
				!isRecord(alt) ||
				typeof alt.approach !== 'string' ||
				alt.approach.length === 0 ||
				typeof alt.prefer_when !== 'string' ||
				alt.prefer_when.length === 0
			) {
				errors.push(`${where}.alternatives[${altIndex}]: must be {approach, prefer_when} with non-empty strings`);
			}
		});
	}
	validateNeeds(value.needs, where, errors);
	for (const field of REF_LIST_FIELDS) {
		const list = value[field];
		if (!Array.isArray(list)) {
			errors.push(`${where}.${field}: must be an array`);
			continue;
		}
		list.forEach((ref, refIndex) => {
			validateRef(ref, `${where}.${field}[${refIndex}]`, errors);
		});
	}
	// Per-tier contract: "deep" is a promise (full emulation card), "light" a pointer
	// row. Enforced structurally so a violating registry never loads anywhere.
	if (value.tier === 'deep') {
		for (const field of ['avoid_when', 'invariants', 'emulation_notes', 'capabilities', 'keywords', 'docs'] as const) {
			if (Array.isArray(value[field]) && value[field].length === 0) {
				errors.push(`${where}.${field}: deep records must have at least one entry`);
			}
		}
	}
	if (value.tier === 'light') {
		for (const field of ['invariants', 'emulation_notes'] as const) {
			if (Array.isArray(value[field]) && value[field].length > 0) {
				errors.push(`${where}.${field}: light records must keep this empty — promote to tier "deep" instead`);
			}
		}
		if (Array.isArray(value.docs) && value.docs.length === 0) {
			errors.push(`${where}.docs: light records still need at least one docs ref`);
		}
	}
	// Maturity contract, enforced structurally (validation here is allow-extra,
	// so an unchecked field would "work" invisibly and rot):
	// proven ⇔ proof refs + attestation; planned ⇔ no proof refs; attestation
	// only on proven.
	if (typeof value.maturity !== 'string' || !MATURITIES.includes(value.maturity)) {
		errors.push(`${where}.maturity: must be one of ${MATURITIES.join('|')}`);
	} else {
		const proofRefs =
			(Array.isArray(value.tests) ? value.tests.length : 0) +
			(Array.isArray(value.showcases) ? value.showcases.length : 0);
		if (value.maturity === 'proven') {
			if (proofRefs === 0) {
				errors.push(`${where}: maturity "proven" requires at least one tests or showcases ref`);
			}
			if (typeof value.verifiedAt !== 'string' || !VERIFIED_AT_PATTERN.test(value.verifiedAt)) {
				errors.push(`${where}.verifiedAt: proven records need a YYYY-MM-DD verification date`);
			}
		} else {
			if (value.maturity === 'planned' && proofRefs > 0) {
				errors.push(
					`${where}: maturity "planned" contradicts its tests/showcases refs — use "implemented" or "proven"`,
				);
			}
			if (value.verifiedAt !== undefined || value.verifiedSha !== undefined) {
				errors.push(
					`${where}: verifiedAt/verifiedSha are attestations of "proven" — remove them or promote the maturity`,
				);
			}
		}
	}
	if (value.verifiedSha !== undefined && (typeof value.verifiedSha !== 'string' || value.verifiedSha.length === 0)) {
		errors.push(`${where}.verifiedSha: must be a non-empty string when present`);
	}
}

/** Validate the root `groups`/`categories` blocks; returns the valid category ids. */
function validateTaxonomy(data: Record<string, unknown>, errors: string[]): Set<string> {
	const groupIds = new Set<string>();
	if (!Array.isArray(data.groups) || data.groups.length === 0) {
		errors.push('groups: must be a non-empty array');
	} else {
		data.groups.forEach((group, index) => {
			if (!isRecord(group) || typeof group.id !== 'string' || !ID_PATTERN.test(group.id)) {
				errors.push(`groups[${index}].id: must be kebab-case`);
				return;
			}
			if (typeof group.title !== 'string' || group.title.length === 0) {
				errors.push(`groups[${index}].title: must be a non-empty string`);
			}
			if (groupIds.has(group.id)) {
				errors.push(`groups[${index}]: duplicate group id '${group.id}'`);
			}
			groupIds.add(group.id);
		});
	}
	const categoryIds = new Set<string>();
	if (!Array.isArray(data.categories) || data.categories.length === 0) {
		errors.push('categories: must be a non-empty array');
	} else {
		data.categories.forEach((category, index) => {
			if (!isRecord(category) || typeof category.id !== 'string' || !ID_PATTERN.test(category.id)) {
				errors.push(`categories[${index}].id: must be kebab-case`);
				return;
			}
			if (typeof category.title !== 'string' || category.title.length === 0) {
				errors.push(`categories[${index}].title: must be a non-empty string`);
			}
			if (typeof category.group !== 'string' || !groupIds.has(category.group)) {
				errors.push(`categories[${index}].group: '${String(category.group)}' is not a declared group id`);
			}
			if (categoryIds.has(category.id)) {
				errors.push(`categories[${index}]: duplicate category id '${category.id}'`);
			}
			categoryIds.add(category.id);
		});
	}
	return categoryIds;
}

/** Structurally validate parsed JSON. Returns the typed registry only when there are zero errors. */
export function parseRegistry(data: unknown): { registry: Registry | null; errors: string[] } {
	const errors: string[] = [];
	if (!isRecord(data)) {
		return { registry: null, errors: ['registry root must be an object'] };
	}
	if (data.format !== REGISTRY_FORMAT) {
		errors.push(`format: this reader understands registry format ${REGISTRY_FORMAT}, got ${String(data.format)}`);
	}
	const categoryIds = validateTaxonomy(data, errors);
	if (!Array.isArray(data.patterns) || data.patterns.length === 0) {
		errors.push('patterns: must be a non-empty array');
		return { registry: null, errors };
	}
	data.patterns.forEach((pattern, index) => {
		validatePattern(pattern, index, errors);
	});

	if (errors.length > 0) {
		return { registry: null, errors };
	}
	const registry = data as unknown as Registry;

	const seen = new Set<string>();
	for (const pattern of registry.patterns) {
		if (seen.has(pattern.id)) {
			errors.push(`duplicate pattern id '${pattern.id}'`);
		}
		seen.add(pattern.id);
	}
	for (const pattern of registry.patterns) {
		for (const dep of pattern.depends_on) {
			if (!seen.has(dep)) {
				errors.push(`${pattern.id}: depends_on '${dep}' does not exist`);
			}
		}
		if (!categoryIds.has(pattern.category)) {
			errors.push(`${pattern.id}: category '${pattern.category}' is not a declared category id`);
		}
	}
	const kindOf = new Map(registry.patterns.map((pattern) => [pattern.id, pattern.kind]));
	for (const pattern of registry.patterns) {
		for (const dep of pattern.depends_on) {
			if (kindOf.get(dep) === 'workflow') {
				errors.push(
					`${pattern.id}: depends_on '${dep}' is a workflow — a procedure is performed, nothing builds on it`,
				);
			}
		}
	}
	// The taxonomy is navigation only (D-11): a category nothing is filed under is obsolete.
	const used = new Set(registry.patterns.map((pattern) => pattern.category));
	for (const id of categoryIds) {
		if (!used.has(id)) errors.push(`category '${id}' has no records — remove it`);
	}
	return errors.length > 0 ? { registry: null, errors } : { registry, errors };
}

export function buildById(registry: Registry): Map<string, PatternRecord> {
	return new Map(registry.patterns.map((pattern) => [pattern.id, pattern]));
}

/**
 * Kahn topological sort over depends_on edges, restricted to the selected id set.
 * Deterministic: ties break by registry order. On a cycle, remaining nodes are
 * appended in registry order and `cyclic` is flagged.
 */
export function topoSort(
	selected: string[],
	byId: Map<string, PatternRecord>,
	registryOrder: string[],
): { order: string[]; cyclic: boolean } {
	const inSet = new Set(selected);
	const rank = new Map(registryOrder.map((id, index) => [id, index]));
	const byRank = (a: string, b: string) => (rank.get(a) ?? 0) - (rank.get(b) ?? 0);
	const indegree = new Map<string, number>();
	for (const id of inSet) {
		const deps = byId.get(id)?.depends_on.filter((dep) => inSet.has(dep)) ?? [];
		indegree.set(id, deps.length);
	}
	const order: string[] = [];
	let ready = [...inSet].filter((id) => indegree.get(id) === 0).sort(byRank);
	while (ready.length > 0) {
		const next = ready.shift();
		if (next === undefined) {
			break;
		}
		order.push(next);
		const unlocked: string[] = [];
		for (const id of inSet) {
			if (order.includes(id) || ready.includes(id)) {
				continue;
			}
			const deps = byId.get(id)?.depends_on.filter((dep) => inSet.has(dep)) ?? [];
			if (deps.every((dep) => order.includes(dep))) {
				unlocked.push(id);
			}
		}
		ready = [...ready, ...unlocked.filter((id) => !ready.includes(id))].sort(byRank);
	}
	const cyclic = order.length < inSet.size;
	if (cyclic) {
		const remaining = [...inSet].filter((id) => !order.includes(id)).sort(byRank);
		order.push(...remaining);
	}
	return { order, cyclic };
}
