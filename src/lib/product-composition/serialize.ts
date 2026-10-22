/**
 * Reading and writing a composition file.
 *
 * Reading is fail-closed: anything the schema refuses, or a collection with a repeated id,
 * returns issues and no composition. Whether the references *resolve* (a coupling naming a
 * missing port) is a validation diagnostic, not a parse failure — an editor must be able to
 * open a file it can then show to be broken.
 *
 * Writing is canonical: the keyed collections sorted by id, `passages` normalised (each pair
 * sorted, then the pairs), object keys sorted, tab-indented. Every other array keeps its
 * order — waypoints are a sequence. The same composition always produces the same bytes, so
 * an export diffs cleanly and an export → import → export round trip is byte-equal.
 */
import * as v from 'valibot';
import { type Arrangement, type ProductComposition, productCompositionSchema } from '../schemas/product-composition';
import { compareText } from './diagnostics';

export interface CompositionIssue {
	/** Dotted location of the problem, e.g. `occurrences.2.placement.rotation`. */
	path: string;
	message: string;
}

export type CompositionParse =
	| { ok: true; composition: ProductComposition }
	| { ok: false; issues: CompositionIssue[] };

export function parseComposition(input: unknown): CompositionParse {
	const result = v.safeParse(productCompositionSchema, input);
	if (!result.success) {
		return {
			ok: false,
			issues: result.issues.map((issue) => ({ path: v.getDotPath(issue) ?? '', message: issue.message })),
		};
	}
	const issues = duplicateIds(result.output);
	return issues.length > 0 ? { ok: false, issues } : { ok: true, composition: result.output };
}

export function stringifyComposition(composition: ProductComposition): string {
	return `${JSON.stringify(canonical(composition), null, '\t')}\n`;
}

/** Ids are the keys every reference resolves by; a repeat makes a reference ambiguous. */
function duplicateIds(composition: ProductComposition): CompositionIssue[] {
	const issues: CompositionIssue[] = [];
	const check = (path: string, items: readonly { id: string }[]) => {
		const seen = new Set<string>();
		for (const { id } of items) {
			if (seen.has(id)) issues.push({ path, message: `duplicate id "${id}"` });
			seen.add(id);
		}
	};
	const checkArrangement = (path: string, arrangement: Arrangement) => {
		check(`${path}occurrences`, arrangement.occurrences);
		check(`${path}couplings`, arrangement.couplings);
		check(`${path}conduits`, arrangement.conduits);
	};

	check('definitions', composition.definitions);
	checkArrangement('', composition);
	composition.definitions.forEach((definition, index) => {
		const path = `definitions.${index}.body.`;
		if (definition.body.kind === 'geometry') check(`${path}ports`, definition.body.ports);
		else {
			checkArrangement(path, definition.body);
			check(`${path}exposedPorts`, definition.body.exposedPorts);
		}
	});
	return issues;
}

/** The collections whose order carries no meaning: each is a set keyed by id. Named, not inferred from shape. */
const KEYED_COLLECTIONS = new Set(['definitions', 'occurrences', 'couplings', 'conduits', 'ports', 'exposedPorts']);

/** Sort object keys and the keyed collections; normalise passages; leave every other array in order. */
function canonical(value: unknown, key?: string): unknown {
	if (Array.isArray(value)) {
		const items = value.map((item) => canonical(item));
		if (key === 'passages') {
			const pairs = (items as [string, string][]).map((pair) => [...pair].sort(compareText));
			return pairs.sort((a, b) => compareText(a[0], b[0]) || compareText(a[1], b[1]));
		}
		if (key && KEYED_COLLECTIONS.has(key)) {
			return (items as { id: string }[]).sort((a, b) => compareText(a.id, b.id));
		}
		return items;
	}
	if (value !== null && typeof value === 'object') {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((entry) => [entry, canonical((value as Record<string, unknown>)[entry], entry)]),
		);
	}
	return value;
}
