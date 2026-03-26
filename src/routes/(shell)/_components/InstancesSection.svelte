<script lang="ts">
import { fadeIn } from './fadeIn';

const TOTAL_CAPABILITIES = 18;

type Instance = {
	name: string;
	arg: string;
	uses: string[];
	count: number;
};

const instances: Instance[] = [
	{
		name: 'v10r',
		arg: 'landing-page',
		uses: ['partial stack'],
		count: 2,
	},
	{
		name: 'v10r',
		arg: 'full-platform',
		uses: ['entire stack'],
		count: TOTAL_CAPABILITIES,
	},
];
</script>

<section class="instances" use:fadeIn>
	<header class="instances-header">
		<h2 class="instances-title">INSTANTIATE</h2>
		<p class="instances-subtitle">compose from the full stack or a slice of it</p>
	</header>

	<div class="instances-row">
		{#each instances as instance}
			<article class="instance-card" class:instance-card--full={instance.count === TOTAL_CAPABILITIES}>

				<h3 class="instance-name">
					<span class="instance-fn">{instance.name}</span><span class="instance-paren">(</span><span class="instance-arg">{instance.arg}</span><span class="instance-paren">)</span>
				</h3>

				<div
					class="instance-meter"
					class:instance-meter--full={instance.count === TOTAL_CAPABILITIES}
					role="meter"
					aria-label="{instance.count} of {TOTAL_CAPABILITIES} capabilities"
					aria-valuemin={0}
					aria-valuemax={TOTAL_CAPABILITIES}
					aria-valuenow={instance.count}
				>
					<div
						class="instance-meter-fill"
						class:instance-meter-fill--full={instance.count === TOTAL_CAPABILITIES}
						style="width: {(instance.count / TOTAL_CAPABILITIES) * 100}%"
					></div>
				</div>

				<div class="stack-row">
					<span class="stack-label">uses</span>
					<span class="stack-items">
						{#each instance.uses as tech, j}
							{#if j > 0}<span class="stack-sep"> · </span>{/if}
							<span class="stack-item">{tech}</span>
						{/each}
					</span>
				</div>
			</article>
		{/each}
	</div>

	<div class="spectrum" aria-hidden="true">
		<span class="spectrum-end">minimal</span>
		<div class="spectrum-track">
			<div class="spectrum-glow"></div>
		</div>
		<span class="spectrum-end">maximal</span>
	</div>
</section>

<style>
	/* ─── TYPOGRAPHY ─── */
	.instances-title,
	.instance-name,
	.stack-label,
	.stack-item,
	.spectrum-end {
		font-family: var(--font-mono, ui-monospace, monospace);
	}

	/* ─── SECTION ─── */
	.instances {
		padding: var(--spacing-5) var(--spacing-fluid-3) var(--spacing-8);
		max-width: 80rem;
		margin: 0 auto;
	}

	.instances-header {
		text-align: center;
		margin-bottom: var(--spacing-7);
	}

	.instances-title {
		font-size: var(--text-fluid-base);
		letter-spacing: 0.2em;
		color: var(--color-fg);
		margin: 0 0 var(--spacing-2);
	}

	.instances-subtitle {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	/* ─── CARD ROW ─── */
	.instances-row {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: var(--spacing-5);
	}

	@media (min-width: 640px) {
		.instances-row {
			flex-direction: row;
			align-items: stretch;
		}
	}

	/* ─── SPECTRUM BAR ─── */
	.spectrum {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		padding: 0 var(--spacing-1);
	}

	.spectrum-end {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		letter-spacing: 0.12em;
		white-space: nowrap;
		flex-shrink: 0;
	}

	.spectrum-track {
		flex: 1;
		height: 1px;
		background: var(--color-border);
		position: relative;
		overflow: hidden;
	}

	.spectrum-glow {
		position: absolute;
		top: -1px;
		height: 3px;
		width: 40%;
		background: linear-gradient(
			90deg,
			transparent,
			var(--color-primary),
			transparent
		);
		opacity: 0.6;
		animation: spectrum-sweep 4s ease-in-out infinite;
	}

	@keyframes spectrum-sweep {
		0% {
			left: -40%;
		}
		50% {
			left: 100%;
		}
		100% {
			left: -40%;
		}
	}

	/* ─── INSTANCE CARD ─── */
	.instance-card {
		position: relative;
		flex: 1;
		border: 1px solid var(--color-border);
		padding: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		transition: border-color var(--duration-fast) ease-out;
	}

	.instance-card:hover {
		border-color: var(--color-primary);
	}

	/* ─── FUNCTION NAME ─── */
	.instance-name {
		font-size: var(--text-fluid-lg);
		font-weight: 700;
		color: var(--color-fg);
		margin: 0;
		line-height: 1.2;
		white-space: nowrap;
	}

	.instance-fn {
		color: var(--color-fg);
	}

	.instance-paren {
		color: var(--color-muted);
	}

	.instance-arg {
		color: var(--color-primary);
	}

	/* ─── METER ─── */
	.instance-meter {
		height: 2px;
		background: var(--color-border);
		overflow: hidden;
	}

	.instance-meter-fill {
		height: 100%;
		background: var(--color-primary);
		transition: width 0.6s ease-out;
	}

	.instance-meter-fill--full {
		box-shadow: 0 0 6px color-mix(in srgb, var(--color-primary) 50%, transparent);
	}

	/* ─── STACK ROW ─── */
	.stack-row {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-2);
	}

	.stack-label {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		letter-spacing: 0.1em;
		text-transform: uppercase;
		flex-shrink: 0;
	}

	.stack-items {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.stack-sep {
		color: var(--color-muted);
	}
</style>
