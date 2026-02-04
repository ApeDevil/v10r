<script lang="ts">
	import DemoCard from './shared/DemoCard.svelte';
	import VariantGrid from './shared/VariantGrid.svelte';
	import { Button, DropdownMenu } from '$lib/components';
</script>

<section id="actions" class="section">
	<h2 class="section-title">Actions</h2>
	<p class="section-description">Interactive elements that trigger actions.</p>

	<div class="demos">
		<!-- Button Variants -->
		<DemoCard title="Button Variants" description="Different visual styles">
			<VariantGrid layout="row">
				<Button variant="default">Default</Button>
				<Button variant="secondary">Secondary</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
				<Button variant="destructive">Destructive</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Button Sizes -->
		<DemoCard title="Button Sizes" description="Different dimensions">
			<VariantGrid layout="row">
				<Button size="sm">Small</Button>
				<Button size="md">Medium</Button>
				<Button size="lg">Large</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Button States -->
		<DemoCard title="Button States" description="Disabled state">
			<VariantGrid layout="row">
				<Button disabled>Disabled</Button>
				<Button variant="secondary" disabled>Secondary Disabled</Button>
				<Button variant="destructive" disabled>Destructive Disabled</Button>
			</VariantGrid>
		</DemoCard>

		<!-- Dropdown Menu -->
		<DemoCard title="Dropdown Menu" description="Menu with actions">
			<DropdownMenu
				items={[
					{ label: 'Profile', icon: 'i-lucide-user' },
					{ label: 'Settings', icon: 'i-lucide-settings' },
					{ separator: true },
					{ label: 'Logout', icon: 'i-lucide-log-out' }
				]}
			>
				{#snippet trigger({ props })}
					<Button variant="outline" {...props}>
						Open Menu
						<span class="i-lucide-chevron-down h-4 w-4 ml-1" />
					</Button>
				{/snippet}
			</DropdownMenu>
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
</style>
