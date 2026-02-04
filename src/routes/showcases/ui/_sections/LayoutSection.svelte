<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import { Card, Tabs, PageHeader, FormField } from '$lib/components';
	import { Input } from '$lib/components';

	let tabValue = $state('tab1');
	let inputValue = $state('');
</script>

<section id="layout" class="section">
	<h2 class="section-title">Layout</h2>
	<p class="section-description">Components for structuring content.</p>

	<div class="demos">
		<!-- Card -->
		<DemoCard title="Card" description="Container with header and footer">
			<div class="card-demo">
				<Card>
					{#snippet header()}
						<h3 class="card-header-title">Card Header</h3>
					{/snippet}

					{#snippet children()}
						<p>This is the card content area. It can contain any content.</p>
					{/snippet}

					{#snippet footer()}
						<span class="card-footer-text">Card Footer</span>
					{/snippet}
				</Card>
			</div>
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

		<!-- PageHeader -->
		<DemoCard title="Page Header" description="Page title and breadcrumbs">
			<div class="page-header-demo">
				<PageHeader
					title="Page Title"
					description="This is a page description that explains what this page is about."
					breadcrumbs={[
						{ label: 'Home', href: '/' },
						{ label: 'Showcases', href: '/showcases' },
						{ label: 'UI' }
					]}
				/>
			</div>
		</DemoCard>

		<!-- FormField -->
		<DemoCard title="Form Field" description="Input with label and error">
			<div class="form-field-demo">
				<FormField
					label="Username"
					description="Enter your username"
					required
				>
					{#snippet children()}
						<Input bind:value={inputValue} placeholder="Enter username" />
					{/snippet}
				</FormField>

				<FormField
					label="Email"
					error="Invalid email address"
					required
				>
					{#snippet children()}
						<Input placeholder="Enter email" error />
					{/snippet}
				</FormField>
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

	.card-demo,
	.tabs-demo,
	.page-header-demo,
	.form-field-demo {
		width: 100%;
	}

	.card-header-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.card-footer-text {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.page-header-demo {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	.form-field-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		max-width: 25rem;
	}
</style>
