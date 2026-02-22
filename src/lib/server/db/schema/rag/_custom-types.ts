/**
 * Custom PostgreSQL types for RAG domain.
 * pgvector's vector type requires a custom Drizzle type definition.
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
