<script lang="ts">
import type { SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { Alert, Card, DiagGrid, DiagRow, NavSection, ShowcaseLayout } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Select, Spinner } from '$lib/components/primitives';
import { CallFigures, CallHistory, EvaluationSteps, OutcomeBadge } from '$lib/components/showcases/external-service';
import * as m from '$lib/paraglide/messages';
import {
	EVALUATION_SCENARIO_IDS,
	type EvaluationScenarioId,
	type OrderEvaluation,
	type PublicServiceCall,
	type PublicTargetCheck,
	SERVICE_DRILL_IDS,
	type ServiceDrillId,
	type ServiceTargetId,
	startedDuringCheck,
} from '$lib/showcases/external-service/types';
import { getShowcaseCard } from '../showcases';

let { data, form } = $props();
const card = getShowcaseCard('/showcases/external-service');

const TARGET_LABELS: Record<ServiceTargetId, () => string> = {
	local: m.showcase_external_service_target_local,
	remote: m.showcase_external_service_target_remote,
};
const TARGET_HINTS: Record<ServiceTargetId, () => string> = {
	local: m.showcase_external_service_target_local_hint,
	remote: m.showcase_external_service_target_remote_hint,
};
const PROBLEMS = {
	incomplete: m.showcase_external_service_problem_incomplete,
	invalid_url: m.showcase_external_service_problem_invalid_url,
	not_an_origin: m.showcase_external_service_problem_not_an_origin,
	insecure_url: m.showcase_external_service_problem_insecure_url,
	short_token: m.showcase_external_service_problem_short_token,
} as const;
const SCENARIOS: Record<EvaluationScenarioId, () => string> = {
	fulfilled: m.showcase_external_service_scenario_fulfilled,
	partial_refund: m.showcase_external_service_scenario_partial_refund,
	ship_unpaid: m.showcase_external_service_scenario_ship_unpaid,
	overpaid: m.showcase_external_service_scenario_overpaid,
};
const DRILLS: Record<ServiceDrillId, { label: () => string; hint: () => string }> = {
	deadline: {
		label: m.showcase_external_service_drill_deadline,
		hint: m.showcase_external_service_drill_deadline_hint,
	},
	credential: {
		label: m.showcase_external_service_drill_credential,
		hint: m.showcase_external_service_drill_credential_hint,
	},
	unvalidated: {
		label: m.showcase_external_service_drill_unvalidated,
		hint: m.showcase_external_service_drill_unvalidated_hint,
	},
};
const REFUSALS = {
	rate_limited: m.showcase_external_service_refused_rate_limited,
	rejected: m.showcase_external_service_refused_rejected,
	invalid: m.showcase_external_service_refused_invalid,
} as const;

const configuredTargets = $derived(data.targets.filter((t) => t.setup === 'configured').map((t) => t.id));
const targetOptions = $derived(data.targets.map((t) => ({ value: t.id, label: TARGET_LABELS[t.id]() })));
const scenarioOptions = EVALUATION_SCENARIO_IDS.map((id) => ({ value: id, label: SCENARIOS[id]() }));

// The latest result per section: what an enhanced submit produced, falling back to what
// the server rendered for a no-JS submit (`form`). Enhanced submits never touch `form`,
// so one section's call never erases another's.
type Refusal = keyof typeof REFUSALS;
const rendered = $derived(form && 'kind' in form ? form : null);
let enhancedChecks = $state<Partial<Record<ServiceTargetId, PublicTargetCheck>>>({});
let enhancedEvaluation = $state<{ scenario: EvaluationScenarioId; call: PublicServiceCall<OrderEvaluation> } | null>(
	null,
);
let enhancedDrill = $state<{ drill: ServiceDrillId; call: PublicServiceCall } | null>(null);
let enhancedRefusal = $state<Refusal | null>(null);
let refusalDismissed = $state(false);

