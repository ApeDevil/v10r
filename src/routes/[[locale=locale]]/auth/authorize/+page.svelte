<script lang="ts">
/**
 * Authorization page: an external application asks to use a Velociraptor service on the
 * signed-in user's behalf. Identity is shown as far as it is established — a verified domain
 * (Client ID Metadata Document) or a self-declared name (dynamic registration) — and the
 * request's reach is stated in both directions: what the application may do, and what it
 * does not get. The application's logo is never fetched or rendered (untrusted metadata).
 */
import { Alert } from '#lib/components/composites/index.ts';
import { Badge, Button } from '#lib/components/primitives/index.ts';
import { localizeHref } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { enhance } from '$app/forms';

let { data, form } = $props();

const identity = $derived(data.application.identity);
const heading = $derived(
	identity.kind === 'verified-domain'
		? (identity.recognizedAs ?? identity.declaredName ?? identity.domain)
		: (identity.declaredName ?? m.auth_authorize_unnamed_application()),
);
let submitting = $state<'allow' | 'deny' | null>(null);
</script>

<div class="authorize-page">
	<div class="authorize-card">
		<header class="authorize-header">
			<span class="i-lucide-plug text-2xl text-primary" aria-hidden="true"></span>
			<h1 class="text-xl font-bold text-fg">{m.auth_authorize_title({ application: heading })}</h1>
		</header>

		<section class="identity" aria-label={m.auth_authorize_identity_label()}>
			{#if identity.kind === 'verified-domain'}
				<p class="identity-line">
					<Badge variant="success">{m.auth_authorize_verified_domain()}</Badge>
					<strong>{identity.domain}</strong>
				</p>
				<p class="hint">{m.auth_authorize_verified_domain_hint({ domain: identity.domain })}</p>
				{#if identity.declaredName && identity.declaredName !== heading}
					<p class="hint">{m.auth_authorize_declared_name({ name: identity.declaredName })}</p>
				{/if}
			{:else}
				<p class="identity-line">
					<Badge variant="warning">{m.auth_authorize_self_declared()}</Badge>
					{#if identity.declaredHost}<span>{identity.declaredHost}</span>{/if}
				</p>
				<p class="hint">{m.auth_authorize_self_declared_hint()}</p>
			{/if}
			{#if data.application.redirectsToThisDevice}
				<p class="hint">{m.auth_authorize_returns_to_device()}</p>
			{:else if data.application.redirectHost}
				<p class="hint">{m.auth_authorize_returns_to({ host: data.application.redirectHost })}</p>
			{/if}
		</section>

		<section class="reach" aria-labelledby="authorize-allows">
			<h2 id="authorize-allows" class="reach-heading">{m.auth_authorize_allows_heading()}</h2>
			<ul class="reach-list">
				{#each data.services as service (service.id)}
					<li>
						<span class="i-lucide-check text-success" aria-hidden="true"></span>
						<span>
							<strong>{service.name}</strong> — {service.id === '3d'
								? m.auth_authorize_scope_mcp_3d()
								: m.auth_authorize_scope_generic()}
						</span>
					</li>
				{/each}
				{#if data.staysConnected}
					<li>
						<span class="i-lucide-check text-success" aria-hidden="true"></span>
						<span>{m.auth_authorize_scope_offline()}</span>
					</li>
				{/if}
			</ul>
			<h2 class="reach-heading">{m.auth_authorize_denies_heading()}</h2>
			<ul class="reach-list">
				<li>
					<span class="i-lucide-x text-muted" aria-hidden="true"></span>
					<span>{m.auth_authorize_denies_account()}</span>
				</li>
			</ul>
		</section>

		{#if data.services.length === 0}
			<Alert variant="warning" description={m.auth_authorize_no_known_service()} />
		{/if}

		{#if form?.message}
			<Alert variant="error" description={form.message} />
		{/if}

		<p class="hint">
			{m.auth_authorize_signed_in_as({ email: data.account.email })}
			{m.auth_authorize_revoke_later()}
			<a href={localizeHref('/account/connections')} class="link">{m.auth_authorize_connections_link()}</a>
		</p>

		<form
			method="POST"
			class="decision"
			use:enhance={({ submitter }) => {
				submitting = submitter?.getAttribute('value') === 'deny' ? 'deny' : 'allow';
				return async ({ update }) => {
					await update();
					submitting = null;
				};
			}}
		>
			<input type="hidden" name="oauth_query" value={data.oauthQuery} />
			<Button type="submit" name="decision" value="deny" variant="outline" disabled={submitting !== null}>
				{m.auth_authorize_deny()}
			</Button>
			<Button
				type="submit"
				name="decision"
				value="allow"
				variant="primary"
				disabled={submitting !== null || data.services.length === 0}
			>
				{m.auth_authorize_allow()}
			</Button>
		</form>
	</div>
</div>

<style>
	.authorize-page {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: var(--spacing-4);
	}

	.authorize-card {
		width: 100%;
		max-width: 460px;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		background: var(--surface-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-xl);
		padding: var(--spacing-6);
		box-shadow: var(--shadow-lg);
	}

	.authorize-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.authorize-header h1 {
		margin: 0;
		overflow-wrap: anywhere;
	}

	.identity,
	.reach {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.identity-line {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.hint {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.reach-heading {
		margin: var(--spacing-2) 0 0;
		font-size: var(--text-fluid-sm);
		font-weight: 600;
	}

	.reach-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.reach-list li {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
	}

	.link {
		color: var(--color-fg);
		text-decoration: underline;
	}

	.decision {
		display: flex;
		justify-content: flex-end;
		flex-wrap: wrap;
		gap: var(--spacing-2);
	}
</style>
