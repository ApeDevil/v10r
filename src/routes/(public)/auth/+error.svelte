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
	context="auth"
>
	{#snippet actions()}
		{#if page.status >= 500}
			<Button variant="default" onclick={() => location.reload()}>Try again</Button>
			<Button variant="outline" onclick={() => goto('/auth/login')}>Back to sign in</Button>
		{:else}
			<Button variant="default" onclick={() => goto('/auth/login')}>Back to sign in</Button>
			<Button variant="outline" onclick={() => goto('/')}>Go home</Button>
		{/if}
	{/snippet}
</ErrorDisplay>