const checks = $derived<Partial<Record<ServiceTargetId, PublicTargetCheck>>>({
	...(rendered?.kind === 'check' ? { [rendered.check.live.target]: rendered.check } : {}),
	...enhancedChecks,
});
const evaluation = $derived(
	enhancedEvaluation ?? (rendered?.kind === 'evaluate' ? { scenario: rendered.scenario, call: rendered.call } : null),
);
const drill = $derived(
	enhancedDrill ?? (rendered?.kind === 'drill' ? { drill: rendered.drill, call: rendered.call } : null),
);
const refusal = $derived<Refusal | null>(
	refusalDismissed ? null : (enhancedRefusal ?? (form && 'refused' in form ? (form.refused as Refusal) : null)),
);

/** This browser session's calls, newest first. Measured, never stored, never invented. */
let history = $state<PublicServiceCall[]>([]);
let pending = $state<string | null>(null);

let evaluateTarget = $state<string>('local');
let evaluateScenario = $state<string>('fulfilled');
let drillTarget = $state<string>('local');

$effect.pre(() => {
	// Default the selects to a configured target once the page knows which exist.
	const first = configuredTargets[0];
	if (first && !configuredTargets.includes(evaluateTarget as ServiceTargetId)) evaluateTarget = first;
	if (first && !configuredTargets.includes(drillTarget as ServiceTargetId)) drillTarget = first;
});

function remember(...calls: Array<PublicServiceCall | null>) {
	const made = calls.filter((call): call is PublicServiceCall => call !== null);
	history = [...made.reverse(), ...history].slice(0, 20);
}

function submit(key: string): SubmitFunction {
	return () => {
		pending = key;
		enhancedRefusal = null;
		refusalDismissed = false;
		return async ({ result }) => {
			pending = null;
			if (result.type === 'failure') {
				enhancedRefusal = (result.data?.refused as Refusal | undefined) ?? 'invalid';
				return;
			}
			if (result.type !== 'success' || !result.data) return;
			const outcome = result.data as NonNullable<typeof form>;
			if (!('kind' in outcome)) return;
			if (outcome.kind === 'check') {
				enhancedChecks = { ...enhancedChecks, [outcome.check.live.target]: outcome.check };
				remember(outcome.check.live, outcome.check.status);
			} else if (outcome.kind === 'evaluate') {
				enhancedEvaluation = { scenario: outcome.scenario, call: outcome.call };
				remember(outcome.call);
			} else if (outcome.kind === 'drill') {
				enhancedDrill = { drill: outcome.drill, call: outcome.call };
				remember(outcome.call);
			}
		};
	};
}

function coldStart(check: PublicTargetCheck): boolean | null {
	if (!check.status?.data || !check.live.timing || !check.status.timing) return null;
	return startedDuringCheck(check.status.data.uptimeMs, check.live.timing.totalMs + check.status.timing.totalMs);
}

const sections = [
	{ id: 'es-targets', label: m.showcase_external_service_section_targets() },
	{ id: 'es-evaluate', label: m.showcase_external_service_section_evaluate() },
	{ id: 'es-drills', label: m.showcase_external_service_section_drills() },
	{ id: 'es-history', label: m.showcase_external_service_section_history() },
	{ id: 'es-boundary', label: m.showcase_external_service_section_boundary() },
];
</script>

