<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Button, Spinner } from '$lib/components/primitives';
import { DataField } from '$lib/components/transparency';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { type ConsentTier, getConsent } from '$lib/state/consent.svelte';

let { data } = $props();

const consent = getConsent();

// Welcome visit: data sections start collapsed behind the reveal gate.
// Returning visit: the user came here deliberately — show everything.
let revealed = $state(!data.welcome);

let heading: HTMLHeadingElement | undefined = $state();
$effect(() => {
	// SvelteKit does not move focus on navigation — land screen readers on the page heading
	heading?.focus();
});

const activeTier = $derived(consent?.tier ?? data.consentTier);
const tiers: { id: ConsentTier; label: () => string }[] = [
	{ id: 'necessary', label: () => m.app_data_tier_necessary() },
	{ id: 'analytics', label: () => m.app_data_tier_analytics() },
];

function formatDate(iso: string): string {
	return new Date(iso).toLocaleString();
}
</script>

<Stack gap="6">
	<!-- Heading + the one unambiguous exit, always visible at the top -->
	<div class="page-head">
		<div>
			<h2 class="text-fluid-lg font-semibold" tabindex="-1" bind:this={heading}>
				{data.welcome ? m.app_data_welcome_title() : m.app_data_title()}
			</h2>
			<p class="text-sm text-muted mt-1">
				{data.welcome ? m.app_data_welcome_body() : m.app_data_intro()}
			</p>
		</div>
		<Button href={localizeHref('/account/dashboard')} variant={data.welcome ? 'default' : 'outline'}>
			{m.app_data_continue()}
		</Button>
	</div>

	{#if !revealed}
		<!-- Reveal gate: the data dump is opt-in, never a forced wall -->
		<Card>
			<div class="reveal-section">
				<p class="text-sm text-muted">{m.app_data_reveal_intro()}</p>
				<Button variant="outline" size="lg" onclick={() => (revealed = true)}>
					{m.app_data_reveal_button()}
				</Button>
			</div>
		</Card>
	{:else}
		{#await data.report}
			<Card>
				<div class="loading-row">
					<Spinner size="sm" />
					<span class="text-sm text-muted">{m.app_data_loading()}</span>
				</div>
			</Card>
		{:then report}
			<!-- 1. Emptiness first: what we DON'T have reads as reassurance -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.app_data_heading_empty()}</h3>
				{/snippet}
				<p class="text-sm text-muted mb-4">{m.app_data_empty_intro()}</p>
				<div role="list">
					<DataField
						label={m.app_data_field_ai()}
						value={report.ai.data?.conversationCount ?? 0}
						collected={(report.ai.data?.conversationCount ?? 0) > 0}
						statusLabel={(report.ai.data?.conversationCount ?? 0) > 0
							? m.app_data_status_collected()
							: m.app_data_status_empty()}
						why={m.app_data_field_ai_why()}
					/>
					<DataField
						label={m.app_data_field_desk()}
						value={report.desk.data?.fileCount ?? 0}
						collected={(report.desk.data?.fileCount ?? 0) > 0}
						statusLabel={(report.desk.data?.fileCount ?? 0) > 0
							? m.app_data_status_collected()
							: m.app_data_status_empty()}
						why={m.app_data_field_desk_why()}
					/>
					<DataField
						label={m.app_data_field_comments()}
						value={report.blogComments.data?.count ?? 0}
						collected={(report.blogComments.data?.count ?? 0) > 0}
						statusLabel={(report.blogComments.data?.count ?? 0) > 0
							? m.app_data_status_collected()
							: m.app_data_status_empty()}
						why={m.app_data_field_comments_why()}
					/>
					<DataField
						label={m.app_data_field_palettes()}
						value={report.palettes.data?.count ?? 0}
						collected={(report.palettes.data?.count ?? 0) > 0}
						statusLabel={(report.palettes.data?.count ?? 0) > 0
							? m.app_data_status_collected()
							: m.app_data_status_empty()}
						why={m.app_data_field_palettes_why()}
					/>
					<DataField
						label={m.app_data_field_messaging()}
						collected={(report.notifications.data?.telegramLinked ?? false) ||
							(report.notifications.data?.discordLinked ?? false)}
						statusLabel={(report.notifications.data?.telegramLinked ?? false) ||
						(report.notifications.data?.discordLinked ?? false)
							? m.app_data_status_collected()
							: m.app_data_status_empty()}
						why={m.app_data_field_messaging_why()}
					/>
				</div>
			</Card>

			<!-- 2. What already exists: your account record -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.app_data_heading_identity()}</h3>
				{/snippet}
				{#if report.identity.available && report.identity.data}
					<div role="list">
						<DataField
							label={m.app_data_field_name()}
							value={report.identity.data.name}
							collected={true}
							statusLabel={m.app_data_status_collected()}
							why={m.app_data_identity_why()}
						/>
						<DataField
							label={m.app_data_field_email()}
							value={report.identity.data.email}
							collected={true}
							statusLabel={m.app_data_status_collected()}
							why={m.app_data_identity_why()}
						/>
						<DataField
							label={m.app_data_field_created()}
							value={formatDate(report.identity.data.createdAt)}
							collected={true}
							statusLabel={m.app_data_status_collected()}
						/>
					</div>
				{:else}
					<p class="text-sm text-muted">{m.app_data_section_unavailable()}</p>
				{/if}
			</Card>

			<!-- 3. Sign-in sessions: security framing, current full / prior masked -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.app_data_heading_sessions()}</h3>
				{/snippet}
				<p class="text-sm text-muted mb-4">{m.app_data_sessions_framing()}</p>
				{#if report.sessions.available && report.sessions.data}
					<div role="list">
						{#if report.sessions.data.current}
							<div class="session-block">
								<div class="flex items-center gap-2 mb-1">
									<Badge variant="success">{m.app_data_session_current()}</Badge>
								</div>
								<DataField
									label={m.app_data_field_ip()}
									value={report.sessions.data.current.ipAddress}
									collected={true}
									statusLabel={m.app_data_status_collected()}
									why={m.app_data_session_ip_why()}
								/>
								<DataField
									label={m.app_data_field_device()}
									value={report.sessions.data.current.userAgent}
									collected={true}
									statusLabel={m.app_data_status_collected()}
								/>
							</div>
						{/if}
						{#each report.sessions.data.prior as prior}
							<div class="session-block">
								<div class="flex items-center gap-2 mb-1">
									<Badge variant="outline">{m.app_data_session_prior()}</Badge>
									<span class="text-xs text-muted">{formatDate(prior.createdAt)}</span>
								</div>
								<DataField
									label={m.app_data_field_ip()}
									value={prior.ipAddress}
									collected={true}
									statusLabel={m.app_data_status_collected()}
									why={m.app_data_session_masked_why()}
								/>
							</div>
						{/each}
					</div>
					<p class="text-xs text-muted mt-3">{m.app_data_sessions_revoke_hint()}</p>
				{:else}
					<p class="text-sm text-muted">{m.app_data_section_unavailable()}</p>
				{/if}
			</Card>

			<!-- 4. Connected providers: scopes, token presence only -->
			<Card>
				{#snippet header()}
					<h3 class="text-fluid-base font-semibold">{m.app_data_heading_oauth()}</h3>
				{/snippet}
				{#if report.oauthAccounts.available && (report.oauthAccounts.data?.length ?? 0) > 0}
					<div role="list">
						{#each report.oauthAccounts.data ?? [] as acc}
							<DataField
								label={acc.provider}
								value={acc.scope ?? '—'}
								collected={true}
								statusLabel={m.app_data_status_collected()}
								why={m.app_data_oauth_why()}
							/>
						{/each}
					</div>
				{:else}
					<p class="text-sm text-muted">{m.app_data_oauth_none()}</p>
				{/if}
			</Card>
		{:catch}
			<Card>
				<p class="text-sm text-muted">{m.app_data_section_unavailable()}</p>
			</Card>
		{/await}

		<!-- 5. Cookies on this device + the live connection (instant, no DB) -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-base font-semibold">{m.app_data_heading_cookies()}</h3>
			{/snippet}
			<p class="text-sm text-muted mb-4">{m.app_data_cookies_note()}</p>
			<div role="list">
				{#each data.deviceCookies as cookie}
					<DataField
						label={cookie.name}
						value={cookie.value ?? m.app_data_cookie_value_hidden()}
						collected={true}
						statusLabel={m.app_data_status_collected()}
					/>
				{/each}
			</div>
		</Card>

		<Card>
			{#snippet header()}
				<h3 class="text-fluid-base font-semibold">{m.app_data_heading_live()}</h3>
			{/snippet}
			<p class="text-sm text-muted mb-4">{m.app_data_live_note()}</p>
			<div role="list">
				<DataField
					label={m.app_data_field_ip()}
					value={data.live.ip}
					collected={true}
					statusLabel={m.app_data_status_collected()}
					why={m.app_data_live_ip_why()}
				/>
				<DataField
					label={m.app_data_field_device()}
					value={data.live.userAgent}
					collected={true}
					statusLabel={m.app_data_status_collected()}
				/>
				<DataField
					label={m.app_data_field_language()}
					value={data.live.acceptLanguage}
					collected={true}
					statusLabel={m.app_data_status_collected()}
				/>
			</div>
			<p class="text-xs text-muted mt-3">{m.app_data_no_trail_note()}</p>
		</Card>

		<!-- 6. Consent: a felt action with immediate visible state -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-base font-semibold">{m.app_data_heading_consent()}</h3>
			{/snippet}
			<p class="text-sm text-muted mb-4">{m.app_data_consent_intro()}</p>
			<div class="tier-buttons" role="radiogroup" aria-label={m.app_data_heading_consent()}>
				{#each tiers as tier}
					<Button
						variant={activeTier === tier.id ? 'default' : 'outline'}
						role="radio"
						aria-checked={activeTier === tier.id}
						onclick={() => consent?.setTier(tier.id)}
					>
						{tier.label()}
					</Button>
				{/each}
			</div>
			{#if activeTier === 'necessary'}
				<p class="text-xs text-muted mt-3">{m.app_data_consent_necessary_note()}</p>
			{/if}
		</Card>

		<!-- 7. Your rights: take it or erase it -->
		<Card>
			{#snippet header()}
				<h3 class="text-fluid-base font-semibold">{m.app_data_heading_actions()}</h3>
			{/snippet}
			<p class="text-sm text-muted mb-4">{m.app_data_actions_intro()}</p>
			<div class="flex flex-wrap gap-3">
				<Button href="/api/me/data/export" variant="outline" data-sveltekit-preload-data="off">
					<span class="i-lucide-download h-4 w-4 mr-1"></span>
					{m.app_data_download()}
				</Button>
				<Button href={localizeHref('/account/settings')} variant="outline">
					{m.app_data_manage_account()}
				</Button>
			</div>
		</Card>
	{/if}
</Stack>

<style>
	.page-head {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.page-head h2:focus {
		outline: none;
	}

	.reveal-section {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--spacing-4);
	}

	.loading-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.session-block {
		padding: var(--spacing-2) 0;
	}

	.tier-buttons {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}
</style>
