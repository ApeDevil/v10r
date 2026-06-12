<script lang="ts">
import { Dialog } from 'bits-ui';
import { authClient } from '$lib/auth-client';
import { Button, Input, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { cn } from '$lib/utils/cn';

interface Props {
	open: boolean;
	/** Called after a successful TOTP / backup-code verification. */
	onverified: () => void;
	oncancel?: () => void;
	title?: string;
	description?: string;
}

let {
	open = $bindable(),
	onverified,
	oncancel,
	title = m.composites_step_up_title(),
	description = m.composites_step_up_description(),
}: Props = $props();

let code = $state('');
let useBackupCode = $state(false);
let verifying = $state(false);
let error = $state<string | null>(null);

function reset() {
	code = '';
	useBackupCode = false;
	verifying = false;
	error = null;
}

function cancel() {
	open = false;
	reset();
	oncancel?.();
}

async function verify() {
	const trimmed = code.trim();
	if (!trimmed || verifying) return;
	verifying = true;
	error = null;

	const result = useBackupCode
		? await authClient.twoFactor.verifyBackupCode({ code: trimmed })
		: await authClient.twoFactor.verifyTotp({ code: trimmed });

	if (result.error) {
		error = result.error.message ?? m.composites_step_up_error_invalid();
		verifying = false;
		return;
	}

	open = false;
	reset();
	onverified();
}
</script>

<Dialog.Root bind:open onOpenChange={(isOpen) => !isOpen && reset()}>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-overlay bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out"
		/>
		<Dialog.Content
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-full max-w-md rounded-lg border border-border bg-surface-3 p-6 shadow-xl',
				'flex flex-col gap-2',
				'data-[state=open]:animate-in data-[state=closed]:animate-out'
			)}
		>
			<Dialog.Title class="text-fluid-lg font-semibold text-fg">
				{title}
			</Dialog.Title>

			<Dialog.Description class="text-fluid-sm text-muted">
				{description}
			</Dialog.Description>

			{#if error}
				<p class="step-up-error" role="alert">
					<span class="i-lucide-alert-circle text-base" aria-hidden="true"></span>
					{error}
				</p>
			{/if}

			<form
				class="flex flex-col gap-3 pt-2"
				onsubmit={(e) => {
					e.preventDefault();
					verify();
				}}
			>
				<Input
					bind:value={code}
					inputmode={useBackupCode ? 'text' : 'numeric'}
					autocomplete="one-time-code"
					placeholder={useBackupCode
						? m.composites_step_up_backup_placeholder()
						: m.composites_step_up_code_placeholder()}
					aria-label={useBackupCode ? m.composites_step_up_backup_label() : m.composites_step_up_code_label()}
					disabled={verifying}
				/>

				<button
					type="button"
					class="step-up-toggle"
					onclick={() => {
						useBackupCode = !useBackupCode;
						code = '';
						error = null;
					}}
				>
					{useBackupCode ? m.composites_step_up_use_totp() : m.composites_step_up_use_backup()}
				</button>

				<div class="pt-2 flex justify-end gap-3">
					<Button variant="outline" type="button" onclick={cancel}>
						{m.composites_confirm_dialog_cancel()}
					</Button>
					<Button type="submit" disabled={!code.trim() || verifying}>
						{#if verifying}
							<Spinner size="sm" class="mr-2" />
						{/if}
						{m.composites_step_up_verify()}
					</Button>
				</div>
			</form>

			<Dialog.Close class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onclick={cancel}>
				<span class="i-lucide-x h-4 w-4"></span>
				<span class="sr-only">{m.composites_dialog_close()}</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.step-up-error {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		color: var(--color-error);
		font-size: 0.875rem;
	}

	.step-up-toggle {
		background: none;
		border: none;
		padding: 0;
		align-self: flex-start;
		color: var(--color-primary);
		font-size: 0.8125rem;
		cursor: pointer;
	}
</style>
