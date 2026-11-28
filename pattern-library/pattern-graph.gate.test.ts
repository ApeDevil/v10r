/**
 * One graph module (Slice 3): `pattern-graph.ts` is the only implementation of relationship
 * traversal, composition, need resolution and inheritance. Every other reader asks it.
 *
 * Enforced two ways. The retired walkers (`topoSort`, `adoptionNeeds`, `depends_on`) are gone
 * from live code. And the relationship fields are read directly only by the files listed in
 * DISPLAY_READERS, which print ONE record's own authored relationships (a card line, a table
 * cell); anything that follows a relationship to another record goes through the graph. A new
 * reader of these fields is a review question, not a silent second walker: add it here only
 * when it displays, never when it walks.
 */
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '..');

/** Validation and the graph itself: the two places that interpret relationships. */
const INTERPRETERS = ['pattern-library/schema.ts', 'pattern-library/pattern-graph.ts'];
/** Readers that display one record's own relationships and walk nothing. */
const DISPLAY_READERS = [
	'pattern-library/query.ts',
	'pattern-library/dependency-explorer.ts',
	'src/lib/server/patterns/render.ts',
	'src/lib/server/patterns/agent-skills.ts',
	'src/lib/server/ai/tools/search-pattern-library.ts',
	'src/lib/showcases/mcp/registry-viz.ts',
];
/** Same spelling, different concept: an example relationship type in the GraphRAG extraction prompt. */
const HOMONYMS = ['src/lib/server/retrieval/ingest/entity-extract.ts'];
/** History and benchmark replay: they read old registries on purpose. */
const HISTORY = ['scripts/patterns/composition-replay.ts'];

const RELATIONSHIP_FIELD = /\.(builds_on|composes|specializes)\b|\.references\b(?!\s*\()/;
const RETIRED_WALKER = /\b(topoSort|adoptionNeeds)\b|\bdepends_on\b/;

function liveCode(): string[] {
	return execSync('git ls-files -co --exclude-standard', { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 })
		.toString()
		.split('\n')
		.filter((file) => /^(src|pattern-library|scripts|mcp)\/.*\.(ts|svelte|js)$/.test(file))
		.filter((file) => !/\.(test|gate\.test)\.ts$|\.fixtures\.ts$|\.bundle\.js$|\/paraglide\//.test(file))
		.filter((file) => !HISTORY.includes(file));
}

const read = (file: string) => {
	try {
		return readFileSync(resolve(ROOT, file), 'utf8');
	} catch {
		return '';
	}
};

describe('one graph module', () => {
	it('no live code keeps a retired walker', () => {
		const offenders = liveCode().filter((file) =>
			RETIRED_WALKER.test(read(file).replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '')),
		);
		// The schema names the retired field to refuse it.
		expect(offenders.filter((file) => file !== 'pattern-library/schema.ts' && !HOMONYMS.includes(file))).toEqual([]);
	});

	it('only the interpreters and the listed display readers read relationship fields', () => {
		const readers = liveCode().filter((file) => {
			const text = read(file);
			// Only files that see pattern records: the Drizzle `.references(` call is a different concept.
			return /PatternRecord|Registry\b|REGISTRY|registry\.json/.test(text) && RELATIONSHIP_FIELD.test(text);
		});
		expect(readers.filter((file) => !INTERPRETERS.includes(file) && !DISPLAY_READERS.includes(file))).toEqual([]);
	});

	it('display readers never follow a relationship to read the target’s relationships', () => {
		// A walk reads a relationship field of a record it reached through one: `byId.get(edge.id)?.builds_on`.
		const walk = /\.get\([^)]*\)\??\.(builds_on|composes|specializes|references)\b/;
		expect(DISPLAY_READERS.filter((file) => walk.test(read(file)))).toEqual([]);
	});
});
