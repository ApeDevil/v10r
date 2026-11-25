<script lang="ts">
import * as v from 'valibot';
import type { ClientActionContract } from '#lib/client-actions/contract.ts';
import { createClientActionRunner } from '#lib/client-actions/runner.ts';
import { detectModelContext, exposeClientActionsToWebMcp, type WebMcpExposure } from '#lib/client-actions/webmcp.ts';
import {
	LazyGenerativeSurface,
	localizedGenerativeSurfaceLabels,
} from '#lib/components/composites/generative-surface/index.ts';
import { BackLink, NavSection, PageHeader, ShowcaseDocs } from '#lib/components/composites/index.ts';
import { Badge, Button, Select, Switch } from '#lib/components/primitives/index.ts';
import { Body, Cell, Header, HeaderCell, Row, Table } from '#lib/components/primitives/table/index.ts';
import {
	ADVERSARIAL_SURFACES,
	GENERATIVE_SURFACE_CATALOG_EXAMPLES,
	GENERATIVE_SURFACE_SCENARIOS,
} from '#lib/generative-ui/fixtures/index.ts';
import type { GenerativeSurfaceMessage } from '#lib/generative-ui/messages.ts';
import type { GenerativeSurfaceRefusal } from '#lib/generative-ui/policy.ts';
import type { GenerativeSurfaceAction } from '#lib/generative-ui/surface-action.ts';
import * as m from '#lib/paraglide/messages.js';

let { data } = $props();

// ── Evidence kinds ────────────────────────────────────────────────────────────
// Every section says which of five things the reader is looking at; nothing on this page
// is a mock dressed as an integration.
type Evidence = 'live' | 'recorded' | 'authored' | 'simulated' | 'unsupported';
const EVIDENCE_LABEL: Record<Evidence, () => string> = {
	live: m.showcase_interop_evidence_live,
	recorded: m.showcase_interop_evidence_recorded,
	authored: m.showcase_interop_evidence_authored,
	simulated: m.showcase_interop_evidence_simulated,
	unsupported: m.showcase_interop_evidence_unsupported,
};
const EVIDENCE_VARIANT = {
	live: 'success',
	recorded: 'default',
	authored: 'warning',
	simulated: 'secondary',
	unsupported: 'muted',
} as const;

const sections = [
	{ id: 'evidence', label: m.showcase_interop_sec_evidence() },
	{ id: 'scenario', label: m.showcase_interop_sec_scenario() },
	{ id: 'generative-ui', label: m.showcase_interop_sec_genui() },
	{ id: 'a2a', label: m.showcase_interop_sec_a2a() },
	{ id: 'mcp-client', label: m.showcase_interop_sec_mcp() },
	{ id: 'agent-skills', label: m.showcase_interop_sec_skills() },
	{ id: 'webmcp', label: m.showcase_interop_sec_webmcp() },
	{ id: 'ag-ui', label: m.showcase_interop_sec_agui() },
	{ id: 'otel', label: m.showcase_interop_sec_otel() },
];

const evidenceRows: { section: string; id: string; evidence: Evidence; what: string }[] = [
	{ section: 'Cross-protocol', id: 'scenario', evidence: 'recorded', what: m.showcase_interop_row_scenario() },
	{ section: 'A2UI', id: 'generative-ui', evidence: 'authored', what: m.showcase_interop_row_genui() },
	{ section: 'A2UI in chat', id: 'generative-ui', evidence: 'unsupported', what: m.showcase_interop_row_genui_chat() },
	{ section: 'MCP Apps', id: 'mcp-client', evidence: 'recorded', what: m.showcase_interop_row_mcp_apps() },
	{
		section: 'Skills install',
		id: 'agent-skills',
		evidence: 'recorded',
		what: m.showcase_interop_row_skills_install(),
	},
	{ section: 'A2A', id: 'a2a', evidence: 'live', what: m.showcase_interop_row_a2a() },
	{ section: 'MCP client', id: 'mcp-client', evidence: 'recorded', what: m.showcase_interop_row_mcp() },
	{ section: 'Agent Skills', id: 'agent-skills', evidence: 'live', what: m.showcase_interop_row_skills() },
	{ section: 'WebMCP', id: 'webmcp', evidence: 'unsupported', what: m.showcase_interop_row_webmcp() },
	{ section: 'AG-UI', id: 'ag-ui', evidence: 'authored', what: m.showcase_interop_row_agui() },
	{ section: 'OTel GenAI', id: 'otel', evidence: 'authored', what: m.showcase_interop_row_otel() },
];

