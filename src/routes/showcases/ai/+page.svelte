<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, BackLink } from '$lib/components/composites';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>AI - Showcases - Velociraptor</title>
</svelte:head>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="AI"
		description="AI integration with Vercel AI SDK and Groq."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI' }
		]}
	/>

	<nav class="ai-nav">
		<LinkCard
			href="/showcases/ai/connection"
			icon="i-lucide-activity"
			title="Connection"
			description="Provider health check, latency measurement, and configuration status"
		/>

		<LinkCard
			href="/showcases/ai/chat"
			icon="i-lucide-message-circle"
			title="Chat"
			description="Streaming chat demo with Groq Llama 3.3 70B"
		/>
	</nav>

	<BackLink href="/showcases" label="Showcases" />
</PageContainer>

<style>
	.ai-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: var(--spacing-6);
	}
</style>
