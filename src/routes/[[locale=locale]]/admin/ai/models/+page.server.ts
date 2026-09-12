import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import * as m from '$lib/paraglide/messages';
import {
	AUTOMATIC_DEFAULT,
	defaultProviderSchema,
	providerConnectionSaveSchema,
	providerConnectionTestSchema,
	providerKeyRemoveSchema,
} from '$lib/schemas/admin/ai-connections';
import {
	getActiveProviderInfo,
	getFallbacksForUser,
	getToolProvider,
	getVisionProvider,
	loadProviderRegistry,
	type ProviderRegistry,
	publicProviderConnection,
} from '$lib/server/ai';
import {
	CONNECTION_TEST_RATE_LIMIT_MAX,
	CONNECTION_TEST_RATE_LIMIT_PREFIX,
	CONNECTION_TEST_RATE_LIMIT_WINDOW,
} from '$lib/server/ai/config';
import {
	type ConnectionActor,
	type ConnectionRejection,
	removeProviderConnectionKey,
	runProviderConnectionTest,
	saveProviderConnectionSettings,
	setProjectDefaultProvider,
} from '$lib/server/ai/connection-settings';
import { embeddingStatusFrom, PROVIDER_LABELS } from '$lib/server/ai/connections';
import { getCooldownResumeAt } from '$lib/server/ai/providers';
import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter } from '$lib/server/http/rate-limit';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '$lib/server/retrieval-shared/embed-config';
import { EncryptionError, getEncryptionKey } from '$lib/server/security';
import type { AiProviderId } from '$lib/types/db-enums';
import type { Actions, PageServerLoad } from './$types';

/**
 * Models & Routing — where the administrator connects providers. The page reads the SAME
 * registry the orchestrator resolves against (single door: never recompute "which
 * provider is active" in admin code) and hands every mutation to
 * `ai/connection-settings.ts`; this file only translates form data and results.
 *
 * The one rule it does own: no action payload — success or failure — ever carries the
 * submitted key or the stored ciphertext. Responses are messages and ids.
 */

const testLimiter = createLimiter(
	CONNECTION_TEST_RATE_LIMIT_PREFIX,
	CONNECTION_TEST_RATE_LIMIT_MAX,
	CONNECTION_TEST_RATE_LIMIT_WINDOW,
);

