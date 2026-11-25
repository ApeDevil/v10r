/**
 * The Lab's cross-protocol scenario — one architecture request carried through every protocol
 * v10r speaks, run in-process against the real code, with one correlation id threaded through.
 *
 *   1. architecture request   an Architecture Studio export (the sample model)      authored input
 *   2. generative requirements a requirements form compiled from Express source      authored model output, real compiler + policy
 *   3. retrieval               `search_patterns` on the hosted pattern tools         real
 *   4. MCP capability          `trace_capability` on the same tool server            real
 *   5. A2A delegation          the delegation adapter against v10r's review agent    real sockets, pinned egress
 *                              on a loopback peer; content screen + disclosure
 *   6. results                 the peer's answer, a claim (`verified: false`)         real
 *   7. MCP App visualization   `explore_patterns` with its `ui://` View               real
 *   8. correlated evidence     every step's ids under one trace id                    derived
 *
 * What this is not: no model call (steps 1-2 are authored, labelled so), no database (the
 * persistent claim and the human approval are evidenced by `ai/proposals/a2a-delegation.pglite
 * .test.ts`; here the harness calls the adapter's `verify` + `execute` directly and says so),
 * no browser (the MCP App View is not rendered here, `bun run mcp:apps:check` covers its
 * document). Content-free: the report holds ids, counts, digests and outcomes, never what was
 * sent or answered. Byte-stable and registry-independent: random remote ids and anything that
 * moves with the pattern registry are recorded as present/absent or counts.
 *
 * A test, so it runs in the gate and resolves the hosted tool server's Vite-only imports: it
 * fails when a step fails or the committed report (the Lab's input) is stale.
 *
 *   bun run interop:scenario     rewrite scenario-report.json (V10R_WRITE_SCENARIO=1)
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { GENERATIVE_SURFACE_CATALOG_EXAMPLES as CATALOG_EXAMPLES } from '#lib/generative-ui/fixtures/catalog-examples.ts';
import { createA2aDelegationAdapter } from '#lib/server/a2a/external-adapter.ts';
import { serveA2aPeer, v10rReviewAgent } from '#lib/server/a2a/peer-fixture.ts';
import { sampleReviewModel } from '#lib/server/a2a/review-sample.ts';
import { compileGenerativeSurface } from '#lib/server/ai/generative-ui/compile-surface.ts';
import { wrapUntrusted } from '#lib/server/ai/untrusted-content.ts';
import { prepareExternalOperation } from '#lib/server/external-operations/prepare.ts';
import { PATTERN_EXPLORER_URI, patternRegistryWithExplorer } from '#lib/server/mcp/apps/pattern-explorer.ts';

const REPORT = join(import.meta.dirname, 'scenario-report.json');
const TRACE_ID = 'lab-scenario-1';
const USER = 'lab-scenario-user';

type Label = 'authored' | 'real' | 'derived';
interface Step {
	step: number;
	name: string;
	protocol: 'a2ui' | 'mcp' | 'a2a' | 'mcp-app' | 'external-operations' | 'none';
	label: Label;
	ok: boolean;
	/** The ids this step contributes to the correlation, under the scenario trace id. */
	correlation: Record<string, string | boolean | number>;
	facts: Record<string, string | number | boolean | string[]>;
}

const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16);
const steps: Step[] = [];
const registry = patternRegistryWithExplorer('https://v10r.dev');
const call = async (name: string, args: unknown) => {
	const result = await registry.dispatch(name, args);
	return { ...result, text: result.content.map((c) => c.text).join('\n') };
};

