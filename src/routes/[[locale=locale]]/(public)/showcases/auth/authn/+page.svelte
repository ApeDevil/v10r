<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Input, Spinner } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { fixtureVerifications } from '$lib/showcase/auth/fixture';
import ModeChip from '$lib/showcase/auth/ModeChip.svelte';

// Sandbox sign-in — pure client state, NO network, NO authClient.
let email = $state('');
let sending = $state<'magic-link' | 'otp' | null>(null);
let sentMethod = $state<'magic-link' | 'otp' | null>(null);

// The "OTP" is a fabricated fixture value, never a real code.
const fixtureOtp = '424242';

async function fakeSend(method: 'magic-link' | 'otp') {
	if (!email.trim() || sending) return;
	sending = method;
	// Deterministic 800ms latency so it feels like a real round-trip.
	await new Promise((r) => setTimeout(r, 800));
	sending = null;
	sentMethod = method;
}

function reset() {
	sentMethod = null;
	sending = null;
}

const FLOW_STEPS = [
	'User submits email → POST /api/auth/sign-in/{magic-link|email-otp}',
	'ALTCHA captcha gate verifies the token (authCaptchaGate, before Better Auth)',
	'Per-email + per-IP (Upstash) rate limits checked',
	'Better Auth issues a short-lived token (300s) and sends it via Resend',
	'User returns with the token → session row created (7-day expiry)',
	'sessionPopulate resolves the cookie into locals.user / locals.session',
];

// Hard-coded from src/hooks.server.ts `sequence(...)` — auth-relevant rows flagged.
const HANDLERS: { name: string; role: string; auth?: boolean }[] = [
	{ name: 'securityHeaders', role: 'Stamps x-client-ip + security headers', auth: true },
	{ name: 'stripBaseLocalePrefix', role: 'i18n path normalization' },
	{ name: 'loadStyle', role: 'Resolves the active style' },
	{ name: 'i18n', role: 'Locale detection' },
	{ name: 'authCaptchaGate', role: 'ALTCHA gate on auth send endpoints', auth: true },
	{ name: 'authHandler', role: 'Better Auth svelteKitHandler (does NOT populate locals)', auth: true },
	{ name: 'sessionPopulate', role: 'Reads cookie → locals.user / locals.session', auth: true },
	{ name: 'csrfProtection', role: 'x-requested-with + same-origin on JSON mutations', auth: true },
	{ name: 'consentLoader', role: 'Analytics consent tier' },
	{ name: 'debugOwnerLoader', role: 'Optional HMAC debug pairing' },
	{ name: 'devRouteGuard', role: 'Hides dev routes outside dev' },
	{ name: 'analyticsCollector', role: 'Event collection' },
];

const freshVerification = fixtureVerifications.find((v) => v._lifecycle === 'fresh');
</script>

