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
			<div class="flex flex-col items-center gap-3 px-8 pt-8 pb-4 border-b border-[#e5e7eb]">
				<span class="i-lucide-lock text-5xl leading-none" aria-hidden="true"></span>
				<h2 id="session-modal-title" class="m-0 text-2xl font-semibold text-[#111827]">Session Expired</h2>
			</div>

			{#if step === 'expired'}
				<div class="p-8">
					<p class="m-0 mb-6 text-[#6b7280] leading-relaxed">
						Your session has expired for security reasons. Please verify your identity to
						continue, or sign in as a different user.
					</p>

					<div class="flex items-center gap-4 p-4 bg-[#f9fafb] rounded-lg mb-6">
						<div class="w-12 h-12 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] text-white flex items-center justify-center text-xl font-semibold" aria-hidden="true">
							{email.charAt(0).toUpperCase()}
						</div>
						<div class="user-details">
							<div class="font-medium text-[#111827]">{email}</div>
						</div>
					</div>

					{#if error}
						<div class="px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-md text-[#dc2626] text-sm text-center" role="alert">
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
						class="px-6 py-3 border-none rounded-lg text-[0.9375rem] font-medium cursor-pointer transition-all duration-fast bg-[#f3f4f6] text-[#374151] hover:bg-[#e5e7eb] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none"
						onclick={onSwitchUser}
						disabled={sending}
						aria-label="Sign in as different user"
					>
						Sign In as Different User
					</button>
				</div>
			{:else if step === 'verify'}
				<div class="p-8">
					<p class="m-0 mb-6 text-[#6b7280] leading-relaxed">
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
										class="w-full h-16 text-center text-2xl font-semibold border-2 border-[#d1d5db] rounded-lg transition-all duration-fast focus:outline-none focus:border-[#6366f1] focus:shadow-[0_0_0_3px_rgba(99,102,241,0.1)] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none"
									/>
								</div>
							{/each}
						</div>

						{#if error}
							<div class="px-4 py-3 bg-[#fef2f2] border border-[#fecaca] rounded-md text-[#dc2626] text-sm text-center" role="alert">
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
						class="bg-transparent text-[#6b7280] px-2 py-2 border-none rounded-lg text-[0.9375rem] font-medium cursor-pointer transition-all duration-fast hover:text-[#111827] disabled:opacity-50 disabled:cursor-not-allowed motion-reduce:transition-none mt-2 w-full"
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

	.digit-input {
		flex: 1;
		max-width: 56px;
	}

	.btn-primary {
		padding: 0.75rem 1.5rem;
		border: none;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s;
		background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
		color: white;
	}

	.btn-primary:hover:not(:disabled) {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
	}

	.btn-primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	@media (prefers-reduced-motion: reduce) {
		.btn-primary:hover:not(:disabled) {
			transform: none;
		}
	}
</style>
