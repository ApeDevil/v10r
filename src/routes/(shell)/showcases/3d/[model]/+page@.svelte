<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { MODELS_BY_ID } from '$lib/config/models';
	import { ViewerDialog } from '$lib/components/3d';

	const model = $derived(MODELS_BY_ID.get(page.params.model));

	let open = $state(true);

	let redirected = false;
	$effect(() => {
		if (!model && !redirected) {
			redirected = true;
			goto('/showcases/3d');
		}
	});
</script>

<svelte:head>
	<title>{model ? `${model.name} - 3D Viewer` : '3D Viewer'} - Velociraptor</title>
</svelte:head>

{#if model}
	<ViewerDialog {model} bind:open standalone />
{/if}
