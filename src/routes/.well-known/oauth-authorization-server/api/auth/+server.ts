/**
 * RFC 8414 Authorization Server Metadata — `/.well-known/oauth-authorization-server/api/auth`.
 *
 * The issuer is `<origin>/api/auth` (Better Auth's base path), and RFC 8414 §3.1 inserts the
 * well-known segment before an issuer's path, so the document lives at the origin root, outside
 * Better Auth's own handler. The body is Better Auth's (`oauthProviderAuthServerMetadata`); this
 * route only mounts it where clients look first.
 */
import { oauthProviderAuthServerMetadata } from '@better-auth/oauth-provider';
import { auth } from '#lib/server/auth/index.ts';
import type { RequestHandler } from './$types';

const metadata = oauthProviderAuthServerMetadata(auth, {
	headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
});

export const GET: RequestHandler = ({ request }) => metadata(request);
