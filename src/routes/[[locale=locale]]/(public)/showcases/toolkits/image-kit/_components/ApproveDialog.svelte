<script lang="ts">
/**
 * Honest, non-destructive terminal. NOTHING is saved — so instead of a fake
 * "Saved!" this shows exactly what a real app WOULD persist, and offers real,
 * client-side actions: download the crops, copy the metadata JSON. Closing it
 * discards the temporary upload. Focus trap + Escape come from bits-ui Dialog.
 */
import { Dialog } from 'bits-ui';
import { Alert } from '$lib/components/composites';
import { Button, Spinner } from '$lib/components/primitives';
import { CROP_RATIOS, type CropRatio, type EmbedOk, type VisionFields } from '$lib/schemas/showcase/image-kit';
import { cn } from '$lib/utils/cn';

interface CropRect {
	left: number;
	top: number;
	width: number;
	height: number;
}

interface Props {
	open: boolean;
	fields: VisionFields;
	cropRects: Partial<Record<CropRatio, CropRect>>;
	embed: EmbedOk | null;
	ondownload: () => Promise<void>;
	oncopy: () => Promise<void>;
	/** "Done" — finish the session (page discards the upload + resets). */
	ondone: () => void;
}

let { open = $bindable(), fields, cropRects = {}, embed, ondownload, oncopy, ondone }: Props = $props();

const EMPTY = '—';
let downloading = $state(false);
let copied = $state(false);

async function handleDownload() {
	downloading = true;
	try {
		await ondownload();
	} finally {
		downloading = false;
	}
}

async function handleCopy() {
	await oncopy();
	copied = true;
	setTimeout(() => {
		copied = false;
	}, 2000);
}
</script>

<Dialog.Root bind:open>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-overlay bg-black/50 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out"
		/>
		<Dialog.Content
			data-elevation="3"
			class={cn(
				'fixed left-1/2 top-1/2 z-modal -translate-x-1/2 -translate-y-1/2',
				'w-[calc(100vw-2rem)] max-w-xl rounded-lg border p-6',
				'flex flex-col gap-4 max-h-[calc(100dvh-2rem)] overflow-y-auto',
				'motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out'
			)}
		>
			<div class="flex flex-col gap-1">
				<Dialog.Title class="text-fluid-lg font-semibold text-fg">
					<!-- TODO(i18n) -->
					Review — nothing is saved
				</Dialog.Title>
				<Dialog.Description class="text-fluid-sm text-muted">
					<!-- TODO(i18n) -->
					This is a showcase. Below is exactly what a real app would persist; you can download the crops or copy the
					metadata, but nothing is written anywhere.
				</Dialog.Description>
			</div>

			<!-- TODO(i18n) -->
			<Alert
				variant="info"
				description="Closing this discards the temporary uploaded image."
			/>

			<div class="summary">
				<h3 class="summary-h text-fluid-sm font-semibold">
					<!-- TODO(i18n) -->
					Metadata
				</h3>
				<table class="summary-table">
					<tbody>
						<tr><th scope="row">Title</th><td>{fields.title || EMPTY}</td></tr>
						<tr><th scope="row">Caption</th><td>{fields.caption || EMPTY}</td></tr>
						<tr><th scope="row">Alt text</th><td>{fields.altText || EMPTY}</td></tr>
						<tr><th scope="row">Keywords</th><td>{fields.keywords.length ? fields.keywords.join(', ') : EMPTY}</td></tr>
						<tr><th scope="row">Category</th><td>{fields.category || EMPTY}</td></tr>
					</tbody>
				</table>

				<h3 class="summary-h text-fluid-sm font-semibold">
					<!-- TODO(i18n) -->
					Crops <span class="text-muted font-normal">(size &amp; position, source px)</span>
				</h3>
				<table class="summary-table">
					<tbody>
						{#each CROP_RATIOS as ratio (ratio)}
							{@const r = cropRects[ratio]}
							<tr>
								<th scope="row">{ratio}</th>
								<td>
									{#if r}
										{r.width} × {r.height} px
										<span class="crop-origin text-muted">
											<!-- TODO(i18n) -->
											· at ({r.left}, {r.top})
										</span>
									{:else}
										{EMPTY}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<h3 class="summary-h text-fluid-sm font-semibold">
					<!-- TODO(i18n) -->
					Embedding
				</h3>
				<table class="summary-table">
					<tbody>
						{#if embed}
							<tr><th scope="row">Model</th><td><code>{embed.model}</code></td></tr>
							<tr><th scope="row">Dimensions</th><td>{embed.dimensions} ({embed.modality})</td></tr>
						{:else}
							<tr><td colspan="2" class="text-muted">Not generated</td></tr>
						{/if}
					</tbody>
				</table>
			</div>

			<div class="actions">
				<Button type="button" variant="outline" onclick={handleDownload} disabled={downloading}>
					{#if downloading}<Spinner size="sm" class="mr-2" />{/if}
					<span class="i-lucide-download text-icon-sm mr-1" aria-hidden="true"></span>
					<!-- TODO(i18n) -->
					Download crops
				</Button>
				<Button type="button" variant="outline" onclick={handleCopy}>
					<span class={cn('text-icon-sm mr-1', copied ? 'i-lucide-check' : 'i-lucide-clipboard')} aria-hidden="true"></span>
					<!-- TODO(i18n) -->
					{copied ? 'Copied' : 'Copy metadata JSON'}
				</Button>
				<Button type="button" variant="primary" onclick={ondone}>
					<!-- TODO(i18n) -->
					Done
				</Button>
			</div>

			<Dialog.Close class="absolute right-4 top-4 rounded-sm opacity-70 hover:opacity-100" onclick={() => (open = false)}>
				<span class="i-lucide-x text-icon-sm" aria-hidden="true"></span>
				<!-- TODO(i18n) -->
				<span class="sr-only">Close</span>
			</Dialog.Close>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<style>
	.summary {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
	}

	.summary-h {
		margin-top: var(--spacing-2);
	}
	.summary-h:first-child {
		margin-top: 0;
	}

	.summary-table {
		width: 100%;
		border-collapse: collapse;
		font-size: var(--text-fluid-sm);
	}

	.summary-table th,
	.summary-table td {
		text-align: left;
		padding: var(--spacing-1) var(--spacing-2);
		vertical-align: top;
	}

	.summary-table th {
		font-weight: 500;
		color: var(--color-muted);
		white-space: nowrap;
		width: 8rem;
	}

	.summary-table td {
		color: var(--color-fg);
		word-break: break-word;
	}

	.summary-table code {
		font-family: ui-monospace, monospace;
	}

	.crop-origin {
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}

	.actions {
		display: flex;
		flex-wrap: wrap;
		justify-content: flex-end;
		gap: var(--spacing-3);
		padding-top: var(--spacing-2);
	}
</style>
