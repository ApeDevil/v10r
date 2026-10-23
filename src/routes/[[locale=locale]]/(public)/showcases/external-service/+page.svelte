<script lang="ts">
import type { SubmitFunction } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { Alert, Card, DiagGrid, DiagRow, NavSection, ShowcaseLayout } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Select, Spinner } from '$lib/components/primitives';
import { CallFigures, CallHistory, EvaluationSteps, OutcomeBadge } from '$lib/components/showcases/external-service';
import { startedDuringCheck } from '$lib/showcases/external-service/cold-start';
import {
	type CheckPatience,
	EVALUATION_PRESET_IDS,
	type EvaluationPresetId,
	type LabRejection,
	type OrderEvaluation,
	type PublicServiceCall,
	type PublicTargetCheck,
	SERVICE_DRILL_IDS,
	type ServiceDrillId,
	type ServiceTargetId,
} from '$lib/showcases/external-service/types';
import { getShowcaseCard } from '../showcases';

let { data, form } = $props();
const card = getShowcaseCard('/showcases/external-service');

/** Copy resolved on the server in the visitor's locale (`labels.ts`), not shipped per locale. */
const copy = $derived(data.copy);

const configuredTargets = $derived(data.targets.filter((t) => t.setup === 'configured').map((t) => t.id));
const targetOptions = $derived(data.targets.map((t) => ({ value: t.id, label: copy[`target_${t.id}`] })));
const presetOptions = $derived(EVALUATION_PRESET_IDS.map((id) => ({ value: id, label: copy[`preset_${id}`] })));

// The latest result per section: what an enhanced submit produced, falling back to what
// the server rendered for a no-JS submit (`form`). Enhanced submits never touch `form`,
// so one section's call never erases another's.
const rendered = $derived(form && 'kind' in form ? form : null);
let enhancedChecks = $state<Partial<Record<ServiceTargetId, PublicTargetCheck>>>({});
let enhancedEvaluation = $state<{ preset: EvaluationPresetId; call: PublicServiceCall<OrderEvaluation> } | null>(null);
let enhancedDrill = $state<{ drill: ServiceDrillId; call: PublicServiceCall } | null>(null);
let enhancedRejection = $state<LabRejection | null>(null);
let rejectionDismissed = $state(false);
/**
 * An enhanced action that produced no result. `answered`: the platform sent something other
 * than a result — an error page or a redirect (`status` when SvelteKit could read one); or
 * the request never got an answer at all. Earlier results stay on the page — this only says
 * the latest action did not land.
 */
let unfinished = $state<{ answered: boolean; status: number | null } | null>(null);

const checks = $derived<Partial<Record<ServiceTargetId, PublicTargetCheck>>>({
	...(rendered?.kind === 'check' ? { [rendered.check.live.target]: rendered.check } : {}),
	...enhancedChecks,
});
const evaluation = $derived(
	enhancedEvaluation ?? (rendered?.kind === 'evaluate' ? { preset: rendered.preset, call: rendered.call } : null),
);
const drill = $derived(
	enhancedDrill ?? (rendered?.kind === 'drill' ? { drill: rendered.drill, call: rendered.call } : null),
);
const rejection = $derived<LabRejection | null>(
	rejectionDismissed
		? null
		: (enhancedRejection ?? (form && 'rejected' in form ? (form.rejected as LabRejection) : null)),
);

/** This browser session's calls, newest first. Measured, never stored, never invented. */
let history = $state<PublicServiceCall[]>([]);
let pending = $state<string | null>(null);

let evaluateTarget = $state<string>('local');
let evaluatePreset = $state<string>('fulfilled');
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
	// Every outcome below clears `pending`. The one path that skips this callback is an
	// aborted submission — `enhance` aborts only through `controller`, which this page never
	// uses; a connection cut mid-request arrives here as an `error` result.
	return () => {
		pending = key;
		enhancedRejection = null;
		rejectionDismissed = false;
		unfinished = null;
		return async ({ result }) => {
			pending = null;
			if (result.type === 'failure') {
				enhancedRejection = (result.data?.rejected as LabRejection | undefined) ?? 'invalid';
				return;
			}
			// No lab action redirects, so a redirect is reported rather than followed.
			if (result.type === 'redirect') {
				unfinished = { answered: true, status: result.status };
				return;
			}
			if (result.type === 'error') {
				// `enhance` sets `status` only on a SvelteKit error result. A platform error page
				// (Vercel's 504 at the function's time limit is HTML) fails to deserialize — a
				// SyntaxError — while a fetch that got no answer at all rejects with a TypeError.
				const answered = result.status !== undefined || result.error instanceof SyntaxError;
				unfinished = { answered, status: result.status ?? null };
				return;
			}
			if (!result.data) return;
			const outcome = result.data as NonNullable<typeof form>;
			if (!('kind' in outcome)) return;
			if (outcome.kind === 'check') {
				enhancedChecks = { ...enhancedChecks, [outcome.check.live.target]: outcome.check };
				remember(outcome.check.live, outcome.check.status);
			} else if (outcome.kind === 'evaluate') {
				enhancedEvaluation = { preset: outcome.preset, call: outcome.call };
				remember(outcome.call);
			} else if (outcome.kind === 'drill') {
				enhancedDrill = { drill: outcome.drill, call: outcome.call };
				remember(outcome.call);
			}
		};
	};
}

