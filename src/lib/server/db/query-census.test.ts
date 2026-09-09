import { describe, expect, it } from 'vitest';
import { MAX_OBSERVED_SHAPES, observeQuery, queryCensusLogger, queryShape, startQueryCensus } from './query-census';

describe('queryShape', () => {
	it('treats parameter lists of any length as one shape', () => {
		const three = queryShape('select * from post where id in ($1, $2, $3)');
		const thirty = queryShape(
			`select * from post where id in (${Array.from({ length: 30 }, (_, i) => `$${i + 1}`).join(', ')})`,
		);

		// Batching is the FIX for what this measures; a normalizer that told batch
		// sizes apart would report every batch as a brand-new shape.
		expect(three).toBe(thirty);
	});

	it('keeps genuinely different statements apart', () => {
		expect(queryShape('select id from post where slug = $1')).not.toBe(
			queryShape('select id from tag where slug = $1'),
		);
	});

	it('normalizes whitespace, literals and numbers', () => {
		expect(queryShape("select  *\n\tfrom post\nwhere status = 'draft' limit 25")).toBe(
			"select * from post where status = '?' limit N",
		);
	});

	it('bounds the stored shape', () => {
		expect(queryShape(`select ${'a'.repeat(5000)} from post`).length).toBeLessThanOrEqual(300);
	});
});

describe('query census', () => {
	it('counts nothing when no census is in scope', () => {
		// The cost outside a scope is one AsyncLocalStorage lookup, which is what makes
		// it acceptable to leave the driver's logger wired up permanently.
		expect(() => observeQuery('select 1')).not.toThrow();
	});

	it('counts every statement sent inside its scope, at any async depth', async () => {
		const census = startQueryCensus();

		await census.run(async () => {
			observeQuery('select 1');
			await Promise.resolve();
			await new Promise((resolve) => setTimeout(resolve, 1));
			observeQuery('select 2');
		});

		expect(census.count).toBe(2);
	});

	it('does not count statements sent outside its scope', async () => {
		const census = startQueryCensus();
		await census.run(async () => observeQuery('select 1'));
		observeQuery('select 2');

		expect(census.count).toBe(1);
	});

	it('reports the most repeated shape', () => {
		const census = startQueryCensus();

		census.run(() => {
			observeQuery('select * from file where id = $1');
			observeQuery('select * from file where id = $2');
			observeQuery('select * from file where id = $3');
			observeQuery('select count(*) from file');
		});

		expect(census.count).toBe(4);
		expect(census.worst()).toEqual({ shape: 'select * from file where id = $?', times: 3 });
	});

	it('calls a single occurrence no repeat at all', () => {
		const census = startQueryCensus();
		census.run(() => observeQuery('select 1'));

		expect(census.worst()).toBeNull();
	});

	it('keeps counting truthfully after it stops recording shapes', () => {
		const census = startQueryCensus();

		census.run(() => {
			for (let i = 0; i < MAX_OBSERVED_SHAPES + 10; i++) observeQuery(`select ${'x'.repeat(i)} from post`);
		});

		// The count is the number people act on; the shape list is a diagnostic. Dropping
		// the diagnostic under pathological variety is fine, silently under-counting is not.
		expect(census.count).toBe(MAX_OBSERVED_SHAPES + 10);
		expect(census.repeats().length).toBe(MAX_OBSERVED_SHAPES);
	});

	it('counts through the driver seam the app actually wires up', () => {
		const census = startQueryCensus();
		census.run(() => queryCensusLogger.logQuery('select 1 from post', []));

		expect(census.count).toBe(1);
	});
});
