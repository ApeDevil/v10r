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
			<div class="modal-header">
				<div class="modal-icon" aria-hidden="true">🔒</div>
				<h2 id="session-modal-title">Session Expired</h2>
			</div>

			{#if step === 'expired'}
				<div class="modal-body">
					<p class="modal-description">
						Your session has expired for security reasons. Please verify your identity to
						continue, or sign in as a different user.
					</p>

					<div class="user-info">
						<div class="user-avatar" aria-hidden="true">
							{email.charAt(0).toUpperCase()}
						</div>
						<div class="user-details">
							<div class="user-email">{email}</div>
						</div>
					</div>

					{#if error}
						<div class="error-message" role="alert">
							{error}
						</div>
					{/if}
				</div>

				<div class="modal-actions">
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
				<div class="modal-body">
					<p class="modal-description">
						We've sent a 6-digit verification code to <strong>{email}</strong>. Enter it below to
						restore your session.
					</p>

					<form class="verify-form" onsubmit={(e) => (e.preventDefault(), verify())}>
						<div class="digit-inputs" onpaste={handlePaste}>
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
									/>
								</div>
							{/each}
						</div>

						{#if error}
							<div class="error-message" role="alert">
								{error}
							</div>
						{/if}

						<button
							type="submit"
							class="btn-verify"
							disabled={verifying || digits.some((d) => !d)}
							aria-label="Verify code"
						>
							{verifying ? 'Verifying...' : 'Verify'}
						</button>
					</form>

					<button
						type="button"
						class="btn-back"
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
		z-index: 1000;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		animation: fadeIn 0.2s ease-out;
	}

	.modal-content {
		background: white;
		border-radius: 0.75rem;
		max-width: 480px;
		width: 100%;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
		animation: slideUp 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		padding: 2rem 2rem 1rem;
		border-bottom: 1px solid #e5e7eb;
	}

	.modal-icon {
		font-size: 3rem;
		line-height: 1;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
		color: #111827;
	}

	.modal-body {
		padding: 2rem;
	}

	.modal-description {
		margin: 0 0 1.5rem;
		color: #6b7280;
		line-height: 1.6;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
	}

	.user-avatar {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: white;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 1.25rem;
		font-weight: 600;
	}

	.user-email {
		font-weight: 500;
		color: #111827;
	}

	.verify-form {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.digit-inputs {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.digit-input {
		flex: 1;
		max-width: 56px;
	}

	.digit-input input {
		width: 100%;
		height: 64px;
		text-align: center;
		font-size: 1.5rem;
		font-weight: 600;
		border: 2px solid #d1d5db;
		border-radius: 0.5rem;
		transition: all 0.2s;
	}

	.digit-input input:focus {
		outline: none;
		border-color: #6366f1;
		box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
	}

	.digit-input input:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.error-message {
		padding: 0.75rem 1rem;
		background: #fef2f2;
		border: 1px solid #fecaca;
		border-radius: 0.375rem;
		color: #dc2626;
		font-size: 0.875rem;
		text-align: center;
	}

	.modal-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0 2rem 2rem;
	}

	button {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
	}

	button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.btn-primary {
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}

	.btn-secondary {
		background: #f3f4f6;
		color: #374151;
	}

	.btn-secondary:hover:not(:disabled) {
		background: #e5e7eb;
	}

	.btn-verify {
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: white;
		margin-top: 0.5rem;
	}

	.btn-verify:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}

	.btn-back {
		background: transparent;
		color: #6b7280;
		padding: 0.5rem;
		margin-top: 0.5rem;
	}

	.btn-back:hover:not(:disabled) {
		color: #111827;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
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

		.digit-input input {
			height: 56px;
			font-size: 1.25rem;
		}
	}
</style>
