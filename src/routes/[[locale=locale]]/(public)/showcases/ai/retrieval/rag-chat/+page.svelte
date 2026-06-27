<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import { onMount } from 'svelte';
import { page } from '$app/state';
import { CSRF_HEADER } from '$lib/api';
import type { CatalogSource } from '$lib/components/chat/citation-types';
import { Alert, Card, EmptyState } from '$lib/components/composites';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import { Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import ChatLayout from './_components/ChatLayout.svelte';
import EngineToggle from './_components/EngineToggle.svelte';
import NragObservability from './_components/observability/NragObservability.svelte';
import { createNragTrace } from './_components/trace/nrag-trace.svelte';
import { DEMO_QUERIES } from './demo-queries';

let { data } = $props();

// Capability flags — modes are now a post-hoc focus filter over one fused run, not page-states.
let tiers = $state([1, 2, 3]);
let fusion = $state<'none' | 'rrf'>('rrf');
let useLlmwiki = $state(false);
const useRetrieval = $derived(!useLlmwiki);
const engine = $derived<'rawrag' | 'llmwiki'>(useLlmwiki ? 'llmwiki' : 'rawrag');

const rawrag = createNragTrace('rawrag');
const llmwiki = createNragTrace('llmwiki');

// Write-routing key for the in-flight / most-recent turn. PLAIN `let` (NOT $state) so the feed
// effect never tracks it — flipping the engine toggle after a turn must not re-feed a stale
// message into the wrong trace. The toggle is `disabled={isLoading}`, so this is stable for a
// turn's whole lifetime. `engine` (derived) drives DISPLAY; `turnEngine` drives WRITES.
let turnEngine: 'rawrag' | 'llmwiki' = 'rawrag';

let inputValue = $state('');
const demoChips = $derived(useLlmwiki ? DEMO_QUERIES.llmwiki : DEMO_QUERIES.hybrid);

const chat = new Chat({
	transport: new DefaultChatTransport({
		api: '/api/ai/showcase/rag',
		headers: CSRF_HEADER,
		body: {
			get useRetrieval() {
				return useRetrieval;
			},
			get retrievalTiers() {
				return tiers;
			},
			get fusion() {
				return fusion;
			},
			get useLlmwiki() {
				return useLlmwiki;
			},
			get llmwikiCollectionId() {
				return null;
			},
		},
	}) as Chat['transport'],
});

// Counterfactual — same transport, RAG off + dryRun (skips persistence, still charges budget).
const counterfactualChat = new Chat({
	transport: new DefaultChatTransport({
		api: '/api/ai/showcase/rag',
		headers: CSRF_HEADER,
		body: { useRetrieval: false, useLlmwiki: false, dryRun: true },
	}) as Chat['transport'],
});

const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

const lastUserMessage = $derived.by(() => {
	for (let i = chat.messages.length - 1; i >= 0; i--) {
		const m = chat.messages[i];
		if (m.role === 'user') {
			const text = m.parts
				.filter((p): p is { type: 'text'; text: string } => p.type === 'text')
				.map((p) => p.text)
				.join('\n');
			if (text) return text;
		}
	}
	return '';
});

function setEngine(next: 'hybrid' | 'llmwiki') {
	const nextLlmwiki = next === 'llmwiki';
	if (nextLlmwiki === useLlmwiki) return;
	useLlmwiki = nextLlmwiki;
	// No trace resets: writes are turn-anchored + engine-isolated (see `turnEngine`), so flipping
	// is a non-destructive DISPLAY switch — each trace keeps its own last turn until it re-runs.
}

function runCounterfactual() {
	if (!lastUserMessage) return;
	counterfactualChat.sendMessage({ text: lastUserMessage });
}

onMount(() => {
	const seedLabel = page.url.searchParams.get('seed');
	if (seedLabel) {
		inputValue = `Tell me about ${seedLabel}`;
	}
});

function useDemoChip(query: string) {
	inputValue = query;
}

let scrollContainer: HTMLDivElement | undefined = $state();

// Auto-scroll on new messages
$effect(() => {
	if (chat.messages.length && scrollContainer) {
		requestAnimationFrame(() => {
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		});
	}
});

// Feed the OWNING engine's trace from the last assistant message (REPLACE semantics: the full
// event array arrives each frame). Routes by `turnEngine` (the engine that actually ran this
// turn), never the toggle — so flipping engines can't re-feed a stale message into the wrong
// trace. Idempotent + turn-anchored by message id inside applyAnnotations.
$effect(() => {
	const msgs = chat.messages;
	const lastMsg = msgs[msgs.length - 1];
	if (lastMsg?.role !== 'assistant') return;
	const pipeline = (lastMsg.metadata as { pipeline?: unknown[] } | undefined)?.pipeline;
	if (!Array.isArray(pipeline)) return;
	(turnEngine === 'llmwiki' ? llmwiki : rawrag).applyAnnotations(lastMsg.id, pipeline);
});

// Client watchdog: flip a lingering `active` step to error when the stream settles. Routes by
// `turnEngine` — the trace that actually ran this turn, not the (possibly flipped) toggle.
$effect(() => {
	const status = chat.status;
	if (status === 'ready' || status === 'error') {
		(turnEngine === 'llmwiki' ? llmwiki : rawrag).finalizeActive();
	}
});

function submitMessage() {
	if (!inputValue.trim() || isLoading) return;
	// Capture the engine for this turn BEFORE sending (toggle is locked while loading), so the
	// feed/watchdog effects route this turn's frames to the right trace regardless of later flips.
	turnEngine = engine;
	const active = engine === 'llmwiki' ? llmwiki : rawrag;
	active.reset(); // instant "pending" feedback during the send → first-frame gap
	const text = inputValue;
	inputValue = '';
	chat.sendMessage({ text });
}
</script>
{#snippet chatBody()}
	<div class="chat-container">
		<div bind:this={scrollContainer} class="chat-messages">
			{#if chat.messages.length === 0}
				<EmptyState
					icon="i-lucide-brain-circuit h-10 w-10"
					title="Ask a question"
					description="Pick a sample query below or type your own."
					class="chat-empty"
				>
					<div class="demo-chips">
						{#each demoChips as chip (chip.query)}
							<button type="button" class="demo-chip" onclick={() => useDemoChip(chip.query)}>
								<span class="chip-query">{chip.query}</span>
								<span class="chip-why">{chip.why}</span>
							</button>
						{/each}
					</div>
				</EmptyState>
			{:else}
				{#each chat.messages as message (message.id)}
					<ChatMessage
						role={message.role as 'user' | 'assistant'}
						parts={message.parts}
						catalogSources={(message as { metadata?: { catalogSources?: CatalogSource[] } }).metadata
							?.catalogSources}
					/>
				{/each}

				{#if isLoading && chat.messages[chat.messages.length - 1]?.role === 'user'}
					<div class="chat-typing flex items-center gap-3 px-4 py-3">
						<div
							class="chat-typing-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
						>
							<span class="i-lucide-bot h-4 w-4"></span>
						</div>
						<div class="chat-typing-dots flex gap-1">
							<span class="chat-dot"></span>
							<span class="chat-dot"></span>
							<span class="chat-dot"></span>
						</div>
					</div>
				{/if}
			{/if}
		</div>

		{#if chat.error}
			<div class="chat-error mx-3 mb-2 rounded-md px-3 py-2 text-fluid-sm" role="alert">
				<span class="font-medium">Error:</span>
				{chat.error.message ?? 'Something went wrong.'}
			</div>
		{/if}

		<div class="chat-input-row">
			<ChatInput bind:value={inputValue} loading={isLoading} onsubmit={submitMessage} />
		</div>
	</div>
{/snippet}

<Stack gap="6">
	{#if !data.configured}
		<Alert variant="info" title="AI Not Configured">
			<p>Configure an AI provider and ingest documents to use RAG chat.</p>
		</Alert>
	{:else}
		<Card class="chat-card">
			{#snippet header()}
				<div class="chat-header">
					<Typography variant="h5" as="h2">RAG Chat</Typography>
					<EngineToggle
						engine={useLlmwiki ? 'llmwiki' : 'hybrid'}
						onchange={setEngine}
						disabled={isLoading}
					/>
				</div>
			{/snippet}

			<ChatLayout>
				{@render chatBody()}
			</ChatLayout>
		</Card>

		<Card>
			<NragObservability
				{rawrag}
				{llmwiki}
				{engine}
				{isLoading}
				{lastUserMessage}
				counterfactual={{ chat: counterfactualChat, run: runCounterfactual }}
			/>
		</Card>
	{/if}
</Stack>

<style>
	:global(.chat-card) {
		padding: 0 !important;
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
		padding: var(--spacing-4) var(--spacing-5);
		flex-wrap: wrap;
	}

	.chat-container {
		display: flex;
		flex-direction: column;
		height: min(500px, 60vh);
	}

	.chat-messages {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	:global(.chat-empty) {
		height: 100%;
		min-height: 0;
		padding: var(--spacing-6);
	}

	.demo-chips {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
		max-width: 520px;
		margin-top: var(--spacing-3);
	}

	.demo-chip {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--surface-1);
		color: var(--color-fg);
		font-size: 12px;
		cursor: pointer;
		text-align: left;
	}

	.demo-chip:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--surface-1));
	}

	.chip-query {
		font-weight: 500;
	}

	.chip-why {
		font-size: 10px;
		color: var(--color-muted);
	}

	.chat-error {
		background-color: color-mix(in srgb, var(--color-error-fg) 10%, transparent);
		border: 1px solid color-mix(in srgb, var(--color-error-fg) 20%, transparent);
		color: var(--color-error-fg);
	}

	.chat-input-row {
		display: flex;
		flex-direction: column;
	}

	.chat-typing-avatar {
		background-color: color-mix(in srgb, var(--color-muted) 20%, transparent);
		color: var(--color-fg);
	}

	.chat-typing-dots {
		padding: 8px 12px;
		border-radius: var(--radius-lg);
		background-color: color-mix(in srgb, var(--color-muted) 12%, transparent);
	}

	.chat-dot {
		display: block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background-color: var(--color-muted);
		animation: chat-bounce 1.4s infinite ease-in-out both;
	}

	.chat-dot:nth-child(1) {
		animation-delay: -0.32s;
	}
	.chat-dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes chat-bounce {
		0%,
		80%,
		100% {
			transform: scale(0.6);
			opacity: 0.4;
		}
		40% {
			transform: scale(1);
			opacity: 1;
		}
	}
</style>