// ── Generative UI ─────────────────────────────────────────────────────────────
const surfaceLabels = localizedGenerativeSurfaceLabels();

// The four measured scenarios, then one example per job of the catalog's newer components.
const SHOWN_SURFACES = [...GENERATIVE_SURFACE_SCENARIOS, ...GENERATIVE_SURFACE_CATALOG_EXAMPLES];
const scenarioOptions = SHOWN_SURFACES.map((s) => ({ value: s.id, label: s.title }));
let scenarioId = $state(SHOWN_SURFACES[0].id);
const scenario = $derived(SHOWN_SURFACES.find((s) => s.id === scenarioId) ?? SHOWN_SURFACES[0]);
// The follow-up batch is appended to the same list: the renderer applies only what is new.
let followUpApplied = $state(false);
const surfaceMessages = $derived<GenerativeSurfaceMessage[]>(
	followUpApplied && scenario.followUp ? [...scenario.messages, ...scenario.followUp.messages] : [...scenario.messages],
);
let actionLog = $state<GenerativeSurfaceAction[]>([]);

function selectScenario(id: string) {
	scenarioId = id;
	followUpApplied = false;
	actionLog = [];
}

function recordAction(action: GenerativeSurfaceAction) {
	actionLog = [action, ...actionLog].slice(0, 6);
}

const adversarialOptions = ADVERSARIAL_SURFACES.map((s) => ({ value: s.id, label: s.id }));
let adversarialId = $state(ADVERSARIAL_SURFACES[0].id);
const adversarial = $derived(ADVERSARIAL_SURFACES.find((s) => s.id === adversarialId) ?? ADVERSARIAL_SURFACES[0]);
let refusals = $state<readonly GenerativeSurfaceRefusal[]>([]);

function selectAdversarial(id: string) {
	adversarialId = id;
	refusals = [];
}

// ── A2A: a live review against this deployment's own endpoint ─────────────────
type ReviewRun =
	| { phase: 'idle' }
	| { phase: 'running' }
	| { phase: 'done'; state: string; summary: string; codes: string[]; ms: number }
	| { phase: 'failed'; message: string };
let review = $state<ReviewRun>({ phase: 'idle' });

async function runReview() {
	review = { phase: 'running' };
	const started = performance.now();
	try {
		const response = await fetch('/api/a2a', {
			method: 'POST',
			headers: { 'content-type': 'application/json', 'A2A-Version': '1.0' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'SendMessage',
				params: {
					message: {
						messageId: crypto.randomUUID(),
						role: 'ROLE_USER',
						parts: [{ data: data.reviewModel, mediaType: 'application/json' }],
						metadata: { skill: 'architecture-review' },
					},
				},
			}),
		});
		const body = await response.json();
		const task = body?.result?.task;
		if (!response.ok || !task) {
			review = { phase: 'failed', message: body?.error?.message ?? `HTTP ${response.status}` };
			return;
		}
		const parts = task.artifacts?.[0]?.parts ?? [];
		const findings: { code: string }[] = parts[0]?.data?.findings ?? [];
		review = {
			phase: 'done',
			state: task.status?.state ?? 'unknown',
			summary: parts[1]?.text ?? '',
			codes: findings.map((f) => f.code),
			ms: Math.round(performance.now() - started),
		};
	} catch (error) {
		review = { phase: 'failed', message: error instanceof Error ? error.message : String(error) };
	}
}

const agentCardJson = $derived(JSON.stringify(data.agentCard, null, 2));

// ── WebMCP: progressive enhancement, detected in this browser ─────────────────
const LAB_FOCUS_SECTION: ClientActionContract<{ section: string }> = {
	name: 'lab_focus_section',
	input: v.strictObject({ section: v.picklist(sections.map((s) => s.id)) }),
	timeoutMs: 1_000,
};
// Declared only to show the fail-closed rule: a write-risk action is never published.
const LAB_CLEAR_LOG: ClientActionContract<Record<string, never>> = {
	name: 'lab_clear_action_log',
	input: v.strictObject({}),
	timeoutMs: 1_000,
};

