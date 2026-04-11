<script lang="ts">
import Dialog from '$lib/components/primitives/dialog/Dialog.svelte';
import Tabs from '$lib/components/primitives/tabs/Tabs.svelte';
import BotContextSection from './BotContextSection.svelte';
import BotProviderSection from './BotProviderSection.svelte';
import BotStorageSection from './BotStorageSection.svelte';
import BotToolsSection from './BotToolsSection.svelte';

interface Props {
	open: boolean;
	initialTab?: string;
}

let { open = $bindable(false), initialTab }: Props = $props();
</script>

<Dialog bind:open title="Bot Manager" class="bot-manager-dialog">
	<Tabs
		value={initialTab}
		tabs={[
			{ value: 'context', label: 'Context', content: contextTab },
			{ value: 'tools', label: 'Tools', content: toolsTab },
			{ value: 'provider', label: 'Provider', content: providerTab },
			{ value: 'storage', label: 'Storage', content: storageTab },
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

{#snippet providerTab()}
	<div class="tab-scroll">
		<BotProviderSection />
	</div>
{/snippet}

{#snippet storageTab()}
	<div class="tab-scroll">
		<BotStorageSection />
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
