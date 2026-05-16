<script lang="ts">
import type { ActionResult } from '@sveltejs/kit';
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import { BlogTag } from '$lib/components/blog';
import { Card, ConfirmDialog, EmptyState, FormField } from '$lib/components/composites';
import { Cluster, Stack } from '$lib/components/layout';
import {
	Badge,
	Body,
	Button,
	Cell,
	Dialog,
	Header,
	HeaderCell,
	Input,
	Row,
	Spinner,
	Table,
	Textarea,
} from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import { getToast } from '$lib/state/toast.svelte';

let { data }: PageProps = $props();
const toast = getToast();

let submitting = $state('');

// Tag editing modal
let showTagModal = $state(false);
let editTagId = $state('');
let editTagName = $state('');
let editTagNameDe = $state('');
let editTagNameRu = $state('');
let editTagSlug = $state('');
let editTagIcon = $state<string | null>(null);
let editTagColor = $state<number | null>(null);
let editTagGlyph = $state('');
let tagIconFilter = $state('');

let showDeleteDialog = $state(false);
let deleteTagId = $state('');
let deleteTagName = $state('');
let deletePostCount = $state(0);
let deleteTagFormEl: HTMLFormElement;

// Domain editing modal
let showDomainModal = $state(false);
let editDomainId = $state('');
let editDomainName = $state('');
let editDomainSlug = $state('');
let editDomainIcon = $state<string | null>(null);
let editDomainColor = $state<number | null>(null);
let editDomainDescription = $state('');
let iconFilter = $state('');

let showDeleteDomainDialog = $state(false);
let deleteDomainId = $state('');
let deleteDomainName = $state('');
let deleteDomainPostCount = $state(0);
let deleteDomainFormEl: HTMLFormElement;

const ICON_OPTIONS = [
	{ name: 'code', class: 'i-lucide-code' },
	{ name: 'terminal', class: 'i-lucide-terminal' },
	{ name: 'palette', class: 'i-lucide-palette' },
	{ name: 'brain', class: 'i-lucide-brain' },
	{ name: 'box', class: 'i-lucide-box' },
	{ name: 'users', class: 'i-lucide-users' },
	{ name: 'globe', class: 'i-lucide-globe' },
	{ name: 'layers', class: 'i-lucide-layers' },
	{ name: 'zap', class: 'i-lucide-zap' },
	{ name: 'database', class: 'i-lucide-database' },
	{ name: 'book', class: 'i-lucide-book-open' },
	{ name: 'microscope', class: 'i-lucide-microscope' },
	{ name: 'cloud', class: 'i-lucide-cloud' },
	{ name: 'rocket', class: 'i-lucide-rocket' },
	{ name: 'shield', class: 'i-lucide-shield' },
	{ name: 'briefcase', class: 'i-lucide-briefcase' },
	{ name: 'heart', class: 'i-lucide-heart' },
	{ name: 'camera', class: 'i-lucide-camera' },
	{ name: 'music', class: 'i-lucide-music' },
	{ name: 'pen-tool', class: 'i-lucide-pen-tool' },
	{ name: 'cpu', class: 'i-lucide-cpu' },
	{ name: 'wifi', class: 'i-lucide-wifi' },
	{ name: 'key', class: 'i-lucide-key' },
	{ name: 'flag', class: 'i-lucide-flag' },
	{ name: 'compass', class: 'i-lucide-compass' },
	{ name: 'lightbulb', class: 'i-lucide-lightbulb' },
	{ name: 'sparkles', class: 'i-lucide-sparkles' },
	{ name: 'flame', class: 'i-lucide-flame' },
	{ name: 'gem', class: 'i-lucide-gem' },
	{ name: 'trophy', class: 'i-lucide-trophy' },
	{ name: 'container', class: 'i-lucide-container' },
	{ name: 'server', class: 'i-lucide-server' },
	{ name: 'puzzle', class: 'i-lucide-puzzle' },
	{ name: 'wrench', class: 'i-lucide-wrench' },
	{ name: 'megaphone', class: 'i-lucide-megaphone' },
	{ name: 'beaker', class: 'i-lucide-flask-conical' },
];

const COLOR_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

const COLOR_NAMES: Record<number, string> = {
	1: 'Blue',
	2: 'Green',
	3: 'Orange',
	4: 'Purple',
	5: 'Red',
	6: 'Teal',
	7: 'Yellow',
	8: 'Pink',
};

