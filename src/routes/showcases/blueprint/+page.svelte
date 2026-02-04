<script lang="ts">
	import { getModals } from '$lib/stores/modals.svelte';
	import { getToast } from '$lib/stores/toast.svelte';
	import { getSession } from '$lib/stores/session.svelte';
	import { getShortcutsByCategory, formatShortcut } from '$lib/shortcuts';
	import { PageHeader } from '$lib/components/composites';
	import {
		Skeleton,
		SkeletonText,
		SkeletonCard,
		SkeletonAvatar,
		EmptyState
	} from '$lib/components';
	import { Button } from '$lib/components/primitives';

	const modals = getModals();
	const toast = getToast();
	const session = getSession();

	// Get shortcuts grouped by category
	const shortcuts = $derived(getShortcutsByCategory());

	// Demo state for skeleton loading
	let showSkeletons = $state(false);

	// Session demo controls
	function simulateWarning() {
		// Set session to expire in 4 minutes
		const expiresAt = new Date(Date.now() + 4 * 60 * 1000);
		session.updateSession({
			expiresAt,
			user: { id: 'demo', email: 'demo@example.com', name: 'Demo User' }
		});
	}

	function simulateExpiry() {
		// Mark session as expired immediately
		session.markExpired();
		modals.open('sessionExpiry');
	}

	function resetSession() {
		// Reset to valid session (30 minutes)
		const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
		session.updateSession({
			expiresAt,
			user: { id: 'demo', email: 'demo@example.com', name: 'Demo User' }
		});
	}
</script>

