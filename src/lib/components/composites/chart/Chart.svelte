<script lang="ts">
	/**
	 * @deprecated Use SimpleChart from '$lib/components/viz' instead.
	 * This re-export exists for backwards compatibility.
	 */
	import type { ComponentProps } from 'svelte';
	import SimpleChart from '../../viz/chart/simple/SimpleChart.svelte';

	let props: ComponentProps<typeof SimpleChart> = $props();
</script>

<SimpleChart {...props} />
