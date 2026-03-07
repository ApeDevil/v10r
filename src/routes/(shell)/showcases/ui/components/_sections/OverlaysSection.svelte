<script lang="ts">
	import { DemoCard } from '../_components';
	import { Dialog, Drawer, Button, Tabs, Accordion } from '$lib/components';
	import { Tooltip, Popover } from '$lib/components';

	let dialogOpen = $state(false);
	let drawerOpen = $state(false);
	let tabValue = $state('account');
</script>

{#snippet accountTab()}
	<div class="tab-content">
		<h4 class="tab-heading">Account Settings</h4>
		<p class="tab-text">Manage your account details, profile information, and preferences.</p>
	</div>
{/snippet}

{#snippet passwordTab()}
	<div class="tab-content">
		<h4 class="tab-heading">Change Password</h4>
		<p class="tab-text">Update your password regularly to keep your account secure.</p>
	</div>
{/snippet}

{#snippet notificationsTab()}
	<div class="tab-content">
		<h4 class="tab-heading">Notification Preferences</h4>
		<p class="tab-text">Choose which notifications you want to receive via email or push.</p>
	</div>
{/snippet}

<section id="prim-overlays" class="section">
	<h2 class="section-title">Overlays</h2>
	<p class="section-description">Components that appear above other content.</p>

	<div class="demos">
		<!-- Accordion -->
		<DemoCard title="Accordion" description="Collapsible content sections">
			<div class="accordion-demo">
				<Accordion
					items={[
						{ value: 'item-1', title: 'What is Velociraptor?', content: 'A full-stack template focused on performance and lightweight deployment.' },
						{ value: 'item-2', title: 'What tech stack does it use?', content: 'SvelteKit 2, Bun, PostgreSQL (Neon), Neo4j, and more.' },
						{ value: 'item-3', title: 'How do I get started?', content: 'Clone the repo and run podman-compose up to start developing.' }
					]}
				/>
			</div>
		</DemoCard>

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
							value: 'account',
							label: 'Account',
							content: accountTab
						},
						{
							value: 'password',
							label: 'Password',
							content: passwordTab
						},
						{
							value: 'notifications',
							label: 'Notifications',
							content: notificationsTab
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

	.accordion-demo {
		width: 100%;
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

	.tab-content {
		padding: var(--spacing-4);
	}

	.tab-heading {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.tab-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}

</style>
