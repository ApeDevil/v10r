/**
 * The administrator's operations on source connections: save, remove the secret, and
 * test. Each one seals the secret, performs one guarded write, then records an audit
 * event — in that order, so a failed audit never hides a change that already happened.
 * The route adapter maps the discriminated results to form feedback; no business rule
 * lives there.
 *
 * Audit detail is deliberately shallow: vendor, version, which fields changed and how the
 * secret changed. Never the secret, never the ciphertext, never a vendor response.
 */
import { type getAuditContext, recordAuditEvent } from '$lib/server/admin';
import { db } from '$lib/server/db';
import { classifyDbError } from '$lib/server/db/errors';
import { removeNameSourceSecret, saveNameSourceConnection } from '$lib/server/db/name-check/source-connections';
import { EncryptionError, encryptAesGcm, getEncryptionKey } from '$lib/server/security';
import type { NameSourceVendor } from '$lib/types/db-enums';
import { type NameSourceTestResult, testNameSourceConnection } from './connection-test';
import type { NameSourceConnection } from './connections';
import { loadNameSourceConnections } from './index';
import type { NameSourceCredentials } from './name-source';
import { EUIPO_DEFAULT_API_BASE, EUIPO_DEFAULT_TOKEN_URL } from './sources/euipo';

type Actor = ReturnType<typeof getAuditContext>;

export type NameSourceConnectionRejection = 'conflict' | 'encryption_unconfigured' | 'no_secret' | 'invalid_fields';

export type NameSourceConnectionSettingsResult =
	| { ok: true; version: number; auditRecorded: boolean }
	| { ok: false; rejected: NameSourceConnectionRejection };

export interface NameSourceConnectionTest extends NameSourceTestResult {
	vendor: NameSourceVendor;
	/** Whether the tested credentials are what is saved, or a draft (an unsaved secret or field). */
	target: 'draft' | 'saved';
	/** The saved version the test was run against — what the admin sees on the card. */
	version: number;
}

export type NameSourceConnectionTestResult =
	| { ok: true; test: NameSourceConnectionTest; auditRecorded: boolean }
	| { ok: false; rejected: 'no_secret' };

const PG_CHECK_VIOLATION = '23514';
const PG_UNIQUE_VIOLATION = '23505';

async function audit(actor: Actor, action: string, vendor: NameSourceVendor, detail: Record<string, unknown>) {
	try {
		await recordAuditEvent({ ...actor, action, targetType: 'name_source_connection', targetId: vendor, detail });
		return true;
	} catch (err) {
		console.error(`[name-check/connection-settings] audit failed for ${action}`, err);
		return false;
	}
}

function entryFor(entries: NameSourceConnection[], vendor: NameSourceVendor): NameSourceConnection {
	const entry = entries.find((e) => e.vendor === vendor);
	if (!entry) throw new Error(`unknown vendor ${vendor}`);
	return entry;
}

/** Map a write that tripped a table constraint onto the form vocabulary; rethrow anything else. */
function rejectionFromDbError(err: unknown): NameSourceConnectionRejection {
	const code = classifyDbError(err).code;
	if (code === PG_CHECK_VIOLATION) return 'invalid_fields';
	if (code === PG_UNIQUE_VIOLATION) return 'conflict';
	throw err;
}

/** The EUIPO-only fields, empty for every other vendor — the table's CHECK says the same. */
function euipoFields(vendor: NameSourceVendor, input: { clientId?: string; apiBase?: string; tokenUrl?: string }) {
	if (vendor !== 'euipo') return { clientId: null, apiBase: null, tokenUrl: null };
	return { clientId: input.clientId || null, apiBase: input.apiBase || null, tokenUrl: input.tokenUrl || null };
}

export interface SaveNameSourceConnectionInput {
	vendor: NameSourceVendor;
	enabled: boolean;
	clientId?: string;
	apiBase?: string;
	tokenUrl?: string;
	/** A replacement secret; omitted or empty keeps the stored one. */
	secret?: string;
	expectedVersion: number;
}

