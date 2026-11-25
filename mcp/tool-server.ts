/**
 * The one bridge between a v10r tool registry and the official MCP SDK, shared by both transports.
 *
 * The SDK (`@modelcontextprotocol/server`) owns the protocol: JSON-RPC framing and validation, the
 * 2025-era `initialize` handshake and version negotiation, the 2026-07-28 per-request envelope,
 * `server/discover`, the standard-header checks, error codes and result dressing. This module owns
 * only what is v10r's: which tools a surface exposes, how a call reaches the registry's dispatcher,
 * and the error hygiene around it.
 *
 * Two deliberate choices, each pinned by a test:
 *
 *  - **The registry validates its own arguments.** Each tool is registered with its JSON Schema
 *    (advertised verbatim by `tools/list`) but with a pass-through validator, so the domain layer
 *    stays the single authority on argument errors. Its answers carry a named next call and a
 *    telemetry `diag`; a second, generic validation pass in front of it would replace both with a
 *    message no agent can recover from, and two validators can disagree.
 *  - **A throwing tool never reaches the wire.** The SDK's own fallback turns a throw into an
 *    `isError` result carrying the raw exception message — SQL text or internal paths on the admin
 *    surface. The wrapper answers a bounded, generic error instead and hands the cause to the caller's
 *    `onToolError` for server-side logging.
 *
 * Tool definitions stay name/description/inputSchema only: the SDK omits `title`, `annotations`
 * and `outputSchema` when they are unset, which keeps the Claude Code tool-list bug out of reach.
 *
 * A registry may also carry **MCP Apps Views** (SEP-1865, `io.modelcontextprotocol/ui`): an HTML
 * resource under `ui://` that a supporting host renders in a sandboxed iframe for one tool's
 * results. They are registered through the official helpers (`@modelcontextprotocol/ext-apps/server`),
 * which add the tool's `_meta.ui.resourceUri` link and the `text/html;profile=mcp-app` MIME type.
 * The tool itself stays an ordinary registry tool — same dispatcher, same error hygiene — so a
 * host without MCP Apps support gets its text answer. See docs/blueprint/ai/mcp-apps.md.
 */
import {
	type McpUiAppResourceConfig,
	RESOURCE_MIME_TYPE,
	registerAppResource,
	registerAppTool,
} from '@modelcontextprotocol/ext-apps/server';
import {
	type CacheScope,
	type CallToolResult,
	fromJsonSchema,
	type JsonSchemaValidator,
	type jsonSchemaValidator,
	McpServer,
	type StandardSchemaWithJSON,
} from '@modelcontextprotocol/server';
import type { ToolDef } from '../pattern-library/query.ts';

/** A View resource's `_meta.ui`: CSP domains, permissions, border preference (SEP-1865). */
type McpUiResourceMeta = NonNullable<NonNullable<McpUiAppResourceConfig['_meta']>['ui']>;

/** How long a client may treat `server/discover` and `tools/list` as fresh: they change only with a deploy. */
export const LIST_RESULT_TTL_MS = 3_600_000;

/**
 * The wire shape every v10r tool answers — text blocks, and `structuredContent` only on a tool a
 * View renders (see README: Claude Code shows the model only the structured payload when both are
 * present, so a View tool's JSON must carry the whole answer on its own).
 */
export interface ToolCallResult {
	content: Array<{ type: 'text'; text: string }>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
	/** Internal telemetry; removed before the result reaches the SDK. */
	diag?: string;
}

/**
 * An MCP Apps View: one self-contained HTML document a supporting host renders for `tool`'s
 * results. `ui` is the resource's `_meta.ui` — its CSP, permissions and border preference — and
 * is declared both on the `resources/list` entry and on the `resources/read` content.
 */
export interface AppView {
	/** `ui://` URI; the tool's `_meta.ui.resourceUri`. */
	uri: string;
	name: string;
	description: string;
	/** The registry tool whose results this View renders. */
	tool: string;
	html: string;
	ui: McpUiResourceMeta;
}

/** A trust-scoped set of tools and the dispatcher that runs them. The SDK serves only these names. */
export interface ToolRegistry<Result extends ToolCallResult = ToolCallResult> {
	readonly tools: readonly ToolDef[];
	/** MCP Apps Views over some of `tools`; absent on a surface that ships none. */
	readonly views?: readonly AppView[];
	dispatch(name: string, args: unknown): Promise<Result> | Result;
}

