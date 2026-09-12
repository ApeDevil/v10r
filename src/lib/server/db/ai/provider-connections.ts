/**
 * Reads and writes for `ai.provider_connection` — ciphertext in, ciphertext out.
 *
 * Decryption is the AI domain's job (`ai/connections.ts`); this module never sees a key.
 * Every function takes the `Database` explicitly instead of importing the singleton so the
 * bare-Bun ingest scripts, which build their own pool, can reach it by relative path —
 * the same shape as `db/showcase/seed.ts`. Nothing here resolves through a Vite alias.
 *
 * Writes are optimistic: each names the `version` it saw and matches zero rows when
 * another administrator got there first. Saving and removing a key are single guarded
 * statements. Moving the project default touches two rows and runs in a transaction,
 * because the partial unique index on `is_default` is checked per row — one UPDATE that
 * sets B and clears A in the same statement can fail depending on which row it visits
 * first.
 */
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import type { AiProviderId } from '../../../types/db-enums';
import { type ProviderConnectionRow, providerConnection } from '../schema/ai/provider-connection';
import type { Database } from '../types';

export interface ProviderConnectionSave {
	provider: AiProviderId;
	enabled: boolean;
	modelId: string;
	/** `undefined` keeps the stored ciphertext; `null` removes it. */
	apiKeyCiphertext?: string | null;
	/** 0 when the form saw no row yet. */
	expectedVersion: number;
	updatedBy: string;
}

export type ProviderConnectionWrite = { ok: true; version: number } | { conflict: true };

export type DefaultProviderWrite = { ok: true } | { conflict: true } | { unusable: true };

export function listProviderConnections(database: Database): Promise<ProviderConnectionRow[]> {
	return database.select().from(providerConnection);
}

export async function saveProviderConnection(
	database: Database,
	input: ProviderConnectionSave,
): Promise<ProviderConnectionWrite> {
	const { provider, enabled, modelId, updatedBy } = input;

	if (input.expectedVersion === 0) {
		const [inserted] = await database
			.insert(providerConnection)
			.values({ provider, enabled, modelId, apiKeyCiphertext: input.apiKeyCiphertext ?? null, updatedBy })
			.onConflictDoNothing()
			.returning({ version: providerConnection.version });
		return inserted ? { ok: true, version: inserted.version } : { conflict: true };
	}

	const [updated] = await database
		.update(providerConnection)
		.set({
			enabled,
			modelId,
			updatedBy,
			updatedAt: new Date(),
			version: sql`${providerConnection.version} + 1`,
			...(input.apiKeyCiphertext !== undefined ? { apiKeyCiphertext: input.apiKeyCiphertext } : {}),
		})
		.where(and(eq(providerConnection.provider, provider), eq(providerConnection.version, input.expectedVersion)))
		.returning({ version: providerConnection.version });
	return updated ? { ok: true, version: updated.version } : { conflict: true };
}

export async function removeProviderKey(
	database: Database,
	input: { provider: AiProviderId; expectedVersion: number; updatedBy: string },
): Promise<ProviderConnectionWrite> {
	const [updated] = await database
		.update(providerConnection)
		.set({
			apiKeyCiphertext: null,
			updatedBy: input.updatedBy,
			updatedAt: new Date(),
			version: sql`${providerConnection.version} + 1`,
		})
		.where(and(eq(providerConnection.provider, input.provider), eq(providerConnection.version, input.expectedVersion)))
		.returning({ version: providerConnection.version });
	return updated ? { ok: true, version: updated.version } : { conflict: true };
}

class DefaultProviderRejected extends Error {
	constructor(readonly outcome: 'conflict' | 'unusable') {
		super(`default provider write rejected: ${outcome}`);
	}
}

/**
 * Move the project default to `provider`, or to Automatic with `null`. The caller names
 * the default it believes is current; a different one means another tab moved it first.
 * The target must be enabled with a stored key — the `WHERE` mirrors the table's CHECK so
 * an unusable target is reported as such rather than surfacing as a constraint error.
 */
export async function setDefaultProvider(
	database: Database,
	input: { provider: AiProviderId | null; expectedCurrentDefault: AiProviderId | null; updatedBy: string },
): Promise<DefaultProviderWrite> {
	const stamp = { updatedBy: input.updatedBy, updatedAt: new Date(), version: sql`${providerConnection.version} + 1` };
	try {
		return await database.transaction(async (tx) => {
			const [cleared] = await tx
				.update(providerConnection)
				.set({ isDefault: false, ...stamp })
				.where(eq(providerConnection.isDefault, true))
				.returning({ provider: providerConnection.provider });
			if ((cleared?.provider ?? null) !== input.expectedCurrentDefault) {
				throw new DefaultProviderRejected('conflict');
			}
			if (input.provider === null) return { ok: true } as const;

			const [set] = await tx
				.update(providerConnection)
				.set({ isDefault: true, ...stamp })
				.where(
					and(
						eq(providerConnection.provider, input.provider),
						eq(providerConnection.enabled, true),
						isNotNull(providerConnection.apiKeyCiphertext),
					),
				)
				.returning({ provider: providerConnection.provider });
			if (!set) throw new DefaultProviderRejected('unusable');
			return { ok: true } as const;
		});
	} catch (err) {
		if (err instanceof DefaultProviderRejected) {
			return err.outcome === 'conflict' ? { conflict: true } : { unusable: true };
		}
		throw err;
	}
}
