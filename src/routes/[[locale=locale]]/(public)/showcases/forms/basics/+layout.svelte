<script lang="ts">
import type { Snippet } from 'svelte';
import { NavTab } from '$lib/components/composites';
import * as m from '$lib/paraglide/messages';
import { getShowcaseSublinkLabel, getShowcaseSubTabs } from '../../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseSubTabs('/showcases/forms/basics');
const ariaLabel = m.showcase_subtabs_aria({ section: getShowcaseSublinkLabel('/showcases/forms/basics') });
</script>

<NavTab {tabs} {ariaLabel} />

<div class="pt-6">
	{@render children()}
</div>
