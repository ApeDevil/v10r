<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseCard } from '../showcases';

let { children }: { children: Snippet } = $props();

const card = getShowcaseCard('/showcases/abuse');
</script>

<ShowcaseLayout {card}>
	{@render children()}
</ShowcaseLayout>