/** What a server says about itself, in either era. */
export interface McpServerIdentity {
	name: string;
	version: string;
	instructions: string;
	/** `public` when no answer depends on who asks; `private` behind a credential. */
	cacheScope: CacheScope;
	/** Build identity merged into every `tools/call` result's `_meta`. */
	meta?: Record<string, unknown>;
}

/** One finished tool call as the registry answered it — `result` is null when the tool threw. */
export interface ToolCallRecord<Result extends ToolCallResult = ToolCallResult> {
	name: string;
	args: unknown;
	result: Result | null;
}

export interface ToolServerHooks<Result extends ToolCallResult = ToolCallResult> {
	/** Called once per dispatched call, before the answer is serialized. Telemetry reads `diag` here. */
	onToolCall?: (record: ToolCallRecord<Result>) => void;
	/** Called with the cause when a tool throws; the caller receives only a generic error. */
	onToolError?: (name: string, cause: unknown) => void;
}

/**
 * Accepts any arguments. Registered tools get their JSON Schema advertised, while the registry —
 * not a generic validator — decides what is malformed and how to recover (see the module doc).
 */
const registryValidatesArguments: jsonSchemaValidator = {
	getValidator:
		<T>(): JsonSchemaValidator<T> =>
		(input) => ({ valid: true, data: input as T, errorMessage: undefined }),
};

function advertisedSchema(tool: ToolDef): StandardSchemaWithJSON {
	return fromJsonSchema(tool.inputSchema as Parameters<typeof fromJsonSchema>[0], registryValidatesArguments);
}

function toWire(result: ToolCallResult, meta: Record<string, unknown> | undefined): CallToolResult {
	const { diag: _diag, ...wire } = result;
	return meta ? { ...wire, _meta: { ...meta } } : wire;
}

/**
 * A fresh SDK server exposing exactly `registry.tools`. Both serving entries call this from their
 * factory — `createMcpHandler` once per HTTP request, `serveStdio` once per connection — so the two
 * eras and the two transports are served from one definition.
 */
export function createToolServer<Result extends ToolCallResult>(
	registry: ToolRegistry<Result>,
	description: McpServerIdentity,
	hooks: ToolServerHooks<Result> = {},
): McpServer {
	const cacheHint = { ttlMs: LIST_RESULT_TTL_MS, cacheScope: description.cacheScope };
	const server = new McpServer(
		{ name: description.name, version: description.version },
		{
			instructions: description.instructions,
			// Declared up front: the SDK would otherwise advertise `listChanged: true` on the first
			// registered resource, and this server never changes its lists within a deploy.
			capabilities: {
				tools: { listChanged: false },
				...(registry.views?.length ? { resources: { listChanged: false } } : {}),
			},
			cacheHints: { 'tools/list': cacheHint, 'server/discover': cacheHint },
		},
	);
	for (const tool of registry.tools) {
		const callback = async (args: unknown): Promise<CallToolResult> => {
			let result: Result;
			try {
				result = await registry.dispatch(tool.name, args);
			} catch (cause) {
				hooks.onToolError?.(tool.name, cause);
				hooks.onToolCall?.({ name: tool.name, args, result: null });
				return {
					content: [
						{ type: 'text', text: `The "${tool.name}" tool failed to complete. The error was logged server-side.` },
					],
					isError: true,
				};
			}
			hooks.onToolCall?.({ name: tool.name, args, result });
			return toWire(result, description.meta);
		};
		const config = { description: tool.description, inputSchema: advertisedSchema(tool) };
		const view = registry.views?.find((candidate) => candidate.tool === tool.name);
		if (view) registerAppTool(server, tool.name, { ...config, _meta: { ui: { resourceUri: view.uri } } }, callback);
		else server.registerTool(tool.name, config, callback);
	}
	for (const view of registry.views ?? []) {
		registerAppResource(
			server,
			view.name,
			view.uri,
			{ description: view.description, _meta: { ui: view.ui } },
			async () => ({
				contents: [{ uri: view.uri, mimeType: RESOURCE_MIME_TYPE, text: view.html, _meta: { ui: view.ui } }],
			}),
		);
	}
	return server;
}
