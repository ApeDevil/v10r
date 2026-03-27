<script lang="ts">
import { goto } from '$app/navigation';
import { BoundaryFallback } from '$lib/components/composites';
import { Button } from '$lib/components/primitives';

let crashKey = $state(0);
let crashed = $state(false);

function triggerCrash() {
	crashed = true;
}

function handleReset() {
	crashed = false;
	crashKey++;
}
</script>

<svelte:head>
	<title>Errors - Shell - Showcases - Velociraptor</title>
</svelte:head>

<div class="sections">
	<!-- Section 1: Live Component Boundary -->
	<section class="demo-section">
		<h2>Component Boundary</h2>
		<p>
			Svelte's <code>&lt;svelte:boundary&gt;</code> catches runtime errors within a component tree
			and renders a fallback UI instead of crashing the entire page.
		</p>

		<div class="boundary-demo">
			<svelte:boundary>
				{#key crashKey}
					{#if crashed}
						{(() => { throw new Error('User-triggered crash for demo'); })()}
					{/if}
					<div class="demo-widget">
						<span class="i-lucide-heart-pulse demo-widget-icon" aria-hidden="true"></span>
						<p class="demo-widget-text">This component is alive and well.</p>
						<Button variant="destructive" size="sm" onclick={triggerCrash}>
							<span class="i-lucide-zap mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
							Crash this component
						</Button>
					</div>
				{/key}

				{#snippet failed(error, reset)}
					<BoundaryFallback
						title="Component crashed"
						description="The component threw an error. Click retry to restore it."
						reset={() => { reset(); handleReset(); }}
					/>
				{/snippet}
			</svelte:boundary>
		</div>
	</section>

	<!-- Section 2: BoundaryFallback Variants -->
	<section class="demo-section">
		<h2>BoundaryFallback Variants</h2>
		<p>
			The <code>BoundaryFallback</code> component accepts custom titles, descriptions, and
			minimum heights to fit different contexts.
		</p>

		<div class="variants-grid">
			<BoundaryFallback
				title="Something went wrong"
				reset={() => {}}
			/>
			<BoundaryFallback
				title="3D scene unavailable"
				description="WebGL is required. Check browser support or graphics drivers."
				reset={() => {}}
			/>
			<BoundaryFallback
				title="Chart failed to render"
				description="The dataset may be too large or contain invalid values."
				minHeight="12rem"
				reset={() => {}}
			/>
		</div>
	</section>

	<!-- Section 3: Route Error Pages -->
	<section class="demo-section">
		<h2>Route Error Pages</h2>
		<p>
			SvelteKit errors that escape component boundaries are caught by <code>+error.svelte</code>
			pages. The system has three layers:
		</p>

		<div class="architecture">
			<div class="layer">
				<code class="layer-label">1. svelte:boundary</code>
				<span class="layer-desc">Component-level &mdash; catches errors within a single component tree</span>
			</div>
			<div class="layer">
				<code class="layer-label">2. +error.svelte</code>
				<span class="layer-desc">Route-level &mdash; catches load/render errors for a route segment</span>
			</div>
			<div class="layer">
				<code class="layer-label">3. error.html</code>
				<span class="layer-desc">App-level &mdash; last resort when SvelteKit itself fails</span>
			</div>
		</div>

		<h3>Error Boundaries</h3>
		<p>
			Four <code>+error.svelte</code> files provide contextual recovery actions for each area:
		</p>

		<div class="boundary-map">
			<div class="boundary-entry">
				<code class="boundary-path">routes/+error.svelte</code>
				<span class="boundary-purpose">Root fallback &mdash; "Go home" action</span>
			</div>
			<div class="boundary-entry">
				<code class="boundary-path">routes/app/+error.svelte</code>
				<span class="boundary-purpose">Authenticated area &mdash; "Back to dashboard" with sidebar visible</span>
			</div>
			<div class="boundary-entry">
				<code class="boundary-path">routes/auth/+error.svelte</code>
				<span class="boundary-purpose">Auth flow &mdash; "Back to sign in" action</span>
			</div>
			<div class="boundary-entry">
				<code class="boundary-path">routes/showcases/+error.svelte</code>
				<span class="boundary-purpose">Showcases &mdash; contextual hints per showcase category</span>
			</div>
		</div>

		<div class="route-links">
			<p class="route-links-label">Trigger a real error page:</p>
			<div class="button-group">
				<Button variant="secondary" size="sm" onclick={() => goto('/this-does-not-exist')}>
					<span class="i-lucide-compass mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
					Root 404
				</Button>
				<Button variant="secondary" size="sm" onclick={() => goto('/app/nonexistent')}>
					<span class="i-lucide-layout-dashboard mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
					App 404
				</Button>
				<Button variant="secondary" size="sm" onclick={() => goto('/auth/nonexistent')}>
					<span class="i-lucide-log-in mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
					Auth 404
				</Button>
				<Button variant="secondary" size="sm" onclick={() => goto('/showcases/nonexistent')}>
					<span class="i-lucide-lightbulb mr-2 h-3.5 w-3.5" aria-hidden="true"></span>
					Showcase 404
				</Button>
			</div>
		</div>
	</section>
</div>

<style>
	.sections {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.demo-section {
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
	}

	h2 {
		font-size: var(--text-fluid-xl);
		margin-bottom: var(--spacing-4);
		color: var(--color-fg);
	}

	p {
		color: var(--color-muted);
		margin-bottom: var(--spacing-4);
		line-height: 1.6;
	}

	code {
		font-family: ui-monospace, monospace;
		font-size: 0.875em;
		padding: 0.125rem 0.375rem;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.boundary-demo {
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
	}

	.demo-widget {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-6);
		text-align: center;
	}

	.demo-widget-icon {
		font-size: 1.5rem;
		color: var(--color-success, #22c55e);
	}

	.demo-widget-text {
		color: var(--color-fg);
		margin: 0;
	}

	.variants-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
		gap: var(--spacing-4);
	}

	.architecture {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin-bottom: var(--spacing-5);
	}

	.layer {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.layer-label {
		flex-shrink: 0;
		font-weight: 600;
		background: none;
		padding: 0;
	}

	.layer-desc {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	h3 {
		font-size: var(--text-fluid-lg);
		margin-bottom: var(--spacing-3);
		color: var(--color-fg);
	}

	.boundary-map {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-5);
	}

	.boundary-entry {
		display: flex;
		align-items: baseline;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.boundary-path {
		flex-shrink: 0;
		font-weight: 600;
		font-size: var(--text-fluid-xs);
		background: none;
		padding: 0;
	}

	.boundary-purpose {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.route-links {
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
	}

	.route-links-label {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
		margin-bottom: var(--spacing-3);
	}

	.button-group {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	@media (max-width: 640px) {
		.layer,
		.boundary-entry {
			flex-direction: column;
			gap: var(--spacing-1);
		}
	}
</style>