const filteredIcons = $derived(
	iconFilter ? ICON_OPTIONS.filter((i) => i.name.includes(iconFilter.toLowerCase())) : ICON_OPTIONS,
);

const previewTag = $derived({
	slug: editDomainSlug || 'preview',
	name: editDomainName || 'Domain',
	icon: editDomainIcon,
	color: editDomainColor,
});

const filteredTagIcons = $derived(
	tagIconFilter ? ICON_OPTIONS.filter((i) => i.name.includes(tagIconFilter.toLowerCase())) : ICON_OPTIONS,
);

const previewCategoryTag = $derived({
	slug: editTagSlug || 'preview',
	name: editTagName || 'Category',
	icon: editTagIcon,
	color: editTagColor,
	glyph: editTagGlyph || null,
});

function openTagModal(t?: {
	id: string;
	name: string;
	slug: string;
	icon: string | null;
	color: number | null;
	glyph: string | null;
	nameI18n?: { de?: string; ru?: string };
}) {
	if (t) {
		editTagId = t.id;
		editTagName = t.name;
		editTagSlug = t.slug;
		editTagIcon = t.icon;
		editTagColor = t.color;
		editTagGlyph = t.glyph ?? '';
		editTagNameDe = t.nameI18n?.de ?? '';
		editTagNameRu = t.nameI18n?.ru ?? '';
	} else {
		editTagId = '';
		editTagName = '';
		editTagSlug = '';
		editTagIcon = null;
		editTagColor = null;
		editTagGlyph = '';
		editTagNameDe = '';
		editTagNameRu = '';
	}
	tagIconFilter = '';
	showTagModal = true;
}

function openDeleteDialog(tag: { id: string; name: string; postCount: number }) {
	deleteTagId = tag.id;
	deleteTagName = tag.name;
	deletePostCount = tag.postCount;
	showDeleteDialog = true;
}

function openDomainModal(d?: {
	id: string;
	name: string;
	slug: string;
	icon: string | null;
	color: number | null;
	description: string | null;
}) {
	if (d) {
		editDomainId = d.id;
		editDomainName = d.name;
		editDomainSlug = d.slug;
		editDomainIcon = d.icon;
		editDomainColor = d.color;
		editDomainDescription = d.description ?? '';
	} else {
		editDomainId = '';
		editDomainName = '';
		editDomainSlug = '';
		editDomainIcon = null;
		editDomainColor = null;
		editDomainDescription = '';
	}
	iconFilter = '';
	showDomainModal = true;
}

function openDeleteDomainDialog(d: { id: string; name: string; postCount: number }) {
	deleteDomainId = d.id;
	deleteDomainName = d.name;
	deleteDomainPostCount = d.postCount;
	showDeleteDomainDialog = true;
}

function handleDeleteEnhance() {
	submitting = 'deleteTag';
	return async ({
		result,
		update,
	}: {
		result: ActionResult;
		update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
	}) => {
		if (result.type === 'success' && result.data) {
			toast.success(result.data.message as string);
		} else if (result.type === 'failure') {
			toast.error((result.data?.message as string) || 'Failed to delete tag.');
		}
		submitting = '';
		return update({ reset: false });
	};
}

function handleDeleteDomainEnhance() {
	submitting = 'deleteDomain';
	return async ({
		result,
		update,
	}: {
		result: ActionResult;
		update: (opts?: { reset?: boolean; invalidateAll?: boolean }) => Promise<void>;
	}) => {
		if (result.type === 'success' && result.data) {
			toast.success(result.data.message as string);
		} else if (result.type === 'failure') {
			toast.error((result.data?.message as string) || 'Failed to delete domain.');
		}
		submitting = '';
		return update({ reset: false });
	};
}
</script>
<!-- Hidden delete forms with proper enhance -->
<form
	bind:this={deleteTagFormEl}
	method="POST"
	action="?/delete"
	use:enhance={handleDeleteEnhance}
	class="hidden"
>
	<input type="hidden" name="tagId" value={deleteTagId} />
</form>

<form
	bind:this={deleteDomainFormEl}
	method="POST"
	action="?/deleteDomain"
	use:enhance={handleDeleteDomainEnhance}
	class="hidden"
>
	<input type="hidden" name="domainId" value={deleteDomainId} />
</form>

