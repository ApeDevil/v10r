<script lang="ts">
	import { Chat } from '@ai-sdk/svelte';
	import { PageHeader, BackLink, Card, Alert, EmptyState } from '$lib/components/composites';
	import { RagPipeline, createPipelineState } from './_components/rag-pipeline';
	import { Typography, Drawer } from '$lib/components/primitives';
	import { PageContainer, Stack } from '$lib/components/layout';
	import ChatMessage from '$lib/components/composites/chatbot/ChatMessage.svelte';
	import ChatInput from '$lib/components/composites/chatbot/ChatInput.svelte';

	let { data } = $props();

	let selectedTiers: (1 | 2 | 3)[] = $state([1]);
	let drawerOpen = $state(false);

	const pipeline = createPipelineState();

	const chat = new Chat({
		api: '/api/ai/chat',
		body: {
			get useRetrieval() { return true; },
			get retrievalTiers() { return selectedTiers; },
		},
	});

	const isLoading = $derived(chat.status === 'submitted' || chat.status === 'streaming');

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
		chat.handleSubmit();
	}

	function toggleTier(tier: 1 | 2 | 3) {
		if (selectedTiers.includes(tier)) {
			if (selectedTiers.length > 1) {
				selectedTiers = selectedTiers.filter(t => t !== tier);
			}
		} else {
			selectedTiers = [...selectedTiers, tier].sort();
		}
	}
</script>

<svelte:head>
	<title>RAG Chat - Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer class="py-7">
	<PageHeader
		title="RAG Chat"
		description="Chat with retrieval-augmented generation. Context from your ingested documents is automatically injected into the conversation."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI', href: '/showcases/ai' },
			{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
			{ label: 'RAG Chat' }
		]}
	/>

	<Stack gap="6">
		{#if !data.configured}
			<Alert variant="info" title="AI Not Configured">
				<p>Configure an AI provider and ingest documents to use RAG chat.</p>
			</Alert>
		{:else}
			<div class="rag-layout">
				<div class="rag-main">
					<Card class="chat-card">
						{#snippet header()}
							<div class="chat-header">
								<Typography variant="h5" as="h2">RAG Chat</Typography>
								<div class="tier-selector">
									<button
										class="tier-btn"
										class:active={selectedTiers.includes(1)}
										onclick={() => toggleTier(1)}
										aria-pressed={selectedTiers.includes(1)}
										aria-label="Tier 1: Contextual retrieval"
									>T1</button>
									<button
										class="tier-btn"
										class:active={selectedTiers.includes(2)}
										onclick={() => toggleTier(2)}
										aria-pressed={selectedTiers.includes(2)}
										aria-label="Tier 2: Parent-child retrieval"
									>T2</button>
									<button
										class="tier-btn"
										class:active={selectedTiers.includes(3)}
										onclick={() => toggleTier(3)}
										aria-pressed={selectedTiers.includes(3)}
										aria-label="Tier 3: Graph traversal"
									>T3</button>
								</div>
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
										<ChatMessage role={message.role as 'user' | 'assistant'} content={message.content} />
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

								<!-- Mobile pipeline status chip -->
								{#if pipeline.isActive || pipeline.totalDurationMs > 0}
									<button class="pipeline-chip" onclick={() => { drawerOpen = true; }}>
										{#if pipeline.isActive}
											<span class="chip-dot"></span>
											Pipeline running
										{:else}
											Pipeline {pipeline.totalDurationMs}ms
										{/if}
									</button>
								{/if}
							</div>
						</div>
					</Card>
				</div>

				<!-- Desktop sidebar -->
				<div class="rag-sidebar">
					<Card>
						{#snippet header()}
							<Typography variant="h6" as="h3">Pipeline</Typography>
						{/snippet}

						<RagPipeline {pipeline} />
					</Card>

					<Card>
						{#snippet header()}
							<Typography variant="h6" as="h3">Active Tiers</Typography>
						{/snippet}

						<div class="tier-info">
							<div class="tier-item" class:active={selectedTiers.includes(1)}>
								<span class="tier-label">T1</span>
								<span class="text-fluid-xs">Contextual (vector + BM25)</span>
							</div>
							<div class="tier-item" class:active={selectedTiers.includes(2)}>
								<span class="tier-label">T2</span>
								<span class="text-fluid-xs">Parent-Child (small-to-big)</span>
							</div>
							<div class="tier-item" class:active={selectedTiers.includes(3)}>
								<span class="tier-label">T3</span>
								<span class="text-fluid-xs">Graph (Neo4j traversal)</span>
							</div>
						</div>
					</Card>
				</div>
			</div>

			<!-- Mobile drawer -->
			<Drawer bind:open={drawerOpen} side="bottom">
				<RagPipeline {pipeline} />
			</Drawer>
		{/if}
	</Stack>

	<BackLink href="/showcases/ai/retrieval" label="Retrieval" />
</PageContainer>

<style>
	:global(.chat-card) {
		padding: 0 !important;
	}

	.rag-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: var(--spacing-6);
	}

	@media (min-width: 768px) {
		.rag-layout {
			grid-template-columns: 1fr 260px;
		}
	}

	.rag-sidebar {
		display: none;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	@media (min-width: 768px) {
		.rag-sidebar {
			display: flex;
		}
	}

	.chat-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: var(--spacing-4) var(--spacing-5);
	}

	.tier-selector {
		display: flex;
		gap: var(--spacing-1);
	}

	.tier-btn {
		padding: 4px 10px;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: none;
		color: var(--color-muted);
		font-size: 11px;
		font-weight: 600;
		cursor: pointer;
		transition: all 150ms;
	}

	.tier-btn.active {
		background-color: var(--color-primary);
		color: var(--color-primary-fg);
		border-color: var(--color-primary);
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

	.tier-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.tier-item {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		opacity: 0.4;
	}

	.tier-item.active {
		opacity: 1;
		background-color: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.tier-label {
		font-weight: 700;
		font-size: 11px;
		color: var(--color-primary);
		min-width: 24px;
	}

	/* Mobile pipeline chip */
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

	@media (min-width: 768px) {
		.pipeline-chip {
			display: none;
		}
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
