<script lang="ts">
import { Alert, LinkCard } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Typography } from '$lib/components/primitives';

let { data } = $props();
</script>

<svelte:head>
	<title>Retrieval - AI - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
	<div>
		<Typography variant="h4" as="h1">Retrieval-Augmented Generation</Typography>
		<Typography variant="muted" as="p">
			Teach an LLM about your documents in three steps: ingest them, ask questions, explore the
			knowledge graph.
		</Typography>
	</div>

	{#if !data.configured}
		<Alert variant="info" title="AI Not Configured">
			<p>Configure an AI provider in settings to use retrieval.</p>
		</Alert>
	{/if}

	<div class="cards-grid">
		<LinkCard
			href="/showcases/ai/retrieval/ingest"
			icon="i-lucide-file-plus"
			title="1. Ingest Documents"
			description="Hierarchical chunking, contextual prefixes, embeddings, and entity extraction — watch the write-path pipeline build a searchable corpus."
		/>

		<LinkCard
			href="/showcases/ai/retrieval/rag-chat"
			icon="i-lucide-message-square-text"
			title="2. Ask Questions"
			description="Chat with your corpus using four retrieval modes — vector search, small-to-big, entity graph, or all three fused with RRF."
		/>

		<LinkCard
			href="/showcases/ai/retrieval/explorer"
			icon="i-lucide-network"
			title="3. Explore the Graph"
			description="Walk the entity graph interactively — find paths, expand neighborhoods, and jump back into chat from any node."
		/>
	</div>
</Stack>

<style>
	.cards-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: var(--spacing-5);
	}
</style>
