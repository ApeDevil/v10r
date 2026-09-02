<script lang="ts">
import { superForm } from 'sveltekit-superforms';
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { BackLink, Card } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Switch } from '$lib/components/primitives';
import { buttonVariants } from '$lib/components/primitives/button';
import * as m from '$lib/paraglide/messages';
import { getCurrentPushSubscription, pushSupported, subscribeToPush, unsubscribeFromPush } from '$lib/pwa/push';
import { getToast } from '$lib/state';

let { data } = $props();

const toast = getToast();
let connectingTelegram = $state(false);
let telegramDeepLink = $state<string | null>(null);

// Push is per-DEVICE (unlike telegram/discord accounts): state comes from this
// browser's permission + subscription, not from the server load.
let pushStatus = $state<'checking' | 'unsupported' | 'ios-needs-install' | 'denied' | 'off' | 'on'>('checking');
let pushBusy = $state(false);

$effect(() => {
	void refreshPushStatus();
});

async function refreshPushStatus() {
	if (!pushSupported()) {
		// iOS exposes PushManager only inside the installed (home-screen) app —
		// route the user to install first instead of showing a dead toggle.
		const isIos =
			/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		const standalone =
			window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as Navigator & { standalone?: boolean }).standalone === true;
		pushStatus = isIos && !standalone ? 'ios-needs-install' : 'unsupported';
		return;
	}
	if (Notification.permission === 'denied') {
		pushStatus = 'denied';
		return;
	}
	pushStatus = (await getCurrentPushSubscription()) ? 'on' : 'off';
}

async function enablePush() {
	pushBusy = true;
	const result = await subscribeToPush();
	pushBusy = false;
	if (result === 'subscribed') {
		pushStatus = 'on';
		toast.success(m.account_notifications_push_enabled_toast());
	} else if (result === 'denied') {
		pushStatus = 'denied';
	} else {
		toast.error(m.account_notifications_push_error());
	}
}

async function disablePush() {
	pushBusy = true;
	await unsubscribeFromPush();
	pushBusy = false;
	pushStatus = 'off';
}

const { form, enhance, submitting, message } = superForm(data.form, {
	onUpdated({ form }) {
		if (form.message) toast.success(form.message);
	},
});

$effect(() => {
	if (data.successMessage === 'discord_connected') {
		toast.success(m.account_notifications_discord_connected_toast());
		goto(page.url.pathname, { replaceState: true });
	}
	if (data.errorMessage === 'discord_denied') {
		toast.error(m.account_notifications_discord_denied_toast());
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
			const { data } = await res.json();
			telegramDeepLink = data.deepLink;
			window.open(data.deepLink, '_blank');
		} else {
			const { error } = await res.json();
			toast.error(error?.message ?? m.account_notifications_telegram_link_error());
		}
	} catch {
		toast.error(m.account_notifications_telegram_connect_error());
	} finally {
		connectingTelegram = false;
	}
}
</script>

