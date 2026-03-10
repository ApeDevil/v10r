<script lang="ts">
import type { Snippet } from 'svelte';
import { ShowcaseLayout } from '$lib/components/composites';
import { getShowcaseTabs } from '../showcases';

let { children }: { children: Snippet } = $props();

const tabs = getShowcaseTabs('/showcases/forms');
</script>

<ShowcaseLayout
	title="Forms"
	description="Form validation patterns with Superforms v2 + Valibot v1."
	breadcrumbs={[
		{ label: 'Home', href: '/' },
		{ label: 'Showcases', href: '/showcases' },
		{ label: 'Forms' }
	]}
	{tabs}
	ariaLabel="Form sections"
	wrapperClass="forms-showcase"
>
	{@render children()}
</ShowcaseLayout>

<style>
	/* Shared form styles for all leaf pages */
	:global(.forms-showcase .form-grid) {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	:global(.forms-showcase .form-actions) {
		display: flex;
		justify-content: flex-end;
		padding-top: var(--spacing-2);
	}

	:global(.forms-showcase .form-textarea) {
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

	:global(.forms-showcase .form-textarea:focus) {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}
</style>
