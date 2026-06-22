<script lang="ts">
import { enhance } from '$app/forms';
import { Alert, Card, FormField, NavSection, TagInput } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import { Badge, Button, Input, Select, Spinner, Textarea } from '$lib/components/primitives';
import {
	type AnalyzeUsage,
	type ConfidenceTier,
	type CostEstimate,
	CROP_RATIOS,
	type CropDerivativeResponse,
	type CropFrame,
	type CropRatio,
	type EmbedOk,
	type EmbedResponse,
	IMAGE_CATEGORIES,
	type ImageCategory,
	type MetadataFieldKey,
	type PreRunEstimate,
	type VisionResponse,
} from '$lib/schemas/showcase/image-kit';
import ApproveDialog from './_components/ApproveDialog.svelte';
import CropStudio from './_components/CropStudio.svelte';
import EmbedViz from './_components/EmbedViz.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

interface CropRect {
	left: number;
	top: number;
	width: number;
	height: number;
}
interface EditFields {
	title: string;
	caption: string;
	altText: string;
	keywords: string[];
	category: string;
}

// ─── Upload state ────────────────────────────────────────────────────
let imageId = $state('');
let previewUrl = $state('');
let imageDims = $state<{ width: number; height: number }>({ width: 0, height: 0 });
let estimate = $state<PreRunEstimate | null>(null);
let uploading = $state(false);
let uploadError = $state('');

// ─── Run state ───────────────────────────────────────────────────────
type ToolState = 'idle' | 'running' | 'done' | 'error';
let visionState = $state<ToolState>('idle');
let visionError = $state('');
let embedState = $state<ToolState>('idle');
let embedError = $state('');
let liveStatus = $state('');

// ─── Results ─────────────────────────────────────────────────────────
let fields = $state<EditFields>({ title: '', caption: '', altText: '', keywords: [], category: '' });
let confidence = $state<Partial<Record<MetadataFieldKey, ConfidenceTier>>>({});
let touched = $state<Record<MetadataFieldKey, boolean>>({
	title: false,
	caption: false,
	altText: false,
	keywords: false,
	category: false,
});
let crops = $state<CropFrame[]>([]);
let cropNote = $state<string | null>(null);
let currentRects = $state<Partial<Record<CropRatio, CropRect>>>({});
let embed = $state<EmbedOk | null>(null);
let multimodal = $state(false);
let usage = $state<AnalyzeUsage | null>(null);
let cost = $state<CostEstimate | null>(null);

let showApprove = $state(false);

const hasImage = $derived(!!imageId);
const canRun = $derived(data.aiAvailable && hasImage && visionState !== 'running' && embedState !== 'running');
const hasResults = $derived(visionState === 'done' || visionState === 'error');

const sections = [
	{ id: 'kit-metadata', label: 'Metadata' },
	{ id: 'kit-crop', label: 'Crop' },
	{ id: 'kit-embed', label: 'Embed' },
];

const categoryOptions = IMAGE_CATEGORIES.map((c) => ({ value: c, label: c.charAt(0).toUpperCase() + c.slice(1) }));

// ─── Formatting ──────────────────────────────────────────────────────
const tokenFmt = new Intl.NumberFormat('en-US');
function fmtPer1000(n: number): string {
	return `≈ ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 0.01 ? 4 : 2 }).format(n)}`;
}

function tierVariant(tier: ConfidenceTier): 'success' | 'warning' | 'secondary' {
	return tier === 'high' ? 'success' : tier === 'medium' ? 'warning' : 'secondary';
}

function markEdited(field: MetadataFieldKey) {
	touched[field] = true;
}

function endpoint(name: string): string {
	return `${location.pathname.replace(/\/$/, '')}/${name}`;
}

function resetResults() {
	visionState = 'idle';
	visionError = '';
	embedState = 'idle';
	embedError = '';
	fields = { title: '', caption: '', altText: '', keywords: [], category: '' };
	confidence = {};
	touched = { title: false, caption: false, altText: false, keywords: false, category: false };
	crops = [];
	cropNote = null;
	currentRects = {};
	embed = null;
	usage = null;
	cost = null;
}

// ─── Run pipeline ────────────────────────────────────────────────────
async function runKit() {
	if (!canRun) return;
	await runVision();
	if (visionState === 'done') await runEmbed();
}

