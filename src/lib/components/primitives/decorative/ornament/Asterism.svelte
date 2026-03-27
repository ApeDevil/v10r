<script lang="ts">
import { cn } from '$lib/utils/cn';

interface Props {
	pattern?: 'three-dots' | 'fleuron' | 'dinkus' | 'star';
	size?: number;
	color?: string;
	class?: string;
}

let { pattern = 'three-dots', size = 16, color = 'currentColor', class: className }: Props = $props();
</script>

<div
	class={cn('flex items-center justify-center select-none gap-[0.5em]', className)}
	role="separator"
	aria-hidden="true"
	style:color
	style:font-size="{size}px"
>
	{#if pattern === 'three-dots'}
		<span>&#x2022;</span><span>&#x2022;</span><span>&#x2022;</span>
	{:else if pattern === 'fleuron'}
		<span>&#x2767;</span>
	{:else if pattern === 'dinkus'}
		<span>*</span><span>*</span><span>*</span>
	{:else if pattern === 'star'}
		<span>&#x2726;</span>
	{/if}
</div>
