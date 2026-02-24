<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/ai/connection' },
		{ label: 'Chat', href: '/showcases/ai/chat' },
		{ label: 'Streaming', href: '/showcases/ai/streaming' },
		{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
	];
</script>

<PageContainer width="wide" class="pt-7">
	<PageHeader
		title="AI"
		description="AI integration with Vercel AI SDK. Supports Groq, OpenAI, and Google Gemini."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'AI' }
		]}
	/>

	<TabNav {tabs} ariaLabel="AI sections" />

	<div class="pt-6">
		{@render children()}
	</div>
</PageContainer>
