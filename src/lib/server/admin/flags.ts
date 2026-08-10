import { eq } from 'drizzle-orm';
import * as v from 'valibot';
import { db } from '$lib/server/db';
import { systemConfig } from '$lib/server/db/schema/admin';

/**
 * Every current flag is a boolean; `system_config.value` is unvalidated JSONB,
 * so this schema at the write boundary is the only shape guarantee. When
 * non-boolean flags land (percentage rollouts), grow this into a per-key
 * schema map instead of widening it silently.
 */
const flagValueSchema = v.boolean('Flag values must be booleans');

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getAllFlags() {
	return db.select().from(systemConfig).orderBy(systemConfig.key);
}

// ── Write ─────────────────────────────────────────────────────────────────────

export async function setFlag(
	key: string,
	value: unknown,
	options?: { description?: string; updatedBy?: string },
): Promise<void> {
	v.parse(flagValueSchema, value);
	await db
		.insert(systemConfig)
		.values({
			key,
			value,
			description: options?.description,
			updatedBy: options?.updatedBy,
			updatedAt: new Date(),
		})
		.onConflictDoUpdate({
			target: systemConfig.key,
			set: {
				value,
				...(options?.description !== undefined && { description: options.description }),
				updatedBy: options?.updatedBy,
				updatedAt: new Date(),
			},
		});
}

export async function deleteFlag(key: string): Promise<void> {
	await db.delete(systemConfig).where(eq(systemConfig.key, key));
}
