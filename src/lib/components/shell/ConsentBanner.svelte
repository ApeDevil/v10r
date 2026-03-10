<script lang="ts">
import { browser } from '$app/environment';
import { Button } from '$lib/components/primitives/button';
import { Switch } from '$lib/components/primitives/switch';
import { type ConsentTier, getConsent } from '$lib/state/consent.svelte';

const consent = getConsent();

let showCustomize = $state(false);
let analyticsOn = $state(false);
let fullOn = $state(false);

function accept(tier: ConsentTier) {
	consent.setTier(tier);
	consent.closeBanner();
	showCustomize = false;
	persistToServer(tier);
}

function saveCustom() {
	const tier: ConsentTier = fullOn ? 'full' : analyticsOn ? 'analytics' : 'necessary';
	accept(tier);
}

/** Fire-and-forget POST to record consent event server-side */
function persistToServer(tier: ConsentTier) {
	const body = new FormData();
	body.set('tier', tier);
	fetch('/api/consent?/set', { method: 'POST', body }).catch(() => {
		// Best-effort audit trail — don't block the user
	});
}

const visible = $derived(browser && (consent.needsBanner || consent.bannerOpen));
</script>

{#if visible}
	<div
		class="consent-banner"
		role="dialog"
		aria-label="Cookie preferences"
		aria-modal="false"
	>
		<div class="consent-inner">
			<div class="consent-body">
				<p class="consent-text">
					This site uses cookies to measure performance. Necessary cookies are always active.
				</p>

				<div class="consent-actions">
					<Button variant="outline" size="md" onclick={() => accept('necessary')}>
						Necessary Only
					</Button>
					<Button variant="outline" size="md" onclick={() => accept('analytics')}>
						Analytics Only
					</Button>
					<Button variant="outline" size="md" onclick={() => accept('full')}>
						Accept All
					</Button>
					<button
						class="customize-toggle"
						onclick={() => (showCustomize = !showCustomize)}
					>
						{showCustomize ? 'Hide options' : 'Customize'}
					</button>
				</div>
			</div>

			{#if showCustomize}
				<div class="customize-panel">
					<div class="customize-row">
						<Switch disabled checked={true} label="Necessary" size="sm" />
						<span class="customize-desc">Session management — always active</span>
					</div>
					<div class="customize-row">
						<Switch bind:checked={analyticsOn} label="Analytics" size="sm" />
						<span class="customize-desc">Page views, device type, country</span>
					</div>
					<div class="customize-row">
						<Switch bind:checked={fullOn} label="Full" size="sm" />
						<span class="customize-desc">Behavioral tracking, custom events</span>
					</div>
					<Button variant="outline" size="sm" onclick={saveCustom}>
						Save preferences
					</Button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.consent-banner {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: var(--z-toast);
		background: var(--color-bg-alpha);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border-top: 1px solid var(--color-border);
		animation: consent-slide-in var(--duration-normal) var(--ease-out) both;
	}

	@keyframes consent-slide-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.consent-inner {
		max-width: 80rem;
		margin: 0 auto;
		padding: var(--spacing-4) var(--spacing-6);
	}

	.consent-body {
		display: flex;
		align-items: center;
		gap: var(--spacing-5);
		flex-wrap: wrap;
	}

	.consent-text {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
		flex: 1;
		min-width: 200px;
	}

	.consent-actions {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		flex-wrap: wrap;
	}

	.customize-toggle {
		background: none;
		border: none;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		cursor: pointer;
		padding: var(--spacing-2) var(--spacing-3);
	}

	.customize-toggle:hover {
		color: var(--color-fg);
	}

	.customize-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-4);
		border-top: 1px solid var(--color-border);
	}

	.customize-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.customize-desc {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	@media (max-width: 640px) {
		.consent-body {
			flex-direction: column;
			align-items: stretch;
		}

		.consent-actions {
			flex-direction: column;
		}

		.consent-actions :global(button) {
			width: 100%;
		}
	}
</style>
