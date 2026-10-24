<script lang="ts">
/**
 * Not localized: every user-facing string below is a literal or a humanized
 * enum key. The whole file still needs an i18n pass — no per-string markers.
 */
import { tick } from 'svelte';
import { superForm } from 'sveltekit-superforms';
import { valibotClient } from 'sveltekit-superforms/adapters';
import { apiFetch } from '#lib/api.ts';
import { Alert, Card, FormField, TagInput } from '#lib/components/composites/index.ts';
import { Cluster, Stack } from '#lib/components/layout/index.ts';
import { Badge, Button, Input, Select, Spinner, Switch, Textarea, Tooltip } from '#lib/components/primitives/index.ts';
import {
	type AnalyzeUsage,
	type ConfidenceTier,
	type CostEstimate,
	type FieldProvenance,
	IMAGE_CATEGORIES,
	type ImageCategory,
	imageMetadataSaveSchema,
	type MetadataFieldKey,
	type ProvenanceState,
} from '#lib/schemas/image-metadata.ts';
import { enhance } from '$app/forms';
import MetadataApprovalDialog from './_components/MetadataApprovalDialog.svelte';
import type { PageProps } from './$types';

let { data }: PageProps = $props();

// Manual form (always usable, even with AI off)
// svelte-ignore state_referenced_locally
const {
	form,
	errors,
	enhance: saveEnhance,
	submitting,
	message: formMessage,
} = superForm(data.form, {
	validators: valibotClient(imageMetadataSaveSchema),
	// Provenance + GPS opt-in are managed outside Superforms; never reset them on submit.
	resetForm: false,
});

// Upload result state (drives preview + GPS row + analyze gating)
let imageId = $state('');
let previewUrl = $state('');
let exifGps = $state<{ lat: number; lng: number } | null>(null);
let exifDate = $state<string | null>(null);
let uploadError = $state('');
let uploading = $state(false);

// Per-field provenance + AI metadata
let provenance = $state<FieldProvenance>({
	title: 'empty',
	caption: 'empty',
	altText: 'empty',
	keywords: 'empty',
	category: 'empty',
});
let confidence = $state<Partial<Record<MetadataFieldKey, ConfidenceTier>>>({});

// Per-field "touched" — true once the user has edited the field. Drives the
// taint-guarded merge: the AI never overwrites a human edit.
let touched = $state<Record<MetadataFieldKey, boolean>>({
	title: false,
	caption: false,
	altText: false,
	keywords: false,
	category: false,
});

// AI-suggested values the user has NOT accepted (because they had already
// edited that field). Surfaced as a click-to-accept conflict chip.
let conflicts = $state<Partial<Record<MetadataFieldKey, string>>>({});

// TagInput only exposes `bind:value`, so user keyword edits are detected via a
// guarded effect. The effect keys off a $derived of the keyword CONTENT (not the
// whole $form store), so unrelated field edits — a typed title, the AI merge of
// other fields — don't spuriously mark keywords as human-edited. `keywordsProgrammatic`
// suppresses the human-mark while the AI merge / conflict-accept paths write the array.
let keywordsProgrammatic = false;
let keywordsInitialized = false;

let analyzing = $state(false);
let analyzeError = $state('');
let liveStatus = $state('');
// Per-run cost/token telemetry from the last successful analyze (null until then,
// cleared on re-analyze and on a new upload). Drives the cost panel.
let analyzeCost = $state<{ usage: AnalyzeUsage; cost: CostEstimate | null } | null>(null);

const canAnalyze = $derived(data.aiAvailable && !!imageId && !analyzing);

