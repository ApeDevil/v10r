<script lang="ts">
import { Chat } from '@ai-sdk/svelte';
import { CSRF_HEADER } from '$lib/api';
import { Alert, Card, EmptyState } from '$lib/components/composites';
import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';
import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
import { Stack } from '$lib/components/layout';
import { Drawer, ToggleGroup, Typography } from '$lib/components/primitives';
import { createPipelineState, RagPipeline } from './_components/rag-pipeline';

let { data } = $props();

let selectedTierValues: string[] = $state(['1']);
const selectedTiers = $derived(selectedTierValues.map((v) => Number(v) as 1 | 2 | 3));
const tierItems = [
	{ value: '1', label: 'T1' },
	{ value: '2', label: 'T2' },
	{ value: '3', label: 'T3' },
];

let drawerOpen = $state(false);

const pipeline = createPipelineState();

const chat = new Chat({
	api: '/api/ai/chat',
	headers: CSRF_HEADER,
	body: {
		get useRetrieval() {
			return true;
		},
		get retrievalTiers() {
			return selectedTiers;
		},
	},
});

const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

let scrollContainer: HTMLDivElement | undefined = $state();

// Guard: prevent empty tier selection
$effect(() => {
	if (selectedTierValues.length === 0) selectedTierValues = ['1'];
});

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

// Process pipeline annotations from the last assistant message
$effect(() => {
	const msgs = chat.messages;
	if (msgs.length === 0) return;
	const lastMsg = msgs[msgs.length - 1];
	if (lastMsg?.role === 'assistant' && lastMsg.annotations) {
		pipeline.processAnnotations(lastMsg.annotations as unknown[]);
	}
});

function submitMessage() {
	if (!chat.input.trim() || isLoading) return;
	pipeline.reset();
	pipeline.resetCursor();
	chat.sendMessage({ text: chat.input });
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
						<ToggleGroup type="multiple" bind:value={selectedTierValues} items={tierItems} size="sm" />
					</div>
				{/snippet}

				<div class="chat-container">
					<div bind:this={scrollContainer} class="chat-messages">
						{#if chat.messages.length === 0}
							<EmptyState
								icon="i-lucide-brain-circuit h-10 w-10"
								title="Ask a question"
								description="Ask a question about your ingested documents."
								class="chat-empty"
							>
								<p class="text-fluid-xs text-muted">Tiers: {selectedTiers.map(t => `T${t}`).join(' + ')}</p>
							</EmptyState>
						{:else}
							{#each chat.messages as message (message.id)}
								<ChatMessage role={message.role as 'user' | 'assistant'} parts={message.parts} content={message.content} />
							{/each}

							{#if isLoading && chat.messages[chat.messages.length - 1]?.role === 'user'}
								<div class="chat-typing flex items-center gap-3 px-4 py-3">
									<div class="chat-typing-avatar flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
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
						<ChatInput bind:value={chat.input} loading={isLoading} onsubmit={submitMessage} />

						{#if pipeline.isActive || pipeline.totalDurationMs > 0}
							<button class="pipeline-chip" onclick={() => { drawerOpen = true; }}>
								{#if pipeline.isActive}
									<span class="chip-dot"></span> Trace running
								{:else}
									Trace {pipeline.totalDurationMs}ms
								{/if}
							</button>
						{/if}
					</div>
				</div>
			</Card>

			<Drawer bind:open={drawerOpen} side="bottom" title="Retrieval Trace">
				<RagPipeline {pipeline} />
			</Drawer>
		{/if}
	</Stack>

<style>
	:global(.chat-card) {
		padding: 0 !important;
	}

	/* Chat header */
	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-4) var(--spacing-5);
	}

	/* Chat container */
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

	.chat-dot:nth-child(1) { animation-delay: -0.32s; }
	.chat-dot:nth-child(2) { animation-delay: -0.16s; }

	@keyframes chat-bounce {
		0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
		40% { transform: scale(1); opacity: 1; }
	}

	/* Pipeline chip */
	.pipeline-chip {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-surface-2) 80%, transparent);
		color: var(--color-muted);
		font-size: 11px;
		cursor: pointer;
		margin: var(--spacing-2) var(--spacing-3);
	}

	.chip-dot {
		display: inline-block;
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background-color: var(--color-primary);
		animation: pulse-chip 1s ease-in-out infinite;
	}

	@keyframes pulse-chip {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}

	@media (prefers-reduced-motion: reduce) {
		.chip-dot {
			animation: none;
		}
	}
</style>
