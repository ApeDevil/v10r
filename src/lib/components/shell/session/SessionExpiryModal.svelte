<script lang="ts">
	/**
	 * Session expiry re-authentication modal
	 * Shows when session has expired, allows OTP verification or user switch
	 */

	import { getModals } from '$lib/stores';

	type Props = {
		email: string;
		onReauthenticate: (code: string) => Promise<boolean>;
		onSwitchUser: () => void;
	};

	let { email, onReauthenticate, onSwitchUser }: Props = $props();

	const modals = getModals();

	let step = $state<'expired' | 'verify'>('expired');
	let code = $state('');
	let sending = $state(false);
	let verifying = $state(false);
	let error = $state<string | null>(null);
	let codeSent = $state(false);

	// Split code into 6 digit inputs
	let digits = $state<string[]>(['', '', '', '', '', '']);

	async function sendCode() {
		sending = true;
		error = null;

		try {
			const response = await fetch('/api/session/send-code', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email }),
			});

			if (!response.ok) {
				throw new Error('Failed to send verification code');
			}

			codeSent = true;
			step = 'verify';
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to send code';
		} finally {
			sending = false;
		}
	}

	async function verify() {
		const fullCode = digits.join('');

		if (fullCode.length !== 6) {
			error = 'Please enter all 6 digits';
			return;
		}

		verifying = true;
		error = null;

		try {
			const success = await onReauthenticate(fullCode);

			if (success) {
				// Close modal on success
				modals.close();
			} else {
				error = 'Invalid verification code. Please try again.';
				digits = ['', '', '', '', '', ''];
			}
		} catch (err) {
			error = err instanceof Error ? err.message : 'Verification failed';
		} finally {
			verifying = false;
		}
	}

	function handleDigitInput(index: number, event: Event) {
		const input = event.target as HTMLInputElement;
		const value = input.value.replace(/\D/g, '').slice(0, 1);

		digits[index] = value;

		// Auto-focus next input
		if (value && index < 5) {
			const nextInput = input.parentElement?.nextElementSibling?.querySelector('input');
			nextInput?.focus();
		}

		// Auto-submit when all digits entered
		if (digits.every((d) => d !== '') && digits.join('').length === 6) {
			verify();
		}
	}

	function handleDigitKeydown(index: number, event: KeyboardEvent) {
		const input = event.target as HTMLInputElement;

		if (event.key === 'Backspace' && !digits[index] && index > 0) {
			// Move to previous input on backspace if current is empty
			const prevInput = input.parentElement?.previousElementSibling?.querySelector('input');
			prevInput?.focus();
		}
	}

	function handlePaste(event: ClipboardEvent) {
		event.preventDefault();
		const pastedText = event.clipboardData?.getData('text') || '';
		const pastedDigits = pastedText.replace(/\D/g, '').slice(0, 6).split('');

		pastedDigits.forEach((digit, i) => {
			if (i < 6) digits[i] = digit;
		});

		// Focus last filled input
		if (pastedDigits.length > 0) {
			const lastIndex = Math.min(pastedDigits.length - 1, 5);
			const inputs = document.querySelectorAll('.digit-input input');
			(inputs[lastIndex] as HTMLInputElement)?.focus();
		}
	}
</script>

