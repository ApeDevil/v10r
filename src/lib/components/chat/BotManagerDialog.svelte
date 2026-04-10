<script lang="ts">
import Dialog from '$lib/components/primitives/dialog/Dialog.svelte';
import Tabs from '$lib/components/primitives/tabs/Tabs.svelte';
import BotContextSection from './BotContextSection.svelte';
import BotToolsSection from './BotToolsSection.svelte';

interface Props {
	open: boolean;
}

let { open = $bindable(false) }: Props = $props();
</script>

<Dialog bind:open title="Bot Manager" class="bot-manager-dialog">
	<Tabs
		tabs={[
			{ value: 'context', label: 'Context', content: contextTab },
			{ value: 'tools', label: 'Tools', content: toolsTab },
		]}
	/>
</Dialog>

{#snippet contextTab()}
	<div class="tab-scroll">
		<BotContextSection />
	</div>
{/snippet}

{#snippet toolsTab()}
	<div class="tab-scroll">
		<BotToolsSection />
	</div>
{/snippet}

<style>
	:global(.bot-manager-dialog) {
		max-width: 480px !important;
	}

	.tab-scroll {
		overflow-y: auto;
		max-height: calc(70vh - 160px);
		padding: 4px 0;
	}
</style>
