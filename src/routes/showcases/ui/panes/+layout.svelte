<script lang="ts">
	import type { Snippet } from 'svelte';
	import { TabNav, Card } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Resizable', href: '/showcases/ui/panes/resizable' },
		{ label: 'Reorderable', href: '/showcases/ui/panes/reorderable' },
		{ label: 'Panels', href: '/showcases/ui/panes/panels' },
	];
</script>

<div class="panes-intro">
	<div class="intro-cards">
		<Card>
			<h3 class="text-fluid-lg font-bold mb-2">Panes</h3>
			<p class="text-fluid-sm text-muted">
				Resizable spatial containers. Drag resize handles between regions. No content identity — just geometry.
			</p>
		</Card>
		<Card>
			<h3 class="text-fluid-lg font-bold mb-2">Panels</h3>
			<p class="text-fluid-sm text-muted">
				Content units with identity. Named, movable content with tabs, drag-to-split, and activity bar. Built on top of panes.
			</p>
		</Card>
	</div>

	<Card>
		<pre class="text-fluid-sm text-muted font-mono overflow-x-auto">Pane (resizable box)
  └─ Panel Stack (leaf with tabs)
      ├─ Panel "Explorer"
      ├─ Panel "Search"
      └─ Panel "Terminal"</pre>
	</Card>
</div>

<TabNav {tabs} ariaLabel="Pane types" />

<div class="pt-6">
	{@render children()}
</div>

<style>
	.panes-intro {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		margin-bottom: var(--spacing-6);
	}

	.intro-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-4);
	}
</style>
