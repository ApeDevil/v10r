<script lang="ts">
	import { PageHeader } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Showcases - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Showcases"
		description="Feature demonstrations and examples showing the capabilities of the Velociraptor stack."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Showcases' }
		]}
	/>

	<nav class="showcase-nav">
		<a href="/showcases/blueprint" class="showcase-card">
			<span class="card-icon">🏗️</span>
			<h2>App Shell Blueprint</h2>
			<p>Keyboard shortcuts, modals, toasts, navigation</p>
		</a>

		<a href="/showcases/forms" class="showcase-card">
			<span class="card-icon">📝</span>
			<h2>Forms</h2>
			<p>Form validation with Valibot + Superforms</p>
		</a>

		<a href="/showcases/3d" class="showcase-card">
			<span class="card-icon">🎮</span>
			<h2>3D</h2>
			<p>Three.js + Threlte 3D scenes</p>
		</a>

		<a href="/showcases/auth" class="showcase-card">
			<span class="card-icon">🔐</span>
			<h2>Auth</h2>
			<p>Better Auth authentication flows</p>
		</a>
	</nav>
</div>

<style>
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1rem;
	}

	.showcase-nav {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
		gap: 1.5rem;
	}

	.showcase-card {
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

	.showcase-card:hover {
		border-color: var(--color-primary);
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		transform: translateY(-2px);
	}

	.card-icon {
		font-size: 3rem;
	}

	.showcase-card h2 {
		font-size: 1.5rem;
		color: var(--color-fg);
		margin: 0;
	}

	.showcase-card p {
		color: var(--color-muted);
		margin: 0;
		font-size: 0.875rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.showcase-card {
			transition: none;
		}

		.showcase-card:hover {
			transform: none;
		}
	}
</style>
