<script lang="ts">
import { Button, CornerFrame, Divider, Input, RadialGlow, Spinner } from '$lib/components';

type FlowState = 'idle' | 'sending' | 'magic-link-sent' | 'otp-sent';

const simulate = (ms: number) => new Promise((r) => setTimeout(r, ms));

let email = $state('');
let flowState = $state<FlowState>('idle');
let sendingMethod = $state<'magic-link' | 'otp' | null>(null);
let loadingProvider = $state<string | null>(null);

let isBusy = $derived(flowState === 'sending' || !!loadingProvider);

async function handleMagicLink() {
	if (!email.trim()) return;
	flowState = 'sending';
	sendingMethod = 'magic-link';
	await simulate(1500);
	flowState = 'magic-link-sent';
	sendingMethod = null;
}

async function handleOtp() {
	if (!email.trim()) return;
	flowState = 'sending';
	sendingMethod = 'otp';
	await simulate(1500);
	flowState = 'otp-sent';
	sendingMethod = null;
}

async function handleOAuth(provider: string) {
	loadingProvider = provider;
	await simulate(1500);
	loadingProvider = null;
}

function reset() {
	email = '';
	flowState = 'idle';
	sendingMethod = null;
	loadingProvider = null;
}
</script>

<section id="auth-gateway" class="section">
	<h2 class="section-title">Gateway</h2>
	<p class="section-description">
		Sign-in form with email magic link, OTP code, and OAuth social buttons.
		All actions are simulated with a 1.5s delay.
	</p>

	<div class="demos">
		<RadialGlow position="top" opacity={0.08}>
			<div class="gateway-frame">
				<CornerFrame variant="double" />

				<div class="gateway-inner">
					<div class="gateway-header">
						<span class="i-lucide-key-round text-3xl text-primary" aria-hidden="true"></span>
						<h3 class="text-xl font-bold text-fg">Welcome back</h3>
						<p class="text-sm text-muted">Sign in to your account</p>
					</div>

					{#if flowState === 'magic-link-sent'}
						<div class="success-alert" role="status">
							<span class="i-lucide-mail-check text-lg" aria-hidden="true"></span>
							<div>
								<p class="font-medium">Check your email</p>
								<p class="text-sm">We sent a sign-in link to <strong>{email}</strong></p>
							</div>
						</div>

						<button class="reset-link" onclick={reset}>
							Use a different email
						</button>
					{:else if flowState === 'otp-sent'}
						<div class="success-alert" role="status">
							<span class="i-lucide-hash text-lg" aria-hidden="true"></span>
							<div>
								<p class="font-medium">Code sent</p>
								<p class="text-sm">A 6-digit code was sent to <strong>{email}</strong></p>
							</div>
						</div>

						<button class="reset-link" onclick={reset}>
							Use a different email
						</button>
					{:else}
						<div class="email-section">
							<Input
								type="email"
								placeholder="you@example.com"
								bind:value={email}
								disabled={isBusy}
							/>

							<div class="email-actions">
								<Button
									variant="default"
									size="lg"
									class="flex-1 justify-center"
									disabled={isBusy || !email.trim()}
									onclick={handleMagicLink}
								>
									{#if sendingMethod === 'magic-link'}
										<Spinner size="sm" class="mr-2" />
									{:else}
										<span class="i-lucide-link text-lg mr-2" aria-hidden="true"></span>
									{/if}
									Magic link
								</Button>

								<Button
									variant="outline"
									size="lg"
									class="flex-1 justify-center"
									disabled={isBusy || !email.trim()}
									onclick={handleOtp}
								>
									{#if sendingMethod === 'otp'}
										<Spinner size="sm" class="mr-2" />
									{:else}
										<span class="i-lucide-hash text-lg mr-2" aria-hidden="true"></span>
									{/if}
									Send code
								</Button>
							</div>
						</div>

						<Divider motif="diamond" />
						<p class="text-center text-sm text-muted">or continue with</p>

						<div class="oauth-actions">
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
									<svg class="mr-3" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
										<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
										<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
										<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
										<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
									</svg>
								{/if}
								Google
							</Button>

							<Button
								variant="outline"
								size="lg"
								class="w-full justify-center"
								disabled={isBusy}
								onclick={() => handleOAuth('microsoft')}
							>
								{#if loadingProvider === 'microsoft'}
									<Spinner size="sm" class="mr-3" />
								{:else}
									<svg class="mr-3" width="20" height="20" viewBox="0 0 21 21" aria-hidden="true">
										<rect x="1" y="1" width="9" height="9" fill="#F25022"/>
										<rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
										<rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
										<rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
									</svg>
								{/if}
								Microsoft
							</Button>
						</div>
					{/if}
				</div>

				{#if flowState !== 'idle'}
					<div class="reset-bar">
						<Button variant="ghost" size="sm" onclick={reset}>
							<span class="i-lucide-rotate-ccw text-sm mr-1" aria-hidden="true"></span>
							Reset Demo
						</Button>
					</div>
				{/if}
			</div>
		</RadialGlow>
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

	.gateway-frame {
		position: relative;
		max-width: 420px;
		margin: 0 auto;
		padding: var(--spacing-8);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		background: var(--color-surface-2);
	}

	.gateway-inner {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.gateway-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		text-align: center;
	}

	.gateway-header h3,
	.gateway-header p {
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

	.oauth-actions {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
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

	.reset-link {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: 0.875rem;
		text-decoration: underline;
		cursor: pointer;
		padding: 0;
		text-align: center;
	}

	.reset-bar {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-4);
	}
</style>
