<script lang="ts">
import { Badge, Button, Select } from '#lib/components/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import {
	ENGINEERING_DOMAIN_TITLES,
	EVIDENCE_KIND_LABELS,
	UNKNOWN,
	WORKLOAD_EXAMPLES,
	WORKLOAD_FACTOR_IDS,
	WORKLOAD_FACTOR_LABELS,
	WORKLOAD_FACTORS,
	type WorkloadFactor,
} from '#patterns/architecture-engineering/index.ts';
import { goto } from '$app/navigation';
import { humanize } from '../_components/humanize.ts';
import PatternLinks from '../_components/PatternLinks.svelte';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';

const studio = useArchitectureStudio();

function options(factor: WorkloadFactor) {
	return [
		{ value: UNKNOWN, label: m.studio_explore_unknown() },
		...WORKLOAD_FACTORS[factor].map((value) => ({ value, label: humanize(value) })),
	];
}

const recommendation = $derived(studio.recommendation);
const knownCount = $derived(WORKLOAD_FACTOR_IDS.length - recommendation.unknown_factors.length);

async function transfer() {
	studio.transferToDesign();
	await goto(localizeHref('/studio/architecture/design'));
}
</script>

<div class="explore">
	<section class="inputs" aria-labelledby="workload-title">
		<h2 id="workload-title">{m.studio_explore_workload_title()}</h2>
		<p class="hint">{m.studio_explore_workload_hint()}</p>

		<div class="examples" role="group" aria-label={m.studio_explore_examples_aria()}>
			{#each WORKLOAD_EXAMPLES as example}
				<Button
					size="sm"
					variant={studio.exampleId === example.id ? 'primary' : 'outline'}
					aria-pressed={studio.exampleId === example.id}
					title={example.summary}
					onclick={() => studio.applyExample(example.id)}
				>
					{example.title}
				</Button>
			{/each}
		</div>

		<div class="factors">
			{#each WORKLOAD_FACTOR_IDS as factor}
				<div class="factor">
					<label for={`factor-${factor}`}>{WORKLOAD_FACTOR_LABELS[factor]}</label>
					<Select
						id={`factor-${factor}`}
						options={options(factor)}
						value={studio.profile[factor]}
						onchange={(value) => studio.setFactor(factor, value)}
					/>
				</div>
			{/each}
		</div>
		<div class="actions">
			<Button variant="ghost" size="sm" onclick={() => studio.resetProfile()}>{m.studio_explore_reset()}</Button>
		</div>
	</section>

	<section class="result" aria-labelledby="result-title" aria-live="polite">
		<div class="result-head">
			<h2 id="result-title">{m.studio_explore_result_title()}</h2>
			<Button variant="primary" onclick={transfer}>
				<span class="i-lucide-pencil-ruler" aria-hidden="true"></span>
				{m.studio_explore_transfer()}
			</Button>
		</div>
		<p class="hint">
			{m.studio_explore_result_hint({ known: String(knownCount), total: String(WORKLOAD_FACTOR_IDS.length) })}
		</p>
		{#if recommendation.unknown_factors.length > 0}
			<p class="unknowns">
				<strong>{m.studio_explore_unknown_factors()}</strong>
				{recommendation.unknown_factors.map((factor) => WORKLOAD_FACTOR_LABELS[factor]).join(', ')}
			</p>
		{/if}

		<ol class="outcomes">
			{#each recommendation.outcomes as outcome (outcome.decision)}
				<li class="outcome">
					<div class="outcome-head">
						<span class="domain">{ENGINEERING_DOMAIN_TITLES[outcome.domain]}</span>
						{#if outcome.basis === 'rule'}
							<Badge variant="default">{m.studio_explore_basis_rule()}</Badge>
						{:else}
							<Badge variant="secondary">{m.studio_explore_basis_default()}</Badge>
						{/if}
					</div>
					<h3>{outcome.title}</h3>
					<p class="chosen">{outcome.chosen.approach}</p>
					<p class="because">{outcome.because}</p>
					{#if Object.keys(outcome.inputs_used).length > 0}
						<p class="meta">
							<strong>{m.studio_explore_inputs_used()}</strong>
							{Object.entries(outcome.inputs_used)
								.map(([factor, value]) => `${WORKLOAD_FACTOR_LABELS[factor as WorkloadFactor]}: ${humanize(String(value))}`)
								.join(' · ')}
						</p>
					{/if}

					{#if outcome.missing.length > 0}
						<div class="missing">
							<p class="list-title">{m.studio_explore_missing_title()}</p>
							<ul>
								{#each outcome.missing as entry}
									<li>
										{m.studio_explore_missing_entry({
											factors: entry.factors.map((factor) => WORKLOAD_FACTOR_LABELS[factor]).join(', '),
											alternative: entry.would_choose,
										})}
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<details>
						<summary>{m.studio_explore_alternatives({ count: String(outcome.alternatives.length) })}</summary>
						<ul class="alternatives">
							{#each outcome.alternatives as entry}
								<li>
									<p class="approach">{entry.alternative.approach}</p>
									<p class="meta"><strong>{m.studio_decision_prefer_when()}</strong> {entry.alternative.prefer_when}</p>
									{#if entry.contradicted_by.length > 0}
										<p class="meta">
											<strong>{m.studio_explore_ruled_out()}</strong>
											{entry.contradicted_by
												.map((c) => `${WORKLOAD_FACTOR_LABELS[c.factor]} = ${humanize(c.actual)} (${m.studio_explore_needs()} ${c.needs.map(humanize).join(' / ')})`)
												.join('; ')}
										</p>
									{/if}
									{#if entry.outranked}
										<p class="meta">{m.studio_explore_outranked()}</p>
									{/if}
									<p class="meta"><strong>{m.studio_decision_drawbacks()}</strong> {entry.alternative.drawbacks.join('; ')}</p>
									<PatternLinks ids={entry.alternative.patterns} />
								</li>
							{/each}
						</ul>
					</details>

					<details>
						<summary>{m.studio_explore_tradeoffs()}</summary>
						<div class="tradeoffs">
							<p class="list-title">{m.studio_decision_benefits()}</p>
							<ul>{#each outcome.chosen.benefits as item}<li>{item}</li>{/each}</ul>
							<p class="list-title">{m.studio_decision_drawbacks()}</p>
							<ul>{#each outcome.chosen.drawbacks as item}<li>{item}</li>{/each}</ul>
							<p class="list-title">{m.studio_decision_changes_when()}</p>
							<ul>{#each outcome.changes_when as item}<li>{item}</li>{/each}</ul>
							<p class="list-title">{m.studio_decision_evidence()}</p>
							<ul>
								{#each outcome.evidence as entry}
									<li><Badge variant={entry.kind === 'estimate' ? 'warning' : 'secondary'}>{EVIDENCE_KIND_LABELS[entry.kind]}</Badge> {entry.claim}</li>
								{/each}
							</ul>
						</div>
					</details>

					<PatternLinks ids={outcome.chosen.patterns} />
					<a class="record-link" href={localizeHref(`/studio/architecture#decision-${outcome.decision}`)}>{m.studio_explore_full_record()}</a>
				</li>
			{/each}
		</ol>
		<p class="meta">{m.studio_explore_reproducible({ engine: String(recommendation.engine_revision) })}</p>
	</section>
</div>

<style>
	.explore {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-6);
	}

	@media (min-width: 64rem) {
		.explore {
			grid-template-columns: minmax(18rem, 2fr) minmax(0, 3fr);
			align-items: start;
		}

		.inputs {
			position: sticky;
			top: 5rem;
		}
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		min-width: 0;
	}

	h2 {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
	}

	h3 {
		font-size: var(--text-fluid-base);
		margin: 0;
	}

	p {
		margin: 0;
	}

	.hint,
	.meta,
	.because,
	.domain {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.examples {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}

	.factors {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
		gap: var(--spacing-3);
	}

	.factor {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.factor label {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.result-head {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
	}

	.unknowns {
		font-size: var(--text-fluid-sm);
	}

	.outcomes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.outcome {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.outcome-head {
		display: flex;
		justify-content: space-between;
		gap: var(--spacing-2);
		align-items: center;
	}

	.chosen {
		font-weight: 600;
		font-size: var(--text-fluid-md);
	}

	.missing {
		border-left: 3px solid var(--color-warning);
		padding-left: var(--spacing-3);
	}

	.missing ul,
	.alternatives,
	.tradeoffs ul {
		margin: var(--spacing-1) 0 0;
		padding-left: var(--spacing-5);
	}

	.list-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		margin-top: var(--spacing-2);
	}

	details summary {
		cursor: pointer;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.alternatives {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin-top: var(--spacing-2);
	}

	.approach {
		font-weight: 600;
	}

	.record-link {
		color: var(--color-primary);
		font-size: var(--text-fluid-sm);
	}
</style>
