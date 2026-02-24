<script lang="ts">
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { Button } from '$lib/components/primitives';

	const sidebar = getSidebar();
</script>

<svelte:head>
	<title>Sidebar - Shell - Showcases - Velociraptor</title>
</svelte:head>

<section class="demo-section">
	<h2>Sidebar State</h2>
	<dl class="state-list">
		<dt>Expanded:</dt>
		<dd>{sidebar.expanded ? 'Yes' : 'No'}</dd>

		<dt>Pinned:</dt>
		<dd>{sidebar.pinned ? 'Yes' : 'No'}</dd>

		<dt>Mobile Open:</dt>
		<dd>{sidebar.mobileOpen ? 'Yes' : 'No'}</dd>
	</dl>

	<div class="button-group">
		<Button variant="secondary" onclick={() => sidebar.expand()}>Expand</Button>
		<Button variant="secondary" onclick={() => sidebar.collapse()}>Collapse</Button>
		<Button variant="secondary" onclick={() => sidebar.togglePin()}>Toggle Pin</Button>
	</div>
</section>

<section class="demo-section">
	<h2>Responsive Breakpoints</h2>
	<p>Resize the browser window to see the sidebar behavior change:</p>
	<ul>
		<li><strong>Mobile (&lt;768px):</strong> Drawer + FAB (bottom-right)</li>
		<li><strong>Tablet (768-1023px):</strong> Rail with click-to-expand</li>
		<li><strong>Desktop (1024px+):</strong> Rail with hover-to-expand</li>
	</ul>
</section>

<section class="demo-section">
	<h2>Navigation Components</h2>
	<p>
		The sidebar includes enhanced navigation with dropdowns and user menu:
	</p>
	<ul>
		<li><strong>NavItem</strong> - Compound button with main navigation + optional dropdown</li>
		<li><strong>NavAccordion</strong> - Keyboard-navigable inline accordion submenu for child pages (mobile)</li>
		<li><strong>UserMenu</strong> - Avatar dropdown with profile, settings, theme, and sign out</li>
	</ul>

	<h3>Features</h3>
	<ul>
		<li><strong>Active state detection:</strong> Highlights current page and parent nav items</li>
		<li><strong>Compound button:</strong> Main area navigates, chevron toggles dropdown</li>
		<li><strong>Keyboard navigation:</strong> Arrow keys, Enter to select, Escape to close</li>
		<li><strong>Click outside to close:</strong> Dropdown auto-closes</li>
		<li><strong>Smooth animations:</strong> Respects prefers-reduced-motion</li>
	</ul>

	<p class="note">
		Try expanding the sidebar (hover on desktop, click on tablet) to see the navigation dropdowns
		and user menu. The chevron rotates 90° when open.
	</p>
</section>

<style>
	.demo-section {
		margin-bottom: var(--spacing-8);
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

	ul {
		margin-left: var(--spacing-6);
		color: var(--color-muted);
	}

	li {
		margin-bottom: var(--spacing-2);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
	}

	.note {
		font-style: italic;
		font-size: var(--text-fluid-sm);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-4);
	}
</style>
