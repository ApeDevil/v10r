<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import { getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/ui/splits');
</script>

<NavTab {tabs} ariaLabel="Split types" />

<div class="pt-6">
	{@render children()}
</div>

