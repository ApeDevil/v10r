<script lang="ts">
	import { getSession } from '$lib/state/session.svelte';
	import { getModals } from '$lib/state/modals.svelte';
	import { Button } from '$lib/components/primitives';

	const session = getSession();
	const modals = getModals();

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
	<title>Session - Shell - Showcases - Velociraptor</title>
</svelte:head>

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

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

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

	.status-valid { color: var(--color-success); }
	.status-warning { color: var(--color-warning); }
	.status-expired { color: var(--color-error); }
	.status-revoked { color: var(--color-muted); }

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
</style>
