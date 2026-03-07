<script lang="ts">
	import { goto } from '$app/navigation';
	import { enhance } from '$app/forms';
	import { authClient } from '$lib/auth-client';
	import { Card, Alert } from '$lib/components/composites';
	import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
	import { Stack, Cluster } from '$lib/components/layout';

	let { data } = $props();

	let testing = $state(false);

	// Sign-in form state
	let email = $state('');
	let sendingMethod = $state<'magic-link' | 'otp' | null>(null);
	let loadingProvider = $state<string | null>(null);
	let signingOut = $state(false);
	let formError = $state<string | null>(null);
	let magicLinkSent = $state(false);

	let isBusy = $derived(!!sendingMethod || !!loadingProvider || signingOut);

	async function handleMagicLink() {
		if (!email.trim()) return;
		sendingMethod = 'magic-link';
		formError = null;

		try {
			const result = await authClient.signIn.magicLink({
				email: email.trim(),
				callbackURL: '/showcases/auth/connection',
			});
			if (result.error) {
				formError = result.error.message ?? 'Failed to send magic link.';
			} else {
				magicLinkSent = true;
			}
		} catch {
			formError = 'Failed to send magic link. Please try again.';
		} finally {
			sendingMethod = null;
		}
	}

	async function handleOtp() {
		if (!email.trim()) return;
		sendingMethod = 'otp';
		formError = null;

		try {
			const result = await authClient.emailOtp.sendVerificationOtp({
				email: email.trim(),
				type: 'sign-in',
			});
			if (result.error) {
				formError = result.error.message ?? 'Failed to send code.';
				sendingMethod = null;
			} else {
				const params = new URLSearchParams({
					email: email.trim(),
					returnTo: '/showcases/auth/connection',
				});
				goto(`/auth/verify?${params.toString()}`);
			}
		} catch {
			formError = 'Failed to send code. Please try again.';
			sendingMethod = null;
		}
	}

	async function handleOAuth(provider: 'github' | 'google' | 'microsoft') {
		loadingProvider = provider;
		formError = null;

		try {
			await authClient.signIn.social({
				provider,
				callbackURL: '/showcases/auth/connection',
			});
		} catch (err) {
			formError = err instanceof Error ? err.message : 'Sign in failed.';
			loadingProvider = null;
		}
	}

	async function handleSignOut() {
		signingOut = true;
		try {
			await authClient.signOut();
			window.location.reload();
		} catch {
			formError = 'Sign out failed.';
			signingOut = false;
		}
	}
</script>

<svelte:head>
	<title>Connection - Auth - Showcases - Velociraptor</title>
</svelte:head>

