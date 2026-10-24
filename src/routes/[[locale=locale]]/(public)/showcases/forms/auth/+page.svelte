<script lang="ts">
import { NavSection } from '#lib/components/composites/index.ts';
import * as m from '#lib/paraglide/messages.js';
import CipherSection from './_sections/CipherSection.svelte';
import GatewaySection from './_sections/GatewaySection.svelte';
import InsigniaSection from './_sections/InsigniaSection.svelte';
import StrongholdSection from './_sections/StrongholdSection.svelte';

const sections = $derived([
	{ id: 'auth-gateway', label: m.showcase_forms_auth_section_gateway() },
	{ id: 'auth-cipher', label: m.showcase_forms_auth_section_cipher() },
	{ id: 'auth-stronghold', label: m.showcase_forms_auth_section_stronghold() },
	{ id: 'auth-insignia', label: m.showcase_forms_auth_section_insignia() },
]);
</script>
<NavSection {sections} />

<main class="content">
	<GatewaySection />
	<CipherSection />
	<StrongholdSection />
	<InsigniaSection />
</main>
