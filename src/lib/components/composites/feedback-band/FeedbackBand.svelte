<script lang="ts">
/**
 * FeedbackBand — self-gating pre-footer band that prompts for feedback.
 * Mounted once in the (public) layout; renders nothing unless the current
 * route is a showcase or docs page (see `isFeedbackBandPath`). The CTA links
 * to /feedback with the current path pre-filled via `?from=`.
 */
import { page } from '$app/state';
import { PageContainer } from '$lib/components/layout';
import { Button } from '$lib/components/primitives';
import { isFeedbackBandPath } from '$lib/feedback/source';
import { deLocalizeHref, localizeHref } from '$lib/i18n';
import * as m from '$lib/paraglide/messages';

const pathname = $derived(deLocalizeHref(page.url.pathname));
const visible = $derived(isFeedbackBandPath(pathname));
const feedbackHref = $derived(localizeHref(`/feedback?from=${encodeURIComponent(pathname)}`));
</script>

{#if visible}
	<div class="border-t border-border bg-subtle">
		<PageContainer width="content" class="py-7 flex flex-col items-center text-center gap-3">
			<p class="m-0 text-fluid-sm text-muted">{m.feedback_band_prompt()}</p>
			<Button href={feedbackHref} variant="outline" size="sm">
				<span class="i-lucide-message-square mr-2 text-icon-sm" aria-hidden="true"></span>
				{m.feedback_band_cta()}
			</Button>
		</PageContainer>
	</div>
{/if}
