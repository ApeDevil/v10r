<script lang="ts">
	import { NavSection } from '$lib/components/composites';
	import LedgerSection from './_sections/LedgerSection.svelte';
	import ManifestSection from './_sections/ManifestSection.svelte';
	import SpecimenSection from './_sections/SpecimenSection.svelte';
	import ObservatorySection from './_sections/ObservatorySection.svelte';
	import FolioSection from './_sections/FolioSection.svelte';
	import CartographSection from './_sections/CartographSection.svelte';

	const sections = [
		{ id: 'tbl-ledger', label: 'Ledger' },
		{ id: 'tbl-manifest', label: 'Manifest' },
		{ id: 'tbl-specimen', label: 'Specimen' },
		{ id: 'tbl-observatory', label: 'Observatory' },
		{ id: 'tbl-folio', label: 'Folio' },
		{ id: 'tbl-cartograph', label: 'Cartograph' }
	];
</script>

<svelte:head>
	<title>Tables - UI Showcase - Velociraptor</title>
</svelte:head>

<NavSection {sections} />

<main class="content">
	<LedgerSection />
	<ManifestSection />
	<SpecimenSection />
	<ObservatorySection />
	<FolioSection />
	<CartographSection />
</main>
