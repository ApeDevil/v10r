<script lang="ts">
import { page } from '$app/state';
import { apiFetch } from '$lib/api';
import { Badge, Button, Input } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { PROBE_EXAMPLES } from '$lib/showcase/ai/fixtures/probes';
import { PROBE_GATE_LABELS, PROBE_LANE_LABELS, PROBE_SKIP_LABELS } from '$lib/showcase/ai/labels';
import type { AiSurfaceId } from '$lib/types/ai-tools';
import type { ProbeReport } from '$lib/types/context-probe';
import ProbeGalaxy from './ProbeGalaxy.svelte';
import ProvenanceStrip from './ProvenanceStrip.svelte';

// The context x-ray: type a question, see what each corpus had, what the ranker
// chose (production cutoff marked), and which prompt blocks are static context
// vs dynamically ingested for THIS query. Recorded examples carry the section
// signed-out; the live input POSTs to /api/ai/context-probe — the SAME assembly
// code a real turn runs, minus the model call.
let { surface, signedIn }: { surface: AiSurfaceId; signedIn: boolean } = $props();

const examples = PROBE_EXAMPLES[surface];
const initial = examples.find((e) => e.id === 'grounded') ?? examples[0];

let query = $state(initial.query);
let report = $state<ProbeReport>(initial.report);
let source = $state<'recorded' | 'live'>('recorded');
let activeExample = $state<string | null>(initial.id);
let busy = $state(false);
let errorKey = $state<'auth' | 'rate' | 'unavailable' | 'failed' | null>(null);

const loginHref = $derived(
	`${localizeHref('/auth/login')}?returnTo=${encodeURIComponent(page.url.pathname + page.url.search)}`,
);

const ERROR_TEXT = {
	auth: m.showcase_ai_probe_err_auth,
	rate: m.showcase_ai_probe_err_rate,
	unavailable: m.showcase_ai_probe_err_unavailable,
	failed: m.showcase_ai_probe_err_failed,
} as const;

function loadExample(id: string) {
	const ex = examples.find((e) => e.id === id);
	if (!ex) return;
	query = ex.query;
	report = ex.report;
	source = 'recorded';
	activeExample = ex.id;
	errorKey = null;
}

async function run(event: SubmitEvent) {
	event.preventDefault();
	const q = query.trim();
	if (!q || busy || !signedIn) return;
	busy = true;
	errorKey = null;
	try {
		const res = await apiFetch('/api/ai/context-probe', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				surface,
				query: q,
				// Site-awareness parity: the probe reports the deixis path for THIS page.
				...(surface === 'chatbot' ? { pageRouteId: page.route.id } : {}),
			}),
		});
		if (!res.ok) {
			errorKey =
				res.status === 401 ? 'auth' : res.status === 429 ? 'rate' : res.status === 503 ? 'unavailable' : 'failed';
			return;
		}
		const envelope = (await res.json()) as { data: ProbeReport };
		report = envelope.data;
		source = 'live';
		activeExample = null;
	} catch {
		errorKey = 'failed';
	} finally {
		busy = false;
	}
}

const deixisFired = $derived(report.gates.some((g) => g.id === 'page_deixis' && g.fired));
</script>