<Stack gap="6">
	<!-- Domain Management -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_tags_domains_heading()}</h2>
				<Cluster gap="2">
					<Button variant="outline" size="sm" onclick={() => openDomainModal()}>
						<span class="i-lucide-plus h-4 w-4 mr-1"></span>
						{m.admin_tags_new_domain()}
					</Button>
					<Button variant="ghost" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						{m.admin_action_refresh()}
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		{#if data.domains.length === 0}
			<EmptyState
				icon="i-lucide-folder"
				title={m.admin_tags_domains_empty_title()}
				description={m.admin_tags_domains_empty_desc()}
			/>
		{:else}
			<Table>
				<Header>
					<Row hoverable={false}>
						<HeaderCell>{m.admin_tags_col_icon()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_name()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_slug()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_color()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_posts()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_actions()}</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each data.domains as d}
						<Row>
							<Cell>
								{#if d.icon}
									<span class="{d.icon} h-4 w-4 inline-block"></span>
								{:else}
									<span class="letter-icon">{d.name.charAt(0).toUpperCase()}</span>
								{/if}
							</Cell>
							<Cell>{d.name}</Cell>
							<Cell><code class="font-mono text-fluid-xs">{d.slug}</code></Cell>
							<Cell>
								{#if d.color}
									<span class="color-dot" style="background: var(--chart-{d.color})"></span>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</Cell>
							<Cell><Badge variant="secondary">{d.postCount}</Badge></Cell>
							<Cell>
								<Cluster gap="1">
									<Button variant="outline" size="sm" onclick={() => openDomainModal(d)}>{m.admin_action_edit()}</Button>
									<Button variant="ghost" size="sm" onclick={() => openDeleteDomainDialog(d)}>{m.admin_action_delete()}</Button>
								</Cluster>
							</Cell>
						</Row>
					{/each}
				</Body>
			</Table>
		{/if}
	</Card>

	<!-- Category Management -->
	<Card>
		{#snippet header()}
			<Cluster justify="between" align="center">
				<h2 class="text-fluid-lg font-semibold">{m.admin_tags_categories_heading()}</h2>
				<Cluster gap="2">
					<Button variant="outline" size="sm" onclick={() => openTagModal()}>
						<span class="i-lucide-plus h-4 w-4 mr-1"></span>
						{m.admin_tags_new_category()}
					</Button>
					<Button variant="ghost" size="sm" onclick={() => invalidateAll()}>
						<span class="i-lucide-refresh-cw h-4 w-4 mr-1"></span>
						{m.admin_action_refresh()}
					</Button>
				</Cluster>
			</Cluster>
		{/snippet}

		{#if data.tags.length === 0}
			<EmptyState
				icon="i-lucide-tag"
				title={m.admin_tags_categories_empty_title()}
				description={m.admin_tags_categories_empty_desc()}
			/>
		{:else}
			<Table>
				<Header>
					<Row hoverable={false}>
						<HeaderCell>{m.admin_tags_col_visual()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_name()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_slug()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_posts()}</HeaderCell>
						<HeaderCell>{m.admin_tags_col_actions()}</HeaderCell>
					</Row>
				</Header>
				<Body>
					{#each data.tags as t}
						<Row>
							<Cell>
								{#if t.icon}
									<span class="{t.icon} h-4 w-4 inline-block"></span>
								{:else if t.glyph}
									<span class="glyph-icon">{t.glyph}</span>
								{:else}
									<span class="letter-icon">{t.name.charAt(0).toUpperCase()}</span>
								{/if}
							</Cell>
							<Cell>{t.name}</Cell>
							<Cell><code class="font-mono text-fluid-xs">{t.slug}</code></Cell>
							<Cell><Badge variant="secondary">{t.postCount}</Badge></Cell>
							<Cell>
								<Cluster gap="1">
									<Button variant="outline" size="sm" onclick={() => openTagModal(t)}>{m.admin_action_edit()}</Button>
									<Button variant="ghost" size="sm" onclick={() => openDeleteDialog(t)}>{m.admin_action_delete()}</Button>
								</Cluster>
							</Cell>
						</Row>
					{/each}
				</Body>
			</Table>
		{/if}
	</Card>
</Stack>

<!-- Domain Edit/Create Dialog -->
<Dialog
	bind:open={showDomainModal}
	title={editDomainId ? m.admin_tags_dialog_edit_domain_title() : m.admin_tags_dialog_create_domain_title()}
	description={editDomainId ? m.admin_tags_dialog_edit_domain_desc({ name: editDomainName }) : m.admin_tags_dialog_create_domain_desc()}
	class="max-h-[85dvh] overflow-y-auto"
>
	<form
		method="POST"
		action={editDomainId ? '?/updateDomain' : '?/createDomain'}
		class="dialog-form"
		use:enhance={() => {
			submitting = 'domainModal';
			return async ({ result, update }) => {
				if (result.type === 'success' && result.data) {
					toast.success(result.data.message as string);
					showDomainModal = false;
				} else if (result.type === 'failure') {
					toast.error((result.data?.message as string) || 'Failed');
				}
				submitting = '';
				return update({ reset: false });
			};
		}}
	>
		{#if editDomainId}
			<input type="hidden" name="domainId" value={editDomainId} />
		{/if}

		<div class="dialog-fields">
			<FormField label={m.admin_tags_field_name_label()} id="domain-name" required>
				{#snippet children({ fieldId, describedBy })}
					<Input id={fieldId} name="name" bind:value={editDomainName} placeholder={m.admin_tags_field_name_domain_placeholder()} required aria-describedby={describedBy} />
				{/snippet}
			</FormField>

			<FormField label={m.admin_tags_field_slug_label()} id="domain-slug" required>
				{#snippet children({ fieldId, describedBy })}
					<Input id={fieldId} name="slug" bind:value={editDomainSlug} placeholder={m.admin_tags_field_slug_domain_placeholder()} required aria-describedby={describedBy} />
				{/snippet}
			</FormField>

			<!-- Live Preview -->
			<div class="preview-row">
				<BlogTag tag={previewTag} tier="domain" size="md" />
			</div>

			<!-- Icon Picker -->
			<fieldset class="flex flex-col gap-1">
				<legend class="text-fluid-sm font-medium text-fg mb-1">{m.admin_tags_legend_icon()}</legend>
				<input type="hidden" name="icon" value={editDomainIcon ?? ''} />
				<Input placeholder={m.admin_tags_filter_icons_placeholder()} bind:value={iconFilter} />
				<div class="icon-grid">
					<button
						type="button"
						class="icon-btn"
						class:selected={editDomainIcon === null}
						onclick={() => { editDomainIcon = null; }}
						aria-label={m.admin_tags_icon_clear_aria()}
						aria-pressed={editDomainIcon === null}
					>
						<span class="i-lucide-x h-4 w-4 op-40"></span>
					</button>
					{#each filteredIcons as icon}
						<button
							type="button"
							class="icon-btn"
							class:selected={editDomainIcon === icon.class}
							onclick={() => { editDomainIcon = icon.class; }}
							aria-label={icon.name}
							aria-pressed={editDomainIcon === icon.class}
						>
							<span class="{icon.class} h-4 w-4 inline-block"></span>
						</button>
					{/each}
				</div>
			</fieldset>

			<!-- Color Picker -->
			<fieldset class="flex flex-col gap-1">
				<legend class="text-fluid-sm font-medium text-fg mb-1">{m.admin_tags_legend_color()}</legend>
				<input type="hidden" name="color" value={editDomainColor ?? ''} />
				<div class="color-row">
					<button
						type="button"
						class="color-swatch none"
						class:selected={editDomainColor === null}
						onclick={() => { editDomainColor = null; }}
						aria-label={m.admin_tags_color_clear_aria()}
						aria-pressed={editDomainColor === null}
					>
						<span class="i-lucide-x h-3 w-3 op-40"></span>
					</button>
					{#each COLOR_OPTIONS as c}
						<button
							type="button"
							class="color-swatch"
							class:selected={editDomainColor === c}
							style="--swatch-color: var(--chart-{c})"
							onclick={() => { editDomainColor = c; }}
							aria-label={m.admin_tags_color_aria({ colorName: COLOR_NAMES[c], colorNum: String(c) })}
							aria-pressed={editDomainColor === c}
						></button>
					{/each}
				</div>
			</fieldset>

			<FormField label={m.admin_tags_field_desc_label()} id="domain-desc">
				{#snippet children({ fieldId, describedBy })}
					<Textarea
						id={fieldId}
						name="description"
						bind:value={editDomainDescription}
						placeholder={m.admin_tags_field_desc_placeholder()}
						rows={2}
						aria-describedby={describedBy}
					/>
				{/snippet}
			</FormField>
		</div>

		<div class="dialog-actions">
			<Button type="button" variant="outline" size="sm" onclick={() => { showDomainModal = false; }}>{m.admin_action_cancel()}</Button>
			<Button type="submit" variant="default" size="sm" disabled={submitting === 'domainModal'}>
				{#if submitting === 'domainModal'}<Spinner size="xs" class="mr-1" />{/if}
				{editDomainId ? m.admin_tags_btn_save_changes() : m.admin_tags_btn_create_domain()}
			</Button>
		</div>
	</form>
</Dialog>

<!-- Category Edit/Create Dialog -->
<Dialog
	bind:open={showTagModal}
	title={editTagId ? m.admin_tags_dialog_edit_category_title() : m.admin_tags_dialog_create_category_title()}
	description={editTagId ? m.admin_tags_dialog_edit_category_desc({ name: editTagName }) : m.admin_tags_dialog_create_category_desc()}
	class="max-h-[85dvh] overflow-y-auto"
>
	<form
		method="POST"
		action={editTagId ? '?/updateTag' : '?/create'}
		class="dialog-form"
		use:enhance={() => {
			submitting = 'tagModal';
			return async ({ result, update }) => {
				if (result.type === 'success' && result.data) {
					toast.success(result.data.message as string);
					showTagModal = false;
				} else if (result.type === 'failure') {
					toast.error((result.data?.message as string) || 'Failed');
				}
				submitting = '';
				return update({ reset: false });
			};
		}}
	>
		{#if editTagId}
			<input type="hidden" name="tagId" value={editTagId} />
		{/if}

		<div class="dialog-fields">
			<FormField label={m.admin_tags_field_name_label()} id="tag-name" required>
				{#snippet children({ fieldId, describedBy })}
					<Input id={fieldId} name="name" bind:value={editTagName} placeholder={m.admin_tags_field_name_category_placeholder()} required aria-describedby={describedBy} />
				{/snippet}
			</FormField>

			<FormField label={m.admin_tags_field_slug_label()} id="tag-slug" required>
				{#snippet children({ fieldId, describedBy })}
					<Input id={fieldId} name="slug" bind:value={editTagSlug} placeholder={m.admin_tags_field_slug_category_placeholder()} required aria-describedby={describedBy} />
				{/snippet}
			</FormField>

			{#if editTagId}
				<FormField label="DE" id="tag-name-de">
					{#snippet children({ fieldId, describedBy })}
						<Input id={fieldId} name="nameDe" bind:value={editTagNameDe} placeholder="Deutsche Übersetzung" aria-describedby={describedBy} />
					{/snippet}
				</FormField>

				<FormField label="RU" id="tag-name-ru">
					{#snippet children({ fieldId, describedBy })}
						<Input id={fieldId} name="nameRu" bind:value={editTagNameRu} placeholder="Русский перевод" aria-describedby={describedBy} />
					{/snippet}
				</FormField>
			{/if}

			<!-- Live Preview -->
			<div class="preview-row">
				<BlogTag tag={previewCategoryTag} tier="category" size="md" />
			</div>

			<FormField label={m.admin_tags_field_glyph_label()} id="tag-glyph">
				{#snippet children({ fieldId, describedBy })}
					<Input id={fieldId} name="glyph" bind:value={editTagGlyph} placeholder={m.admin_tags_field_glyph_placeholder()} maxlength={2} aria-describedby={describedBy} />
				{/snippet}
			</FormField>

			<!-- Icon Picker -->
			<fieldset class="flex flex-col gap-1">
				<legend class="text-fluid-sm font-medium text-fg mb-1">{m.admin_tags_legend_icon_overrides()}</legend>
				<input type="hidden" name="icon" value={editTagIcon ?? ''} />
				<Input placeholder={m.admin_tags_filter_icons_placeholder()} bind:value={tagIconFilter} />
				<div class="icon-grid">
					<button
						type="button"
						class="icon-btn"
						class:selected={editTagIcon === null}
						onclick={() => { editTagIcon = null; }}
						aria-label={m.admin_tags_icon_clear_aria()}
						aria-pressed={editTagIcon === null}
					>
						<span class="i-lucide-x h-4 w-4 op-40"></span>
					</button>
					{#each filteredTagIcons as icon}
						<button
							type="button"
							class="icon-btn"
							class:selected={editTagIcon === icon.class}
							onclick={() => { editTagIcon = icon.class; }}
							aria-label={icon.name}
							aria-pressed={editTagIcon === icon.class}
						>
							<span class="{icon.class} h-4 w-4 inline-block"></span>
						</button>
					{/each}
				</div>
			</fieldset>

			<!-- Color Picker -->
			<fieldset class="flex flex-col gap-1">
				<legend class="text-fluid-sm font-medium text-fg mb-1">{m.admin_tags_legend_color()}</legend>
				<input type="hidden" name="color" value={editTagColor ?? ''} />
				<div class="color-row">
					<button
						type="button"
						class="color-swatch none"
						class:selected={editTagColor === null}
						onclick={() => { editTagColor = null; }}
						aria-label={m.admin_tags_color_clear_aria()}
						aria-pressed={editTagColor === null}
					>
						<span class="i-lucide-x h-3 w-3 op-40"></span>
					</button>
					{#each COLOR_OPTIONS as c}
						<button
							type="button"
							class="color-swatch"
							class:selected={editTagColor === c}
							style="--swatch-color: var(--chart-{c})"
							onclick={() => { editTagColor = c; }}
							aria-label={m.admin_tags_color_aria({ colorName: COLOR_NAMES[c], colorNum: String(c) })}
							aria-pressed={editTagColor === c}
						></button>
					{/each}
				</div>
			</fieldset>
		</div>

		<div class="dialog-actions">
			<Button type="button" variant="outline" size="sm" onclick={() => { showTagModal = false; }}>{m.admin_action_cancel()}</Button>
			<Button type="submit" variant="default" size="sm" disabled={submitting === 'tagModal'}>
				{#if submitting === 'tagModal'}<Spinner size="xs" class="mr-1" />{/if}
				{editTagId ? m.admin_tags_btn_save_changes() : m.admin_tags_btn_create_category()}
			</Button>
		</div>
	</form>
</Dialog>

<ConfirmDialog
	open={showDeleteDialog}
	title={m.admin_tags_delete_tag_title()}
	description={m.admin_tags_delete_tag_desc({ name: deleteTagName, count: deletePostCount })}
	confirmLabel={m.admin_action_delete()}
	destructive
	onconfirm={() => { showDeleteDialog = false; deleteTagFormEl.requestSubmit(); }}
	oncancel={() => { showDeleteDialog = false; }}
/>

<ConfirmDialog
	open={showDeleteDomainDialog}
	title={m.admin_tags_delete_domain_title()}
	description={m.admin_tags_delete_domain_desc({ name: deleteDomainName, count: deleteDomainPostCount })}
	confirmLabel={m.admin_action_delete()}
	destructive
	onconfirm={() => { showDeleteDomainDialog = false; deleteDomainFormEl.requestSubmit(); }}
	oncancel={() => { showDeleteDomainDialog = false; }}
/>

<style>
	/* Dialog form structure (matches showcase pattern) */
	.dialog-form {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-4);
	}

	.dialog-fields {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.dialog-actions {
		display: flex;
		justify-content: flex-end;
		gap: var(--spacing-2);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
	}

	.glyph-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-size: 0.875rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.letter-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		font-family: ui-monospace, monospace;
		font-size: 0.75rem;
		font-weight: 600;
		color: var(--color-muted);
	}

	.color-dot {
		display: inline-block;
		width: 12px;
		height: 12px;
		border-radius: 50%;
	}

	.preview-row {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-3);
		background: var(--color-subtle);
		border-radius: var(--spacing-2);
	}

	/* Icon picker grid */
	.icon-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: var(--spacing-1);
		max-height: 160px;
		overflow-y: auto;
		margin-top: var(--spacing-1);
		mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
		-webkit-mask-image: linear-gradient(to bottom, black calc(100% - 24px), transparent);
	}

	.icon-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border: 1px solid transparent;
		border-radius: var(--spacing-1);
		background: transparent;
		color: var(--color-fg);
		cursor: pointer;
	}

	.icon-btn:hover {
		background: var(--color-subtle);
	}

	.icon-btn.selected {
		border-color: var(--color-primary);
		background: color-mix(in srgb, var(--color-primary) 10%, transparent);
	}

	/* Color picker swatches */
	.color-row {
		display: flex;
		gap: var(--spacing-2);
		align-items: center;
		flex-wrap: wrap;
	}

	.color-swatch {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		border: 2px solid transparent;
		background: var(--swatch-color);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.color-swatch.none {
		background: var(--color-subtle);
		border-color: var(--color-border);
	}

	.color-swatch.selected {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}
</style>
