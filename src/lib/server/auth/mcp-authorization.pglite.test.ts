import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { user } from '#lib/server/db/schema/auth/_better-auth.ts';
import { oauthConsent } from '#lib/server/db/schema/auth/oauth-provider.ts';

/**
 * MCP authorization end to end, against real Postgres and the real Better Auth instance — the
 * path an MCP host takes: 401 challenge → metadata discovery → client registration (DCR or a
 * Client ID Metadata Document) → authorization with a signed-in user → code exchange with PKCE
 * and RFC 8707 `resource` → protected call → refresh → revocation and suspension.
 *
 * What only this level proves: that the plugin's real token is accepted by
 * `verifyResourceAccess` (issuer, audience, scope, signature against the in-process JWKS);
 * that a token for no audience or the wrong one is refused; and that revocation and a ban
 * take effect on the next request even though the JWT is still unexpired.
 */
const ORIGIN = 'http://localhost:5173';
process.env.BETTER_AUTH_URL = ORIGIN;
process.env.GITHUB_CLIENT_ID ||= 'test';
process.env.GITHUB_CLIENT_SECRET ||= 'test';
process.env.GOOGLE_CLIENT_ID ||= 'test';
process.env.GOOGLE_CLIENT_SECRET ||= 'test';

vi.mock('#lib/server/db/index.ts', async () => {
	const { createTestDb } = await import('#lib/server/test/db.ts');
	return { db: (await createTestDb()).db };
});
const mail = vi.hoisted(() => ({ otps: [] as string[] }));
vi.mock('./send-auth-email', () => ({
	sendAuthEmail: vi.fn(async ({ html }: { html: string }) => {
		mail.otps.push(html);
	}),
	otpTemplate: (otp: string) => otp,
	magicLinkTemplate: (url: string) => url,
	factorChangeTemplate: (label: string) => label,
}));

/** A Client ID Metadata Document "hosted" at an HTTPS URL, served without network access. */
const CIMD_CLIENT_ID = 'https://claude.ai/oauth/test-client-metadata';
const CIMD_REDIRECT = 'https://claude.ai/api/mcp/auth_callback';
vi.mock('@better-auth/cimd/node', () => ({
	fetchClientMetadataResource: vi.fn(async (url: string | URL) => {
		if (String(url) !== CIMD_CLIENT_ID) return new Response('not found', { status: 404 });
		return Response.json({
			client_id: CIMD_CLIENT_ID,
			client_name: 'Claude',
			redirect_uris: [CIMD_REDIRECT],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
		});
	}),
}));

const { auth } = await import('./index');
const { db } = await import('#lib/server/db/index.ts');
const { verifyResourceAccess, protectedResourceMetadata } = await import('./resource-access');
const { MCP_3D_SERVICE, resourceIdentifier } = await import('./protected-mcp-services');
const { listApplicationAuthorizations, revokeApplicationAuthorization, describeAuthorizationRequest } = await import(
	'./application-authorizations'
);

const { POST: mcp3dPost } = await import('../../../routes/api/mcp/3d/+server');
const authorizationPage = await import('../../../routes/[[locale=locale]]/auth/authorize/+page.server');
const { permitFormActionSource } = await import('./callback-destination');

/**
 * SvelteKit's own form-action pipeline (the code that runs a POST to a page: native submission
 * answers with the action result, `use:enhance` with its JSON form). Loaded by path because the
 * package does not export it; this is what turned the authorization page's redirect into a 500.
 */
