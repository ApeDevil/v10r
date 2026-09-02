<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { page } from '$app/state';
import { authClient } from '$lib/auth-client';
import { Card, ConfirmDialog, DiagGrid, StepUpDialog } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import { formatDate } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data } = $props();

const toast = getToast();

let addingPasskey = $state(false);
let newPasskeyName = $state('');
let renamingId = $state<string | null>(null);
let renameValue = $state('');
let savingRename = $state(false);
let deleteTarget = $state<{ id: string; label: string } | null>(null);
let confirmDeleteOpen = $state(false);
let deletingPasskey = $state(false);

function passkeyLabel(p: (typeof data.passkeys)[number]): string {
	return p.name || p.authenticatorLabel || m.account_security_passkey_unnamed();
}

/** WebAuthn user-cancel surfaces as a NotAllowedError — a dismissal, not a failure. */
function isCeremonyCancel(message: string | undefined): boolean {
	return !!message && /not.?allowed|abort/i.test(message);
}

async function addPasskey() {
	if (addingPasskey) return;
	addingPasskey = true;

	try {
		const result = await authClient.passkey.addPasskey({ name: newPasskeyName.trim() || undefined });
		if (result?.error) {
			if (!isCeremonyCancel(result.error.message)) {
				toast.error(result.error.message ?? m.account_security_passkey_add_failed());
			}
		} else {
			toast.success(m.account_security_passkey_added());
			newPasskeyName = '';
			await invalidateAll();
		}
	} catch (err) {
		if (!isCeremonyCancel(err instanceof Error ? err.message : undefined)) {
			toast.error(m.account_security_passkey_add_failed());
		}
	} finally {
		addingPasskey = false;
	}
}

function startRename(p: (typeof data.passkeys)[number]) {
	renamingId = p.id;
	renameValue = p.name ?? '';
}

async function saveRename() {
	if (!renamingId || savingRename) return;
	savingRename = true;

	const result = await authClient.passkey.updatePasskey({ id: renamingId, name: renameValue.trim() });
	if (result.error) {
		toast.error(result.error.message ?? m.account_security_passkey_rename_failed());
	} else {
		renamingId = null;
		await invalidateAll();
	}
	savingRename = false;
}

function requestDelete(p: (typeof data.passkeys)[number]) {
	deleteTarget = { id: p.id, label: passkeyLabel(p) };
	confirmDeleteOpen = true;
}

async function deletePasskey() {
	if (!deleteTarget || deletingPasskey) return;
	deletingPasskey = true;

	const result = await authClient.passkey.deletePasskey({ id: deleteTarget.id });
	if (result.error) {
		toast.error(result.error.message ?? m.account_security_passkey_delete_failed());
	} else {
		toast.success(m.account_security_passkey_deleted());
		await invalidateAll();
	}
	deletingPasskey = false;
	confirmDeleteOpen = false;
	deleteTarget = null;
}

type TotpFlow =
	| { step: 'idle' }
	| { step: 'starting' }
	| { step: 'confirm'; totpURI: string; qrSvg: string | null; backupCodes: string[]; code: string; verifying: boolean };

let totpFlow = $state<TotpFlow>({ step: 'idle' });
let stepUpOpen = $state(false);
let stepUpAction = $state<'disable' | 'regenerate' | null>(null);
let disabling = $state(false);
let freshBackupCodes = $state<string[] | null>(null);

let revoking = $state<string | null>(null);
// Server actions 403 with stepUpRequired when TOTP is enrolled and the freshness
// window has lapsed — the dialog verifies, then resubmits the original form.
let pendingStepUpForm = $state<HTMLFormElement | null>(null);

function interceptStepUp(result: ActionResult, formElement: HTMLFormElement): boolean {
	if (result.type === 'failure' && (result.data as { stepUpRequired?: boolean } | undefined)?.stepUpRequired) {
		pendingStepUpForm = formElement;
		stepUpOpen = true;
		return true;
	}
	return false;
}

/**
 * Extract the Base32 secret from an otpauth:// URI. Split + URLSearchParams
 * instead of new URL() — WHATWG parsing of non-special schemes is inconsistent
 * in older WebKit.
 */
function totpSecretFromUri(uri: string): string | null {
	const qs = uri.split('?')[1];
	if (!qs) return null;
	return new URLSearchParams(qs).get('secret');
}

const totpSecret = $derived(totpFlow.step === 'confirm' ? totpSecretFromUri(totpFlow.totpURI) : null);

async function fetchQr(totpURI: string): Promise<string | null> {
	try {
		const res = await fetch('/api/account/two-factor/qr', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'fetch' },
			body: JSON.stringify({ totpURI }),
		});
		if (!res.ok) return null;
		const body = await res.json();
		return body.data?.svg ?? null;
	} catch {
		return null;
	}
}

