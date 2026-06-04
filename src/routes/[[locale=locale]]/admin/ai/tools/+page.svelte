<script lang="ts">
import ToolTopologyView from '$lib/components/admin/ai/ToolTopologyView.svelte';
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';

let { data } = $props();
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">Chatbot Tool Topology</h2>
		{/snippet}
		<ToolTopologyView tools={data.tools} />
	</Card>
</Stack>
