<script lang="ts">
import { Badge, Button, Input, Select, Textarea } from '#lib/components/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	type ArchitectureFinding,
	type ArchitectureModel,
	compareArchitectures,
	countBySeverity,
	type FindingCategory,
	type FindingSeverity,
	findDecision,
} from '#patterns/architecture-engineering/index.ts';
import { goto } from '$app/navigation';
import { humanize } from '../_components/humanize.ts';
import PatternLinks from '../_components/PatternLinks.svelte';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';

const studio = useArchitectureStudio();

const CATEGORY_ORDER: FindingCategory[] = ['security', 'runtime', 'communication', 'data', 'structure'];
const SEVERITY_LABELS: Record<FindingSeverity, () => string> = {
	error: m.studio_severity_error,
	warning: m.studio_severity_warning,
	unknown: m.studio_severity_unknown,
	recommendation: m.studio_severity_recommendation,
};
const SEVERITY_VARIANTS: Record<FindingSeverity, 'error' | 'warning' | 'muted' | 'default'> = {
	error: 'error',
	warning: 'warning',
	unknown: 'muted',
	recommendation: 'default',
};
const CATEGORY_LABELS: Record<FindingCategory, () => string> = {
	security: m.studio_category_security,
	runtime: m.studio_category_runtime,
	communication: m.studio_category_communication,
	data: m.studio_category_data,
	structure: m.studio_category_structure,
};

const counts = $derived(countBySeverity(studio.findings));
const grouped = $derived(
	CATEGORY_ORDER.map((category) => ({
		category,
		findings: studio.findings.filter((entry) => entry.category === category),
	})).filter((group) => group.findings.length > 0),
);

const linkedDecisions = $derived(
	[...new Set(studio.model.nodes.flatMap((node) => node.decisions))]
		.map((id) => findDecision(id))
		.filter((decision) => decision !== undefined),
);

async function showInDesign(entry: ArchitectureFinding) {
	const [type, id] = entry.subject.split('/');
	studio.select(type === 'nodes' ? { type: 'node', id } : { type: 'connection', id });
	await goto(localizeHref('/studio/architecture/design'));
}

// ── Variants and comparison ──
let variantName = $state('');
/** The suggested name, without stacking a second "(variant)" onto a variant. */
const defaultVariantName = $derived(`${studio.model.name.replace(/ \(variant\)$/, '')} (variant)`);
let variantReason = $state('');

function createVariant() {
	if (!variantReason.trim()) return;
	studio.createVariant(variantName.trim() || defaultVariantName, variantReason.trim());
	variantName = '';
	variantReason = '';
}

let baselineId = $state('');
$effect(() => {
	// Default to the model this one was derived from, once drafts are known.
	if (
		!baselineId &&
		studio.model.derived_from &&
		studio.drafts.some((draft) => draft.id === studio.model.derived_from)
	) {
		baselineId = studio.model.derived_from;
	}
});

const baselineOptions = $derived(
	studio.drafts
		.filter((draft) => draft.id !== studio.model.id)
		.map((draft) => ({ value: draft.id, label: draft.name })),
);
const baseline = $derived<ArchitectureModel | null>(baselineId ? studio.draftModel(baselineId) : null);
const comparison = $derived(baseline ? compareArchitectures(baseline, studio.model) : null);
const hasChanges = $derived(
	comparison !== null &&
		[
			comparison.nodes.added,
			comparison.nodes.removed,
			comparison.nodes.changed,
			comparison.placements,
			comparison.connections.added,
			comparison.connections.removed,
			comparison.connections.changed,
			comparison.requirements.added,
			comparison.requirements.removed,
		].some((list) => list.length > 0),
);
</script>

