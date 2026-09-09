<script lang="ts">
import { Card, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Typography } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { PageData } from './$types';

let { data }: { data: PageData } = $props();

const sections = $derived([
	{ id: 'vel-ladder', label: m.showcase_velocity_section_ladder() },
	{ id: 'vel-classes', label: m.showcase_velocity_section_classes() },
	{ id: 'vel-built', label: m.showcase_velocity_section_built() },
	{ id: 'vel-restraint', label: m.showcase_velocity_section_restraint() },
]);

/** The ladder, cheapest rung first, with where each one lives in this codebase. */
const ladder = $derived([
	{ rung: m.showcase_velocity_rung_skip(), where: 'critical-path-deferred-tail' },
	{ rung: m.showcase_velocity_rung_once(), where: 'hierarchical-cache' },
	{ rung: m.showcase_velocity_rung_early(), where: 'intent-preloading' },
	{ rung: m.showcase_velocity_rung_close(), where: 'compute-locality' },
	{ rung: m.showcase_velocity_rung_concurrent(), where: 'no-waterfall-loading' },
	{ rung: m.showcase_velocity_rung_cache(), where: 'stale-while-revalidate' },
	{ rung: m.showcase_velocity_rung_optimistic(), where: 'optimistic-mutation' },
	{ rung: m.showcase_velocity_rung_defer(), where: 'critical-path-deferred-tail' },
]);

const classes = $derived([
	{
		name: m.showcase_velocity_class_critical(),
		variant: 'error' as const,
		body: m.showcase_velocity_class_critical_body(),
	},
	{
		name: m.showcase_velocity_class_deferred(),
		variant: 'warning' as const,
		body: m.showcase_velocity_class_deferred_body(),
	},
	{
		name: m.showcase_velocity_class_background(),
		variant: 'secondary' as const,
		body: m.showcase_velocity_class_background_body(),
	},
]);

const elsewhere = [
	{ href: '/showcases/observability', label: 'Observability' },
	{ href: '/showcases/workers', label: 'Web Workers' },
	{ href: '/showcases/wasm', label: 'WebAssembly' },
];
</script>

<Stack gap="6">
	<p class="lead">{m.showcase_velocity_overview_lead()}</p>

	<NavSection {sections} />

	<Card id="vel-ladder">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_ladder()}</Typography>
		{/snippet}
		<Stack gap="3">
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_ladder_intro()}</p>
			<ol class="ladder">
				{#each ladder as step, i (step.rung)}
					<li>
						<span class="ladder-step">{i + 1}</span>
						<span class="ladder-text">{step.rung}</span>
						<code class="ladder-id">{step.where}</code>
					</li>
				{/each}
			</ol>
		</Stack>
	</Card>

	<Card id="vel-classes">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_classes()}</Typography>
		{/snippet}
		<Stack gap="3">
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_classes_intro()}</p>
			<Stack gap="2">
				{#each classes as entry (entry.name)}
					<div class="class-row">
						<Badge variant={entry.variant}>{entry.name}</Badge>
						<p>{entry.body}</p>
					</div>
				{/each}
			</Stack>
		</Stack>
	</Card>

	<Card id="vel-built">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_built()}</Typography>
		{/snippet}
		<Stack gap="3">
			<p class="text-muted text-fluid-sm">
				{m.showcase_velocity_built_intro({ ms: data.originMs, callers: data.stampedeCallers })}
			</p>
			<ul class="links">
				{#each elsewhere as link (link.href)}
					<li><a href={link.href}>{link.label}</a></li>
				{/each}
			</ul>
		</Stack>
	</Card>

	<Card id="vel-restraint">
		{#snippet header()}
			<Typography variant="h2">{m.showcase_velocity_section_restraint()}</Typography>
		{/snippet}
		<Stack gap="2">
			<p>{m.showcase_velocity_restraint_body()}</p>
			<p class="text-muted text-fluid-sm">{m.showcase_velocity_restraint_note()}</p>
		</Stack>
	</Card>
</Stack>

<style>
.lead {
	max-width: 68ch;
	font-size: var(--text-fluid-lg);
}

.ladder {
	display: flex;
	flex-direction: column;
	gap: var(--spacing-2);
	counter-reset: rung;
}

.ladder li {
	display: grid;
	grid-template-columns: 1.75rem 1fr auto;
	align-items: baseline;
	gap: var(--spacing-2);
	padding-bottom: var(--spacing-2);
	border-bottom: 1px solid var(--color-border);
}

.ladder li:last-child {
	border-bottom: none;
}

.ladder-step {
	font-variant-numeric: tabular-nums;
	color: var(--color-muted);
	font-size: var(--text-fluid-sm);
}

.ladder-text {
	font-size: var(--text-fluid-sm);
}

.ladder-id {
	font-family: ui-monospace, monospace;
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
	white-space: nowrap;
}

.class-row {
	display: grid;
	grid-template-columns: 7rem 1fr;
	gap: var(--spacing-3);
	align-items: start;
}

.class-row p {
	font-size: var(--text-fluid-sm);
	max-width: 68ch;
}

.links {
	display: flex;
	flex-wrap: wrap;
	gap: var(--spacing-3);
}

.links a {
	font-size: var(--text-fluid-sm);
	text-decoration: underline;
	text-underline-offset: 0.2em;
}

@media (width < 40rem) {
	.ladder li,
	.class-row {
		grid-template-columns: 1fr;
	}

	.ladder-id {
		grid-column: 1;
	}
}
</style>