let webMcp = $state<{
	checked: boolean;
	available: boolean;
	exposure: Pick<WebMcpExposure, 'published' | 'refused'> | null;
}>({ checked: false, available: false, exposure: null });

// Nothing is offered to a browser agent until the visitor switches it on, and switching it
// off withdraws every registration. The runner and its handler live as long as the page.
let webMcpConsent = $state(false);

$effect(() => {
	const consent = webMcpConsent;
	const runner = createClientActionRunner([LAB_FOCUS_SECTION, LAB_CLEAR_LOG]);
	const takeBack = runner.register(LAB_FOCUS_SECTION, ({ section }) => {
		const target = document.getElementById(section);
		if (!target) return { status: 'unavailable', code: 'target_missing' };
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
		return { status: 'completed', observed: { focused: section } };
	});
	const exposure = exposeClientActionsToWebMcp(runner, [LAB_FOCUS_SECTION, LAB_CLEAR_LOG], {
		consent,
		descriptions: {
			lab_focus_section: 'Scroll one section of the Agentic Interoperability Lab into view.',
			lab_clear_action_log: 'Clear the generative surface action log.',
		},
		risks: { lab_focus_section: 'view', lab_clear_action_log: 'write' },
		shareObserved: ['lab_focus_section'],
	});
	webMcp = {
		checked: true,
		available: detectModelContext() !== null,
		exposure: { published: exposure.published, refused: exposure.refused },
	};
	return () => {
		exposure.dispose();
		takeBack();
	};
});

// ── AG-UI and OTel: authored fixtures through the real projections ─────────────
function eventDetail(event: Record<string, unknown>): string {
	const { type: _type, timestamp: _timestamp, threadId: _thread, runId: _run, ...rest } = event;
	const text = JSON.stringify(rest);
	return text.length > 90 ? `${text.slice(0, 89)}…` : text;
}

