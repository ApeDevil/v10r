<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import { getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/db/relational');
</script>

<NavTab {tabs} ariaLabel="Relational sections" />

<div class="pt-6">
	{@render children()}
</div>