// Cost/token formatting. Hardcoded 'en-US' below — the active locale still
// needs threading in here.
const tokenFmt = new Intl.NumberFormat('en-US');
function fmtTokens(n: number | null): string {
	return n == null ? '—' : tokenFmt.format(n);
}
/** Sub-cent precision so a single run never collapses to "$0.00". Prefixed ≈ (estimate). */
function fmtUsd(n: number): string {
	return `≈ ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 6, maximumFractionDigits: 6 }).format(n)}`;
}
/** The human-legible hero figure — two decimals, widening only if still sub-cent at 1000×. */
function fmtPer1000(n: number): string {
	return `≈ ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: n < 0.01 ? 4 : 2 }).format(n)}`;
}
function fmtDuration(ms: number): string {
	return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)}s`;
}

// Category options for Select (string-keyed)
// labels are humanized enum keys for now.
const categoryOptions = IMAGE_CATEGORIES.map((c) => ({
	value: c,
	label: c.charAt(0).toUpperCase() + c.slice(1),
}));

// Provenance affordance: TEXT + ICON + aria, never color alone
// (Avoids the repo's logged WCAG 1.4.1 color-only defect.)
const PROVENANCE_META: Record<ProvenanceState, { label: string; icon: string }> = {
	empty: { label: 'Empty', icon: 'i-lucide-circle-dashed' },
	'ai-draft': { label: 'AI draft', icon: 'i-lucide-sparkles' },
	human: { label: 'Edited by you', icon: 'i-lucide-user-pen' },
};

function markHuman(field: MetadataFieldKey) {
	touched[field] = true;
	provenance[field] = 'human';
	// A human edit resolves any pending AI conflict for this field.
	delete conflicts[field];
}

// Detect user-driven keyword edits (TagInput has no change callback). Programmatic
// writes (AI merge, conflict-accept) set `keywordsProgrammatic` to skip the mark.
// keywordsKey is a $derived of the keyword CONTENT. Because $derived is memoized, the
// effect below only re-runs when the keywords actually change — never on unrelated
// $form field edits (title/caption/etc.). Subscribing to `$form` directly previously
// fired this effect on every field change and mis-marked keywords as human-edited.
const keywordsKey = $derived($form.keywords.join('\u0000'));
$effect(() => {
	void keywordsKey;
	if (!keywordsInitialized) {
		keywordsInitialized = true;
		return;
	}
	if (keywordsProgrammatic) {
		keywordsProgrammatic = false;
		return;
	}
	markHuman('keywords');
});

// Upload (use:enhance)
function resetForNewImage() {
	provenance = {
		title: 'empty',
		caption: 'empty',
		altText: 'empty',
		keywords: 'empty',
		category: 'empty',
	};
	confidence = {};
	conflicts = {};
	touched = { title: false, caption: false, altText: false, keywords: false, category: false };
	analyzeError = '';
	analyzeCost = null;
}

// Analyze (POST /api/ai/images/[id]/analyze; never auto-fired)
interface AnalyzeData {
	fields: {
		title: string | null;
		caption: string | null;
		altText: string | null;
		keywords: string[];
		category: ImageCategory | null;
	};
	confidence: Record<MetadataFieldKey, ConfidenceTier>;
	usage: AnalyzeUsage;
	cost: CostEstimate | null;
}
/** Repo-wide API envelope: `{ data }` on success, `{ error: { code, message } }` on failure. */
type AnalyzeEnvelope =
	| { data: AnalyzeData; error?: never }
	| { data?: never; error: { code: string; message: string } };

/** Apply one AI-proposed value with taint guarding. */
function mergeField(field: MetadataFieldKey, value: string | string[] | null, tier: ConfidenceTier) {
	const isEmpty = value === null || (Array.isArray(value) && value.length === 0);
	if (isEmpty) return;

	confidence[field] = tier;

	// User already edited this field → do NOT overwrite. Offer it as a conflict chip.
	if (touched[field]) {
		conflicts[field] = Array.isArray(value) ? value.join(', ') : value;
		return;
	}

	applyValue(field, value);
	provenance[field] = 'ai-draft';
}

/** Write a value into $form for a given field (keywords is an array). */
function applyValue(field: MetadataFieldKey, value: string | string[] | null) {
	if (value === null) return;
	switch (field) {
		case 'title':
			$form.title = value as string;
			break;
		case 'caption':
			$form.caption = value as string;
			break;
		case 'altText':
			$form.altText = value as string;
			break;
		case 'keywords':
			keywordsProgrammatic = true;
			$form.keywords = value as string[];
			break;
		case 'category':
			$form.category = value as ImageCategory;
			break;
	}
}

/** Accept a conflict chip: overwrite the human edit with the AI suggestion. */
function acceptConflict(field: MetadataFieldKey) {
	const raw = conflicts[field];
	if (raw === undefined) return;
	if (field === 'keywords') {
		applyValue(
			'keywords',
			raw
				.split(',')
				.map((s) => s.trim())
				.filter(Boolean),
		);
	} else {
		applyValue(field, raw);
	}
	provenance[field] = 'ai-draft';
	touched[field] = false;
	delete conflicts[field];
}

async function analyze() {
	if (!canAnalyze) return;
	analyzing = true;
	analyzeError = '';
	analyzeCost = null;
	liveStatus = 'Analyzing image…';

	try {
		// The image id is the path segment — the un-localized API tree, so no locale
		// prefix handling. `apiFetch` carries the CSRF header a bare fetch to /api/ lacks.
		const res = await apiFetch(`/api/ai/images/${encodeURIComponent(imageId)}/analyze`, { method: 'POST' });
		const body = (await res.json()) as AnalyzeEnvelope;

		if (body.data) {
			const d = body.data;
			mergeField('title', d.fields.title, d.confidence.title);
			mergeField('caption', d.fields.caption, d.confidence.caption);
			mergeField('altText', d.fields.altText, d.confidence.altText);
			mergeField('keywords', d.fields.keywords, d.confidence.keywords);
			mergeField('category', d.fields.category, d.confidence.category);
			analyzeCost = { usage: d.usage, cost: d.cost };
			// single SR summary; the table itself is not a live region.
			const costNote = d.cost
				? ` Estimated reference cost about ${fmtPer1000(d.cost.per1000Usd)} per 1,000 analyses; you weren't charged.`
				: '';
			liveStatus = `Analysis complete. Review the AI-filled fields.${costNote}`;
		} else {
			analyzeError = body.error.message;
			liveStatus = 'Analysis failed. The form is still editable.';
		}
	} catch {
		analyzeError = 'Could not reach the analysis service. The form is still editable.';
		liveStatus = analyzeError;
	} finally {
		analyzing = false;
	}
}

