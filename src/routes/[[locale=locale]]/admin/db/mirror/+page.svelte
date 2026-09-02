<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { invalidate } from '$app/navigation';
import { Alert, Card, ConfirmDialog, DiagGrid, DiagRow } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Progress, Skeleton, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import type { BranchOperationStatus } from '$lib/server/dbops';
import type { ThresholdLevel } from '$lib/server/monitoring';
import { BranchOperationMonitor } from '$lib/state/branch-operation-monitor.svelte';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();
const toast = getToast();

const monitor = new BranchOperationMonitor();

// Destructive op → gate the submit behind a typed confirmation dialog.
let confirmOpen = $state(false);
let formEl: HTMLFormElement;

// Resume the monitor for an operation still in flight (e.g. after a page reload).
let seeded = $state(false);
$effect(() => {
	const inFlight = data.inFlight?.[0];
	if (inFlight && !seeded) {
		seeded = true;
		monitor.seed({ id: inFlight.id, status: inFlight.status, error: inFlight.error }, () => invalidate('admin:dbops'));
	}
});

const { enhance, delayed } = superForm(data.form, {
	onUpdated({ form }) {
		const msg = form.message as { ok: boolean; operationId?: string; error?: string } | undefined;
		if (!msg) return;
		if (msg.ok && msg.operationId) {
			toast.success(m.admin_dbops_toast_started());
			monitor.start(msg.operationId, () => invalidate('admin:dbops'));
		} else if (!msg.ok && msg.error) {
			toast.error(msg.error);
		}
	},
});

