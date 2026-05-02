<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import { getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/db/cache');
</script>

<NavTab {tabs} ariaLabel="Cache sections" />

<div class="pt-6">
	{@render children()}
</div>
