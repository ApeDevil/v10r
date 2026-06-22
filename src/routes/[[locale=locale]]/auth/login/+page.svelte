<script lang="ts">
import { onMount } from 'svelte';
import { goto, invalidateAll } from '$app/navigation';
import { authClient } from '$lib/auth-client';
import { Altcha } from '$lib/components/composites';
import { Button, Input, Spinner } from '$lib/components/primitives';
import { errorMessage } from '$lib/errors';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

type FlowState = 'idle' | 'sending' | 'magic-link-sent' | 'error';

let email = $state('');
let flowState = $state<FlowState>('idle');
let sendingMethod = $state<'magic-link' | 'otp' | null>(null);
let loadingProvider = $state<string | null>(null);
let error = $state<string | null>(null);

// ALTCHA single-use payload. Re-mount after consumption via captchaKey.
let altchaToken = $state<string | null>(null);
let captchaKey = $state(0);

let isBusy = $derived(flowState === 'sending' || !!loadingProvider);
let canSubmit = $derived(!isBusy && !!email.trim() && !!altchaToken);

function consumeCaptcha(): string | null {
	const t = altchaToken;
	altchaToken = null;
	captchaKey += 1;
	return t;
}

async function handleMagicLink() {
	const token = consumeCaptcha();
	if (!email.trim() || !token) return;
	flowState = 'sending';
	sendingMethod = 'magic-link';
	error = null;

	try {
		const result = await authClient.signIn.magicLink({
			email: email.trim(),
			callbackURL: data.returnTo,
			fetchOptions: { headers: { 'x-altcha-token': token } },
		});
		if (result.error) {
			error = result.error.message ?? m.auth_login_error_magic_link_failed();
			flowState = 'error';
		} else {
			flowState = 'magic-link-sent';
		}
	} catch {
		error = m.auth_login_error_magic_link_failed();
		flowState = 'error';
	} finally {
		sendingMethod = null;
	}
}

async function handleOtp() {
	const token = consumeCaptcha();
	if (!email.trim() || !token) return;
	flowState = 'sending';
	sendingMethod = 'otp';
	error = null;

	try {
		const result = await authClient.emailOtp.sendVerificationOtp({
			email: email.trim(),
			type: 'sign-in',
			fetchOptions: { headers: { 'x-altcha-token': token } },
		});
		if (result.error) {
			error = result.error.message ?? m.auth_login_error_otp_failed();
			flowState = 'error';
			sendingMethod = null;
		} else {
			const params = new URLSearchParams({
				email: email.trim(),
				returnTo: data.returnTo,
			});
			goto(`/auth/verify?${params.toString()}`);
		}
	} catch {
		error = m.auth_login_error_otp_failed();
		flowState = 'error';
		sendingMethod = null;
	}
}

async function handleOAuth(provider: 'github' | 'google') {
	loadingProvider = provider;
	error = null;

	try {
		await authClient.signIn.social({
			provider,
			callbackURL: data.returnTo,
		});
	} catch (err) {
		error = err instanceof Error ? err.message : errorMessage('INTERNAL');
		loadingProvider = null;
	}
}

/** WebAuthn user-cancel surfaces as a NotAllowedError — a dismissal, not a failure. */
function isCeremonyCancel(message: string | undefined): boolean {
	return !!message && /not.?allowed|abort/i.test(message);
}

async function handlePasskey() {
	loadingProvider = 'passkey';
	error = null;

	try {
		const result = await authClient.signIn.passkey();
		if (result?.error) {
			if (!isCeremonyCancel(result.error.message)) {
				error = result.error.message ?? m.auth_login_passkey_failed();
			}
		} else {
			// Refresh the shared root-layout `session` (it is reused across a
			// client-side nav, so the shell would otherwise stay logged-out).
			await invalidateAll();
			goto(localizeHref(data.returnTo));
			return;
		}
	} catch (err) {
		if (!isCeremonyCancel(err instanceof Error ? err.message : undefined)) {
			error = m.auth_login_passkey_failed();
		}
	}
	loadingProvider = null;
}

