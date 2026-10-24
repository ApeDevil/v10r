<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '#lib/components/composites/index.ts';
import { getShowcaseCard } from '../showcases';

let { children }: { children: Snippet } = $props();

const card = getShowcaseCard('/showcases/toolkits');
</script>

<ShowcaseLayout {card} width="wide" containerClass="pt-7">
	{@render children()}
</ShowcaseLayout>
