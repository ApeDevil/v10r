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
			<LinkCard href="/shell-demo" title="App Shell Demo (New!)" />
			<LinkCard href="/showcase/3d/phase1-static" title="3D Phase 1: Static Scene" />
			<LinkCard href="/showcase/3d/phase2-animated" title="3D Phase 2: Animated Scene" />
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
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		background: var(--color-border);
		padding: var(--spacing-6);
		border-radius: var(--radius-lg);
		margin: var(--spacing-7) auto;
		display: inline-block;
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