<div class="probe">
	<form class="ask" onsubmit={run}>
		<Input
			bind:value={query}
			placeholder={m.showcase_ai_probe_input_label()}
			aria-label={m.showcase_ai_probe_input_label()}
			disabled={!signedIn || busy}
			maxlength={2000}
		/>
		<Button type="submit" variant="primary" disabled={!signedIn || busy || !query.trim()}>
			{busy ? m.showcase_ai_probe_running() : m.showcase_ai_probe_run()}
		</Button>
	</form>
	{#if !signedIn}
		<p class="gate-note">
			<span class="i-lucide-lock h-3.5 w-3.5" aria-hidden="true"></span>
			{m.showcase_ai_probe_signin()}
			<a href={loginHref}>{m.showcase_ai_probe_signin_action()}</a>
		</p>
	{/if}
	<p class="cost-note">{m.showcase_ai_probe_note()}</p>

	<div class="examples" role="group" aria-label={m.showcase_ai_probe_examples()}>
		<span class="examples-label">{m.showcase_ai_probe_examples()}</span>
		{#each examples as ex (ex.id)}
			<Button
				variant={activeExample === ex.id ? 'secondary' : 'ghost'}
				size="sm"
				onclick={() => loadExample(ex.id)}
			>
				“{ex.query}”
			</Button>
		{/each}
	</div>

	{#if errorKey}
		<p class="error" role="alert">{ERROR_TEXT[errorKey]()}</p>
	{/if}

	<div class="report" aria-live="polite">
		<ProvenanceStrip {source} recordedAt="2026-08-13" />

		<ul class="gates">
			{#each report.gates as gate (gate.id)}
				<li class="gate" data-fired={gate.fired}>
					<div class="gate-head">
						<span class="gate-name">{PROBE_GATE_LABELS[gate.id].name()}</span>
						<Badge variant={gate.fired ? 'success' : 'outline'}>
							{gate.fired ? m.showcase_ai_probe_gate_on() : m.showcase_ai_probe_gate_off()}
						</Badge>
					</div>
					<p class="gate-gloss">{PROBE_GATE_LABELS[gate.id].gloss()}</p>
					{#if gate.inputs}
						<div class="gate-inputs">
							{#each Object.entries(gate.inputs) as [key, val] (key)}
								<code data-on={val}>{key} = {val}</code>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>

		{#if surface === 'chatbot' && deixisFired && report.docsQuery}
			<p class="seeded">
				{m.showcase_ai_probe_seeded()}
				<code>{report.docsQuery}</code>
			</p>
		{/if}

		<ProbeGalaxy {report} />

		<div class="panels">
			<section class="panel" aria-label={m.showcase_ai_probe_available()}>
				<h3 class="panel-title">{m.showcase_ai_probe_available()}</h3>
				<ul class="inventory">
					{#each report.inventory as inv (inv.lane)}
						<li>
							<span class="inv-lane">{PROBE_LANE_LABELS[inv.lane]()}</span>
							<span class="inv-counts">
								{inv.lane === 'llmwiki'
									? m.showcase_ai_probe_inv_pages({ n: inv.documents })
									: m.showcase_ai_probe_inv_documents({ n: inv.documents })}
								{#if inv.chunks != null}
									· {m.showcase_ai_probe_inv_chunks({ n: inv.chunks })}
								{/if}
							</span>
						</li>
					{/each}
				</ul>
				<p class="tools-line">{m.showcase_ai_probe_tools_line({ n: report.tools.length })}</p>
				<ul class="tools">
					{#each report.tools as tool (tool)}
						<li><code>{tool}</code></li>
					{/each}
				</ul>
			</section>

			<section class="panel" aria-label={m.showcase_ai_probe_chosen()}>
				<h3 class="panel-title">{m.showcase_ai_probe_chosen()}</h3>
				{#each report.lanes as lane (lane.lane)}
					<div class="lane">
						<div class="lane-head">
							<span class="lane-name">{PROBE_LANE_LABELS[lane.lane]()}</span>
							{#if lane.ran}
								<span class="lane-cutoff">{m.showcase_ai_probe_cutoff({ n: lane.cutoff })}</span>
							{/if}
						</div>
						{#if lane.error}
							<p class="lane-note">{m.showcase_ai_probe_lane_error()}</p>
						{:else if lane.skippedReason}
							<p class="lane-note">{PROBE_SKIP_LABELS[lane.skippedReason]()}</p>
						{:else if lane.candidates.length === 0}
							<p class="lane-note">{m.showcase_ai_probe_no_hits()}</p>
						{:else}
							<ol class="candidates">
								{#each lane.candidates as c, i (`${lane.lane}-${i}`)}
									{#if i > 0 && !c.chosen && lane.candidates[i - 1].chosen}
										<li class="cutoff-line" aria-hidden="true"></li>
									{/if}
									<li class="candidate" data-chosen={c.chosen}>
										<div class="cand-head">
											<span class="cand-mark {c.chosen ? 'i-lucide-check' : 'i-lucide-minus'}" aria-hidden="true"
											></span>
											<span class="cand-title">{c.title}</span>
											{#if c.score != null}
												<span class="cand-score">{c.score.toFixed(3)}</span>
											{/if}
											<code class="cand-src">{c.source}</code>
										</div>
										<p class="cand-preview">{c.preview}</p>
									</li>
								{/each}
							</ol>
						{/if}
					</div>
				{/each}
			</section>

			<section class="panel" aria-label={m.showcase_ai_probe_prompt()}>
				<h3 class="panel-title">{m.showcase_ai_probe_prompt()}</h3>
				<ol class="blocks">
					{#each report.prompt.blocks as block (block.id)}
						<li class="block" data-dynamic={block.dynamic}>
							<code class="block-id">{block.id}</code>
							<Badge variant={block.dynamic ? 'warning' : 'secondary'}>
								{block.dynamic ? m.showcase_ai_probe_dynamic() : m.showcase_ai_probe_static()}
							</Badge>
							<span class="block-tokens">≈{block.tokensEst}</span>
							<span
								class="block-bar"
								style="--w: {Math.min(100, Math.round((block.tokensEst / Math.max(1, report.prompt.totalTokensEst)) * 100))}%"
								aria-hidden="true"
							></span>
						</li>
					{/each}
				</ol>
				<p class="total">{m.showcase_ai_probe_total_tokens({ n: report.prompt.totalTokensEst })}</p>
			</section>
		</div>
	</div>
</div>

<style>
	.probe {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.ask {
		display: flex;
		gap: var(--spacing-2);
		align-items: stretch;
	}

	.ask :global(input) {
		flex: 1;
	}

	.gate-note {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.gate-note a {
		color: var(--color-primary);
		text-decoration: underline;
	}

	.cost-note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.examples {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.examples-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.error {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-error);
	}

	.report {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.gates {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.gate {
		flex: 1 1 16rem;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.gate[data-fired='true'] {
		border-color: color-mix(in srgb, var(--color-success) 45%, var(--color-border));
	}

	.gate-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.gate-name {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.gate-gloss {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.gate-inputs {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.gate-inputs code {
		font-size: var(--text-fluid-xs);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-muted);
	}

	.gate-inputs code[data-on='true'] {
		color: var(--color-fg);
		background: color-mix(in srgb, var(--color-warning) 18%, var(--color-subtle));
	}

	.seeded {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.seeded code {
		display: inline-block;
		margin-top: 0.25rem;
		padding: 0.15em 0.4em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.panels {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
		gap: var(--spacing-3);
		align-items: start;
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		min-width: 0;
	}

	.panel-title {
		margin: 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-fg);
	}

	.inventory {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.inventory li {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-xs);
	}

	.inv-lane {
		color: var(--color-fg);
	}

	.inv-counts {
		color: var(--color-muted);
		white-space: nowrap;
	}

	.tools-line {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.tools {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tools code {
		font-size: var(--text-fluid-xs);
		padding: 0.1em 0.35em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-muted);
	}

	.lane {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.lane + .lane {
		margin-top: var(--spacing-2);
		padding-top: var(--spacing-2);
		border-top: 1px dashed var(--color-border);
	}

	.lane-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.lane-name {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-fg);
	}

	.lane-cutoff {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.lane-note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-style: italic;
	}

	.candidates {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.candidate {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
	}

	.candidate[data-chosen='false'] {
		opacity: 0.55;
	}

	.cutoff-line {
		border-top: 2px dashed var(--color-warning);
		margin: var(--spacing-1) 0;
	}

	.cand-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.cand-mark {
		width: 0.85rem;
		height: 0.85rem;
		flex-shrink: 0;
		color: var(--color-muted);
	}

	.candidate[data-chosen='true'] .cand-mark {
		color: var(--color-success);
	}

	.cand-title {
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.cand-score {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
	}

	.cand-src {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.cand-preview {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.45;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.blocks {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.block {
		display: grid;
		grid-template-columns: minmax(0, auto) auto auto;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-1) 0;
	}

	.block-id {
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.block-tokens {
		font-size: var(--text-fluid-xs);
		font-variant-numeric: tabular-nums;
		color: var(--color-muted);
		justify-self: end;
	}

	.block-bar {
		grid-column: 1 / -1;
		height: 3px;
		border-radius: 9999px;
		background: var(--color-subtle);
		position: relative;
		overflow: hidden;
	}

	.block-bar::after {
		content: '';
		position: absolute;
		inset: 0;
		width: var(--w);
		border-radius: inherit;
		background: var(--color-muted);
	}

	.block[data-dynamic='true'] .block-bar::after {
		background: var(--color-warning);
	}

	.total {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-align: right;
	}
</style>
