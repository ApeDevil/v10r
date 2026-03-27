<script lang="ts">
import Skeleton from './Skeleton.svelte';

interface Props {
	size?: 'sm' | 'md' | 'lg';
	class?: string;
}

let { size = 'md', class: className }: Props = $props();

const dimensions = $derived(
	{
		sm: '32px',
		md: '48px',
		lg: '64px',
	}[size],
);
</script>

<div aria-label="Loading avatar">
	<Skeleton
		width={dimensions}
		height={dimensions}
		rounded="full"
		class="skeleton-avatar {className || ''}"
	/>
</div>

<style>
	:global(.skeleton-avatar) {
		flex-shrink: 0;
	}
</style>