async function runVision() {
	visionState = 'running';
	visionError = '';
	embed = null;
	embedState = 'idle';
	// TODO(i18n)
	liveStatus = 'Analyzing image…';
	try {
		const res = await fetch(endpoint('vision'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ imageId }),
		});
		const body = (await res.json()) as VisionResponse;
		if (body.ok) {
			fields = {
				title: body.fields.title ?? '',
				caption: body.fields.caption ?? '',
				altText: body.fields.altText ?? '',
				keywords: body.fields.keywords,
				category: body.fields.category ?? '',
			};
			confidence = body.confidence;
			touched = { title: false, caption: false, altText: false, keywords: false, category: false };
			crops = body.crops;
			cropNote = body.cropNote;
			usage = body.usage;
			cost = body.cost;
			visionState = 'done';
			// TODO(i18n)
			liveStatus = 'Analysis complete. Review the results below.';
		} else {
			visionState = 'error';
			visionError = body.message;
			// TODO(i18n)
			liveStatus = 'Analysis failed.';
		}
	} catch {
		visionState = 'error';
		// TODO(i18n)
		visionError = 'Could not reach the analysis service.';
		liveStatus = visionError;
	}
}

function embedSource(): string {
	return fields.caption || fields.altText || fields.title || fields.keywords.join(', ');
}

async function runEmbed() {
	embedState = 'running';
	embedError = '';
	try {
		const res = await fetch(endpoint('embed'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ imageId, source: embedSource(), includeVector: true, multimodal }),
		});
		const body = (await res.json()) as EmbedResponse;
		if (body.ok) {
			embed = body;
			embedState = 'done';
		} else {
			embedState = 'error';
			embedError = body.message;
		}
	} catch {
		embedState = 'error';
		// TODO(i18n)
		embedError = 'Could not reach the embedding service.';
	}
}

// ─── Approve terminal actions ────────────────────────────────────────
async function downloadCrops() {
	for (const ratio of CROP_RATIOS) {
		const rect = currentRects[ratio];
		if (!rect) continue;
		try {
			const res = await fetch(endpoint('crop'), {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ imageId, ratio, rect }),
			});
			const body = (await res.json()) as CropDerivativeResponse;
			if (body.ok) {
				const a = document.createElement('a');
				a.href = body.aiCrop;
				a.download = `crop-${ratio.replace(':', 'x')}.webp`;
				document.body.appendChild(a);
				a.click();
				a.remove();
			}
		} catch {
			// best-effort
		}
	}
}

async function copyJson() {
	const payload = {
		metadata: { ...fields, category: fields.category || null },
		crops: currentRects,
		embedding: embed
			? {
					model: embed.model,
					dimensions: embed.dimensions,
					modality: embed.modality,
					l2Norm: embed.l2Norm,
					neighbors: embed.neighbors,
				}
			: null,
	};
	await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
}

async function finishKit() {
	showApprove = false;
	const id = imageId;
	// Reset to a clean slate immediately; discard the R2 object in the background.
	imageId = '';
	previewUrl = '';
	imageDims = { width: 0, height: 0 };
	estimate = null;
	resetResults();
	// TODO(i18n)
	liveStatus = 'Session cleared. Upload another image to start again.';
	try {
		await fetch(endpoint('discard'), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ imageId: id }),
		});
	} catch {
		// TTL reclaims it
	}
}
</script>

