<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import { getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/forms/basics');
</script>

<NavTab {tabs} ariaLabel="Basics sections" />

<div class="pt-6">
	{@render children()}
</div>
