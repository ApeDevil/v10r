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
	} from '$lib/components/ui';
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
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 0: Foundation</h3>
					<p>Theme system, CSS variables, layout structure</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 1: Sidebar Scaffold</h3>
					<p>Responsive sidebar with rail, drawer, and FAB modes</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 2: Modal System</h3>
					<p>Context-based modals with SSR safety</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 3: Toast System</h3>
					<p>Toast notifications with auto-dismiss and accessibility</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 4: Navigation</h3>
					<p>Progress bar, navigation items, dropdowns, user menu</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 5: Keyboard & Accessibility</h3>
					<p>Keyboard shortcuts, platform detection, help modal</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
				<div>
					<h3>Phase 6: Session Lifecycle</h3>
					<p>Session monitoring, expiry warnings, re-authentication modal</p>
				</div>
			</div>

			<div class="phase-item completed">
				<span class="phase-icon">✓</span>
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
					icon="📭"
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
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.card {
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		padding: 2rem;
		margin-bottom: 2rem;
	}

	.card h2 {
		font-size: 1.5rem;
		margin: 0 0 1rem 0;
		color: var(--color-fg);
	}

	.card-subtitle {
		color: var(--color-muted);
		margin-bottom: 1.5rem;
	}

	.phase-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.phase-item {
		display: flex;
		gap: 1rem;
		align-items: flex-start;
	}

	.phase-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		background: var(--color-success, #10b981);
		color: white;
		flex-shrink: 0;
		font-weight: bold;
	}

	.phase-item h3 {
		margin: 0 0 0.25rem 0;
		font-size: 1rem;
		color: var(--color-fg);
	}

	.phase-item p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
	}

	.shortcuts-demo {
		display: grid;
		gap: 2rem;
	}

	.shortcut-group h3 {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0 0 0.75rem 0;
	}

	.shortcut-list {
		display: grid;
		gap: 0.5rem;
	}

	.shortcut-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem;
		background: var(--color-bg-secondary, #f9fafb);
		border-radius: 0.375rem;
	}

	.shortcut-desc {
		flex: 1;
	}

	kbd {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		font-family: ui-monospace, monospace;
		font-size: 0.875rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.25rem;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
		color: var(--color-fg);
		white-space: nowrap;
	}

	.shortcut-keys {
		font-weight: 600;
	}

	.demo-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
	}


	.session-info {
		background: var(--color-bg-secondary, #f9fafb);
		border-radius: 0.375rem;
		padding: 1rem;
		margin-bottom: 1.5rem;
	}

	.info-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.5rem 0;
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
		color: #10b981;
	}

	.status-warning {
		color: #f59e0b;
	}

	.status-expired {
		color: #dc2626;
	}

	.status-revoked {
		color: #6b7280;
	}

	.session-notes {
		margin-top: 1.5rem;
		padding: 1rem;
		background: #eff6ff;
		border-left: 3px solid #3b82f6;
		border-radius: 0.25rem;
	}

	.session-notes h3 {
		margin: 0 0 0.75rem 0;
		font-size: 0.875rem;
		font-weight: 600;
		color: #1e40af;
	}

	.session-notes ol {
		margin: 0;
		padding-left: 1.25rem;
		font-size: 0.875rem;
		color: #1e3a8a;
		line-height: 1.6;
	}

	.session-notes li {
		margin-bottom: 0.5rem;
	}

	.session-notes code {
		background: white;
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-family: ui-monospace, monospace;
		color: #7c3aed;
	}

	.features-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.75rem;
	}

	.features-list li {
		padding-left: 1.5rem;
		position: relative;
	}

	.features-list li::before {
		content: '✓';
		position: absolute;
		left: 0;
		color: var(--color-success, #10b981);
		font-weight: bold;
	}

	.tech-details {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1.5rem;
	}

	.tech-item h3 {
		font-size: 1rem;
		margin: 0 0 0.5rem 0;
		color: var(--color-fg);
	}

	.tech-item p {
		margin: 0;
		font-size: 0.875rem;
		color: var(--color-muted);
		line-height: 1.6;
	}

	.tech-item code {
		background: var(--color-bg-secondary, #f3f4f6);
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.875em;
		font-family: ui-monospace, monospace;
	}

	.primitives-demo {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.demo-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.demo-section h3 {
		font-size: 1.125rem;
		font-weight: 600;
		margin: 0;
		color: var(--color-fg);
	}

	.demo-note {
		background: #eff6ff;
		border-left: 3px solid #3b82f6;
		padding: 1rem;
		border-radius: 0.25rem;
		font-size: 0.875rem;
		color: #1e3a8a;
		margin: 0;
	}

	.skeleton-examples {
		display: flex;
		flex-direction: column;
		gap: 2rem;
		margin-top: 1rem;
		padding: 1.5rem;
		background: var(--color-bg-secondary, #f9fafb);
		border-radius: 0.5rem;
	}

	.skeleton-group {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.skeleton-group.wide {
		grid-column: 1 / -1;
	}

	.skeleton-group h4 {
		font-size: 0.875rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--color-muted);
		margin: 0;
	}

	.avatar-row {
		display: flex;
		gap: 1rem;
		align-items: center;
	}

	.card-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
		gap: 1rem;
	}

	@media (max-width: 640px) {
		.card {
			padding: 1.5rem;
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
