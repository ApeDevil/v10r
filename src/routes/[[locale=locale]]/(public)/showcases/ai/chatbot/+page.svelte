<script lang="ts">
import { untrack } from 'svelte';
import { NavSection } from '$lib/components/composites';
import { answerTextOf, traceOf } from '$lib/components/composites/chatbot/turn-progress';
import { Typography } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { chatbotGrounded } from '$lib/showcases/ai/fixtures/chatbot-grounded';
import { guardPassed, spineOf } from '$lib/showcases/ai/inspector';
import { toolCounts } from '$lib/showcases/ai/topology';
import { chatbotSession } from '$lib/state/chatbot-session.svelte';
import AwarenessPair from '../_components/AwarenessPair.svelte';
import ChatbotExample from '../_components/ChatbotExample.svelte';
import GuardChain from '../_components/GuardChain.svelte';
import PromptTape from '../_components/PromptTape.svelte';
import ProvenanceBadge from '../_components/ProvenanceBadge.svelte';
import ReferenceSection from '../_components/ReferenceSection.svelte';
import RetrievalProfile from '../_components/RetrievalProfile.svelte';
import StreamAttempts from '../_components/StreamAttempts.svelte';
import SurfaceFlow from '../_components/SurfaceFlow.svelte';
import ToolMatrix from '../_components/ToolMatrix.svelte';
import TurnInspector from '../_components/TurnInspector.svelte';
import TurnSourcePicker from '../_components/TurnSourcePicker.svelte';
import { TurnInspectorState } from '../_components/turn-inspector.state.svelte';
import VerifyChain from '../_components/VerifyChain.svelte';

let { data } = $props();
const signedIn = $derived(!!data.session);

// The reading order: ask → read the answer → explore the turn graph → open its content →
// read the implementation. ONE turn drives the graph and every reference section below it:
// the committed fixture, or — signed in — the turn the visitor just asked above, followed
// from its streamed snapshot to its persisted trace. No second run, no mirrored outline.
const inspector = new TurnInspectorState('chatbot', [chatbotGrounded]);
const turn = $derived(inspector.current);
const spine = $derived(turn ? spineOf(turn.trace) : null);
const guard = guardPassed();

// The thread's last message, reported on every change (a streamed frame replaces the
// message's metadata, so this re-runs per frame); the state decides what to do with it.
$effect(() => {
	const messages = chatbotSession.chat?.messages ?? [];
	const last = messages.at(-1);
	const before = messages.at(-2);
	const trace = traceOf(last);
	const conversationId = chatbotSession.conversationId;
	untrack(() =>
		inspector.observeThread({
			conversationId,
			messageId: last?.id,
			role: last?.role,
			trace,
			question: before?.role === 'user' ? answerTextOf(before) : '',
			answer: answerTextOf(last),
		}),
	);
});

const sections = [
	{ id: 'example', label: m.showcase_ai_sec_example() },
	{ id: 'orchestration', label: m.showcase_ai_sec_graph() },
	{ id: 'implementation', label: m.showcase_ai_sec_implementation() },
];

const counts = toolCounts();
const sibling = localizeHref('/showcases/ai/deskbot');
</script>

<div class="page">
	<NavSection {sections} />

	<section id="example" class="section">
		<!-- One row: the heading, what the reader is looking at, and the one sentence that says why. -->
		<div class="section-head">
			<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_example()}</Typography>
			<ProvenanceBadge
				source={signedIn ? 'live' : chatbotGrounded.provenance.kind}
				gloss={signedIn ? m.showcase_ai_example_live_label() : m.showcase_ai_example_authored_label()}
			/>
		</div>
		<ChatbotExample {signedIn} fixture={chatbotGrounded} />
	</section>

	<section id="orchestration" class="section">
		<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_graph()}</Typography>
		<p class="section-claim">{m.showcase_ai_claim_orchestration_chatbot()}</p>
		<TurnSourcePicker {inspector} {signedIn} />
		<TurnInspector {inspector} />
	</section>

	<section id="implementation" class="section">
		<Typography variant="h2" as="h2" class="section-title">{m.showcase_ai_sec_implementation()}</Typography>
		<p class="section-claim">{m.showcase_ai_claim_chatbot({ n: String(counts.chatbot) })}</p>

		<ReferenceSection id="spine" title={m.showcase_ai_sec_spine()}>
			<dl class="facts">
				<div><dt>{m.showcase_ai_fact_route()}</dt><dd><code>POST /api/ai/chatbot</code></dd></div>
				<div><dt>{m.showcase_ai_fact_client()}</dt><dd><code>Chatbot.svelte</code> · Vely</dd></div>
				<div><dt>{m.showcase_ai_fact_mode()}</dt><dd>{m.showcase_ai_fact_mode_chatbot()}</dd></div>
			</dl>
			<SurfaceFlow surface="chatbot" statuses={spine} />
			<p class="note">{m.showcase_ai_door_note_quota()}</p>
		</ReferenceSection>

		<ReferenceSection id="guard" title={m.showcase_ai_sec_guard()} claim={m.showcase_ai_claim_guard()} shared compare="{sibling}#guard">
			<GuardChain {guard} />
		</ReferenceSection>

		<ReferenceSection id="prompt" title={m.showcase_ai_sec_prompt()} claim={m.showcase_ai_claim_prompt_chatbot()} compare="{sibling}#prompt">
			<PromptTape surface="chatbot" blocks={turn?.trace.blocks ?? []} />
		</ReferenceSection>

		<ReferenceSection id="retrieval" title={m.showcase_ai_sec_retrieval()} claim={m.showcase_ai_claim_retrieval_chatbot()} compare="{sibling}#retrieval">
			<RetrievalProfile surface="chatbot" />
		</ReferenceSection>

		<ReferenceSection
			id="tools"
			title={m.showcase_ai_sec_tools()}
			claim={m.showcase_ai_claim_tools_chatbot({ n: String(counts.chatbot), offered: String(counts.chatbot + 1) })}
			compare="{sibling}#tools"
		>
			<ToolMatrix surface="chatbot" />
		</ReferenceSection>

		<ReferenceSection id="verify" title={m.showcase_ai_sec_verify()} claim={m.showcase_ai_claim_verify()} compare="{sibling}#approval">
			<VerifyChain />
		</ReferenceSection>

		<ReferenceSection id="stream" title={m.showcase_ai_sec_stream()} claim={m.showcase_ai_claim_stream()} shared compare="{sibling}#stream">
			<StreamAttempts surface="chatbot" />
		</ReferenceSection>

		<ReferenceSection id="awareness" title={m.showcase_ai_sec_awareness()} claim={m.showcase_ai_claim_awareness_chatbot()} compare="{sibling}#awareness">
			<AwarenessPair surface="chatbot" />
		</ReferenceSection>
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
		/* The example is the point of the page: the section nav sits close above it. */
		--section-nav-gap: var(--spacing-4);
	}

	.section-head {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3) var(--spacing-4);
		flex-wrap: wrap;
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

	.section :global(.section-title) {
		font-size: var(--text-fluid-xl);
		margin: 0;
	}

	.section-claim,
	.note {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
		max-width: 70ch;
	}

	.note {
		font-size: var(--text-fluid-xs);
	}
</style>
