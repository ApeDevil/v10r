/**
 * Custom PostgreSQL types for the retrieval domain.
 * pgvector's vector type and Postgres tsvector require custom Drizzle type definitions.
 */
import { customType } from 'drizzle-orm/pg-core';

/**
 * pgvector `vector(dimensions)` column type.
 * Stores as float[] in TypeScript, vector in Postgres.
 */
export const vector = (dimensions: number) =>
	customType<{ data: number[]; driverParam: string }>({
		dataType() {
			return `vector(${dimensions})`;
		},
		toDriver(value: number[]): string {
			return `[${value.join(',')}]`;
		},
		fromDriver(value: unknown): number[] {
			if (typeof value === 'string') {
				return value
					.replace(/^\[|\]$/g, '')
					.split(',')
					.map(Number);
			}
			return value as number[];
		},
	});

/**
 * Postgres `tsvector` column type for full-text search.
 *
 * Two usage modes exist in the codebase, both write-via-SQL (never `toDriver`):
 *  - `retrieval.chunk` uses a single-config `GENERATED ALWAYS` expression (immutable, allowed).
 *  - `retrieval.llmwiki_page` and `blog.revision` are app-populated on insert with a
 *    multi-field / per-locale `to_tsvector(regconfig, …)` expression, because Neon
 *    rejects non-immutable generated expressions (SQLSTATE 42P17).
 * Reads return the raw tsvector text; queries use `@@`, not the column value itself.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
	dataType() {
		return 'tsvector';
	},
});