function spanAttributes(attributes: Record<string, unknown>): string {
	return Object.entries(attributes)
		.filter(([key]) => key.startsWith('gen_ai.'))
		.map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(',') : value}`)
		.join(' · ');
}

function depthOf(id: string, spans: { id: string; parentId: string | null }[]): number {
	let depth = 0;
	let current = spans.find((s) => s.id === id);
	while (current?.parentId) {
		depth += 1;
		current = spans.find((s) => s.id === current?.parentId);
	}
	return depth;
}
</script>

<div class="page">
	<PageHeader
		title={m.showcase_interop_title()}
		description={m.showcase_interop_description()}
		breadcrumbs={[
			{ label: m.showcase_breadcrumb_home(), href: '/' },
			{ label: m.showcase_breadcrumb_showcases(), href: '/showcases' },
			{ label: m.showcase_interop_title() },
		]}
	>
		<ShowcaseDocs />
	</PageHeader>

	<NavSection {sections} />

	<main class="content">
		<p class="lead">{m.showcase_interop_lead()}</p>

		<section id="evidence" class="section">
			<h2 class="section-title">{m.showcase_interop_sec_evidence()}</h2>
			<p class="section-description">{m.showcase_interop_claim_evidence()}</p>
			<Table>
				<Header>
					<Row>
						<HeaderCell>{m.showcase_interop_col_section()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_col_evidence()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_col_what()}</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each evidenceRows as row (row.section)}
						<Row>
							<Cell><a class="link" href="#{row.id}">{row.section}</a></Cell>
							<Cell><Badge variant={EVIDENCE_VARIANT[row.evidence]}>{EVIDENCE_LABEL[row.evidence]()}</Badge></Cell>
							<Cell>{row.what}</Cell>
						</Row>
					{/each}
				</Body>
			</Table>
		</section>

		<section id="scenario" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_scenario()}</h2>
				<Badge variant="default">{m.showcase_interop_evidence_recorded()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_scenario()}</p>
			<p class="note"><code>{data.scenario.traceId}</code> · {data.scenario.passed}/{data.scenario.steps.length}</p>
			<Table>
				<Header>
					<Row>
						<HeaderCell>{m.showcase_interop_scenario_step()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_scenario_protocol()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_scenario_source()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_scenario_keys()}</HeaderCell>
						<HeaderCell>{m.showcase_interop_scenario_facts()}</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each data.scenario.steps as step (step.step)}
						<Row>
							<Cell>
								<Badge variant={step.ok ? 'success' : 'error'}>{step.ok ? 'pass' : 'fail'}</Badge>
								{step.step}. {step.name}
							</Cell>
							<Cell><code>{step.protocol}</code></Cell>
							<Cell><code>{step.label}</code></Cell>
							<Cell><span class="muted">{step.correlation.join(' · ')}</span></Cell>
							<Cell><span class="muted">{step.facts.join(' · ')}</span></Cell>
						</Row>
					{/each}
				</Body>
			</Table>
		</section>

		<section id="generative-ui" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_genui()}</h2>
				<Badge variant="warning">{m.showcase_interop_evidence_authored()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_genui()}</p>

			<div class="controls">
				<Select
					options={scenarioOptions}
					value={scenarioId}
					onchange={selectScenario}
					aria-label={m.showcase_interop_genui_scenario()}
				/>
				{#if scenario.followUp}
					<Button variant="outline" size="sm" disabled={followUpApplied} onclick={() => (followUpApplied = true)}>
						{m.showcase_interop_genui_follow_up()}
					</Button>
				{/if}
			</div>
			<p class="note">{m.showcase_interop_genui_prompt({ prompt: scenario.prompt })}</p>

			<div class="split">
				<div class="panel">
					{#key scenarioId}
						<LazyGenerativeSurface messages={surfaceMessages} onaction={recordAction} labels={surfaceLabels} />
					{/key}
				</div>
				<div class="panel">
					<h3 class="panel-title">{m.showcase_interop_genui_actions()}</h3>
					{#if actionLog.length === 0}
						<p class="note">{m.showcase_interop_genui_actions_empty()}</p>
					{:else}
						<ul class="log">
							{#each actionLog as action, i (i)}
								<li><code>{action.name}</code> <span class="muted">{JSON.stringify(action.context)}</span></li>
							{/each}
						</ul>
					{/if}
					<p class="note">{m.showcase_interop_genui_actions_note()}</p>
					<details class="source">
						<summary>{m.showcase_interop_genui_express()}</summary>
						<pre><code>{scenario.express}</code></pre>
					</details>
				</div>
			</div>

			<h3 class="panel-title">{m.showcase_interop_genui_adversarial()}</h3>
			<div class="controls">
				<Select
					options={adversarialOptions}
					value={adversarialId}
					onchange={selectAdversarial}
					aria-label={m.showcase_interop_genui_adversarial()}
				/>
				<span class="note">{adversarial.threat}</span>
			</div>
			<div class="split">
				<div class="panel">
					{#key adversarialId}
						<LazyGenerativeSurface
							messages={adversarial.messages as GenerativeSurfaceMessage[]}
							onrefusal={(r) => (refusals = r)}
							labels={surfaceLabels}
						/>
					{/key}
				</div>
				<div class="panel">
					<h3 class="panel-title">{m.showcase_interop_genui_refusals()}</h3>
					{#if refusals.length === 0}
						<p class="note">
							{adversarial.expect === 'inert' ? m.showcase_interop_genui_inert() : m.showcase_interop_genui_refusals_empty()}
						</p>
					{:else}
						<ul class="log">
							{#each refusals as refusal, i (i)}
								<li><code>{refusal.code}</code> <span class="muted">{refusal.at}</span></li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</section>

		<section id="a2a" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_a2a()}</h2>
				<Badge variant="success">{m.showcase_interop_evidence_live()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_a2a()}</p>
			<div class="controls">
				<Button variant="primary" size="sm" disabled={review.phase === 'running'} onclick={runReview}>
					{review.phase === 'running' ? m.showcase_interop_a2a_running() : m.showcase_interop_a2a_run()}
				</Button>
				<a class="link" href="/.well-known/agent-card.json">/.well-known/agent-card.json</a>
			</div>
			{#if review.phase === 'done'}
				<div class="panel" role="status">
					<p class="result-line"><code>{review.state}</code> · {review.ms} ms</p>
					<p class="note">{review.summary}</p>
					<div class="chips">
						{#each review.codes as code, i (i)}<code class="chip">{code}</code>{/each}
					</div>
					<p class="note">{m.showcase_interop_a2a_claim_note()}</p>
				</div>
			{:else if review.phase === 'failed'}
				<p class="error" role="alert">{m.showcase_interop_a2a_failed({ message: review.message })}</p>
			{/if}
			<details class="source">
				<summary>{m.showcase_interop_a2a_card()}</summary>
				<pre><code>{agentCardJson}</code></pre>
			</details>

			<div class="section-head">
				<h3 class="panel-title">{m.showcase_interop_a2a_interop({
					passed: String(data.a2aInterop.summary.passed),
					total: String(data.a2aInterop.summary.total),
				})}</h3>
				<Badge variant="default">{m.showcase_interop_evidence_recorded()}</Badge>
			</div>
			<p class="note">
				{Object.entries(data.a2aInterop.versions).map(([k, ver]) => `${k} ${ver}`).join(' · ')}
			</p>
			<Table>
				<Header>
					<Row><HeaderCell>Leg</HeaderCell><HeaderCell>Check</HeaderCell><HeaderCell>Result</HeaderCell></Row>
				</Header>
				<Body>
					{#each data.a2aInterop.checks as check, i (i)}
						<Row>
							<Cell><code>{check.leg}</code></Cell>
							<Cell>{check.name}</Cell>
							<Cell><Badge variant={check.ok ? 'success' : 'error'}>{check.ok ? 'pass' : 'fail'}</Badge></Cell>
						</Row>
					{/each}
				</Body>
			</Table>
			{#if !data.a2aInterop.tck.run}
				<p class="note">{m.showcase_interop_a2a_tck_not_run()}</p>
			{/if}
		</section>

		<section id="mcp-client" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_mcp()}</h2>
				<Badge variant="default">{m.showcase_interop_evidence_recorded()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_mcp()}</p>
			<p class="note">
				{data.mcpClientInterop.client} · {data.mcpClientInterop.passed}/{data.mcpClientInterop.passed +
					data.mcpClientInterop.failed}
			</p>
			<Table>
				<Header>
					<Row>
						<HeaderCell>Peer</HeaderCell>
						<HeaderCell>Remote tool</HeaderCell>
						<HeaderCell>Projected as</HeaderCell>
						<HeaderCell>Peer's hints</HeaderCell>
						<HeaderCell>v10r risk</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each data.mcpClientInterop.peers as peer (peer.peer)}
						{#each peer.tools as tool (tool.name)}
							<Row>
								<Cell>{peer.peer}</Cell>
								<Cell><code>{tool.remoteName}</code></Cell>
								<Cell><code>{tool.name}</code></Cell>
								<Cell><span class="muted">{JSON.stringify(tool.hints)}</span></Cell>
								<Cell><Badge variant={tool.risk === 'read' ? 'secondary' : 'warning'}>{tool.risk}</Badge></Cell>
							</Row>
						{/each}
					{/each}
				</Body>
			</Table>
			<details class="source">
				<summary>{m.showcase_interop_mcp_checks()}</summary>
				<ul class="log">
					{#each data.mcpClientInterop.checks as check, i (i)}
						<li><Badge variant={check.pass ? 'success' : 'error'}>{check.pass ? 'pass' : 'fail'}</Badge> {check.peer} — {check.check}</li>
					{/each}
				</ul>
			</details>
		</section>

		<section id="agent-skills" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_skills()}</h2>
				<Badge variant="success">{m.showcase_interop_evidence_live()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_skills()}</p>
			<Table>
				<Header>
					<Row>
						<HeaderCell>Agent skill</HeaderCell>
						<HeaderCell>Lines</HeaderCell>
						<HeaderCell>References</HeaderCell>
						<HeaderCell>Description</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each data.agentSkills as skill (skill.name)}
						<Row>
							<Cell><code>{skill.name}</code></Cell>
							<Cell>{skill.lines}</Cell>
							<Cell>{skill.references}</Cell>
							<Cell><span class="muted clamp">{skill.description}</span></Cell>
						</Row>
					{/each}
				</Body>
			</Table>
			<p class="note"><code>npx skills add ApeDevil/v10r --skill v10r-architecture-selection</code></p>
			<p class="note">{m.showcase_interop_skills_discovery()} <a href="/.well-known/agent-skills/index.json"><code>/.well-known/agent-skills/index.json</code></a></p>
		</section>

		<section id="webmcp" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_webmcp()}</h2>
				<Badge variant="muted">{m.showcase_interop_evidence_unsupported()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_webmcp()}</p>
			<Switch bind:checked={webMcpConsent} label={m.showcase_interop_webmcp_consent()} />
			<div class="panel" role="status">
				{#if !webMcp.checked}
					<p class="note">…</p>
				{:else}
					<p class="result-line">
						{webMcp.available ? m.showcase_interop_webmcp_present() : m.showcase_interop_webmcp_absent()}
					</p>
					<ul class="log">
						{#each webMcp.exposure?.published ?? [] as name (name)}
							<li><Badge variant="success">published</Badge> <code>{name}</code></li>
						{/each}
						{#each webMcp.exposure?.refused ?? [] as refusal (refusal.name)}
							<li><Badge variant="error">refused</Badge> <code>{refusal.name}</code> <span class="muted">{refusal.reason}</span></li>
						{/each}
					</ul>
				{/if}
			</div>
		</section>

		<section id="ag-ui" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_agui()}</h2>
				<Badge variant="warning">{m.showcase_interop_evidence_authored()}</Badge>
			</div>
			<p class="section-description">{m.showcase_interop_claim_agui({ n: String(data.agUiEvents.events.length) })}</p>
			<Table>
				<Header>
					<Row><HeaderCell>#</HeaderCell><HeaderCell>AG-UI event</HeaderCell><HeaderCell>Payload</HeaderCell></Row>
				</Header>
				<Body>
					{#each data.agUiEvents.events as event, i (i)}
						<Row>
							<Cell>{i + 1}</Cell>
							<Cell><code>{event.type}</code></Cell>
							<Cell><span class="muted mono">{eventDetail(event)}</span></Cell>
						</Row>
					{/each}
				</Body>
			</Table>
			{#if Object.keys(data.agUiEvents.dropped).length > 0}
				<p class="note">
					dropped: {Object.entries(data.agUiEvents.dropped).map(([type, n]) => `${type} ×${n}`).join(', ')}
				</p>
			{/if}
		</section>

		<section id="otel" class="section">
			<div class="section-head">
				<h2 class="section-title">{m.showcase_interop_sec_otel()}</h2>
				<Badge variant="warning">{m.showcase_interop_evidence_authored()}</Badge>
			</div>
			<p class="section-description">
				{m.showcase_interop_claim_otel({ revision: data.genAi.revision, question: data.genAi.question })}
			</p>
			<Table>
				<Header>
					<Row><HeaderCell>Span</HeaderCell><HeaderCell>Kind</HeaderCell><HeaderCell>Status</HeaderCell><HeaderCell>gen_ai.*</HeaderCell></Row>
				</Header>
				<Body>
					{#each data.genAi.spans as span (span.id)}
						<Row>
							<Cell>
								<code style:padding-left="{depthOf(span.id, data.genAi.spans)}rem">{span.name}</code>
							</Cell>
							<Cell>{span.kind}</Cell>
							<Cell>{span.status}</Cell>
							<Cell><span class="muted mono">{spanAttributes(span.attributes)}</span></Cell>
						</Row>
					{/each}
				</Body>
			</Table>
		</section>
	</main>

	<BackLink href="/showcases" label={m.showcase_breadcrumb_showcases()} />
</div>

<style>
	.page {
		width: 100%;
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
		box-sizing: border-box;
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-8);
	}

	.lead {
		margin: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 75ch;
	}

	.section {
		scroll-margin-top: 5rem;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0;
	}

	.panel-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
	}

	.section-description,
	.note {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 75ch;
	}

	.note {
		font-size: var(--text-fluid-xs);
	}

	.controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.split {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: var(--spacing-4);
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--surface-1);
		min-width: 0;
	}

	.log {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-xs);
		overflow-wrap: anywhere;
	}

	.muted {
		color: var(--color-muted);
	}

	.mono,
	code {
		font-family: var(--font-mono);
		font-size: 0.85em;
		overflow-wrap: anywhere;
	}

	.clamp {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.chip {
		padding: 0.1em 0.5em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.result-line {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.error {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-error);
	}

	.link {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
	}

	.source summary {
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		color: var(--color-primary);
	}

	.source pre {
		margin: var(--spacing-2) 0 0;
		padding: var(--spacing-3);
		max-height: 22rem;
		overflow: auto;
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		font-size: var(--text-fluid-xs);
	}
</style>
