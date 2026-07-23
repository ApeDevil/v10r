<script lang="ts">
import { goto, invalidateAll } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { Button, Spinner } from '$lib/components/primitives';
import { authErrorMessage } from '$lib/errors';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

// ONE input, styled as segments. A multi-box pattern (maxlength per box) breaks
// iOS QuickType's code insertion — it's a text INSERTION, not a paste event, so
// per-box maxlength truncates the autofilled 6 digits. A single input keeps
// autocomplete="one-time-code" fully functional on every platform.
let otp = $state('');
let verifying = $state(false);
let resending = $state(false);
let error = $state<string | null>(null);
let resendCooldown = $state(0);

let isComplete = $derived(otp.length === 6);

function handleInput(event: Event) {
	const input = event.target as HTMLInputElement;
	otp = input.value.replace(/\D/g, '').slice(0, 6);
	// Reflect sanitization back (letters/spaces from a sloppy paste vanish).
	input.value = otp;
}

async function handleVerify() {
	if (!isComplete) return;
	verifying = true;
	error = null;

	try {
		const result = await authClient.signIn.emailOtp({
			email: data.email,
			otp,
		});
		if (result.error) {
			error = result.error.message ?? m.auth_verify_error_invalid();
			verifying = false;
		} else {
			// The flow completed — drop the resume marker (see login page).
			try {
				localStorage.removeItem('v10r:pending-otp');
			} catch {}
			// Refresh the shared root-layout `session` so the shell reflects
			// the authenticated user without a full reload.
			await invalidateAll();
			goto(data.returnTo);
		}
	} catch {
		error = m.auth_verify_error_failed();
		verifying = false;
	}
}

function startCooldown() {
	resendCooldown = 30;
	const interval = setInterval(() => {
		resendCooldown--;
		if (resendCooldown <= 0) clearInterval(interval);
	}, 1000);
}

async function handleResend() {
	if (resendCooldown > 0) return;
	resending = true;
	error = null;

	try {
		const result = await authClient.emailOtp.sendVerificationOtp({
			email: data.email,
			type: 'sign-in',
		});
		if (result.error) {
			error = authErrorMessage(result.error, m.auth_verify_error_resend_failed);
		} else {
			startCooldown();
		}
	} catch {
		error = m.auth_verify_error_resend_failed();
	} finally {
		resending = false;
	}
}
</script>
<div class="verify-page">
	<div class="verify-card">
		<div class="verify-header">
			<span class="i-lucide-shield-check text-4xl text-primary" aria-hidden="true"></span>
			<h1 class="text-2xl font-bold text-fg">{m.auth_verify_title()}</h1>
			<p class="text-sm text-muted">
				{m.auth_verify_subtitle()} <strong class="text-fg">{data.email}</strong>
			</p>
		</div>

		{#if error}
			<div class="error-alert" role="alert">
				<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
				<span>{error}</span>
			</div>
		{/if}

		<p class="switch-hint">{m.auth_verify_switch_hint()}</p>

		<form
			class="otp-form"
			onsubmit={(e) => { e.preventDefault(); handleVerify(); }}
		>
			<div class="otp-inputs">
				<input
					type="text"
					inputmode="numeric"
					maxlength="6"
					value={otp}
					class="otp-code"
					autocomplete="one-time-code"
					disabled={verifying}
					aria-label={m.auth_verify_code_aria_label()}
					oninput={handleInput}
				/>
			</div>

			<Button
				type="submit"
				variant="default"
				size="lg"
				class="w-full justify-center"
				disabled={!isComplete || verifying}
			>
				{#if verifying}
					<Spinner size="sm" class="mr-2" />
				{/if}
				{m.auth_verify_submit()}
			</Button>
		</form>

		<div class="verify-footer">
			<button
				class="resend-link"
				disabled={resendCooldown > 0 || resending}
				onclick={handleResend}
			>
				{#if resending}
					{m.auth_verify_sending()}
				{:else if resendCooldown > 0}
					{m.auth_verify_resend_cooldown({ seconds: resendCooldown })}
				{:else}
					{m.auth_verify_resend()}
				{/if}
			</button>

			<a href="/auth/login" class="text-sm text-muted underline">{m.auth_back_to_sign_in()}</a>
		</div>
	</div>
</div>

<style>
	.verify-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--spacing-4);
	}

	.verify-card {
		width: 100%;
		max-width: 400px;
		background: var(--surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-8);
		box-shadow: var(--shadow-lg);
	}

	.verify-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-8);
		text-align: center;
	}

	.verify-header h1,
	.verify-header p {
		margin: 0;
	}

	.error-alert {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-error-bg);
		border: 1px solid var(--color-error);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: 0.875rem;
		margin-bottom: var(--spacing-6);
	}

	.otp-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.otp-inputs {
		display: flex;
		justify-content: center;
	}

	.switch-hint {
		margin: 0 0 var(--spacing-4);
		text-align: center;
		font-size: 0.8125rem;
		color: var(--color-muted);
	}

	.otp-code {
		width: 100%;
		max-width: 16rem;
		height: 3.5rem;
		text-align: center;
		font-size: 1.75rem;
		font-weight: 600;
		font-family: monospace;
		/* Segment illusion: wide tracking reads as six slots without splitting
		   the input (which would break iOS one-time-code insertion). */
		letter-spacing: 0.45em;
		/* Recenter: letter-spacing adds a trailing gap after the last glyph. */
		padding-left: 0.45em;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
		transition: border-color 0.15s;
	}

	.otp-code:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.otp-code:disabled {
		opacity: 0.5;
	}

	.verify-footer {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-6);
	}

	.resend-link {
		background: none;
		border: none;
		color: var(--color-primary);
		font-size: 0.875rem;
		cursor: pointer;
		padding: 0;
	}

	.resend-link:disabled {
		color: var(--color-muted);
		cursor: default;
	}
</style>
