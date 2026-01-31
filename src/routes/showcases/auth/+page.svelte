<svelte:head>
	<title>Auth - Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<h1>Auth Showcase</h1>
	<p>Placeholder for Better Auth authentication demonstrations.</p>

	<div class="placeholder">
		<span class="placeholder-icon">🔐</span>
		<p>Coming soon: Authentication flows, session management, and OAuth integration examples.</p>
	</div>

	<a href="/showcases" class="back-link">← Back to Showcases</a>
</div>

<style>
	.page {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: 2rem;
	}

	.placeholder {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 4rem 2rem;
		background: var(--color-border);
		border-radius: 0.5rem;
		text-align: center;
	}

	.placeholder-icon {
		font-size: 4rem;
	}

	.back-link {
		display: inline-block;
		margin-top: 2rem;
		color: var(--color-primary);
		text-decoration: none;
		font-weight: 600;
	}

	.back-link:hover {
		text-decoration: underline;
	}
</style>
