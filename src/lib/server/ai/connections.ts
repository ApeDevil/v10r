/**
 * Provider connections — the saved rows turned into something the resolvers can use.
 *
 * A connection is what the administrator entered for one vendor: enabled or not, the
 * generation model id, and an API key sealed under `ENCRYPTION_KEY`. This module opens
 * the seal and builds the `ProviderRegistry` every AI operation resolves against. The
 * plaintext key exists only inside each entry's `getInstance` closure; nothing here is
 * ever serialized — `publicProviderConnection` is the projection that crosses to a client.
 *
 * Alias-free on purpose: the bare-Bun ingest scripts (`scripts/db/ingest-docs.ts` and the
 * seed scripts) reach `resolveEmbeddingConnection` by relative path so the app and the
 * scripts share one reading of "is Google usable for embeddings" instead of two.
 * `index.ts` is where the app supplies the database and the key.
 */
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createGroq } from '@ai-sdk/groq';
import { createOpenAI } from '@ai-sdk/openai';
import type { LanguageModel } from 'ai';
import { AI_PROVIDER_IDS, type AiProviderId } from '../../types/db-enums';
import type { ProviderConnectionRow } from '../db/schema/ai/provider-connection';
import { type KeyStatus, openSecret } from '../security/aes-gcm';
import { capabilitiesFor, type ModelCapabilities } from './model-capabilities';

export const PROVIDER_LABELS: Record<AiProviderId, string> = {
	groq: 'Groq',
	openai: 'OpenAI',
	google: 'Google Gemini',
};

/** Initial suggestions for the model field — not a claim about what the vendor currently serves. */
export const SUGGESTED_MODEL_IDS: Record<AiProviderId, string> = {
	groq: 'openai/gpt-oss-120b',
	openai: 'gpt-4o-mini',
	google: 'gemini-2.5-flash',
};

export interface ProviderEntry {
	id: AiProviderId;
	name: string;
	enabled: boolean;
	keyStatus: KeyStatus;
	/** Usable for generation: enabled AND the key decrypted. */
	configured: boolean;
	modelId: string;
	capabilities: ModelCapabilities;
	isDefault: boolean;
	version: number;
	updatedAt: Date | null;
	updatedBy: string | null;
	/** A fresh SDK model over the saved key; `modelId` overrides the saved model (connection tests). */
	getInstance: (modelId?: string) => LanguageModel | null;
}

export interface ProviderRegistry {
	entries: ProviderEntry[];
	/** The administrator's project default, or null for Automatic (capability order). */
	defaultProviderId: AiProviderId | null;
	/** At least one stored key could not be decrypted — a configuration fault, not an empty setup. */
	degraded: boolean;
	/**
	 * The Google connection as the embedding path sees it, opened once with the rest of the
	 * registry. A request that already loaded a registry hands this to the embed path instead of
	 * letting it read and decrypt the provider rows a second time. A closure, like `getInstance`:
	 * the key never sits on a serializable field.
	 */
	embeddingConnection: () => EmbeddingConnection;
}

export function createProviderModel(provider: AiProviderId, modelId: string, apiKey: string): LanguageModel {
	switch (provider) {
		case 'groq':
			return createGroq({ apiKey })(modelId);
		case 'openai':
			return createOpenAI({ apiKey })(modelId);
		case 'google':
			return createGoogleGenerativeAI({ apiKey })(modelId);
	}
}

async function openKey(
	row: ProviderConnectionRow | undefined,
	encryptionKey: string | null,
): Promise<{ apiKey: string | null; keyStatus: KeyStatus }> {
	const { plaintext, status } = await openSecret(row?.apiKeyCiphertext, encryptionKey);
	return { apiKey: plaintext, keyStatus: status };
}

/**
 * Build the registry from the saved rows. Providers without a row appear as unconfigured
 * entries carrying the suggested model id and `version: 0`, so the admin form and the
 * resolvers see one shape whether or not anyone has saved anything yet.
 */
