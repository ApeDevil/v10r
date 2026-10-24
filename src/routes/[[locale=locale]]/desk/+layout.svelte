<script lang="ts">
import { untrack } from 'svelte';
import { apiFetch } from '#lib/api.ts';
import { AppShell } from '#lib/components/shell/index.ts';
import { getToast } from '#lib/state/toast.svelte.ts';
import type { LayoutProps } from './$types';

let { children, data }: LayoutProps = $props();

const toast = getToast();

// Single-fire Toast on the first real /desk visit after a grant. The layout load only
// READS pending notifications — it also runs on link-hover preload, so it must not
// consume them. Acknowledging happens here, after the Toast was shown: only a visit
// that mounted this layout marks the notification seen. `shown` keeps a load re-run
// (form action, invalidate) that lands before the acknowledgement from toasting twice;
// a failed acknowledgement just shows the Toast again on the next visit.
const shown = new Set<string>();

$effect(() => {
	const fresh = data.justGrantedKinds.filter((kind) => !shown.has(kind));
	if (fresh.length === 0) return;
	untrack(() => {
		for (const kind of fresh) {
			shown.add(kind);
			if (kind === 'blog-author') {
				toast?.success('You now have blog-author access. Open the editor to start writing.', 8000);
			}
		}
		void apiFetch('/api/grant-notifications/acknowledge', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ kinds: fresh }),
		}).catch(() => {});
	});
});
</script>

<AppShell session={data.session} immersive announcements={data.announcements}>
	{@render children()}
</AppShell>
