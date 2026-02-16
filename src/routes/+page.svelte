<script lang="ts">
	import { PageContainer } from '$lib/components/layout';
	import { LinkCard } from '$lib/components';
</script>

<svelte:head>
	<title>Velociraptor - v10r</title>
</svelte:head>

<PageContainer width="default">
<div class="home">
	<h1>Velociraptor</h1>

	<pre class="logo">
  v  e l o c i r a p t o   r
  │ └──── 10 letters ────┘ │
  v          10            r

         ╔═══════════╗
         ║   v10r    ║
         ╚═══════════╝

Velociraptor is the Stack & v10r is the container
</pre>

	<p class="tagline">Performance through understanding</p>

	<nav class="nav">
		<h2>Showcases</h2>
		<div class="link-grid">
			<LinkCard href="/showcases/shell" title="App Shell Demo" />
			<LinkCard href="/showcases/3d/static-scene" title="3D: Static Scene" />
			<LinkCard href="/showcases/3d/animated-scene" title="3D: Animated Scene" />
			<LinkCard href="/showcases/i18n" title="i18n" />
		</div>
	</nav>
</div>
</PageContainer>

<style>
	.home {
		text-align: center;
	}

	h1 {
		font-size: var(--text-fluid-3xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	.logo {
		font-family: 'Courier New', monospace;
		font-size: clamp(0.5rem, 2.5vw, 1rem);
		color: var(--color-muted);
		background: var(--color-border);
		padding: clamp(0.75rem, 3vw, 1.5rem);
		border-radius: var(--radius-lg);
		margin: var(--spacing-7) auto;
		display: inline-block;
		max-width: 100%;
		overflow-x: auto;
	}

	.tagline {
		font-size: var(--text-fluid-lg);
		color: var(--color-muted);
		margin-bottom: var(--spacing-7);
	}

	.nav {
		text-align: left;
		margin: var(--spacing-7) auto;
		max-width: 37.5rem;
	}

	.nav h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	.link-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
</style>