/** Seconds a wake check has been waiting — a minute-long wait needs a visible pulse. */
let wakeSeconds = $state(0);
$effect(() => {
	if (!pending?.endsWith('-wake')) return;
	wakeSeconds = 0;
	const started = performance.now();
	const tick = setInterval(() => {
		wakeSeconds = Math.floor((performance.now() - started) / 1000);
	}, 1000);
	return () => clearInterval(tick);
});

function coldStart(check: PublicTargetCheck): boolean | null {
	if (!check.status?.data || !check.live.timing || !check.status.timing) return null;
	return startedDuringCheck(check.status.data.uptimeMs, check.live.timing.totalMs + check.status.timing.totalMs);
}

const PATIENCE: CheckPatience[] = ['normal', 'wake'];

const sections = $derived([
	{ id: 'es-targets', label: copy.section_targets },
	{ id: 'es-evaluate', label: copy.section_evaluate },
	{ id: 'es-drills', label: copy.section_drills },
	{ id: 'es-history', label: copy.section_history },
	{ id: 'es-boundary', label: copy.section_boundary },
]);
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
		<p class="lede">{copy.lede}</p>

		<p class="path" aria-label={copy.path_aria}>
			<code>browser</code> → <code>+page.server.ts</code> → <code>client.ts</code> →
			<code>runtime-lab</code> <span class="path-note">({copy.path_note})</span>
		</p>

		{#if rejection}
			<Alert variant="warning" description={copy[`rejected_${rejection}`]} closable onclose={() => (rejectionDismissed = true)} />
		{/if}
		{#if unfinished}
			<Alert
				variant="error"
				description={!unfinished.answered
					? copy.unfinished_network
					: unfinished.status === null
						? copy.unfinished_server
						: `${copy.unfinished_server} (HTTP ${unfinished.status})`}
				closable
				onclose={() => (unfinished = null)}
			/>
		{/if}

		<!-- Targets -->
		<Card id="es-targets">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{copy.section_targets}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{copy.targets_intro}</p>
				<div class="targets">
					{#each data.targets as target (target.id)}
						{@const check = checks[target.id]}
						<section class="target" aria-labelledby={`es-target-${target.id}`}>
							<Cluster justify="between">
								<h3 id={`es-target-${target.id}`} class="font-semibold">{copy[`target_${target.id}`]}</h3>
								{#if target.setup === 'configured'}
									<Badge variant="default">{copy.setup_configured}</Badge>
								{:else if target.setup === 'misconfigured'}
									<Badge variant="warning">{copy.setup_misconfigured}</Badge>
								{:else}
									<Badge variant="muted">{copy.setup_unconfigured}</Badge>
								{/if}
							</Cluster>
							<p class="muted small">{copy[`target_${target.id}_hint`]}</p>
							{#if target.problem}
								<p class="small">{copy[`problem_${target.problem}`]}</p>
							{/if}

							<Cluster gap="2">
								{#each PATIENCE as patience (patience)}
									<form method="POST" action="?/check" use:enhance={submit(`check-${target.id}-${patience}`)}>
										<input type="hidden" name="target" value={target.id} />
										<input type="hidden" name="patience" value={patience} />
										{@render guard()}
										<Button
											type="submit"
											variant={patience === 'normal' ? 'outline' : 'ghost'}
											size="sm"
											disabled={pending !== null}
										>
											{#if pending === `check-${target.id}-${patience}`}<Spinner size="xs" class="mr-2" />{/if}
											{#if patience === 'normal'}
												<span class="i-lucide-activity h-4 w-4 mr-1"></span>
												{copy.action_check}
											{:else}
												<span class="i-lucide-alarm-clock h-4 w-4 mr-1"></span>
												{copy.action_wake}
											{/if}
										</Button>
									</form>
								{/each}
							</Cluster>
							<p class="small muted" aria-live="polite">
								{#if pending === `check-${target.id}-wake`}{copy.wake_pending} {wakeSeconds} s{/if}
							</p>

							{#if check}
								<h4 class="subhead">{copy.label_liveness}</h4>
								<CallFigures call={check.live} {copy} />
								{#if check.live.outcome === 'timed_out' && target.id === 'remote'}
									<p class="small muted">{copy.cold_start_hint}</p>
								{/if}
								{#if check.status}
									<h4 class="subhead">{copy.label_status}</h4>
									{#if check.status.data}
										{@const woke = coldStart(check)}
										<DiagGrid>
											<DiagRow label={copy.label_release}>
												<code>{check.status.data.service} {check.status.data.release}</code>
											</DiagRow>
											{#if check.contractSkew}
												<DiagRow label={copy.label_contract}>
													<span class:muted={check.contractSkew === 'none'}>{copy[`skew_${check.contractSkew}`]}</span>
												</DiagRow>
											{/if}
											<DiagRow label={copy.label_uptime}>
												<code>{Math.round(check.status.data.uptimeMs / 1000)} s</code>
											</DiagRow>
											{#if woke !== null}
												<DiagRow label={copy.label_cold_start}>
													{#if woke}
														<Badge variant="warning">{copy.cold_start_observed}</Badge>
													{:else}
														<Badge variant="secondary">{copy.cold_start_warm}</Badge>
													{/if}
												</DiagRow>
											{/if}
										</DiagGrid>
									{/if}
									<CallFigures call={check.status} {copy} />
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
				<h2 class="text-fluid-lg font-semibold">{copy.section_evaluate}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{copy.evaluate_intro}</p>
				<form method="POST" action="?/evaluate" use:enhance={submit('evaluate')} class="controls">
					<label class="field">
						<span class="small">{copy.field_target}</span>
						<Select options={targetOptions} bind:value={evaluateTarget} />
					</label>
					<label class="field">
						<span class="small">{copy.field_preset}</span>
						<Select options={presetOptions} bind:value={evaluatePreset} />
					</label>
					<input type="hidden" name="target" value={evaluateTarget} />
					<input type="hidden" name="preset" value={evaluatePreset} />
					{@render guard()}
					<Button type="submit" disabled={pending !== null}>
						{#if pending === 'evaluate'}<Spinner size="xs" class="mr-2" />{/if}
						{copy.action_evaluate}
					</Button>
				</form>

				{#if evaluation}
					<p class="small muted">
						{copy[`target_${evaluation.call.target}`]} · {copy[`preset_${evaluation.preset}`]}
					</p>
					{#if evaluation.call.data}
						<EvaluationSteps evaluation={evaluation.call.data} {copy} />
					{/if}
					<CallFigures call={evaluation.call} {copy} />
				{/if}
			</Stack>
		</Card>

		<!-- Drills -->
		<Card id="es-drills">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{copy.section_drills}</h2>
			{/snippet}
			<Stack gap="4">
				<Alert variant="info" description={copy.drills_notice} />
				<label class="field">
					<span class="small">{copy.field_target}</span>
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
								{copy[`drill_${id}`]}
							</Button>
							<p class="small muted">{copy[`drill_${id}_hint`]}</p>
						</form>
					{/each}
				</div>

				{#if drill}
					<p class="small muted">
						<Badge variant="outline">{copy.drill_badge}</Badge>
						{copy[`target_${drill.call.target}`]} · {copy[`drill_${drill.drill}`]}
					</p>
					<CallFigures call={drill.call} {copy} />
				{/if}
			</Stack>
		</Card>

		<!-- History -->
		<Card id="es-history">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{copy.section_history}</h2>
			{/snippet}
			<Stack gap="4">
				<p class="muted">{copy.history_note}</p>
				{#if history.length > 0}
					<CallHistory calls={history} {copy} />
				{:else}
					<p class="small muted">{copy.history_empty}</p>
				{/if}
			</Stack>
		</Card>

		<!-- Boundary -->
		<Card id="es-boundary">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{copy.section_boundary}</h2>
			{/snippet}
			<ul class="boundary">
				<li>{copy.boundary_contract}</li>
				<li>{copy.boundary_auth}</li>
				<li>{copy.boundary_targets}</li>
				<li>{copy.boundary_failures}</li>
				<li>{copy.boundary_optional}</li>
				<li>{copy.boundary_container}</li>
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