export async function resolveProviderRegistry(
	rows: ProviderConnectionRow[],
	encryptionKey: string | null,
): Promise<ProviderRegistry> {
	const byProvider = new Map(rows.map((row) => [row.provider, row]));
	let degraded = false;

	const resolved = await Promise.all(
		AI_PROVIDER_IDS.map(async (id): Promise<{ entry: ProviderEntry; opened: OpenedConnection }> => {
			const row = byProvider.get(id);
			const { apiKey, keyStatus } = await openKey(row, encryptionKey);
			if (keyStatus === 'undecryptable') degraded = true;

			const enabled = row?.enabled ?? false;
			const modelId = row?.modelId ?? SUGGESTED_MODEL_IDS[id];
			const configured = enabled && apiKey !== null;

			const entry: ProviderEntry = {
				id,
				name: PROVIDER_LABELS[id],
				enabled,
				keyStatus,
				configured,
				modelId,
				capabilities: capabilitiesFor(id, modelId),
				isDefault: row?.isDefault ?? false,
				version: row?.version ?? 0,
				updatedAt: row?.updatedAt ?? null,
				updatedBy: row?.updatedBy ?? null,
				getInstance: (override) => (apiKey === null ? null : createProviderModel(id, override ?? modelId, apiKey)),
			};
			return { entry, opened: { enabled, apiKey, keyStatus } };
		}),
	);

	const entries = resolved.map((r) => r.entry);
	const defaultEntry = entries.find((e) => e.isDefault && e.configured);
	const embeddingConnection = embeddingConnectionOf(resolved.find((r) => r.entry.id === 'google')?.opened);
	return {
		entries,
		defaultProviderId: defaultEntry?.id ?? null,
		degraded,
		embeddingConnection: () => embeddingConnection,
	};
}

export type EmbeddingUnavailableReason = 'disabled' | 'no_key' | 'undecryptable';

export type EmbeddingConnection = { apiKey: string } | { unavailable: EmbeddingUnavailableReason };

/** Secret-free explanations shared by the app's RetrievalError and the scripts' exit message. */
export const EMBEDDING_UNAVAILABLE_MESSAGES: Record<EmbeddingUnavailableReason, string> = {
	disabled: 'Embeddings use the Google Gemini connection, which is disabled. Enable it under Admin → AI → Models.',
	no_key: 'Embeddings use the Google Gemini connection, which has no API key. Add one under Admin → AI → Models.',
	undecryptable:
		'The stored Google Gemini key cannot be decrypted with the current ENCRYPTION_KEY. Re-enter the key under Admin → AI → Models, or restore the key the deployment was sealed with.',
};

/** A provider row after its key was opened — what both embedding resolvers decide on. */
interface OpenedConnection {
	enabled: boolean;
	apiKey: string | null;
	keyStatus: KeyStatus;
}

/**
 * The one reading of "is Google usable for embeddings". Embeddings ride the same key as
 * Gemini chat but ignore the generation model and the project default: choosing Groq
 * or OpenAI for chat must not switch off search.
 */
function embeddingConnectionOf(google: OpenedConnection | undefined): EmbeddingConnection {
	if (!google?.enabled) return { unavailable: 'disabled' };
	if (google.keyStatus === 'none') return { unavailable: 'no_key' };
	if (google.apiKey === null) return { unavailable: 'undecryptable' };
	return { apiKey: google.apiKey };
}

/** The Google connection as the embedding path sees it, opened from the saved rows (the scripts' door). */
export async function resolveEmbeddingConnection(
	rows: ProviderConnectionRow[],
	encryptionKey: string | null,
): Promise<EmbeddingConnection> {
	const google = rows.find((row) => row.provider === 'google');
	if (!google?.enabled) return { unavailable: 'disabled' };
	const { apiKey, keyStatus } = await openKey(google, encryptionKey);
	return embeddingConnectionOf({ enabled: true, apiKey, keyStatus });
}

export type EmbeddingStatus = 'ready' | EmbeddingUnavailableReason;

/** The embedding path's status without opening the key twice — derived from the registry. */
export function embeddingStatusFrom(registry: ProviderRegistry): EmbeddingStatus {
	const connection = registry.embeddingConnection();
	return 'apiKey' in connection ? 'ready' : connection.unavailable;
}

/** The sanitized projection for page data and admin endpoints — no key, no ciphertext, no closure. */
export interface PublicProviderConnection {
	provider: AiProviderId;
	name: string;
	enabled: boolean;
	hasKey: boolean;
	keyStatus: KeyStatus;
	configured: boolean;
	modelId: string;
	suggestedModelId: string;
	capabilities: ModelCapabilities;
	isDefault: boolean;
	version: number;
	updatedAt: string | null;
	updatedBy: string | null;
}

export function publicProviderConnection(entry: ProviderEntry): PublicProviderConnection {
	return {
		provider: entry.id,
		name: entry.name,
		enabled: entry.enabled,
		hasKey: entry.keyStatus !== 'none',
		keyStatus: entry.keyStatus,
		configured: entry.configured,
		modelId: entry.modelId,
		suggestedModelId: SUGGESTED_MODEL_IDS[entry.id],
		capabilities: entry.capabilities,
		isDefault: entry.isDefault,
		version: entry.version,
		updatedAt: entry.updatedAt?.toISOString() ?? null,
		updatedBy: entry.updatedBy,
	};
}