<Stack gap="6">
		<!-- Status -->
		<Card>
			{#snippet header()}
				<Cluster justify="between">
					<h2 class="text-fluid-lg font-semibold">Status</h2>
					<form
						method="POST"
						action="?/retest"
						use:enhance={() => {
							testing = true;
							return async ({ update }) => {
								await update();
								testing = false;
							};
						}}
					>
						<Button type="submit" variant="outline" size="sm" disabled={testing}>
							{#if testing}
								<Spinner size="xs" class="mr-2" />
							{/if}
							<span class="i-lucide-activity h-4 w-4 mr-1" />
							Re-test
						</Button>
					</form>
				</Cluster>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">Auth System</span>
					{#if data.reachable}
						<Badge variant="success">Reachable</Badge>
					{:else}
						<Badge variant="error">Error</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Query Latency</span>
					<code class="diag-mono">{data.latencyMs}ms</code>
				</div>

				<div class="diag-row">
					<span class="diag-label">Session Status</span>
					{#if data.authenticated}
						<Badge variant="success">Authenticated</Badge>
					{:else}
						<Badge variant="default">Anonymous</Badge>
					{/if}
				</div>

				{#if data.authenticated}
					<div class="diag-row">
						<span class="diag-label">User</span>
						<span class="diag-value">{data.userName} ({data.userEmail})</span>
					</div>
				{/if}

				<div class="diag-row">
					<span class="diag-label">Measured At</span>
					<code class="diag-mono">{data.measuredAt}</code>
				</div>
			</div>
		</Card>

		<!-- Provider Config -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">OAuth Providers</h2>
			{/snippet}

			<div class="diag-grid">
				<div class="diag-row">
					<span class="diag-label">GitHub</span>
					{#if data.providers.github}
						<Badge variant="success">Configured</Badge>
					{:else}
						<Badge variant="warning">Missing credentials</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Google</span>
					{#if data.providers.google}
						<Badge variant="success">Configured</Badge>
					{:else}
						<Badge variant="warning">Missing credentials</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Microsoft</span>
					{#if data.providers.microsoft}
						<Badge variant="success">Configured</Badge>
					{:else}
						<Badge variant="warning">Missing credentials</Badge>
					{/if}
				</div>

				<div class="diag-row">
					<span class="diag-label">Base URL</span>
					<code class="diag-mono">{data.baseURL}</code>
				</div>
			</div>
		</Card>

		<!-- Sign In / Sign Out -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">Sign In</h2>
			{/snippet}

			{#if formError}
				<div class="error-alert" role="alert">
					<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
					<span>{formError}</span>
				</div>
			{/if}

			{#if data.authenticated}
				<p class="text-sm text-muted mb-4">
					Signed in as <strong class="text-fg">{data.userName}</strong> ({data.userEmail})
				</p>
				<Button
					variant="outline"
					size="sm"
					disabled={signingOut}
					onclick={handleSignOut}
				>
					{#if signingOut}
						<Spinner size="xs" class="mr-2" />
					{/if}
					<span class="i-lucide-log-out h-4 w-4 mr-1" aria-hidden="true" />
					Sign out
				</Button>
			{:else if magicLinkSent}
				<div class="success-alert" role="status">
					<span class="i-lucide-mail-check text-lg" aria-hidden="true"></span>
					<div>
						<p class="font-medium">Check your email</p>
						<p class="text-sm">We sent a sign-in link to <strong>{email}</strong></p>
					</div>
				</div>
				<button
					class="text-sm text-muted underline mt-4"
					onclick={() => { magicLinkSent = false; formError = null; }}
				>
					Use a different email
				</button>
			{:else}
				<div class="signin-form">
					<Input
						type="email"
						placeholder="you@example.com"
						bind:value={email}
						disabled={isBusy}
					/>

					<div class="signin-actions">
						<Button
							variant="default"
							size="sm"
							class="flex-1 justify-center"
							disabled={isBusy || !email.trim()}
							onclick={handleMagicLink}
						>
							{#if sendingMethod === 'magic-link'}
								<Spinner size="xs" class="mr-2" />
							{:else}
								<span class="i-lucide-link text-lg mr-2" aria-hidden="true"></span>
							{/if}
							Magic link
						</Button>

						<Button
							variant="outline"
							size="sm"
							class="flex-1 justify-center"
							disabled={isBusy || !email.trim()}
							onclick={handleOtp}
						>
							{#if sendingMethod === 'otp'}
								<Spinner size="xs" class="mr-2" />
							{:else}
								<span class="i-lucide-hash text-lg mr-2" aria-hidden="true"></span>
							{/if}
							Send code
						</Button>
					</div>

					<div class="divider">
						<span>or</span>
					</div>

					<div class="oauth-actions">
						<Button
							variant="outline"
							size="sm"
							class="flex-1 justify-center"
							disabled={isBusy}
							onclick={() => handleOAuth('github')}
						>
							{#if loadingProvider === 'github'}
								<Spinner size="xs" class="mr-2" />
							{:else}
								<span class="i-lucide-github text-lg mr-2" aria-hidden="true"></span>
							{/if}
							GitHub
						</Button>

						<Button
							variant="outline"
							size="sm"
							class="flex-1 justify-center"
							disabled={isBusy}
							onclick={() => handleOAuth('google')}
						>
							{#if loadingProvider === 'google'}
								<Spinner size="xs" class="mr-2" />
							{:else}
								<svg class="mr-2" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
									<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
									<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
									<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
									<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
								</svg>
							{/if}
							Google
						</Button>

						<Button
							variant="outline"
							size="sm"
							class="flex-1 justify-center"
							disabled={isBusy}
							onclick={() => handleOAuth('microsoft')}
						>
							{#if loadingProvider === 'microsoft'}
								<Spinner size="xs" class="mr-2" />
							{:else}
								<svg class="mr-2" width="16" height="16" viewBox="0 0 21 21" aria-hidden="true">
									<rect x="1" y="1" width="9" height="9" fill="#F25022"/>
									<rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
									<rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
									<rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
								</svg>
							{/if}
							Microsoft
						</Button>
					</div>
				</div>
			{/if}
		</Card>

		{#if !data.reachable}
			<Alert variant="error" title="Auth System Error">
				{#snippet children()}
					<code class="diag-mono">{data.error}</code>
					<p>Check that <code>BETTER_AUTH_SECRET</code> and <code>BETTER_AUTH_URL</code> are set in <code>.env</code>.</p>
				{/snippet}
			</Alert>
		{/if}
	</Stack>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		font-size: var(--text-fluid-sm);
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.error-alert {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-error-bg);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-4);
	}

	.success-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		font-size: 0.875rem;
	}

	.success-alert p {
		margin: 0;
	}

	.signin-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.signin-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.oauth-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}
</style>