<Stack gap="6">
	<div aria-live="polite" class="sr-only">{liveStatus}</div>

	<!-- ═══ 1. UPLOAD ═══ -->
	<Card>
		{#snippet header()}
			<!-- TODO(i18n) -->
			<h2 class="text-fluid-lg font-semibold">1. Upload an image</h2>
			<p class="text-fluid-sm text-muted">
				Three tools in one pass — read metadata, suggest crops, and embed it for retrieval. PNG, JPEG, or WebP. The image
				is processed server-side and never saved.
			</p>
		{/snippet}

		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				uploadError = '';
				// Do NOT call update() — it would reset $page.form and clobber our local $state.
				return async ({ result }) => {
					uploading = false;
					if (result.type === 'success' && result.data?.uploaded) {
						const u = result.data.uploaded as {
							imageId: string;
							previewUrl: string;
							width: number;
							height: number;
							estimate: PreRunEstimate | null;
						};
						imageId = u.imageId;
						previewUrl = u.previewUrl;
						imageDims = { width: u.width, height: u.height };
						estimate = u.estimate;
						resetResults();
					} else if (result.type === 'failure') {
						// TODO(i18n)
						uploadError = (result.data?.uploadError as string) ?? 'Upload failed.';
					}
				};
			}}
		>
			<Stack gap="4">
				<label class="file-row">
					<!-- type=file has no project component; native input is required here. -->
					<input type="file" name="image" accept="image/png,image/jpeg,image/webp" class="file-control" />
				</label>
				<Cluster gap="3">
					<Button type="submit" variant="primary" disabled={uploading}>
						{#if uploading}<Spinner size="sm" class="mr-2" />{/if}
						<!-- TODO(i18n) -->
						Upload
					</Button>
				</Cluster>
			</Stack>
		</form>

		{#if uploadError}
			<div class="mt-4"><Alert variant="error" description={uploadError} /></div>
		{/if}

		{#if previewUrl}
			<div class="preview mt-4">
				<img src={previewUrl} alt="Uploaded preview" class="preview-img" />
			</div>
		{/if}
	</Card>

	<!-- ═══ 2. RUN ═══ -->
	<Card>
		{#snippet header()}
			<!-- TODO(i18n) -->
			<h2 class="text-fluid-lg font-semibold">2. Run the kit</h2>
			<p class="text-fluid-sm text-muted">One click runs all three tools. You can re-run any of them afterwards.</p>
		{/snippet}

		<Stack gap="4">
			<Cluster gap="3" align="center">
				<Button type="button" variant="primary" onclick={runKit} disabled={!canRun}>
					{#if visionState === 'running' || embedState === 'running'}<Spinner size="sm" class="mr-2" />{/if}
					<span class="i-lucide-play text-icon-sm mr-1" aria-hidden="true"></span>
					<!-- TODO(i18n) -->
					Run
				</Button>

				{#if !data.aiAvailable}
					<!-- TODO(i18n) -->
					<span class="text-fluid-xs text-muted">No vision provider configured — analysis is unavailable.</span>
				{:else if !hasImage}
					<!-- TODO(i18n) -->
					<span class="text-fluid-xs text-muted">Upload an image first.</span>
				{:else if estimate && visionState === 'idle'}
					<span class="text-fluid-xs text-muted">
						<!-- TODO(i18n) -->
						Est. ~{tokenFmt.format(estimate.estInputTokens)} input tokens{#if estimate.cost}
							· {fmtPer1000(estimate.cost.per1000Usd)} per 1,000 runs (reference, free-tier $0){/if}
					</span>
				{/if}
			</Cluster>

			{#if visionState !== 'idle'}
				<ul class="stages">
					<li class="stage">
						{@render stageIcon(visionState)}
						<!-- TODO(i18n) -->
						<span class="stage-label text-fluid-sm">Read metadata &amp; suggest crops</span>
						{#if visionState === 'running'}<span class="stage-bar"><span class="stage-bar-fill"></span></span>{/if}
					</li>
					<li class="stage">
						{@render stageIcon(embedState)}
						<!-- TODO(i18n) -->
						<span class="stage-label text-fluid-sm">Embed for retrieval</span>
						{#if embedState === 'running'}<span class="stage-bar"><span class="stage-bar-fill"></span></span>{/if}
					</li>
				</ul>
			{/if}

			{#if usage && cost}
				<p class="text-fluid-xs text-muted">
					<!-- TODO(i18n) -->
					Analyzed with <code>{usage.modelId}</code> · {usage.totalTokens ?? '—'} tokens · {fmtPer1000(cost.per1000Usd)} per
					1,000 (reference; you're on the free tier, so this run cost $0).
				</p>
			{/if}
		</Stack>
	</Card>

	{#if hasResults}
		<NavSection {sections} ariaLabel="Image Kit tools" />
	{/if}

	<!-- ═══ 3a. METADATA ═══ -->
	<section id="kit-metadata">
		<Card>
			{#snippet header()}
				<!-- TODO(i18n) -->
				<h2 class="text-fluid-lg font-semibold">Metadata</h2>
				<p class="text-fluid-sm text-muted">AI-proposed values you can edit. Each field shows the AI's confidence.</p>
			{/snippet}

			{#if visionState === 'running'}
				{@render skeletonRows()}
			{:else if visionState === 'error'}
				<Stack gap="3">
					<Alert variant="warning" title="Analysis unavailable" description={visionError} />
					<div>
						<Button type="button" variant="outline" size="sm" onclick={runVision}>
							<!-- TODO(i18n) -->
							Retry
						</Button>
					</div>
				</Stack>
			{:else if visionState === 'done'}
				<Stack gap="5">
					<FormField label="Title" required>
						{#snippet children({ fieldId, describedBy })}
							<Stack gap="2">
								{@render fieldMeta('title')}
								<Input id={fieldId} bind:value={fields.title} oninput={() => markEdited('title')} aria-describedby={describedBy} placeholder="A short, descriptive title" />
							</Stack>
						{/snippet}
					</FormField>

					<FormField label="Caption">
						{#snippet children({ fieldId, describedBy })}
							<Stack gap="2">
								{@render fieldMeta('caption')}
								<Textarea id={fieldId} bind:value={fields.caption} oninput={() => markEdited('caption')} aria-describedby={describedBy} placeholder="A longer description" />
							</Stack>
						{/snippet}
					</FormField>

					<FormField label="Alt text" required>
						{#snippet children({ fieldId, describedBy })}
							<Stack gap="2">
								{@render fieldMeta('altText')}
								<Textarea id={fieldId} bind:value={fields.altText} oninput={() => markEdited('altText')} aria-describedby={describedBy} placeholder="Describe the image for screen-reader users" />
							</Stack>
						{/snippet}
					</FormField>

					<FormField label="Keywords">
						{#snippet children({ fieldId, describedBy })}
							<Stack gap="2">
								{@render fieldMeta('keywords')}
								<TagInput id={fieldId} bind:value={fields.keywords} max={25} maxLength={50} placeholder="Add a keyword and press Enter" aria-describedby={describedBy} />
							</Stack>
						{/snippet}
					</FormField>

					<FormField label="Category">
						{#snippet children()}
							<Stack gap="2">
								{@render fieldMeta('category')}
								<Select options={categoryOptions} bind:value={fields.category} onchange={() => markEdited('category')} />
							</Stack>
						{/snippet}
					</FormField>
				</Stack>
			{:else}
				<p class="text-fluid-sm text-muted">
					<!-- TODO(i18n) -->
					Run the kit to read this image's metadata.
				</p>
			{/if}
		</Card>
	</section>

	<!-- ═══ 3b. CROP ═══ -->
	<section id="kit-crop">
		<Card>
			{#snippet header()}
				<!-- TODO(i18n) -->
				<h2 class="text-fluid-lg font-semibold">Frame cropper</h2>
				<p class="text-fluid-sm text-muted">
					The AI places a frame on the subject for each ratio. Drag, resize, or nudge with the arrow keys to adjust.
				</p>
			{/snippet}

			{#if visionState === 'done' && crops.length > 0}
				<CropStudio {imageId} {previewUrl} image={imageDims} {crops} {cropNote} bind:currentRects />
			{:else if visionState === 'running'}
				<div class="skeleton-box"></div>
			{:else}
				<p class="text-fluid-sm text-muted">
					<!-- TODO(i18n) -->
					Run the kit to get suggested crops.
				</p>
			{/if}
		</Card>
	</section>

	<!-- ═══ 3c. EMBED ═══ -->
	<section id="kit-embed">
		<Card>
			{#snippet header()}
				<!-- TODO(i18n) -->
				<h2 class="text-fluid-lg font-semibold">Image embedder</h2>
				<p class="text-fluid-sm text-muted">
					How retrieval "sees" this image — by embedding its description into a vector. Toggle to embed the pixels
					directly (multimodal).
				</p>
			{/snippet}

			{#if visionState === 'done'}
				<EmbedViz
					{embed}
					loading={embedState === 'running'}
					error={embedError}
					bind:multimodal
					multimodalAvailable={data.aiAvailable}
					onrun={runEmbed}
				/>
			{:else}
				<p class="text-fluid-sm text-muted">
					<!-- TODO(i18n) -->
					Run the kit to embed this image.
				</p>
			{/if}
		</Card>
	</section>

	{#if hasResults && visionState === 'done'}
		<Cluster gap="3">
			<Button type="button" variant="primary" onclick={() => (showApprove = true)}>
				<span class="i-lucide-check text-icon-sm mr-1" aria-hidden="true"></span>
				<!-- TODO(i18n) -->
				Approve &amp; review
			</Button>
		</Cluster>
	{/if}
</Stack>

<ApproveDialog
	bind:open={showApprove}
	fields={{ title: fields.title, caption: fields.caption, altText: fields.altText, keywords: fields.keywords, category: (fields.category || null) as ImageCategory | null }}
	cropRects={currentRects}
	{embed}
	ondownload={downloadCrops}
	oncopy={copyJson}
	ondone={finishKit}
/>

<!-- ─── Snippets ─── -->
{#snippet fieldMeta(key: MetadataFieldKey)}
	{#if touched[key]}
		<span class="meta-chip">
			<span class="i-lucide-user-pen text-icon-sm" aria-hidden="true"></span>
			<!-- TODO(i18n) -->
			<span class="text-fluid-xs font-medium">Edited by you</span>
		</span>
	{:else if confidence[key]}
		<Badge variant={tierVariant(confidence[key]!)}>
			<span class="i-lucide-sparkles text-icon-sm mr-1" aria-hidden="true"></span>
			<!-- TODO(i18n) -->
			AI · {confidence[key]} confidence
		</Badge>
	{/if}
{/snippet}

{#snippet stageIcon(state: ToolState)}
	{#if state === 'done'}
		<span class="i-lucide-check-circle text-icon-sm stage-done" aria-hidden="true"></span>
	{:else if state === 'error'}
		<span class="i-lucide-alert-circle text-icon-sm stage-err" aria-hidden="true"></span>
	{:else if state === 'running'}
		<Spinner size="sm" />
	{:else}
		<span class="i-lucide-circle-dashed text-icon-sm text-muted" aria-hidden="true"></span>
	{/if}
{/snippet}

{#snippet skeletonRows()}
	<Stack gap="4">
		<div class="skeleton-row"></div>
		<div class="skeleton-row"></div>
		<div class="skeleton-row"></div>
		<div class="skeleton-row"></div>
	</Stack>
{/snippet}

<style>
	.file-control {
		display: block;
		width: 100%;
		font-size: var(--text-fluid-sm);
		color: var(--color-fg);
	}

	.preview {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		width: fit-content;
		max-width: 100%;
	}

	.preview-img {
		display: block;
		max-width: 100%;
		max-height: 320px;
		height: auto;
		border-radius: var(--radius-sm);
	}

	.stages {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.stage {
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
	}

	.stage-label {
		flex: 0 0 auto;
	}

	.stage-done {
		color: var(--color-success);
	}

	.stage-err {
		color: var(--color-error);
	}

	.stage-bar {
		position: relative;
		flex: 1;
		height: 0.375rem;
		border-radius: var(--radius-full);
		background: color-mix(in srgb, var(--color-muted) 20%, transparent);
		overflow: hidden;
	}

	.stage-bar-fill {
		position: absolute;
		inset-block: 0;
		width: 33%;
		border-radius: var(--radius-full);
		background: var(--color-primary);
		animation: indeterminate 1.5s ease-in-out infinite;
	}

	@keyframes indeterminate {
		0% {
			transform: translateX(-120%);
		}
		100% {
			transform: translateX(420%);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stage-bar-fill {
			animation-duration: 3s;
		}
	}

	.meta-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		border: 1px solid color-mix(in srgb, var(--color-success) 40%, var(--color-border));
		background: color-mix(in srgb, var(--color-success) 8%, transparent);
		width: fit-content;
	}

	.skeleton-row {
		height: 2.75rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		animation: pulse 1.5s ease-in-out infinite;
	}

	.skeleton-box {
		height: 18rem;
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-muted) 15%, transparent);
		animation: pulse 1.5s ease-in-out infinite;
	}

	@keyframes pulse {
		0%,
		100% {
			opacity: 1;
		}
		50% {
			opacity: 0.55;
		}
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border-width: 0;
	}
</style>
