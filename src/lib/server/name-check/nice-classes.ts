/**
 * Nice classification, as far as a pre-screen needs it.
 *
 * A category maps to the classes a filing in that line of business usually names, plus
 * the classes that commonly sit beside them. "Same" means the mark claims one of the
 * user's classes; "possibly" means a neighbouring one; "unrelated" is still shown, never
 * dismissed — the spec is explicit that an identical word in another class is a finding.
 */
import type { NameCategoryRelevance } from '$lib/name-check/report';
import type { NameCheckCategory } from '$lib/schemas/name-check';

export const NICE_CLASSES_BY_CATEGORY: Record<NameCheckCategory, readonly number[]> = {
	software: [9, 42, 38],
	entertainment: [41, 9, 28],
	publishing: [16, 41, 9],
	other: [],
};

/** Classes routinely filed together with the key. */
export const RELATED_NICE_CLASSES: Record<number, readonly number[]> = {
	9: [42, 38, 41, 16, 35],
	16: [9, 41, 35],
	28: [41, 9],
	35: [9, 42, 41, 16],
	38: [9, 42],
	41: [9, 16, 28, 35],
	42: [9, 38, 35],
};

export function categoryRelevance(
	niceClasses: readonly number[],
	category: NameCheckCategory | null,
): NameCategoryRelevance {
	if (!category || category === 'other' || niceClasses.length === 0) return 'unknown';
	const own = NICE_CLASSES_BY_CATEGORY[category];
	if (niceClasses.some((cls) => own.includes(cls))) return 'same';
	const neighbours = new Set(own.flatMap((cls) => RELATED_NICE_CLASSES[cls] ?? []));
	if (niceClasses.some((cls) => neighbours.has(cls))) return 'possibly';
	return 'unrelated';
}