async function startTotpEnable() {
	if (totpFlow.step !== 'idle' || data.twoFactorEnabled) return;
	totpFlow = { step: 'starting' };

	// enable() is NOT idempotent — a second call rotates the secret and breaks
	// an authenticator that already scanned the first QR. The flow state keeps
	// the button unreachable while enrollment is in progress.
	const result = await authClient.twoFactor.enable({});
	if (result.error || !result.data) {
		toast.error(result.error?.message ?? m.account_security_totp_enable_failed());
		totpFlow = { step: 'idle' };
		return;
	}

	const { totpURI, backupCodes } = result.data;
	totpFlow = {
		step: 'confirm',
		totpURI,
		qrSvg: await fetchQr(totpURI),
		backupCodes,
		code: '',
		verifying: false,
	};
}

async function confirmTotpEnrollment() {
	if (totpFlow.step !== 'confirm' || totpFlow.verifying) return;
	const code = totpFlow.code.trim();
	if (!code) return;
	totpFlow.verifying = true;

	const result = await authClient.twoFactor.verifyTotp({ code });
	if (result.error) {
		toast.error(result.error.message ?? m.account_security_totp_code_invalid());
		totpFlow.verifying = false;
		return;
	}

	// Enrollment rotates the session cookie — refresh past the cookie cache
	// before the page revalidates, or the UI keeps showing the stale state.
	await authClient.getSession({ query: { disableCookieCache: true } });
	toast.success(m.account_security_totp_enabled());
	totpFlow = { step: 'idle' };
	await invalidateAll();
}

function cancelTotpEnrollment() {
	// The unverified secret row stays server-side but is unusable (verified=false);
	// restarting enrollment issues a fresh secret.
	totpFlow = { step: 'idle' };
}

function requestStepUp(action: 'disable' | 'regenerate') {
	stepUpAction = action;
	stepUpOpen = true;
}

async function onStepUpVerified() {
	// Form-action path (session revoke): replay the intercepted submit.
	if (pendingStepUpForm) {
		pendingStepUpForm.requestSubmit();
		pendingStepUpForm = null;
		return;
	}

	const action = stepUpAction;
	stepUpAction = null;

	if (action === 'disable') {
		disabling = true;
		const result = await authClient.twoFactor.disable({});
		if (result.error) {
			toast.error(result.error.message ?? m.account_security_totp_disable_failed());
		} else {
			await authClient.getSession({ query: { disableCookieCache: true } });
			toast.success(m.account_security_totp_disabled());
			await invalidateAll();
		}
		disabling = false;
	} else if (action === 'regenerate') {
		const result = await authClient.twoFactor.generateBackupCodes({});
		if (result.error || !result.data) {
			toast.error(result.error?.message ?? m.account_security_backup_regenerate_failed());
		} else {
			freshBackupCodes = result.data.backupCodes;
			toast.success(m.account_security_backup_regenerated());
		}
	}
}

async function copyText(text: string, successMessage: string) {
	try {
		await navigator.clipboard.writeText(text);
		toast.success(successMessage);
	} catch {
		toast.error(m.account_security_backup_copy_failed());
	}
}

function copyCodes(codes: string[]) {
	return copyText(codes.join('\n'), m.account_security_backup_copied());
}

function formatPasskeyDate(iso: string | null): string {
	return iso ? formatDate(new Date(iso), page.data.locale) : '—';
}
</script>