interface KitActionResult {
	type: 'success' | 'failure' | 'redirect' | 'error';
	status?: number;
	location?: string;
	data?: unknown;
	error?: unknown;
}
const KIT_ACTIONS = '../../../../node_modules/@sveltejs/kit/src/runtime/server/page/actions.js';
const kitActions = (await import(/* @vite-ignore */ KIT_ACTIONS)) as {
	handle_action_request(event: unknown, state: unknown, server: unknown): Promise<KitActionResult>;
	handle_action_json_request(event: unknown, state: unknown, server: unknown): Promise<Response>;
};
// The server initializes its serializer at startup; without it a JSON failure result cannot be written.
const KIT_TRANSPORT = '../../../../node_modules/@sveltejs/kit/src/runtime/app/internal/transport.js';
((await import(/* @vite-ignore */ KIT_TRANSPORT)) as { init_transport(transport: object): void }).init_transport({});
const { MCP_CLIENT_HEADERS } = await import('#lib/server/mcp/mcp-post.ts');

const RESOURCE = resourceIdentifier(MCP_3D_SERVICE, ORIGIN);
const DCR_REDIRECT = 'http://127.0.0.1:33418/callback';

const authApi = (path: string, init: RequestInit = {}) => auth.handler(new Request(`${ORIGIN}/api/auth${path}`, init));
const form = (body: Record<string, string>): RequestInit => ({
	method: 'POST',
	headers: { 'content-type': 'application/x-www-form-urlencoded' },
	body: new URLSearchParams(body).toString(),
});
const mcpRequest = (token?: string) =>
	new Request(RESOURCE, {
		method: 'POST',
		headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
		body: '{}',
	});

function pkce() {
	const verifier = randomBytes(32).toString('base64url');
	return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

async function signIn(email: string): Promise<{ cookie: string; userId: string }> {
	mail.otps.length = 0;
	const json = { 'content-type': 'application/json', origin: ORIGIN };
	await authApi('/email-otp/send-verification-otp', {
		method: 'POST',
		headers: json,
		body: JSON.stringify({ email, type: 'sign-in' }),
	});
	const response = await authApi('/sign-in/email-otp', {
		method: 'POST',
		headers: json,
		body: JSON.stringify({ email, otp: mail.otps[0] }),
	});
	expect(response.status).toBe(200);
	const cookie = response.headers
		.getSetCookie()
		.map((c) => c.split(';')[0])
		.join('; ');
	const body = (await response.json()) as { user: { id: string } };
	return { cookie, userId: body.user.id };
}

interface Tokens {
	access_token: string;
	refresh_token?: string;
	token_type: string;
	expires_in: number;
	scope: string;
}

/** Authorize (signed in) → allow on the authorization page → exchange the code. */
async function authorize(
	cookie: string,
	clientId: string,
	redirectUri: string,
	options: { scope?: string; resource?: string | null; accept?: boolean } = {},
): Promise<{ tokens?: Tokens; redirect: URL; consentPage: URL | null }> {
	const { verifier, challenge } = pkce();
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: redirectUri,
		code_challenge: challenge,
		code_challenge_method: 'S256',
		scope: options.scope ?? 'mcp:3d:use offline_access',
		state: 'state-1',
	});
	if (options.resource !== null) params.set('resource', options.resource ?? RESOURCE);
	const start = await authApi(`/oauth2/authorize?${params}`, { headers: { cookie } });
	expect([302, 303]).toContain(start.status);
	const location = new URL(start.headers.get('location') as string, ORIGIN);
	let redirect: URL;
	let consentPage: URL | null = null;
	if (location.pathname === '/auth/authorize') {
		consentPage = location;
		const answer = await submitConsentPage(cookie, consentPage, options.accept === false ? 'deny' : 'allow');
		expect(answer.type).toBe('redirect');
		redirect = new URL(answer.location as string);
	} else {
		// This user already authorized this client for these scopes: no second page.
		redirect = location;
	}
	expect(`${redirect.origin}${redirect.pathname}`).toBe(redirectUri);
	const code = redirect.searchParams.get('code');
	if (!code) return { redirect, consentPage };

	const exchange: Record<string, string> = {
		grant_type: 'authorization_code',
		code,
		redirect_uri: redirectUri,
		client_id: clientId,
		code_verifier: verifier,
	};
	if (options.resource !== null) exchange.resource = options.resource ?? RESOURCE;
	const token = await authApi('/oauth2/token', form(exchange));
	expect(token.status).toBe(200);
	return { tokens: (await token.json()) as Tokens, redirect, consentPage };
}

