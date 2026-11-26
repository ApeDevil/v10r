<script lang="ts">
/**
 * Connected applications: what each authorized external application can reach, how its
 * identity was established, and a revoke action with its consequence stated before it runs.
 * Token values never reach this page (they are hashed server-side and never projected).
 */
import { Card, ConfirmDialog, EmptyState } from '#lib/components/composites/index.ts';
import { Stack } from '#lib/components/layout/index.ts';
import { Badge, Button } from '#lib/components/primitives/index.ts';
import { formatDate } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { getToast } from '#lib/state/toast.svelte.ts';
import { enhance } from '$app/forms';
import { page } from '$app/state';

let { data } = $props();
const toast = getToast();

type Authorization = (typeof data.authorizations)[number];

let target = $state<Authorization | null>(null);
let confirmOpen = $state(false);
let revokeForm = $state<HTMLFormElement | null>(null);

function nameOf(authorization: Authorization): string {
	const identity = authorization.identity;
	if (identity.kind === 'verified-domain') return identity.recognizedAs ?? identity.declaredName ?? identity.domain;
	return identity.declaredName ?? m.auth_authorize_unnamed_application();
}

function askRevoke(authorization: Authorization) {
	target = authorization;
	confirmOpen = true;
}
</script>

<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.account_connections_heading()}</h2>
		{/snippet}
		<p class="intro">{m.account_connections_intro()}</p>

		{#if data.authorizations.length === 0}
			<EmptyState icon="i-lucide-plug" title={m.account_connections_empty_title()} description={m.account_connections_empty_body()} />
		{:else}
			<ul class="connections">
				{#each data.authorizations as authorization (authorization.id)}
					<li class="connection">
						<div class="connection-info">
							<p class="connection-name">
								<strong>{nameOf(authorization)}</strong>
								{#if authorization.identity.kind === 'verified-domain'}
									<Badge variant="success">{m.account_connections_verified({ domain: authorization.identity.domain })}</Badge>
								{:else}
									<Badge variant="warning">{m.auth_authorize_self_declared()}</Badge>
								{/if}
							</p>
							<p class="services">
								{#each authorization.services as service (service.id)}
									<Badge variant="secondary">{service.name}</Badge>
								{/each}
								{#if authorization.staysConnected}
									<span class="muted">{m.account_connections_stays_connected()}</span>
								{/if}
							</p>
							<p class="muted">
								{m.account_connections_authorized_on({ date: formatDate(new Date(authorization.authorizedAt), page.data.locale) })}
								{#if authorization.lastRenewedAt}
									· {m.account_connections_last_renewed({ date: formatDate(new Date(authorization.lastRenewedAt), page.data.locale) })}
								{/if}
							</p>
						</div>
						<Button variant="outline" size="sm" onclick={() => askRevoke(authorization)}>
							{m.account_connections_revoke()}
						</Button>
					</li>
				{/each}
			</ul>
		{/if}
	</Card>
</Stack>

<form
	method="POST"
	action="?/revoke"
	bind:this={revokeForm}
	use:enhance={() =>
		async ({ result, update }) => {
			await update();
			if (result.type === 'success') toast.success(m.account_connections_revoked());
			else if (result.type === 'failure') toast.error(m.account_connections_revoke_failed());
			target = null;
		}}
>
	<input type="hidden" name="authorizationId" value={target?.id ?? ''} />
</form>

<ConfirmDialog
	bind:open={confirmOpen}
	title={m.account_connections_revoke_title({ application: target ? nameOf(target) : '' })}
	description={m.account_connections_revoke_consequence()}
	confirmLabel={m.account_connections_revoke()}
	destructive
	onconfirm={() => {
		confirmOpen = false;
		revokeForm?.requestSubmit();
	}}
	oncancel={() => {
		confirmOpen = false;
		target = null;
	}}
/>

<style>
	.intro {
		margin: 0 0 var(--spacing-4);
		color: var(--color-muted);
	}

	.connections {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.connection {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--spacing-3);
		padding: var(--spacing-3);
		border-radius: var(--radius-sm);
	}

	.connection:nth-child(odd) {
		background: var(--color-subtle);
	}

	.connection-info {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.connection-name,
	.services {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		margin: 0;
		overflow-wrap: anywhere;
	}

	.muted {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
	}
</style>