<svelte:head>
	<title>App Shell Blueprint - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="App Shell Blueprint"
		description="Production-ready application shell with keyboard shortcuts, modals, toasts, and navigation."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases', href: '/showcases' },
			{ label: 'Blueprint' }
		]}
	>
		<Button onclick={() => toast.show('info', 'Header action button clicked!')}>
			Header Action
		</Button>
	</PageHeader>

	<!-- Phase Summary -->
	<section class="card">
		<h2>Implementation Status</h2>
		<div class="phase-list">
			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 0: Foundation</h3>
					<p>Theme system, CSS variables, layout structure</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 1: Sidebar Scaffold</h3>
					<p>Responsive sidebar with rail, drawer, and FAB modes</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 2: Modal System</h3>
					<p>Context-based modals with SSR safety</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 3: Toast System</h3>
					<p>Toast notifications with auto-dismiss and accessibility</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 4: Navigation</h3>
					<p>Progress bar, navigation items, dropdowns, user menu</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 5: Keyboard & Accessibility</h3>
					<p>Keyboard shortcuts, platform detection, help modal</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 6: Session Lifecycle</h3>
					<p>Session monitoring, expiry warnings, re-authentication modal</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon i-lucide-check"></span>
				<div>
					<h3>Phase 7: Composites & UI Primitives</h3>
					<p>PageHeader, Skeleton loaders, EmptyState components</p>
				</div>
			</div>
		</div>
	</section>

	<!-- Keyboard Shortcuts -->
	<section class="card">
		<h2>Keyboard Shortcuts</h2>
		<p class="card-subtitle">
			Press <kbd>?</kbd> to view all keyboard shortcuts, or try them below:
		</p>

		<div class="shortcuts-demo">
			{#if shortcuts.global.length > 0}
				<div class="shortcut-group">
					<h3>Global</h3>
					<div class="shortcut-list">
						{#each shortcuts.global as shortcut}
							<div class="shortcut-item">
								<div class="shortcut-desc">
									<strong>{shortcut.description}</strong>
								</div>
								<kbd class="shortcut-keys">{formatShortcut(shortcut.keys)}</kbd>
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
								<div class="shortcut-desc">
									<strong>{shortcut.description}</strong>
								</div>
								<kbd class="shortcut-keys">{formatShortcut(shortcut.keys)}</kbd>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	</section>

	<!-- Interactive Demos -->
	<section class="card">
		<h2>Interactive Demos</h2>
		<p class="card-subtitle">Test the app shell features:</p>

		<div class="demo-grid">
			<Button onclick={() => modals.open('shortcuts')}>Show Shortcuts Help</Button>

			<Button onclick={() => toast.show('success', 'Success! This is a toast notification.')}>
				Show Success Toast
			</Button>

			<Button onclick={() => toast.show('error', 'Error! Something went wrong.')}>
				Show Error Toast
			</Button>

			<Button onclick={() => toast.show('info', 'Info: This is informational.', 10000)}>
				Show Long Toast (10s)
			</Button>
		</div>
	</section>

	<!-- Session Lifecycle Demo -->
	<section class="card">
		<h2>Session Lifecycle Demo</h2>
		<p class="card-subtitle">Test session expiry warnings and re-authentication:</p>

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

		<div class="demo-grid">
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

	<!-- Features Overview -->
	<section class="card">
		<h2>Features</h2>

		<ul class="features-list">
			<li>
				<strong>Responsive Sidebar</strong> - Rail mode (desktop), drawer (tablet), FAB (mobile)
			</li>
			<li>
				<strong>Keyboard Shortcuts</strong> - Platform-aware shortcuts with sequence support (e.g., "g h")
			</li>
			<li>
				<strong>Modal System</strong> - Context-based, SSR-safe, mutually exclusive modals
			</li>
			<li>
				<strong>Toast Notifications</strong> - Auto-dismiss, pause on hover, accessibility support
			</li>
			<li>
				<strong>Navigation Progress</strong> - Visual feedback during page transitions
			</li>
			<li>
				<strong>Theme System</strong> - CSS custom properties with system/light/dark modes
			</li>
			<li>
				<strong>Skip Links</strong> - Keyboard navigation accessibility
			</li>
			<li>
				<strong>ARIA Labels</strong> - Screen reader support throughout
			</li>
			<li>
				<strong>Session Lifecycle</strong> - Automatic expiry warnings, re-authentication modal, session extension
			</li>
			<li>
				<strong>PageHeader Component</strong> - Per-page headers with breadcrumbs and action slots
			</li>
			<li>
				<strong>Skeleton Loaders</strong> - Shimmer animations for loading states (CSS-only)
			</li>
			<li>
				<strong>Empty States</strong> - Centered layouts for no-data scenarios
			</li>
		</ul>
	</section>

	<!-- UI Primitives Demo -->
	<section class="card">
		<h2>UI Primitives Demo</h2>
		<p class="card-subtitle">
			Reusable UI components for common patterns:
		</p>

		<div class="primitives-demo">
			<div class="demo-section">
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

						<div class="skeleton-group wide">
							<h4>Skeleton Card</h4>
							<div class="card-grid">
								<SkeletonCard hasImage={true} hasTitle={true} hasDescription={true} />
								<SkeletonCard hasImage={false} hasTitle={true} hasDescription={true} />
								<SkeletonCard hasImage={true} hasTitle={true} hasDescription={false} />
							</div>
						</div>
					</div>
				{/if}
			</div>

			<div class="demo-section">
				<h3>Empty States</h3>
				<EmptyState
					icon="i-lucide-inbox"
					title="No items found"
					description="Get started by creating your first item. It only takes a few seconds."
				>
					<Button>Create Item</Button>
					<Button variant="secondary">Learn More</Button>
				</EmptyState>
			</div>

			<div class="demo-section">
				<h3>PageHeader</h3>
				<p class="demo-note">
					See the page header at the top of this page with breadcrumbs and action buttons.
					PageHeader components are used for per-page headers (not the global app header).
				</p>
			</div>
		</div>
	</section>

	<!-- Technical Details -->
	<section class="card">
		<h2>Technical Implementation</h2>

		<div class="tech-details">
			<div class="tech-item">
				<h3>Svelte 5 Runes</h3>
				<p>Uses <code>$state</code>, <code>$derived</code>, and <code>$effect</code> for reactive state management.</p>
			</div>

			<div class="tech-item">
				<h3>SSR-Safe Context</h3>
				<p>All stores use Svelte context for request-scoped state, avoiding SSR leaks.</p>
			</div>

			<div class="tech-item">
				<h3>Platform Detection</h3>
				<p>Shortcuts adapt to macOS (⌘) vs other platforms (Ctrl).</p>
			</div>

			<div class="tech-item">
				<h3>Progressive Enhancement</h3>
				<p>Core functionality works without JavaScript, enhanced when available.</p>
			</div>
		</div>
	</section>
</div>

<style>
	.page {
		max-width: var(--layout-max-width);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	.card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-7);
		margin-bottom: var(--spacing-7);
	}

	.card h2 {
		font-size: var(--text-fluid-xl);
		margin: 0 0 var(--spacing-4) 0;
		color: var(--color-fg);
	}

	.card-subtitle {
		color: var(--color-muted);
		margin-bottom: var(--spacing-6);
	}

	.phase-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.phase-item {
		display: flex;
		gap: var(--spacing-4);
		align-items: flex-start;
	}

	.phase-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: var(--spacing-7);
		height: var(--spacing-7);
		border-radius: var(--radius-full);
		background: var(--color-success);
		color: var(--color-bg);
		flex-shrink: 0;
		font-weight: bold;
	}

	.phase-item h3 {
		margin: 0 0 var(--spacing-1) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-fg);
	}

	.phase-item p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.shortcuts-demo {
		display: grid;
		gap: var(--spacing-7);
	}

	.shortcut-group h3 {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 var(--spacing-3) 0;
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

	.shortcut-desc {
		flex: 1;
	}

	kbd {
		display: inline-block;
		padding: var(--spacing-1) var(--spacing-2);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-sm);
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow-sm);
		color: var(--color-fg);
		white-space: nowrap;
	}

	.shortcut-keys {
		font-weight: 600;
	}

	.demo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--spacing-4);
	}


	.session-info {
		background: var(--color-subtle);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		margin-bottom: var(--spacing-6);
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

	.session-notes li {
		margin-bottom: var(--spacing-2);
	}

	.session-notes code {
		background: var(--color-bg);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-family: ui-monospace, monospace;
		color: var(--color-primary);
	}

	.features-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: var(--spacing-3);
	}

	.features-list li {
		padding-left: var(--spacing-6);
		position: relative;
	}

	.features-list li::before {
		content: '';
		position: absolute;
		left: 0;
		width: 1em;
		height: 1em;
		background-color: var(--color-success);
		-webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
		mask-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 6 9 17l-5-5'/%3E%3C/svg%3E");
	}

	.tech-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: var(--spacing-6);
	}

	.tech-item h3 {
		font-size: var(--text-fluid-base);
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.tech-item p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.tech-item code {
		background: var(--color-subtle);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
		font-size: 0.875em;
		font-family: ui-monospace, monospace;
	}

	.primitives-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	.demo-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.demo-section h3 {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.demo-note {
		background: var(--color-info-light);
		border-left: 3px solid var(--color-info);
		padding: var(--spacing-4);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		margin: 0;
	}

	.skeleton-examples {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
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

	.skeleton-group.wide {
		grid-column: 1 / -1;
	}

	.skeleton-group h4 {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0;
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
		.card {
			padding: var(--spacing-6);
		}

		.demo-grid {
			grid-template-columns: 1fr;
		}

		.tech-details {
			grid-template-columns: 1fr;
		}

		.card-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
