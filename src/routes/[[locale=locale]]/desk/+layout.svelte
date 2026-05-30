<script lang="ts">
import { AppShell } from '$lib/components/shell';
import { getToast } from '$lib/state/toast.svelte';

let { children, data } = $props();

const toast = getToast();

// Single-fire Toast on first /desk visit after a grant. The flag is cleared
// server-side in consumePendingGrantNotifications() so subsequent loads do
// nothing. justGrantedKinds is populated only when there's something to show.
$effect(() => {
	if (data.justGrantedKinds && data.justGrantedKinds.length > 0) {
		for (const kind of data.justGrantedKinds) {
			if (kind === 'blog-author') {
				toast?.success('You now have blog-author access. Open the editor to start writing.', 8000);
			}
		}
	}
});
</script>

<AppShell session={data.session} immersive announcements={data.announcements}>
	{@render children()}
</AppShell>
