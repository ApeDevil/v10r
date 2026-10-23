<script lang="ts">
/**
 * The offer of a stored form draft (`state/form-draft.svelte.ts`): restore it or discard it.
 * Never shown for a draft that equals the form, and never applied without a click.
 */
import { page } from '$app/state';
import { Alert } from '$lib/components/composites/alert';
import { Button } from '$lib/components/primitives';
import { formatRelative } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

interface Props {
	savedAt: number;
	onrestore: () => void;
	ondiscard: () => void;
}

let { savedAt, onrestore, ondiscard }: Props = $props();

const savedLabel = $derived(formatRelative(new Date(savedAt), page.data.locale));
</script>

<Alert variant="info" title={m.composites_draft_found_title()}>
	{#snippet children()}
		<p>{m.composites_draft_found_description({ saved: savedLabel })}</p>
		<div class="draft-actions">
			<Button size="sm" onclick={onrestore}>{m.composites_draft_restore()}</Button>
			<Button size="sm" variant="outline" onclick={ondiscard}>{m.composites_draft_discard()}</Button>
		</div>
	{/snippet}
</Alert>

<style>
	.draft-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-2);
		margin-top: var(--spacing-3);
	}
</style>
