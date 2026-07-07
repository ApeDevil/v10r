<script module lang="ts">
export interface Rung {
	/** Elevation level 0–4. 0 = the page plane (surface-0, no data-elevation). */
	e: number;
	/** Didactic role name shown in the chip (Background, Sidebar, Card, …). */
	role: string;
	/** Token name shown in the chip (surface-2, e4-bg, …). */
	token: string;
}
</script>

<script lang="ts">
/**
 * RungStack — a concentric "matryoshka" of tonal-elevation surfaces.
 *
 * Renders the REAL production tokens: each band carries `data-elevation="N"`, so
 * the fill/rim/glow/grain come straight from app.css's [data-elevation] consumer.
 * The band itself declares only border WIDTH + STYLE and a radius — never a
 * border-COLOR on an elevated rung (that would out-specify the consumer and break
 * the rim). E0 (no data-elevation) is the page plane: surface-0 + a framing border.
 *
 * Theme / palette are scoped LOCALLY by stamping the app's own `.dark` class and
 * `data-palette` attribute on the root band, so the whole subtree re-resolves the
 * tokens without touching the global <html> theme (no fight with the page's FAB).
 *
 * Channel isolation + vision sims are driven by classes on the root; the actual
 * override rules live once, section-scoped, in ElevationSection (see that file).
 */
import { cn } from '$lib/utils/cn';

interface Channels {
	rim: boolean;
	glow: boolean;
	fill: boolean;
}

interface Props {
	/** Ordered outermost → innermost (e.g. [E0, E1, E2, E3, E4]). */
	rungs: Rung[];
	/** Hero sizing for the ladder (tall stage). Otherwise a compact mini-stack. */
	hero?: boolean;
	theme?: 'light' | 'dark';
	/** data-palette value; '' = inherit the page palette. */
	palette?: string;
	channels?: Channels;
	vision?: 'none' | 'grayscale' | 'blur' | 'forced';
	/** Elevation level to visually highlight (ties the rung stepper to the ladder). */
	selected?: number;
	/** Chip shows only the E-badge (for tight small-multiples). */
	compact?: boolean;
	class?: string;
}

let {
	rungs,
	hero = false,
	theme = 'light',
	palette = '',
	channels = { rim: true, glow: true, fill: true },
	vision = 'none',
	selected,
	compact = false,
	class: className,
}: Props = $props();
</script>

{#snippet band(list: Rung[], depth: number)}
	{@const r = list[0]}
	{@const rest = list.slice(1)}
	{@const isRoot = depth === 0}
	<div
		class={cn(
			'band',
			isRoot && 'root',
			isRoot && hero && 'hero',
			selected === r.e && 'is-selected',
			// Channel + vision modifiers live on the root; override rules target descendants.
			isRoot && !channels.rim && 'rim-off',
			isRoot && !channels.glow && 'glow-off',
			isRoot && !channels.fill && 'fill-off',
			isRoot && vision !== 'none' && `sim-${vision}`,
			// Local theme scope — reuses the app's real .dark cascade.
			isRoot && theme === 'dark' && 'dark',
			isRoot && className
		)}
		data-elevation={r.e === 0 ? undefined : String(r.e)}
		data-palette={isRoot && palette ? palette : undefined}
		style="--depth: {depth}"
	>
		<span class={cn('chip', compact && 'chip-compact')}>
			<span class="chip-e">E{r.e}</span>
			{#if !compact}
				<span class="chip-role">{r.role}</span>
				<code class="chip-token">{r.token}</code>
			{/if}
		</span>
		{#if rest.length}
			{@render band(rest, depth + 1)}
		{/if}
	</div>
{/snippet}

{@render band(rungs, 0)}

<style>
	/* Bands set only border WIDTH + STYLE — never border-color on an elevated rung
	   (the [data-elevation] consumer owns the rim colour). */
	.band {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border-width: 1px;
		border-style: solid;
		border-radius: var(--radius-md);
		overflow: visible; /* intermediate rungs bleed their glow into the parent's padding */
		transition:
			background-color var(--duration-normal) var(--ease-default),
			border-color var(--duration-normal) var(--ease-default),
			box-shadow var(--duration-normal) var(--ease-default);
	}

	/* E0 — the page plane. Only the non-elevated band gets an explicit border colour. */
	.band:not([data-elevation]) {
		background: var(--surface-0);
		border-color: var(--color-border);
	}

	/* Root = the stage: the only element allowed to clip, with a padding buffer that
	   catches the widest low-rung glow before it can reach the DemoCard edge. */
	.band.root {
		width: 100%;
		container-type: inline-size;
		overflow: hidden;
	}
	.band.root.hero {
		min-height: clamp(260px, 32vw, 400px);
		border-radius: var(--radius-lg);
		padding: clamp(16px, 4vw, 32px);
	}
	.band.root:not(.hero) {
		border-radius: var(--radius-lg);
		padding: clamp(10px, 3vw, 18px);
	}

	/* Nested rungs: padding scales with the stage width and tightens inward. */
	.band:not(.root) {
		padding: max(6px, calc(clamp(10px, 3cqi, 22px) - (var(--depth) - 1) * 2px));
	}

	.is-selected {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.chip {
		align-self: flex-start;
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		max-width: 100%;
		padding: 2px 8px;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-fg) 8%, transparent);
		font-size: var(--text-fluid-xs);
		line-height: 1.4;
		color: var(--color-fg);
	}
	.chip-compact {
		padding: 1px 6px;
	}
	.chip-e {
		font-family: 'Fira Code', monospace;
		font-weight: 700;
	}
	.chip-role {
		font-weight: 600;
		white-space: nowrap;
	}
	.chip-token {
		font-family: 'Fira Code', monospace;
		color: var(--color-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Vision sims that are a simple full-subtree filter live here (root carries the class);
	   the forced-colors approximation needs descendant overrides and lives in ElevationSection. */
	.band.root.sim-grayscale {
		filter: grayscale(1);
	}
	.band.root.sim-blur {
		filter: blur(1.2px) contrast(0.82);
	}
</style>
