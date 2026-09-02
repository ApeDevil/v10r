<script lang="ts">
import { LinkCard, NavSection } from '$lib/components/composites';
import { Badge, Button, Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { chatbotGrounded } from '$lib/showcases/ai/fixtures/chatbot-grounded';
import { liveTurnTrace } from '$lib/showcases/ai/replay';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
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
import VerifyChain from '../_components/VerifyChain.svelte';

let { data } = $props();
const signedIn = $derived(!!data.session);

const player = new TracePlayer(chatbotGrounded);
$effect(() => () => player.destroy());

// Live source: observe the Vely singleton — the page never mounts a second chat
// instance. When the visitor runs a real turn in Vely, its pipeline metadata can
// drive the SAME viewer as the fixture (one viewer, two sources).
type PipelineMeta = { pipeline?: { type: string }[] };
const livePipeline = $derived((chatbotSession.chat?.messages.at(-1)?.metadata as PipelineMeta | undefined)?.pipeline);
let source = $state<'recorded' | 'live'>('recorded');
const trace = $derived(source === 'live' && livePipeline ? liveTurnTrace(livePipeline) : player.trace);

const sections = [
	{ id: 'spine', label: m.showcase_ai_sec_spine() },
	{ id: 'guard', label: m.showcase_ai_sec_guard() },
	{ id: 'prompt', label: m.showcase_ai_sec_prompt() },
	{ id: 'probe', label: m.showcase_ai_sec_probe() },
	{ id: 'retrieval', label: m.showcase_ai_sec_retrieval() },
	{ id: 'tools', label: m.showcase_ai_sec_tools() },
	{ id: 'verify', label: m.showcase_ai_sec_verify() },
	{ id: 'stream', label: m.showcase_ai_sec_stream() },
	{ id: 'awareness', label: m.showcase_ai_sec_awareness() },
];

const sibling = localizeHref('/showcases/ai/deskbot');
</script>

<div class="page">
	<p class="claim">{m.showcase_ai_claim_chatbot()}</p>
	<dl class="facts">
		<div><dt>{m.showcase_ai_fact_route()}</dt><dd><code>POST /api/ai/chatbot</code></dd></div>
		<div><dt>{m.showcase_ai_fact_client()}</dt><dd><code>Chatbot.svelte</code> · Vely</dd></div>
		<div><dt>{m.showcase_ai_fact_mode()}</dt><dd>{m.showcase_ai_fact_mode_chatbot()}</dd></div>
	</dl>

	<NavSection {sections} />

	<section id="spine" class="section">
		<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_spine()}</Typography>
		<div class="viewer">
			<div class="viewer-bar">
				<ProvenanceStrip source={trace.source} recordedAt={chatbotGrounded.provenance.recordedAt} />
				{#if livePipeline}
					<div class="source-toggle" role="group">
						<Button
							variant={source === 'recorded' ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (source = 'recorded')}>{m.showcase_ai_src_recorded()}</Button
						>
						<Button
							variant={source === 'live' ? 'secondary' : 'ghost'}
							size="sm"
							onclick={() => (source = 'live')}>{m.showcase_ai_src_live()}</Button
						>
					</div>
				{/if}
			</div>
			<SurfaceFlow surface="chatbot" {trace} />
			{#if source === 'recorded'}
				<TraceControls {player} />
				{#if trace.answerText}
					<div class="answer">
						<span class="answer-label">{m.showcase_ai_answer_label()}</span>
						<p>{trace.answerText}</p>
					</div>
				{/if}
			{/if}
			<div class="door">
				<Button variant="primary" onclick={() => chatbotSession.open()}>
					<span class="i-lucide-message-circle h-4 w-4" aria-hidden="true"></span>
					{m.showcase_ai_door_vely()}
				</Button>
				<p class="door-note">{m.showcase_ai_door_note_quota()}</p>
			</div>
		</div>
	</section>

	<section id="guard" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_guard()}</Typography>
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
			<a class="compare" href="{sibling}#guard">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_guard()}</p>
		<GuardChain guard={trace.guard} />
	</section>

	<section id="prompt" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_prompt()}</Typography>
			<a class="compare" href="{sibling}#prompt">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_prompt_chatbot()}</p>
		<PromptTape surface="chatbot" prompt={trace.prompt} />
	</section>

	<section id="probe" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_probe()}</Typography>
			<a class="compare" href="{sibling}#probe">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_probe_chatbot()}</p>
		<ContextProbe surface="chatbot" {signedIn} />
	</section>

	<section id="retrieval" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_retrieval()}</Typography>
			<a class="compare" href="{sibling}#retrieval">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_retrieval_chatbot()}</p>
		<RetrievalProfile surface="chatbot" />
	</section>

	<section id="tools" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_tools()}</Typography>
			<a class="compare" href="{sibling}#tools">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_tools_chatbot()}</p>
		<ToolMatrix surface="chatbot" />
	</section>

	<section id="verify" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_verify()}</Typography>
			<a class="compare" href="{sibling}#approval">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_verify()}</p>
		<VerifyChain />
	</section>

	<section id="stream" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_stream()}</Typography>
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
			<a class="compare" href="{sibling}#stream">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_stream()}</p>
		<StreamAttempts surface="chatbot" />
	</section>

	<section id="awareness" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_awareness()}</Typography>
			<a class="compare" href="{sibling}#awareness">{m.showcase_ai_compare_link({ surface: 'deskbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_awareness_chatbot()}</p>
		<AwarenessPair surface="chatbot" />
	</section>

	<footer class="sibling-card">
		<LinkCard
			href="/showcases/ai/deskbot"
			icon="i-lucide-panels-top-left"
			title={m.showcase_ai_tab_deskbot()}
			description={m.showcase_ai_sibling_deskbot()}
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
