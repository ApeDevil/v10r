/**
 * Custom PostgreSQL types for RAG domain.
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
 * App code never writes this — our `search_vector` column is `GENERATED ALWAYS`
 * from `content` + `context_prefix`, so there's no `toDriver` path. Reads return
 * the raw tsvector text; queries use `@@` operators, not the column value itself.
 */
export const tsvector = customType<{ data: string; driverData: string }>({
	dataType() {
		return 'tsvector';
	},
});
