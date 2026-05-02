<script lang="ts">
import { invalidateAll } from '$app/navigation';

let dismissed = $state(false);
let busy = $state(false);
let error = $state(false);

async function disconnect() {
	if (busy) return;
	busy = true;
	error = false;
	try {
		const res = await fetch('/api/pair/disconnect', {
			method: 'POST',
			headers: { 'X-Requested-With': 'fetch' },
		});
		if (!res.ok) throw new Error(String(res.status));
		dismissed = true;
		await invalidateAll();
	} catch {
		error = true;
	} finally {
		busy = false;
	}
}
</script>

{#if !dismissed}
	<aside class="strip" role="status" aria-label="Debug pairing active">
		<span class="i-lucide-link icon" aria-hidden="true"></span>
		<p class="copy">
			{#if error}
				Couldn't disconnect — <button type="button" onclick={disconnect}>Try again</button>
			{:else}
				You're paired with your admin dashboard. Everything you do here is visible there.
				<button type="button" onclick={disconnect} disabled={busy}>
					{busy ? 'Disconnecting…' : 'Disconnect'}
				</button>
			{/if}
		</p>
	</aside>
{/if}

<style>
	.strip {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 100;
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		background: var(--color-surface-3);
		border-top: 1px solid var(--color-border);
		box-shadow: 0 -4px 12px color-mix(in srgb, var(--color-fg) 8%, transparent);
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}
	.icon {
		font-size: 1.125rem;
		color: var(--color-primary);
		flex-shrink: 0;
	}
	.copy {
		margin: 0;
		flex: 1;
		line-height: 1.4;
	}
	button {
		background: none;
		border: none;
		padding: 0;
		margin-left: var(--spacing-2);
		color: var(--color-error);
		font: inherit;
		text-decoration: underline;
		cursor: pointer;
	}
	button:hover:not(:disabled) {
		color: var(--color-error);
		opacity: 0.85;
	}
	button:disabled {
		cursor: wait;
		opacity: 0.6;
	}
</style>
