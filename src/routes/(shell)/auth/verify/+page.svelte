<script lang="ts">
	import { goto } from '$app/navigation';
	import { authClient } from '$lib/auth-client';
	import { Button, Spinner } from '$lib/components/primitives';

	let { data } = $props();

	let digits = $state<string[]>(Array(6).fill(''));
	let inputRefs = $state<HTMLInputElement[]>([]);
	let verifying = $state(false);
	let resending = $state(false);
	let error = $state<string | null>(null);
	let resendCooldown = $state(0);

	let otp = $derived(digits.join(''));
	let isComplete = $derived(otp.length === 6 && digits.every((d) => d !== ''));

	function handleInput(index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const value = input.value.replace(/\D/g, '');

		if (value.length > 1) {
			// Handle paste into single input
			const chars = value.slice(0, 6 - index).split('');
			for (let i = 0; i < chars.length; i++) {
				if (index + i < 6) digits[index + i] = chars[i];
			}
			const nextIndex = Math.min(index + chars.length, 5);
			inputRefs[nextIndex]?.focus();
		} else {
			digits[index] = value;
			if (value && index < 5) {
				inputRefs[index + 1]?.focus();
			}
		}
	}

	function handleKeydown(index: number, event: KeyboardEvent) {
		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			digits[index - 1] = '';
			inputRefs[index - 1]?.focus();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, 6);
		if (!pasted) return;

		const chars = pasted.split('');
		for (let i = 0; i < chars.length; i++) {
			digits[i] = chars[i];
		}
		const focusIndex = Math.min(chars.length, 5);
		inputRefs[focusIndex]?.focus();
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
				error = result.error.message ?? 'Invalid code. Please try again.';
				verifying = false;
			} else {
				goto(data.returnTo);
			}
		} catch {
			error = 'Verification failed. Please try again.';
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
				error = result.error.message ?? 'Failed to resend code.';
			} else {
				startCooldown();
			}
		} catch {
			error = 'Failed to resend code. Please try again.';
		} finally {
			resending = false;
		}
	}
</script>

<svelte:head>
	<title>Verify Code - Velociraptor</title>
</svelte:head>

<div class="verify-page">
	<div class="verify-card">
		<div class="verify-header">
			<span class="i-lucide-shield-check text-4xl text-primary" aria-hidden="true"></span>
			<h1 class="text-2xl font-bold text-fg">Enter verification code</h1>
			<p class="text-sm text-muted">
				We sent a 6-digit code to <strong class="text-fg">{data.email}</strong>
			</p>
		</div>

		{#if error}
			<div class="error-alert" role="alert">
				<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
				<span>{error}</span>
			</div>
		{/if}

		<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<form
			class="otp-form"
			onsubmit={(e) => { e.preventDefault(); handleVerify(); }}
			onpaste={handlePaste}
		>
			<div class="otp-inputs">
				{#each digits as digit, i}
					<input
						bind:this={inputRefs[i]}
						type="text"
						inputmode="numeric"
						maxlength="2"
						value={digit}
						class="otp-digit"
						autocomplete="one-time-code"
						disabled={verifying}
						oninput={(e) => handleInput(i, e)}
						onkeydown={(e) => handleKeydown(i, e)}
					/>
				{/each}
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
				Verify
			</Button>
		</form>

		<div class="verify-footer">
			<button
				class="resend-link"
				disabled={resendCooldown > 0 || resending}
				onclick={handleResend}
			>
				{#if resending}
					Sending...
				{:else if resendCooldown > 0}
					Resend code ({resendCooldown}s)
				{:else}
					Resend code
				{/if}
			</button>

			<a href="/auth/login" class="text-sm text-muted underline">Back to sign in</a>
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
		background: var(--color-surface-2);
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
		gap: var(--spacing-2);
	}

	.otp-digit {
		width: 3rem;
		height: 3.5rem;
		text-align: center;
		font-size: 1.5rem;
		font-weight: 600;
		font-family: monospace;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: var(--color-bg);
		color: var(--color-fg);
		outline: none;
		transition: border-color 0.15s;
	}

	.otp-digit:focus {
		border-color: var(--color-primary);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--color-primary) 25%, transparent);
	}

	.otp-digit:disabled {
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