/** A request event for the authorization page, as SvelteKit builds it for this signed-in user. */
async function pageEvent(cookie: string, url: URL, init?: RequestInit) {
	const session = await auth.api.getSession({ headers: new Headers({ cookie }) });
	const request = new Request(url, { ...init, headers: { cookie, ...(init?.headers ?? {}) } });
	return {
		request,
		url: new URL(request.url),
		params: {},
		route: { id: '/[[locale=locale]]/auth/authorize' },
		locals: { user: session?.user ?? null } as App.Locals,
		cookies: { get: () => undefined, getAll: () => [], set() {}, delete() {}, serialize: () => '' },
		fetch,
		getClientAddress: () => '127.0.0.1',
		platform: undefined,
		setHeaders() {},
		isDataRequest: false,
		isSubRequest: false,
		isRemoteRequest: false,
		tracing: { enabled: false, root: undefined, current: undefined },
	};
}

/**
 * Answer the authorization page the way a browser does: POST the page's own form (the signed
 * `oauth_query` it rendered, and the pressed button) to the page URL, through SvelteKit's
 * action pipeline. `native` is a plain form submission; `enhanced` is `use:enhance`'s fetch,
 * whose result SvelteKit serializes as JSON.
 */
async function submitConsentPage(
	cookie: string,
	consentPage: URL,
	decision: 'allow' | 'deny',
	mode: 'native' | 'enhanced' = 'native',
	oauthQuery: string = consentPage.search.slice(1),
): Promise<KitActionResult> {
	const pageUrl = new URL(`${consentPage.pathname}${consentPage.search}`, ORIGIN);
	const event = await pageEvent(cookie, pageUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/x-www-form-urlencoded',
			origin: ORIGIN,
			...(mode === 'enhanced' ? { accept: 'application/json', 'x-sveltekit-action': 'true' } : {}),
		},
		body: new URLSearchParams({ oauth_query: oauthQuery, decision }).toString(),
	});
	if (mode === 'enhanced') {
		const response = await kitActions.handle_action_json_request(event, {}, authorizationPage);
		return (await response.json()) as KitActionResult;
	}
	return kitActions.handle_action_request(event, {}, authorizationPage);
}

/** Start an authorization request and return the consent page it lands on. */
async function consentPageFor(cookie: string, clientId: string, redirectUri: string, state = 'state-1') {
	const { challenge } = pkce();
	const params = new URLSearchParams({
		response_type: 'code',
		client_id: clientId,
		redirect_uri: redirectUri,
		code_challenge: challenge,
		code_challenge_method: 'S256',
		scope: 'mcp:3d:use',
		state,
		resource: RESOURCE,
		prompt: 'consent',
	});
	const start = await authApi(`/oauth2/authorize?${params}`, { headers: { cookie } });
	const location = new URL(start.headers.get('location') as string, ORIGIN);
	expect(location.pathname).toBe('/auth/authorize');
	return location;
}

async function registerDcrClient(): Promise<string> {
	const response = await authApi('/oauth2/register', {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({
			client_name: 'ChatGPT', // a self-declared name: anyone can claim it
			redirect_uris: [DCR_REDIRECT],
			token_endpoint_auth_method: 'none',
			grant_types: ['authorization_code', 'refresh_token'],
			response_types: ['code'],
		}),
	});
	if (response.status !== 201) throw new Error(`register ${response.status} ${await response.clone().text()}`);
	const body = (await response.json()) as { client_id: string; client_secret?: string };
	expect(body.client_secret).toBeUndefined(); // a public client
	return body.client_id;
}

let alice: { cookie: string; userId: string };
let dcrClient: string;

