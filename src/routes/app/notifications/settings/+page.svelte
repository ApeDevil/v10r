<script lang="ts">
	import { enhance } from '$app/forms';
	import { Card } from '$lib/components/composites';
	import { Button } from '$lib/components/primitives/button';
	import { Badge } from '$lib/components/primitives/badge';
	import { BackLink } from '$lib/components/composites';
	import { getToast } from '$lib/state';

	let { data, form } = $props();

	const toast = getToast();
	let saving = $state(false);
	let connectingTelegram = $state(false);
	let telegramDeepLink = $state<string | null>(null);

	const s = data.settings;

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

<div class="settings-page">
	<BackLink href="/app/notifications" label="Back to notifications" />

	<h2 class="page-title">Notification Settings</h2>

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
		<!-- Email -->
		<Card class="settings-card">
			{#snippet header()}
				<h3 class="section-title">Email Notifications</h3>
				<p class="section-desc">Choose which notifications you receive by email.</p>
			{/snippet}

			<div class="toggle-list">
				<label class="toggle-row">
					<input type="checkbox" name="emailMention" checked={s.emailMention} />
					<span>Mentions</span>
				</label>
				<label class="toggle-row">
					<input type="checkbox" name="emailComment" checked={s.emailComment} />
					<span>Comments</span>
				</label>
				<label class="toggle-row">
					<input type="checkbox" name="emailSystem" checked={s.emailSystem} />
					<span>System</span>
				</label>
				<label class="toggle-row">
					<input type="checkbox" name="emailSuccess" checked={s.emailSuccess} />
					<span>Success</span>
				</label>
				<label class="toggle-row">
					<input type="checkbox" name="emailSecurity" checked={s.emailSecurity} />
					<span>Security</span>
				</label>
				<label class="toggle-row">
					<input type="checkbox" name="emailFollow" checked={s.emailFollow} />
					<span>Follows</span>
				</label>
			</div>
		</Card>

		<!-- Telegram -->
		<Card class="settings-card">
			{#snippet header()}
				<div class="channel-header">
					<h3 class="section-title">Telegram</h3>
					{#if data.telegram}
						<Badge variant={data.telegram.isActive ? 'success' : 'warning'}>
							{data.telegram.isActive ? 'Connected' : 'Inactive'}
						</Badge>
					{/if}
				</div>
				{#if data.telegram?.telegramUsername}
					<p class="section-desc">Connected as @{data.telegram.telegramUsername}</p>
				{/if}
			{/snippet}

			{#if data.telegram?.isActive}
				<div class="toggle-list">
					<label class="toggle-row">
						<input type="checkbox" name="telegramMention" checked={s.telegramMention} />
						<span>Mentions</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="telegramComment" checked={s.telegramComment} />
						<span>Comments</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="telegramSystem" checked={s.telegramSystem} />
						<span>System</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="telegramSecurity" checked={s.telegramSecurity} />
						<span>Security</span>
					</label>
				</div>
			{:else}
				<div class="connect-section">
					<p class="connect-desc">Connect your Telegram account to receive notifications via DM.</p>
					<Button type="button" variant="secondary" onclick={connectTelegram} disabled={connectingTelegram}>
						{connectingTelegram ? 'Generating link...' : 'Connect Telegram'}
					</Button>
					{#if telegramDeepLink}
						<p class="connect-hint">A link has been opened. Send /start in Telegram to complete the connection.</p>
					{/if}
				</div>
			{/if}
		</Card>

		<!-- Discord -->
		<Card class="settings-card">
			{#snippet header()}
				<div class="channel-header">
					<h3 class="section-title">Discord</h3>
					{#if data.discord}
						<Badge variant={data.discord.isActive ? 'success' : 'warning'}>
							{data.discord.isActive ? 'Connected' : 'Inactive'}
						</Badge>
					{/if}
				</div>
				{#if data.discord?.discordUsername}
					<p class="section-desc">Connected as {data.discord.discordUsername}</p>
				{/if}
			{/snippet}

			{#if data.discord?.isActive}
				<div class="toggle-list">
					<label class="toggle-row">
						<input type="checkbox" name="discordMention" checked={s.discordMention} />
						<span>Mentions</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="discordComment" checked={s.discordComment} />
						<span>Comments</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="discordSystem" checked={s.discordSystem} />
						<span>System</span>
					</label>
					<label class="toggle-row">
						<input type="checkbox" name="discordSecurity" checked={s.discordSecurity} />
						<span>Security</span>
					</label>
				</div>
			{:else}
				<div class="connect-section">
					<p class="connect-desc">Connect your Discord account to receive notifications via DM.</p>
					<a href="/api/notifications/discord/authorize" class="connect-btn">
						<Button type="button" variant="secondary">Connect Discord</Button>
					</a>
				</div>
			{/if}
		</Card>

		<!-- Digest Frequency -->
		<Card class="settings-card">
			{#snippet header()}
				<h3 class="section-title">Digest Frequency</h3>
			{/snippet}

			<div class="radio-list">
				{#each ['instant', 'daily', 'weekly', 'never'] as freq}
					<label class="toggle-row">
						<input type="radio" name="digestFrequency" value={freq} checked={s.digestFrequency === freq} />
						<span class="capitalize">{freq}</span>
					</label>
				{/each}
			</div>
		</Card>

		<!-- Quiet Hours -->
		<Card class="settings-card">
			{#snippet header()}
				<h3 class="section-title">Quiet Hours</h3>
				<p class="section-desc">Pause notifications during certain hours.</p>
			{/snippet}

			<div class="time-inputs">
				<label class="time-label">
					<span>Start</span>
					<input type="time" name="quietStart" value={s.quietStart ?? ''} />
				</label>
				<label class="time-label">
					<span>End</span>
					<input type="time" name="quietEnd" value={s.quietEnd ?? ''} />
				</label>
			</div>
		</Card>

		<div class="form-actions">
			<Button type="submit" disabled={saving}>
				{saving ? 'Saving...' : 'Save settings'}
			</Button>
		</div>
	</form>
</div>

<style>
	.settings-page {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.page-title {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		margin: 0;
	}

	.settings-page :global(.settings-card) {
		margin-bottom: var(--spacing-5);
	}

	.section-title {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.section-desc {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: var(--spacing-1) 0 0;
	}

	.channel-header {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.toggle-list,
	.radio-list {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.toggle-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	.connect-section {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.connect-desc {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		margin: 0;
	}

	.connect-hint {
		font-size: var(--text-fluid-xs);
		color: var(--color-primary);
		margin: 0;
	}

	.connect-btn {
		text-decoration: none;
		align-self: flex-start;
	}

	.time-inputs {
		display: flex;
		gap: var(--spacing-5);
	}

	.time-label {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
	}

	.time-label input {
		padding: var(--spacing-2) var(--spacing-3);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background-color: var(--color-surface-1);
		color: var(--color-fg);
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
	}

	.capitalize {
		text-transform: capitalize;
	}
</style>