onMount(() => {
	// Conditional UI: surface passkeys in the email field's autofill dropdown.
	// The WebAuthn ceremony is browser-only, so this is the one legitimate
	// onMount call — it is a credential ceremony, not data loading. A pending
	// conditional request is auto-preempted by simplewebauthn's internal abort
	// service when the explicit passkey button (or any modal ceremony) runs.
	if (!data.passkeysEnabled || !window.PublicKeyCredential) return;

	PublicKeyCredential.isConditionalMediationAvailable?.().then((available) => {
		if (!available) return;
		authClient.signIn
			.passkey({ autoFill: true })
			.then(async (result) => {
				if (result && !result.error) {
					await invalidateAll();
					goto(localizeHref(data.returnTo));
				}
			})
			.catch(() => {
				// Aborted/preempted conditional request — expected, ignore.
			});
	});
});
</script>
<div class="login-page">
	<div class="login-card">
		<div class="login-header">
			<h1 class="text-2xl font-bold text-fg">{m.auth_login_title()}</h1>
		</div>

		{#if error}
			<div class="error-alert" role="alert">
				<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
				<span>{error}</span>
			</div>
		{/if}

		{#if flowState === 'magic-link-sent'}
			<div class="success-alert" role="status">
				<span class="i-lucide-mail-check text-lg" aria-hidden="true"></span>
				<div>
					<p class="font-medium">{m.auth_login_check_email_title()}</p>
					<p class="text-sm">{m.auth_login_check_email_body()} <strong>{email}</strong></p>
				</div>
			</div>

			<Button variant="ghost" class="mt-4 w-full justify-center" onclick={() => { flowState = 'idle'; error = null; }}>
				{m.auth_login_use_different_email()}
			</Button>
		{:else}
			<div class="email-section">
				<Input
					type="email"
					placeholder={m.auth_login_email_placeholder()}
					bind:value={email}
					disabled={isBusy}
					autocomplete="username webauthn"
					aria-label={m.auth_login_email_aria_label()}
				/>

				<div class="captcha-row">
					{#key captchaKey}
						<Altcha onverified={(payload) => (altchaToken = payload)} />
					{/key}
				</div>

				<div class="email-actions">
					<Button
						variant="default"
						size="md"
						class="flex-1 min-w-0 justify-center whitespace-nowrap"
						disabled={!canSubmit}
						onclick={handleMagicLink}
					>
						{#if sendingMethod === 'magic-link'}
							<Spinner size="sm" class="mr-2" />
						{:else}
							<span class="i-lucide-link text-base mr-2" aria-hidden="true"></span>
						{/if}
						{m.auth_login_magic_link()}
					</Button>

					<Button
						variant="outline"
						size="md"
						class="flex-1 min-w-0 justify-center whitespace-nowrap"
						disabled={!canSubmit}
						onclick={handleOtp}
					>
						{#if sendingMethod === 'otp'}
							<Spinner size="sm" class="mr-2" />
						{:else}
							<span class="i-lucide-hash text-base mr-2" aria-hidden="true"></span>
						{/if}
						{m.auth_login_send_code()}
					</Button>
				</div>
			</div>

			<div class="divider">
				<span>{m.auth_login_or_continue_with()}</span>
			</div>

			<div class="login-actions">
				<Button
					variant="outline"
					size="lg"
					class="w-full justify-center"
					disabled={isBusy}
					onclick={() => handleOAuth('github')}
				>
					{#if loadingProvider === 'github'}
						<Spinner size="sm" class="mr-3" />
					{:else}
						<span class="i-lucide-github text-xl mr-3" aria-hidden="true"></span>
					{/if}
					GitHub
				</Button>

				<Button
					variant="outline"
					size="lg"
					class="w-full justify-center"
					disabled={isBusy}
					onclick={() => handleOAuth('google')}
				>
					{#if loadingProvider === 'google'}
						<Spinner size="sm" class="mr-3" />
					{:else}
						<svg class="mr-3" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
							<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
						</svg>
					{/if}
					Google
				</Button>
			</div>

			{#if data.passkeysEnabled}
				<div class="divider">
					<span>{m.auth_login_or()}</span>
				</div>

				<div class="login-actions">
					<Button
						variant="outline"
						size="lg"
						class="w-full justify-center"
						disabled={isBusy}
						onclick={handlePasskey}
					>
						{#if loadingProvider === 'passkey'}
							<Spinner size="sm" class="mr-3" />
						{:else}
							<span class="i-lucide-fingerprint text-xl mr-3" aria-hidden="true"></span>
						{/if}
						{m.auth_login_passkey()}
					</Button>
				</div>
			{/if}

			<p class="text-xs text-center mt-6">
				<a href={localizeHref('/showcases/admin/data')} class="text-fg underline transition-colors duration-fast hover:text-primary focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">{m.auth_login_privacy_link()}</a>
			</p>
		{/if}

		<div class="login-footer">
			<Button href={localizeHref('/')} variant="ghost" size="sm">
				<span class="i-lucide-arrow-left text-base mr-2" aria-hidden="true"></span>
				{m.auth_login_back_home()}
			</Button>
		</div>
	</div>
</div>

<style>
	.login-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--spacing-4);
	}

	.login-card {
		width: 100%;
		max-width: 400px;
		background: var(--surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-8);
		box-shadow: var(--shadow-lg);
	}

	.login-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		margin-bottom: var(--spacing-8);
		text-align: center;
	}

	.login-header h1 {
		margin: 0;
	}

	.login-header p {
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

	.success-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		font-size: 0.875rem;
	}

	.success-alert p {
		margin: 0;
	}

	.email-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.email-actions {
		display: flex;
		gap: var(--spacing-2);
	}

	.captcha-row {
		display: flex;
		justify-content: center;
		margin: var(--spacing-3) 0 var(--spacing-2) 0;
	}

	.divider {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin: var(--spacing-6) 0;
		color: var(--color-muted);
		font-size: 0.8125rem;
	}

	.divider::before,
	.divider::after {
		content: '';
		flex: 1;
		height: 1px;
		background: var(--color-border);
	}

	.login-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.login-footer {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-6);
	}
</style>
