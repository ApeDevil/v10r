/**
 * The administrator's operations on provider connections: save, remove a key, move the
 * project default, and test. Each one seals the secret, performs one guarded write, then
 * records an audit event — in that order, so a failed audit never hides a change that
 * already happened. The route adapter maps the discriminated results to form feedback;
 * no business rule lives there.
 *
 * Audit detail is deliberately shallow: provider, version, which fields changed and how
 * the key changed. Never the key, never the ciphertext, never a provider response.
 */
import { recordAuditEvent } from '$lib/server/admin';
import { db } from '$lib/server/db';
import { removeProviderKey, saveProviderConnection, setDefaultProvider } from '$lib/server/db/ai/provider-connections';
import { classifyDbError } from '$lib/server/db/errors';
import { EncryptionError, encryptAesGcm, getEncryptionKey } from '$lib/server/security';
import type { AiProviderId } from '$lib/types/db-enums';
import { type ConnectionTestResult, testLanguageModel } from './connection-test';
import { createProviderModel, type ProviderEntry } from './connections';
import { loadProviderRegistry } from './index';

export interface ConnectionActor {
	id: string;
	email: string;
	ip?: string;
}

export type ConnectionRejection = 'conflict' | 'default_unusable' | 'encryption_unconfigured' | 'no_key';

export type ConnectionSettingsResult =
	| { ok: true; version: number; auditRecorded: boolean }
	| { ok: false; rejected: ConnectionRejection };

export type DefaultProviderResult = { ok: true; auditRecorded: boolean } | { ok: false; rejected: ConnectionRejection };

export interface ProviderConnectionTest extends ConnectionTestResult {
	provider: AiProviderId;
	modelId: string;
	/** Whether the tested configuration is what is saved, or a draft (unsaved key or model). */
	target: 'draft' | 'saved';
	/** The saved version the test was run against — what the admin sees on the card. */
	version: number;
}

export type ProviderConnectionTestResult =
	| { ok: true; test: ProviderConnectionTest; auditRecorded: boolean }
	| { ok: false; rejected: 'no_key' };

const PG_CHECK_VIOLATION = '23514';
const PG_UNIQUE_VIOLATION = '23505';

async function audit(actor: ConnectionActor, action: string, provider: AiProviderId, detail: Record<string, unknown>) {
	try {
		await recordAuditEvent({
			actorId: actor.id,
			actorEmail: actor.email,
			ipAddress: actor.ip,
			action,
			targetType: 'ai_provider_connection',
			targetId: provider,
			detail,
		});
		return true;
	} catch (err) {
		console.error(`[ai/connection-settings] audit failed for ${action}`, err);
		return false;
	}
}

function entryFor(entries: ProviderEntry[], provider: AiProviderId): ProviderEntry {
	const entry = entries.find((e) => e.id === provider);
	if (!entry) throw new Error(`unknown provider ${provider}`);
	return entry;
}

/** Map a write that tripped a table constraint onto the form vocabulary; rethrow anything else. */
function rejectionFromDbError(err: unknown): ConnectionRejection {
	const code = classifyDbError(err).code;
	if (code === PG_CHECK_VIOLATION) return 'default_unusable';
	if (code === PG_UNIQUE_VIOLATION) return 'conflict';
	throw err;
}

export interface SaveProviderConnectionInput {
	provider: AiProviderId;
	enabled: boolean;
	modelId: string;
	/** A replacement key; omitted or empty keeps the stored one. */
	apiKey?: string;
	expectedVersion: number;
}

