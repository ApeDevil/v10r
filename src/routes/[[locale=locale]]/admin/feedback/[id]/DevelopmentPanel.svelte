<script lang="ts">
import { Alert, Card, ConfirmDialog } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Button, Checkbox, Input, Select, Tag, Textarea } from '#lib/components/primitives/index.ts';
import type { FeedbackStatus } from '#lib/feedback/status.ts';
import { formatRelative } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';

interface ReportView {
	headSha: string;
	approvedScope: string;
	scopeExceeded: boolean;
	summary: string;
	validation: { validate: string; validateBuild: string; browser: string; notes?: string };
	performance: string;
	security: string;
	databaseChanges: string;
	externalConsumption: string;
	limitations: string;
	recommendation: string;
}

interface DevelopmentView {
	branch: string;
	scope: string;
	includeSubmitterText: boolean;
	approvedAt: Date;
	reportedSha: string | null;
	report: ReportView | null;
	reportedAt: Date | null;
	reportRevision: number;
	withdrawnReleaseSha: string | null;
	releaseApprovedSha: string | null;
	releaseApprovedAt: Date | null;
	releasedSha: string | null;
	releasedAt: Date | null;
	releaseVerification: 'live_version' | 'maintainer' | null;
	runningShaAtRelease: string | null;
}

interface Props {
	status: FeedbackStatus;
	erased: boolean;
	development: DevelopmentView | null;
	brief: string | null;
	handoff: string | null;
	activeDevelopmentId: string | null;
	developmentAttempts: number;
	releaseBlockers: string[];
}

let { status, erased, development, brief, handoff, activeDevelopmentId, developmentAttempts, releaseBlockers }: Props =
	$props();

let scope = $state('');
let slug = $state('');
let agent = $state('claude');
let includeText = $state(false);
let reportPaste = $state('');
let receiptPaste = $state('');
let maintainerConfirmed = $state(false);
let confirmReturnOpen = $state(false);
let copied = $state<'brief' | 'handoff' | null>(null);

const agentOptions = [
	{ value: 'claude', label: 'claude/cloud/…' },
	{ value: 'codex', label: 'codex/cloud/…' },
];

const inDevelopment = $derived(['in_development', 'ready_for_review', 'release_approved'].includes(status));

async function copy(text: string, which: 'brief' | 'handoff') {
	try {
		await navigator.clipboard.writeText(text);
		copied = which;
	} catch {
		copied = null;
	}
}

function claimLabel(result: string) {
	if (result === 'passed') return m.admin_feedback_dev_check_passed();
	if (result === 'failed') return m.admin_feedback_dev_check_failed();
	if (result === 'not_applicable') return m.admin_feedback_dev_check_not_applicable();
	return m.admin_feedback_dev_check_not_run();
}

function blockerLabel(blocker: string) {
	if (blocker === 'validate_not_passed') return m.admin_feedback_dev_blocker_validate_not_passed();
	if (blocker === 'validate_build_not_passed') return m.admin_feedback_dev_blocker_validate_build_not_passed();
	if (blocker === 'browser_not_passed') return m.admin_feedback_dev_blocker_browser_not_passed();
	if (blocker === 'scope_exceeded') return m.admin_feedback_dev_blocker_scope_exceeded();
	if (blocker === 'needs_decision') return m.admin_feedback_dev_blocker_needs_decision();
	return m.admin_feedback_dev_blocker_not_recommended();
}

function recommendationLabel(value: string) {
	if (value === 'release') return m.admin_feedback_dev_recommend_release();
	if (value === 'do_not_release') return m.admin_feedback_dev_recommend_do_not_release();
	return m.admin_feedback_dev_recommend_needs_decision();
}
</script>

