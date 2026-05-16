<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import { getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/ai/retrieval');
</script>

<NavTab {tabs} ariaLabel="Retrieval sections" />

<div class="pt-6">
	{@render children()}
</div>
