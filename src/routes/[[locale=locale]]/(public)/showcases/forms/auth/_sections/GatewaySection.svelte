<script lang="ts">
import { Button, CornerFrame, Divider, Input, RadialGlow, Spinner } from '$lib/components';
import * as m from '$lib/paraglide/messages';

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
	<h2 class="section-title">{m.showcase_forms_auth_section_gateway()}</h2>
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
						<h3 class="text-xl font-bold text-fg">{m.showcase_forms_auth_gateway_welcome()}</h3>
						<p class="text-sm text-muted">{m.showcase_forms_auth_gateway_subtitle()}</p>
					</div>

					{#if flowState === 'magic-link-sent'}
						<div class="success-alert" role="status">
							<span class="i-lucide-mail-check text-lg" aria-hidden="true"></span>
							<div>
								<p class="font-medium">{m.showcase_forms_auth_gateway_check_email_title()}</p>
								<p class="text-sm">{m.showcase_forms_auth_gateway_check_email_body()} <strong>{email}</strong></p>
							</div>
						</div>

						<Button variant="ghost" onclick={reset}>
							{m.showcase_forms_auth_gateway_use_different_email()}
						</Button>
					{:else if flowState === 'otp-sent'}
						<div class="success-alert" role="status">
							<span class="i-lucide-hash text-lg" aria-hidden="true"></span>
							<div>
								<p class="font-medium">{m.showcase_forms_auth_gateway_code_sent_title()}</p>
								<p class="text-sm">{m.showcase_forms_auth_gateway_code_sent_body()} <strong>{email}</strong></p>
							</div>
						</div>

						<Button variant="ghost" onclick={reset}>
							{m.showcase_forms_auth_gateway_use_different_email()}
						</Button>
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
									{m.showcase_forms_auth_magic_link()}
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
									{m.showcase_forms_auth_send_code()}
								</Button>
							</div>
						</div>

						<Divider motif="diamond" />
						<p class="text-center text-sm text-muted">{m.showcase_forms_auth_gateway_or_continue()}</p>

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
									<svg class="mr-3" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
										<path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"/>
									</svg>
								{/if}
								Google
							</Button>
						</div>
					{/if}
				</div>

				{#if flowState !== 'idle'}
					<div class="reset-bar">
						<Button variant="ghost" size="sm" onclick={reset}>
							<span class="i-lucide-rotate-ccw text-sm mr-1" aria-hidden="true"></span>
							{m.showcase_forms_auth_gateway_reset()}
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
		background: var(--surface-2);
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

	.reset-bar {
		display: flex;
		justify-content: center;
		margin-top: var(--spacing-4);
	}
</style>