{#if modals.isOpen('sessionExpiry')}
	<div class="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="session-modal-title">
		<div class="modal-content">
			<div class="flex flex-col items-center gap-3 px-8 pt-8 pb-4 border-b border-border">
				<span class="i-lucide-lock text-5xl leading-none" aria-hidden="true"></span>
				<h2 id="session-modal-title" class="m-0 text-2xl font-semibold text-fg">Session Expired</h2>
			</div>

			{#if step === 'expired'}
				<div class="p-8">
					<p class="m-0 mb-6 text-muted leading-relaxed">
						Your session has expired for security reasons. Please verify your identity to
						continue, or sign in as a different user.
					</p>

					<div class="flex items-center gap-4 p-4 bg-subtle rounded-lg mb-6">
						<div class="avatar-circle" aria-hidden="true">
							{email.charAt(0).toUpperCase()}
						</div>
						<div class="user-details">
							<div class="font-medium text-fg">{email}</div>
						</div>
					</div>

					{#if error}
						<div class="error-alert" role="alert">
							{error}
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-3 px-8 pb-8">
					<button
						type="button"
						class="btn-primary"
						onclick={sendCode}
						disabled={sending}
						aria-label="Send verification code to {email}"
					>
						{sending ? 'Sending code...' : 'Send Verification Code'}
					</button>

					<button
						type="button"
						class="btn-secondary"
						onclick={onSwitchUser}
						disabled={sending}
						aria-label="Sign in as different user"
					>
						Sign In as Different User
					</button>
				</div>
			{:else if step === 'verify'}
				<div class="p-8">
					<p class="m-0 mb-6 text-muted leading-relaxed">
						We've sent a 6-digit verification code to <strong>{email}</strong>. Enter it below to
						restore your session.
					</p>

					<form class="flex flex-col gap-6" onsubmit={(e) => (e.preventDefault(), verify())}>
						<div class="flex gap-2 justify-center" onpaste={handlePaste}>
							{#each digits as digit, i}
								<div class="digit-input">
									<input
										type="text"
										inputmode="numeric"
										maxlength="1"
										value={digit}
										oninput={(e) => handleDigitInput(i, e)}
										onkeydown={(e) => handleDigitKeydown(i, e)}
										disabled={verifying}
										aria-label="Digit {i + 1}"
										autocomplete="off"
										class="digit-input-field"
									/>
								</div>
							{/each}
						</div>

						{#if error}
							<div class="error-alert" role="alert">
								{error}
							</div>
						{/if}

						<button
							type="submit"
							class="btn-primary mt-2"
							disabled={verifying || digits.some((d) => !d)}
							aria-label="Verify code"
						>
							{verifying ? 'Verifying...' : 'Verify'}
						</button>
					</form>

					<button
						type="button"
						class="btn-ghost"
						onclick={() => (step = 'expired')}
						disabled={verifying}
					>
						← Back
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: var(--z-modal);
		background: var(--backdrop);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--spacing-4);
		animation: fadeIn var(--duration-fast) var(--ease-out);
	}

	.modal-content {
		background: var(--color-bg);
		border-radius: var(--radius-xl);
		max-width: 480px;
		width: 100%;
		box-shadow: var(--shadow-modal);
		animation: slideUp var(--duration-normal) var(--ease-out);
	}

	.avatar-circle {
		width: 3rem;
		height: 3rem;
		border-radius: var(--radius-full);
		background: linear-gradient(135deg, var(--color-primary) 0%, var(--color-primary-hover) 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.error-alert {
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-error-light);
		border: 1px solid var(--color-error-border);
		border-radius: var(--radius-md);
		color: var(--color-error);
		font-size: 0.875rem;
		text-align: center;
	}

	.digit-input {
		flex: 1;
		max-width: 56px;
	}

	.digit-input-field {
		width: 100%;
		height: 4rem;
		text-align: center;
		font-size: 1.5rem;
		font-weight: 600;
		border: 2px solid var(--color-input-border);
		border-radius: var(--radius-lg);
		background: var(--color-bg);
		color: var(--color-fg);
		transition: all var(--duration-fast);
	}

	.digit-input-field:focus {
		outline: none;
		border-color: var(--color-primary);
		box-shadow: 0 0 0 3px rgb(from var(--color-primary) r g b / 0.1);
	}

	.digit-input-field:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		padding: var(--spacing-3) var(--spacing-6);
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: var(--color-primary);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--color-primary-hover);
		transform: translateY(-2px);
		box-shadow: var(--shadow-glow-primary);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-secondary {
		padding: var(--spacing-3) var(--spacing-6);
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: var(--color-subtle);
		color: var(--color-fg);
	}

	.btn-secondary:hover:not(:disabled) {
		background: var(--color-border);
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-ghost {
		width: 100%;
		margin-top: var(--spacing-2);
		padding: var(--spacing-2);
		border: none;
		border-radius: var(--radius-lg);
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all var(--duration-fast);
		background: transparent;
		color: var(--color-muted);
	}

	.btn-ghost:hover:not(:disabled) {
		color: var(--color-fg);
	}

	.btn-ghost:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	@keyframes fadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slideUp {
		from {
			transform: translateY(20px);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	@media (max-width: 640px) {
		.digit-input {
			max-width: 48px;
		}

		.digit-input-field {
			height: 56px;
			font-size: 1.25rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.btn-primary:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
