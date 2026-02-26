<script lang="ts">
	import type { Snippet } from 'svelte';
	import { ShowcaseLayout } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Connection', href: '/showcases/ai/connection' },
		{ label: 'Chat', href: '/showcases/ai/chat' },
		{ label: 'Streaming', href: '/showcases/ai/streaming' },
		{ label: 'Retrieval', href: '/showcases/ai/retrieval' },
	];
</script>

<ShowcaseLayout
	title="AI"
	description="AI integration with Vercel AI SDK. Supports Groq, OpenAI, and Google Gemini."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'AI' }
	]}
	{tabs}
	ariaLabel="AI sections"
	width="wide"
	containerClass="pt-7"
>
	{@render children()}
</ShowcaseLayout>
