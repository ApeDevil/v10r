<script lang="ts">
import LogoFooter from '$lib/components/branding/LogoFooter.svelte';
import { localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';
import { getConsent } from '$lib/state/consent.svelte';

const currentYear = new Date().getFullYear();
const consent = getConsent();
</script>

<footer class="mt-auto py-8 px-4 border-t border-border bg-bg">
	<div class="max-w-[80rem] mx-auto flex flex-col gap-4 items-center text-center md:flex-row md:justify-between md:text-left">
		<div class="flex items-center gap-3">
			<LogoFooter />
			<p class="text-muted text-sm m-0">
				{m.footer_copyright({ year: String(currentYear) })}
			</p>
		</div>
		<nav class="flex gap-4 flex-wrap items-center justify-center md:justify-end">
			<a href={localizeHref('/credits')} class="text-muted text-sm no-underline transition-colors duration-fast hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">{m.footer_credits()}</a>
			<!-- Label stays "Impressum" in every locale: § 5 DDG requires the page be
			     *leicht erkennbar*, and German case law has been unkind to creative
			     labels. "Impressum" and "Kontakt" are the safe ones. -->
			<a href={localizeHref('/impressum')} class="text-muted text-sm no-underline transition-colors duration-fast hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Impressum</a>
			<button onclick={() => consent.reopenBanner()} class="text-muted text-sm cursor-pointer bg-transparent border-none p-0 transition-colors duration-fast hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm">Cookie preferences</button>
			<span class="hidden md:inline-block w-px h-4 bg-border" aria-hidden="true"></span>
			<a
				href="https://github.com/ApeDevil/v10r"
				target="_blank"
				rel="noopener noreferrer"
				aria-label={m.footer_source_github_aria()}
				class="inline-flex items-center gap-1.5 text-muted text-sm no-underline transition-colors duration-fast hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm"
			>
				<span class="i-lucide-github text-base" aria-hidden="true"></span>
				<span>GitHub</span>
			</a>
			<a
				href="https://gitlab.com/ApeDevil/v10r"
				target="_blank"
				rel="noopener noreferrer"
				aria-label={m.footer_source_gitlab_aria()}
				class="inline-flex items-center gap-1.5 text-muted text-sm no-underline transition-colors duration-fast hover:text-primary focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-2 focus-visible:rounded-sm"
			>
				<span class="i-lucide-gitlab text-base" aria-hidden="true"></span>
				<span>GitLab</span>
			</a>
		</nav>
	</div>
</footer>
