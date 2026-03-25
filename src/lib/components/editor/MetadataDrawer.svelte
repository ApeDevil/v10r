<script lang="ts">
	import { Drawer, Input, Badge, Button } from '$lib/components/primitives';
	import { Stack } from '$lib/components/layout';

	interface Props {
		open: boolean;
		title: string;
		slug: string;
		summary: string;
		status: 'draft' | 'published' | 'archived';
		domain: { id: string; slug: string; name: string } | null;
		availableDomains: { id: string; slug: string; name: string }[];
		tags: { id: string; slug: string; name: string }[];
		locale: string;
		availableTags: { id: string; slug: string; name: string }[];
		ontitlechange: (v: string) => void;
		onslugchange: (v: string) => void;
		onsummarychange: (v: string) => void;
		onlocalechange: (v: string) => void;
		ondomainchange: (domainId: string | null) => void;
		ontagstoggle: (tagId: string) => void;
	}

	let {
		open = $bindable(false),
		title,
		slug,
		summary,
		status,
		domain,
		availableDomains,
		tags,
		locale,
		availableTags,
		ontitlechange,
		onslugchange,
		onsummarychange,
		onlocalechange,
		ondomainchange,
		ontagstoggle,
	}: Props = $props();

	let manualSlug = $state(false);

	function slugify(text: string): string {
		return text
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 80);
	}

	function handleTitleInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		ontitlechange(v);
		if (!manualSlug) {
			onslugchange(slugify(v));
		}
	}

	function handleSlugInput(e: Event) {
		const v = (e.target as HTMLInputElement).value;
		manualSlug = true;
		onslugchange(v);
	}

	function resetSlug() {
		manualSlug = false;
		onslugchange(slugify(title));
	}

	function statusVariant(s: string): 'success' | 'secondary' | 'warning' {
		if (s === 'published') return 'success';
		if (s === 'archived') return 'warning';
		return 'secondary';
	}

	function isTagSelected(tagId: string): boolean {
		return tags.some((t) => t.id === tagId);
	}
</script>

<Drawer bind:open title="Post Metadata">
	<Stack gap="5">
		<!-- Title -->
		<div class="field">
			<label class="field-label" for="meta-title">Title</label>
			<Input id="meta-title" value={title} oninput={handleTitleInput} placeholder="Post title" />
		</div>

		<!-- Slug -->
		<div class="field">
			<div class="field-label-row">
				<label class="field-label" for="meta-slug">Slug</label>
				{#if manualSlug}
					<button class="reset-btn" onclick={resetSlug}>Reset to auto</button>
				{/if}
			</div>
			<Input id="meta-slug" value={slug} oninput={handleSlugInput} placeholder="post-slug" />
		</div>

		<!-- Summary -->
		<div class="field">
			<label class="field-label" for="meta-summary">Summary</label>
			<textarea
				id="meta-summary"
				class="summary-textarea"
				value={summary}
				oninput={(e) => onsummarychange((e.target as HTMLTextAreaElement).value)}
				placeholder="Brief description for SEO and listings..."
				rows="3"
			></textarea>
		</div>

		<!-- Status -->
		<div class="field">
			<span class="field-label">Status</span>
			<Badge variant={statusVariant(status)}>{status}</Badge>
		</div>

		<!-- Locale -->
		<div class="field">
			<label class="field-label" for="meta-locale">Locale</label>
			<Input
				id="meta-locale"
				value={locale}
				oninput={(e) => onlocalechange((e.target as HTMLInputElement).value)}
				placeholder="en"
			/>
		</div>

		<!-- Domain -->
		<div class="field">
			<span class="field-label">Domain</span>
			{#if availableDomains.length === 0}
				<p class="field-hint">No domains available. Create domains in admin.</p>
			{:else}
				<div class="tag-grid">
					{#each availableDomains as d}
						<button
							class="tag-chip"
							class:tag-selected={domain?.id === d.id}
							aria-pressed={domain?.id === d.id}
							onclick={() => ondomainchange(domain?.id === d.id ? null : d.id)}
						>
							{d.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>

		<!-- Categories -->
		<div class="field">
			<span class="field-label">Categories</span>
			{#if availableTags.length === 0}
				<p class="field-hint">No categories available. Create tags in admin.</p>
			{:else}
				<div class="tag-grid">
					{#each availableTags as t}
						<button
							class="tag-chip"
							class:tag-selected={isTagSelected(t.id)}
							aria-pressed={isTagSelected(t.id)}
							onclick={() => ontagstoggle(t.id)}
						>
							{t.name}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</Stack>
</Drawer>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.field-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--color-muted);
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.reset-btn {
		font-size: 11px;
		color: var(--color-primary);
		background: none;
		border: none;
		cursor: pointer;
		padding: 0;
	}

	.reset-btn:hover {
		text-decoration: underline;
	}

	.reset-btn:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
		border-radius: var(--radius-sm);
	}

	.field-hint {
		font-size: 12px;
		color: var(--color-muted);
	}

	.summary-textarea {
		width: 100%;
		padding: 8px 12px;
		font-size: 13px;
		line-height: 1.5;
		color: var(--color-fg);
		background: var(--color-input);
		border: none;
		border-bottom: 1px solid var(--color-input-border);
		border-radius: var(--radius-sm) var(--radius-sm) 0 0;
		resize: vertical;
		font-family: inherit;
		outline: none;
	}

	.summary-textarea:focus {
		border-bottom: 2px solid var(--color-primary);
	}

	.tag-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.tag-chip {
		padding: 3px 10px;
		font-size: 12px;
		border-radius: var(--radius-full);
		border: 1px solid var(--color-border);
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
	}

	.tag-chip:hover {
		background: var(--surface-2);
	}

	.tag-chip.tag-selected {
		background: var(--color-primary);
		color: var(--color-on-primary-container);
		border-color: var(--color-primary);
	}
</style>
