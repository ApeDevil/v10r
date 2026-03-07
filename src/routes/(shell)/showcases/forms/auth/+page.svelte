<script lang="ts">
	import { NavSection } from '$lib/components/composites';
	import GatewaySection from './_sections/GatewaySection.svelte';
	import CipherSection from './_sections/CipherSection.svelte';
	import StrongholdSection from './_sections/StrongholdSection.svelte';
	import InsigniaSection from './_sections/InsigniaSection.svelte';

	const sections = [
		{ id: 'auth-gateway', label: 'Gateway' },
		{ id: 'auth-cipher', label: 'Cipher' },
		{ id: 'auth-stronghold', label: 'Stronghold' },
		{ id: 'auth-insignia', label: 'Insignia' }
	];
</script>

<svelte:head>
	<title>Auth - Forms - Showcases - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<GatewaySection />
	<CipherSection />
	<StrongholdSection />
	<InsigniaSection />
</main>
