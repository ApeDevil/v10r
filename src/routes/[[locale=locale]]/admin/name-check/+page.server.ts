import { fail } from '@sveltejs/kit';
import * as v from 'valibot';
import { nameSourceConnectionLabels } from '$lib/name-check/connection-labels';
import * as m from '$lib/paraglide/messages';
import {
	nameSourceConnectionSaveSchema,
	nameSourceConnectionTestSchema,
	nameSourceSecretRemoveSchema,
} from '$lib/schemas/admin/name-check-connections';
import { getAuditContext } from '$lib/server/admin';
import { requireAdmin } from '$lib/server/http/guards';
import { createLimiter } from '$lib/server/http/rate-limit';
import {
	EUIPO_DEFAULT_API_BASE,
	EUIPO_DEFAULT_TOKEN_URL,
	loadNameSourceConnections,
	NAME_SOURCE_VENDOR_LABELS,
	type NameSourceConnections,
	publicNameSourceConnection,
} from '$lib/server/name-check';
import {
	SOURCE_TEST_RATE_LIMIT_MAX,
	SOURCE_TEST_RATE_LIMIT_PREFIX,
	SOURCE_TEST_RATE_LIMIT_WINDOW,
} from '$lib/server/name-check/config';
import {
	type NameSourceConnectionRejection,
	removeNameSourceConnectionSecret,
	runNameSourceConnectionTest,
	saveNameSourceConnectionSettings,
} from '$lib/server/name-check/connection-settings';
import { EncryptionError, getEncryptionKey } from '$lib/server/security';
import type { NameSourceVendor } from '$lib/types/db-enums';
import type { Actions, PageServerLoad } from './$types';

/**
 * Name check sources — where the administrator connects the vendors the check may query.
 * The page reads the SAME connections `checkName()` runs with and hands every mutation to
 * `name-check/connection-settings.ts`; this file only translates form data and results.
 *
 * The one rule it does own: no action payload — success or failure — ever carries the
 * submitted secret or the stored envelope. Responses are messages and ids.
 */

const testLimiter = createLimiter(
	SOURCE_TEST_RATE_LIMIT_PREFIX,
	SOURCE_TEST_RATE_LIMIT_MAX,
	SOURCE_TEST_RATE_LIMIT_WINDOW,
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
	const labels = nameSourceConnectionLabels(NAME_SOURCE_VENDOR_LABELS);
	// The EUIPO card shows the production hosts as placeholders, from the source's own
	// defaults — the same values an empty field resolves to.
	const euipoDefaults = { apiBase: EUIPO_DEFAULT_API_BASE, tokenUrl: EUIPO_DEFAULT_TOKEN_URL };

	let connections: NameSourceConnections;
	try {
		connections = await loadNameSourceConnections();
	} catch {
		// The table is what an operator comes here to fix — a missing or unreachable one
		// must render the page, not 500 it.
		return {
			title: 'Name check sources',
			unavailable: true as const,
			connections: [],
			degraded: false,
			encryptionConfigured: encryptionConfigured(),
			labels,
			euipoDefaults,
		};
	}

	return {
		title: 'Name check sources',
		unavailable: false as const,
		connections: connections.entries.map(publicNameSourceConnection),
		degraded: connections.degraded,
		encryptionConfigured: encryptionConfigured(),
		labels,
		euipoDefaults,
	};
};

function actorFrom(event: Parameters<NonNullable<Actions[string]>>[0]) {
	const { user } = requireAdmin(event.locals);
	return getAuditContext(user, event.getClientAddress());
}

/** Form data → plain object with the coercions the schemas expect. Never logged, never echoed. */
function fieldsOf(formData: FormData) {
	const text = (name: string) => {
		const value = formData.get(name);
		return typeof value === 'string' ? value : undefined;
	};
	const versionRaw = text('version');
	return {
		vendor: text('vendor'),
		enabled: text('enabled') === 'true',
		clientId: text('clientId'),
		secret: text('secret') || undefined,
		apiBase: text('apiBase'),
		tokenUrl: text('tokenUrl'),
		version: versionRaw === undefined ? undefined : Number(versionRaw),
	};
}

function validationMessage(err: unknown): string {
	return err instanceof v.ValiError
		? (err.issues[0]?.message ?? m.admin_name_check_error_validation())
		: m.admin_name_check_error_validation();
}

function rejectionFailure(rejected: NameSourceConnectionRejection, vendor: NameSourceVendor) {
	const name = NAME_SOURCE_VENDOR_LABELS[vendor];
	switch (rejected) {
		case 'conflict':
			return fail(409, { vendor, message: m.admin_name_check_error_conflict() });
		case 'encryption_unconfigured':
			return fail(500, { vendor, message: m.admin_name_check_error_encryption() });
		case 'no_secret':
			return fail(400, { vendor, message: m.admin_name_check_error_no_secret({ name }) });
		case 'invalid_fields':
			return fail(400, { vendor, message: m.admin_name_check_error_invalid_fields() });
	}
}

export const actions: Actions = {
	save: async (event) => {
		const actor = actorFrom(event);
		let input: v.InferOutput<typeof nameSourceConnectionSaveSchema>;
		try {
			input = v.parse(nameSourceConnectionSaveSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await saveNameSourceConnectionSettings(
			{
				vendor: input.vendor,
				enabled: input.enabled,
				clientId: input.clientId,
				apiBase: input.apiBase,
				tokenUrl: input.tokenUrl,
				secret: input.secret,
				expectedVersion: input.version,
			},
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.vendor);

		const name = NAME_SOURCE_VENDOR_LABELS[input.vendor];
		return {
			saved: { vendor: input.vendor, version: result.version },
			message: result.auditRecorded
				? m.admin_name_check_saved({ name })
				: m.admin_name_check_saved_audit_failed({ name }),
		};
	},

	test: async (event) => {
		const actor = actorFrom(event);
		const { success } = await testLimiter.limit(actor.actorId);
		if (!success) return fail(429, { message: m.admin_name_check_error_rate_limited() });

		let input: v.InferOutput<typeof nameSourceConnectionTestSchema>;
		try {
			input = v.parse(nameSourceConnectionTestSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await runNameSourceConnectionTest(
			{
				vendor: input.vendor,
				clientId: input.clientId,
				apiBase: input.apiBase,
				tokenUrl: input.tokenUrl,
				draftSecret: input.secret,
			},
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.vendor);
		return { test: result.test };
	},

	removeSecret: async (event) => {
		const actor = actorFrom(event);
		let input: v.InferOutput<typeof nameSourceSecretRemoveSchema>;
		try {
			input = v.parse(nameSourceSecretRemoveSchema, fieldsOf(await event.request.formData()));
		} catch (err) {
			return fail(400, { message: validationMessage(err) });
		}

		const result = await removeNameSourceConnectionSecret(
			{ vendor: input.vendor, expectedVersion: input.version },
			actor,
		);
		if (!result.ok) return rejectionFailure(result.rejected, input.vendor);

		const name = NAME_SOURCE_VENDOR_LABELS[input.vendor];
		return {
			saved: { vendor: input.vendor, version: result.version },
			message: result.auditRecorded
				? m.admin_name_check_secret_removed({ name })
				: m.admin_name_check_saved_audit_failed({ name }),
		};
	},
};
