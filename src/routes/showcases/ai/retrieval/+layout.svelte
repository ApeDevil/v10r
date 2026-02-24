<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Ingest', href: '/showcases/ai/retrieval/ingest' },
		{ label: 'Contextual', href: '/showcases/ai/retrieval/contextual' },
		{ label: 'Parent-Child', href: '/showcases/ai/retrieval/parent-child' },
		{ label: 'Graph', href: '/showcases/ai/retrieval/graph' },
		{ label: 'Chat', href: '/showcases/ai/retrieval/chat' },
	];
</script>

<TabNav {tabs} ariaLabel="Retrieval sections" />

<div class="pt-6">
	{@render children()}
</div>
