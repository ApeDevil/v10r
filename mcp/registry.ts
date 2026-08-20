/**
 * Registry types, structural validation, and lookup helpers for the v10r Pattern MCP.
 * Zero dependencies — hand-rolled narrowing instead of a schema library, because the
 * server runs in an ephemeral container with no node_modules.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export type RefKind = 'file' | 'dir' | 'route' | 'approute' | 'anchor';

/** `deep` = full emulation card (invariants + emulation notes required);
 *  `light` = index row (pointers only — both depth fields must stay empty). */
export type PatternTier = 'deep' | 'light';

/**
 * Machine-checkable evidence grade, orthogonal to tier (tier = documentation
 * depth, maturity = proof). Every value is verifiable from the record itself:
 * `proven` ⇔ at least one tests/showcases ref (whose existence mcp:validate
 * already enforces) plus a `verifiedAt`/`verifiedSha` attestation;
 * `planned` ⇔ no proof refs at all; `implemented` = code exists, no linked
 * proof surface yet. Finer self-declared rungs (unit- vs browser-verified)
 * were deliberately rejected: a grade no machine can check will rot.
 */
export type PatternMaturity = 'planned' | 'implemented' | 'proven';

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

export interface PatternRecord {
	id: string;
	tier: PatternTier;
	title: string;
	category: string;
	summary: string;
	when_to_use: string;
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

export interface Registry {
	version: string;
	note?: string;
	groups: RegGroup[];
	categories: RegCategory[];
	patterns: PatternRecord[];
}

export const REGISTRY_FILENAME = 'patterns.registry.json';

const REF_KINDS: readonly string[] = ['file', 'dir', 'route', 'approute', 'anchor'];
const TIERS: readonly string[] = ['deep', 'light'];
const MATURITIES: readonly string[] = ['planned', 'implemented', 'proven'];
const VERIFIED_AT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const STRING_LIST_FIELDS = ['capabilities', 'keywords', 'depends_on', 'invariants', 'emulation_notes'] as const;
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
	for (const field of STRING_LIST_FIELDS) {
		if (!isStringArray(value[field])) {
			errors.push(`${where}.${field}: must be an array of strings`);
		}
	}
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
		for (const field of ['invariants', 'emulation_notes', 'capabilities', 'keywords', 'docs'] as const) {
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
	if (typeof data.version !== 'string') {
		errors.push('version: must be a string');
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
	return errors.length > 0 ? { registry: null, errors } : { registry, errors };
}

/** Load and parse the registry JSON that sits next to this module. */
export function loadRegistry(dir: string = import.meta.dir): { registry: Registry | null; error: string | null } {
	let raw: string;
	try {
		raw = readFileSync(join(dir, REGISTRY_FILENAME), 'utf8');
	} catch (cause) {
		return { registry: null, error: `cannot read ${REGISTRY_FILENAME}: ${String(cause)}` };
	}
	let data: unknown;
	try {
		data = JSON.parse(raw);
	} catch (cause) {
		return { registry: null, error: `${REGISTRY_FILENAME} is not valid JSON: ${String(cause)}` };
	}
	const { registry, errors } = parseRegistry(data);
	return registry ? { registry, error: null } : { registry: null, error: errors.join('; ') };
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
