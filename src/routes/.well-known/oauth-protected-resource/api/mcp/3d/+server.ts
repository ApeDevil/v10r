/**
 * RFC 9728 Protected Resource Metadata for MCP 3D — `/.well-known/oauth-protected-resource/api/mcp/3d`
 * (the well-known segment inserted before the resource path). Public: it names where to
 * authorize, and admits nothing by itself.
 */

import { MCP_3D_SERVICE } from '#lib/server/auth/protected-mcp-services.ts';
import { protectedResourceMetadata } from '#lib/server/auth/resource-access.ts';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () =>
	Response.json(protectedResourceMetadata(MCP_3D_SERVICE), {
		headers: { 'Cache-Control': 'public, max-age=300', 'Access-Control-Allow-Origin': '*' },
	});
