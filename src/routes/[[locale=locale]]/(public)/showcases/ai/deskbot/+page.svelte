<script lang="ts">
import { LinkCard, NavSection } from '$lib/components/composites';
import PlanCard from '$lib/components/composites/chatbot/PlanCard.svelte';
import { Badge, Button, Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { deskbotPlan } from '$lib/showcases/ai/fixtures/deskbot-plan';
import { deskbotSentinel } from '$lib/showcases/ai/fixtures/deskbot-sentinel';
import ApprovalLifecycle from '../_components/ApprovalLifecycle.svelte';
import AwarenessPair from '../_components/AwarenessPair.svelte';
import ContextProbe from '../_components/ContextProbe.svelte';
import GuardChain from '../_components/GuardChain.svelte';
import PromptTape from '../_components/PromptTape.svelte';
import ProvenanceStrip from '../_components/ProvenanceStrip.svelte';
import RetrievalProfile from '../_components/RetrievalProfile.svelte';
import StreamAttempts from '../_components/StreamAttempts.svelte';
import SurfaceFlow from '../_components/SurfaceFlow.svelte';
import { TracePlayer } from '../_components/surface-flow.state.svelte';
import ToolMatrix from '../_components/ToolMatrix.svelte';
import TraceControls from '../_components/TraceControls.svelte';

let { data } = $props();
const signedIn = $derived(!!data.session);

// Two recorded turns, two claims: the plan halt (the visitor IS the human in the
// one-door rule) and the sentinel denial (the tool refused before anyone was asked).
const players = {
	plan: new TracePlayer(deskbotPlan),
	sentinel: new TracePlayer(deskbotSentinel),
} as const;
let fixtureId = $state<keyof typeof players>('plan');
const player = $derived(players[fixtureId]);
const trace = $derived(player.trace);
$effect(() => () => {
	players.plan.destroy();
	players.sentinel.destroy();
});

function pickFixture(id: keyof typeof players) {
	players[id === 'plan' ? 'sentinel' : 'plan'].pause();
	fixtureId = id;
}

const sections = [
	{ id: 'spine', label: m.showcase_ai_sec_spine() },
	{ id: 'guard', label: m.showcase_ai_sec_guard() },
	{ id: 'prompt', label: m.showcase_ai_sec_prompt() },
	{ id: 'probe', label: m.showcase_ai_sec_probe() },
	{ id: 'retrieval', label: m.showcase_ai_sec_retrieval() },
	{ id: 'tools', label: m.showcase_ai_sec_tools() },
	{ id: 'approval', label: m.showcase_ai_sec_approval() },
	{ id: 'stream', label: m.showcase_ai_sec_stream() },
	{ id: 'awareness', label: m.showcase_ai_sec_awareness() },
];

const sibling = localizeHref('/showcases/ai/chatbot');
</script>

<div class="page">
	<p class="claim">{m.showcase_ai_claim_deskbot()}</p>
	<dl class="facts">
		<div><dt>{m.showcase_ai_fact_route()}</dt><dd><code>POST /api/ai/deskbot</code></dd></div>
		<div><dt>{m.showcase_ai_fact_client()}</dt><dd><code>ChatPanel.svelte</code> · /desk</dd></div>
		<div><dt>{m.showcase_ai_fact_mode()}</dt><dd>{m.showcase_ai_fact_mode_deskbot()}</dd></div>
	</dl>

	<NavSection {sections} />

	<section id="spine" class="section">
		<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_spine()}</Typography>
		<div class="viewer">
			<div class="viewer-bar">
				<ProvenanceStrip source="recorded" recordedAt={player.replay.provenance.recordedAt} />
				<div class="source-toggle" role="group">
					<Button
						variant={fixtureId === 'plan' ? 'secondary' : 'ghost'}
						size="sm"
						onclick={() => pickFixture('plan')}>plan-then-approve</Button
					>
					<Button
						variant={fixtureId === 'sentinel' ? 'secondary' : 'ghost'}
						size="sm"
						onclick={() => pickFixture('sentinel')}>sentinel-denial</Button
					>
				</div>
			</div>
			<p class="prompt-line"><code>»</code> {player.replay.prompt}</p>
			<SurfaceFlow surface="deskbot" {trace} />
			<TraceControls {player} />

			{#if player.halted && trace.proposal}
				<!-- The one-door rule, felt: playback stopped, and the next frame is YOUR call.
				     Nothing mutates either way — the workspace is fiction. -->
				<div class="halt">
					<p class="halt-hint">
						<span class="i-lucide-hand h-4 w-4" aria-hidden="true"></span>
						{m.showcase_ai_halt_hint()}
					</p>
					<PlanCard
						proposal={trace.proposal.card}
						streamReady={true}
						busy={false}
						onapprove={() => player.decide('approved')}
						onreject={() => player.decide('rejected')}
					/>
				</div>
			{:else if trace.proposal?.decision}
				<div class="halt-done">
					<Badge variant={trace.proposal.decision === 'approved' ? 'success' : 'secondary'}>
						{trace.proposal.decision}
					</Badge>
					<Button variant="ghost" size="sm" onclick={() => player.rearm()}>
						{m.showcase_ai_halt_rearm()}
					</Button>
				</div>
			{/if}

			{#if trace.answerText}
				<div class="answer">
					<span class="answer-label">{m.showcase_ai_answer_label()}</span>
					<p>{trace.answerText}</p>
				</div>
			{/if}

			<div class="door">
				<Button variant="primary" href={localizeHref('/desk')}>
					<span class="i-lucide-panels-top-left h-4 w-4" aria-hidden="true"></span>
					{m.showcase_ai_door_desk()}
				</Button>
				<p class="door-note">{m.showcase_ai_door_note_quota()}</p>
			</div>
		</div>
	</section>

	<section id="guard" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_guard()}</Typography>
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
			<a class="compare" href="{sibling}#guard">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_guard()}</p>
		<GuardChain guard={trace.guard} />
	</section>

	<section id="prompt" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_prompt()}</Typography>
			<a class="compare" href="{sibling}#prompt">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_prompt_deskbot()}</p>
		<PromptTape surface="deskbot" prompt={trace.prompt} />
	</section>

	<section id="probe" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_probe()}</Typography>
			<a class="compare" href="{sibling}#probe">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_probe_deskbot()}</p>
		<ContextProbe surface="deskbot" {signedIn} />
	</section>

	<section id="retrieval" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_retrieval()}</Typography>
			<a class="compare" href="{sibling}#retrieval">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_retrieval_deskbot()}</p>
		<RetrievalProfile surface="deskbot" />
	</section>

	<section id="tools" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_tools()}</Typography>
			<a class="compare" href="{sibling}#tools">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_tools_deskbot()}</p>
		<ToolMatrix surface="deskbot" />
	</section>

	<section id="approval" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_approval()}</Typography>
			<a class="compare" href="{sibling}#verify">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_approval()}</p>
		<ApprovalLifecycle proposal={trace.proposal} />
	</section>

	<section id="stream" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_stream()}</Typography>
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
			<a class="compare" href="{sibling}#stream">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_stream()}</p>
		<StreamAttempts surface="deskbot" />
	</section>

	<section id="awareness" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_awareness()}</Typography>
			<a class="compare" href="{sibling}#awareness">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_awareness_deskbot()}</p>
		<AwarenessPair surface="deskbot" />
	</section>

	<footer class="sibling-card">
		<LinkCard
			href="/showcases/ai/chatbot"
			icon="i-lucide-message-circle"
			title={m.showcase_ai_tab_chatbot()}
			description={m.showcase_ai_sibling_chatbot()}
		/>
	</footer>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.claim {
		margin: 0;
		font-size: var(--text-fluid-lg);
		color: var(--color-fg);
		line-height: 1.5;
		max-width: 60ch;
	}

	.facts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-5);
		margin: 0;
	}

	.facts div {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}

	.facts dt {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.facts dd {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.facts code {
		background: var(--color-subtle);
		padding: 0.1em 0.4em;
		border-radius: var(--radius-sm);
	}

	.section {
		scroll-margin-top: 5rem;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.section-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.section :global(.section-title) {
		font-size: var(--text-fluid-xl);
		margin: 0;
	}

	.section-claim {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 70ch;
	}

	.compare {
		margin-left: auto;
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		white-space: nowrap;
	}

	.viewer {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
	}

	.viewer-bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.source-toggle {
		display: flex;
		gap: var(--spacing-1);
	}

	.prompt-line {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.halt {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.halt-hint {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-warning);
		font-weight: 600;
	}

	.halt-done {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.answer {
		padding: var(--spacing-3);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
	}

	.answer-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.answer p {
		margin: var(--spacing-1) 0 0 0;
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
		color: var(--color-fg);
	}

	.door {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
		padding-top: var(--spacing-2);
		border-top: 1px solid var(--color-border);
	}

	.door-note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.sibling-card {
		max-width: 24rem;
	}
</style>
