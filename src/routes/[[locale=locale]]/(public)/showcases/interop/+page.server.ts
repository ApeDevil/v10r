/**
 * The Agentic Interoperability Lab's server half. Thin: every value is produced by the domain
 * code the pattern docs describe, here only called and projected for the page.
 *
 * - live:      the A2A agent card (built for this origin), the Agent Skills (rendered from the
 *              registry on this request) — and, in the browser, the A2A review the page POSTs
 *              to `/api/a2a` and the WebMCP detection;
 * - recorded:  the two interop runs' committed reports (`bun run a2a:interop`,
 *              `bun run mcp:client:interop`) and the cross-protocol scenario's report (kept
 *              current by its test) — evidence from a run, not re-run per request;
 * - authored:  hand-written fixtures run through the real projections (AG-UI events from a UI
 *              stream, GenAI spans from a turn trace) and the generative surface scenarios.
 *
 * The registry and the interop reports are static imports, inlined at build time.
 */
import { buildArchitectureReviewCard, sampleReviewModel } from '#lib/server/a2a/index.ts';
import { projectUiStreamToAgUi } from '#lib/server/ai/ag-ui/ui-stream-to-ag-ui.ts';
import { GEN_AI_SEMCONV_REVISION, projectTurnTraceToGenAiSpans } from '#lib/server/ai/trace/gen-ai-spans.ts';
import { renderAgentSkills } from '#lib/server/patterns/agent-skills.ts';
import { REGISTRY } from '#lib/server/patterns/index.ts';
import { chatbotGrounded } from '#lib/showcases/ai/fixtures/chatbot-grounded.ts';
import { UI_STREAM_SAMPLE, UI_STREAM_SAMPLE_RUN } from '#lib/showcases/ai/fixtures/ui-stream-sample.ts';
import scenarioReport from '#lib/showcases/interop/scenario-report.json';
import a2aReport from '../../../../../../scripts/a2a/interop-report.json';
import mcpClientReport from '../../../../../../scripts/mcp-client/interop-report.json';
import type { PageServerLoad } from './$types';

interface AgentSkillRow {
	name: string;
	description: string;
	lines: number;
	references: number;
}

function agentSkillRows(): AgentSkillRow[] {
	const files = renderAgentSkills(REGISTRY);
	const rows: AgentSkillRow[] = [];
	for (const [path, body] of files) {
		const match = /^([^/]+)\/SKILL\.md$/.exec(path);
		if (!match) continue;
		const name = match[1];
		const description = /^description: "?(.*?)"?$/m.exec(body)?.[1] ?? '';
		const references = [...files.keys()].filter((p) => p.startsWith(`${name}/references/`)).length;
		rows.push({ name, description, lines: body.split('\n').length, references });
	}
	return rows;
}

export const load: PageServerLoad = ({ url }) => {
	return {
		title: 'Agentic Interoperability Lab - Showcases',
		agentCard: buildArchitectureReviewCard(url.origin),
		reviewModel: sampleReviewModel(),
		agentSkills: agentSkillRows(),
		agUiEvents: projectUiStreamToAgUi(UI_STREAM_SAMPLE_RUN, UI_STREAM_SAMPLE),
		genAi: {
			revision: GEN_AI_SEMCONV_REVISION,
			question: chatbotGrounded.question,
			spans: projectTurnTraceToGenAiSpans(chatbotGrounded.trace),
		},
		a2aInterop: {
			versions: a2aReport.versions,
			summary: a2aReport.summary,
			checks: a2aReport.checks.map((c) => ({ leg: c.leg, name: c.name, ok: c.ok })),
			tck: a2aReport.tck,
		},
		scenario: {
			traceId: scenarioReport.traceId,
			passed: scenarioReport.passed,
			steps: scenarioReport.steps.map((s) => ({
				step: s.step,
				name: s.name,
				protocol: s.protocol,
				label: s.label,
				ok: s.ok,
				correlation: Object.entries(s.correlation)
					.filter(([key]) => key !== 'traceId')
					.map(([key, value]) => `${key}=${String(value)}`),
				facts: Object.entries(s.facts).map(
					([key, value]) => `${key}=${Array.isArray(value) ? value.join(', ') : String(value)}`,
				),
			})),
		},
		mcpClientInterop: {
			client: mcpClientReport.client,
			passed: mcpClientReport.passed,
			failed: mcpClientReport.failed,
			peers: mcpClientReport.peers.map((p) => ({
				peer: p.peer,
				implementation: p.implementation,
				tools: p.tools.map((t) => ({ remoteName: t.remoteName, name: t.name, risk: t.risk, hints: t.hints })),
			})),
			checks: mcpClientReport.checks.map((c) => ({ peer: c.peer, check: c.check, pass: c.pass })),
		},
	};
};
