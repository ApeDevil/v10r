<script lang="ts">
import { cn } from '$lib/utils/cn';
import { getKeySymbol, type KbdVariants, kbdVariants } from './kbd';

interface Props extends KbdVariants {
	keys: string | string[];
	class?: string;
}

let { keys, size = 'md', class: className }: Props = $props();

// Convert keys to array format
const keyArray = $derived(
	Array.isArray(keys) ? keys : keys.includes('+') ? keys.split('+').map((k) => k.trim()) : [keys],
);
</script>

<kbd class={cn(kbdVariants({ size }), className)}>
	{#each keyArray as key, index}
		<span>{getKeySymbol(key)}</span>
		{#if index < keyArray.length - 1}
			<span aria-hidden="true">+</span>
		{/if}
	{/each}
</kbd>
