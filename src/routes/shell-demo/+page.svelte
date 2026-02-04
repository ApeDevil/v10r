<script lang="ts">
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { getTheme } from '$lib/stores/theme.svelte';
	import { getToast } from '$lib/stores/toast.svelte';
	import { getModals } from '$lib/stores/modals.svelte';
	import { Button } from '$lib/components/primitives';
	import { PageHeader } from '$lib/components/composites';

	const sidebar = getSidebar();
	const theme = getTheme();
	const toast = getToast();
	const modals = getModals();
</script>

<svelte:head>
	<title>Shell Demo - Velociraptor</title>
</svelte:head>

<div class="demo-page">
	<PageHeader
		title="App Shell Demo"
		description="Interactive demonstration of the app shell components and state management."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Shell Demo' }
		]}
	/>

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

	<section class="demo-section">
		<h2>Toast Notifications</h2>
		<div class="button-group">
			<Button variant="secondary" onclick={() => toast.success('Success!')}>Success</Button>
			<Button variant="secondary" onclick={() => toast.error('Error!')}>Error</Button>
			<Button variant="secondary" onclick={() => toast.warning('Warning!')}>Warning</Button>
			<Button variant="secondary" onclick={() => toast.info('Info!')}>Info</Button>
		</div>

		{#if toast.items.length > 0}
			<div class="toast-preview">
				<h3>Active Toasts:</h3>
				<ul>
					{#each toast.items as t}
						<li class="toast-item toast-{t.type}">
							{t.message}
							<Button
								variant="ghost"
								size="icon"
								class="bg-transparent border-none text-white text-xl p-0 w-6 h-6 hover:bg-white/20"
								onclick={() => toast.remove(t.id)}
							>
								×
							</Button>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
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
		<h2>Modal Triggers</h2>
		<p>
			Try the keyboard shortcuts or click the triggers in the sidebar:
		</p>
		<ul>
			<li><kbd>⌘K</kbd> or <kbd>Ctrl+K</kbd> - Quick Search</li>
			<li><kbd>⌘J</kbd> or <kbd>Ctrl+J</kbd> - AI Assistant</li>
		</ul>

		<div class="button-group">
			<Button variant="secondary" onclick={() => modals.open('quickSearch')}>
				Open Quick Search
			</Button>
			<Button variant="secondary" onclick={() => modals.open('aiAssistant')}>
				Open AI Assistant
			</Button>
		</div>

		<dl class="state-list">
			<dt>Active Modal:</dt>
			<dd>{modals.active || 'None'}</dd>
		</dl>
	</section>

	<section class="demo-section">
		<h2>Navigation Components</h2>
		<p>
			The sidebar now includes enhanced navigation with dropdowns and user menu:
		</p>
		<ul>
			<li><strong>NavItem</strong> - Compound button with main navigation + optional dropdown</li>
			<li><strong>NavDropdown</strong> - Keyboard-navigable submenu for child pages</li>
			<li><strong>UserMenu</strong> - Avatar dropdown with profile, settings, theme, and sign out</li>
		</ul>

		<h3>Navigation Structure</h3>
		<ul>
			<li><strong>Home</strong> - No children</li>
			<li><strong>Shell Demo</strong> - No children</li>
			<li>
				<strong>Showcases</strong> - Dropdown with:
				<ul>
					<li>Forms (placeholder)</li>
					<li>3D (placeholder)</li>
					<li>Auth (placeholder)</li>
				</ul>
			</li>
			<li>
				<strong>Docs</strong> - Dropdown with:
				<ul>
					<li>Stack (placeholder)</li>
					<li>Blueprint (placeholder)</li>
				</ul>
			</li>
		</ul>

		<h3>Features</h3>
		<ul>
			<li><strong>Active state detection:</strong> Highlights current page and parent nav items</li>
			<li>
				<strong>Compound button:</strong> Main area navigates, chevron toggles dropdown (expanded
				mode only)
			</li>
			<li>
				<strong>Keyboard navigation:</strong> Arrow keys, Enter to select, Escape to close
			</li>
			<li><strong>Click outside to close:</strong> Dropdown auto-closes</li>
			<li><strong>Smooth animations:</strong> Respects prefers-reduced-motion</li>
		</ul>

		<h3>User Menu Features</h3>
		<ul>
			<li><strong>Profile & Settings:</strong> Quick access links</li>
			<li><strong>Theme submenu:</strong> Light, Dark, System modes</li>
			<li><strong>Sign out:</strong> Action button (red on hover)</li>
			<li><strong>Responsive:</strong> Shows avatar only in rail mode, full info when expanded</li>
		</ul>

		<p class="note">
			Try expanding the sidebar (hover on desktop, click on tablet) to see the navigation dropdowns
			and user menu. The chevron rotates 90° when open. Navigate to different pages to see the
			active state tracking.
		</p>
	</section>

	<section class="demo-section">
		<h2>Toast Variants</h2>
		<p>
			Toast notifications appear in the top-right (desktop) or top-center (mobile). They auto-dismiss
			after a duration based on type:
		</p>
		<ul>
			<li><strong>Success:</strong> 5 seconds</li>
			<li><strong>Error:</strong> 8 seconds</li>
			<li><strong>Warning:</strong> 6 seconds</li>
			<li><strong>Info:</strong> 5 seconds</li>
		</ul>

		<div class="button-group">
			<Button variant="secondary" onclick={() => toast.success('Operation completed successfully!')}>
				Show Success
			</Button>
			<Button variant="secondary" onclick={() => toast.error('Something went wrong. Please try again.')}>
				Show Error
			</Button>
			<Button variant="secondary" onclick={() => toast.warning('This action cannot be undone.')}>
				Show Warning
			</Button>
			<Button variant="secondary" onclick={() => toast.info('New updates are available.')}>
				Show Info
			</Button>
		</div>

		<div class="button-group">
			<Button
				variant="secondary"
				onclick={() => {
					toast.success('First toast');
					setTimeout(() => toast.info('Second toast'), 300);
					setTimeout(() => toast.warning('Third toast'), 600);
					setTimeout(() => toast.error('Fourth toast'), 900);
					setTimeout(() => toast.success('Fifth toast'), 1200);
					setTimeout(() => toast.info('Sixth toast (hidden - max 5)'), 1500);
				}}
			>
				Show Multiple Toasts (max 5 visible)
			</Button>
		</div>
	</section>
</div>

<style>
	.demo-page {
		max-width: var(--layout-narrow-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	h3 {
		font-size: var(--text-fluid-lg);
		margin-top: var(--spacing-4);
		color: var(--color-fg);
	}

	.demo-section {
		margin-bottom: var(--spacing-8);
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
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

	.toast-preview {
		margin-top: var(--spacing-4);
		padding: var(--spacing-4);
		background: var(--color-border);
		border-radius: var(--radius-md);
	}

	.toast-preview ul {
		list-style: none;
		margin-top: var(--spacing-2);
	}

	.toast-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		margin-bottom: var(--spacing-2);
		border-radius: var(--radius-md);
		color: var(--color-bg);
	}

	.toast-success {
		background: var(--color-success);
	}
	.toast-error {
		background: var(--color-error);
	}
	.toast-warning {
		background: var(--color-warning);
	}
	.toast-info {
		background: var(--color-primary);
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
		background: var(--color-border);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-4);
	}

	kbd {
		display: inline-block;
		padding: var(--spacing-1) var(--spacing-2);
		font-size: var(--text-fluid-xs);
		font-family: ui-monospace, monospace;
		background: var(--color-border);
		border: 1px solid var(--color-muted);
		border-radius: var(--radius-sm);
		font-weight: 600;
	}
</style>
