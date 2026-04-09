<script lang="ts">
import { enhance } from '$app/forms';
import { BackLink, Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Switch } from '$lib/components/primitives';
import { buttonVariants } from '$lib/components/primitives/button';
import { getToast } from '$lib/state';

let { data, form } = $props();

const toast = getToast();
let saving = $state(false);
let connectingTelegram = $state(false);
let telegramDeepLink = $state<string | null>(null);

// Local mutable state for Switch components (initialized from server data)
// svelte-ignore state_referenced_locally
let emailMention = $state(data.settings.emailMention);
// svelte-ignore state_referenced_locally
let emailComment = $state(data.settings.emailComment);
// svelte-ignore state_referenced_locally
let emailSystem = $state(data.settings.emailSystem);
// svelte-ignore state_referenced_locally
let emailSuccess = $state(data.settings.emailSuccess);
// svelte-ignore state_referenced_locally
let emailSecurity = $state(data.settings.emailSecurity);
// svelte-ignore state_referenced_locally
let emailFollow = $state(data.settings.emailFollow);
// svelte-ignore state_referenced_locally
let telegramMention = $state(data.settings.telegramMention);
// svelte-ignore state_referenced_locally
let telegramComment = $state(data.settings.telegramComment);
// svelte-ignore state_referenced_locally
let telegramSystem = $state(data.settings.telegramSystem);
// svelte-ignore state_referenced_locally
let telegramSecurity = $state(data.settings.telegramSecurity);
// svelte-ignore state_referenced_locally
let discordMention = $state(data.settings.discordMention);
// svelte-ignore state_referenced_locally
let discordComment = $state(data.settings.discordComment);
// svelte-ignore state_referenced_locally
let discordSystem = $state(data.settings.discordSystem);
// svelte-ignore state_referenced_locally
let discordSecurity = $state(data.settings.discordSecurity);
// svelte-ignore state_referenced_locally
let digestFrequency = $state(data.settings.digestFrequency);
// svelte-ignore state_referenced_locally
let quietStart = $state(data.settings.quietStart ?? '');
// svelte-ignore state_referenced_locally
let quietEnd = $state(data.settings.quietEnd ?? '');

$effect(() => {
	if (form?.success) {
		toast.success('Notification settings saved');
	}
	if (data.successMessage === 'discord_connected') {
		toast.success('Discord connected successfully');
	}
	if (data.errorMessage === 'discord_denied') {
		toast.error('Discord connection was denied');
	}
});

async function connectTelegram() {
	connectingTelegram = true;
	try {
		const res = await fetch('/api/notifications/telegram/connect', {
			method: 'POST',
			headers: { 'X-Requested-With': 'fetch' },
		});
		if (res.ok) {
			const { deepLink } = await res.json();
			telegramDeepLink = deepLink;
			window.open(deepLink, '_blank');
		} else {
			const { error } = await res.json();
			toast.error(error ?? 'Failed to generate Telegram link');
		}
	} catch {
		toast.error('Failed to connect Telegram');
	} finally {
		connectingTelegram = false;
	}
}
</script>

