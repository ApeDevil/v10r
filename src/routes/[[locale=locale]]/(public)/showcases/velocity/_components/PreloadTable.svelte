<script lang="ts">
import { Stack } from '$lib/components/layout';
import { type PreloadIntent, preloadAttributes } from '$lib/nav';
import * as m from '$lib/paraglide/messages';

/** Every level, with the attributes it actually produces — read off the module, not retyped. */
const INTENTS: Array<{ intent: PreloadIntent; use: string }> = [
	{ intent: 'none', use: m.showcase_velocity_preload_use_none() },
	{ intent: 'code', use: m.showcase_velocity_preload_use_code() },
	{ intent: 'data', use: m.showcase_velocity_preload_use_data() },
	{ intent: 'code-data', use: m.showcase_velocity_preload_use_codedata() },
	{ intent: 'idle', use: m.showcase_velocity_preload_use_idle() },
];

const rows = INTENTS.map(({ intent, use }) => {
	const attrs = preloadAttributes(intent);
	return {
		intent,
		use,
		data: attrs['data-sveltekit-preload-data'],
		code: attrs['data-sveltekit-preload-code'],
	};
});
</script>

<Stack gap="3">
	<div class="table-scroll">
		<table class="data-table">
			<thead>
				<tr>
					<th scope="col">{m.showcase_velocity_preload_col_intent()}</th>
					<th scope="col">{m.showcase_velocity_preload_col_code()}</th>
					<th scope="col">{m.showcase_velocity_preload_col_data()}</th>
					<th scope="col">{m.showcase_velocity_preload_col_use()}</th>
				</tr>
			</thead>
			<tbody>
				{#each rows as row (row.intent)}
					<tr>
						<th scope="row"><code>{row.intent}</code></th>
						<td><code>{row.code}</code></td>
						<td><code>{row.data}</code></td>
						<td class="use">{row.use}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<p class="text-muted text-fluid-sm">{m.showcase_velocity_preload_note()}</p>
</Stack>

<style>
.table-scroll {
	overflow-x: auto;
	max-width: 100%;
}

.data-table {
	width: 100%;
	border-collapse: collapse;
	font-size: var(--text-fluid-sm);
}

.data-table th,
.data-table td {
	padding: var(--spacing-2);
	text-align: left;
	border-bottom: 1px solid var(--color-border);
	font-weight: 400;
	white-space: nowrap;
}

.data-table thead th {
	font-size: var(--text-fluid-xs);
	color: var(--color-muted);
}

.data-table code {
	font-family: ui-monospace, monospace;
	font-size: var(--text-fluid-xs);
}

.data-table .use {
	white-space: normal;
	min-width: 20ch;
}
</style>