export async function saveNameSourceConnectionSettings(
	input: SaveNameSourceConnectionInput,
	actor: Actor,
): Promise<NameSourceConnectionSettingsResult> {
	const connections = await loadNameSourceConnections();
	const before = entryFor(connections.entries, input.vendor);
	const replacingSecret = !!input.secret;
	const fields = euipoFields(input.vendor, input);

	let secretCiphertext: string | undefined;
	if (replacingSecret) {
		try {
			secretCiphertext = await encryptAesGcm(input.secret as string, getEncryptionKey());
		} catch (err) {
			if (err instanceof EncryptionError) return { ok: false, rejected: 'encryption_unconfigured' };
			throw err;
		}
	}

	let written: Awaited<ReturnType<typeof saveNameSourceConnection>>;
	try {
		written = await saveNameSourceConnection(db, {
			vendor: input.vendor,
			enabled: input.enabled,
			...fields,
			secretCiphertext,
			expectedVersion: input.expectedVersion,
			updatedBy: actor.actorId,
		});
	} catch (err) {
		return { ok: false, rejected: rejectionFromDbError(err) };
	}
	if ('conflict' in written) return { ok: false, rejected: 'conflict' };

	const changedFields = [
		before.enabled !== input.enabled ? 'enabled' : null,
		before.clientId !== fields.clientId ? 'clientId' : null,
		before.apiBase !== fields.apiBase ? 'apiBase' : null,
		before.tokenUrl !== fields.tokenUrl ? 'tokenUrl' : null,
		replacingSecret ? 'secret' : null,
	].filter((field): field is string => field !== null);

	const auditRecorded = await audit(actor, 'name_check.source.save', input.vendor, {
		version: written.version,
		enabled: input.enabled,
		changedFields,
		keyChange: replacingSecret ? 'replaced' : 'kept',
	});
	return { ok: true, version: written.version, auditRecorded };
}

export async function removeNameSourceConnectionSecret(
	input: { vendor: NameSourceVendor; expectedVersion: number },
	actor: Actor,
): Promise<NameSourceConnectionSettingsResult> {
	const connections = await loadNameSourceConnections();
	const before = entryFor(connections.entries, input.vendor);
	if (before.keyStatus === 'none') return { ok: false, rejected: 'no_secret' };

	let written: Awaited<ReturnType<typeof removeNameSourceSecret>>;
	try {
		written = await removeNameSourceSecret(db, { ...input, updatedBy: actor.actorId });
	} catch (err) {
		return { ok: false, rejected: rejectionFromDbError(err) };
	}
	if ('conflict' in written) return { ok: false, rejected: 'conflict' };

	const auditRecorded = await audit(actor, 'name_check.source.secret.remove', input.vendor, {
		version: written.version,
		keyChange: 'removed',
	});
	return { ok: true, version: written.version, auditRecorded };
}

export interface NameSourceConnectionTestInput {
	vendor: NameSourceVendor;
	clientId?: string;
	apiBase?: string;
	tokenUrl?: string;
	/** An unsaved replacement secret to test instead of the stored one. */
	draftSecret?: string;
}

/**
 * The credentials the test should use: the form's fields over the saved ones, the draft
 * secret when one is typed, otherwise the stored secret — read through `secretOf`, which
 * unlike `credentials()` also answers for a disabled or incomplete row.
 */
function credentialsUnderTest(
	input: NameSourceConnectionTestInput,
	entry: NameSourceConnection,
	savedSecret: string | null,
): { credentials: NameSourceCredentials | null; target: 'draft' | 'saved' } {
	const fields = euipoFields(input.vendor, input);
	const fieldsChanged =
		fields.clientId !== entry.clientId || fields.apiBase !== entry.apiBase || fields.tokenUrl !== entry.tokenUrl;
	const target = input.draftSecret || fieldsChanged ? 'draft' : 'saved';
	const secret = input.draftSecret || savedSecret;
	if (!secret) return { credentials: null, target };

	switch (input.vendor) {
		case 'euipo':
			if (!fields.clientId) return { credentials: null, target };
			return {
				target,
				credentials: {
					euipo: {
						clientId: fields.clientId,
						clientSecret: secret,
						apiBase: fields.apiBase ?? EUIPO_DEFAULT_API_BASE,
						tokenUrl: fields.tokenUrl ?? EUIPO_DEFAULT_TOKEN_URL,
					},
					tavilyApiKey: null,
					braveApiKey: null,
				},
			};
		case 'tavily':
			return { target, credentials: { euipo: null, tavilyApiKey: secret, braveApiKey: null } };
		case 'brave':
			return { target, credentials: { euipo: null, tavilyApiKey: null, braveApiKey: secret } };
	}
}

/**
 * Test exactly what the administrator is looking at: the draft secret when one is typed,
 * otherwise the stored secret, with the fields from the form. Nothing is written.
 */
export async function runNameSourceConnectionTest(
	input: NameSourceConnectionTestInput,
	actor: Actor,
): Promise<NameSourceConnectionTestResult> {
	const connections = await loadNameSourceConnections();
	const entry = entryFor(connections.entries, input.vendor);
	const { credentials, target } = credentialsUnderTest(input, entry, connections.secretOf(input.vendor));
	if (!credentials) return { ok: false, rejected: 'no_secret' };

	const result = await testNameSourceConnection(input.vendor, credentials);
	const test: NameSourceConnectionTest = { ...result, vendor: input.vendor, target, version: entry.version };

	const auditRecorded = await audit(actor, 'name_check.source.test', input.vendor, {
		target,
		version: entry.version,
		outcome: result.outcome,
		latencyMs: result.latencyMs,
		detail: result.detail,
	});
	return { ok: true, test, auditRecorded };
}
