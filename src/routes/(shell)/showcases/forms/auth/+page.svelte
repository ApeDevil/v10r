<script lang="ts">
import { NavSection } from '$lib/components/composites';
import CipherSection from './_sections/CipherSection.svelte';
import GatewaySection from './_sections/GatewaySection.svelte';
import InsigniaSection from './_sections/InsigniaSection.svelte';
import StrongholdSection from './_sections/StrongholdSection.svelte';

const sections = [
	{ id: 'auth-gateway', label: 'Gateway' },
	{ id: 'auth-cipher', label: 'Cipher' },
	{ id: 'auth-stronghold', label: 'Stronghold' },
	{ id: 'auth-insignia', label: 'Insignia' },
];
</script>
<NavSection {sections} />

<main class="content">
	<GatewaySection />
	<CipherSection />
	<StrongholdSection />
	<InsigniaSection />
</main>