<Stack gap="5">
	<h2 class="text-fluid-lg font-semibold">{m.account_notifications_settings_heading()}</h2>

	<form method="POST" use:enhance>
		<Stack gap="5">
			<!-- Email -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.account_notifications_email_heading()}</h3>
					<p class="text-fluid-sm text-muted mt-1">{m.account_notifications_email_description()}</p>
				{/snippet}

				<Stack gap="3">
					<Switch bind:checked={$form.emailMention} label={m.account_notifications_pref_mention()} size="sm" />
					<Switch bind:checked={$form.emailComment} label={m.account_notifications_pref_comment()} size="sm" />
					<Switch bind:checked={$form.emailSystem} label={m.account_notifications_pref_system()} size="sm" />
					<Switch bind:checked={$form.emailSuccess} label={m.account_notifications_pref_success()} size="sm" />
					<Switch bind:checked={$form.emailSecurity} label={m.account_notifications_pref_security()} size="sm" />
					<Switch bind:checked={$form.emailFollow} label={m.account_notifications_pref_follow()} size="sm" />
				</Stack>
			</Card>

			<!-- Telegram -->
			<Card>
				{#snippet header()}
					<Cluster gap="3">
						<h3 class="text-fluid-base font-semibold">Telegram</h3>
						{#if data.telegram}
							<Badge variant={data.telegram.isActive ? 'success' : 'warning'}>
								{data.telegram.isActive ? m.account_notifications_badge_connected() : m.account_notifications_badge_inactive()}
							</Badge>
						{/if}
					</Cluster>
					{#if data.telegram?.telegramUsername}
						<p class="text-fluid-sm text-muted mt-1">{m.account_notifications_telegram_connected_as({ username: data.telegram.telegramUsername })}</p>
					{/if}
				{/snippet}

				{#if data.telegram?.isActive}
					<Stack gap="3">
						<Switch bind:checked={$form.telegramMention} label={m.account_notifications_pref_mention()} size="sm" />
						<Switch bind:checked={$form.telegramComment} label={m.account_notifications_pref_comment()} size="sm" />
						<Switch bind:checked={$form.telegramSystem} label={m.account_notifications_pref_system()} size="sm" />
						<Switch bind:checked={$form.telegramSecurity} label={m.account_notifications_pref_security()} size="sm" />
					</Stack>
				{:else}
					<Stack gap="3">
						<p class="text-fluid-sm text-muted">{m.account_notifications_telegram_description()}</p>
						<div>
							<Button type="button" variant="secondary" onclick={connectTelegram} disabled={connectingTelegram}>
								{connectingTelegram ? m.account_notifications_telegram_generating() : m.account_notifications_telegram_connect()}
							</Button>
						</div>
						{#if telegramDeepLink}
							<p class="text-fluid-xs text-muted">{m.account_notifications_telegram_link_opened()}</p>
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
								{data.discord.isActive ? m.account_notifications_badge_connected() : m.account_notifications_badge_inactive()}
							</Badge>
						{/if}
					</Cluster>
					{#if data.discord?.discordUsername}
						<p class="text-fluid-sm text-muted mt-1">{m.account_notifications_discord_connected_as({ username: data.discord.discordUsername })}</p>
					{/if}
				{/snippet}

				{#if data.discord?.isActive}
					<Stack gap="3">
						<Switch bind:checked={$form.discordMention} label={m.account_notifications_pref_mention()} size="sm" />
						<Switch bind:checked={$form.discordComment} label={m.account_notifications_pref_comment()} size="sm" />
						<Switch bind:checked={$form.discordSystem} label={m.account_notifications_pref_system()} size="sm" />
						<Switch bind:checked={$form.discordSecurity} label={m.account_notifications_pref_security()} size="sm" />
					</Stack>
				{:else}
					<Stack gap="3">
						<p class="text-fluid-sm text-muted">{m.account_notifications_discord_description()}</p>
						<div>
							<a href="/api/notifications/discord/authorize" class={buttonVariants({ variant: 'secondary' })}>
								{m.account_notifications_discord_connect()}
							</a>
						</div>
					</Stack>
				{/if}
			</Card>

			<!-- Push (per-device) -->
			<Card>
				{#snippet header()}
					<Cluster gap="3">
						<h3 class="text-fluid-base font-semibold">Push</h3>
						{#if pushStatus === 'on'}
							<Badge variant="success">{m.account_notifications_badge_connected()}</Badge>
						{:else if pushStatus === 'denied'}
							<Badge variant="warning">{m.account_notifications_badge_inactive()}</Badge>
						{/if}
					</Cluster>
					<p class="text-fluid-sm text-muted mt-1">{m.account_notifications_push_description()}</p>
				{/snippet}

				{#if pushStatus === 'on'}
					<Stack gap="3">
						<Switch bind:checked={$form.pushMention} label={m.account_notifications_pref_mention()} size="sm" />
						<Switch bind:checked={$form.pushComment} label={m.account_notifications_pref_comment()} size="sm" />
						<Switch bind:checked={$form.pushSystem} label={m.account_notifications_pref_system()} size="sm" />
						<Switch bind:checked={$form.pushSecurity} label={m.account_notifications_pref_security()} size="sm" />
						<div>
							<Button type="button" variant="ghost" size="sm" onclick={disablePush} disabled={pushBusy}>
								{m.account_notifications_push_disable()}
							</Button>
						</div>
					</Stack>
				{:else if pushStatus === 'off'}
					<Stack gap="3">
						<div>
							<Button type="button" variant="secondary" onclick={enablePush} disabled={pushBusy}>
								{pushBusy ? m.account_notifications_push_enabling() : m.account_notifications_push_enable()}
							</Button>
						</div>
					</Stack>
				{:else if pushStatus === 'ios-needs-install'}
					<p class="text-fluid-sm text-muted">{m.account_notifications_push_ios_install()}</p>
				{:else if pushStatus === 'denied'}
					<p class="text-fluid-sm text-muted">{m.account_notifications_push_denied()}</p>
				{:else if pushStatus === 'unsupported'}
					<p class="text-fluid-sm text-muted">{m.account_notifications_push_unsupported()}</p>
				{/if}
			</Card>

			<!-- Digest Frequency -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.account_notifications_digest_heading()}</h3>
				{/snippet}

				<Stack gap="3">
					{#each [
						{ value: 'instant', label: m.account_notifications_digest_instant() },
						{ value: 'daily', label: m.account_notifications_digest_daily() },
						{ value: 'weekly', label: m.account_notifications_digest_weekly() },
						{ value: 'never', label: m.account_notifications_digest_never() },
					] as { value, label }}
						<label class="radio-row">
							<input
								type="radio"
								value={value}
								checked={$form.digestFrequency === value}
								onchange={() => $form.digestFrequency = value as typeof $form.digestFrequency}
							/>
							<span>{label}</span>
						</label>
					{/each}
				</Stack>
			</Card>

			<!-- Quiet Hours -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.account_notifications_quiet_hours_heading()}</h3>
					<p class="text-fluid-sm text-muted mt-1">{m.account_notifications_quiet_hours_description()}</p>
				{/snippet}

				<Cluster gap="5">
					<label class="time-field">
						<span class="text-fluid-sm">{m.account_notifications_quiet_start()}</span>
						<Input type="time" name="quietStart" bind:value={$form.quietStart} />
					</label>
					<label class="time-field">
						<span class="text-fluid-sm">{m.account_notifications_quiet_end()}</span>
						<Input type="time" name="quietEnd" bind:value={$form.quietEnd} />
					</label>
				</Cluster>
			</Card>

			<Cluster justify="end">
				<Button type="submit" disabled={$submitting}>
					{$submitting ? m.account_notifications_save_saving() : m.account_notifications_save()}
				</Button>
			</Cluster>
		</Stack>
	</form>

	<BackLink href="/account/notifications" label="notifications" />
</Stack>

<style>
	.radio-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
	}

	.time-field {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}
</style>
