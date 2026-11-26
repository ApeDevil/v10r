/**
 * The authorization page — where a signed-in user decides whether an external application
 * (an MCP host such as Claude or ChatGPT) may use a Velociraptor service on their behalf.
 *
 * Better Auth's authorization endpoint redirects here with the signed authorization request
 * (`consentPage`). The page shows what the server can actually establish about the application
 * (`describeAuthorizationRequest`: a verified domain, or a self-declared name), which services
 * and scopes it asks for, and where the browser returns; the decision posts the signed request
 * back to the consent endpoint. Signed out → the login page, which resumes this request.
 */
import { error, fail, redirect } from '@sveltejs/kit';
import { isAPIError } from 'better-auth/api';
import { localizeHref } from '#lib/i18n/index.ts';
import { describeAuthorizationRequest } from '#lib/server/auth/application-authorizations.ts';
import { submitAuthorizationDecision } from '#lib/server/auth/authorization-decision.ts';
import { siteUrl } from '#lib/server/auth/index.ts';
import {
	OFFLINE_ACCESS_SCOPE,
	PROTECTED_MCP_SERVICES,
	serviceForResource,
} from '#lib/server/auth/protected-mcp-services.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) redirect(303, `${localizeHref('/auth/login')}${url.search}`);

	const clientId = url.searchParams.get('client_id');
	if (!clientId || !url.searchParams.has('sig')) error(400, 'This authorization request is incomplete.');

	const application = await describeAuthorizationRequest(clientId, url.searchParams.get('redirect_uri'));
	if (!application) error(400, 'This application is not registered, or it was disabled.');

	const scopes = (url.searchParams.get('scope') ?? '').split(' ').filter(Boolean);
	const byResource = url.searchParams
		.getAll('resource')
		.map((resource) => serviceForResource(resource, siteUrl.origin))
		.filter((service) => service !== undefined);
	const services = PROTECTED_MCP_SERVICES.filter(
		(service) => scopes.includes(service.scope) || byResource.includes(service),
	).map(({ id, name }) => ({ id, name }));

	return {
		title: 'Authorize application',
		application,
		services,
		staysConnected: scopes.includes(OFFLINE_ACCESS_SCOPE),
		account: { email: locals.user.email },
		oauthQuery: url.search.slice(1),
	};
};

export const actions: Actions = {
	default: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { message: 'Sign in again to answer this request.' });
		const form = await request.formData();
		const oauthQuery = form.get('oauth_query');
		const decision = form.get('decision');
		if (typeof oauthQuery !== 'string' || (decision !== 'allow' && decision !== 'deny')) {
			return fail(400, { message: 'This authorization request is incomplete.' });
		}
		let next: string | null;
		try {
			next = await submitAuthorizationDecision(request.headers, oauthQuery, decision === 'allow');
		} catch (cause) {
			if (isAPIError(cause))
				return fail(400, { message: 'This authorization request expired. Start again from the application.' });
			throw cause;
		}
		if (!next) return fail(400, { message: 'This authorization request expired. Start again from the application.' });
		redirect(303, next);
	},
};
