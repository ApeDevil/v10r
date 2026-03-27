<script lang="ts">
import { Button, ConcentricRings, CornerFrame, Input, Progress, Spinner, WaveDivider } from '$lib/components';

const simulate = (ms: number) => new Promise((r) => setTimeout(r, ms));

let name = $state('');
let email = $state('');
let password = $state('');
let confirmPassword = $state('');
let showPassword = $state(false);
let registering = $state(false);
let registered = $state(false);

const requirements = [
	{ label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
	{ label: 'Uppercase letter', test: (p: string) => /[A-Z]/.test(p) },
	{ label: 'Lowercase letter', test: (p: string) => /[a-z]/.test(p) },
	{ label: 'Number', test: (p: string) => /\d/.test(p) },
	{ label: 'Special character', test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

let strength = $derived.by(() => {
	if (!password) return { score: 0, label: '', variant: 'error' as const };
	let score = 0;
	for (const req of requirements) {
		if (req.test(password)) score++;
	}
	if (score <= 1) return { score, label: 'Weak', variant: 'error' as const };
	if (score <= 2) return { score, label: 'Fair', variant: 'error' as const };
	if (score <= 3) return { score, label: 'Good', variant: 'warning' as const };
	if (score <= 4) return { score, label: 'Strong', variant: 'success' as const };
	return { score, label: 'Very strong', variant: 'success' as const };
});

let passwordsMatch = $derived(confirmPassword.length > 0 && password === confirmPassword);

let canSubmit = $derived(
	name.trim().length > 0 && email.trim().length > 0 && strength.score >= 3 && passwordsMatch && !registering,
);

async function handleRegister() {
	if (!canSubmit) return;
	registering = true;
	await simulate(2000);
	registered = true;
	registering = false;
}

function reset() {
	name = '';
	email = '';
	password = '';
	confirmPassword = '';
	showPassword = false;
	registering = false;
	registered = false;
}
</script>

<section id="auth-stronghold" class="section">
	<h2 class="section-title">Stronghold</h2>
	<p class="section-description">
		Registration form with live password strength meter and requirements checklist.
		Password must score "Good" or better to submit.
	</p>

	<div class="demos">
		<div class="stronghold-frame">
			<CornerFrame variant="inset" />
			<ConcentricRings rings={4} shape="square" size={80} opacity={0.12} class="rings-ornament" />

			<div class="stronghold-inner">
				<div class="stronghold-header">
					<span class="i-lucide-shield text-3xl text-primary" aria-hidden="true"></span>
					<h3 class="text-xl font-bold text-fg">Create account</h3>
					<p class="text-sm text-muted">Set up your credentials</p>
				</div>

				{#if registered}
					<div class="success-alert" role="status">
						<span class="i-lucide-check-circle text-lg" aria-hidden="true"></span>
						<div>
							<p class="font-medium">Account created</p>
							<p class="text-sm">Welcome, <strong>{name}</strong>! Your account is ready.</p>
						</div>
					</div>

					<div class="reset-bar">
						<Button variant="ghost" size="sm" onclick={reset}>
							<span class="i-lucide-rotate-ccw text-sm mr-1" aria-hidden="true"></span>
							Reset Demo
						</Button>
					</div>
				{:else}
					<div class="form-fields">
						<div class="field">
							<label class="field-label" for="reg-name">Full name</label>
							<Input
								id="reg-name"
								type="text"
								placeholder="Jane Doe"
								bind:value={name}
								disabled={registering}
							/>
						</div>

						<div class="field">
							<label class="field-label" for="reg-email">Email</label>
							<Input
								id="reg-email"
								type="email"
								placeholder="jane@example.com"
								bind:value={email}
								disabled={registering}
							/>
						</div>

						<WaveDivider shape="zigzag" height={8} />

						<div class="field">
							<label class="field-label" for="reg-password">Password</label>
							<div class="password-wrap">
								<Input
									id="reg-password"
									type={showPassword ? 'text' : 'password'}
									placeholder="Enter a strong password"
									bind:value={password}
									disabled={registering}
								/>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									class="toggle-vis"
									onclick={() => showPassword = !showPassword}
									aria-label={showPassword ? 'Hide password' : 'Show password'}
								>
									<span
										class={showPassword ? 'i-lucide-eye-off' : 'i-lucide-eye'}
										aria-hidden="true"
									></span>
								</Button>
							</div>

							{#if password}
								<div class="strength-meter">
									<Progress
										value={strength.score}
										max={5}
										variant={strength.variant}
										size="sm"
									/>
									<span class="strength-label text-sm" class:text-error={strength.variant === 'error'} class:text-warning={strength.variant === 'warning'} class:text-success={strength.variant === 'success'}>
										{strength.label}
									</span>
								</div>

								<ul class="requirements">
									{#each requirements as req}
										<li class="requirement" class:met={req.test(password)}>
											<span
												class={req.test(password) ? 'i-lucide-check text-success' : 'i-lucide-x text-muted'}
												aria-hidden="true"
											></span>
											{req.label}
										</li>
									{/each}
								</ul>
							{/if}
						</div>

						<div class="field">
							<label class="field-label" for="reg-confirm">Confirm password</label>
							<Input
								id="reg-confirm"
								type={showPassword ? 'text' : 'password'}
								placeholder="Repeat your password"
								bind:value={confirmPassword}
								disabled={registering}
							/>
							{#if confirmPassword && !passwordsMatch}
								<p class="field-error">
									<span class="i-lucide-alert-circle text-sm" aria-hidden="true"></span>
									Passwords do not match
								</p>
							{/if}
							{#if passwordsMatch}
								<p class="field-success">
									<span class="i-lucide-check-circle text-sm" aria-hidden="true"></span>
									Passwords match
								</p>
							{/if}
						</div>
					</div>

					<Button
						variant="default"
						size="lg"
						class="w-full justify-center"
						disabled={!canSubmit}
						onclick={handleRegister}
					>
						{#if registering}
							<Spinner size="sm" class="mr-2" />
						{:else}
							<span class="i-lucide-user-plus text-lg mr-2" aria-hidden="true"></span>
						{/if}
						Create account
					</Button>
				{/if}
			</div>
		</div>
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

	.stronghold-frame {
		position: relative;
		max-width: 460px;
		margin: 0 auto;
		padding: var(--spacing-6);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		overflow: hidden;
	}

	:global(.rings-ornament) {
		position: absolute;
		top: -10px;
		right: -10px;
		pointer-events: none;
	}

	.stronghold-inner {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.stronghold-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		text-align: center;
	}

	.stronghold-header h3,
	.stronghold-header p {
		margin: 0;
	}

	.form-fields {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.field-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: var(--color-fg);
	}

	.password-wrap {
		position: relative;
	}

	.toggle-vis {
		position: absolute;
		right: var(--spacing-3);
		top: 50%;
		transform: translateY(-50%);
		background: none;
		border: none;
		color: var(--color-muted);
		cursor: pointer;
		padding: var(--spacing-1);
		display: flex;
		align-items: center;
	}

	.toggle-vis:hover {
		color: var(--color-fg);
	}

	.strength-meter {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		margin-top: var(--spacing-1);
	}

	.strength-label {
		white-space: nowrap;
		font-weight: 500;
	}

	.text-error {
		color: var(--color-error);
	}

	.text-warning {
		color: var(--color-warning);
	}

	.text-success {
		color: var(--color-success);
	}

	.requirements {
		list-style: none;
		margin: var(--spacing-1) 0 0 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.requirement {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		font-size: 0.8125rem;
		color: var(--color-muted);
	}

	.requirement.met {
		color: var(--color-fg);
	}

	.field-error {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-error);
	}

	.field-success {
		display: flex;
		align-items: center;
		gap: var(--spacing-1);
		margin: 0;
		font-size: 0.8125rem;
		color: var(--color-success);
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

	.reset-bar {
		display: flex;
		justify-content: center;
	}
</style>
