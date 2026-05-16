<script lang="ts">
let { data }: PageProps = $props();

const messages = {
	invalid: {
		title: 'Pairing code not recognised',
		body: 'Check that you typed the code correctly, or ask the admin to generate a new one.',
	},
	expired: {
		title: 'Pairing link has expired',
		body: 'Codes are valid for 10 minutes. Ask the admin to generate a new one.',
	},
	consumed: {
		title: 'Pairing link was already used',
		body: 'Each code can only be used once. Ask the admin to generate a new one.',
	},
	attempts_exceeded: {
		title: 'Too many attempts on this code',
		body: 'For security, this code is now disabled. Ask the admin to generate a new one.',
	},
} as const;

const msg = $derived(data.failure ? messages[data.failure] : null);
</script>

<svelte:head>
	<title>Pairing</title>
</svelte:head>

<main class="page">
	{#if msg}
		<section class="card">
			<span class="i-lucide-alert-circle icon" aria-hidden="true"></span>
			<h1 class="title">{msg.title}</h1>
			<p class="body">{msg.body}</p>
			<a href="/" class="link">Return to homepage</a>
		</section>
	{:else}
		<!-- Should never render — server redirects on success. Meta-refresh fallback. -->
		<noscript>
			<meta http-equiv="refresh" content="0; url=/" />
		</noscript>
		<p>Pairing… <a href="/">Continue →</a></p>
	{/if}
</main>

<style>
	.page {
		display: flex;
		min-height: 100dvh;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-6);
		background: var(--color-bg);
	}
	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		max-width: 32rem;
		padding: var(--spacing-8) var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-surface-2);
		text-align: center;
	}
	.icon {
		font-size: 2.5rem;
		color: var(--color-muted);
	}
	.title {
		margin: 0;
		font-size: var(--text-fluid-xl);
		font-weight: 600;
		color: var(--color-fg);
	}
	.body {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.6;
	}
	.link {
		margin-top: var(--spacing-2);
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 500;
	}
	.link:hover {
		text-decoration: underline;
	}
</style>
