<script lang="ts">
import { ConfirmDialog } from '#lib/components/composites/index.ts';
import { Button } from '#lib/components/index.ts';
import { formatDate } from '#lib/i18n/index.ts';
import * as m from '#lib/paraglide/messages.js';
import { baseLocale, extractLocaleFromUrl } from '#lib/paraglide/runtime.js';
import { page } from '$app/state';
import { useArchitectureStudio } from '../_state/architecture-studio.svelte.ts';

const studio = useArchitectureStudio();

const locale = $derived(extractLocaleFromUrl(page.url.href) ?? baseLocale);
let importInput: HTMLInputElement | undefined = $state();
let pendingDelete = $state<string | null>(null);

function exportFile() {
	const url = URL.createObjectURL(new Blob([studio.exportText()], { type: 'application/json' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = `${studio.model.id}.architecture.json`;
	link.click();
	URL.revokeObjectURL(url);
}

async function importFile(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;
	studio.importText(await file.text());
}
</script>

<section class="panel" aria-labelledby="drafts-title">
	<h3 id="drafts-title">{m.studio_drafts_title()}</h3>
	<p class="hint">{m.studio_drafts_local_only()}</p>
	<div class="row">
		<Button size="sm" variant="primary" onclick={() => studio.save()}>
			<span class="i-lucide-save mr-2" aria-hidden="true"></span>{m.studio_drafts_save()}
		</Button>
		<Button size="sm" variant="outline" onclick={() => studio.newModel()}>
			<span class="i-lucide-plus mr-2" aria-hidden="true"></span>{m.studio_drafts_new()}
		</Button>
	</div>
	<div class="row">
		<Button size="sm" variant="outline" onclick={exportFile}>
			<span class="i-lucide-download mr-2" aria-hidden="true"></span>{m.studio_drafts_export()}
		</Button>
		<Button size="sm" variant="outline" onclick={() => importInput?.click()}>
			<span class="i-lucide-upload mr-2" aria-hidden="true"></span>{m.studio_drafts_import()}
		</Button>
		<!-- Hidden: the Button above opens it (the compose showcase's pattern; there is no file-input component). -->
		<input
			bind:this={importInput}
			type="file"
			accept="application/json,.json"
			class="sr-only"
			tabindex="-1"
			aria-hidden="true"
			onchange={importFile}
		/>
	</div>

	{#if studio.hydrated && studio.drafts.length > 0}
		<ul class="drafts">
			{#each studio.drafts as draft (draft.id)}
				<li class:current={draft.id === studio.model.id}>
					<div class="draft-text">
						<span class="draft-name">{draft.name}</span>
						<span class="hint">{formatDate(new Date(draft.savedAt), locale, { dateStyle: 'medium', timeStyle: 'short' })}{draft.derived_from ? ` · ${m.studio_design_variant_of({ id: draft.derived_from })}` : ''}</span>
					</div>
					<div class="row">
						<Button size="sm" variant="ghost" onclick={() => studio.open(draft.id)} aria-label={m.studio_drafts_open_named({ name: draft.name })}>
							{m.studio_drafts_open()}
						</Button>
						<Button size="sm" variant="ghost" onclick={() => (pendingDelete = draft.id)} aria-label={m.studio_drafts_delete_named({ name: draft.name })}>
							<span class="i-lucide-trash-2" aria-hidden="true"></span>
						</Button>
					</div>
				</li>
			{/each}
		</ul>
	{:else if studio.hydrated}
		<p class="hint">{m.studio_drafts_none()}</p>
	{/if}

	<Button size="sm" variant="ghost" onclick={() => studio.loadEvolutionExample()}>
		<span class="i-lucide-git-compare-arrows mr-2" aria-hidden="true"></span>{m.studio_drafts_load_example()}
	</Button>
</section>

<ConfirmDialog
	open={pendingDelete !== null}
	title={m.studio_drafts_delete_title()}
	description={m.studio_drafts_delete_description()}
	confirmLabel={m.studio_drafts_delete_confirm()}
	destructive
	onconfirm={() => {
		if (pendingDelete) studio.deleteDraft(pendingDelete);
		pendingDelete = null;
	}}
	oncancel={() => (pendingDelete = null)}
/>

<style>
	.panel {
		border: 1px solid var(--color-border);
		border-radius: var(--radius-md);
		padding: var(--spacing-4);
		background: var(--surface-1);
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	h3 {
		font-size: var(--text-fluid-base);
		font-weight: 600;
		margin: 0;
	}

	.hint {
		margin: 0;
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}

	.row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		align-items: center;
	}

	.drafts {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-2);
	}

	.drafts li {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: var(--spacing-2);
		padding: var(--spacing-1) var(--spacing-2);
		border-radius: var(--radius-sm);
	}

	.drafts li.current {
		outline: 1px solid var(--color-primary);
	}

	.draft-text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}

	.draft-name {
		font-weight: 600;
		overflow-wrap: anywhere;
	}
</style>
