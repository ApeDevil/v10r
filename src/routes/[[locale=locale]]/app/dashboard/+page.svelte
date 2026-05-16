<script lang="ts">
import { Card, DiagGrid, DiagRow } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
</script>
<Stack gap="6">
	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_dashboard_heading_profile()}</h2>
		{/snippet}

		<DiagGrid>
			{#if data.user}
				<DiagRow label={m.app_dashboard_label_name()}>{data.user.name}</DiagRow>
				<DiagRow label={m.app_dashboard_label_email()}><code>{data.user.email}</code></DiagRow>
				<DiagRow label={m.app_dashboard_label_user_id()}><code>{data.user.id}</code></DiagRow>
				{#if data.user.image}
					<DiagRow label={m.app_dashboard_label_avatar()}>
						<img src={data.user.image} alt={m.app_dashboard_avatar_alt()} class="avatar-img" />
					</DiagRow>
				{/if}
			{/if}
		</DiagGrid>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.app_account_heading_linked_accounts()}</h2>
		{/snippet}

		{#if data.accounts.length > 0}
			<DiagGrid>
				{#each data.accounts as acc}
					<DiagRow label={acc.provider} class="capitalize">
						<Badge variant="success">{m.app_account_badge_connected()}</Badge>
					</DiagRow>
				{/each}
			</DiagGrid>
		{:else}
			<p class="text-muted text-sm">{m.app_dashboard_no_linked_accounts()}</p>
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
