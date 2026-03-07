<script lang="ts">
	import { getShortcutsByCategory, formatShortcut } from '$lib/shortcuts';

	const shortcuts = $derived(getShortcutsByCategory());
</script>

<svelte:head>
	<title>Shortcuts - Shell - Showcases - Velociraptor</title>
</svelte:head>

<section class="demo-section">
	<h2>Keyboard Shortcuts</h2>
	<p>
		Press <kbd>?</kbd> to view all keyboard shortcuts.
	</p>

	<div class="shortcuts-demo">
		{#if shortcuts.global.length > 0}
			<div class="shortcut-group">
				<h3>Global</h3>
				<div class="shortcut-list">
					{#each shortcuts.global as shortcut}
						<div class="shortcut-item">
							<span>{shortcut.description}</span>
							<kbd>{formatShortcut(shortcut.keys)}</kbd>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		{#if shortcuts.navigation.length > 0}
			<div class="shortcut-group">
				<h3>Navigation</h3>
				<div class="shortcut-list">
					{#each shortcuts.navigation as shortcut}
						<div class="shortcut-item">
							<span>{shortcut.description}</span>
							<kbd>{formatShortcut(shortcut.keys)}</kbd>
						</div>
					{/each}
				</div>
			</div>
		{/if}
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

	h3 {
		font-size: var(--text-fluid-lg);
		margin-top: var(--spacing-4);
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	kbd {
		display: inline-block;
		padding: var(--spacing-1) var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-family: ui-monospace, monospace;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		font-weight: 600;
		box-shadow: var(--shadow-sm);
	}

	.shortcuts-demo {
		display: grid;
		gap: var(--spacing-6);
	}

	.shortcut-group h3 {
		margin-top: 0;
	}

	.shortcut-list {
		display: grid;
		gap: var(--spacing-2);
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-4);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}
</style>