beforeAll(async () => {
	alice = await signIn('alice@example.com');
	dcrClient = await registerDcrClient();
});

describe('discovery', () => {
	it('challenges an unauthenticated call with 401 and the protected resource metadata URL', async () => {
		const access = await verifyResourceAccess(mcpRequest(), MCP_3D_SERVICE);
		expect(access.ok).toBe(false);
		if (access.ok) return;
		expect(access.response.status).toBe(401);
		const header = access.response.headers.get('www-authenticate') ?? '';
		expect(header).toMatch(/^Bearer /);
		expect(header).toContain(`resource_metadata="${ORIGIN}/.well-known/oauth-protected-resource/api/mcp/3d"`);
		expect(header).toContain('scope="mcp:3d:use"');
		expect(access.response.headers.get('content-type')).toContain('application/json'); // never an HTML redirect
	});

	it('names this origin as the resource and its authorization server', () => {
		expect(protectedResourceMetadata(MCP_3D_SERVICE)).toMatchObject({
			resource: RESOURCE,
			authorization_servers: [`${ORIGIN}/api/auth`],
			scopes_supported: ['mcp:3d:use'],
			bearer_methods_supported: ['header'],
		});
	});

	it('advertises PKCE S256, public clients, metadata documents and only the service scopes', async () => {
		const response = await authApi('/.well-known/oauth-authorization-server');
		const metadata = (await response.json()) as Record<string, unknown>;
		expect(metadata.issuer).toBe(`${ORIGIN}/api/auth`);
		expect(metadata.code_challenge_methods_supported).toEqual(['S256']);
		expect(metadata.token_endpoint_auth_methods_supported).toContain('none');
		expect(metadata.client_id_metadata_document_supported).toBe(true);
		expect(metadata.scopes_supported).toEqual(['mcp:3d:use', 'offline_access']);
		expect(metadata.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
	});
});

describe('registration', () => {
	it('refuses a plain-http, non-loopback redirect URI', async () => {
		const response = await authApi('/oauth2/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ redirect_uris: ['http://attacker.example/cb'], token_endpoint_auth_method: 'none' }),
		});
		expect(response.status).toBe(400);
	});

	it('refuses a scope outside the service scopes', async () => {
		const response = await authApi('/oauth2/register', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				redirect_uris: [DCR_REDIRECT],
				token_endpoint_auth_method: 'none',
				scope: 'openid email',
			}),
		});
		expect(response.status).toBe(400);
	});

	it('labels a dynamically registered client as self-declared even when it claims a known name', async () => {
		const view = await describeAuthorizationRequest(dcrClient, DCR_REDIRECT);
		expect(view?.identity).toEqual({ kind: 'self-declared', declaredName: 'ChatGPT', declaredHost: null });
		expect(view?.redirectsToThisDevice).toBe(true);
	});
});

