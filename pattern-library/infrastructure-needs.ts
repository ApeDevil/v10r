/**
 * What adopting a pattern takes in infrastructure, and whether a target project has it.
 *
 * One implementation for every reader (MCP tools, the dependency explorer, docs pages, Agent
 * Skills, Vely), so a need reads the same everywhere. Framework-free and filesystem-free.
 *
 * Inheritance: a pattern's adoption needs are its own declarations plus the required and
 * conditional needs of every pattern it depends on, transitively, labelled with the record they
 * come from. Optional and implementation needs are never inherited: they describe that record's
 * own reference implementation, not what building on it takes. When one need arrives at several
 * levels, the strictest wins (required > conditional > optional > implementation).
 */
import {
	INFRASTRUCTURE_NEED_IDS,
	type InfrastructureNeed,
	NEED_LEVELS,
	type NeedDeclaration,
	type NeedLevel,
	needDeclaration,
	type PatternRecord,
	TECHNOLOGY_NEED,
} from './schema.ts';

/** A need as a reader sees it: the declaration, and the record it is inherited from (absent = own). */
export interface AdoptionNeed extends NeedDeclaration {
	via?: string;
}

const INHERITED_LEVELS: ReadonlySet<NeedLevel> = new Set(['required', 'conditional']);
const strictness = (level: NeedLevel) => NEED_LEVELS.indexOf(level);

export function declaredNeeds(pattern: PatternRecord): NeedDeclaration[] {
	return pattern.needs.map(needDeclaration);
}

/** Own declarations plus inherited required/conditional needs, strictest level per need, own first. */
export function adoptionNeeds(pattern: PatternRecord, byId: ReadonlyMap<string, PatternRecord>): AdoptionNeed[] {
	const needs = new Map<InfrastructureNeed, AdoptionNeed>();
	const add = (declaration: NeedDeclaration, via?: string) => {
		const known = needs.get(declaration.need);
		if (!known || strictness(declaration.level) < strictness(known.level)) {
			needs.set(declaration.need, via ? { ...declaration, via } : { ...declaration });
		}
	};
	for (const declaration of declaredNeeds(pattern)) add(declaration);
	const seen = new Set([pattern.id]);
	const queue = [...pattern.depends_on];
	while (queue.length > 0) {
		const id = queue.shift();
		if (id === undefined || seen.has(id)) continue;
		seen.add(id);
		const dependency = byId.get(id);
		if (!dependency) continue;
		for (const declaration of declaredNeeds(dependency)) {
			if (INHERITED_LEVELS.has(declaration.level)) add(declaration, id);
		}
		queue.push(...dependency.depends_on);
	}
	return [...needs.values()];
}

/** `relational-db`, `relational-db (pinned: postgres)`, `key-value-store (via anti-abuse-rate-limiting)`. */
export function needLabel(need: AdoptionNeed, options: { condition?: boolean } = {}): string {
	const details = [
		need.pinned ? `pinned: ${need.pinned}` : '',
		options.condition && need.when ? `when ${need.when}` : '',
		need.via ? `via ${need.via}` : '',
	].filter((part) => part.length > 0);
	return details.length > 0 ? `${need.need} (${details.join('; ')})` : need.need;
}

export const NEED_LEVEL_LABELS: Record<NeedLevel, string> = {
	required: 'required',
	conditional: 'conditional',
	optional: 'optional',
	implementation: "v10r's implementation uses",
};

/** One line per level present, e.g. `required relational-db · conditional web-worker (when …)`. */
export function needsSummary(needs: readonly AdoptionNeed[], options: { condition?: boolean } = {}): string {
	return NEED_LEVELS.map((level) => {
		const atLevel = needs.filter((need) => need.level === level);
		return atLevel.length > 0
			? `${NEED_LEVEL_LABELS[level]} ${atLevel.map((need) => needLabel(need, options)).join(', ')}`
			: '';
	})
		.filter((part) => part.length > 0)
		.join(' · ');
}

/** Every word `target_infra` accepts: need ids and the technologies that provide them. */
export const TARGET_INFRA_WORDS: readonly string[] = [...INFRASTRUCTURE_NEED_IDS, ...TECHNOLOGY_NEED.keys()];

/**
 * Does the target provide this need? A need id or any of its technologies satisfies an unpinned
 * need; a pinned need is satisfied only by its technology. `pinMismatch` marks a target that has
 * the capability, but not the pinned technology.
 */
export function targetProvides(
	target: ReadonlySet<string>,
	need: NeedDeclaration,
): { provided: boolean; pinMismatch: boolean } {
	const hasCapability = target.has(need.need) || [...target].some((word) => TECHNOLOGY_NEED.get(word) === need.need);
	if (need.pinned) {
		const provided = target.has(need.pinned);
		return { provided, pinMismatch: !provided && hasCapability };
	}
	return { provided: hasCapability, pinMismatch: false };
}
