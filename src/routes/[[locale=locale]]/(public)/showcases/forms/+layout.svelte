<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseCard } from '../showcases';

let { children }: { children: Snippet } = $props();

const card = getShowcaseCard('/showcases/forms');
</script>

<ShowcaseLayout {card} wrapperClass="forms-showcase">
	{@render children()}
</ShowcaseLayout>

<style>
	/* Shared form styles for all leaf pages */
	:global(.forms-showcase .form-grid) {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	:global(.forms-showcase .form-actions) {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}


</style>
