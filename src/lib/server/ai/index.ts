/**
 * The AI domain's composition root for provider configuration.
 *
 * `loadProviderRegistry` is the one door from "what the administrator saved" to "what
 * this operation will use": it reads the rows, supplies the deployment's encryption key,
 * and hands back a snapshot. Every AI operation loads one at its start and threads it
 * through resolution and fallback, so a settings change reaches the next operation on
 * every instance without a cache to invalidate, and an operation already in flight
 * finishes on the snapshot it started with. No registry is built at import time.
 *
 * Failure is reported, never papered over: an unreadable table is an `AiError`, and a key
 * that will not decrypt marks the registry `degraded` — neither falls back to the
 * environment or reads as "nothing configured".
 */
import { db } from '$lib/server/db';
import { listProviderConnections } from '$lib/server/db/ai/provider-connections';
import { EncryptionError, getEncryptionKey } from '$lib/server/security';
import {
	type EmbeddingConnection,
	type ProviderEntry,
	type ProviderRegistry,
	resolveEmbeddingConnection,
	resolveProviderRegistry,
} from './connections';
import { AiError } from './errors';
import {
	getFallbackProviders,
	getUserPreference,
	resolveActiveProvider,
	resolveToolProvider,
	resolveVisionProvider,
} from './providers';

export type { EmbeddingConnection, ProviderEntry, ProviderRegistry, PublicProviderConnection } from './connections';
export { EMBEDDING_UNAVAILABLE_MESSAGES, publicProviderConnection } from './connections';

async function readRows() {
	try {
		return await listProviderConnections(db);
	} catch (err) {
		const unreadable = new AiError('unavailable', 'AI settings could not be read.', 'SETTINGS_UNREADABLE');
		unreadable.cause = err;
		throw unreadable;
	}
}

/** The validated key, or null when the deployment has none — entries then report `undecryptable`. */
function readEncryptionKeyOrNull(): string | null {
	try {
		return getEncryptionKey();
	} catch (err) {
		if (err instanceof EncryptionError) return null;
		throw err;
	}
}

/** Load the saved provider connections as the snapshot one AI operation will use. */
export async function loadProviderRegistry(): Promise<ProviderRegistry> {
	return resolveProviderRegistry(await readRows(), readEncryptionKeyOrNull());
}

/** The Google connection as the embedding path sees it (see `resolveEmbeddingConnection`). */
export async function loadEmbeddingConnection(): Promise<EmbeddingConnection> {
	return resolveEmbeddingConnection(await readRows(), readEncryptionKeyOrNull());
}

// Per-operation resolution over a loaded registry. Precedence everywhere:
// explicit override → stored user preference → project default → capability order.

function preferenceFor(userId?: string, overrideProviderId?: string): string | null {
	return overrideProviderId ?? (userId ? getUserPreference(userId) : null);
}

export function getActiveProvider(
	registry: ProviderRegistry,
	userId?: string,
	overrideProviderId?: string,
): ProviderEntry | null {
	return resolveActiveProvider(registry, preferenceFor(userId, overrideProviderId));
}

export function getToolProvider(
	registry: ProviderRegistry,
	userId?: string,
	overrideProviderId?: string,
): ProviderEntry | null {
	return resolveToolProvider(registry, preferenceFor(userId, overrideProviderId));
}

/** Never returns a text-only model; null when no vision-capable connection is configured. */
export function getVisionProvider(
	registry: ProviderRegistry,
	userId?: string,
	overrideProviderId?: string,
): ProviderEntry | null {
	return resolveVisionProvider(registry, preferenceFor(userId, overrideProviderId));
}

/** `{ id, name, model }` of the active provider — the wire shape the desk client reads. */
export function getActiveProviderInfo(
	registry: ProviderRegistry,
	userId?: string,
	overrideProviderId?: string,
): { id: string; name: string; model: string } | null {
	const active = getActiveProvider(registry, userId, overrideProviderId);
	return active ? { id: active.id, name: active.name, model: active.modelId } : null;
}

export function getFallbacksForUser(
	registry: ProviderRegistry,
	userId?: string,
	overrideProviderId?: string,
): ProviderEntry[] {
	const active = getActiveProvider(registry, userId, overrideProviderId);
	return active ? getFallbackProviders(registry, active.id) : [];
}