describe('authorization code flow with a dynamically registered client', () => {
	it('issues a resource-bound token that the protected service accepts', async () => {
		const { tokens, redirect, consentPage } = await authorize(alice.cookie, dcrClient, DCR_REDIRECT);
		expect(consentPage).not.toBeNull(); // first time: the authorization page
		expect(redirect.searchParams.get('state')).toBe('state-1');
		expect(redirect.searchParams.get('iss')).toBe(`${ORIGIN}/api/auth`); // RFC 9207
		expect(tokens?.token_type.toLowerCase()).toBe('bearer');
		expect(tokens?.refresh_token).toBeTruthy();
		expect(tokens?.expires_in).toBeLessThanOrEqual(900);

		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(true);
		if (!access.ok) return;
		expect(access.caller).toMatchObject({ userId: alice.userId, clientId: dcrClient });
		expect(access.caller.scopes).toContain('mcp:3d:use');
	});

	it('refuses a token requested without the resource indicator', async () => {
		const { tokens } = await authorize(alice.cookie, dcrClient, DCR_REDIRECT, { resource: null });
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(false);
		if (!access.ok) expect(access.response.status).toBe(401);
	});

	it('refuses to issue a token for a resource it does not know', async () => {
		const { verifier, challenge } = pkce();
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: dcrClient,
			redirect_uri: DCR_REDIRECT,
			code_challenge: challenge,
			code_challenge_method: 'S256',
			scope: 'mcp:3d:use',
			resource: 'https://elsewhere.example/api/mcp',
			state: 's',
		});
		const start = await authApi(`/oauth2/authorize?${params}`, { headers: { cookie: alice.cookie } });
		const location = new URL(start.headers.get('location') ?? ORIGIN, ORIGIN);
		// Either rejected at the authorization endpoint, or never reaches a code at all.
		expect(location.pathname === '/auth/authorize' && !location.searchParams.has('error')).toBe(false);
		expect(verifier).toBeTruthy();
	});

	it('refuses a garbage bearer and a token for another audience', async () => {
		const garbage = await verifyResourceAccess(mcpRequest('not-a-token'), MCP_3D_SERVICE);
		expect(garbage.ok).toBe(false);
		if (!garbage.ok) expect(garbage.response.status).toBe(401);

		const { tokens } = await authorize(alice.cookie, dcrClient, DCR_REDIRECT);
		const other = {
			...MCP_3D_SERVICE,
			id: 'other',
			path: '/api/mcp/other',
			scope: 'mcp:other:use',
		} as unknown as typeof MCP_3D_SERVICE; // a second service, for the audience check
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), other);
		expect(access.ok).toBe(false);
	});

	it('a denied authorization returns an error to the client and grants nothing', async () => {
		const bob = await signIn('bob@example.com');
		const { tokens, redirect } = await authorize(bob.cookie, dcrClient, DCR_REDIRECT, { accept: false });
		expect(tokens).toBeUndefined();
		expect(redirect.searchParams.get('error')).toBe('access_denied');
		expect(await listApplicationAuthorizations(bob.userId)).toEqual([]);
	});

	it('refreshes, and the refreshed token is accepted', async () => {
		const { tokens } = await authorize(alice.cookie, dcrClient, DCR_REDIRECT);
		const refreshed = await authApi(
			'/oauth2/token',
			form({
				grant_type: 'refresh_token',
				refresh_token: tokens?.refresh_token as string,
				client_id: dcrClient,
				resource: RESOURCE,
			}),
		);
		expect(refreshed.status).toBe(200);
		const next = (await refreshed.json()) as Tokens;
		expect(next.refresh_token).toBeTruthy();
		expect(next.refresh_token).not.toBe(tokens?.refresh_token); // rotation for public clients
		expect(next.scope.split(' ')).toEqual(expect.arrayContaining(['mcp:3d:use', 'offline_access']));
		const replay = await authApi(
			'/oauth2/token',
			form({ grant_type: 'refresh_token', refresh_token: tokens?.refresh_token as string, client_id: dcrClient }),
		);
		expect(replay.status).toBeGreaterThanOrEqual(400); // a rotated-out refresh token is spent
		const access = await verifyResourceAccess(mcpRequest(next.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(true);
	});
});

describe('client ID metadata document', () => {
	it('verifies the domain, recognizes the host by it, and completes the flow without registration', async () => {
		const { tokens, consentPage } = await authorize(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT);
		expect(consentPage).not.toBeNull(); // a new client: the user is asked
		const view = await describeAuthorizationRequest(
			consentPage?.searchParams.get('client_id') as string,
			consentPage?.searchParams.get('redirect_uri') ?? null,
		);
		expect(view?.identity).toMatchObject({ kind: 'verified-domain', domain: 'claude.ai', recognizedAs: 'Claude' });
		expect(view?.redirectHost).toBe('claude.ai');
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(true);
	});
});