<Stack gap="6">
	<p class="intro">{m.showcase_auth_authn_intro()}</p>

	<!-- Sandbox sign-in -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authn_signin_card()}</h2>
				<ModeChip mode="sandbox" />
			</div>
		{/snippet}

		{#if sentMethod}
			<div class="sent" role="status">
				<span class="i-lucide-mail-check text-lg" aria-hidden="true"></span>
				<div>
					{#if sentMethod === 'magic-link'}
						<p class="font-medium">Magic link "sent" to <strong>{email}</strong></p>
						<p class="text-sm text-muted">No email left the building — this is a sandbox.</p>
					{:else}
						<p class="font-medium">Verification code for <strong>{email}</strong></p>
						<p class="otp">{fixtureOtp}</p>
						<p class="text-sm text-muted">Fabricated fixture code — never a real OTP.</p>
					{/if}
				</div>
			</div>
			<Button variant="ghost" size="sm" onclick={reset}>Use a different email</Button>
		{:else}
			<div class="signin">
				<label class="lbl" for="authn-email">Email</label>
				<Input
					id="authn-email"
					type="email"
					placeholder="you@example.com"
					bind:value={email}
					disabled={!!sending}
				/>
				<div class="row">
					<Button
						variant="default"
						size="sm"
						class="flex-1 justify-center"
						disabled={!!sending || !email.trim()}
						onclick={() => fakeSend('magic-link')}
					>
						{#if sending === 'magic-link'}<Spinner size="xs" class="mr-2" />{:else}<span
								class="i-lucide-link text-lg mr-2"
								aria-hidden="true"
							></span>{/if}
						Magic link
					</Button>
					<Button
						variant="outline"
						size="sm"
						class="flex-1 justify-center"
						disabled={!!sending || !email.trim()}
						onclick={() => fakeSend('otp')}
					>
						{#if sending === 'otp'}<Spinner size="xs" class="mr-2" />{:else}<span
								class="i-lucide-hash text-lg mr-2"
								aria-hidden="true"
							></span>{/if}
						Send code
					</Button>
				</div>
			</div>
		{/if}

		<details class="how">
			<summary>{m.showcase_auth_howto()}</summary>
			<p>
				This form is visually identical to the real one but runs entirely in the browser: no
				<code>authClient</code> call, no network request, no account created. The whole Identity
				&amp; Access showcase has zero server code, so it physically cannot leak a session.
			</p>
		</details>
	</Card>

	<!-- Recorded flow -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authn_flow_card()}</h2>
				<ModeChip mode="recorded" />
			</div>
		{/snippet}
		<ol class="steps">
			{#each FLOW_STEPS as step, i (i)}
				<li><span class="step-n">{i + 1}</span><span>{step}</span></li>
			{/each}
		</ol>
		{#if freshVerification}
			<p class="text-sm text-muted mt-3">
				Verification rows are TTL-governed: e.g. <code>{freshVerification.id}</code> expires at
				<code>{freshVerification.expiresAt}</code> — value column is
				<code>{freshVerification.value}</code> (never selected).
			</p>
		{/if}
	</Card>

	<!-- Recorded middleware order -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authn_middleware_card()}</h2>
				<ModeChip mode="recorded" />
			</div>
		{/snippet}
		<p class="text-sm text-muted mb-3">
			The exact <code>sequence(...)</code> order from <code>hooks.server.ts</code>. Auth-relevant
			handlers are highlighted. <code>authHandler</code> runs Better Auth but deliberately does
			<em>not</em> populate <code>locals</code> — <code>sessionPopulate</code> does, two steps later.
		</p>
		<ol class="handlers">
			{#each HANDLERS as h, i (h.name)}
				<li class:auth={h.auth}>
					<span class="h-n">{i + 1}</span>
					<code class="h-name">{h.name}</code>
					<span class="h-role">{h.role}</span>
					{#if h.auth}<Badge variant="success">auth</Badge>{/if}
				</li>
			{/each}
		</ol>
		<details class="how">
			<summary>{m.showcase_auth_howto()}</summary>
			<p>
				This is recorded, not live: with no <code>+page.server.ts</code> the showcase can't
				introspect its own request. The order is transcribed verbatim from the real handler chain.
			</p>
		</details>
	</Card>
</Stack>

<style>
	.intro {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}
	.signin {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.lbl {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}
	.row {
		display: flex;
		gap: var(--spacing-2);
	}
	.sent {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
		border: 1px solid var(--color-primary);
		border-radius: var(--radius-md);
		margin-bottom: var(--spacing-3);
	}
	.sent p {
		margin: 0;
	}
	.otp {
		font-family: ui-monospace, monospace;
		font-size: 1.5rem;
		letter-spacing: 0.3em;
		color: var(--color-primary);
		margin: 0.25rem 0;
	}
	.steps,
	.handlers {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
	.steps li,
	.handlers li {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		font-size: var(--text-fluid-sm);
	}
	.steps li:nth-child(odd),
	.handlers li:nth-child(odd) {
		background: var(--color-subtle);
	}
	.handlers li.auth {
		background: color-mix(in srgb, var(--color-success, green) 9%, transparent);
	}
	.step-n,
	.h-n {
		flex-shrink: 0;
		width: 1.4rem;
		text-align: center;
		color: var(--color-muted);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
	}
	.h-name {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		min-width: 11rem;
	}
	.h-role {
		flex: 1;
		color: var(--color-muted);
	}
	.how {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
		font-size: var(--text-fluid-sm);
	}
	.how summary {
		cursor: pointer;
		color: var(--color-muted);
		font-weight: 500;
	}
	.how p {
		margin: var(--spacing-3) 0 0;
		color: var(--color-muted);
		line-height: 1.6;
	}
</style>
