import type { NameCheckCategory, NameCheckQueryOutput, NameCheckTerritory } from '$lib/schemas/name-check';
import { type NormalizedName, normalizeName } from './normalize';

/** A validated query, normalised once, handed to every source unchanged. */
export interface NameCheckQuery {
	raw: string;
	normalized: NormalizedName;
	territory: NameCheckTerritory;
	category: NameCheckCategory | null;
}

export function toNameCheckQuery(input: NameCheckQueryOutput): NameCheckQuery {
	return {
		raw: input.query,
		normalized: normalizeName(input.query),
		territory: input.territory,
		category: input.category ?? null,
	};
}
