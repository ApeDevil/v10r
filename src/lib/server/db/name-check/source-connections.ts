/**
 * Reads and writes for `name_check.source_connection` — ciphertext in, ciphertext out.
 *
 * Opening the envelope is the name-check domain's job (`name-check/connections.ts`); this
 * module never sees a key. The `Database` is passed explicitly, as `db/ai/provider-connections.ts`
 * does, so nothing here depends on the app's singleton.
 *
 * Writes are optimistic: each names the `version` it saw and matches zero rows when
 * another administrator got there first. Both operations are single guarded statements.
 */
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { NameSourceVendor } from '../../../types/db-enums';
import { type NameSourceConnectionRow, sourceConnection } from '../schema/name-check/source-connection';
import type { Database } from '../types';

export interface NameSourceConnectionSave {
	vendor: NameSourceVendor;
	enabled: boolean;
	clientId: string | null;
	apiBase: string | null;
	tokenUrl: string | null;
	/** `undefined` keeps the stored ciphertext; `null` removes it. */
	secretCiphertext?: string | null;
	/** 0 when the form saw no row yet. */
	expectedVersion: number;
	updatedBy: string;
}

export type NameSourceConnectionWrite = { ok: true; version: number } | { conflict: true };

export function listNameSourceConnections(database: Database): Promise<NameSourceConnectionRow[]> {
	return database.select().from(sourceConnection);
}

/** Every stored secret envelope — what the re-seal sweep reads, and nothing else. */
export function listNameSourceSecretEnvelopes(
	database: Database,
): Promise<{ vendor: NameSourceVendor; secretCiphertext: string | null }[]> {
	return database
		.select({ vendor: sourceConnection.vendor, secretCiphertext: sourceConnection.secretCiphertext })
		.from(sourceConnection)
		.where(isNotNull(sourceConnection.secretCiphertext));
}

/**
 * Swap a secret envelope for the same secret re-sealed under the current key — only while
 * the row still holds the envelope that was read (compare-and-swap on the envelope). The
 * secret did not change, so neither do `version` and `updatedAt`.
 */
export async function replaceNameSourceSecretEnvelope(
	database: Database,
	input: { vendor: NameSourceVendor; from: string; to: string },
): Promise<boolean> {
	const updated = await database
		.update(sourceConnection)
		.set({ secretCiphertext: input.to })
		.where(and(eq(sourceConnection.vendor, input.vendor), eq(sourceConnection.secretCiphertext, input.from)))
		.returning({ vendor: sourceConnection.vendor });
	return updated.length === 1;
}

export async function saveNameSourceConnection(
	database: Database,
	input: NameSourceConnectionSave,
): Promise<NameSourceConnectionWrite> {
	const { vendor, enabled, clientId, apiBase, tokenUrl, updatedBy } = input;

	if (input.expectedVersion === 0) {
		const [inserted] = await database
			.insert(sourceConnection)
			.values({
				vendor,
				enabled,
				clientId,
				apiBase,
				tokenUrl,
				secretCiphertext: input.secretCiphertext ?? null,
				updatedBy,
			})
			.onConflictDoNothing()
			.returning({ version: sourceConnection.version });
		return inserted ? { ok: true, version: inserted.version } : { conflict: true };
	}

	const [updated] = await database
		.update(sourceConnection)
		.set({
			enabled,
			clientId,
			apiBase,
			tokenUrl,
			updatedBy,
			updatedAt: new Date(),
			version: sql`${sourceConnection.version} + 1`,
			...(input.secretCiphertext !== undefined ? { secretCiphertext: input.secretCiphertext } : {}),
		})
		.where(and(eq(sourceConnection.vendor, vendor), eq(sourceConnection.version, input.expectedVersion)))
		.returning({ version: sourceConnection.version });
	return updated ? { ok: true, version: updated.version } : { conflict: true };
}

export async function removeNameSourceSecret(
	database: Database,
	input: { vendor: NameSourceVendor; expectedVersion: number; updatedBy: string },
): Promise<NameSourceConnectionWrite> {
	const [updated] = await database
		.update(sourceConnection)
		.set({
			secretCiphertext: null,
			updatedBy: input.updatedBy,
			updatedAt: new Date(),
			version: sql`${sourceConnection.version} + 1`,
		})
		.where(and(eq(sourceConnection.vendor, input.vendor), eq(sourceConnection.version, input.expectedVersion)))
		.returning({ version: sourceConnection.version });
	return updated ? { ok: true, version: updated.version } : { conflict: true };
}
