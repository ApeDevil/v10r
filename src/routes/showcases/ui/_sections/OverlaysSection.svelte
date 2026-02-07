<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import { Dialog, Drawer, Button, Tabs } from '$lib/components';
	import { Tooltip, Popover } from '$lib/components';

	let dialogOpen = $state(false);
	let drawerOpen = $state(false);
	let tabValue = $state('tab1');
</script>

<section id="prim-overlays" class="section">
	<h2 class="section-title">Overlays</h2>
	<p class="section-description">Components that appear above other content.</p>

	<div class="demos">
		<!-- Dialog -->
		<DemoCard title="Dialog" description="Modal dialog">
			<Button onclick={() => (dialogOpen = true)}>Open Dialog</Button>

			<Dialog bind:open={dialogOpen} title="Dialog Title" description="This is a dialog description.">
				<div class="dialog-content">
					<p>Dialog content goes here.</p>
				</div>
				<div class="dialog-actions">
					<Button variant="outline" onclick={() => (dialogOpen = false)}>Cancel</Button>
					<Button onclick={() => (dialogOpen = false)}>Confirm</Button>
				</div>
			</Dialog>
		</DemoCard>

		<!-- Drawer -->
		<DemoCard title="Drawer" description="Slide-in panel">
			<Button onclick={() => (drawerOpen = true)}>Open Drawer</Button>

			<Drawer bind:open={drawerOpen}>
				<div class="drawer-content">
					<h3 class="drawer-title">Drawer Title</h3>
					<p>Drawer content goes here.</p>
				</div>
			</Drawer>
		</DemoCard>

		<!-- Tooltip -->
		<DemoCard title="Tooltip" description="Hover hint">
			<Tooltip content="This is a tooltip">
				<Button variant="outline">Hover me</Button>
			</Tooltip>
		</DemoCard>

		<!-- Popover -->
		<DemoCard title="Popover" description="Click-triggered overlay">
			<Popover>
				{#snippet trigger()}
					<Button variant="outline">Click me</Button>
				{/snippet}

				{#snippet content()}
					<div class="popover-content">
						<h4 class="popover-title">Popover Title</h4>
						<p class="popover-text">This is popover content.</p>
					</div>
				{/snippet}
			</Popover>
		</DemoCard>

		<!-- Tabs -->
		<DemoCard title="Tabs" description="Tabbed interface">
			<div class="tabs-demo">
				<Tabs
					bind:value={tabValue}
					tabs={[
						{
							value: 'tab1',
							label: 'Tab 1',
							content: () => 'Content for Tab 1'
						},
						{
							value: 'tab2',
							label: 'Tab 2',
							content: () => 'Content for Tab 2'
						},
						{
							value: 'tab3',
							label: 'Tab 3',
							content: () => 'Content for Tab 3'
						}
					]}
				/>
			</div>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.dialog-content,
	.drawer-content {
		margin: var(--spacing-4) 0;
		line-height: 1.6;
		color: var(--color-fg);
	}

	.drawer-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0 0 var(--spacing-4) 0;
		color: var(--color-fg);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-3);
		margin-top: var(--spacing-6);
	}

	.popover-content {
		padding: var(--spacing-2);
	}

	.popover-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		margin: 0 0 var(--spacing-1) 0;
		color: var(--color-fg);
	}

	.popover-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.tabs-demo {
		width: 100%;
	}
</style>
