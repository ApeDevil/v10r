<script lang="ts">
import { localizeHref } from '$lib/i18n';
import { getConsent } from '$lib/state/consent.svelte';

const currentYear = new Date().getFullYear();
const consent = getConsent();
</script>

<footer class="mt-auto py-8 px-4 border-t border-border bg-surface-0">
	<div class="max-w-[80rem] mx-auto flex flex-col gap-4 items-center text-center md:flex-row md:justify-between md:text-left">
		<p class="text-muted text-sm m-0">
			© {currentYear} Velociraptor. Built with SvelteKit.
		</p>
		<nav class="flex gap-6 flex-wrap">
			<a href={localizeHref('/about')} class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">About</a>
			<a href={localizeHref('/privacy')} class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Privacy</a>
			<a href={localizeHref('/terms')} class="text-muted text-sm no-underline transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Terms</a>
			<button onclick={() => consent.reopenBanner()} class="text-muted text-sm cursor-pointer bg-transparent border-none p-0 transition-colors duration-fast hover:text-fg focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Cookie preferences</button>
		</nav>
	</div>
</footer>
