<script lang="ts">
import {
	Avatar,
	Badge,
	Kbd,
	Progress,
	ScrollArea,
	Skeleton,
	SkeletonAvatar,
	SkeletonCard,
	SkeletonText,
	Spinner,
	Tag,
	TagGroup,
	TagSelectable,
} from '$lib/components';
import { DemoCard, VariantGrid } from '../_components';

let progressValue = $state(65);

let tags = $state(['Svelte', 'TypeScript', 'UnoCSS', 'Bits UI']);
let filterActive = $state(false);
let filterPending = $state(true);
let filterCompleted = $state(false);

let groupItems = $state([
	{ value: 'svelte', label: 'Svelte', icon: 'i-lucide-component' },
	{ value: 'typescript', label: 'TypeScript', icon: 'i-lucide-file-code' },
	{ value: 'unocss', label: 'UnoCSS' },
	{ value: 'bitsui', label: 'Bits UI' },
	{ value: 'valibot', label: 'Valibot' },
]);
</script>

<section id="prim-data-display" class="section">
	<h2 class="section-title">Data Display</h2>
	<p class="section-description">Components for presenting data and status information.</p>

	<div class="demos">
		<!-- Badge Variants -->
		<DemoCard title="Badge Variants" description="Status indicators">
			<VariantGrid layout="row">
				<Badge variant="default">Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="success">Success</Badge>
				<Badge variant="warning">Warning</Badge>
				<Badge variant="error">Error</Badge>
				<Badge variant="outline">Outline</Badge>
			</VariantGrid>
		</DemoCard>

		<!-- Tag -->
		<DemoCard title="Tag" description="Dismissible tags and toggle-based filters">
			<div class="tag-demos">
				<div class="tag-group">
					<span class="tag-group-label">Variants</span>
					<VariantGrid layout="row">
						<Tag label="Default" variant="default" ondismiss={() => {}} />
						<Tag label="Secondary" variant="secondary" ondismiss={() => {}} />
						<Tag label="Success" variant="success" ondismiss={() => {}} />
						<Tag label="Warning" variant="warning" ondismiss={() => {}} />
						<Tag label="Error" variant="error" ondismiss={() => {}} />
						<Tag label="Outline" variant="outline" ondismiss={() => {}} />
					</VariantGrid>
				</div>

				<hr class="tag-divider" />

				<div class="tag-group">
					<span class="tag-group-label">Sizes & options</span>
					<VariantGrid layout="row">
						<Tag label="Small" size="sm" ondismiss={() => {}} />
						<Tag label="Medium" size="md" ondismiss={() => {}} />
						<Tag label="With Icon" size="md" icon="i-lucide-tag" ondismiss={() => {}} />
						<Tag label="No dismiss" variant="secondary" />
					</VariantGrid>
				</div>

				<hr class="tag-divider" />

				<div class="tag-group">
					<span class="tag-group-label">Interactive — click x to remove</span>
					<VariantGrid layout="row">
						{#each tags as tag (tag)}
							<Tag
								label={tag}
								variant="secondary"
								ondismiss={() => { tags = tags.filter(t => t !== tag); }}
							/>
						{/each}
						{#if tags.length === 0}
							<span class="tags-empty">All tags removed</span>
						{/if}
					</VariantGrid>
				</div>

				<hr class="tag-divider" />

				<div class="tag-group">
					<span class="tag-group-label">TagGroup — keyboard-navigable dismiss</span>
					<TagGroup
						items={groupItems}
						variant="secondary"
						dismissible
						ondismiss={(value) => { groupItems = groupItems.filter(i => i.value !== value); }}
						label="Technology tags"
					/>
					{#if groupItems.length === 0}
						<span class="tags-empty">All tags removed</span>
					{/if}
				</div>

				<hr class="tag-divider" />

				<div class="tag-group">
					<span class="tag-group-label">Selectable (toggle)</span>
					<VariantGrid layout="row">
						<TagSelectable label="Active" bind:pressed={filterActive} />
						<TagSelectable label="Pending" bind:pressed={filterPending} />
						<TagSelectable label="Completed" bind:pressed={filterCompleted} />
					</VariantGrid>
				</div>

				<hr class="tag-divider" />

				<div class="tag-group">
					<span class="tag-group-label">Selectable variants</span>
					<VariantGrid layout="row">
						<TagSelectable label="Default" variant="default" bind:pressed={filterActive} />
						<TagSelectable label="Outline" variant="outline" bind:pressed={filterPending} />
						<TagSelectable label="With Icon" variant="default" icon="i-lucide-star" bind:pressed={filterCompleted} />
						<TagSelectable label="Disabled" variant="default" disabled />
					</VariantGrid>
				</div>
			</div>
		</DemoCard>

		<!-- Avatar -->
		<DemoCard title="Avatar" description="User profile images with fallback">
			<VariantGrid layout="row">
				<Avatar size="sm" fallback="AB" />
				<Avatar size="md" fallback="CD" />
				<Avatar size="lg" fallback="EF" />
			</VariantGrid>
		</DemoCard>

		<!-- Kbd -->
		<DemoCard title="Keyboard Shortcut" description="Keyboard key indicators">
			<VariantGrid layout="row">
				<Kbd keys="Ctrl+C" />
				<Kbd keys="Ctrl+V" />
				<Kbd keys={['Cmd', 'Shift', 'P']} />
				<Kbd keys="Esc" size="sm" />
				<Kbd keys="Enter" size="lg" />
			</VariantGrid>
		</DemoCard>

		<!-- Progress -->
		<DemoCard title="Progress" description="Progress indicator bar">
			<div class="progress-demos">
				<div class="progress-row">
					<span class="progress-label">Default</span>
					<Progress value={progressValue} />
				</div>
				<div class="progress-row">
					<span class="progress-label">With label</span>
					<Progress value={progressValue} showLabel />
				</div>
				<div class="progress-row">
					<span class="progress-label">Success</span>
					<Progress value={100} variant="success" showLabel />
				</div>
				<div class="progress-row">
					<span class="progress-label">Indeterminate</span>
					<Progress />
				</div>
			</div>
		</DemoCard>

		<!-- Spinner -->
		<DemoCard title="Spinner" description="Loading indicator">
			<VariantGrid layout="row">
				<Spinner size="sm" />
				<Spinner size="md" />
				<Spinner size="lg" />
				<Spinner variant="muted" />
			</VariantGrid>
		</DemoCard>

		<!-- Skeleton -->
		<DemoCard title="Skeleton" description="Loading placeholders">
			<div class="skeleton-demo">
				<SkeletonCard />
				<div class="skeleton-text-demo">
					<SkeletonAvatar />
					<div class="skeleton-text-group">
						<SkeletonText width="60%" />
						<SkeletonText width="40%" />
					</div>
				</div>
			</div>
		</DemoCard>

		<!-- Scroll Area -->
		<DemoCard title="Scroll Area" description="Custom scrollbar overlay for scrollable content">
			<VariantGrid>
				<div class="scroll-area-demo">
					<span class="scroll-area-label">Vertical</span>
					<ScrollArea class="h-48 w-full rounded-md border border-border">
						<div class="scroll-area-content">
							{#each Array.from({ length: 30 }, (_, i) => i + 1) as item}
								<div class="scroll-area-item">Item {item}</div>
							{/each}
						</div>
					</ScrollArea>
				</div>
				<div class="scroll-area-demo">
					<span class="scroll-area-label">Horizontal</span>
					<ScrollArea orientation="horizontal" class="w-full rounded-md border border-border">
						<div class="scroll-area-content-h">
							{#each Array.from({ length: 20 }, (_, i) => i + 1) as item}
								<div class="scroll-area-chip">Tag {item}</div>
							{/each}
						</div>
					</ScrollArea>
				</div>
			</VariantGrid>
		</DemoCard>
	</div>
</section>

<style>
	.section {
		scroll-margin-top: 5rem;
		margin-bottom: var(--spacing-8);
	}

	.section-title {
		font-size: var(--text-fluid-2xl);
		font-weight: 700;
		margin: 0 0 var(--spacing-2) 0;
		color: var(--color-fg);
	}

	.section-description {
		margin: 0 0 var(--spacing-7) 0;
		font-size: var(--text-fluid-base);
		color: var(--color-muted);
		line-height: 1.6;
	}

	.demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
	}

	.progress-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.progress-row {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.progress-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.skeleton-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-6);
		width: 100%;
		max-width: 25rem;
	}

	.skeleton-text-demo {
		display: flex;
		gap: var(--spacing-4);
		align-items: center;
	}

	.skeleton-text-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.tag-demos {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
		width: 100%;
	}

	.tag-group {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.tag-group-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.tag-divider {
		border: none;
		border-top: 1px solid var(--color-border);
		margin: 0;
	}

	.tags-empty {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-style: italic;
	}

	.scroll-area-demo {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
		width: 100%;
	}

	.scroll-area-label {
		font-size: var(--text-fluid-sm);
		color: var(--color-muted);
		font-weight: 500;
	}

	.scroll-area-content {
		padding: var(--spacing-3);
	}

	.scroll-area-item {
		padding: var(--spacing-2) var(--spacing-3);
		border-bottom: 1px solid var(--color-border);
		font-size: var(--text-fluid-sm);
	}

	.scroll-area-item:last-child {
		border-bottom: none;
	}

	.scroll-area-content-h {
		display: flex;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		width: max-content;
	}

	.scroll-area-chip {
		flex-shrink: 0;
		padding: var(--spacing-1) var(--spacing-3);
		border-radius: 9999px;
		background: var(--color-muted);
		color: var(--color-bg);
		font-size: var(--text-fluid-sm);
		white-space: nowrap;
	}
</style>