{#snippet guard()}
	<input type="hidden" name="renderedAt" value={data.renderedAt} />
	<!-- Honeypot — visually hidden, must remain empty. -->
	<div class="honeypot" aria-hidden="true">
		<label>Bookmark <input name="bookmark" type="text" tabindex="-1" autocomplete="off" /></label>
	</div>
{/snippet}

<ShowcaseLayout {card}>
	<NavSection {sections} />

	<Stack gap="6">
		<p class="lede">{m.showcase_external_service_lede()}</p>

		<p class="path" aria-label={m.showcase_external_service_path_aria()}>
			<code>browser</code> → <code>+page.server.ts</code> → <code>client.ts</code> →
			<code>order-rules</code> <span class="path-note">({m.showcase_external_service_path_note()})</span>
		</p>

		{#if refusal}
			<Alert variant="warning" description={REFUSALS[refusal]()} closable onclose={() => (refusalDismissed = true)} />
		{/if}

		<!-- Targets -->
		<Card id="es-targets">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_external_service_section_targets()}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{m.showcase_external_service_targets_intro()}</p>
				<div class="targets">
					{#each data.targets as target (target.id)}
						{@const check = checks[target.id]}
						<section class="target" aria-labelledby={`es-target-${target.id}`}>
							<Cluster justify="between">
								<h3 id={`es-target-${target.id}`} class="font-semibold">{TARGET_LABELS[target.id]()}</h3>
								{#if target.setup === 'configured'}
									<Badge variant="default">{m.showcase_external_service_setup_configured()}</Badge>
								{:else if target.setup === 'misconfigured'}
									<Badge variant="warning">{m.showcase_external_service_setup_misconfigured()}</Badge>
								{:else}
									<Badge variant="muted">{m.showcase_external_service_setup_unconfigured()}</Badge>
								{/if}
							</Cluster>
							<p class="muted small">{TARGET_HINTS[target.id]()}</p>
							{#if target.problem}
								<p class="small">{PROBLEMS[target.problem]()}</p>
							{/if}

							<form method="POST" action="?/check" use:enhance={submit(`check-${target.id}`)}>
								<input type="hidden" name="target" value={target.id} />
								{@render guard()}
								<Button type="submit" variant="outline" size="sm" disabled={pending !== null}>
									{#if pending === `check-${target.id}`}<Spinner size="xs" class="mr-2" />{/if}
									<span class="i-lucide-activity h-4 w-4 mr-1"></span>
									{m.showcase_external_service_action_check()}
								</Button>
							</form>

							{#if check}
								<h4 class="subhead">{m.showcase_external_service_label_liveness()}</h4>
								<CallFigures call={check.live} />
								{#if check.live.outcome === 'timed_out' && target.id === 'remote'}
									<p class="small muted">{m.showcase_external_service_cold_start_hint()}</p>
								{/if}
								{#if check.status}
									<h4 class="subhead">{m.showcase_external_service_label_status()}</h4>
									{#if check.status.data}
										{@const woke = coldStart(check)}
										<DiagGrid>
											<DiagRow label={m.showcase_external_service_label_release()}>
												<code>{check.status.data.service} {check.status.data.release}</code>
											</DiagRow>
											<DiagRow label={m.showcase_external_service_label_uptime()}>
												<code>{Math.round(check.status.data.uptimeMs / 1000)} s</code>
											</DiagRow>
											{#if woke !== null}
												<DiagRow label={m.showcase_external_service_label_cold_start()}>
													{#if woke}
														<Badge variant="warning">{m.showcase_external_service_cold_start_observed()}</Badge>
													{:else}
														<Badge variant="secondary">{m.showcase_external_service_cold_start_warm()}</Badge>
													{/if}
												</DiagRow>
											{/if}
										</DiagGrid>
									{/if}
									<CallFigures call={check.status} />
								{/if}
							{/if}
						</section>
					{/each}
				</div>
			</Stack>
		</Card>

		<!-- Evaluate -->
		<Card id="es-evaluate">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_external_service_section_evaluate()}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{m.showcase_external_service_evaluate_intro()}</p>
				<form method="POST" action="?/evaluate" use:enhance={submit('evaluate')} class="controls">
					<label class="field">
						<span class="small">{m.showcase_external_service_field_target()}</span>
						<Select options={targetOptions} bind:value={evaluateTarget} />
					</label>
					<label class="field">
						<span class="small">{m.showcase_external_service_field_scenario()}</span>
						<Select options={scenarioOptions} bind:value={evaluateScenario} />
					</label>
					<input type="hidden" name="target" value={evaluateTarget} />
					<input type="hidden" name="scenario" value={evaluateScenario} />
					{@render guard()}
					<Button type="submit" disabled={pending !== null}>
						{#if pending === 'evaluate'}<Spinner size="xs" class="mr-2" />{/if}
						{m.showcase_external_service_action_evaluate()}
					</Button>
				</form>

				{#if evaluation}
					<p class="small muted">
						{TARGET_LABELS[evaluation.call.target]()} · {SCENARIOS[evaluation.scenario]()}
					</p>
					{#if evaluation.call.data}
						<EvaluationSteps evaluation={evaluation.call.data} />
					{/if}
					<CallFigures call={evaluation.call} />
				{/if}
			</Stack>
		</Card>

		<!-- Drills -->
		<Card id="es-drills">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_external_service_section_drills()}</h2>
			{/snippet}
			<Stack gap="4">
				<Alert variant="info" description={m.showcase_external_service_drills_notice()} />
				<label class="field">
					<span class="small">{m.showcase_external_service_field_target()}</span>
					<Select options={targetOptions} bind:value={drillTarget} />
				</label>
				<div class="drills">
					{#each SERVICE_DRILL_IDS as id (id)}
						<form method="POST" action="?/drill" use:enhance={submit(`drill-${id}`)} class="drill">
							<input type="hidden" name="target" value={drillTarget} />
							<input type="hidden" name="drill" value={id} />
							{@render guard()}
							<Button type="submit" variant="outline" size="sm" disabled={pending !== null}>
								{#if pending === `drill-${id}`}<Spinner size="xs" class="mr-2" />{/if}
								{DRILLS[id].label()}
							</Button>
							<p class="small muted">{DRILLS[id].hint()}</p>
						</form>
					{/each}
				</div>

				{#if drill}
					<p class="small muted">
						<Badge variant="outline">{m.showcase_external_service_drill_badge()}</Badge>
						{TARGET_LABELS[drill.call.target]()} · {DRILLS[drill.drill].label()}
					</p>
					<CallFigures call={drill.call} />
				{/if}
			</Stack>
		</Card>

		<!-- History -->
		<Card id="es-history">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_external_service_section_history()}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{m.showcase_external_service_history_note()}</p>
				{#if history.length > 0}
					<CallHistory calls={history} />
				{:else}
					<p class="small muted">{m.showcase_external_service_history_empty()}</p>
				{/if}
			</Stack>
		</Card>

		<!-- Boundary -->
		<Card id="es-boundary">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_external_service_section_boundary()}</h2>
			{/snippet}
			<ul class="boundary">
				<li>{m.showcase_external_service_boundary_contract()}</li>
				<li>{m.showcase_external_service_boundary_auth()}</li>
				<li>{m.showcase_external_service_boundary_targets()}</li>
				<li>{m.showcase_external_service_boundary_failures()}</li>
				<li>{m.showcase_external_service_boundary_optional()}</li>
				<li>{m.showcase_external_service_boundary_container()}</li>
			</ul>
		</Card>
	</Stack>
</ShowcaseLayout>

<style>
	.lede {
		font-size: var(--text-fluid-lg);
		max-width: 48rem;
	}

	.path {
		font-size: var(--text-fluid-sm);
	}

	.path-note,
	.muted {
		color: var(--color-muted);
	}

	.small {
		font-size: var(--text-fluid-sm);
	}

	.targets {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
		gap: var(--spacing-4);
	}

	.target {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.subhead {
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--spacing-3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 12rem;
	}

	.drills {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(min(100%, 16rem), 1fr));
		gap: var(--spacing-4);
	}

	.drill {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.boundary {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding-left: var(--spacing-5);
		list-style: disc;
	}

	/* Honeypot — keep accessible but invisible to humans + autofill blockers */
	.honeypot {
		position: absolute;
		left: -10000px;
		top: auto;
		width: 1px;
		height: 1px;
		overflow: hidden;
	}
</style>
