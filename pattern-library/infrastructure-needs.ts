/**
 * How infrastructure needs read, and whether a target project has them.
 *
 * Resolution — which needs reach a record through its foundations, constituents and
 * generalizations, at which level, under which conditions, with which pins and from which
 * records — is `pattern-graph.ts` (`graph.needs`, `adopt().needs`). This module only prints a
 * resolved need and checks it against a target, so a need reads the same on every surface.
 */
import { needCondition, type ResolvedNeed } from './pattern-graph.ts';
import {
	INFRASTRUCTURE_NEED_IDS,
	NEED_LEVELS,
	type NeedDeclaration,
	type NeedLevel,
	needDeclaration,
	type PatternRecord,
	TECHNOLOGY_NEED,
} from './schema.ts';

export function declaredNeeds(pattern: PatternRecord): NeedDeclaration[] {
	return pattern.needs.map(needDeclaration);
}

/** A record's own declarations as resolved needs (no relationships followed). */
export function ownNeeds(pattern: PatternRecord): ResolvedNeed[] {
	return declaredNeeds(pattern).map((declaration) => ({
		need: declaration.need,
		level: declaration.level,
		conditions: declaration.when ? [declaration.when] : [],
		conditionIds: declaration.when ? [[needCondition(pattern.id, declaration.need)]] : [],
		pins: declaration.pinned
			? [
					{
						technology: declaration.pinned,
						conditional: declaration.level === 'conditional',
						conditions: declaration.level === 'conditional' && declaration.when ? [declaration.when] : [],
						origins: [pattern.id],
					},
				]
			: [],
		origins: [pattern.id],
		inherited: [],
		...(declaration.why && (declaration.level === 'optional' || declaration.level === 'implementation')
			? { why: declaration.why }
			: {}),
		conflict: null,
		sources: [],
	}));
}

/**
 * `relational-db`, `relational-db (pinned: postgres)`, `key-value-store (via rate-limiting)`,
 * `relational-db (pins conflict: mysql, postgres)`. A conditional pin says so; with `condition`, a
 * conditional need lists each condition under which it is needed.
 */
export function needLabel(need: ResolvedNeed, options: { condition?: boolean } = {}): string {
	const pins = need.pins.map((pin) => (pin.conditional ? `${pin.technology} if its condition holds` : pin.technology));
	const details = [
		need.conflict
			? `pins ${need.conflict.certain ? 'conflict' : 'may conflict'}: ${pins.join(', ')}`
			: pins.length > 0
				? `pinned: ${pins.join(', ')}`
				: '',
		options.condition && need.conditions.length > 0 ? `when ${need.conditions.join('; or when ')}` : '',
		need.inherited.length > 0 ? `via ${need.inherited.join(', ')}` : '',
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
export function needsSummary(needs: readonly ResolvedNeed[], options: { condition?: boolean } = {}): string {
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
	need: Pick<ResolvedNeed, 'need' | 'pins'>,
): { provided: boolean; pinMismatch: boolean } {
	const hasCapability = target.has(need.need) || [...target].some((word) => TECHNOLOGY_NEED.get(word) === need.need);
	const pinned = need.pins.filter((pin) => !pin.conditional).map((pin) => pin.technology);
	if (pinned.length > 0) {
		const provided = pinned.every((technology) => target.has(technology));
		return { provided, pinMismatch: !provided && hasCapability };
	}
	return { provided: hasCapability, pinMismatch: false };
}
