<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { ErrorDisplay } from '$lib/components/composites';
	import { Button } from '$lib/components/primitives';
</script>

<svelte:head>
	<title>{page.status} — Error</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
	context="app"
>
	{#snippet actions()}
		{#if page.status >= 500}
			<Button onclick={() => location.reload()}>Try again</Button>
			<Button variant="ghost" onclick={() => goto('/app/dashboard')}>Back to dashboard</Button>
		{:else}
			<Button onclick={() => goto('/app/dashboard')}>Back to dashboard</Button>
			<Button variant="ghost" onclick={() => goto('/')}>Go home</Button>
		{/if}
	{/snippet}
</ErrorDisplay>