function formatBytes(bytes: number): string {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function timeAgo(iso: string): string {
	const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
	if (seconds < 60) return m.admin_db_time_just_now();
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return m.admin_db_time_minutes_ago({ minutes });
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return m.admin_db_time_hours_ago({ hours });
	const days = Math.floor(hours / 24);
	return m.admin_dbops_time_days_ago({ days });
}

function thresholdToProgressVariant(t: ThresholdLevel): 'default' | 'success' | 'warning' | 'error' {
	return t === 'ok' ? 'default' : t;
}

function statusVariant(s: BranchOperationStatus): 'default' | 'success' | 'error' | 'warning' | 'secondary' {
	if (s === 'succeeded') return 'success';
	if (s === 'failed') return 'error';
	if (s === 'canceled') return 'secondary';
	return 'warning'; // queued / running
}

function statusLabel(s: BranchOperationStatus): string {
	if (s === 'succeeded') return m.admin_dbops_status_succeeded();
	if (s === 'failed') return m.admin_dbops_status_failed();
	if (s === 'canceled') return m.admin_dbops_status_canceled();
	if (s === 'queued') return m.admin_dbops_status_queued();
	return m.admin_dbops_status_running();
}
</script>

{#if !data.configured}
	<Alert
		variant="warning"
		title={m.admin_dbops_not_configured_title()}
		description={m.admin_dbops_not_configured_desc()}
	/>
{:else}
	<Stack gap="6">
		<!-- Hero: refresh dev from prod -->
		<Card>
			{#snippet header()}
				<div class="flex items-center gap-2">
					<span class="i-lucide-refresh-cw provider-icon" aria-hidden="true"></span>
					<h2 class="text-fluid-base font-semibold">{m.admin_dbops_hero_title()}</h2>
				</div>
			{/snippet}
			{#snippet children()}
				<Stack gap="4">
					<p class="text-fluid-sm text-muted">{m.admin_dbops_hero_desc()}</p>

					<form method="POST" action="?/refresh" use:enhance bind:this={formEl}>
						<Button
							type="button"
							variant="primary"
							disabled={$delayed || monitor.isPolling}
							onclick={() => (confirmOpen = true)}
						>
							{#if $delayed || monitor.isPolling}
								<Spinner size="xs" class="mr-1" />
							{/if}
							<span class="i-lucide-arrow-down-to-line h-4 w-4 mr-1" aria-hidden="true"></span>
							{m.admin_dbops_refresh_button()}
						</Button>
					</form>

					{#if monitor.status}
						<div class="run-status">
							<Badge variant={statusVariant(monitor.status)}>{statusLabel(monitor.status)}</Badge>
							{#if monitor.isPolling}
								<span class="text-fluid-xs text-muted">{m.admin_dbops_operation_in_progress()}</span>
							{/if}
							{#if monitor.error}
								<span class="text-fluid-xs text-error">{monitor.error}</span>
							{/if}
						</div>
					{/if}

					<p class="text-fluid-xs text-muted oneway-note">
						<span class="i-lucide-info inline-block mr-1 align-middle" aria-hidden="true"></span>
						{m.admin_dbops_oneway_note()}
					</p>
				</Stack>
			{/snippet}
		</Card>

		{#if data.branchStatus}
			{#await data.branchStatus}
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-base font-semibold">{m.admin_dbops_branch_panel_title()}</h2>
					{/snippet}
					{#snippet children()}
						<div class="flex flex-col gap-4">
							<Skeleton variant="rectangular" height="0.625rem" />
							<Skeleton variant="text" width="80%" />
							<Skeleton variant="text" width="70%" />
							<Skeleton variant="text" width="60%" />
						</div>
					{/snippet}
				</Card>
			{:then result}
				<Card>
					{#snippet header()}
						<h2 class="text-fluid-base font-semibold">{m.admin_dbops_branch_panel_title()}</h2>
					{/snippet}
					{#snippet children()}
						{#if result.status === 'ok' && result.data}
							{@const d = result.data}
							<Stack gap="4">
								<DiagGrid>
									<DiagRow label={m.admin_dbops_label_branch()}><code>{d.devBranchName}</code></DiagRow>
									<DiagRow label={m.admin_dbops_label_parent()}><code>{d.parentBranchName}</code></DiagRow>
									<DiagRow label={m.admin_dbops_label_created()}>{timeAgo(d.devCreatedAt)}</DiagRow>
									<DiagRow label={m.admin_dbops_label_last_reset()}>{timeAgo(d.devUpdatedAt)}</DiagRow>
								</DiagGrid>

								<div>
									<div class="flex justify-between text-fluid-xs text-muted mb-1">
										<span>{m.admin_dbops_label_branches()}</span>
										<span>{d.branchCount} / {d.branchLimit}</span>
									</div>
									<Progress
										value={d.branchCount}
										max={d.branchLimit}
										variant={thresholdToProgressVariant(d.branchCountThreshold)}
										showLabel={false}
									/>
								</div>

								<div>
									<div class="flex justify-between text-fluid-xs text-muted mb-1">
										<span>{m.admin_db_label_storage()}</span>
										<span>{d.storagePercentage}%</span>
									</div>
									<Progress
										value={d.storagePercentage}
										max={100}
										variant={thresholdToProgressVariant(d.storageThreshold)}
										showLabel={false}
									/>
									<p class="text-fluid-xs text-muted mt-1">
										{formatBytes(d.storageBytes)} / {formatBytes(d.storageLimit)}
									</p>
								</div>
							</Stack>
						{:else}
							<Alert
								variant="warning"
								title={m.admin_dbops_branch_unavailable_title()}
								description={result.error ?? m.admin_dbops_branch_unavailable_title()}
							/>
						{/if}
					{/snippet}
				</Card>
			{:catch}
				<Card>
					{#snippet children()}
						<Alert
							variant="error"
							title={m.admin_dbops_branch_unavailable_title()}
							description={m.admin_dbops_branch_unavailable_title()}
						/>
					{/snippet}
				</Card>
			{/await}
		{/if}

		<ConfirmDialog
			bind:open={confirmOpen}
			title={m.admin_dbops_confirm_title()}
			description={m.admin_dbops_confirm_desc()}
			confirmLabel={m.admin_dbops_confirm_cta()}
			destructive
			onconfirm={() => {
				confirmOpen = false;
				formEl.requestSubmit();
			}}
			oncancel={() => (confirmOpen = false)}
		/>
	</Stack>
{/if}

<style>
	.provider-icon {
		width: 1.25rem;
		height: 1.25rem;
		color: var(--color-primary);
		flex-shrink: 0;
	}

	.run-status {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		flex-wrap: wrap;
	}

	.oneway-note {
		margin: 0;
	}
</style>
