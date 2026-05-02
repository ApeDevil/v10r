<script lang="ts">
import { ToastContainer } from '$lib/components/shell';

let { children } = $props();
</script>

{@render children?.()}

<ToastContainer />