describe('revocation and suspension', () => {
	it('lists the authorizations without any token material', async () => {
		const list = await listApplicationAuthorizations(alice.userId);
		expect(list.length).toBeGreaterThanOrEqual(2);
		const serialized = JSON.stringify(list);
		expect(serialized).not.toMatch(/token|secret|verifier/i);
		expect(list.every((entry) => entry.scopes.includes('mcp:3d:use'))).toBe(true);
	});

	it('a revoked authorization is refused on the next request, and its refresh token is dead', async () => {
		const carol = await signIn('carol@example.com');
		const { tokens } = await authorize(carol.cookie, dcrClient, DCR_REDIRECT);
		expect((await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE)).ok).toBe(true);

		const [entry] = await listApplicationAuthorizations(carol.userId);
		expect(await revokeApplicationAuthorization('someone-else', entry.id)).toBe(false); // not theirs
		expect(await revokeApplicationAuthorization(carol.userId, entry.id)).toBe(true);

		const after = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(after.ok).toBe(false);
		if (!after.ok) {
			expect(after.response.status).toBe(401);
			expect(after.response.headers.get('www-authenticate')).toContain('invalid_token');
		}
		const refreshed = await authApi(
			'/oauth2/token',
			form({ grant_type: 'refresh_token', refresh_token: tokens?.refresh_token as string, client_id: dcrClient }),
		);
		expect(refreshed.status).toBeGreaterThanOrEqual(400);
		expect(await db.select().from(oauthConsent).where(eq(oauthConsent.userId, carol.userId))).toEqual([]);
	});

	it('a banned account is refused on the next request', async () => {
		const dave = await signIn('dave@example.com');
		const { tokens } = await authorize(dave.cookie, dcrClient, DCR_REDIRECT);
		await db.update(user).set({ banned: true }).where(eq(user.id, dave.userId));
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(false);
		if (!access.ok) expect(access.response.status).toBe(401);
	});

	it('a deleted account takes its authorizations with it', async () => {
		const erin = await signIn('erin@example.com');
		const { tokens } = await authorize(erin.cookie, dcrClient, DCR_REDIRECT);
		await db.delete(user).where(eq(user.id, erin.userId));
		expect(await db.select().from(oauthConsent).where(eq(oauthConsent.userId, erin.userId))).toEqual([]);
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(false);
	});
});

describe('scope', () => {
	it('answers 403 insufficient_scope to a token for the resource without the service scope', async () => {
		const frank = await signIn('frank@example.com');
		const { tokens } = await authorize(frank.cookie, dcrClient, DCR_REDIRECT, { scope: 'offline_access' });
		const access = await verifyResourceAccess(mcpRequest(tokens?.access_token), MCP_3D_SERVICE);
		expect(access.ok).toBe(false);
		if (access.ok) return;
		expect(access.response.status).toBe(403);
		expect(access.response.headers.get('www-authenticate')).toContain('insufficient_scope');
	});
});

describe('the MCP 3D endpoint', () => {
	type Event = Parameters<typeof mcp3dPost>[0];
	const post = (token?: string, body: unknown = { jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }) =>
		mcp3dPost({
			request: new Request(RESOURCE, {
				method: 'POST',
				headers: { ...MCP_CLIENT_HEADERS, ...(token ? { authorization: `Bearer ${token}` } : {}) },
				body: JSON.stringify(body),
			}),
			getClientAddress: () => '203.0.113.7',
		} as unknown as Event);

	it('refuses every method without a token before any work — initialize and the app-only render tool included', async () => {
		for (const body of [
			{ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} },
			{ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'render_model', arguments: {} } },
			{ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'generate_model', arguments: {} } },
			'not json at all',
		]) {
			const response = await post(undefined, body);
			expect(response.status).toBe(401);
			expect(response.headers.get('www-authenticate')).toContain('resource_metadata=');
		}
	});

	it('serves the authorized caller', async () => {
		const { tokens } = await authorize(alice.cookie, dcrClient, DCR_REDIRECT);
		const response = await post(tokens?.access_token);
		expect(response.status).toBe(200);
		const text = await response.text();
		expect(text).toContain('generate_model');
		expect(response.headers.get('cache-control') ?? '').not.toContain('public');
	});
});

