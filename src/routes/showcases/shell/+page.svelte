<script lang="ts">
	import { getSidebar } from '$lib/stores/sidebar.svelte';
	import { getTheme } from '$lib/stores/theme.svelte';
	import { getToast } from '$lib/stores/toast.svelte';
	import { getModals } from '$lib/stores/modals.svelte';
	import { getSession } from '$lib/stores/session.svelte';
	import { getShortcutsByCategory, formatShortcut } from '$lib/shortcuts';
	import { Button } from '$lib/components/primitives';
	import { PageHeader } from '$lib/components/composites';
	import {
		Skeleton,
		SkeletonText,
		SkeletonCard,
		SkeletonAvatar,
		EmptyState
	} from '$lib/components';

	const sidebar = getSidebar();
	const theme = getTheme();
	const toast = getToast();
	const modals = getModals();
	const session = getSession();

	// Get shortcuts grouped by category
	const shortcuts = $derived(getShortcutsByCategory());

	// Demo state for skeleton loading
	let showSkeletons = $state(false);

	// Session demo controls
	function simulateWarning() {
		const expiresAt = new Date(Date.now() + 4 * 60 * 1000);
		session.updateSession({
			expiresAt,
			user: { id: 'demo', email: 'demo@example.com', name: 'Demo User' }
		});
	}

	function simulateExpiry() {
		session.markExpired();
		modals.open('sessionExpiry');
	}

	function resetSession() {
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
		session.updateSession({
			expiresAt,
			user: { id: 'demo', email: 'demo@example.com', name: 'Demo User' }
		});
	}
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
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Shell' }
		]}
	/>

	<!-- Sidebar State -->
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

	<!-- Theme State -->
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

	<!-- Toast Notifications -->
	<section class="demo-section">
		<h2>Toast Notifications</h2>
		<p>
			Toast notifications appear in the top-right (desktop) or top-center (mobile). They auto-dismiss
			after a duration based on type.
		</p>

		<div class="button-group">
			<Button variant="secondary" onclick={() => toast.success('Operation completed successfully!')}>
				Success
			</Button>
			<Button variant="secondary" onclick={() => toast.error('Something went wrong. Please try again.')}>
				Error
			</Button>
			<Button variant="secondary" onclick={() => toast.warning('This action cannot be undone.')}>
				Warning
			</Button>
			<Button variant="secondary" onclick={() => toast.info('New updates are available.')}>
				Info
			</Button>
		</div>

		<div class="button-group" style="margin-top: var(--spacing-3);">
			<Button
				variant="secondary"
				onclick={() => {
					toast.success('First toast');
					setTimeout(() => toast.info('Second toast'), 300);
					setTimeout(() => toast.warning('Third toast'), 600);
					setTimeout(() => toast.error('Fourth toast'), 900);
					setTimeout(() => toast.success('Fifth toast'), 1200);
				}}
			>
				Show Multiple Toasts (max 5)
			</Button>
		</div>

		{#if toast.items.length > 0}
			<div class="toast-preview">
				<h3>Active Toasts:</h3>
				<ul class="toast-list">
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

	<!-- Modal Triggers -->
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
			<Button variant="secondary" onclick={() => modals.open('shortcuts')}>
				Show Shortcuts Help
			</Button>
		</div>

		<dl class="state-list" style="margin-top: var(--spacing-4);">
			<dt>Active Modal:</dt>
			<dd>{modals.active || 'None'}</dd>
		</dl>
	</section>

	<!-- Keyboard Shortcuts -->
	<section class="demo-section">
		<h2>Keyboard Shortcuts</h2>
		<p>
			Press <kbd>?</kbd> to view all keyboard shortcuts. Platform-aware shortcuts adapt to macOS (⌘) vs other platforms (Ctrl).
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

	<!-- Session Lifecycle -->
	<section class="demo-section">
		<h2>Session Lifecycle</h2>
		<p>Test session expiry warnings and re-authentication:</p>

		<div class="session-info">
			<div class="info-row">
				<span class="info-label">Status:</span>
				<span class="info-value status-{session.status}">{session.status.toUpperCase()}</span>
			</div>
			<div class="info-row">
				<span class="info-label">Time Remaining:</span>
				<span class="info-value">{Math.floor(session.timeRemaining / 60)}m {session.timeRemaining % 60}s</span>
			</div>
		</div>

		<div class="button-group">
			<Button variant="secondary" onclick={simulateWarning}>
				Simulate Warning (4 min)
			</Button>
			<Button
				variant="default"
				class="bg-warning text-white hover:bg-warning/90"
				onclick={simulateExpiry}
			>
				Simulate Expiry
			</Button>
			<Button
				variant="default"
				class="bg-success text-white hover:bg-success/90"
				onclick={resetSession}
			>
				Reset to Valid
			</Button>
		</div>

		<div class="session-notes">
			<h3>Test Instructions:</h3>
			<ol>
				<li><strong>Warning State:</strong> Click "Simulate Warning" to show the expiry banner (appears when &lt;5 min remain)</li>
				<li><strong>Expired State:</strong> Click "Simulate Expiry" to show the re-authentication modal</li>
				<li><strong>OTP Verification:</strong> In the modal, use code <code>123456</code> to restore session</li>
				<li><strong>Reset:</strong> Click "Reset to Valid" to restore a 30-minute session</li>
			</ol>
		</div>
	</section>

	<!-- UI Primitives -->
	<section class="demo-section">
		<h2>UI Primitives</h2>
		<p>Reusable UI components for common patterns:</p>

		<div class="primitives-demo">
			<div class="primitive-section">
				<h3>Skeleton Loaders</h3>
				<Button variant="secondary" onclick={() => showSkeletons = !showSkeletons}>
					{showSkeletons ? 'Hide' : 'Show'} Skeletons
				</Button>

				{#if showSkeletons}
					<div class="skeleton-examples">
						<div class="skeleton-group">
							<h4>Basic Skeleton</h4>
							<Skeleton height="2rem" width="100%" />
							<Skeleton height="1rem" width="80%" />
							<Skeleton height="1rem" width="60%" />
						</div>

						<div class="skeleton-group">
							<h4>Skeleton Text</h4>
							<SkeletonText lines={4} />
						</div>

						<div class="skeleton-group">
							<h4>Skeleton Avatar</h4>
							<div class="avatar-row">
								<SkeletonAvatar size="sm" />
								<SkeletonAvatar size="md" />
								<SkeletonAvatar size="lg" />
							</div>
						</div>

						<div class="skeleton-group">
							<h4>Skeleton Card</h4>
							<div class="card-grid">
								<SkeletonCard hasImage={true} hasTitle={true} hasDescription={true} />
								<SkeletonCard hasImage={false} hasTitle={true} hasDescription={true} />
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="primitive-section">
				<h3>Empty States</h3>
				<EmptyState
					icon="i-lucide-inbox"
					title="No items found"
					description="Get started by creating your first item."
				>
					<Button>Create Item</Button>
					<Button variant="secondary">Learn More</Button>
				</EmptyState>
			</div>
		</div>
	</section>

	<!-- Responsive Breakpoints -->
	<section class="demo-section">
		<h2>Responsive Breakpoints</h2>
		<p>Resize the browser window to see the sidebar behavior change:</p>
		<ul>
			<li><strong>Mobile (&lt;768px):</strong> Drawer + FAB (bottom-right)</li>
			<li><strong>Tablet (768-1023px):</strong> Rail with click-to-expand</li>
			<li><strong>Desktop (1024px+):</strong> Rail with hover-to-expand</li>
		</ul>
	</section>

	<!-- Navigation Components -->
	<section class="demo-section">
		<h2>Navigation Components</h2>
		<p>
			The sidebar includes enhanced navigation with dropdowns and user menu:
		</p>
		<ul>
			<li><strong>NavItem</strong> - Compound button with main navigation + optional dropdown</li>
			<li><strong>NavDropdown</strong> - Keyboard-navigable submenu for child pages</li>
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
		margin-bottom: var(--spacing-2);
		color: var(--color-fg);
	}

	h4 {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-2) 0;
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
		background: var(--color-subtle);
		border-radius: var(--radius-md);
	}

	.toast-list {
		list-style: none;
		margin: var(--spacing-2) 0 0 0;
		padding: 0;
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
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		margin-top: var(--spacing-4);
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

	/* Shortcuts */
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

	/* Session */
	.session-info {
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		margin-bottom: var(--spacing-4);
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) 0;
	}

	.info-label {
		font-weight: 500;
		color: var(--color-muted);
	}

	.info-value {
		font-weight: 600;
		font-family: ui-monospace, monospace;
	}

	.status-valid {
		color: var(--color-success);
	}

	.status-warning {
		color: var(--color-warning);
	}

	.status-expired {
		color: var(--color-error);
	}

	.status-revoked {
		color: var(--color-muted);
	}

	.session-notes {
		margin-top: var(--spacing-6);
		padding: var(--spacing-4);
		background: var(--color-info-light);
		border-left: 3px solid var(--color-info);
		border-radius: var(--radius-sm);
	}

	.session-notes h3 {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-info);
	}

	.session-notes ol {
		margin: 0;
		padding-left: var(--spacing-5);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		line-height: 1.6;
	}

	.session-notes code {
		background: var(--color-bg);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-family: ui-monospace, monospace;
		color: var(--color-primary);
	}

	/* Primitives */
	.primitives-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.primitive-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.primitive-section h3 {
		margin: 0;
	}

	.skeleton-examples {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		margin-top: var(--spacing-4);
		padding: var(--spacing-6);
		background: var(--color-subtle);
		border-radius: var(--radius-lg);
	}

	.skeleton-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.avatar-row {
		display: flex;
		gap: var(--spacing-4);
		align-items: center;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-4);
	}

	@media (max-width: 640px) {
		.card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
