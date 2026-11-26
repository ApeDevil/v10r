/**
 * Connected applications — the external applications (MCP hosts and other OAuth clients) this
 * user has authorized to use Velociraptor services on their behalf, and the one action that
 * matters here: revoke. Service-agnostic: every protected MCP service's authorizations appear,
 * labelled by `PROTECTED_MCP_SERVICES`.
 *
 * Revoking is a de-privileging action, so it needs no step-up; it takes effect on the
 * application's next request (`application-authorizations.ts`).
 */
import { fail, redirect } from '@sveltejs/kit';
import { localizeHref } from '#lib/i18n/index.ts';
import {
	listApplicationAuthorizations,
	revokeApplicationAuthorization,
} from '#lib/server/auth/application-authorizations.ts';
import { siteUrl } from '#lib/server/auth/index.ts';
import {
	OFFLINE_ACCESS_SCOPE,
	PROTECTED_MCP_SERVICES,
	serviceForResource,
} from '#lib/server/auth/protected-mcp-services.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, setHeaders }) => {
	if (!locals.user) redirect(303, localizeHref('/auth/login?returnTo=/account/connections'));
	setHeaders({ 'Cache-Control': 'no-store, private' });

	const authorizations = await listApplicationAuthorizations(locals.user.id);
	return {
		title: 'Connected applications',
		authorizations: authorizations.map((authorization) => {
			const fromResources = (authorization.resources ?? [])
				.map((resource) => serviceForResource(resource, siteUrl.origin))
				.filter((service) => service !== undefined);
			const services = PROTECTED_MCP_SERVICES.filter(
				(service) => authorization.scopes.includes(service.scope) || fromResources.includes(service),
			).map(({ id, name }) => ({ id, name }));
			return {
				id: authorization.id,
				identity: authorization.identity,
				services,
				staysConnected: authorization.scopes.includes(OFFLINE_ACCESS_SCOPE),
				authorizedAt: authorization.authorizedAt.toISOString(),
				lastRenewedAt: authorization.lastRenewedAt?.toISOString() ?? null,
			};
		}),
	};
};

export const actions: Actions = {
	revoke: async ({ request, locals }) => {
		if (!locals.user) redirect(303, localizeHref('/auth/login'));
		const form = await request.formData();
		const id = form.get('authorizationId');
		if (typeof id !== 'string' || !id) return fail(400, { message: 'Missing authorization.' });
		const revoked = await revokeApplicationAuthorization(locals.user.id, id);
		if (!revoked) return fail(404, { message: 'That authorization no longer exists.' });
		return { revoked: true };
	},
};
