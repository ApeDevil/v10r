<script lang="ts">
import type { Snippet } from 'svelte';

interface Props {
	children: Snippet;
}

let { children }: Props = $props();
</script>

<div class="chat-layout">
	{@render children()}
</div>

<style>
	.chat-layout {
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
</style>
