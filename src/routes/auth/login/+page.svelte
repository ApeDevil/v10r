<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { Button, Spinner } from '$lib/components/primitives';

	let { data } = $props();

	let loadingProvider = $state<string | null>(null);
	let error = $state<string | null>(null);

	async function handleOAuth(provider: 'github' | 'google') {
		loadingProvider = provider;
		error = null;

		try {
			await authClient.signIn.social({
				provider,
				callbackURL: data.returnTo,
			});
		} catch (err) {
			error = err instanceof Error ? err.message : 'Sign in failed. Please try again.';
			loadingProvider = null;
		}
	}
</script>

<svelte:head>
	<title>Sign In - Velociraptor</title>
</svelte:head>

<div class="login-page">
	<div class="login-card">
		<div class="login-header">
			<span class="i-lucide-zap text-4xl text-primary" aria-hidden="true"></span>
			<h1 class="text-2xl font-bold text-fg">Welcome to Velociraptor</h1>
			<p class="text-sm text-muted">Sign in to access your dashboard</p>
		</div>

		{#if error}
			<div class="error-alert" role="alert">
				<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
				<span>{error}</span>
			</div>
		{/if}

		<div class="login-actions">
			<Button
				variant="outline"
				size="lg"
				class="w-full justify-center"
				disabled={!!loadingProvider}
				onclick={() => handleOAuth('github')}
			>
				{#if loadingProvider === 'github'}
					<Spinner size="sm" class="mr-3" />
				{:else}
					<span class="i-lucide-github text-xl mr-3" aria-hidden="true"></span>
				{/if}
				Continue with GitHub
			</Button>

			<Button
				variant="outline"
				size="lg"
				class="w-full justify-center"
				disabled={!!loadingProvider}
				onclick={() => handleOAuth('google')}
			>
				{#if loadingProvider === 'google'}
					<Spinner size="sm" class="mr-3" />
				{:else}
					<svg class="mr-3" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
						<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
						<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
						<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
						<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
					</svg>
				{/if}
				Continue with Google
			</Button>
		</div>

		<p class="text-xs text-muted text-center mt-6">
			By signing in, you agree to our terms of service.
		</p>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--spacing-4);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		background: var(--color-surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-8);
		box-shadow: var(--shadow-lg);
	}

	.login-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-8);
		text-align: center;
	}

	.login-header h1 {
		margin: 0;
	}

	.login-header p {
		margin: 0;
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
		margin-bottom: var(--spacing-6);
	}

	.login-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
</style>
