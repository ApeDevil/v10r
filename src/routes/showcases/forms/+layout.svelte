<script lang="ts">
	import type { Snippet } from 'svelte';
	import { PageContainer } from '$lib/components/layout';
	import { PageHeader, TabNav } from '$lib/components/composites';

	let { children }: { children: Snippet } = $props();

	const tabs = [
		{ label: 'Basics', href: '/showcases/forms/basics' },
		{ label: 'Validation', href: '/showcases/forms/validation' },
		{ label: 'Patterns', href: '/showcases/forms/patterns' },
		{ label: 'Advanced', href: '/showcases/forms/advanced' },
	];
</script>

<PageContainer class="py-7">
	<PageHeader
		title="Forms"
		description="Form validation patterns with Superforms v2 + Valibot v1."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Forms' }
		]}
	/>

	<TabNav {tabs} ariaLabel="Form sections" />

	<div class="pt-6 forms-showcase">
		{@render children()}
	</div>
</PageContainer>

<style>
	/* Shared form styles for all leaf pages */
	.forms-showcase :global(.form-grid) {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.forms-showcase :global(.form-actions) {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}

	.forms-showcase :global(.form-textarea) {
		width: 100%;
		min-height: 6rem;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-input-bg);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		font-family: inherit;
		resize: vertical;
	}

	.forms-showcase :global(.form-textarea:focus) {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}
</style>
