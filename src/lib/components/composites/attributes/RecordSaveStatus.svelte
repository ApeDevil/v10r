<script lang="ts">
import { Button } from '#lib/components/primitives/index.ts';
import * as m from '#lib/paraglide/messages.js';
import type { RecordSession } from './record-session.svelte.ts';

/**
 * Where a record's save stands, and the only ways out of a conflict: merge by attribute,
 * download this editor's copy, or discard it and reload. Nothing here overwrites newer
 * stored work, and nothing discards local work without the user pressing a button.
 */
interface Props {
	session: RecordSession;
	snapshot: RecordSession['autosave']['snapshot'];
	/** File name stem for the downloaded copy. */
	downloadName: string;
}

let { session, snapshot, downloadName }: Props = $props();
let merging = $state(false);

function download() {
	const url = URL.createObjectURL(
		new Blob([JSON.stringify(session.autosave.draft, null, 2)], { type: 'application/json' }),
	);
	const link = document.createElement('a');
	link.href = url;
	link.download = `${downloadName}-draft.json`;
	link.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function merge() {
	merging = true;
	try {
		await session.merge();
	} finally {
		merging = false;
	}
}
</script>

<div class="record-save-status text-fluid-xs" role="status">
	{#if snapshot.conflict}
		<span>{m.attributes_save_conflict()}</span>
		{#if snapshot.canRebase}
			<Button size="sm" variant="primary" disabled={merging} onclick={merge}>{m.attributes_save_merge()}</Button>
		{/if}
		<Button size="sm" variant="outline" onclick={download}>{m.attributes_save_download()}</Button>
		<Button size="sm" variant="outline" onclick={() => session.autosave.discardAndReload()}>
			{m.attributes_save_discard_reload()}
		</Button>
	{:else if snapshot.error}
		<span>{m.attributes_save_failed()}</span>
		<Button size="sm" variant="outline" onclick={() => session.autosave.flush()}>{m.attributes_save_retry()}</Button>
	{:else if snapshot.saving}
		<span>{m.attributes_save_saving()}</span>
	{:else}
		<span>{snapshot.unsaved ? m.attributes_save_unsaved() : m.attributes_save_saved()}</span>
	{/if}
	{#if session.mergeConflicts && session.mergeConflicts.length > 0}
		<span>{m.attributes_save_merged_clashes({ count: session.mergeConflicts.length })}</span>
	{/if}
	{#if snapshot.backupFailed}
		<span>{m.attributes_save_backup_failed()}</span>
		<Button size="sm" variant="outline" onclick={download}>{m.attributes_save_download()}</Button>
	{/if}
</div>
{#if !snapshot.unsaved && !snapshot.saving && snapshot.recovery.length > 0}
	<div class="record-save-status text-fluid-xs">
		<span>{m.attributes_save_recoverable()}</span>
		{#each snapshot.recovery as draft (draft.key)}
			<Button size="sm" variant="outline" onclick={() => session.autosave.recover(draft)}>
				{m.attributes_save_recover({ time: new Date(draft.updatedAt).toLocaleString() })}
			</Button>
			<Button size="sm" variant="ghost" onclick={() => session.autosave.dismiss(draft)}>{m.attributes_save_dismiss()}</Button>
		{/each}
	</div>
{/if}

<style>
	.record-save-status {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
		color: var(--color-muted);
	}
</style>
