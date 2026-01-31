<svelte:head>
	<title>Velociraptor - v10r</title>
</svelte:head>

<div class="home">
	<h1>Velociraptor</h1>

	<pre class="logo">
  v  e l o c i r a p t o   r
  │ └──── 10 letters ────┘ │
  v          10            r

         ╔═══════════╗
         ║   v10r    ║
         ╚═══════════╝
</pre>

	<p class="tagline">Performance through understanding</p>

	<nav class="nav">
		<h2>Showcases</h2>
		<ul>
			<li><a href="/shell-demo">App Shell Demo (New!)</a></li>
			<li><a href="/showcase/3d/phase1-static">3D Phase 1: Static Scene</a></li>
			<li><a href="/showcase/3d/phase2-animated">3D Phase 2: Animated Scene</a></li>
		</ul>
	</nav>
</div>

<style>
	.home {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
		text-align: center;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 1rem;
		color: var(--color-fg);
	}

	.logo {
		font-family: 'Courier New', monospace;
		font-size: 0.9rem;
		color: var(--color-muted);
		background: var(--color-border);
		padding: 1.5rem;
		border-radius: 0.5rem;
		margin: 2rem auto;
		display: inline-block;
	}

	.tagline {
		font-size: 1.25rem;
		color: var(--color-muted);
		margin-bottom: 2rem;
	}

	.nav {
		text-align: left;
		margin: 2rem auto;
		max-width: 500px;
	}

	.nav h2 {
		font-size: 1.5rem;
		margin-bottom: 1rem;
		color: var(--color-fg);
	}

	.nav ul {
		list-style: none;
		padding: 0;
		margin: 0;
	}

	.nav li {
		margin-bottom: 0.75rem;
	}

	.nav a {
		display: block;
		padding: 0.75rem 1rem;
		background: var(--color-bg);
		border: 1px solid var(--color-border);
		border-radius: 0.375rem;
		color: var(--color-fg);
		text-decoration: none;
		transition: all 150ms;
	}

	.nav a:hover {
		background: var(--color-primary);
		color: white;
		border-color: var(--color-primary);
	}
</style>
