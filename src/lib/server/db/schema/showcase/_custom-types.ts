/**
 * Custom PostgreSQL types for Drizzle ORM.
 *
 * Only range types need customType — inet, cidr, macaddr, point
 * are all natively supported in drizzle-orm/pg-core.
 */
import { customType } from 'drizzle-orm/pg-core';

/** int4range — range of 4-byte integers */
export const int4range = customType<{ data: string }>({
	dataType() {
		return 'int4range';
	},
});

/** tstzrange — range of timestamptz values */
export const tstzrange = customType<{ data: string }>({
	dataType() {
		return 'tstzrange';
	},
});

/** daterange — range of dates */
export const daterange = customType<{ data: string }>({
	dataType() {
		return 'daterange';
	},
});
