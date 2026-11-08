<script lang="ts">
import { NavGrid } from '#lib/components/composites/index.ts';
import { Badge, LinkCard } from '#lib/components/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { findStudioArea, studioModeHref } from '#lib/studio/catalog.ts';
import {
	DECISION_CATALOG,
	ENGINEERING_DOMAIN_QUESTIONS,
	ENGINEERING_DOMAIN_TITLES,
	ENGINEERING_DOMAINS,
	EVIDENCE_KIND_LABELS,
	EVIDENCE_LABS,
} from '#patterns/architecture-engineering/index.ts';
import DecisionDetails from './_components/DecisionDetails.svelte';
import { evidenceHref } from './_components/links.ts';
import PatternLinks from './_components/PatternLinks.svelte';

const area = findStudioArea('architecture');

const principles = [
	m.studio_principle_explainable,
	m.studio_principle_alternatives,
	m.studio_principle_unknown,
	m.studio_principle_constraints,
	m.studio_principle_evidence,
	m.studio_principle_guarantees,
	m.studio_principle_simple,
	m.studio_principle_patterns,
	m.studio_principle_independent,
	m.studio_principle_reproducible,
];

const decisionsByDomain = ENGINEERING_DOMAINS.map((domain) => ({
	domain,
	decisions: DECISION_CATALOG.decisions.filter((decision) => decision.domain === domain),
}));
</script>

<div class="overview">
	<section class="intro">
		<p class="lead">{m.studio_architecture_lead()}</p>
		<ul class="roles">
			<li><strong>{m.studio_role_engineering_title()}</strong> {m.studio_role_engineering()}</li>
			<li><strong>{m.studio_role_patterns_title()}</strong> {m.studio_role_patterns()}</li>
			<li><strong>{m.studio_role_studio_title()}</strong> {m.studio_role_studio()}</li>
		</ul>
	</section>

	{#if area}
		<section aria-labelledby="modes-title">
			<h2 id="modes-title">{m.studio_overview_modes_title()}</h2>
			<NavGrid>
				{#each area.modes as mode}
					<LinkCard href={studioModeHref(area, mode)} icon={mode.icon} title={mode.label()} description={mode.description()} />
				{/each}
			</NavGrid>
		</section>
	{/if}

	<section aria-labelledby="principles-title">
		<h2 id="principles-title">{m.studio_overview_principles_title()}</h2>
		<p class="section-lead">{m.studio_overview_principles_lead()}</p>
		<ol class="principles">
			{#each principles as principle}
				<li>{principle()}</li>
			{/each}
		</ol>
	</section>

	<section aria-labelledby="decisions-title">
		<h2 id="decisions-title">{m.studio_overview_decisions_title()}</h2>
		<p class="section-lead">{m.studio_overview_decisions_lead()}</p>
		{#each decisionsByDomain as group}
			<div class="domain" id={`domain-${group.domain}`}>
				<h3>{ENGINEERING_DOMAIN_TITLES[group.domain]}</h3>
				<p class="domain-question">{ENGINEERING_DOMAIN_QUESTIONS[group.domain]}</p>
				{#each group.decisions as decision}
					<details class="decision" id={`decision-${decision.id}`}>
						<summary>
							<span class="decision-title">{decision.title}</span>
							<span class="decision-question">{decision.question}</span>
						</summary>
						<DecisionDetails {decision} />
					</details>
				{/each}
			</div>
		{/each}
	</section>

	<section aria-labelledby="labs-title">
		<h2 id="labs-title">{m.studio_overview_labs_title()}</h2>
		<p class="section-lead">{m.studio_overview_labs_lead()}</p>
		<div class="labs">
			{#each EVIDENCE_LABS as lab}
				<article class="lab" id={`lab-${lab.id}`}>
					<div class="lab-head">
						<h3>{lab.title}</h3>
						{#if lab.status === 'missing'}
							<Badge variant="warning">{m.studio_lab_missing()}</Badge>
						{:else}
							<Badge variant={lab.kind === 'measured' ? 'success' : 'default'}>{EVIDENCE_KIND_LABELS[lab.kind]}</Badge>
						{/if}
					</div>
					<p>{lab.question}</p>
					<p class="list-title">{m.studio_lab_accounts_for()}</p>
					<ul>{#each lab.accounts_for as item}<li>{item}</li>{/each}</ul>
					<p class="limitations"><strong>{m.studio_evidence_limitations()}</strong> {lab.limitations}</p>
					<ul class="lab-links">
						{#each lab.refs as entry}
							{@const link = evidenceHref(entry.ref)}
							<li>
								<a
									href={link.external ? link.href : localizeHref(link.href)}
									target={link.external ? '_blank' : undefined}
									rel={link.external ? 'noopener noreferrer' : undefined}>{entry.label}</a
								>
							</li>
						{/each}
					</ul>
					<PatternLinks ids={lab.patterns} />
				</article>
			{/each}
		</div>
	</section>
</div>

<style>
	.overview {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-7);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		scroll-margin-top: 5rem;
	}

	h2 {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
	}

	h3 {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.lead {
		font-size: var(--text-fluid-md);
		max-width: 70ch;
		margin: 0;
	}

	.roles,
	.principles {
		margin: 0;
		padding-left: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		max-width: 80ch;
	}

	.section-lead,
	.domain-question {
		color: var(--color-muted);
		max-width: 70ch;
		margin: 0;
	}

	.domain {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin-top: var(--spacing-3);
	}

	.decision {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
		background: var(--surface-1);
	}

	.decision summary {
		cursor: pointer;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.decision[open] summary {
		margin-bottom: var(--spacing-3);
	}

	.decision-title {
		font-weight: 600;
	}

	.decision-question {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.labs {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
		gap: var(--spacing-4);
	}

	.lab {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		background: var(--surface-1);
	}

	.lab p,
	.lab ul {
		margin: 0;
	}

	.lab ul {
		padding-left: var(--spacing-5);
	}

	.lab-head {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		align-items: center;
		justify-content: space-between;
	}

	.list-title {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
	}

	.limitations {
		font-size: var(--text-fluid-sm);
	}

	.lab-links a {
		color: var(--color-primary);
	}
</style>