function encryptionConfigured(): boolean {
	try {
		getEncryptionKey();
		return true;
	} catch (err) {
		if (err instanceof EncryptionError) return false;
		throw err;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	requireAdmin(locals);

	let registry: ProviderRegistry;
	try {
		registry = await loadProviderRegistry();
	} catch {
		// The table is what an operator comes here to fix — a missing or unreachable one
		// must render the page, not 500 it.
		return {
			title: 'Models & Routing',
			unavailable: true as const,
			connections: [],
			defaultProviderId: null,
			degraded: false,
			encryptionConfigured: encryptionConfigured(),
			activeProviderId: null,
			toolProviderId: null,
			visionProviderId: null,
			fallbackIds: [] as string[],
			cooldowns: {} as Record<string, string | null>,
			embedding: { modelId: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, status: 'disabled' as const },
		};
	}

	const cooldowns: Record<string, string | null> = {};
	await Promise.all(
		registry.entries.map(async (p) => {
			cooldowns[p.id] = p.configured ? await getCooldownResumeAt(p.id) : null;
		}),
	);

	return {
		title: 'Models & Routing',
		unavailable: false as const,
		connections: registry.entries.map(publicProviderConnection),
		defaultProviderId: registry.defaultProviderId,
		degraded: registry.degraded,
		encryptionConfigured: encryptionConfigured(),
		activeProviderId: getActiveProviderInfo(registry)?.id ?? null,
		toolProviderId: getToolProvider(registry)?.id ?? null,
		visionProviderId: getVisionProvider(registry)?.id ?? null,
		fallbackIds: getFallbacksForUser(registry).map((f) => f.id),
		cooldowns,
		embedding: { modelId: EMBEDDING_MODEL, dimensions: EMBEDDING_DIMENSIONS, status: embeddingStatusFrom(registry) },
	};
};

function actorFrom(event: Parameters<NonNullable<Actions[string]>>[0]): ConnectionActor {
	const { user } = requireAdmin(event.locals);
	return { id: user.id, email: user.email, ip: event.getClientAddress() };
}

/** Form data → plain object with the coercions the schemas expect. Never logged, never echoed. */
function fieldsOf(formData: FormData) {
	const text = (name: string) => {
		const value = formData.get(name);
		return typeof value === 'string' ? value : undefined;
	};
	const versionRaw = text('version');
	return {
		provider: text('provider'),
		enabled: text('enabled') === 'true',
		modelId: text('modelId'),
		apiKey: text('apiKey') || undefined,
		version: versionRaw === undefined ? undefined : Number(versionRaw),
		expectedCurrentDefault: text('expectedCurrentDefault'),
	};
}

function validationMessage(err: unknown): string {
	return err instanceof v.ValiError
		? (err.issues[0]?.message ?? m.admin_ai_models_error_validation())
		: m.admin_ai_models_error_validation();
}

function rejectionFailure(rejected: ConnectionRejection, provider: AiProviderId) {
	const name = PROVIDER_LABELS[provider];
	switch (rejected) {
		case 'conflict':
			return fail(409, { provider, message: m.admin_ai_models_error_conflict() });
		case 'default_unusable':
			return fail(400, { provider, message: m.admin_ai_models_error_default_unusable({ name }) });
		case 'encryption_unconfigured':
			return fail(500, { provider, message: m.admin_ai_models_error_encryption() });
		case 'no_key':
			return fail(400, { provider, message: m.admin_ai_models_error_no_key({ name }) });
	}
}

export const actions: Actions = {
	save: async (event) => {
		const actor = actorFrom(event);
		let input: v.InferOutput<typeof providerConnectionSaveSchema>;
		try {
			input = v.parse(providerConnectionSaveSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await saveProviderConnectionSettings(
			{
				provider: input.provider,
				enabled: input.enabled,
				modelId: input.modelId,
				apiKey: input.apiKey,
				expectedVersion: input.version,
			},
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.provider);

		const name = PROVIDER_LABELS[input.provider];
		return {
			saved: { provider: input.provider, version: result.version },
			message: result.auditRecorded
				? m.admin_ai_models_saved({ name })
				: m.admin_ai_models_saved_audit_failed({ name }),
		};
	},

	test: async (event) => {
		const actor = actorFrom(event);
		const { success } = await testLimiter.limit(actor.id);
		if (!success) return fail(429, { message: m.admin_ai_models_error_rate_limited() });

		let input: v.InferOutput<typeof providerConnectionTestSchema>;
		try {
			input = v.parse(providerConnectionTestSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await runProviderConnectionTest(
			{ provider: input.provider, modelId: input.modelId, draftApiKey: input.apiKey },
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.provider);
		return { test: result.test };
	},

	removeKey: async (event) => {
		const actor = actorFrom(event);
		let input: v.InferOutput<typeof providerKeyRemoveSchema>;
		try {
			input = v.parse(providerKeyRemoveSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await removeProviderConnectionKey(
			{ provider: input.provider, expectedVersion: input.version },
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.provider);

		const name = PROVIDER_LABELS[input.provider];
		return {
			saved: { provider: input.provider, version: result.version },
			message: result.auditRecorded
				? m.admin_ai_models_key_removed({ name })
				: m.admin_ai_models_saved_audit_failed({ name }),
		};
	},

	setDefault: async (event) => {
		const actor = actorFrom(event);
		let input: v.InferOutput<typeof defaultProviderSchema>;
		try {
			input = v.parse(defaultProviderSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const provider = input.provider === AUTOMATIC_DEFAULT ? null : input.provider;
		const expectedCurrentDefault =
			input.expectedCurrentDefault === AUTOMATIC_DEFAULT ? null : input.expectedCurrentDefault;
		const result = await setProjectDefaultProvider({ provider, expectedCurrentDefault }, actor);
		if (!result.ok) return rejectionFailure(result.rejected, provider ?? expectedCurrentDefault ?? 'groq');

		return {
			defaultSaved: provider,
			message: provider
				? m.admin_ai_models_default_saved({ name: PROVIDER_LABELS[provider] })
				: m.admin_ai_models_default_saved_automatic(),
		};
	},
};