// Approval dialog + atomic save
let showApproval = $state(false);
let formRef = $state<HTMLFormElement | null>(null);
let provenanceJson = $state('{}');

const CATEGORY_LABEL = new Map(categoryOptions.map((o) => [o.value, o.label]));

const approvalRows = $derived([
	// field labels
	{ field: 'Title', aiProposed: conflicts.title ?? '', saving: $form.title },
	{ field: 'Caption', aiProposed: conflicts.caption ?? '', saving: $form.caption ?? '' },
	{ field: 'Alt text', aiProposed: conflicts.altText ?? '', saving: $form.altText },
	{
		field: 'Keywords',
		aiProposed: conflicts.keywords ?? '',
		saving: $form.keywords.join(', '),
	},
	{
		field: 'Category',
		aiProposed: conflicts.category ?? '',
		saving: CATEGORY_LABEL.get($form.category) ?? $form.category,
	},
]);

function openApproval() {
	showApproval = true;
}

async function confirmSave() {
	showApproval = false;
	provenanceJson = JSON.stringify(provenance);
	// Flush the hidden `fieldProvenance` value into the DOM before submitting —
	// requestSubmit reads the live attribute, which Svelte updates asynchronously.
	await tick();
	// Mirror the forms/advanced/confirm precedent: commit the hidden field, then submit.
	formRef?.requestSubmit();
}

function cancelApproval() {
	showApproval = false;
}

const hasAnyValue = $derived(!!$form.title || !!$form.altText || !!$form.caption || $form.keywords.length > 0);
</script>

