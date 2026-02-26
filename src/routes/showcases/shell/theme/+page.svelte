<script lang="ts">
	import { getTheme } from '$lib/state/theme.svelte';
	import { Button } from '$lib/components/primitives';

	const theme = getTheme();
</script>

<svelte:head>
	<title>Theme - Shell - Showcases - Velociraptor</title>
</svelte:head>

<section class="demo-section">
	<h2>Theme State</h2>
	<dl class="state-list">
		<dt>Mode:</dt>
		<dd>{theme.mode}</dd>

		<dt>Resolved:</dt>
		<dd>{theme.resolvedMode}</dd>

		<dt>Is Dark:</dt>
		<dd>{theme.isDark ? 'Yes' : 'No'}</dd>
	</dl>

	<div class="button-group">
		<Button variant="secondary" onclick={() => theme.setMode('light')}>Light</Button>
		<Button variant="secondary" onclick={() => theme.setMode('dark')}>Dark</Button>
		<Button variant="secondary" onclick={() => theme.setMode('system')}>System</Button>
	</div>
</section>

<style>
	.demo-section {
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	.state-list {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-2) var(--spacing-4);
		margin-bottom: var(--spacing-4);
	}

	.state-list dt {
		font-weight: 600;
		color: var(--color-fg);
	}

	.state-list dd {
		color: var(--color-muted);
		margin: 0;
	}

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}
</style>
