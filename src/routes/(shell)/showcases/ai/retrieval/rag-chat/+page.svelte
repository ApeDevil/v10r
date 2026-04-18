<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { DefaultChatTransport } from 'ai';
import { onMount } from 'svelte';
import { pushState } from '$app/navigation';
import { page } from '$app/state';
import { CSRF_HEADER } from '$lib/api';
import { Alert, Card, EmptyState } from '$lib/components/composites';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import { Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';
import ChatLayout from './_components/ChatLayout.svelte';
import GraphLayout from './_components/GraphLayout.svelte';
import { createLlmwikiTrace } from './_components/llmwiki';
import ModeSelector, { type RagMode } from './_components/ModeSelector.svelte';
import { createRawragTrace } from './_components/rawrag';
import TraceDrawer from './_components/TraceDrawer.svelte';
import TraceRail from './_components/TraceRail.svelte';
import { DEMO_QUERIES } from './demo-queries';

let { data } = $props();

const VALID_MODES: RagMode[] = ['vector', 'small-to-big', 'graph', 'fused', 'llmwiki'];

function parseMode(value: string | null): RagMode {
	return VALID_MODES.includes(value as RagMode) ? (value as RagMode) : 'vector';
}

let mode = $state<RagMode>(parseMode(page.url.searchParams.get('mode')));

const isLlmwiki = $derived(mode === 'llmwiki');
const retrievalTiers = $derived(
	mode === 'vector' ? [1] : mode === 'small-to-big' ? [2] : mode === 'graph' ? [3] : [1, 2, 3],
);
const fusion = $derived<'none' | 'rrf'>(mode === 'fused' ? 'rrf' : 'none');

function handleModeChange(next: RagMode) {
	const wasLlmwiki = mode === 'llmwiki';
	const nowLlmwiki = next === 'llmwiki';
	mode = next;
	const url = new URL(page.url);
	url.searchParams.set('mode', next);
	pushState(url, {});
	// Reset traces on any mode change; state is per-turn, not preserved across modes.
	if (wasLlmwiki !== nowLlmwiki) {
		rawragTrace.reset();
		rawragTrace.resetCursor();
		llmwikiTrace.reset();
		llmwikiTrace.resetCursor();
	}
}

let drawerOpen = $state(false);
let inputValue = $state('');

const demoChips = $derived(DEMO_QUERIES[mode] ?? []);

onMount(() => {
	const seedLabel = page.url.searchParams.get('seed');
	if (seedLabel) {
		inputValue = `Tell me about ${seedLabel}`;
	}
});

function useDemoChip(query: string) {
	inputValue = query;
}

const rawragTrace = createRawragTrace();
const llmwikiTrace = createLlmwikiTrace();

const chat = new Chat({
	transport: new DefaultChatTransport({
		api: '/api/ai/chat',
		headers: CSRF_HEADER,
		body: {
			get useRetrieval() {
				return !isLlmwiki;
			},
			get retrievalTiers() {
				return retrievalTiers;
			},
			get fusion() {
				return fusion;
			},
			get useLlmwiki() {
				return isLlmwiki;
			},
			get llmwikiCollectionId() {
				return null;
			},
		},
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

// Process pipeline data from the last assistant message metadata
$effect(() => {
	const msgs = chat.messages;
	if (msgs.length === 0) return;
	const lastMsg = msgs[msgs.length - 1];
	if (lastMsg?.role === 'assistant' && lastMsg.metadata) {
		const meta = lastMsg.metadata as Record<string, unknown>;
		if (Array.isArray(meta.pipeline)) {
			const events = meta.pipeline as unknown[];
			if (isLlmwiki) {
				llmwikiTrace.processAnnotations(events);
			} else {
				rawragTrace.processAnnotations(events);
			}
		}
	}
});

function submitMessage() {
	if (!inputValue.trim() || isLoading) return;
	if (isLlmwiki) {
		llmwikiTrace.reset();
		llmwikiTrace.resetCursor();
	} else {
		rawragTrace.reset();
		rawragTrace.resetCursor();
	}
	const text = inputValue;
	inputValue = '';
	chat.sendMessage({ text });
}
</script>

<svelte:head>
	<title>RAG Chat - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

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
					<ModeSelector value={mode} onchange={handleModeChange} />
				</div>
			{/snippet}

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

					<TraceRail
						rawrag={rawragTrace}
						llmwiki={llmwikiTrace}
						{isLlmwiki}
						onExpand={() => (drawerOpen = true)}
					/>
				</div>
			{/snippet}

			{#if mode === 'graph'}
				<GraphLayout onNodeSelect={(label) => (inputValue = `Tell me about ${label}`)}>
					{@render chatBody()}
				</GraphLayout>
			{:else}
				<ChatLayout>
					{@render chatBody()}
				</ChatLayout>
			{/if}
		</Card>

		<TraceDrawer
			bind:open={drawerOpen}
			rawrag={rawragTrace}
			llmwiki={llmwikiTrace}
			{isLlmwiki}
			{lastUserMessage}
		/>
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
		background: var(--color-surface-1);
		color: var(--color-fg);
		font-size: 12px;
		cursor: pointer;
		text-align: left;
	}

	.demo-chip:hover {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 6%, var(--color-surface-1));
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
