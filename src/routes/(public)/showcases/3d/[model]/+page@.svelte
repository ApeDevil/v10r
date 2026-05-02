<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ViewerDialog } from '$lib/components/3d';
import { MODELS_BY_ID } from '$lib/config/models';
import { localizeHref } from '$lib/i18n';

const model = $derived(MODELS_BY_ID.get(page.params.model ?? ''));

let open = $state(true);

let redirected = false;
$effect(() => {
	if (!model && !redirected) {
		redirected = true;
		goto(localizeHref('/showcases/3d'));
	}
});
</script>
{#if model}
	<ViewerDialog {model} bind:open standalone />
{/if}
