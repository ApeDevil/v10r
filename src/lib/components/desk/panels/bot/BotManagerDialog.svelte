<script lang="ts">
import { MediaQuery } from 'svelte/reactivity';
import Dialog from '$lib/components/primitives/dialog/Dialog.svelte';
import Drawer from '$lib/components/primitives/drawer/Drawer.svelte';
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

// Centered dialog on desktop, full-width bottom sheet on mobile.
const isDesktop = new MediaQuery('(min-width: 768px)', true);
</script>

{#if isDesktop.current}
	<Dialog bind:open title="Bot Manager" class="bot-manager-dialog">
		{@render manager()}
	</Dialog>
{:else}
	<Drawer side="bottom" layerId="bot-manager" title="Bot Manager" bind:open class="bot-manager-sheet">
		{@render manager()}
	</Drawer>
{/if}

{#snippet manager()}
	<Tabs
		value={initialTab}
		tabs={[
			{ value: 'context', label: 'Context', content: contextTab },
			{ value: 'tools', label: 'Tools', content: toolsTab },
			{ value: 'provider', label: 'Provider', content: providerTab },
			{ value: 'storage', label: 'Storage', content: storageTab },
		]}
	/>
{/snippet}

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

	/* In the sheet the drawer body is the scroll container — inner clamps would
	   double-scroll — and the tab strip pans sideways instead of wrapping. */
	:global(.bot-manager-sheet) .tab-scroll {
		max-height: none;
		overflow-y: visible;
	}

	:global(.bot-manager-sheet .tabs-list) {
		overflow-x: auto;
		flex-wrap: nowrap;
		scrollbar-width: none;
		max-width: 100%;
	}

	:global(.bot-manager-sheet .tabs-list)::-webkit-scrollbar {
		display: none;
	}

	:global(.bot-manager-sheet .tab-trigger) {
		min-height: 44px;
		flex-shrink: 0;
	}
</style>