it('carries one architecture request through every protocol under one trace id', { timeout: 30_000 }, async () => {
	// 1 ── the request ────────────────────────────────────────────────────────────────────────
	const model = sampleReviewModel();
	steps.push({
		step: 1,
		name: 'architecture request',
		protocol: 'none',
		label: 'authored',
		ok: true,
		correlation: { traceId: TRACE_ID, modelDigest: digest(model) },
		facts: { nodes: model.nodes.length, connections: model.connections.length },
	});

	// 2 ── generative requirements ────────────────────────────────────────────────────────────
	const example = CATALOG_EXAMPLES.find((e) => e.id === 'step-form');
	if (!example?.express) throw new Error('the step-form catalog example has no Express source');
	const surfaceId = 'setup';
	const compiled = compileGenerativeSurface({ format: 'express', source: example.express }, { surfaceId });
	const renderId = `${TRACE_ID}:render-1`;
	steps.push({
		step: 2,
		name: 'generative requirements',
		protocol: 'a2ui',
		label: 'authored',
		ok: compiled.ok,
		correlation: { traceId: TRACE_ID, surfaceId, renderId },
		facts: compiled.ok
			? { messages: compiled.messages.length, components: compiled.graph.components.size, compiler: 'real' }
			: { refusals: compiled.refusals.map((r) => r.code) },
	});

	// 3 ── retrieval ──────────────────────────────────────────────────────────────────────────
	const search = await call('search_patterns', { query: 'approval gate for mutating AI tools' });
	const hitIds = [...search.text.matchAll(/^\d+\. \*\*.*?\*\* \(`([a-z0-9-]+)`/gm)]
		.map((m) => m[1] as string)
		.slice(0, 5);
	steps.push({
		step: 3,
		name: 'retrieval',
		protocol: 'mcp',
		label: 'real',
		ok: !search.isError && hitIds.length > 0,
		correlation: { traceId: TRACE_ID, mcpTool: 'search_patterns' },
		facts: { hits: hitIds.length },
	});

	// 4 ── MCP capability ─────────────────────────────────────────────────────────────────────
	const traced = await call('trace_capability', { capability: 'rate limiting' });
	steps.push({
		step: 4,
		name: 'MCP capability',
		protocol: 'mcp',
		label: 'real',
		ok: !traced.isError,
		correlation: { traceId: TRACE_ID, mcpTool: 'trace_capability' },
		facts: { answered: traced.text.length > 0 },
	});

	// 5-6 ── A2A delegation and its result ───────────────────────────────────────────────────
	const peer = await serveA2aPeer(v10rReviewAgent);
	try {
		const adapter = createA2aDelegationAdapter({
			peers: [
				{
					id: 'reviewer',
					label: 'v10r review agent (loopback)',
					origin: peer.origin,
					skills: ['architecture-review'],
					auth: { kind: 'none' },
					privateDestinations: peer.destinations,
				},
			],
			resolveSecret: () => undefined,
			wrapResult: wrapUntrusted,
			allowLoopbackHttp: true,
		});
		const prepared = await prepareExternalOperation(
			adapter,
			{
				protocol: 'a2a',
				peerId: 'reviewer',
				operation: 'architecture-review',
				arguments: { model },
				userId: USER,
				conversationId: TRACE_ID,
				readContent: [{ source: 'search_patterns', text: search.text }],
			},
			{ toolName: 'delegate_architecture_review', secrets: [] },
		);
		if (!prepared.ok) throw new Error(`not prepared: ${prepared.reason}`);
		const { disclosure, binding } = prepared.prepared;
		const sentBeforeApproval = peer.seen.filter((line) => line.startsWith('POST ')).length;
		// The harness stands in for the approve door here (no database, no human): verify, then
		// execute once. The persisted claim with a real approval is the PGlite test's evidence.
		const verified = await adapter.verify(binding);
		const result = verified.ok
			? await adapter.execute(prepared.prepared.request, binding, new AbortController().signal)
			: null;
		steps.push({
			step: 5,
			name: 'A2A delegation',
			protocol: 'external-operations',
			label: 'real',
			ok: verified.ok && result?.delivery === 'sent',
			correlation: {
				traceId: TRACE_ID,
				externalProtocol: 'a2a',
				peerId: disclosure.peerId,
				contractBound: binding.contractDigest.length > 0,
				argumentsDigest: binding.argumentsDigest.slice(0, 16),
				remoteTaskId: Boolean(result?.remoteTask?.taskId),
				remoteContextId: Boolean(result?.remoteTask?.contextId),
			},
			facts: {
				contentClass: disclosure.contentClass,
				fields: [...disclosure.fields],
				credential: disclosure.credential.kind,
				mutates: disclosure.mutates,
				grant: disclosure.grant,
				sentBeforeApproval,
				approval: 'harness (verify + execute called directly; see a2a-delegation.pglite.test.ts)',
				sends: peer.seen.filter((line) => line.startsWith('POST ')).length,
			},
		});
		steps.push({
			step: 6,
			name: 'results',
			protocol: 'a2a',
			label: 'real',
			ok: result?.outcome === 'succeeded',
			correlation: { traceId: TRACE_ID, remoteTaskId: Boolean(result?.remoteTask?.taskId) },
			facts: {
				outcome: result?.outcome ?? 'not_run',
				delivery: result?.delivery ?? 'not_sent',
				wrappedUntrusted: Boolean(
					result?.result?.startsWith('<untrusted-content source="delegate_architecture_review">'),
				),
				verified: Boolean(result?.result?.includes('"verified":true')),
			},
		});
	} finally {
		await peer.close();
	}

	// 7 ── MCP App visualization ──────────────────────────────────────────────────────────────
	const focus = hitIds[0] ?? 'ai-agent-actions';
	const explored = await call('explore_patterns', { id: focus });
	const view = registry.views?.find((v) => v.tool === 'explore_patterns');
	steps.push({
		step: 7,
		name: 'MCP App visualization',
		protocol: 'mcp-app',
		label: 'real',
		ok: !explored.isError && view?.uri === PATTERN_EXPLORER_URI,
		correlation: { traceId: TRACE_ID, mcpTool: 'explore_patterns', viewUri: view?.uri ?? 'none' },
		facts: {
			structured: explored.structuredContent !== undefined,
			viewServed: (view?.html.length ?? 0) > 0,
			rendered: 'not here (mcp:apps:check covers the document)',
		},
	});

	// 8 ── correlated evidence ────────────────────────────────────────────────────────────────
	steps.push({
		step: 8,
		name: 'correlated evidence',
		protocol: 'none',
		label: 'derived',
		ok: steps.every((s) => s.ok && s.correlation.traceId === TRACE_ID),
		correlation: { traceId: TRACE_ID },
		facts: { steps: steps.length, keys: [...new Set(steps.flatMap((s) => Object.keys(s.correlation)))].sort() },
	});

	const report = `${JSON.stringify({ traceId: TRACE_ID, passed: steps.filter((s) => s.ok).length, steps }, null, '\t')}\n`;
	expect(
		steps.filter((s) => !s.ok).map((s) => s.name),
		'every step passes',
	).toEqual([]);
	if (process.env.V10R_WRITE_SCENARIO === '1') writeFileSync(REPORT, report);
	else
		expect(readFileSync(REPORT, 'utf8'), 'scenario-report.json is stale: run `bun run interop:scenario`').toBe(report);
});
