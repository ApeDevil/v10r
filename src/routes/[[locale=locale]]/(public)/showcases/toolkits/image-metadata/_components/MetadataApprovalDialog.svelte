<script lang="ts">
/**
 * Whole-form ATOMIC approval gate. A bespoke dialog (not the body-less
 * ConfirmDialog composite, which cannot host a table) that shows a semantic
 * AI-proposed vs to-be-saved diff. When location is opted in, it also doubles
 * as the GPS consent gate via a clearly-marked sensitive row.
 *
 * Focus trap + Escape + scroll-lock come from bits-ui Dialog. Reduced motion is
 * honored by gating the enter/exit animation classes on the motion query.
 *
 * Not localized: every user-facing string below is a literal or a humanized
 * enum key. The whole file still needs an i18n pass — no per-string markers.
 */
import { Dialog } from 'bits-ui';
import { Button } from '$lib/components/primitives';
import { useSurface } from '$lib/styles/elevation';
import { cn } from '$lib/utils/cn';

interface DiffRow {
	field: string;
	aiProposed: string;
	saving: string;
}

interface Props {
	open: boolean;
	rows: DiffRow[];
	includeLocation: boolean;
	gps: { lat: number; lng: number } | null;
	onconfirm: () => void;
	oncancel: () => void;
}

let { open = $bindable(), rows, includeLocation, gps, onconfirm, oncancel }: Props = $props();

// Relative elevation — one rung above the plane that owns the trigger (page → E1; the scrim carries separation).
const s = useSurface();

// placeholder for an empty cell.
const EMPTY = '—';
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-overlay bg-black/50 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out"
		/>
		<Dialog.Content
			{...s.attrs}
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-[calc(100vw-2rem)] max-w-xl rounded-lg border p-6',
				'flex flex-col gap-4',
				'max-h-[calc(100dvh-2rem)] overflow-y-auto',
				'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out'
			)}
		>
			<div class="flex flex-col gap-1">
				<Dialog.Title class="text-fluid-lg font-semibold text-fg">
					Review metadata before saving
				</Dialog.Title>
				<Dialog.Description class="text-fluid-sm text-muted">
					Compare what the AI proposed against the values that will be saved. Saving applies all fields at once.
				</Dialog.Description>
			</div>

			<div class="diff-scroll">
				<table class="diff-table">
					<thead>
						<tr>
							<th scope="col">Field</th>
							<th scope="col">AI proposed</th>
							<th scope="col">Saving</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.field)}
							<tr>
								<th scope="row" class="diff-field">{row.field}</th>
								<td class="diff-ai">{row.aiProposed || EMPTY}</td>
								<td class="diff-saving">{row.saving || EMPTY}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if includeLocation && gps}
				<div class="gps-consent" role="group" aria-labelledby="gps-consent-title">
					<div class="gps-consent-head">
						<span class="i-lucide-map-pin text-icon-sm" aria-hidden="true"></span>
						<span id="gps-consent-title" class="gps-consent-title">
							Location (sensitive)
						</span>
					</div>
					<p class="gps-consent-body">
						These coordinates will be saved with the image:
						<code>{gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}</code>
					</p>
				</div>
			{/if}

			<div class="pt-2 flex justify-end gap-3">
				<Button variant="outline" onclick={oncancel}>
					Cancel
				</Button>
				<Button variant="primary" onclick={onconfirm}>
					Save metadata
				</Button>
			</div>

			<Dialog.Close
				class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100"
				onclick={oncancel}
			>
				<span class="i-lucide-x text-icon-sm" aria-hidden="true"></span>
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.diff-scroll {
		overflow-x: auto;
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.diff-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.diff-table th,
	.diff-table td {
		text-align: left;
		padding: var(--spacing-3);
		vertical-align: top;
		border-bottom: 1px solid var(--color-border);
	}

	.diff-table thead th {
		font-weight: 600;
		color: var(--color-muted);
		font-size: var(--text-fluid-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.diff-table tbody tr:last-child th,
	.diff-table tbody tr:last-child td {
		border-bottom: none;
	}

	.diff-field {
		font-weight: 500;
		color: var(--color-fg);
		white-space: nowrap;
	}

	.diff-ai {
		color: var(--color-muted);
	}

	.diff-saving {
		color: var(--color-fg);
		word-break: break-word;
	}

	.gps-consent {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border-radius: var(--radius-md);
		border: 1px solid var(--color-warning);
		background: color-mix(in srgb, var(--color-warning) 8%, transparent);
	}

	.gps-consent-head {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}

	.gps-consent-title {
		font-weight: 600;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.gps-consent-body {
		margin: 0;
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		line-height: 1.5;
	}

	.gps-consent-body code {
		font-family: ui-monospace, monospace;
		color: var(--color-fg);
	}
</style>
