<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { superForm } from 'sveltekit-superforms';
import { BackLink, Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Switch } from '$lib/components/primitives';
import { buttonVariants } from '$lib/components/primitives/button';
import { getToast } from '$lib/state';

let { data } = $props();

const toast = getToast();
let connectingTelegram = $state(false);
let telegramDeepLink = $state<string | null>(null);

const { form, enhance, submitting, message } = superForm(data.form, {
	onUpdated({ form }) {
		if (form.message) toast.success(form.message);
	},
});

$effect(() => {
	if (data.successMessage === 'discord_connected') {
		toast.success('Discord connected successfully');
		goto(page.url.pathname, { replaceState: true });
	}
	if (data.errorMessage === 'discord_denied') {
		toast.error('Discord connection was denied');
		goto(page.url.pathname, { replaceState: true });
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

	<form method="POST" use:enhance>
		<Stack gap="5">
			<!-- Email -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">Email Notifications</h3>
					<p class="text-fluid-sm text-muted mt-1">Choose which notifications you receive by email.</p>
				{/snippet}

				<Stack gap="3">
					<Switch bind:checked={$form.emailMention} label="Mentions" size="sm" />
					<Switch bind:checked={$form.emailComment} label="Comments" size="sm" />
					<Switch bind:checked={$form.emailSystem} label="System" size="sm" />
					<Switch bind:checked={$form.emailSuccess} label="Success" size="sm" />
					<Switch bind:checked={$form.emailSecurity} label="Security" size="sm" />
					<Switch bind:checked={$form.emailFollow} label="Follows" size="sm" />
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
						<Switch bind:checked={$form.telegramMention} label="Mentions" size="sm" />
						<Switch bind:checked={$form.telegramComment} label="Comments" size="sm" />
						<Switch bind:checked={$form.telegramSystem} label="System" size="sm" />
						<Switch bind:checked={$form.telegramSecurity} label="Security" size="sm" />
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
						<Switch bind:checked={$form.discordMention} label="Mentions" size="sm" />
						<Switch bind:checked={$form.discordComment} label="Comments" size="sm" />
						<Switch bind:checked={$form.discordSystem} label="System" size="sm" />
						<Switch bind:checked={$form.discordSecurity} label="Security" size="sm" />
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
								checked={$form.digestFrequency === freq}
								onchange={() => $form.digestFrequency = freq as typeof $form.digestFrequency}
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
						<Input type="time" name="quietStart" bind:value={$form.quietStart} />
					</label>
					<label class="time-field">
						<span class="text-fluid-sm">End</span>
						<Input type="time" name="quietEnd" bind:value={$form.quietEnd} />
					</label>
				</Cluster>
			</Card>

			<Cluster justify="end">
				<Button type="submit" disabled={$submitting}>
					{$submitting ? 'Saving...' : 'Save settings'}
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
