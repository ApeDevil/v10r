<script lang="ts">
import * as m from '#lib/paraglide/messages.js';
import type { ArchitectureDecision } from '#patterns/architecture-engineering/index.ts';
import EvidenceList from './EvidenceList.svelte';
import PatternLinks from './PatternLinks.svelte';

/** One decision record, in full. Progressive disclosure is the caller's job (a closed `<details>`). */
let { decision }: { decision: ArchitectureDecision } = $props();

const fallback = $derived(decision.alternatives.find((alternative) => alternative.id === decision.fallback.choose));
</script>

<div class="decision">
	<p class="description">{decision.description}</p>
	<p class="default">
		<strong>{m.studio_decision_default()}</strong>
		{fallback?.approach} — {decision.fallback.because}
	</p>

	<h4>{m.studio_decision_alternatives()}</h4>
	<ul class="alternatives">
		{#each decision.alternatives as alternative}
			<li>
				<p class="approach">{alternative.approach}</p>
				<p class="prefer"><strong>{m.studio_decision_prefer_when()}</strong> {alternative.prefer_when}</p>
				<div class="tradeoffs">
					<div>
						<p class="list-title">{m.studio_decision_benefits()}</p>
						<ul>{#each alternative.benefits as item}<li>{item}</li>{/each}</ul>
					</div>
					<div>
						<p class="list-title">{m.studio_decision_drawbacks()}</p>
						<ul>{#each alternative.drawbacks as item}<li>{item}</li>{/each}</ul>
					</div>
				</div>
				{#if alternative.contraindications.length > 0}
					<p class="avoid"><strong>{m.studio_decision_avoid_when()}</strong> {alternative.contraindications.join('; ')}</p>
				{/if}
				<PatternLinks ids={alternative.patterns} />
			</li>
		{/each}
	</ul>

	<h4>{m.studio_decision_rules()}</h4>
	<ol class="rules">
		{#each decision.rules as rule}
			<li>
				<code>{Object.entries(rule.when).map(([factor, values]) => `${factor} ∈ {${values?.join(', ')}}`).join(' ∧ ')}</code>
				→ <strong>{rule.choose}</strong>
				<span class="because">{rule.because}</span>
			</li>
		{/each}
		<li>
			<code>{m.studio_decision_otherwise()}</code> → <strong>{decision.fallback.choose}</strong>
		</li>
	</ol>

	<h4>{m.studio_decision_changes_when()}</h4>
	<ul>{#each decision.changes_when as item}<li>{item}</li>{/each}</ul>

	<h4>{m.studio_decision_evidence()}</h4>
	<EvidenceList evidence={decision.evidence} />

	{#if decision.evolution.migrations.length > 0}
		<h4>{m.studio_decision_migrations()}</h4>
		<ul class="migrations">
			{#each decision.evolution.migrations as migration}
				<li>
					<strong>{migration.from} → {migration.to}:</strong> {migration.path}
					<span class="because">{migration.implications}</span>
				</li>
			{/each}
		</ul>
	{/if}
	{#if decision.confirmation}
		<p class="meta"><strong>{m.studio_decision_confirmation()}</strong> {decision.confirmation}</p>
	{/if}
	<p class="meta">{m.studio_decision_revision({ id: decision.id, revision: String(decision.revision) })}</p>
</div>

<style>
	.decision {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		max-width: 80ch;
	}

	.decision p,
	.decision ul,
	.decision ol {
		margin: 0;
	}

	h4 {
		margin: var(--spacing-3) 0 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.alternatives {
		list-style: none;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.alternatives > li {
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.approach {
		font-weight: 600;
	}

	.tradeoffs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: var(--spacing-3);
	}

	.list-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
	}

	.tradeoffs ul {
		padding-left: var(--spacing-5);
	}

	.rules,
	.migrations {
		padding-left: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.rules code {
		font-size: var(--text-fluid-xs);
		overflow-wrap: anywhere;
	}

	.because {
		display: block;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.avoid,
	.meta,
	.prefer {
		font-size: var(--text-fluid-sm);
	}

	.meta {
		color: var(--color-muted);
	}
</style>
