<script lang="ts">
import { page } from '$app/state';
import { ErrorDisplay } from '$lib/components/composites';
</script>

<svelte:head>
	<title>{page.status} — Error</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
/>
