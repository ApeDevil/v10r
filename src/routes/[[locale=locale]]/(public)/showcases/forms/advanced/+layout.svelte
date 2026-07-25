<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import { getShowcaseSublinkLabel, getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/forms/advanced');
const ariaLabel = m.showcase_subtabs_aria({ section: getShowcaseSublinkLabel('/showcases/forms/advanced') });
</script>

<NavTab {tabs} {ariaLabel} />

<div class="pt-6">
	{@render children()}
</div>
