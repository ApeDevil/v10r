<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { Alert, Card, DiagGrid, DiagRow, StepUpDialog } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data, form } = $props();

let revoking = $state<string | null>(null);
let exporting = $state(false);
let deleting = $state(false);
let confirmDelete = $state(false);
let deleteConfirmText = $state('');

// Step-up: sensitive actions 403 with stepUpRequired when TOTP is enrolled
// and the freshness window has lapsed — the dialog verifies, then resubmits
// the original form so in-flight state (e.g. the typed DELETE) survives.
let stepUpOpen = $state(false);
let pendingStepUpForm = $state<HTMLFormElement | null>(null);

function interceptStepUp(result: ActionResult, formElement: HTMLFormElement): boolean {
	if (result.type === 'failure' && (result.data as { stepUpRequired?: boolean } | undefined)?.stepUpRequired) {
		pendingStepUpForm = formElement;
		stepUpOpen = true;
		return true;
	}
	return false;
}

function onStepUpVerified() {
	pendingStepUpForm?.requestSubmit();
	pendingStepUpForm = null;
}

// If export action returned data, trigger download
$effect(() => {
	if (form?.export) {
		const blob = new Blob([form.export], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = `velociraptor-data-${Date.now()}.json`;
		a.click();
		URL.revokeObjectURL(url);
	}
});
</script>
<Stack gap="6">
	<!-- Your Data (transparency mirror) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_data_link_title()}</h2>
		{/snippet}
		<p class="text-sm text-muted mb-4">{m.app_data_link_description()}</p>
		<Button href={localizeHref('/app/account/data')} variant="outline">
			<span class="i-lucide-scan-eye h-4 w-4 mr-1"></span>
			{m.app_data_link_button()}
		</Button>
	</Card>

	<!-- Security (passkeys + two-step verification) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_security_link_title()}</h2>
		{/snippet}
		<p class="text-sm text-muted mb-4">{m.app_security_link_description()}</p>
		<Button href={localizeHref('/app/account/security')} variant="outline">
			<span class="i-lucide-shield-check h-4 w-4 mr-1"></span>
			{m.app_security_link_button()}
		</Button>
	</Card>

	<!-- Active Sessions -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_account_heading_sessions()}</h2>
		{/snippet}

		<DiagGrid>
			{#each data.sessions as sess}
				<div class="session-row">
					<div class="session-info">
						<div class="flex items-center gap-2">
							<code class="font-mono text-fluid-xs">{sess.displayId}</code>
							{#if sess.isCurrent}
								<Badge variant="success">{m.app_account_session_badge_current()}</Badge>
							{/if}
						</div>
						{#if sess.ipAddress}
							<span class="text-xs text-muted">{m.app_account_session_ip({ ip: sess.ipAddress })}</span>
						{/if}
						<span class="text-xs text-muted">
							{m.app_account_session_expires({ date: new Date(sess.expiresAt).toLocaleDateString() })}
						</span>
					</div>
					{#if !sess.isCurrent}
						<form
							method="POST"
							action="?/revokeSession"
							use:enhance={({ formElement }) => {
								revoking = sess.id;
								return async ({ result, update }) => {
									if (!interceptStepUp(result, formElement)) await update();
									revoking = null;
								};
							}}
						>
							<input type="hidden" name="sessionId" value={sess.id} />
							<Button type="submit" variant="outline" size="sm" disabled={revoking === sess.id}>
								{#if revoking === sess.id}
									<Spinner size="xs" class="mr-1" />
								{/if}
								{m.app_account_session_revoke()}
							</Button>
						</form>
					{/if}
				</div>
			{/each}
		</DiagGrid>
	</Card>

	<!-- Linked Accounts -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_account_heading_linked_accounts()}</h2>
		{/snippet}

		<DiagGrid>
			{#each data.accounts as acc}
				<DiagRow label={acc.provider} class="capitalize">
					<Badge variant="success">{m.app_account_badge_connected()}</Badge>
				</DiagRow>
			{/each}
		</DiagGrid>
	</Card>

	<!-- Data Export -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_account_heading_export()}</h2>
		{/snippet}

		<p class="text-sm text-muted mb-4">
			{m.app_account_export_description()}
		</p>

		<form
			method="POST"
			action="?/exportData"
			use:enhance={({ formElement }) => {
				exporting = true;
				return async ({ result, update }) => {
					if (!interceptStepUp(result, formElement)) await update();
					exporting = false;
				};
			}}
		>
			<Button type="submit" variant="outline" disabled={exporting}>
				{#if exporting}
					<Spinner size="xs" class="mr-2" />
				{/if}
				<span class="i-lucide-download h-4 w-4 mr-1" ></span>
				{m.app_account_export_button()}
			</Button>
		</form>
	</Card>

	<!-- Delete Account -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold text-error">{m.app_account_heading_danger()}</h2>
		{/snippet}

		<p class="text-sm text-muted mb-4">
			{m.app_account_delete_description()}
		</p>

		{#if !confirmDelete}
			<Button variant="destructive" onclick={() => (confirmDelete = true)}>
				<span class="i-lucide-trash-2 h-4 w-4 mr-1" ></span>
				{m.app_account_delete_button()}
			</Button>
		{:else}
			<Alert variant="error" title={m.app_account_delete_confirm_title()}>
				{#snippet children()}
					<p>{m.app_account_delete_confirm_body()}</p>
					<p class="text-sm mt-2">{m.app_account_delete_confirm_instruction()}</p>
					<Input
						type="text"
						bind:value={deleteConfirmText}
						placeholder="DELETE"
						class="delete-confirm-input"
						autocomplete="off"
						aria-label={m.app_account_delete_confirm_aria()}
					/>
					<div class="flex gap-3 mt-4">
						<form
							method="POST"
							action="?/deleteAccount"
							use:enhance={({ formElement }) => {
								deleting = true;
								return async ({ result, update }) => {
									if (!interceptStepUp(result, formElement)) await update();
									deleting = false;
								};
							}}
						>
							<input type="hidden" name="confirmation" value={deleteConfirmText} />
							<Button type="submit" variant="destructive" disabled={deleting || deleteConfirmText !== 'DELETE'}>
								{#if deleting}
									<Spinner size="xs" class="mr-2" />
								{/if}
								{m.app_account_delete_confirm_submit()}
							</Button>
						</form>
						<Button variant="outline" onclick={() => { confirmDelete = false; deleteConfirmText = ''; }}>
							{m.admin_action_cancel()}
						</Button>
					</div>
				{/snippet}
			</Alert>
		{/if}
	</Card>
</Stack>

<StepUpDialog
	bind:open={stepUpOpen}
	onverified={onStepUpVerified}
	oncancel={() => (pendingStepUpForm = null)}
/>

<style>
	.session-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.session-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.session-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.delete-confirm-input {
		margin-top: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-error-fg);
		border-radius: var(--radius-sm);
		background-color: var(--color-surface-1);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
		width: 100%;
		max-width: 200px;
		outline: none;
	}
</style>
