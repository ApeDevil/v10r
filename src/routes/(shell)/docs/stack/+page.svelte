<script lang="ts">
	import { PageHeader, BackLink } from '$lib/components/composites';
</script>

<svelte:head>
	<title>Stack - Docs - Velociraptor</title>
</svelte:head>

<div class="page">
	<PageHeader
		title="Stack Documentation"
		description="Technology stack documentation organized by layer."
		breadcrumbs={[
			{ label: 'Home', href: '/' },
			{ label: 'Docs', href: '/docs' },
			{ label: 'Stack' }
		]}
	/>

	<div class="stack-grid">
		<section class="stack-group">
			<h3 class="group-title">Core</h3>
			<ul>
				<li>Bun</li>
				<li>SvelteKit</li>
				<li>Svelte</li>
				<li>Podman</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">Data</h3>
			<ul>
				<li>PostgreSQL (Neon)</li>
				<li>Neo4j (Aura)</li>
				<li>Drizzle ORM</li>
				<li>Cloudflare R2</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">Auth</h3>
			<ul>
				<li>Better Auth</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">UI</h3>
			<ul>
				<li>UnoCSS</li>
				<li>Bits UI</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">Forms</h3>
			<ul>
				<li>Valibot</li>
				<li>Superforms</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">Quality</h3>
			<ul>
				<li>Biome</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">Ops</h3>
			<ul>
				<li>Vercel Deployment</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">AI</h3>
			<ul>
				<li>Vercel AI SDK</li>
			</ul>
		</section>

		<section class="stack-group">
			<h3 class="group-title">i18n</h3>
			<ul>
				<li>Paraglide JS</li>
			</ul>
		</section>
	</div>

	<BackLink href="/docs" label="Docs" />
</div>

<style>
	.page {
		max-width: var(--layout-wide-width, 72rem);
		margin: 0 auto;
		padding: var(--spacing-7) var(--spacing-4);
	}

	.stack-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: var(--spacing-6);
		margin-bottom: var(--spacing-7);
	}

	.stack-group {
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: 0.5rem;
		background: var(--color-surface-1);
	}

	.group-title {
		font-size: var(--text-sm);
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--color-primary);
		margin: 0 0 var(--spacing-3);
	}

	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	li {
		font-size: var(--text-sm);
		color: var(--color-fg);
	}
</style>