<Stack gap="6">
	{#if data.passkeysEnabled}
		<!-- Passkeys -->
		<Card>
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.account_security_heading_passkeys()}</h2>
			{/snippet}

			<p class="text-sm text-muted mb-4">{m.account_security_passkeys_description()}</p>

			{#if data.passkeys.length > 0}
				<DiagGrid>
					{#each data.passkeys as pk (pk.id)}
						<div class="passkey-row">
							<div class="passkey-info">
								{#if renamingId === pk.id}
									<div class="flex items-center gap-2">
										<Input
											bind:value={renameValue}
											placeholder={m.account_security_passkey_name_placeholder()}
											aria-label={m.account_security_passkey_rename()}
											disabled={savingRename}
										/>
										<Button size="sm" onclick={saveRename} disabled={savingRename}>
											{#if savingRename}<Spinner size="xs" class="mr-1" />{/if}
											{m.account_security_passkey_rename_save()}
										</Button>
										<Button size="sm" variant="outline" onclick={() => (renamingId = null)}>
											{m.admin_action_cancel()}
										</Button>
									</div>
								{:else}
									<div class="flex items-center gap-2">
										<span class="i-lucide-key-round text-base text-primary" aria-hidden="true"></span>
										<span class="font-medium">{passkeyLabel(pk)}</span>
										<Badge variant={pk.backedUp ? 'success' : 'outline'}>
											{pk.backedUp
												? m.account_security_passkey_badge_synced()
												: m.account_security_passkey_badge_device()}
										</Badge>
									</div>
									{#if pk.authenticatorLabel && pk.name}
										<span class="text-xs text-muted">{pk.authenticatorLabel}</span>
									{/if}
									<span class="text-xs text-muted">
										{m.account_security_passkey_created({ date: formatPasskeyDate(pk.createdAt) })}
										{#if pk.lastUsedAt}
											· {m.account_security_passkey_last_used({ date: formatPasskeyDate(pk.lastUsedAt) })}
										{/if}
									</span>
								{/if}
							</div>
							{#if renamingId !== pk.id}
								<div class="flex items-center gap-2">
									<Button size="sm" variant="outline" onclick={() => startRename(pk)}>
										{m.account_security_passkey_rename()}
									</Button>
									<Button size="sm" variant="outline" onclick={() => requestDelete(pk)}>
										<span class="i-lucide-trash-2 h-4 w-4"></span>
										<span class="sr-only">{m.account_security_passkey_delete()}</span>
									</Button>
								</div>
							{/if}
						</div>
					{/each}
				</DiagGrid>
			{:else}
				<p class="text-sm text-muted mb-4">{m.account_security_passkeys_empty()}</p>
			{/if}

			<div class="add-passkey">
				<Input
					bind:value={newPasskeyName}
					placeholder={m.account_security_passkey_name_placeholder()}
					aria-label={m.account_security_passkey_name_placeholder()}
					disabled={addingPasskey}
				/>
				<Button onclick={addPasskey} disabled={addingPasskey}>
					{#if addingPasskey}<Spinner size="xs" class="mr-2" />{/if}
					<span class="i-lucide-plus h-4 w-4 mr-1"></span>
					{m.account_security_passkey_add()}
				</Button>
			</div>
		</Card>
	{/if}

	<!-- Two-step verification (TOTP) -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.account_security_heading_totp()}</h2>
		{/snippet}

		{#if data.twoFactorEnabled}
			<div class="flex items-center gap-2 mb-4">
				<Badge variant="success">{m.account_security_totp_badge_enabled()}</Badge>
				<span class="text-sm text-muted">{m.account_security_totp_enabled_description()}</span>
			</div>

			{#if freshBackupCodes}
				<div class="backup-codes" role="region" aria-label={m.account_security_backup_heading()}>
					<p class="text-sm font-medium text-fg">{m.account_security_backup_heading()}</p>
					<p class="text-xs text-muted">{m.account_security_backup_warning()}</p>
					<ul class="backup-code-list">
						{#each freshBackupCodes as bc}
							<li><code>{bc}</code></li>
						{/each}
					</ul>
					<div class="flex gap-2">
						<Button size="sm" variant="outline" onclick={() => copyCodes(freshBackupCodes ?? [])}>
							<span class="i-lucide-copy h-4 w-4 mr-1"></span>
							{m.account_security_backup_copy()}
						</Button>
						<Button size="sm" variant="outline" onclick={() => (freshBackupCodes = null)}>
							{m.account_security_backup_dismiss()}
						</Button>
					</div>
				</div>
			{/if}

			<div class="flex gap-3">
				<Button variant="outline" onclick={() => requestStepUp('regenerate')}>
					<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
					{m.account_security_backup_regenerate()}
				</Button>
				<Button variant="destructive" onclick={() => requestStepUp('disable')} disabled={disabling}>
					{#if disabling}<Spinner size="xs" class="mr-2" />{/if}
					{m.account_security_totp_disable()}
				</Button>
			</div>
		{:else if totpFlow.step === 'idle'}
			<p class="text-sm text-muted mb-4">{m.account_security_totp_description()}</p>
			<Button onclick={startTotpEnable}>
				<span class="i-lucide-shield-plus h-4 w-4 mr-1"></span>
				{m.account_security_totp_enable()}
			</Button>
		{:else if totpFlow.step === 'starting'}
			<div class="flex items-center gap-2 text-sm text-muted">
				<Spinner size="sm" />
				{m.account_security_totp_starting()}
			</div>
		{:else if totpFlow.step === 'confirm'}
			<div class="totp-enroll">
				<p class="text-sm text-muted">{m.account_security_totp_scan_instruction()}</p>

				{#if totpFlow.qrSvg}
					<div class="totp-qr">{@html totpFlow.qrSvg}</div>
				{/if}
				<details class="totp-uri">
					<summary class="text-xs text-muted">{m.account_security_totp_manual()}</summary>
					{#if totpSecret}
						<div class="totp-secret">
							<span class="text-xs text-muted">{m.account_security_totp_secret_label()}</span>
							<code class="text-xs break-all select-all">{totpSecret}</code>
							<Button
								size="sm"
								variant="outline"
								onclick={() => totpSecret && copyText(totpSecret, m.account_security_totp_secret_copied())}
							>
								<span class="i-lucide-copy h-4 w-4 mr-1"></span>
								{m.account_security_totp_copy_secret()}
							</Button>
						</div>
					{/if}
					<code class="text-xs break-all">{totpFlow.totpURI}</code>
				</details>

				<div class="backup-codes" role="region" aria-label={m.account_security_backup_heading()}>
					<p class="text-sm font-medium text-fg">{m.account_security_backup_heading()}</p>
					<p class="text-xs text-muted">{m.account_security_backup_warning()}</p>
					<ul class="backup-code-list">
						{#each totpFlow.backupCodes as bc}
							<li><code>{bc}</code></li>
						{/each}
					</ul>
					<Button
						size="sm"
						variant="outline"
						onclick={() => totpFlow.step === 'confirm' && copyCodes(totpFlow.backupCodes)}
					>
						<span class="i-lucide-copy h-4 w-4 mr-1"></span>
						{m.account_security_backup_copy()}
					</Button>
				</div>

				<form
					class="totp-confirm"
					onsubmit={(e) => {
						e.preventDefault();
						confirmTotpEnrollment();
					}}
				>
					<Input
						bind:value={totpFlow.code}
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder={m.account_security_totp_code_placeholder()}
						aria-label={m.account_security_totp_code_placeholder()}
						disabled={totpFlow.verifying}
					/>
					<Button type="submit" disabled={!totpFlow.code.trim() || totpFlow.verifying}>
						{#if totpFlow.verifying}<Spinner size="xs" class="mr-2" />{/if}
						{m.account_security_totp_confirm()}
					</Button>
					<Button type="button" variant="outline" onclick={cancelTotpEnrollment} disabled={totpFlow.verifying}>
						{m.admin_action_cancel()}
					</Button>
				</form>
			</div>
		{/if}
	</Card>

	<!-- Active Sessions -->
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.account_heading_sessions()}</h2>
		{/snippet}

		<DiagGrid>
			{#each data.sessions as sess (sess.id)}
				<div class="session-row">
					<div class="session-info">
						<div class="flex items-center gap-2">
							<code class="font-mono text-fluid-xs">{sess.displayId}</code>
							{#if sess.isCurrent}
								<Badge variant="success">{m.account_session_badge_current()}</Badge>
							{/if}
						</div>
						{#if sess.ipAddress}
							<span class="text-xs text-muted">{m.account_session_ip({ ip: sess.ipAddress })}</span>
						{/if}
						<span class="text-xs text-muted">
							{m.account_session_expires({ date: new Date(sess.expiresAt).toLocaleDateString() })}
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
								{m.account_session_revoke()}
							</Button>
						</form>
					{/if}
				</div>
			{/each}
		</DiagGrid>
	</Card>
</Stack>

<ConfirmDialog
	bind:open={confirmDeleteOpen}
	title={m.account_security_passkey_delete_title()}
	description={data.passkeys.length <= 1
		? m.account_security_passkey_delete_last_warning({ name: deleteTarget?.label ?? '' })
		: m.account_security_passkey_delete_description({ name: deleteTarget?.label ?? '' })}
	confirmLabel={m.account_security_passkey_delete()}
	destructive
	onconfirm={deletePasskey}
	oncancel={() => {
		confirmDeleteOpen = false;
		deleteTarget = null;
	}}
/>

<StepUpDialog
	bind:open={stepUpOpen}
	onverified={onStepUpVerified}
	oncancel={() => {
		stepUpAction = null;
		pendingStepUpForm = null;
	}}
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

	.passkey-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.passkey-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.passkey-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.add-passkey {
		display: flex;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		max-width: 28rem;
	}

	.totp-enroll {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.totp-qr {
		width: 200px;
		height: 200px;
		padding: var(--spacing-2);
		background: white;
		border-radius: var(--radius-md);
	}

	.totp-qr :global(svg) {
		width: 100%;
		height: 100%;
	}

	.backup-codes {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px dashed var(--color-border);
		border-radius: var(--radius-md);
		background: var(--surface-1);
		margin-bottom: var(--spacing-4);
	}

	.backup-code-list {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(8rem, 1fr));
		gap: var(--spacing-1) var(--spacing-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: monospace;
	}

	.totp-confirm {
		display: flex;
		gap: var(--spacing-3);
		align-items: center;
		max-width: 28rem;
	}

	.totp-uri summary {
		cursor: pointer;
	}

	.totp-secret {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-top: var(--spacing-2);
	}
</style>
