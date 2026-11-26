import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readGlb } from '#lib/asset-production/index.ts';
import { decodeModelLink, decodePreviewPrimitive } from '#lib/asset-production/modeling/index.ts';
import { exampleModel } from '#lib/showcases/3d/mcp/example-models.ts';
import { MODEL_VIEWER_URI, MODEL_VIEWER_VIEW } from '../apps/model-viewer.ts';
import { patternRegistryWithExplorer } from '../apps/pattern-explorer.ts';
import { mcpPost, modernRpc } from '../mcp-post.ts';
import { publicPatternRegistry } from '../patterns/tools.ts';
import { MCP_3D_INSTRUCTIONS, MODELING_TOOL_NAMES, modelingRegistry } from './tools.ts';

/**
 * MCP 3D through the production HTTP path (`respondToMcpPost` → the official SDK), the way a
 * client reaches `/api/mcp/3d`: the catalogue it lists, the View and its app-only tool, the
 * answers to valid and invalid models — and that it is a separate service from the Pattern MCP.
 */

const ORIGIN = 'https://v10r.test';
const registry = modelingRegistry(ORIGIN);

async function rpc(method: string, params: Record<string, unknown> = {}, target = registry) {
	const { message, headers } = modernRpc(method, params);
	// The 2026-07-28 standard headers mirror the target: a resource read names its URI.
	if (method === 'resources/read') headers['mcp-name'] = String(params.uri);
	return (await mcpPost(target, message, { headers })).body;
}

const callTool = async (name: string, args: Record<string, unknown>) =>
	(await rpc('tools/call', { name, arguments: args })).result;

describe('the MCP 3D catalogue', () => {
	it('lists exactly its four tools, each schema small', async () => {
		const { result } = await rpc('tools/list');
		expect(result.tools.map((tool: { name: string }) => tool.name)).toEqual([...MODELING_TOOL_NAMES]);
		const bytes = JSON.stringify(result.tools).length;
		expect(bytes).toBeLessThan(6_000);
	});

	it('links generate_model and modify_model to the View, and render_model is app-only', async () => {
		const { result } = await rpc('tools/list');
		const meta = (name: string) => result.tools.find((tool: { name: string }) => tool.name === name)._meta;
		expect(meta('generate_model').ui).toEqual({ resourceUri: MODEL_VIEWER_URI });
		expect(meta('modify_model').ui).toEqual({ resourceUri: MODEL_VIEWER_URI });
		expect(meta('render_model').ui).toEqual({ resourceUri: MODEL_VIEWER_URI, visibility: ['app'] });
		expect(meta('describe_modeling')).toBeUndefined();
	});

	it('serves the View as an MCP App resource with an empty CSP', async () => {
		const { result } = await rpc('resources/read', { uri: MODEL_VIEWER_URI });
		const [content] = result.contents;
		expect(content.mimeType).toBe('text/html;profile=mcp-app');
		expect(content._meta.ui.csp).toEqual({
			connectDomains: [],
			resourceDomains: [],
			frameDomains: [],
			baseUriDomains: [],
		});
		expect(content.text === MODEL_VIEWER_VIEW.html).toBe(true);
	});

	it('is a separate service: no Pattern tool here, no 3D tool on the Pattern MCP', async () => {
		const patternNames = publicPatternRegistry.tools.map((tool) => tool.name);
		const explorerNames = patternRegistryWithExplorer(ORIGIN).tools.map((tool) => tool.name);
		for (const name of MODELING_TOOL_NAMES) {
			expect(patternNames).not.toContain(name);
			expect(explorerNames).not.toContain(name);
		}
		const refused = await rpc('tools/call', { name: 'search_patterns', arguments: { query: 'auth' } });
		expect(refused.error ?? refused.result?.isError).toBeTruthy();
		const onPatterns = await rpc(
			'tools/call',
			{ name: 'generate_model', arguments: { model: exampleModel('bracket').model } },
			patternRegistryWithExplorer(ORIGIN),
		);
		expect(onPatterns.error ?? onPatterns.result?.isError).toBeTruthy();
		expect(MCP_3D_INSTRUCTIONS).not.toMatch(/pattern library|search_patterns/i);
	});
});