<Stack gap="6">
	{#if $formMessage}
		<Alert variant="success" title="Saved" description={$formMessage} />
	{/if}

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">1. Upload an image</h2>
			<p class="text-fluid-sm text-muted">PNG, JPEG, or WebP. The image is processed server-side; only a sanitized derivative is stored.</p>
		{/snippet}

		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			use:enhance={() => {
				uploading = true;
				uploadError = '';
				// NB: we deliberately do NOT call SvelteKit's `update()`. The upload action
				// returns { uploaded }, not a form; applying that result would change
				// $page.form, which triggers Superforms' applyAction to RESET $form to its
				// loaded defaults — wiping the `$form.imageId` set below (→ save would then
				// post an empty imageId and fail validation). Handling the result manually
				// keeps the upload fully decoupled from the Superforms form, as intended.
				return async ({ result }) => {
					uploading = false;
					if (result.type === 'success' && result.data?.uploaded) {
						const u = result.data.uploaded as {
							imageId: string;
							previewUrl: string;
							exifGps: { lat: number; lng: number } | null;
							exifDate: string | null;
						};
						imageId = u.imageId;
						previewUrl = u.previewUrl;
						exifGps = u.exifGps;
						exifDate = u.exifDate;
						$form.imageId = u.imageId;
						resetForNewImage();
					} else if (result.type === 'failure') {
						uploadError = (result.data?.uploadError as string) ?? 'Upload failed.';
					}
				};
			}}
		>
			<Stack gap="4">
				<label class="file-row">
					<!-- type=file has no project component; native input is required here. -->
					<input
						type="file"
						name="image"
						accept="image/png,image/jpeg,image/webp"
						class="file-control"
					/>
				</label>
				<Cluster gap="3">
					<Button type="submit" variant="primary" disabled={uploading}>
						{#if uploading}<Spinner size="sm" class="mr-2" />{/if}
						Upload
					</Button>
				</Cluster>
			</Stack>
		</form>

		{#if uploadError}
			<div class="mt-4">
				<Alert variant="error" description={uploadError} />
			</div>
		{/if}

		{#if previewUrl}
			<div class="preview mt-4">
				<!-- Alt text mirrors the live form value so the preview reflects what will be saved. -->
				<img src={previewUrl} alt={$form.altText || 'Uploaded image preview'} class="preview-img" />
			</div>
		{/if}
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">2. Analyze with AI (optional)</h2>
			<p class="text-fluid-sm text-muted">Vision AI proposes values for the fields below. It never overwrites anything you have edited.</p>
		{/snippet}

		<Stack gap="4">
			<Cluster gap="3" align="center">
				<Button type="button" variant="outline" onclick={analyze} disabled={!canAnalyze}>
					{#if analyzing}<Spinner size="sm" class="mr-2" />{/if}
					<span class="i-lucide-sparkles text-icon-sm mr-1" aria-hidden="true"></span>
					Analyze image
				</Button>
				{#if !data.aiAvailable}
					<span class="text-fluid-xs text-muted">No vision provider configured — manual entry only.</span>
				{:else if !imageId}
					<span class="text-fluid-xs text-muted">Upload an image first.</span>
				{/if}
			</Cluster>

			{#if analyzeError}
				<Alert variant="warning" title="Analysis unavailable" description={analyzeError} />
			{/if}

			<!-- Cost panel — only after a successful analyze (no zeroed skeleton). -->
			{#if analyzeCost}
				{@const u = analyzeCost.usage}
				{@const c = analyzeCost.cost}
				<section class="cost-panel" aria-labelledby="cost-panel-heading">
					<div class="cost-head">
						<h3 id="cost-panel-heading" class="text-fluid-sm font-semibold">Analysis cost</h3>
						<span class="text-fluid-xs text-muted">
							<code>{u.modelId}</code> · {fmtDuration(u.durationMs)}
						</span>
					</div>

					<div>
						<!-- Text carries the meaning (not color); secondary = a label, not a warning. -->
						<Badge variant="secondary">
							<span class="i-lucide-info text-icon-sm mr-1" aria-hidden="true"></span>
							Reference estimate · not a charge
						</Badge>
					</div>

					<table class="cost-table">
						<thead>
							<tr>
								<th scope="col" class="text-fluid-xs text-muted">Tokens</th>
								<th scope="col" class="text-fluid-xs text-muted num">Count</th>
								<th scope="col" class="text-fluid-xs text-muted num">Est. cost</th>
							</tr>
						</thead>
						<tbody>
							<tr>
								<th scope="row" class="text-fluid-sm">Input</th>
								<td class="num">{fmtTokens(u.inputTokens)}</td>
								<td class="num text-muted">{c ? fmtUsd(c.inputUsd) : '—'}</td>
							</tr>
							<tr>
								<th scope="row" class="text-fluid-sm">Output</th>
								<td class="num">{fmtTokens(u.outputTokens)}</td>
								<td class="num text-muted">{c ? fmtUsd(c.outputUsd) : '—'}</td>
							</tr>
							{#if u.reasoningTokens != null}
								<tr class="cost-subrow">
									<th scope="row" class="text-fluid-xs text-muted">
										<span class="i-lucide-brain text-icon-sm" aria-hidden="true"></span>
										of which thinking
									</th>
									<td class="num text-muted text-fluid-xs">{fmtTokens(u.reasoningTokens)}</td>
									<!-- thinking cost is already inside Output above. -->
									<td class="num text-muted text-fluid-xs">incl. above</td>
								</tr>
							{/if}
							<tr class="cost-total">
								<th scope="row" class="text-fluid-sm font-semibold">This analysis</th>
								<td class="num font-semibold">{fmtTokens(u.totalTokens)}</td>
								<td class="num font-semibold">{c ? fmtUsd(c.totalUsd) : '—'}</td>
							</tr>
						</tbody>
					</table>

					{#if c}
						<div class="cost-hero">
							<span class="cost-hero-figure">{fmtPer1000(c.per1000Usd)}</span>
							<span class="text-fluid-xs text-muted">per 1,000 analyses</span>
							<span class="cost-ref text-fluid-xs text-muted">
								at standard pay-as-you-go pricing · verified {c.verifiedOn}
								<Tooltip content="Token counts × this model's published per-token price. The live provider runs on the free tier, so nothing is actually billed.">
									<span class="i-lucide-info text-icon-sm cost-info" aria-hidden="true"></span>
									<span class="sr-only">How this estimate is calculated</span>
								</Tooltip>
							</span>
						</div>
						<!-- The one place "$0.00" is correct: it states the REAL charge, not the estimate. -->
						<p class="text-fluid-xs text-muted cost-footnote">You're on the free tier — this run cost $0.00.</p>
					{:else}
						<p class="text-fluid-xs text-muted">
							Dollar estimate unavailable — <code>{u.modelId}</code> isn't in the reference price table.
						</p>
					{/if}
				</section>
			{/if}
		</Stack>

		<!-- Screen-reader announcement for analyze completion -->
		<div aria-live="polite" class="sr-only">{liveStatus}</div>
	</Card>

	<Card>
		{#snippet header()}
			<h2 class="text-fluid-lg font-semibold">3. Metadata</h2>
			<p class="text-fluid-sm text-muted">Always editable. Each field shows whether it is empty, an AI draft, or edited by you.</p>
		{/snippet}

		<form method="POST" action="?/save" use:saveEnhance bind:this={formRef}>
			<Stack gap="5">
				<input type="hidden" name="imageId" value={$form.imageId} />
				<!-- Provenance ships as a JSON hidden field, NOT a Superforms nested field. -->
				<input type="hidden" name="fieldProvenance" value={provenanceJson} />

				<!-- Title -->
				<FormField label="Title" error={$errors.title?.[0]} required>
					{#snippet children({ fieldId, describedBy })}
						<Stack gap="2">
							{@render provenanceBadge('title')}
							<Input
								id={fieldId}
								name="title"
								bind:value={$form.title}
								oninput={() => markHuman('title')}
								error={!!$errors.title}
								aria-describedby={describedBy}
								placeholder="A short, descriptive title"
							/>
							{@render conflictChip('title')}
						</Stack>
					{/snippet}
				</FormField>

				<!-- Caption -->
				<FormField label="Caption" error={$errors.caption?.[0]}>
					{#snippet children({ fieldId, describedBy })}
						<Stack gap="2">
							{@render provenanceBadge('caption')}
							<Textarea
								id={fieldId}
								name="caption"
								bind:value={$form.caption}
								oninput={() => markHuman('caption')}
								error={!!$errors.caption}
								aria-describedby={describedBy}
								placeholder="A longer description of the image"
							/>
							{@render conflictChip('caption')}
						</Stack>
					{/snippet}
				</FormField>

				<!-- Alt text -->
				<FormField label="Alt text" error={$errors.altText?.[0]} required>
					{#snippet children({ fieldId, describedBy })}
						<Stack gap="2">
							{@render provenanceBadge('altText')}
							<Textarea
								id={fieldId}
								name="altText"
								bind:value={$form.altText}
								oninput={() => markHuman('altText')}
								error={!!$errors.altText}
								aria-describedby={describedBy}
								placeholder="Describe the image for screen-reader users"
							/>
							{@render conflictChip('altText')}
						</Stack>
					{/snippet}
				</FormField>

				<!-- Keywords (array) -->
				<FormField label="Keywords" error={$errors.keywords?._errors?.[0]}>
					{#snippet children({ fieldId, describedBy })}
						<Stack gap="2">
							{@render provenanceBadge('keywords')}
							<!-- Hidden mirrors so the array reaches the action via formData.getAll('keywords').
							     TagInput is bind:value-only (no name), and the form uses the default
							     dataType:'form', so without these the keywords never post (tags lost on save). -->
							{#each $form.keywords as kw (kw)}
								<input type="hidden" name="keywords" value={kw} />
							{/each}
							<TagInput
								id={fieldId}
								bind:value={$form.keywords}
								max={25}
								maxLength={50}
								placeholder="Add a keyword and press Enter"
								aria-describedby={describedBy}
							/>
							{@render conflictChip('keywords')}
						</Stack>
					{/snippet}
				</FormField>

				<!-- Category -->
				<FormField label="Category" error={$errors.category?.[0]}>
					{#snippet children({ fieldId })}
						<Stack gap="2">
							{@render provenanceBadge('category')}
							<!-- Hidden mirror so the enum reaches the action via formData. -->
							<input type="hidden" name="category" value={$form.category} />
							<Select
								options={categoryOptions}
								bind:value={$form.category}
								onchange={() => markHuman('category')}
							/>
							{@render conflictChip('category')}
						</Stack>
					{/snippet}
				</FormField>

				<!-- GPS opt-in (sensitive) -->
				<div class="gps-row">
					<Switch
						bind:checked={$form.includeLocation}
						label="Save location (GPS) with this image"
						disabled={!exifGps}
					/>
					<!--
						Submit the opt-in via a real checkbox (Superforms reads booleans
						natively: present+checked = true, absent = false). The Switch above is
						the visual affordance; this stays visually hidden but keeps them in sync.
						CLAUDE.md permits a raw checkbox for native boolean binding.
					-->
					<input type="checkbox" name="includeLocation" bind:checked={$form.includeLocation} class="sr-only" tabindex="-1" aria-hidden="true" />
					<!-- Coordinates only ride along when opted in; never submitted otherwise. -->
					{#if exifGps && $form.includeLocation}
						<input type="hidden" name="gpsLat" value={String(exifGps.lat)} />
						<input type="hidden" name="gpsLng" value={String(exifGps.lng)} />
					{/if}

					{#if exifGps}
						{#if $form.includeLocation}
							<p class="gps-coords text-fluid-xs text-muted">
								Will save: <code>{exifGps.lat.toFixed(6)}, {exifGps.lng.toFixed(6)}</code>
							</p>
						{/if}
					{:else}
						<p class="text-fluid-xs text-muted">No location data in this image.</p>
					{/if}
				</div>

				{#if exifDate}
					<p class="text-fluid-xs text-muted">Captured: <code>{exifDate}</code></p>
				{/if}

				<Cluster gap="3">
					<Button type="button" variant="primary" onclick={openApproval} disabled={!hasAnyValue || !$form.imageId || $submitting}>
						{#if $submitting}<Spinner size="sm" class="mr-2" />{/if}
						Review & save
					</Button>
				</Cluster>
			</Stack>
		</form>
	</Card>
</Stack>

<MetadataApprovalDialog
	bind:open={showApproval}
	rows={approvalRows}
	includeLocation={$form.includeLocation ?? false}
	gps={exifGps}
	onconfirm={confirmSave}
	oncancel={cancelApproval}
/>

{#snippet provenanceBadge(field: MetadataFieldKey)}
	{@const state = provenance[field]}
	{@const meta = PROVENANCE_META[state]}
	<Cluster gap="2" align="center">
		<span class={`provenance provenance-${state}`}>
			<span class={`${meta.icon} text-icon-sm`} aria-hidden="true"></span>
			<span class="text-fluid-xs font-medium">{meta.label}</span>
		</span>
		{#if confidence[field]}
			{@render confidenceChip(confidence[field]!)}
		{/if}
	</Cluster>
{/snippet}

{#snippet confidenceChip(tier: ConfidenceTier)}
	{@const variant = tier === 'high' ? 'success' : tier === 'medium' ? 'warning' : 'secondary'}
	<!-- text label carries the meaning, not color alone. -->
	<Badge {variant}>{tier} confidence</Badge>
{/snippet}

{#snippet conflictChip(field: MetadataFieldKey)}
	{#if conflicts[field]}
		<button type="button" class="conflict-chip" onclick={() => acceptConflict(field)}>
			<span class="i-lucide-sparkles text-icon-sm" aria-hidden="true"></span>
			<span>AI suggested: <strong>{conflicts[field]}</strong> — click to accept</span>
		</button>
	{/if}
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

	.provenance {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border);
		/* No transition — provenance flips instantly on edit. */
	}

	.provenance-empty {
		color: var(--color-muted);
	}

	.provenance-ai-draft {
		color: var(--color-fg);
		border-color: color-mix(in srgb, var(--color-primary) 40%, var(--color-border));
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.provenance-human {
		color: var(--color-fg);
		border-color: color-mix(in srgb, var(--color-success) 40%, var(--color-border));
		background: color-mix(in srgb, var(--color-success) 8%, transparent);
	}

	.conflict-chip {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-2) var(--spacing-3);
		border-radius: var(--radius-md);
		border: 1px dashed color-mix(in srgb, var(--color-primary) 50%, var(--color-border));
		background: color-mix(in srgb, var(--color-primary) 6%, transparent);
		color: var(--color-fg);
		font-size: var(--text-fluid-xs);
		cursor: pointer;
		text-align: left;
		width: fit-content;
	}

	.conflict-chip:hover {
		background: color-mix(in srgb, var(--color-primary) 12%, transparent);
	}

	.gps-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
	}

	.gps-coords {
		margin: 0;
	}

	.gps-coords code,
	.gps-row code {
		font-family: ui-monospace, monospace;
	}

	.cost-panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
		padding: var(--spacing-4);
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		background: color-mix(in srgb, var(--color-primary) 4%, transparent);
	}

	.cost-head {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--spacing-2);
	}

	.cost-head code,
	.cost-panel code {
		font-family: ui-monospace, monospace;
	}

	.cost-table {
		width: 100%;
		border-collapse: collapse;
		font-variant-numeric: tabular-nums;
	}

	.cost-table th,
	.cost-table td {
		padding: var(--spacing-1) 0;
		text-align: left;
	}

	.cost-table .num {
		text-align: right;
		font-variant-numeric: tabular-nums;
	}

	.cost-table thead th {
		font-weight: 400;
		border-bottom: 1px solid var(--color-border);
		padding-bottom: var(--spacing-2);
	}

	.cost-table tbody th {
		font-weight: 500;
	}

	/* Reasoning sub-line: indent + icon + the word "thinking" — never color alone. */
	.cost-subrow th {
		padding-left: var(--spacing-4);
	}

	.cost-subrow th span[class*='i-lucide'] {
		margin-right: var(--spacing-1);
		vertical-align: -0.125em;
	}

	.cost-total td,
	.cost-total th {
		border-top: 1px solid var(--color-border);
		padding-top: var(--spacing-2);
	}

	.cost-hero {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--spacing-1) var(--spacing-2);
		padding-top: var(--spacing-1);
	}

	.cost-hero-figure {
		font-size: var(--text-fluid-lg);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--color-fg);
	}

	.cost-ref {
		display: inline-flex;
		align-items: center;
		gap: var(--spacing-1);
	}

	/* WCAG 2.5.8: keep the tooltip trigger's hit area ≥ 24×24 CSS px. */
	.cost-info {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		min-height: 24px;
	}

	.cost-footnote {
		margin: 0;
	}
</style>
