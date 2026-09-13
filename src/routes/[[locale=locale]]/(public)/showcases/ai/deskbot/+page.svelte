<script lang="ts">
import { NavSection } from '$lib/components/composites';
import { Badge, Button, Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { deskbotPlan } from '$lib/showcases/ai/fixtures/deskbot-plan';
import { deskbotSentinel } from '$lib/showcases/ai/fixtures/deskbot-sentinel';
import { guardPassed, spineOf } from '$lib/showcases/ai/inspector';
import ApprovalLifecycle from '../_components/ApprovalLifecycle.svelte';
import AwarenessPair from '../_components/AwarenessPair.svelte';
import GuardChain from '../_components/GuardChain.svelte';
import PromptTape from '../_components/PromptTape.svelte';
import RetrievalProfile from '../_components/RetrievalProfile.svelte';
import StreamAttempts from '../_components/StreamAttempts.svelte';
import SurfaceFlow from '../_components/SurfaceFlow.svelte';
import ToolMatrix from '../_components/ToolMatrix.svelte';
import TurnInspector from '../_components/TurnInspector.svelte';
import TurnSourcePicker from '../_components/TurnSourcePicker.svelte';
import { TurnInspectorState } from '../_components/turn-inspector.state.svelte';

let { data } = $props();
const signedIn = $derived(!!data.session);

// ONE turn drives the page: one of the two recorded turns — the plan halt (approved and run,
// receipts and all) and the sentinel denial (the tool refused before anyone was asked) — or
// a desk turn of the visitor's own, read from its persisted trace. The spine, the guard
// chain, the prompt tape and the lifecycle all render the same `TurnTrace` the inspector
// opens — no second run, no replayed frames.
const inspector = new TurnInspectorState('deskbot', [deskbotPlan, deskbotSentinel]);
const turn = $derived(inspector.current);
const spine = $derived(turn ? spineOf(turn.trace) : null);
const proposal = $derived(turn?.trace.proposal ?? null);
const guard = guardPassed();

const sections = [
	{ id: 'spine', label: m.showcase_ai_sec_spine() },
	{ id: 'orchestration', label: m.showcase_ai_sec_orchestration() },
	{ id: 'guard', label: m.showcase_ai_sec_guard() },
	{ id: 'prompt', label: m.showcase_ai_sec_prompt() },
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
			<SurfaceFlow surface="deskbot" statuses={spine} halted={proposal?.status === 'pending'} />
			<div class="door">
				<Button variant="primary" href={localizeHref('/desk')}>
					<span class="i-lucide-panels-top-left h-4 w-4" aria-hidden="true"></span>
					{m.showcase_ai_door_desk()}
				</Button>
				<p class="door-note">{m.showcase_ai_door_note_quota()}</p>
			</div>
		</div>
	</section>

	<section id="orchestration" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_orchestration()}</Typography>
			<a class="compare" href="{sibling}#orchestration">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_orchestration_deskbot()}</p>
		<TurnSourcePicker {inspector} {signedIn} />
		<TurnInspector {inspector} />
	</section>

	<section id="guard" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_guard()}</Typography>
			<Badge variant="secondary">{m.showcase_ai_shared_badge()}</Badge>
			<a class="compare" href="{sibling}#guard">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_guard()}</p>
		<GuardChain {guard} />
	</section>

	<section id="prompt" class="section">
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_prompt()}</Typography>
			<a class="compare" href="{sibling}#prompt">{m.showcase_ai_compare_link({ surface: 'chatbot' })}</a>
		</div>
		<p class="section-claim">{m.showcase_ai_claim_prompt_deskbot()}</p>
		<PromptTape surface="deskbot" blocks={turn?.trace.blocks ?? []} />
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
		<ApprovalLifecycle current={proposal?.status ?? null} />
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
</style>
