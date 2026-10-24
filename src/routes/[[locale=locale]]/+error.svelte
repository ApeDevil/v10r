<script lang="ts">
import { ErrorDisplay } from '#lib/components/composites/index.ts';
import { page } from '$app/state';
</script>

<svelte:head>
	<title>{page.status} — Error</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
/>
