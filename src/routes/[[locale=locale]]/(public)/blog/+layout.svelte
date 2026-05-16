<script lang="ts">
import type { Snippet } from 'svelte';

let { children }: { children: Snippet } = $props();
</script>

<svelte:head>
	<link rel="alternate" type="application/rss+xml" title="Blog Feed" href="/blog/feed.xml" />
</svelte:head>

{@render children()}
