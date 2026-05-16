<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ErrorDisplay } from '$lib/components/composites';
import { Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
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
			<Button variant="default" onclick={() => location.reload()}>Try again</Button>
			<Button variant="outline" onclick={() => goto(localizeHref('/app/dashboard'))}>Back to dashboard</Button>
		{:else}
			<Button variant="default" onclick={() => goto(localizeHref('/app/dashboard'))}>Back to dashboard</Button>
			<Button variant="outline" onclick={() => goto(localizeHref('/'))}>Go home</Button>
		{/if}
	{/snippet}
</ErrorDisplay>