describe('the View document', () => {
	const documentOnDisk = readFileSync(join(process.cwd(), 'src/lib/server/mcp/apps/model-viewer.view.html'), 'utf8');
	const found = (pattern: RegExp) => documentOnDisk.match(pattern) ?? [];

	it('is the committed artifact, self-contained, with no network or storage call', () => {
		expect(MODEL_VIEWER_VIEW.html === documentOnDisk).toBe(true);
		expect(found(/<script\b/g)).toHaveLength(1);
		expect(found(/<script[^>]*\bsrc=/gi)).toEqual([]);
		expect(found(/<(img|iframe|frame|object|embed|base|form)\b[^>]*\bsrc=/gi)).toEqual([]);
		for (const api of [
			/\bfetch\(/,
			/new XMLHttpRequest/,
			/new WebSocket/,
			/sendBeacon/,
			/\blocalStorage\b/,
			/\bimport\(/,
		]) {
			expect(documentOnDisk.match(api)?.[0] ?? null, String(api)).toBeNull();
		}
	});

	it('compiles no WebAssembly: the kernel stays on the server', () => {
		expect(found(/WebAssembly\.(instantiate|compile)/g)).toEqual([]);
	});
});

describe('describe_modeling', () => {
	it('lists every operation, the limits, what is unsupported, and an example that builds', async () => {
		const result = await callTool('describe_modeling', {});
		const text = result.content[0].text as string;
		for (const op of ['box', 'subtract', 'pattern.radial', 'heightfield', 'blend', 'deform'])
			expect(text).toContain(`\`${op}\``);
		expect(text).toContain('## Limits');
		expect(text).toContain('fillet');
		const example = JSON.parse(/```json\n(.+)\n```/.exec(text)?.[1] ?? 'null');
		const built = await callTool('generate_model', { model: example });
		expect(built.isError).toBeUndefined();
	});
});

describe('generate_model', () => {
	it('answers facts and a viewer link that decodes to the same model — never vertex data', async () => {
		const model = exampleModel('enclosure').model;
		const result = await callTool('generate_model', { model });
		expect(result.isError).toBeUndefined();
		const { summary, viewerUrl, findings } = result.structuredContent;
		expect(summary.components.map((c: { name: string }) => c.name)).toEqual(['body', 'lid']);
		expect(summary.closedManifold).toBe(true);
		expect(findings).toEqual([]);
		expect(viewerUrl.startsWith(`${ORIGIN}/3d/view#m1.`)).toBe(true);
		const decoded = decodeModelLink(new URL(viewerUrl).hash);
		expect(decoded.ok && decoded.value).toEqual(JSON.parse(JSON.stringify(model)));
		const wire = JSON.stringify(result);
		expect(wire.length).toBeLessThan(8_000);
		expect(wire).not.toMatch(/positions|base64/);
		expect(result.content[0].text).toContain(viewerUrl);
	});

	it('refuses code, an unknown operation or a bad reference with the path and a next step', async () => {
		for (const model of [
			{ version: 1, units: 'mm', operations: [{ id: 'a', op: 'python', code: 'import os' }], output: 'a' },
			{ version: 1, units: 'mm', operations: [{ id: 'a', op: 'box', size: ['__proto__', 1, 1] }], output: 'a' },
			{ version: 1, units: 'mm', operations: [{ id: 'a', op: 'union', of: ['b'] }], output: 'a' },
			'not a model',
		]) {
			const result = await callTool('generate_model', { model });
			expect(result.isError).toBe(true);
			expect(result.content[0].text).toContain('nothing was built');
			expect(result.content[0].text).toContain('describe_modeling');
		}
	});

	it('refuses a missing model', async () => {
		const result = await callTool('generate_model', {});
		expect(result.isError).toBe(true);
	});
});

describe('modify_model', () => {
	it('patches the supplied model and returns the new model, which builds on its own', async () => {
		const model = exampleModel('enclosure').model;
		const result = await callTool('modify_model', { model, patch: { parameters: { height: 60 } } });
		expect(result.isError).toBeUndefined();
		const next = result.structuredContent.model;
		expect(next.parameters.height).toBe(60);
		expect(result.structuredContent.summary.components[0].size).toEqual([60, 60, 60]);
		const again = await callTool('generate_model', { model: next });
		expect(again.structuredContent.summary.digest).toBe(result.structuredContent.summary.digest);
	});

	it('refuses a patch that names an unknown parameter', async () => {
		const result = await callTool('modify_model', {
			model: exampleModel('enclosure').model,
			patch: { parameters: { depth: 1 } },
		});
		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('depth');
	});
});

describe('render_model (app-only)', () => {
	it('returns a preview mesh the View can decode', async () => {
		const result = await callTool('render_model', { model: exampleModel('bracket').model, format: 'preview' });
		const preview = result.structuredContent.preview;
		const decoded = decodePreviewPrimitive(preview.primitives[0]);
		expect(decoded.indices.length / 3).toBe(result.structuredContent.summary.triangles);
	});

	it('returns the exact GLB (same sha256 as the summary) and an STL', async () => {
		const model = exampleModel('bracket').model;
		const glb = (await callTool('render_model', { model, format: 'glb' })).structuredContent;
		const bytes = Uint8Array.from(Buffer.from(glb.base64, 'base64'));
		expect(readGlb(bytes).diagnostics).toEqual([]);
		const built = await callTool('generate_model', { model });
		const digest = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
		expect(digest).toBe(built.structuredContent.summary.glbSha256);
		const stl = (await callTool('render_model', { model, format: 'stl' })).structuredContent;
		expect(stl.filename).toBe('l-bracket-with-gusset.stl');
		expect(stl.bytes).toBe(84 + 50 * built.structuredContent.summary.triangles);
	});

	it('refuses an unknown format', async () => {
		const result = await callTool('render_model', { model: exampleModel('bracket').model, format: 'step' });
		expect(result.isError).toBe(true);
	});
});