export async function saveProviderConnectionSettings(
	input: SaveProviderConnectionInput,
	actor: ConnectionActor,
): Promise<ConnectionSettingsResult> {
	const registry = await loadProviderRegistry();
	const before = entryFor(registry.entries, input.provider);
	const replacingKey = !!input.apiKey;

	// The table's CHECK would refuse this too; saying it before the write keeps the stored
	// row untouched and the message specific.
	if (before.isDefault && !input.enabled) return { ok: false, rejected: 'default_unusable' };

	let apiKeyCiphertext: string | undefined;
	if (replacingKey) {
		try {
			apiKeyCiphertext = await encryptAesGcm(input.apiKey as string, getEncryptionKey());
		} catch (err) {
			if (err instanceof EncryptionError) return { ok: false, rejected: 'encryption_unconfigured' };
			throw err;
		}
	}

	let written: Awaited<ReturnType<typeof saveProviderConnection>>;
	try {
		written = await saveProviderConnection(db, {
			provider: input.provider,
			enabled: input.enabled,
			modelId: input.modelId,
			apiKeyCiphertext,
			expectedVersion: input.expectedVersion,
			updatedBy: actor.id,
		});
	} catch (err) {
		return { ok: false, rejected: rejectionFromDbError(err) };
	}
	if ('conflict' in written) return { ok: false, rejected: 'conflict' };

	const changedFields = [
		before.enabled !== input.enabled ? 'enabled' : null,
		before.modelId !== input.modelId ? 'modelId' : null,
		replacingKey ? 'apiKey' : null,
	].filter((field): field is string => field !== null);

	const auditRecorded = await audit(actor, 'ai.provider.save', input.provider, {
		version: written.version,
		enabled: input.enabled,
		modelId: input.modelId,
		changedFields,
		keyChange: replacingKey ? 'replaced' : 'kept',
	});
	return { ok: true, version: written.version, auditRecorded };
}

export async function removeProviderConnectionKey(
	input: { provider: AiProviderId; expectedVersion: number },
	actor: ConnectionActor,
): Promise<ConnectionSettingsResult> {
	const registry = await loadProviderRegistry();
	const before = entryFor(registry.entries, input.provider);
	if (before.keyStatus === 'none') return { ok: false, rejected: 'no_key' };
	if (before.isDefault) return { ok: false, rejected: 'default_unusable' };

	let written: Awaited<ReturnType<typeof removeProviderKey>>;
	try {
		written = await removeProviderKey(db, { ...input, updatedBy: actor.id });
	} catch (err) {
		return { ok: false, rejected: rejectionFromDbError(err) };
	}
	if ('conflict' in written) return { ok: false, rejected: 'conflict' };

	const auditRecorded = await audit(actor, 'ai.provider.key.remove', input.provider, {
		version: written.version,
		keyChange: 'removed',
	});
	return { ok: true, version: written.version, auditRecorded };
}

export async function setProjectDefaultProvider(
	input: { provider: AiProviderId | null; expectedCurrentDefault: AiProviderId | null },
	actor: ConnectionActor,
): Promise<DefaultProviderResult> {
	let written: Awaited<ReturnType<typeof setDefaultProvider>>;
	try {
		written = await setDefaultProvider(db, { ...input, updatedBy: actor.id });
	} catch (err) {
		return { ok: false, rejected: rejectionFromDbError(err) };
	}
	if ('conflict' in written) return { ok: false, rejected: 'conflict' };
	if ('unusable' in written) return { ok: false, rejected: 'default_unusable' };

	const target = input.provider ?? input.expectedCurrentDefault ?? 'groq';
	const auditRecorded = await audit(actor, 'ai.provider.default.set', target, {
		from: input.expectedCurrentDefault ?? 'automatic',
		to: input.provider ?? 'automatic',
	});
	return { ok: true, auditRecorded };
}

export interface ProviderConnectionTestInput {
	provider: AiProviderId;
	modelId: string;
	/** An unsaved replacement key to test instead of the stored one. */
	draftApiKey?: string;
}

/**
 * Test exactly what the administrator is looking at: the draft key when one is typed,
 * otherwise the stored key, with the model id from the form. Nothing is written.
 */
export async function runProviderConnectionTest(
	input: ProviderConnectionTestInput,
	actor: ConnectionActor,
): Promise<ProviderConnectionTestResult> {
	const registry = await loadProviderRegistry();
	const entry = entryFor(registry.entries, input.provider);

	const model = input.draftApiKey
		? createProviderModel(input.provider, input.modelId, input.draftApiKey)
		: entry.getInstance(input.modelId);
	if (!model) return { ok: false, rejected: 'no_key' };

	const target = input.draftApiKey || input.modelId !== entry.modelId ? 'draft' : 'saved';
	const result = await testLanguageModel(model);
	const test: ProviderConnectionTest = {
		...result,
		provider: input.provider,
		modelId: input.modelId,
		target,
		version: entry.version,
	};

	const auditRecorded = await audit(actor, 'ai.provider.test', input.provider, {
		modelId: input.modelId,
		target,
		version: entry.version,
		outcome: result.outcome,
		latencyMs: result.latencyMs,
	});
	return { ok: true, test, auditRecorded };
}
