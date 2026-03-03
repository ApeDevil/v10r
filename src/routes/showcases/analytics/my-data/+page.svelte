<script lang="ts">
	import { Button } from '$lib/components/primitives/button';
	import { getToast } from '$lib/state/toast.svelte';
	import { getConsent } from '$lib/state/consent.svelte';

	let { data } = $props();

	const toast = getToast();
	const consent = getConsent();

	let revealed = $state(false);

	function handleExport() {
		toast.info('In production, this would export all data associated with your visitor ID as a JSON download (GDPR Art 20).');
	}

	function handleDelete() {
		toast.warning('In production, this would delete all events and sessions linked to your visitor ID (GDPR Art 17).');
	}

	const activeTier = $derived(consent.tier ?? data.consentTier);
</script>

<div class="my-data-layout">
	<!-- Reveal button -->
	{#if !revealed}
		<div class="reveal-section">
			<p class="reveal-intro">
				See exactly what the analytics system can detect about your current visit — grouped by consent tier.
			</p>
			<Button variant="outline" size="lg" onclick={() => (revealed = true)}>
				Show My Data
			</Button>
		</div>
	{:else}
		<!-- Tier cards -->
		<div class="tier-grid">
			<!-- Necessary tier -->
			<div class="tier-card" class:active={activeTier === 'necessary'}>
				<div class="tier-header">
					<h3>Necessary</h3>
					<span class="tier-badge always">Always active</span>
				</div>
				<ul class="data-list">
					<li class="data-item collected">
						<span class="i-lucide-check text-icon-xs" aria-hidden="true"></span>
						<div>
							<strong>Visitor ID (hashed)</strong>
							<code>{data.necessary.visitorId}</code>
						</div>
					</li>
					<li class="data-item collected">
						<span class="i-lucide-check text-icon-xs" aria-hidden="true"></span>
						<div>
							<strong>Page visited</strong>
							<code>{data.necessary.path}</code>
						</div>
					</li>
					<li class="data-item collected">
						<span class="i-lucide-check text-icon-xs" aria-hidden="true"></span>
						<div>
							<strong>Session cookie</strong>
							<code>{data.necessary.sessionCookie}</code>
						</div>
					</li>
				</ul>
			</div>

			<!-- Analytics tier -->
			<div class="tier-card" class:active={activeTier === 'analytics' || activeTier === 'full'}>
				<div class="tier-header">
					<h3>Analytics</h3>
					<span class="tier-badge opt-in">Off by default</span>
				</div>
				<ul class="data-list">
					<li class="data-item" class:collected={activeTier === 'analytics' || activeTier === 'full'}>
						<span class={activeTier === 'analytics' || activeTier === 'full' ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'} aria-hidden="true"></span>
						<div>
							<strong>Referrer</strong>
							<code>{data.analytics.referrer ?? 'none'}</code>
						</div>
					</li>
					<li class="data-item" class:collected={activeTier === 'analytics' || activeTier === 'full'}>
						<span class={activeTier === 'analytics' || activeTier === 'full' ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'} aria-hidden="true"></span>
						<div>
							<strong>Language</strong>
							<code>{data.analytics.acceptLanguage || 'not sent'}</code>
						</div>
					</li>
					<li class="data-item" class:collected={activeTier === 'analytics' || activeTier === 'full'}>
						<span class={activeTier === 'analytics' || activeTier === 'full' ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'} aria-hidden="true"></span>
						<div>
							<strong>User-Agent</strong>
							<code class="ua-code">{data.analytics.userAgent || 'not sent'}</code>
						</div>
					</li>
				</ul>
			</div>

			<!-- Full tier -->
			<div class="tier-card" class:active={activeTier === 'full'}>
				<div class="tier-header">
					<h3>Full</h3>
					<span class="tier-badge opt-in">Off by default</span>
				</div>
				<ul class="data-list">
					<li class="data-item" class:collected={activeTier === 'full'}>
						<span class={activeTier === 'full' ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'} aria-hidden="true"></span>
						<div>
							<strong>Custom events</strong>
							<span class="text-muted">Button clicks, scroll depth, timing</span>
						</div>
					</li>
					<li class="data-item" class:collected={activeTier === 'full'}>
						<span class={activeTier === 'full' ? 'i-lucide-check text-icon-xs' : 'i-lucide-minus text-icon-xs'} aria-hidden="true"></span>
						<div>
							<strong>Behavioral tracking</strong>
							<span class="text-muted">Session replays, heatmaps</span>
						</div>
					</li>
				</ul>
				<p class="tier-note">{data.full.rawIpNote}</p>
			</div>
		</div>

		<!-- Hashing demo -->
		<div class="hash-demo">
			<h3>Hashing Demo</h3>
			<p class="hash-description">Your IP and User-Agent are hashed into an irreversible visitor ID — the raw values are never stored.</p>
			<div class="hash-flow">
				<div class="hash-input">
					<span class="hash-label">Input</span>
					<code>{data.hashing.maskedIp} : {data.hashing.uaTruncated}</code>
				</div>
				<span class="i-lucide-arrow-right hash-arrow" aria-hidden="true"></span>
				<div class="hash-output">
					<span class="hash-label">SHA-256 (truncated)</span>
					<code class="hash-result">{data.hashing.resultHash}</code>
				</div>
			</div>
		</div>

		<!-- Banner preview -->
		<div class="banner-preview">
			<h3>Cookie Banner</h3>
			<p class="banner-preview-desc">
				Current consent: <strong>{activeTier ?? 'none'}</strong>
			</p>
			<div class="banner-preview-actions">
				<Button variant="outline" size="md" onclick={() => consent.reopenBanner()}>
					<span class="i-lucide-eye text-icon-xs mr-2" aria-hidden="true"></span>
					Open Banner
				</Button>
				<Button variant="outline" size="md" onclick={() => consent.resetTier()}>
					<span class="i-lucide-rotate-ccw text-icon-xs mr-2" aria-hidden="true"></span>
					Reset Consent
				</Button>
			</div>
		</div>

		<!-- Demo action buttons -->
		<div class="demo-actions">
			<Button variant="outline" size="md" onclick={handleExport}>
				<span class="i-lucide-download text-icon-xs mr-2" aria-hidden="true"></span>
				Export my data
			</Button>
			<Button variant="destructive" size="md" onclick={handleDelete}>
				<span class="i-lucide-trash-2 text-icon-xs mr-2" aria-hidden="true"></span>
				Delete my data
			</Button>
		</div>
	{/if}
</div>

<style>
	.my-data-layout {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.reveal-section {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-5);
		padding: var(--spacing-8) var(--spacing-6);
		text-align: center;
	}

	.reveal-intro {
		margin: 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		max-width: 36rem;
	}

	/* Tier grid */
	.tier-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: var(--spacing-4);
	}

	@media (max-width: 768px) {
		.tier-grid {
			grid-template-columns: 1fr;
		}
	}

	.tier-card {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-5);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.tier-card.active {
		border-width: 2px;
		border-color: var(--color-primary);
	}

	.tier-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}

	.tier-header h3 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.tier-badge {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-full);
	}

	.tier-badge.always {
		background: color-mix(in srgb, var(--color-success) 15%, transparent);
		color: var(--color-success);
	}

	.tier-badge.opt-in {
		background: var(--color-subtle);
		color: var(--color-muted);
	}

	/* Data list */
	.data-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.data-item {
		display: flex;
		align-items: flex-start;
		gap: var(--spacing-2);
		color: var(--color-muted);
	}

	.data-item.collected {
		color: var(--color-success);
	}

	.data-item div {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		min-width: 0;
	}

	.data-item strong {
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.data-item code {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		word-break: break-all;
	}

	.ua-code {
		max-width: 100%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tier-note {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-style: italic;
	}

	/* Hash demo */
	.hash-demo {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-5) var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.hash-demo h3 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.hash-description {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.hash-flow {
		display: flex;
		align-items: center;
		gap: var(--spacing-4);
		flex-wrap: wrap;
	}

	.hash-input,
	.hash-output {
		flex: 1;
		min-width: 200px;
		padding: var(--spacing-3) var(--spacing-4);
		border-radius: var(--radius-md);
		background: var(--color-subtle);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.hash-label {
		font-size: var(--text-fluid-xs);
		font-weight: 500;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.hash-input code,
	.hash-output code {
		font-size: var(--text-fluid-sm);
		word-break: break-all;
	}

	.hash-result {
		color: var(--color-primary);
		font-weight: 600;
	}

	.hash-arrow {
		font-size: 1.25rem;
		color: var(--color-muted);
		flex-shrink: 0;
	}

	/* Banner preview */
	.banner-preview {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-lg);
		padding: var(--spacing-5) var(--spacing-6);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.banner-preview h3 {
		margin: 0;
		font-size: var(--text-fluid-base);
		font-weight: 600;
	}

	.banner-preview-desc {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
	}

	.banner-preview-actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	/* Demo actions */
	.demo-actions {
		display: flex;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	/* text-muted utility for inline spans */
	.text-muted {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
</style>
