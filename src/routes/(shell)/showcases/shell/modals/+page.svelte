<script lang="ts">
import { Button } from '$lib/components/primitives';
import { getModals } from '$lib/state/modals.svelte';

const modals = getModals();
</script>
<section class="demo-section">
	<h2>Modal Triggers</h2>
	<p>
		Try the keyboard shortcuts or click the triggers in the sidebar:
	</p>
	<ul>
		<li><kbd>Ctrl+K</kbd> - Quick Search</li>
		<li><kbd>Ctrl+J</kbd> - AI Assistant</li>
	</ul>

	<div class="button-group">
		<Button variant="secondary" onclick={() => modals.open('quickSearch')}>
			Open Quick Search
		</Button>
		<Button variant="secondary" onclick={() => modals.open('aiAssistant')}>
			Open AI Assistant
		</Button>
		<Button variant="secondary" onclick={() => modals.open('shortcuts')}>
			Show Shortcuts Help
		</Button>
	</div>

	<dl class="state-list" style="margin-top: var(--spacing-4);">
		<dt>Active Modal:</dt>
		<dd>{modals.active || 'None'}</dd>
	</dl>
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

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	ul {
		margin-left: var(--spacing-6);
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	li {
		margin-bottom: var(--spacing-2);
	}

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.state-list {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: var(--spacing-2) var(--spacing-4);
	}

	.state-list dt {
		font-weight: 600;
		color: var(--color-fg);
	}

	.state-list dd {
		color: var(--color-muted);
		margin: 0;
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
</style>
