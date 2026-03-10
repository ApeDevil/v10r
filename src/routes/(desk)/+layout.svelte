<script lang="ts">
import { AppShell } from '$lib/components/shell';

let { children, data } = $props();
</script>

<AppShell session={data.session} immersive>
	{@render children()}
</AppShell>
