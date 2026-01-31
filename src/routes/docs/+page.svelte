<script lang="ts">
	import { PageHeader } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Docs - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Documentation"
		description="Technical documentation and guides for the Velociraptor template."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs' }
		]}
	/>

	<nav class="docs-nav">
		<a href="/docs/stack" class="docs-card">
			<span class="card-icon">⚙️</span>
			<h2>Stack</h2>
			<p>Technology stack documentation</p>
		</a>

		<a href="/docs/blueprint" class="docs-card">
			<span class="card-icon">📐</span>
			<h2>Blueprint</h2>
			<p>Application blueprint and architecture</p>
		</a>
	</nav>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.docs-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.docs-card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 2rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		text-decoration: none;
		transition: all var(--duration-fast, 150ms);
	}

	.docs-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translateY(-2px);
	}

	.card-icon {
		font-size: 3rem;
	}

	.docs-card h2 {
		font-size: 1.5rem;
		color: var(--color-fg);
		margin: 0;
	}

	.docs-card p {
		color: var(--color-muted);
		margin: 0;
		font-size: 0.875rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.docs-card {
			transition: none;
		}

		.docs-card:hover {
			transform: none;
		}
	}
</style>
