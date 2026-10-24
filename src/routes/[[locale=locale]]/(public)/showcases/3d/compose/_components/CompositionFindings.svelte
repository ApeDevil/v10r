<script lang="ts">
import * as m from '#lib/paraglide/messages.js';
import {
	type PortStandardRegistry,
	type ProductComposition,
	portNetworks,
	validateComposition,
} from '#lib/product-composition/index.ts';
import { diagnosticText } from './diagnostic-copy';

interface Props {
	composition: ProductComposition;
	registry: PortStandardRegistry;
}

let { composition, registry }: Props = $props();

const findings = $derived(validateComposition(composition, registry));
const problems = $derived(findings.filter((finding) => finding.severity !== 'info'));
const openPorts = $derived(findings.filter((finding) => finding.code === 'port.open'));
const networks = $derived(portNetworks(composition));
/** `ports/tank-1#spare-out` → `tank-1 · spare-out`. */
const portName = (subject: string) => subject.replace(/^ports\//, '').replace('#', ' · ');
const SMALL_NETWORK = 3;
</script>

<section aria-labelledby="compose-findings-heading" data-testid="composition-findings">
	<h2 id="compose-findings-heading">{m.showcase_3d_compose_findings_heading()}</h2>
	{#if problems.length === 0}
		<p class="quiet">{m.showcase_3d_compose_findings_none()}</p>
	{:else}
		<ul class="list">
			{#each problems as finding (`${finding.code} ${finding.subject}`)}
				<li class="problem" data-severity={finding.severity}>
					<span
						><strong
							>{finding.severity === 'error'
								? m.showcase_3d_compose_severity_error()
								: m.showcase_3d_compose_severity_warning()}:</strong
						>
						{diagnosticText(finding)}</span
					>
					<code>{finding.subject}</code>
				</li>
			{/each}
		</ul>
	{/if}
	{#if openPorts.length > 0}
		<details>
			<summary>{m.showcase_3d_compose_findings_open({ count: openPorts.length })}</summary>
			<ul class="list">
				{#each openPorts as finding (finding.subject)}
					<li><code>{portName(finding.subject)}</code></li>
				{/each}
			</ul>
		</details>
	{/if}
</section>

<section aria-labelledby="compose-networks-heading" data-testid="composition-networks">
	<h2 id="compose-networks-heading">{m.showcase_3d_compose_networks_heading()}</h2>
	<ul class="list">
		{#each networks as network (network.id)}
			<li>
				<span>
					{network.standards.map((id) => registry.get(id)?.label ?? id).join(', ')}
					<!-- A small network is clearer by its ports than by a count. -->
					{#if network.ports.length <= SMALL_NETWORK}<code>{network.ports.map(portName).join(' ↔ ')}</code>{/if}
				</span>
				<span class="quiet"
					>{m.showcase_3d_compose_network_summary({ ports: network.ports.length, open: network.openPorts.length })}</span
				>
			</li>
		{/each}
	</ul>
</section>

<style>
	h2 {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-base);
	}

	.list {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
		font-size: var(--text-fluid-sm);
	}

	.list li {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		gap: var(--spacing-2);
	}

	.problem {
		border-inline-start: 3px solid var(--color-error);
		padding-inline-start: var(--spacing-2);
	}

	.problem[data-severity='warning'] {
		border-inline-start-color: var(--color-warning);
	}

	.quiet,
	code {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	details {
		margin-top: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}
</style>
