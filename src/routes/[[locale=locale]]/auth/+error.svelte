<script lang="ts">
import { goto } from '$app/navigation';
import { page } from '$app/state';
import { ErrorDisplay } from '$lib/components/composites';
import { Button } from '$lib/components/primitives';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
</script>

<svelte:head>
	<title>{page.status} — {m.auth_error_title()}</title>
</svelte:head>

<ErrorDisplay
	status={page.status}
	message={page.error?.message}
	errorId={page.error?.errorId}
	context="auth"
>
	{#snippet actions()}
		{#if page.status >= 500}
			<Button variant="default" onclick={() => location.reload()}>{m.auth_error_try_again()}</Button>
			<Button variant="outline" onclick={() => goto(localizeHref('/auth/login'))}>{m.auth_back_to_sign_in()}</Button>
		{:else}
			<Button variant="default" onclick={() => goto(localizeHref('/auth/login'))}>{m.auth_back_to_sign_in()}</Button>
			<Button variant="outline" onclick={() => goto(localizeHref('/'))}>{m.auth_error_go_home()}</Button>
		{/if}
	{/snippet}
</ErrorDisplay>
