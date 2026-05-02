<script lang="ts">
import { onDestroy } from 'svelte';
import { Button, Dialog } from '$lib/components/primitives';

function formatCodeForDisplay(code: string): string {
	return `${code.slice(0, 3)} ${code.slice(3)}`;
}

interface Props {
	open: boolean;
	pairedActive: boolean;
}

let { open = $bindable(false), pairedActive = $bindable(false) }: Props = $props();

interface PairingResponse {
	code: string;
	expiresAt: string;
	pairUrl: string;
	qrSvg: string;
}

let creating = $state(false);
let pairing = $state<PairingResponse | null>(null);
let errorMsg = $state('');
let now = $state(Date.now());
let tickInterval: ReturnType<typeof setInterval> | null = null;

const remainingMs = $derived(pairing ? new Date(pairing.expiresAt).getTime() - now : 0);
const expired = $derived(pairing != null && remainingMs <= 0);
const showCountdown = $derived(remainingMs > 0 && remainingMs < 3 * 60 * 1000);

const countdownText = $derived.by(() => {
	if (!pairing || remainingMs <= 0) return '';
	const m = Math.floor(remainingMs / 60_000);
	const s = Math.floor((remainingMs % 60_000) / 1000);
	return `${m}:${s.toString().padStart(2, '0')}`;
});

$effect(() => {
	if (pairing && !expired) {
		if (!tickInterval) {
			tickInterval = setInterval(() => {
				now = Date.now();
			}, 1000);
		}
	} else if (tickInterval) {
		clearInterval(tickInterval);
		tickInterval = null;
	}
});

onDestroy(() => {
	if (tickInterval) clearInterval(tickInterval);
});

async function generate() {
	creating = true;
	errorMsg = '';
	try {
		const res = await fetch('/api/admin/analytics/pair', {
			method: 'POST',
			headers: { 'X-Requested-With': 'fetch', 'Content-Type': 'application/json' },
			body: '{}',
		});
		if (!res.ok) {
			const json = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
			throw new Error(json.error?.message ?? `HTTP ${res.status}`);
		}
		const json = (await res.json()) as { data: PairingResponse };
		pairing = json.data;
		now = Date.now();
	} catch (err) {
		errorMsg = err instanceof Error ? err.message : 'Failed to generate code';
	} finally {
		creating = false;
	}
}

async function revoke() {
	if (!pairing) return;
	try {
		await fetch(`/api/admin/analytics/pair/${pairing.code}`, {
			method: 'DELETE',
			headers: { 'X-Requested-With': 'fetch' },
		});
	} catch {
		// best effort
	}
	pairing = null;
	pairedActive = false;
}

function close() {
	open = false;
}
</script>

<Dialog bind:open title="Pair a device" description="Scan the QR code on your phone, or enter the code manually.">
	<div class="content">
		{#if errorMsg}
			<p class="error" role="alert">{errorMsg}</p>
		{/if}

		{#if !pairing}
			{#if pairedActive}
				<p class="info">A device is already paired with your dashboard.</p>
				<div class="actions">
					<Button variant="outline" onclick={close}>Close</Button>
					<Button onclick={generate} disabled={creating}>
						{creating ? 'Generating…' : 'Generate new code'}
					</Button>
				</div>
			{:else}
				<p class="info">Generate a one-time code, then scan or enter it on the phone you want to track.</p>
				<div class="actions">
					<Button variant="outline" onclick={close}>Cancel</Button>
					<Button onclick={generate} disabled={creating}>
						{creating ? 'Generating…' : 'Generate code'}
					</Button>
				</div>
			{/if}
		{:else if expired}
			<div class="expired">
				<span class="i-lucide-clock-alert expired-icon" aria-hidden="true"></span>
				<p>Code expired</p>
				<Button onclick={generate} disabled={creating}>
					{creating ? 'Generating…' : 'Generate new code'}
				</Button>
			</div>
		{:else}
			<div class="qr-wrap">
				<!-- biome-ignore lint/security/noDangerouslySetInnerHtml: server-generated SVG, trusted source -->
				<div class="qr">{@html pairing.qrSvg}</div>
			</div>

			<div class="code-block">
				<output aria-label="Pairing code" class="code">{formatCodeForDisplay(pairing.code)}</output>
				{#if showCountdown}
					<p class="countdown" aria-live="polite">Expires in {countdownText}</p>
				{/if}
			</div>

			<p class="hint">Or open this link on the phone:<br /><code class="url">{pairing.pairUrl}</code></p>

			<div class="actions">
				<Button variant="outline" onclick={revoke}>Revoke</Button>
				<Button onclick={close}>Done</Button>
			</div>
		{/if}
	</div>
</Dialog>

<style>
	.content {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.error {
		margin: 0;
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-sm);
		background: color-mix(in srgb, var(--color-error) 10%, transparent);
		color: var(--color-error);
		font-size: var(--text-fluid-sm);
	}
	.info {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}
	.actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-2);
		padding-top: var(--spacing-2);
	}
	.expired {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		text-align: center;
	}
	.expired-icon {
		font-size: 2rem;
		color: var(--color-muted);
	}
	.qr-wrap {
		display: flex;
		justify-content: center;
		padding: var(--spacing-3);
		background: white;
		border-radius: var(--radius-md);
	}
	.qr :global(svg) {
		width: 200px;
		height: 200px;
		display: block;
	}
	.code-block {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-1);
	}
	.code {
		font-family: ui-monospace, monospace;
		font-size: 2rem;
		font-weight: 600;
		letter-spacing: 0.15em;
		color: var(--color-fg);
	}
	.countdown {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		font-variant-numeric: tabular-nums;
	}
	.hint {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
		text-align: center;
		line-height: 1.5;
	}
	.url {
		display: inline-block;
		padding: var(--spacing-1) var(--spacing-2);
		margin-top: var(--spacing-1);
		border-radius: var(--radius-sm);
		background: var(--color-surface-1);
		font-family: ui-monospace, monospace;
		font-size: var(--text-fluid-xs);
		color: var(--color-fg);
		word-break: break-all;
	}
</style>