<div class="engineer">
	<section aria-labelledby="checks-title">
		<h2 id="checks-title">{m.studio_engineer_checks_title()}</h2>
		<p class="hint">{m.studio_engineer_checks_hint()}</p>
		<div class="counts">
			{#each Object.keys(SEVERITY_LABELS) as FindingSeverity[] as severity}
				<Badge variant={SEVERITY_VARIANTS[severity]}>{SEVERITY_LABELS[severity]()}: {counts[severity]}</Badge>
			{/each}
		</div>

		{#if studio.model.nodes.length === 0}
			<p class="hint">{m.studio_engineer_empty()}</p>
		{:else if studio.findings.length === 0}
			<p class="clean">{m.studio_engineer_clean()}</p>
		{/if}

		{#each grouped as group}
			<div class="category">
				<h3>{CATEGORY_LABELS[group.category]()}</h3>
				<ul class="findings">
					{#each group.findings as entry (`${entry.code} ${entry.subject}`)}
						<li class="finding" data-severity={entry.severity}>
							<div class="finding-head">
								<Badge variant={SEVERITY_VARIANTS[entry.severity]}>{SEVERITY_LABELS[entry.severity]()}</Badge>
								<code>{entry.code}</code>
							</div>
							<p class="detected">{entry.detected}</p>
							<p><strong>{m.studio_engineer_why()}</strong> {entry.why}</p>
							<p><strong>{m.studio_engineer_constraint()}</strong> {entry.constraint}</p>
							<p><strong>{m.studio_engineer_fix()}</strong> {entry.fix}</p>
							<PatternLinks ids={entry.patterns} />
							<div>
								<Button size="sm" variant="outline" onclick={() => showInDesign(entry)}>{m.studio_engineer_show_in_design()}</Button>
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	</section>

	{#if linkedDecisions.length > 0}
		<section aria-labelledby="decisions-title">
			<h2 id="decisions-title">{m.studio_engineer_decisions_title()}</h2>
			<p class="hint">{m.studio_engineer_decisions_hint()}</p>
			<ul class="decisions">
				{#each linkedDecisions as decision}
					<li>
						<a href={localizeHref(`/studio/architecture#decision-${decision.id}`)}>{decision.title}</a>
						<span class="hint">{decision.question}</span>
						<span class="hint">
							{m.studio_engineer_decision_nodes({
								nodes: studio.model.nodes.filter((node) => node.decisions.includes(decision.id)).map((node) => node.label).join(', '),
							})}
						</span>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section aria-labelledby="variant-title">
		<h2 id="variant-title">{m.studio_engineer_variant_title()}</h2>
		<p class="hint">{m.studio_engineer_variant_hint()}</p>
		<div class="variant-form">
			<label for="variant-name">{m.studio_engineer_variant_name()}</label>
			<Input id="variant-name" bind:value={variantName} maxlength={120} placeholder={defaultVariantName} />
			<label for="variant-reason">{m.studio_engineer_variant_reason()}</label>
			<Textarea id="variant-reason" bind:value={variantReason} rows={3} maxlength={2000} placeholder={m.studio_engineer_variant_reason_placeholder()} />
			<div>
				<Button variant="primary" size="sm" disabled={!variantReason.trim()} onclick={createVariant}>
					<span class="i-lucide-copy mr-2" aria-hidden="true"></span>{m.studio_engineer_variant_create()}
				</Button>
			</div>
		</div>
		{#if studio.model.change_reason && !comparison}
			<p class="reason"><strong>{m.studio_engineer_change_reason()}</strong> {studio.model.change_reason}</p>
		{/if}
	</section>

	<section aria-labelledby="compare-title">
		<h2 id="compare-title">{m.studio_engineer_compare_title()}</h2>
		<p class="hint">{m.studio_engineer_compare_hint()}</p>
		{#if baselineOptions.length === 0}
			<p class="hint">{m.studio_engineer_compare_none()}</p>
		{:else}
			<div class="compare-pick">
				<label for="compare-baseline">{m.studio_engineer_compare_baseline()}</label>
				<Select id="compare-baseline" options={baselineOptions} bind:value={baselineId} placeholder={m.studio_engineer_compare_pick()} />
				<p class="hint">{m.studio_engineer_compare_against({ name: studio.model.name })}</p>
			</div>
		{/if}

		{#if baselineId && !baseline}
			<p class="hint">{m.studio_notice_open_corrupt()}</p>
		{/if}

		{#if comparison}
			<div class="comparison">
				<table class="summary">
					<thead>
						<tr>
							<th scope="col"></th>
							<th scope="col">{comparison.baseline.name}</th>
							<th scope="col">{comparison.variant.name}</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<th scope="row">{m.studio_compare_components()}</th>
							<td>{baseline?.nodes.length}</td>
							<td>{studio.model.nodes.length}</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_units()}</th>
							<td>{comparison.baseline.deployment_units.join(', ')}</td>
							<td>{comparison.variant.deployment_units.join(', ')}</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_dependencies()}</th>
							<td>{comparison.baseline.managed_dependencies.join(', ') || '—'}</td>
							<td>{comparison.variant.managed_dependencies.join(', ') || '—'}</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_network()}</th>
							<td>{comparison.baseline.network_connections} ({comparison.baseline.synchronous_network_connections} {m.studio_compare_sync()})</td>
							<td>{comparison.variant.network_connections} ({comparison.variant.synchronous_network_connections} {m.studio_compare_sync()})</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_boundaries()}</th>
							<td>{comparison.baseline.trust_boundary_crossings}</td>
							<td>{comparison.variant.trust_boundary_crossings}</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_requirements()}</th>
							<td>{comparison.baseline.requirements.join(', ') || '—'}</td>
							<td>{comparison.variant.requirements.join(', ') || '—'}</td>
						</tr>
						<tr>
							<th scope="row">{m.studio_compare_findings()}</th>
							<td>{comparison.baseline.findings.length}</td>
							<td>{comparison.variant.findings.length}</td>
						</tr>
					</tbody>
				</table>

				{#if comparison.change_reason}
					<p class="reason"><strong>{m.studio_engineer_change_reason()}</strong> {comparison.change_reason}</p>
				{/if}

				<h3>{m.studio_compare_assessment()}</h3>
				<p class="hint">{m.studio_compare_assessment_hint()}</p>
				<ul class="assessment">
					{#each comparison.assessment as entry}
						<li><Badge variant="secondary">{m.studio_compare_qualitative()}</Badge> <strong>{humanize(entry.dimension)}:</strong> {entry.statement}</li>
					{/each}
				</ul>

				<h3>{m.studio_compare_changes()}</h3>
				{#if !hasChanges}
					<p class="hint">{m.studio_compare_no_changes()}</p>
				{/if}
				<ul class="changes">
					{#each comparison.nodes.added as node}<li>+ {node.label} ({node.kind})</li>{/each}
					{#each comparison.nodes.removed as node}<li>− {node.label} ({node.kind})</li>{/each}
					{#each comparison.placements as change}<li>⇄ {change.label}: {humanize(change.from)} → {humanize(change.to)}</li>{/each}
					{#each comparison.nodes.changed.filter((change) => !comparison?.placements.some((p) => p.id === change.id)) as change}
						<li>~ {change.label}: {change.changes.join('; ')}</li>
					{/each}
					{#each comparison.connections.added as connection}<li>+ {connection.from} → {connection.to} ({connection.protocol})</li>{/each}
					{#each comparison.connections.removed as connection}<li>− {connection.from} → {connection.to} ({connection.protocol})</li>{/each}
					{#each comparison.connections.changed as change}<li>~ {change.label}: {change.changes.join('; ')}</li>{/each}
					{#each comparison.requirements.added as requirement}<li>+ {m.studio_compare_requirement()} {requirement}</li>{/each}
					{#each comparison.requirements.removed as requirement}<li>− {m.studio_compare_requirement()} {requirement}</li>{/each}
				</ul>

				{#if comparison.findings.introduced.length > 0 || comparison.findings.resolved.length > 0}
					<h3>{m.studio_compare_risks()}</h3>
					<ul class="changes">
						{#each comparison.findings.introduced as entry}<li>+ <code>{entry.code}</code> {entry.detected}</li>{/each}
						{#each comparison.findings.resolved as entry}<li>✓ <code>{entry.code}</code> {entry.detected}</li>{/each}
					</ul>
				{/if}
			</div>
		{/if}
	</section>
</div>

<style>
	.engineer {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	h2 {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
	}

	h3 {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: var(--spacing-2) 0 0;
	}

	p {
		margin: 0;
	}

	.hint {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.clean {
		color: var(--color-success);
	}

	.counts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.findings,
	.decisions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.finding {
		border: 1px solid var(--color-border);
		border-left-width: 4px;
		border-radius: var(--radius-md);
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		max-width: 80ch;
	}

	.finding[data-severity='error'] {
		border-left-color: var(--color-error);
	}

	.finding[data-severity='warning'] {
		border-left-color: var(--color-warning);
	}

	.finding[data-severity='recommendation'] {
		border-left-color: var(--color-primary);
	}

	.finding-head {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
	}

	.detected {
		font-weight: 600;
	}

	.decisions li {
		display: flex;
		flex-direction: column;
	}

	.decisions a {
		color: var(--color-primary);
		font-weight: 600;
	}

	.variant-form,
	.compare-pick {
		display: grid;
		gap: var(--spacing-2);
		max-width: 40rem;
	}

	label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.reason {
		border-left: 3px solid var(--color-primary);
		padding-left: var(--spacing-3);
	}

	.comparison {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		min-width: 0;
	}

	.summary {
		border-collapse: collapse;
		width: 100%;
		display: block;
		overflow-x: auto;
		font-size: var(--text-fluid-sm);
	}

	.summary th,
	.summary td {
		border-bottom: 1px solid var(--color-border);
		padding: var(--spacing-2) var(--spacing-3);
		text-align: left;
		vertical-align: top;
	}

	.assessment,
	.changes {
		margin: 0;
		padding-left: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
</style>
