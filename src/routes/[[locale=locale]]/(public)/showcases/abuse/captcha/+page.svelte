<script lang="ts">
import { Altcha, Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

let payload = $state<string | null>(null);
let widgetKey = $state(0);

const modeVariant = data.mode === 'live' ? 'success' : data.mode === 'dry_run' ? 'warning' : 'error';

function onverified(p: string) {
	payload = p;
}

function reset() {
	payload = null;
	widgetKey += 1;
}
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_captcha_card_mode()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">BOT_DETECTION_MODE</span>
				<Badge variant={modeVariant}>{data.mode}</Badge>
			</div>
			<div class="diag-row">
				<span class="diag-label">HMAC key</span>
				<Badge variant={data.hmacConfigured ? 'success' : 'error'}>
					{data.hmacConfigured ? `Configured (${data.hmacKeyLength} chars)` : 'Missing or too short'}
				</Badge>
			</div>
		</div>

		<p class="card-note">
			ALTCHA is a self-hosted proof-of-work captcha. The browser computes a SHA-256 hash collision (cost {data.cost.toLocaleString()}),
			and the server verifies the answer + an HMAC signature. No third-party service, no tracking.
		</p>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_captcha_card_config()}</h2>
		{/snippet}

		<div class="diag-grid">
			<div class="diag-row">
				<span class="diag-label">Algorithm</span>
				<code class="diag-mono">{data.algorithm}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Cost</span>
				<code class="diag-mono">{data.cost.toLocaleString()}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Challenge expiry</span>
				<code class="diag-mono">{data.challengeExpiryMs / 1000}s</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Replay store</span>
				<Badge variant={data.replayStore.backend === 'Upstash Redis' ? 'success' : 'error'}>
					{data.replayStore.backend}
				</Badge>
			</div>
			<div class="diag-row">
				<span class="diag-label">Replay key prefix</span>
				<code class="diag-mono">{data.replayStore.keyPrefix}</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Replay TTL</span>
				<code class="diag-mono">{data.replayStore.ttlSeconds / 60} min</code>
			</div>
			<div class="diag-row">
				<span class="diag-label">Challenge rate limit</span>
				<span class="diag-value">{data.challengeRateLimit.max} per {data.challengeRateLimit.window} (per {data.challengeRateLimit.keyedOn})</span>
			</div>
		</div>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_captcha_card_demo()}</h2>
		{/snippet}

		{#if data.mode === 'off'}
			<div class="demo-disabled">
				<span class="i-lucide-power-off" aria-hidden="true"></span>
				<p>Captcha is disabled (<code>BOT_DETECTION_MODE=off</code>). The widget would render here.</p>
			</div>
		{:else if !data.hmacConfigured}
			<div class="demo-disabled">
				<span class="i-lucide-alert-triangle" aria-hidden="true"></span>
				<p>HMAC key is missing or too short. Set <code>ALTCHA_HMAC_KEY</code> (32+ chars) to enable the live widget.</p>
			</div>
		{:else}
			<div class="demo">
				<p class="demo-instruction">
					Solve the captcha below. The widget fetches a challenge from
					<code>/api/captcha/challenge</code>, runs the proof-of-work in your browser,
					and surfaces the signed payload that would normally accompany an auth request.
				</p>

				{#key widgetKey}
					<div class="demo-widget">
						<Altcha {onverified} />
					</div>
				{/key}

				{#if payload}
					<div class="payload-block">
						<header class="payload-head">
							<Badge variant="success">Verified</Badge>
							<button type="button" class="payload-reset" onclick={reset}>
								<span class="i-lucide-rotate-cw" aria-hidden="true"></span>
								Reset
							</button>
						</header>
						<pre class="payload-body">{payload}</pre>
						<p class="payload-hint">
							This payload is single-use. The login page sends it as the <code>x-altcha-token</code> header;
							the server verifies the HMAC, then records the nonce so the same payload can never be replayed.
						</p>
					</div>
				{/if}
			</div>
		{/if}
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_abuse_captcha_card_surfaces()}</h2>
		{/snippet}

		<ul class="surface-list">
			<li>
				<code class="diag-mono">POST /api/auth/sign-in/magic-link</code>
				<span class="surface-note">— magic-link send</span>
			</li>
			<li>
				<code class="diag-mono">POST /api/auth/email-otp/send-verification-otp</code>
				<span class="surface-note">— email OTP send</span>
			</li>
		</ul>

		<p class="card-note">
			Enforcement happens in <code>authCaptchaGate</code> (a SvelteKit handler in <code>hooks.server.ts</code>) before the
			request reaches Better Auth.
		</p>
	</Card>
</Stack>

<style>
	.diag-grid {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.diag-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.diag-row:nth-child(odd) {
		background: var(--color-subtle);
	}

	.diag-label {
		font-weight: 500;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.diag-value {
		font-size: var(--text-fluid-sm);
		text-align: right;
	}

	.diag-mono {
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		word-break: break-all;
	}

	.card-note {
		margin: var(--spacing-3) 0 0 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.card-note code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.demo-instruction {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.demo-instruction code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
	}

	.demo-widget {
		display: flex;
		justify-content: flex-start;
	}

	.demo-disabled {
		display: flex;
		gap: var(--spacing-3);
		align-items: flex-start;
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.demo-disabled span {
		flex-shrink: 0;
		width: 1.25rem;
		height: 1.25rem;
		margin-top: 0.1rem;
		color: var(--color-muted);
	}

	.demo-disabled p {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.55;
	}

	.demo-disabled code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-bg);
	}

	.payload-block {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		border: 1px solid var(--color-border);
	}

	.payload-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.payload-reset {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		background: transparent;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-sm);
		padding: var(--spacing-1) var(--spacing-3);
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		cursor: pointer;
	}

	.payload-reset span {
		width: 0.875rem;
		height: 0.875rem;
	}

	.payload-reset:hover {
		border-color: var(--color-primary);
	}

	.payload-body {
		margin: 0;
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		word-break: break-all;
		white-space: pre-wrap;
		line-height: 1.5;
	}

	.payload-hint {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.payload-hint code {
		font-family: ui-monospace, monospace;
		font-size: 0.92em;
		padding: 0.05em 0.3em;
		border-radius: var(--radius-sm);
		background: var(--color-bg);
	}

	.surface-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.surface-list li {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: var(--color-subtle);
		flex-wrap: wrap;
	}

	.surface-note {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
