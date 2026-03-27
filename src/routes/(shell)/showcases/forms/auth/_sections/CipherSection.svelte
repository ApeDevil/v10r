<script lang="ts">
import { Button, GeometricMark, GridPattern, Spinner, TickMarks } from '$lib/components';

const simulate = (ms: number) => new Promise((r) => setTimeout(r, ms));

let digits = $state<string[]>(Array(6).fill(''));
let inputRefs = $state<HTMLInputElement[]>([]);
let verifying = $state(false);
let verified = $state(false);
let error = $state<string | null>(null);
let resendCooldown = $state(0);

let otp = $derived(digits.join(''));
let isComplete = $derived(otp.length === 6 && digits.every((d) => d !== ''));

function handleInput(index: number, event: Event) {
	const input = event.target as HTMLInputElement;
	const value = input.value.replace(/\D/g, '');

	if (value.length > 1) {
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

	await simulate(1500);

	if (otp === '123456') {
		verified = true;
	} else {
		error = 'Invalid code. Please try again.';
	}
	verifying = false;
}

function startCooldown() {
	resendCooldown = 30;
	const interval = setInterval(() => {
		resendCooldown--;
		if (resendCooldown <= 0) clearInterval(interval);
	}, 1000);
}

function handleResend() {
	if (resendCooldown > 0) return;
	startCooldown();
}

function reset() {
	digits = Array(6).fill('');
	verifying = false;
	verified = false;
	error = null;
	resendCooldown = 0;
}
</script>

<section id="auth-cipher" class="section">
	<h2 class="section-title">
		<GeometricMark shape="hexagon" size={14} class="inline-mark" />
		Cipher
	</h2>
	<p class="section-description">
		6-digit OTP verification with auto-advance, paste support, and backspace navigation.
		Try code <strong>123456</strong> for a successful verification.
	</p>

	<div class="demos">
		<GridPattern cellSize={24} opacity={0.06}>
			<div class="cipher-frame">
				<TickMarks orientation="horizontal" count={13} majorEvery={6} />

				<div class="cipher-inner">
					<div class="cipher-header">
						<span class="i-lucide-shield-check text-3xl text-primary" aria-hidden="true"></span>
						<h3 class="text-xl font-bold text-fg">Enter verification code</h3>
						<p class="text-sm text-muted">
							We sent a 6-digit code to <strong class="text-fg">demo@example.com</strong>
						</p>
					</div>

					{#if error}
						<div class="error-alert" role="alert">
							<span class="i-lucide-alert-circle text-lg" aria-hidden="true"></span>
							<span>{error}</span>
						</div>
					{/if}

					{#if verified}
						<div class="success-alert" role="status">
							<span class="i-lucide-check-circle text-lg" aria-hidden="true"></span>
							<div>
								<p class="font-medium">Verified successfully</p>
								<p class="text-sm">Your identity has been confirmed.</p>
							</div>
						</div>
					{:else}
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

						<div class="cipher-footer">
							<Button variant="ghost" disabled={resendCooldown > 0} onclick={handleResend}>
								{#if resendCooldown > 0}
									Resend code ({resendCooldown}s)
								{:else}
									Resend code
								{/if}
							</Button>
						</div>
					{/if}

					{#if verified || error}
						<div class="reset-bar">
							<Button variant="ghost" size="sm" onclick={reset}>
								<span class="i-lucide-rotate-ccw text-sm mr-1" aria-hidden="true"></span>
								Reset Demo
							</Button>
						</div>
					{/if}
				</div>

				<TickMarks orientation="horizontal" count={13} majorEvery={6} />
			</div>
		</GridPattern>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.cipher-frame {
		max-width: 420px;
		margin: 0 auto;
		padding: var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.cipher-inner {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
		background: var(--color-surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-8);
	}

	.cipher-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		text-align: center;
	}

	.cipher-header h3,
	.cipher-header p {
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
	}

	.success-alert {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: color-mix(in srgb, var(--color-success) 10%, transparent);
		border: 1px solid var(--color-success);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		font-size: 0.875rem;
	}

	.success-alert p {
		margin: 0;
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

	.cipher-footer {
		display: flex;
		justify-content: center;
	}


	.reset-bar {
		display: flex;
		justify-content: center;
	}
</style>
