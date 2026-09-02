<script lang="ts">
import { Alert, Card, DiagGrid, DiagRow } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

let { data } = $props();

// Passkey enrollment nudge: in-flow prompts drive adoption that a
// settings-only surface never reaches. Dismissal is per-session.
const NUDGE_DISMISS_KEY = 'v10r:passkey-nudge-dismissed';
let nudgeDismissed = $state(typeof sessionStorage !== 'undefined' && sessionStorage.getItem(NUDGE_DISMISS_KEY) === '1');

function dismissNudge() {
	nudgeDismissed = true;
	sessionStorage.setItem(NUDGE_DISMISS_KEY, '1');
}
</script>
<Stack gap="6">
	{#if data.showPasskeyNudge && !nudgeDismissed}
		<Alert variant="info" title={m.account_dashboard_passkey_nudge_title()} closable onclose={dismissNudge}>
			{#snippet children()}
				<p class="mb-3">{m.account_dashboard_passkey_nudge_body()}</p>
				<Button href={localizeHref('/account/security')} variant="outline" size="sm">
					<span class="i-lucide-fingerprint h-4 w-4 mr-1"></span>
					{m.account_dashboard_passkey_nudge_cta()}
				</Button>
			{/snippet}
		</Alert>
	{/if}

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.account_dashboard_heading_profile()}</h2>
		{/snippet}

		<DiagGrid>
			{#if data.user}
				<DiagRow label={m.account_dashboard_label_name()}>{data.user.name}</DiagRow>
				<DiagRow label={m.account_dashboard_label_email()}><code>{data.user.email}</code></DiagRow>
				<DiagRow label={m.account_dashboard_label_user_id()}><code>{data.user.id}</code></DiagRow>
				{#if data.user.image}
					<DiagRow label={m.account_dashboard_label_avatar()}>
						<img src={data.user.image} alt={m.account_dashboard_avatar_alt()} class="avatar-img" />
					</DiagRow>
				{/if}
			{/if}
		</DiagGrid>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.account_heading_linked_accounts()}</h2>
		{/snippet}

		{#if data.accounts.length > 0}
			<DiagGrid>
				{#each data.accounts as acc}
					<DiagRow label={acc.provider} class="capitalize">
						<Badge variant="success">{m.account_badge_connected()}</Badge>
					</DiagRow>
				{/each}
			</DiagGrid>
		{:else}
			<p class="text-muted text-sm">{m.account_dashboard_no_linked_accounts()}</p>
		{/if}
	</Card>
</Stack>

<style>
	.avatar-img {
		width: 2rem;
		height: 2rem;
		border-radius: var(--radius-full);
	}
</style>