{#if status === 'accepted'}
	<Card>
		<h2 class="card-h2">{m.admin_feedback_dev_gate1_heading()}</h2>
		{#if activeDevelopmentId}
			<Alert variant="info" title={m.admin_feedback_dev_slot_taken()}>
				<a href={`/admin/feedback/${activeDevelopmentId}`}><code>{activeDevelopmentId}</code></a>
			</Alert>
		{:else}
			{#if developmentAttempts > 0}
				<Alert variant="info" title={m.admin_feedback_dev_previous_attempts({ next: developmentAttempts + 1 })} />
			{/if}
			<form method="POST" action="?/approveDevelopment" use:enhance class="dev-form">
				<label class="field-label" for="dev-scope">{m.admin_feedback_dev_scope_label()}</label>
				<p class="hint">{m.admin_feedback_dev_scope_hint()}</p>
				<Textarea id="dev-scope" name="scope" bind:value={scope} rows={6} maxlength={8000} required />
				<div class="branch-row">
					<div class="branch-agent">
						<span class="field-label">{m.admin_feedback_dev_agent_label()}</span>
						<Select options={agentOptions} value={agent} onchange={(value) => (agent = value)} />
						<input type="hidden" name="agent" value={agent} />
					</div>
					<div class="branch-slug">
						<label class="field-label" for="dev-slug">{m.admin_feedback_dev_slug_label()}</label>
						<Input id="dev-slug" name="slug" bind:value={slug} placeholder="fix-mobile-nav" maxlength={40} required />
					</div>
				</div>
				<Checkbox name="includeSubmitterText" bind:checked={includeText} label={m.admin_feedback_dev_include_text()} disabled={erased} />
				<p class="hint">{m.admin_feedback_dev_include_text_hint()}</p>
				<div class="action-row">
					<Button type="submit" variant="primary" size="sm" disabled={!scope.trim() || !slug.trim()}>
						{m.admin_feedback_dev_approve_development()}
					</Button>
				</div>
			</form>
		{/if}
	</Card>
{/if}

{#if development}
	<Card>
		<h2 class="card-h2">{m.admin_feedback_dev_heading()}</h2>
		<Stack gap="4">
			<dl class="dev-grid">
				<dt>{m.admin_feedback_dev_branch()}</dt>
				<dd><code>{development.branch}</code></dd>
				<dt>{m.admin_feedback_dev_approved()}</dt>
				<dd>{formatRelative(development.approvedAt, page.data.locale)}</dd>
				{#if development.reportedSha}
					<dt>{m.admin_feedback_dev_reported_sha()}</dt>
					<dd><code>{development.reportedSha}</code></dd>
				{/if}
				{#if development.releaseApprovedSha}
					<dt>{m.admin_feedback_dev_release_approved_sha()}</dt>
					<dd><code>{development.releaseApprovedSha}</code></dd>
				{/if}
				{#if development.releasedSha}
					<dt>{m.admin_feedback_dev_released_sha()}</dt>
					<dd><code>{development.releasedSha}</code></dd>
				{/if}
			</dl>

			{#if inDevelopment}
				<p class="hint">{m.admin_feedback_dev_not_observed()}</p>
			{/if}

			{#if development.withdrawnReleaseSha && status !== 'release_approved'}
				<Alert
					variant="warning"
					title={m.admin_feedback_dev_handoff_withdrawn({ sha: development.withdrawnReleaseSha.slice(0, 12) })}
				/>
			{/if}

			{#if brief && status === 'in_development'}
				<div class="text-block">
					<div class="action-row">
						<span class="field-label">{m.admin_feedback_dev_brief_heading()}</span>
						<Button variant="outline" size="sm" onclick={() => copy(brief, 'brief')}>
							{copied === 'brief' ? m.admin_feedback_dev_copied() : m.admin_feedback_dev_copy_brief()}
						</Button>
					</div>
					<pre class="handoff-text" data-testid="development-brief">{brief}</pre>
				</div>
			{/if}

			{#if development.report}
				<div class="report">
					<div class="action-row">
						<span class="field-label">{m.admin_feedback_dev_report_heading()}</span>
						<Tag variant="secondary" size="sm">{m.admin_feedback_dev_reported_claim()}</Tag>
						{#if development.reportedAt}<span class="hint">{formatRelative(development.reportedAt, page.data.locale)}</span>{/if}
					</div>
					{#if development.report.scopeExceeded}
						<Alert variant="warning" title={m.admin_feedback_dev_scope_exceeded()} />
					{/if}
					<dl class="dev-grid">
						<dt>{m.admin_feedback_dev_recommendation()}</dt>
						<dd><strong>{recommendationLabel(development.report.recommendation)}</strong></dd>
						<dt>validate</dt>
						<dd>{claimLabel(development.report.validation.validate)}</dd>
						<dt>validate:build</dt>
						<dd>{claimLabel(development.report.validation.validateBuild)}</dd>
						<dt>{m.admin_feedback_dev_browser()}</dt>
						<dd>{claimLabel(development.report.validation.browser)}</dd>
						{#if development.report.validation.notes}
							<dt>{m.admin_feedback_dev_validation_notes()}</dt>
							<dd class="prose-text">{development.report.validation.notes}</dd>
						{/if}
						<dt>{m.admin_feedback_dev_approved_scope()}</dt>
						<dd class="prose-text">{development.report.approvedScope}</dd>
						<dt>{m.admin_feedback_dev_summary()}</dt>
						<dd class="prose-text">{development.report.summary}</dd>
						<dt>{m.admin_feedback_dev_performance()}</dt>
						<dd class="prose-text">{development.report.performance}</dd>
						<dt>{m.admin_feedback_dev_security()}</dt>
						<dd class="prose-text">{development.report.security}</dd>
						<dt>{m.admin_feedback_dev_database()}</dt>
						<dd class="prose-text">{development.report.databaseChanges}</dd>
						<dt>{m.admin_feedback_dev_consumption()}</dt>
						<dd class="prose-text">{development.report.externalConsumption}</dd>
						<dt>{m.admin_feedback_dev_limitations()}</dt>
						<dd class="prose-text">{development.report.limitations}</dd>
					</dl>
					<p class="hint">{m.admin_feedback_dev_claim_note()}</p>
				</div>
			{/if}

			{#if status === 'ready_for_review' && development.reportedSha && releaseBlockers.length > 0}
				<Alert variant="warning" title={m.admin_feedback_dev_blockers_title()}>
					<ul class="blocker-list">
						{#each releaseBlockers as blocker (blocker)}<li>{blockerLabel(blocker)}</li>{/each}
					</ul>
				</Alert>
			{:else if status === 'ready_for_review' && development.reportedSha}
				<form method="POST" action="?/approveRelease" use:enhance class="action-row">
					<input type="hidden" name="reviewedSha" value={development.reportedSha} />
					<input type="hidden" name="reviewedRevision" value={development.reportRevision} />
					<Button type="submit" variant="primary" size="sm">
						{m.admin_feedback_dev_approve_release({ sha: development.reportedSha.slice(0, 12) })}
					</Button>
				</form>
			{/if}

			{#if handoff && status === 'release_approved'}
				<div class="text-block">
					<div class="action-row">
						<span class="field-label">{m.admin_feedback_dev_handoff_heading()}</span>
						<Button variant="outline" size="sm" onclick={() => copy(handoff, 'handoff')}>
							{copied === 'handoff' ? m.admin_feedback_dev_copied() : m.admin_feedback_dev_copy_handoff()}
						</Button>
					</div>
					<pre class="handoff-text" data-testid="release-handoff">{handoff}</pre>
					<p class="hint">{m.admin_feedback_dev_handoff_note()}</p>
				</div>

				<form method="POST" action="?/confirmRelease" use:enhance class="dev-form">
					<label class="field-label" for="dev-receipt">{m.admin_feedback_dev_receipt_label()}</label>
					<Textarea id="dev-receipt" name="receipt" bind:value={receiptPaste} rows={6} maxlength={60000} />
					<Checkbox name="maintainerConfirmed" bind:checked={maintainerConfirmed} label={m.admin_feedback_dev_maintainer_confirm()} />
					<p class="hint">{m.admin_feedback_dev_maintainer_confirm_hint()}</p>
					<div class="action-row">
						<Button type="submit" variant="primary" size="sm" disabled={!receiptPaste.trim()}>
							{m.admin_feedback_dev_confirm_release()}
						</Button>
					</div>
				</form>
			{/if}

			{#if inDevelopment}
				<form method="POST" action="?/recordReport" use:enhance class="dev-form">
					<label class="field-label" for="dev-report">{m.admin_feedback_dev_report_label()}</label>
					<p class="hint">
						{status === 'release_approved' ? m.admin_feedback_dev_report_hint_invalidates() : m.admin_feedback_dev_report_hint()}
					</p>
					<Textarea id="dev-report" name="report" bind:value={reportPaste} rows={6} maxlength={60000} />
					<div class="action-row">
						<Button type="submit" variant="outline" size="sm" disabled={!reportPaste.trim()}>
							{m.admin_feedback_dev_record_report()}
						</Button>
					</div>
				</form>

				<div class="action-row">
					{#if status !== 'in_development'}
						<form method="POST" action="?/rework" use:enhance class="inline-form">
							<Button type="submit" variant="outline" size="sm">{m.admin_feedback_dev_rework()}</Button>
						</form>
					{/if}
					<Button variant="ghost" size="sm" onclick={() => (confirmReturnOpen = true)}>
						{m.admin_feedback_dev_return()}
					</Button>
				</div>
			{/if}

			{#if status === 'released' && development.releasedAt}
				<p class="hint">
					{development.releaseVerification === 'live_version'
						? m.admin_feedback_dev_released_live()
						: m.admin_feedback_dev_released_maintainer({ running: development.runningShaAtRelease?.slice(0, 12) ?? '—' })}
				</p>
			{/if}
		</Stack>
	</Card>

	<ConfirmDialog
		bind:open={confirmReturnOpen}
		title={m.admin_feedback_dev_return_title()}
		description={m.admin_feedback_dev_return_description()}
		confirmLabel={m.admin_feedback_dev_return()}
		destructive
		onconfirm={async () => {
			await fetch('?/returnForAnalysis', { method: 'POST', body: new FormData(), headers: { 'x-requested-with': 'fetch' } });
			confirmReturnOpen = false;
			await invalidateAll();
		}}
		oncancel={() => (confirmReturnOpen = false)}
	/>
{/if}

<style>
	.blocker-list {
		margin: var(--spacing-2) 0 0 0;
		padding-left: var(--spacing-5);
	}
	.card-h2 {
		margin: 0 0 var(--spacing-3) 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.dev-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.field-label {
		font-size: var(--text-fluid-xs);
		font-weight: 600;
		color: var(--color-fg);
	}

	.hint {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.branch-row {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.branch-agent,
	.branch-slug {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 12rem;
		flex: 1;
	}

	.action-row {
		display: flex;
		gap: var(--spacing-2);
		flex-wrap: wrap;
		align-items: center;
	}

	.inline-form {
		display: inline;
	}

	.dev-grid {
		display: grid;
		grid-template-columns: max-content 1fr;
		gap: var(--spacing-2) var(--spacing-4);
		margin: 0;
		font-size: var(--text-fluid-sm);
	}

	.dev-grid dt {
		color: var(--color-muted);
	}

	.dev-grid dd {
		margin: 0;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.prose-text {
		white-space: pre-wrap;
	}

	.text-block,
	.report {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.handoff-text {
		margin: 0;
		max-height: 20rem;
		overflow: auto;
		padding: var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		font-family: var(--font-mono);
		font-size: var(--text-fluid-xs);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	@media (max-width: 40rem) {
		.dev-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