<Stack gap="5">
	<h2 class="text-fluid-lg font-semibold">Notification Settings</h2>

	<form
		method="POST"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				saving = false;
				await update();
			};
		}}
	>
		<!-- Hidden inputs for Switch values (form submission) -->
		<input type="hidden" name="emailMention" value={emailMention ? 'on' : ''} />
		<input type="hidden" name="emailComment" value={emailComment ? 'on' : ''} />
		<input type="hidden" name="emailSystem" value={emailSystem ? 'on' : ''} />
		<input type="hidden" name="emailSuccess" value={emailSuccess ? 'on' : ''} />
		<input type="hidden" name="emailSecurity" value={emailSecurity ? 'on' : ''} />
		<input type="hidden" name="emailFollow" value={emailFollow ? 'on' : ''} />
		<input type="hidden" name="telegramMention" value={telegramMention ? 'on' : ''} />
		<input type="hidden" name="telegramComment" value={telegramComment ? 'on' : ''} />
		<input type="hidden" name="telegramSystem" value={telegramSystem ? 'on' : ''} />
		<input type="hidden" name="telegramSecurity" value={telegramSecurity ? 'on' : ''} />
		<input type="hidden" name="discordMention" value={discordMention ? 'on' : ''} />
		<input type="hidden" name="discordComment" value={discordComment ? 'on' : ''} />
		<input type="hidden" name="discordSystem" value={discordSystem ? 'on' : ''} />
		<input type="hidden" name="discordSecurity" value={discordSecurity ? 'on' : ''} />
		<input type="hidden" name="digestFrequency" value={digestFrequency} />

		<Stack gap="5">
			<!-- Email -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">Email Notifications</h3>
					<p class="text-fluid-sm text-muted mt-1">Choose which notifications you receive by email.</p>
				{/snippet}

				<Stack gap="3">
					<Switch bind:checked={emailMention} label="Mentions" size="sm" />
					<Switch bind:checked={emailComment} label="Comments" size="sm" />
					<Switch bind:checked={emailSystem} label="System" size="sm" />
					<Switch bind:checked={emailSuccess} label="Success" size="sm" />
					<Switch bind:checked={emailSecurity} label="Security" size="sm" />
					<Switch bind:checked={emailFollow} label="Follows" size="sm" />
				</Stack>
			</Card>

			<!-- Telegram -->
			<Card>
				{#snippet header()}
					<Cluster gap="3">
						<h3 class="text-fluid-base font-semibold">Telegram</h3>
						{#if data.telegram}
							<Badge variant={data.telegram.isActive ? 'success' : 'warning'}>
								{data.telegram.isActive ? 'Connected' : 'Inactive'}
							</Badge>
						{/if}
					</Cluster>
					{#if data.telegram?.telegramUsername}
						<p class="text-fluid-sm text-muted mt-1">Connected as @{data.telegram.telegramUsername}</p>
					{/if}
				{/snippet}

				{#if data.telegram?.isActive}
					<Stack gap="3">
						<Switch bind:checked={telegramMention} label="Mentions" size="sm" />
						<Switch bind:checked={telegramComment} label="Comments" size="sm" />
						<Switch bind:checked={telegramSystem} label="System" size="sm" />
						<Switch bind:checked={telegramSecurity} label="Security" size="sm" />
					</Stack>
				{:else}
					<Stack gap="3">
						<p class="text-fluid-sm text-muted">Connect your Telegram account to receive notifications via DM.</p>
						<div>
							<Button type="button" variant="secondary" onclick={connectTelegram} disabled={connectingTelegram}>
								{connectingTelegram ? 'Generating link...' : 'Connect Telegram'}
							</Button>
						</div>
						{#if telegramDeepLink}
							<p class="text-fluid-xs text-muted">A link has been opened. Send /start in Telegram to complete the connection.</p>
						{/if}
					</Stack>
				{/if}
			</Card>

			<!-- Discord -->
			<Card>
				{#snippet header()}
					<Cluster gap="3">
						<h3 class="text-fluid-base font-semibold">Discord</h3>
						{#if data.discord}
							<Badge variant={data.discord.isActive ? 'success' : 'warning'}>
								{data.discord.isActive ? 'Connected' : 'Inactive'}
							</Badge>
						{/if}
					</Cluster>
					{#if data.discord?.discordUsername}
						<p class="text-fluid-sm text-muted mt-1">Connected as {data.discord.discordUsername}</p>
					{/if}
				{/snippet}

				{#if data.discord?.isActive}
					<Stack gap="3">
						<Switch bind:checked={discordMention} label="Mentions" size="sm" />
						<Switch bind:checked={discordComment} label="Comments" size="sm" />
						<Switch bind:checked={discordSystem} label="System" size="sm" />
						<Switch bind:checked={discordSecurity} label="Security" size="sm" />
					</Stack>
				{:else}
					<Stack gap="3">
						<p class="text-fluid-sm text-muted">Connect your Discord account to receive notifications via DM.</p>
						<div>
							<a href="/api/notifications/discord/authorize" class={buttonVariants({ variant: 'secondary' })}>
								Connect Discord
							</a>
						</div>
					</Stack>
				{/if}
			</Card>

			<!-- Digest Frequency -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">Digest Frequency</h3>
				{/snippet}

				<Stack gap="3">
					{#each ['instant', 'daily', 'weekly', 'never'] as freq}
						<label class="radio-row">
							<input
								type="radio"
								value={freq}
								checked={digestFrequency === freq}
								onchange={() => digestFrequency = freq as typeof digestFrequency}
							/>
							<span class="capitalize">{freq}</span>
						</label>
					{/each}
				</Stack>
			</Card>

			<!-- Quiet Hours -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">Quiet Hours</h3>
					<p class="text-fluid-sm text-muted mt-1">Pause notifications during certain hours.</p>
				{/snippet}

				<Cluster gap="5">
					<label class="time-field">
						<span class="text-fluid-sm">Start</span>
						<Input type="time" name="quietStart" bind:value={quietStart} />
					</label>
					<label class="time-field">
						<span class="text-fluid-sm">End</span>
						<Input type="time" name="quietEnd" bind:value={quietEnd} />
					</label>
				</Cluster>
			</Card>

			<Cluster justify="end">
				<Button type="submit" disabled={saving}>
					{saving ? 'Saving...' : 'Save settings'}
				</Button>
			</Cluster>
		</Stack>
	</form>

	<BackLink href="/app/notifications" label="notifications" />
</Stack>

<style>
	.radio-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	.capitalize {
		text-transform: capitalize;
	}

	.time-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
</style>
