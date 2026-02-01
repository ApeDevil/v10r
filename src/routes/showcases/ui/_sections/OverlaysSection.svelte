<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import VariantGrid from './shared/VariantGrid.svelte';
	import { Dialog, Drawer, Button, ConfirmDialog } from '$lib/components';
	import { Tooltip, Popover } from '$lib/components';

	let dialogOpen = $state(false);
	let drawerOpen = $state(false);
	let confirmOpen = $state(false);
	let confirmResult = $state<boolean | null>(null);

	async function handleConfirm() {
		confirmOpen = true;
	}
</script>

<section id="overlays" class="section">
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

		<!-- Confirm Dialog -->
		<DemoCard title="Confirm Dialog" description="Confirmation prompt">
			<Button onclick={handleConfirm} variant="destructive">Delete Item</Button>
			{#if confirmResult !== null}
				<p class="confirm-result">
					Result: {confirmResult ? 'Confirmed' : 'Cancelled'}
				</p>
			{/if}

			<ConfirmDialog
				bind:open={confirmOpen}
				title="Confirm Delete"
				description="Are you sure you want to delete this item? This action cannot be undone."
				confirmLabel="Delete"
				cancelLabel="Cancel"
				destructive
				onconfirm={() => {
					confirmResult = true;
					confirmOpen = false;
				}}
				oncancel={() => {
					confirmResult = false;
					confirmOpen = false;
				}}
			/>
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
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 80px;
		margin-bottom: 3rem;
	}

	.section-title {
		font-size: clamp(1.5rem, 3vw, 2rem);
		font-weight: 700;
		margin: 0 0 0.5rem 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 2rem 0;
		font-size: 1rem;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.dialog-content,
	.drawer-content {
		margin: 1rem 0;
		line-height: 1.6;
		color: var(--color-fg);
	}

	.drawer-title {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0 0 1rem 0;
		color: var(--color-fg);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 1.5rem;
	}

	.confirm-result {
		margin-top: 0.5rem;
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.popover-content {
		padding: 0.5rem;
	}

	.popover-title {
		font-size: 0.875rem;
		font-weight: 600;
		margin: 0 0 0.25rem 0;
		color: var(--color-fg);
	}

	.popover-text {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.5;
	}
</style>