describe('the authorization page, through SvelteKit (regression: Allow answered 500)', () => {
	/** Allow/Deny must reach the client's callback with exactly the server's parameters. */
	function expectCallback(answer: KitActionResult, callback: string, state: string) {
		expect(answer.type).toBe('redirect');
		expect(answer.status).toBe(303);
		const target = new URL(answer.location as string);
		expect(`${target.origin}${target.pathname}`).toBe(callback);
		expect(target.searchParams.get('state')).toBe(state);
		expect(target.searchParams.get('iss')).toBe(`${ORIGIN}/api/auth`);
		return target;
	}

	it('Allow (native form) redirects to an external HTTPS callback with code, state and iss', async () => {
		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT, 'native-allow');
		const target = expectCallback(await submitConsentPage(alice.cookie, page, 'allow'), CIMD_REDIRECT, 'native-allow');
		expect(target.searchParams.get('code')).toBeTruthy();
	});

	it('Allow (use:enhance) answers the same callback as a JSON redirect', async () => {
		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT, 'enhanced-allow');
		const answer = await submitConsentPage(alice.cookie, page, 'allow', 'enhanced');
		const target = expectCallback(answer, CIMD_REDIRECT, 'enhanced-allow');
		expect(target.searchParams.get('code')).toBeTruthy();
	});

	it('Deny returns access_denied to the callback, native and enhanced', async () => {
		for (const mode of ['native', 'enhanced'] as const) {
			const page = await consentPageFor(alice.cookie, dcrClient, DCR_REDIRECT, `deny-${mode}`);
			const target = expectCallback(
				await submitConsentPage(alice.cookie, page, 'deny', mode),
				DCR_REDIRECT,
				`deny-${mode}`,
			);
			expect(target.searchParams.get('error')).toBe('access_denied');
			expect(target.searchParams.get('code')).toBeNull();
		}
	});

	it('Allow reaches a loopback callback, including on another ephemeral port', async () => {
		const page = await consentPageFor(alice.cookie, dcrClient, DCR_REDIRECT, 'loopback');
		expectCallback(await submitConsentPage(alice.cookie, page, 'allow'), DCR_REDIRECT, 'loopback');

		const otherPort = 'http://127.0.0.1:50123/callback';
		const portPage = await consentPageFor(alice.cookie, dcrClient, otherPort, 'loopback-port');
		expectCallback(await submitConsentPage(alice.cookie, portPage, 'allow', 'enhanced'), otherPort, 'loopback-port');
	});

	it('refuses a manipulated request: a swapped callback, a forged signature, a missing decision', async () => {
		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT, 'tamper');
		const swapped = new URLSearchParams(page.search);
		swapped.set('redirect_uri', 'https://evil.example/callback');
		for (const mode of ['native', 'enhanced'] as const) {
			const answer = await submitConsentPage(alice.cookie, page, 'allow', mode, swapped.toString());
			expect(answer.type).toBe('failure');
			expect(answer.location ?? '').not.toContain('evil.example');
		}

		const forged = new URLSearchParams(page.search);
		forged.set('sig', 'AAAA');
		expect((await submitConsentPage(alice.cookie, page, 'allow', 'native', forged.toString())).type).toBe('failure');

		const event = await pageEvent(alice.cookie, new URL(`${page.pathname}${page.search}`, ORIGIN), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
			body: new URLSearchParams({ oauth_query: page.search.slice(1), decision: 'maybe' }).toString(),
		});
		expect((await kitActions.handle_action_request(event, {}, authorizationPage)).type).toBe('failure');
	});

	it('refuses an expired request', async () => {
		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT, 'expired');
		vi.useFakeTimers({ toFake: ['Date'], now: Date.now() + 60 * 60 * 1000 });
		try {
			const answer = await submitConsentPage(alice.cookie, page, 'allow');
			expect(answer.type).toBe('failure');
			expect(answer.status).toBe(400);
		} finally {
			vi.useRealTimers();
		}
	});

	it('a replayed answer only ever reaches the same callback, and its code is single-use', async () => {
		const { verifier, challenge } = pkce();
		const params = new URLSearchParams({
			response_type: 'code',
			client_id: CIMD_CLIENT_ID,
			redirect_uri: CIMD_REDIRECT,
			code_challenge: challenge,
			code_challenge_method: 'S256',
			scope: 'mcp:3d:use',
			state: 'replay',
			resource: RESOURCE,
			prompt: 'consent',
		});
		const start = await authApi(`/oauth2/authorize?${params}`, { headers: { cookie: alice.cookie } });
		const page = new URL(start.headers.get('location') as string, ORIGIN);
		const first = expectCallback(await submitConsentPage(alice.cookie, page, 'allow'), CIMD_REDIRECT, 'replay');
		const replay = await submitConsentPage(alice.cookie, page, 'allow');
		if (replay.type === 'redirect') expectCallback(replay, CIMD_REDIRECT, 'replay');
		else expect(replay.type).toBe('failure');

		const exchange = {
			grant_type: 'authorization_code',
			code: first.searchParams.get('code') as string,
			redirect_uri: CIMD_REDIRECT,
			client_id: CIMD_CLIENT_ID,
			code_verifier: verifier,
			resource: RESOURCE,
		};
		expect((await authApi('/oauth2/token', form(exchange))).status).toBe(200);
		expect((await authApi('/oauth2/token', form(exchange))).status).toBe(400);
	});

	it('a signed-out answer is refused without redirecting', async () => {
		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT, 'signed-out');
		const event = await pageEvent('', new URL(`${page.pathname}${page.search}`, ORIGIN), {
			method: 'POST',
			headers: { 'content-type': 'application/x-www-form-urlencoded', origin: ORIGIN },
			body: new URLSearchParams({ oauth_query: page.search.slice(1), decision: 'allow' }).toString(),
		});
		const answer = await kitActions.handle_action_request(event, {}, authorizationPage);
		expect(answer).toMatchObject({ type: 'failure', status: 401 });
	});

	it('the page names only its registered callback in CSP form-action (native submissions)', async () => {
		for (const [clientId, callback, source] of [
			[CIMD_CLIENT_ID, CIMD_REDIRECT, 'https://claude.ai'],
			[dcrClient, DCR_REDIRECT, 'http://127.0.0.1:33418'],
		] as const) {
			const page = await consentPageFor(alice.cookie, clientId, callback);
			const event = await pageEvent(alice.cookie, new URL(`${page.pathname}${page.search}`, ORIGIN));
			await authorizationPage.load(event as unknown as Parameters<typeof authorizationPage.load>[0]);
			expect(event.locals.authorizationFormActionSource).toBe(source);
		}

		const page = await consentPageFor(alice.cookie, CIMD_CLIENT_ID, CIMD_REDIRECT);
		const swapped = new URLSearchParams(page.search);
		swapped.set('redirect_uri', 'https://evil.example/callback');
		const event = await pageEvent(alice.cookie, new URL(`${page.pathname}?${swapped}`, ORIGIN));
		await authorizationPage.load(event as unknown as Parameters<typeof authorizationPage.load>[0]);
		expect(event.locals.authorizationFormActionSource).toBeUndefined();

		expect(
			permitFormActionSource("default-src 'self'; form-action 'self'; frame-ancestors 'none'", 'https://claude.ai'),
		).toBe("default-src 'self'; form-action 'self' https://claude.ai; frame-ancestors 'none'");
	});
});
