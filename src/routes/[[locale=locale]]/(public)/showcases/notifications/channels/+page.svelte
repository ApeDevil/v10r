<script lang="ts">
import { Card, DiagGrid, DiagRow, NavSection } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

let { data } = $props();
const sections = $derived([
	{ id: 'channels-providers', label: m.showcase_notifications_channels_card_providers() },
	{ id: 'channels-user', label: m.showcase_notifications_channels_card_user() },
	{ id: 'channels-system', label: m.showcase_notifications_channels_card_system() },
	{ id: 'channels-files', label: m.showcase_notifications_channels_card_files() },
]);
</script>
<NavSection {sections} />

<Stack gap="6">
	<!-- Provider Config -->
	<Card id="channels-providers">
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_channels_card_providers()}</h2>
		{/snippet}

		<DiagGrid>
			<DiagRow label="Email ({data.providers.email.name})">
				{#if data.providers.email.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</DiagRow>

			<DiagRow label="Telegram ({data.providers.telegram.name})">
				{#if data.providers.telegram.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</DiagRow>

			<DiagRow label="Discord ({data.providers.discord.name})">
				{#if data.providers.discord.configured}
					<Badge variant="success">Configured</Badge>
				{:else}
					<Badge variant="warning">Missing</Badge>
				{/if}
			</DiagRow>
		</DiagGrid>
	</Card>

	<!-- User Channels -->
	{#if data.userChannels}
		<Card id="channels-user">
			{#snippet header()}
				<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_channels_card_user()}</h2>
			{/snippet}

			<DiagGrid>
				<DiagRow label="In-App (SSE)">
					<Badge variant="success">Active</Badge>
				</DiagRow>

				<DiagRow label="Email">
					<code>{data.userChannels.email}</code>
				</DiagRow>

				<DiagRow label="Telegram">
					{#if data.userChannels.telegram?.active}
						<Badge variant="success">Connected</Badge>
						<code>@{data.userChannels.telegram.username}</code>
					{:else}
						<Badge variant="secondary">Not connected</Badge>
						<a href="/account/notifications/settings">Settings</a>
					{/if}
				</DiagRow>

				<DiagRow label="Discord">
					{#if data.userChannels.discord?.active}
						<Badge variant="success">Connected</Badge>
						<code>{data.userChannels.discord.username}</code>
					{:else}
						<Badge variant="secondary">Not connected</Badge>
						<a href="/account/notifications/settings">Settings</a>
					{/if}
				</DiagRow>
			</DiagGrid>
		</Card>
	{/if}

	<!-- System Config -->
	<Card id="channels-system">
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_channels_card_system()}</h2>
		{/snippet}

		<DiagGrid>
			<DiagRow label="Delivery Interval"><code>{data.config.deliveryIntervalMs}ms</code></DiagRow>
			<DiagRow label="Max Delivery Attempts"><code>{data.config.deliveryMaxAttempts}</code></DiagRow>
			<DiagRow label="SSE Heartbeat"><code>{data.config.sseHeartbeatMs}ms</code></DiagRow>
			<DiagRow label="Max SSE per User"><code>{data.config.sseMaxPerUser}</code></DiagRow>
		</DiagGrid>
	</Card>

	<!-- Key Files -->
	<Card id="channels-files">
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">{m.showcase_notifications_channels_card_files()}</h2>
		{/snippet}

		<DiagGrid>
			<DiagRow label="Service"><code>src/lib/server/notifications/service.ts</code></DiagRow>
			<DiagRow label="Router"><code>src/lib/server/notifications/router.ts</code></DiagRow>
			<DiagRow label="Outbox"><code>src/lib/server/notifications/outbox.ts</code></DiagRow>
			<DiagRow label="SSE Stream"><code>src/lib/server/notifications/stream.ts</code></DiagRow>
			<DiagRow label="Providers"><code>src/lib/server/notifications/channels/</code></DiagRow>
			<DiagRow label="Schema"><code>src/lib/server/db/schema/notifications/</code></DiagRow>
			<DiagRow label="Settings UI"><code>src/routes/account/notifications/settings/</code></DiagRow>
		</DiagGrid>
	</Card>
</Stack>
