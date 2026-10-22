<script lang="ts">
import { tick } from 'svelte';
import {
	CompositionCanvas,
	type CompositionEditor,
	type CompositionSelection,
	type GizmoHandlers,
} from '$lib/components/3d/composition';
import { Button, Select, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import {
	type CompositionDiagnostic,
	conduitPolyline,
	connect,
	disconnect,
	insertWaypoint,
	moveOccurrence,
	type OperationResult,
	type PortRef,
	type PortStandard,
	portUse,
	removeOccurrence,
	removeWaypoint,
	resolvePort,
	rotateOccurrence,
	setConduitWaypoints,
	type Vec3,
} from '$lib/product-composition';
import CompositionFindings from './CompositionFindings.svelte';
import { diagnosticText } from './diagnostic-copy';

interface Props {
	/** Owned by the page, one per catalogue, so switching catalogues keeps each one's work and undo. */
	editor: CompositionEditor;
	standards: readonly PortStandard[];
}

let { editor, standards }: Props = $props();

const registry = $derived(editor.registry);
let frameRequest = $state(0);
let importInput = $state<HTMLInputElement>();
let inspectorHeading = $state<HTMLHeadingElement>();

const NUDGE = 0.05;
const DIRECTIONS: { label: string; axis: 0 | 1 | 2; sign: 1 | -1 }[] = [
	{ label: '−X', axis: 0, sign: -1 },
	{ label: '+X', axis: 0, sign: 1 },
	{ label: '−Y', axis: 1, sign: -1 },
	{ label: '+Y', axis: 1, sign: 1 },
	{ label: '−Z', axis: 2, sign: -1 },
	{ label: '+Z', axis: 2, sign: 1 },
];
/** Positive is anticlockwise seen from above (a right-handed turn about +Y). */
const TURNS = [-90, -15, 15, 90];

// ── Announcements ─────────────────────────────────────────────────────────────

/** What the status region says: the last success or refusal. Cleared first, so a repeat is read again. */
let message = $state('');
async function say(text: string) {
	message = '';
	await tick();
	message = text;
}
const refusal = (diagnostics: CompositionDiagnostic[]) =>
	m.showcase_3d_compose_notice_refused({ reasons: diagnostics.map(diagnosticText).join(' ') });

/** Apply an operation; say the refusal, or `success` when it applied. */
function run(result: OperationResult, success?: string): boolean {
	if (!editor.apply(result)) {
		void say(refusal(editor.notice));
		return false;
	}
	if (success) void say(success);
	return true;
}

/** Actions that replace or remove the control the user pressed hand focus to the inspector heading. */
async function focusInspector() {
	await tick();
	inspectorHeading?.focus();
}

// ── Labels ────────────────────────────────────────────────────────────────────

const occurrenceOf = (id: string) => editor.composition.occurrences.find((occurrence) => occurrence.id === id);
const definitionOf = (id: string) =>
	editor.composition.definitions.find((definition) => definition.id === occurrenceOf(id)?.definition);
const occurrenceLabel = (id: string) => occurrenceOf(id)?.label ?? definitionOf(id)?.label ?? id;
function portLabel(ref: PortRef): string {
	const body = definitionOf(ref.occurrence)?.body;
	const port =
		body?.kind === 'geometry'
			? body.ports.find((candidate) => candidate.id === ref.port)
			: body?.exposedPorts.find((candidate) => candidate.id === ref.port);
	return port?.label ?? ref.port;
}
const endLabel = (ref: PortRef) => `${portLabel(ref)} — ${occurrenceLabel(ref.occurrence)}`;

function selectionText(selection: CompositionSelection): string {
	if (selection?.kind === 'occurrence') {
		return m.showcase_3d_compose_selection_occurrence({ label: occurrenceLabel(selection.id), id: selection.id });
	}
	if (selection?.kind === 'port' && selection.ref) {
		return m.showcase_3d_compose_selection_port({
			label: portLabel(selection.ref),
			occurrence: occurrenceLabel(selection.ref.occurrence),
		});
	}
	if (selection?.kind === 'conduit') {
		const coupling = editor.composition.couplings.find((candidate) => candidate.id === selection.coupling);
		return m.showcase_3d_compose_selection_conduit({
			id: coupling ? `${portLabel(coupling.a)} — ${portLabel(coupling.b)}` : selection.coupling,
		});
	}
	return m.showcase_3d_compose_selection_none();
}

// ── Coupling ──────────────────────────────────────────────────────────────────

const options = $derived(editor.couplingOptions());
const candidates = $derived(options.filter((option) => option.diagnostics.length === 0));
const portHints = $derived(
	new Map(options.map((option) => [option.key, option.diagnostics.length > 0 ? 'blocked' : 'candidate'] as const)),
);
let target = $state('');

function couple(to: PortRef): boolean {
	if (editor.selection?.kind !== 'port' || !editor.selection.ref) return false;
	const from = editor.selection.ref;
	const result = connect(editor.composition, registry, { a: from, b: to, mode: editor.coupleMode });
	if (!run(result, m.showcase_3d_compose_announce_coupled({ a: endLabel(from), b: endLabel(to) }))) return false;
	const added = result.composition.couplings.at(-1);
	// A pipe opens for routing; a mate lands on the product that moved, with its couplings listed.
	editor.select(
		added?.mode === 'conduit' ? { kind: 'conduit', coupling: added.id } : { kind: 'occurrence', id: to.occurrence },
	);
	target = '';
	void focusInspector();
	return true;
}

/** A click on a second port, with one selected, couples them; any other click selects. */
function onselect(next: CompositionSelection) {
	const current = editor.selection;
	if (next?.kind === 'port' && next.ref && current?.kind === 'port' && current.ref && next.key !== current.key) {
		if (couple(next.ref)) return;
		// Refused: keep the reason on screen, and let the clicked port become the new start.
		const reason = message;
		editor.select(next);
		void say(reason);
		return;
	}
	editor.select(next);
	void say(selectionText(next));
}

function selectFromPanel(next: CompositionSelection) {
	editor.select(next);
	void say(selectionText(next));
	void focusInspector();
}

// ── Moving ────────────────────────────────────────────────────────────────────

const gizmo: GizmoHandlers = {
	onstart: () => editor.beginGesture(),
	onoccurrence: (id, position) => {
		const base = editor.gestureBase;
		const rotation = base.occurrences.find((occurrence) => occurrence.id === id)?.placement.rotation;
		if (rotation) editor.updateGesture(moveOccurrence(base, registry, id, { position, rotation }));
	},
	onwaypoint: (coupling, index, position) => {
		const base = editor.gestureBase;
		const waypoints = base.conduits.find((conduit) => conduit.coupling === coupling)?.waypoints ?? [];
		editor.updateGesture(
			setConduitWaypoints(
				base,
				coupling,
				waypoints.map((point, at) => (at === index ? position : point)),
			),
		);
	},
	onend: () => editor.endGesture(),
};

const offset = (point: Vec3, axis: 0 | 1 | 2, sign: 1 | -1): Vec3 =>
	point.map((value, at) => (at === axis ? value + sign * NUDGE : value)) as Vec3;
const metres = (point: Vec3) => point.map((value) => value.toFixed(2));

function nudgeOccurrence(id: string, axis: 0 | 1 | 2, sign: 1 | -1) {
	const placement = occurrenceOf(id)?.placement;
	if (!placement) return;
	const position = offset(placement.position, axis, sign);
	const [x, y, z] = metres(position);
	run(
		moveOccurrence(editor.composition, registry, id, { position, rotation: placement.rotation }),
		m.showcase_3d_compose_announce_moved({ label: occurrenceLabel(id), x, y, z }),
	);
}

function nudgeWaypoint(coupling: string, axis: 0 | 1 | 2, sign: 1 | -1) {
	const index = editor.waypoint;
	const waypoints = conduitOf(coupling)?.waypoints;
	if (index === undefined || !waypoints?.[index]) return;
	const moved = waypoints.map((point, at) => (at === index ? offset(point, axis, sign) : point));
	const [x, y, z] = metres(moved[index]);
	run(
		setConduitWaypoints(editor.composition, coupling, moved),
		m.showcase_3d_compose_announce_moved({ label: m.showcase_3d_compose_waypoint_item({ index: index + 1 }), x, y, z }),
	);
}

const turn = (id: string, degrees: number) =>
	run(
		rotateOccurrence(editor.composition, registry, id, [0, 1, 0], (degrees * Math.PI) / 180),
		m.showcase_3d_compose_announce_turned({ label: occurrenceLabel(id), angle: degrees }),
	);

function remove(id: string) {
	const label = occurrenceLabel(id);
	if (!run(removeOccurrence(editor.composition, id), m.showcase_3d_compose_announce_removed({ label }))) return;
	editor.select(null);
	void focusInspector();
}

function unlink(coupling: { id: string; a: PortRef; b: PortRef }) {
	const announced = m.showcase_3d_compose_announce_disconnected({ a: endLabel(coupling.a), b: endLabel(coupling.b) });
	if (!run(disconnect(editor.composition, coupling.id), announced)) return;
	if (editor.selection?.kind === 'conduit') editor.select(null);
	void focusInspector();
}

function undo() {
	if (!editor.canUndo) {
		void say(m.showcase_3d_compose_announce_nothing_to_undo());
		return;
	}
	editor.undo();
	void say(m.showcase_3d_compose_announce_undone());
}

function onkeydown(event: KeyboardEvent) {
	const typing = event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable]');
	if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && !typing) {
		event.preventDefault();
		undo();
	}
}

// ── Conduits ──────────────────────────────────────────────────────────────────

const conduitOf = (coupling: string) => editor.composition.conduits.find((conduit) => conduit.coupling === coupling);

function addWaypoint(coupling: string) {
	const insertion = editor.waypointInsertion(coupling);
	if (!insertion) return;
	const conduit = conduitOf(coupling);
	const label = m.showcase_3d_compose_waypoint_item({ index: insertion.index + 1 });
	const applied = conduit
		? run(
				insertWaypoint(editor.composition, conduit.id, insertion.index, insertion.point),
				m.showcase_3d_compose_announce_added({ label }),
			)
		: run(
				setConduitWaypoints(editor.composition, coupling, [insertion.point]),
				m.showcase_3d_compose_announce_added({ label }),
			);
	if (applied) editor.waypoint = insertion.index;
}

function dropWaypoint(coupling: string) {
	const conduit = conduitOf(coupling);
	const index = editor.waypoint;
	if (!conduit || index === undefined) {
		void say(m.showcase_3d_compose_announce_choose_waypoint());
		return;
	}
	const label = m.showcase_3d_compose_waypoint_item({ index: index + 1 });
	if (run(removeWaypoint(editor.composition, conduit.id, index), m.showcase_3d_compose_announce_removed({ label }))) {
		editor.waypoint = undefined;
		void focusInspector();
	}
}

// ── Files ─────────────────────────────────────────────────────────────────────

function exportFile() {
	const url = URL.createObjectURL(new Blob([editor.exportJson()], { type: 'application/json' }));
	const link = document.createElement('a');
	link.href = url;
	link.download = `${editor.composition.id}.json`;
	link.click();
	URL.revokeObjectURL(url);
}

async function importFile(event: Event) {
	const input = event.currentTarget as HTMLInputElement;
	const file = input.files?.[0];
	input.value = '';
	if (!file) return;
	const issues = editor.importJson(await file.text());
	if (issues.length > 0) {
		void say(m.showcase_3d_compose_import_failed({ reason: issues[0].message }));
		return;
	}
	frameRequest++;
	void say(m.showcase_3d_compose_announce_imported({ id: editor.composition.id }));
}

// ── Read-outs ─────────────────────────────────────────────────────────────────

const selection = $derived(editor.selection);
const selectedCoupling = $derived(
	selection?.kind === 'conduit' ? editor.composition.couplings.find((c) => c.id === selection.coupling) : undefined,
);
const polyline = $derived(selectedCoupling ? conduitPolyline(editor.composition, selectedCoupling.id) : undefined);
const occurrenceCouplings = $derived(
	selection?.kind === 'occurrence'
		? editor.composition.couplings.filter(
				(coupling) => coupling.a.occurrence === selection.id || coupling.b.occurrence === selection.id,
			)
		: [],
);
/** The selected product's ports, as the top level addresses them — the keyboard way to pick a port. */
const occurrencePorts = $derived.by(() => {
	if (selection?.kind !== 'occurrence') return [];
	const id = selection.id;
	const body = definitionOf(id)?.body;
	const ids =
		body?.kind === 'geometry' ? body.ports.map((port) => port.id) : (body?.exposedPorts.map((port) => port.id) ?? []);
	const used = portUse(editor.composition);
	return ids.flatMap((port) => {
		const ref = { occurrence: id, port };
		const resolved = resolvePort(editor.composition, ref);
		return resolved ? [{ key: resolved.key, ref, open: !used.has(resolved.key) }] : [];
	});
});
const otherEnd = (coupling: { a: PortRef; b: PortRef }, own: string) =>
	coupling.a.occurrence === own ? coupling.b : coupling.a;
</script>

<!-- svelte-ignore a11y_no_static_element_interactions — the handler only adds an undo shortcut to the editor. -->
<div class="compose-root" {onkeydown}>
	<div class="toolbar">
		<span class="toolbar-label" id="compose-mode-label">{m.showcase_3d_compose_couple_mode_label()}</span>
		<div role="group" aria-labelledby="compose-mode-label">
			<ToggleGroup
				bind:value={() => editor.coupleMode, (value) => (editor.coupleMode = value === 'mated' ? 'mated' : 'conduit')}
				size="sm"
				items={[
					{ value: 'conduit', label: m.showcase_3d_compose_couple_mode_conduit() },
					{ value: 'mated', label: m.showcase_3d_compose_couple_mode_mated() },
				]}
			/>
		</div>
		<Button size="sm" variant="outline" aria-keyshortcuts="Control+Z Meta+Z" onclick={undo}>
			<span class="i-lucide-undo-2 mr-2" aria-hidden="true"></span>{m.showcase_3d_compose_undo()}
		</Button>
		<Button size="sm" variant="outline" onclick={() => frameRequest++}>
			<span class="i-lucide-scan mr-2" aria-hidden="true"></span>{m.showcase_3d_compose_frame_all()}
		</Button>
		<Button size="sm" variant="outline" onclick={exportFile}>
			<span class="i-lucide-download mr-2" aria-hidden="true"></span>{m.showcase_3d_compose_export()}
		</Button>
		<Button size="sm" variant="outline" onclick={() => importInput?.click()}>
			<span class="i-lucide-upload mr-2" aria-hidden="true"></span>{m.showcase_3d_compose_import()}
		</Button>
		<!-- Hidden: the Button above opens it (the desk explorer's pattern; there is no file-input component). -->
		<input
			bind:this={importInput}
			type="file"
			accept="application/json,.json"
			class="sr-only"
			tabindex="-1"
			aria-hidden="true"
			onchange={importFile}
		/>
	</div>

	<p class="notice" role="status" data-testid="composition-notice">{message}</p>

	<div class="layout">
		<div class="stage">
			<CompositionCanvas
				composition={editor.composition}
				{standards}
				selection={editor.selection}
				{onselect}
				{portHints}
				waypoint={editor.waypoint}
				onwaypointselect={(index) => (editor.waypoint = index)}
				{gizmo}
				{frameRequest}
				label={m.showcase_3d_compose_canvas_label()}
				unavailableTitle={m.showcase_3d_compose_unavailable_title()}
				unavailableDescription={m.showcase_3d_compose_unavailable_description()}
			/>
		</div>

		<aside class="panel">
			<section aria-labelledby="compose-inspector-heading">
				<h2 id="compose-inspector-heading" tabindex="-1" bind:this={inspectorHeading}>
					{m.showcase_3d_compose_inspector_heading()}
				</h2>
				<p class="lead" data-testid="composition-selection">{selectionText(selection)}</p>

				{#if selection?.kind === 'occurrence' && occurrenceOf(selection.id)}
					{@const id = selection.id}
					<p class="hint">{m.showcase_3d_compose_drag_hint()}</p>
					<p class="label">{m.showcase_3d_compose_move_label()}</p>
					<div class="buttons">
						{#each DIRECTIONS as direction (direction.label)}
							<Button
								size="sm"
								variant="outline"
								aria-label={m.showcase_3d_compose_move_aria({ direction: direction.label })}
								onclick={() => nudgeOccurrence(id, direction.axis, direction.sign)}>{direction.label}</Button
							>
						{/each}
					</div>
					<p class="label">{m.showcase_3d_compose_rotate_label()}</p>
					<div class="buttons">
						{#each TURNS as degrees (degrees)}
							<Button
								size="sm"
								variant="outline"
								aria-label={m.showcase_3d_compose_rotate_aria({
									angle: Math.abs(degrees),
									direction:
										degrees > 0
											? m.showcase_3d_compose_rotate_anticlockwise()
											: m.showcase_3d_compose_rotate_clockwise(),
								})}
								onclick={() => turn(id, degrees)}>{degrees > 0 ? '+' : '−'}{Math.abs(degrees)}°</Button
							>
						{/each}
					</div>
					{#if occurrencePorts.length > 0}
						<p class="label">{m.showcase_3d_compose_ports_heading()}</p>
						<ul class="list">
							{#each occurrencePorts as port (port.key)}
								<li>
									<Button
										size="sm"
										variant="ghost"
										onclick={() => selectFromPanel({ kind: 'port', key: port.key, ref: port.ref })}
										>{portLabel(port.ref)}</Button
									>
									{#if port.open}<span class="muted">{m.showcase_3d_compose_port_open_badge()}</span>{/if}
								</li>
							{/each}
						</ul>
					{/if}
					{#if occurrenceCouplings.length > 0}
						<p class="label">{m.showcase_3d_compose_couplings_heading()}</p>
						<ul class="list">
							{#each occurrenceCouplings as coupling (coupling.id)}
								<li>
									<span>{endLabel(otherEnd(coupling, id))}</span>
									<Button size="sm" variant="ghost" onclick={() => unlink(coupling)}
										>{m.showcase_3d_compose_disconnect()}</Button
									>
								</li>
							{/each}
						</ul>
					{/if}
					<Button size="sm" variant="destructive" onclick={() => remove(id)}>{m.showcase_3d_compose_remove()}</Button>
				{:else if selection?.kind === 'port' && selection.ref}
					{#if candidates.length > 0}
						<p class="hint">{m.showcase_3d_compose_couple_hint()}</p>
						<p class="label" id="compose-couple-label">{m.showcase_3d_compose_couple_with()}</p>
						<div class="buttons" role="group" aria-labelledby="compose-couple-label">
							<Select
								bind:value={target}
								options={candidates.map((option) => ({ value: option.key, label: endLabel(option.ref) }))}
							/>
							<Button
								size="sm"
								disabled={!target}
								onclick={() => {
									const option = candidates.find((candidate) => candidate.key === target);
									if (option) couple(option.ref);
								}}>{m.showcase_3d_compose_couple_button()}</Button
							>
						</div>
					{:else}
						<p class="hint">{m.showcase_3d_compose_no_candidates()}</p>
					{/if}
				{:else if selectedCoupling}
					{@const coupling = selectedCoupling}
					{@const waypoints = conduitOf(coupling.id)?.waypoints ?? []}
					{#if polyline}
						<p class="hint">
							{m.showcase_3d_compose_conduit_summary({
								length: polyline.length.toFixed(2),
								bends: polyline.bends,
								waypoints: waypoints.length,
							})}
						</p>
					{/if}
					{#if waypoints.length > 0}
						<p class="label">{m.showcase_3d_compose_waypoints_heading()}</p>
						<div class="buttons">
							{#each waypoints as _, index (index)}
								<Button
									size="sm"
									variant={editor.waypoint === index ? 'secondary' : 'ghost'}
									aria-pressed={editor.waypoint === index}
									onclick={() => (editor.waypoint = index)}
									>{m.showcase_3d_compose_waypoint_item({ index: index + 1 })}</Button
								>
							{/each}
						</div>
					{/if}
					{#if editor.waypoint !== undefined}
						<p class="label">{m.showcase_3d_compose_move_label()}</p>
						<div class="buttons">
							{#each DIRECTIONS as direction (direction.label)}
								<Button
									size="sm"
									variant="outline"
									aria-label={m.showcase_3d_compose_move_aria({ direction: direction.label })}
									onclick={() => nudgeWaypoint(coupling.id, direction.axis, direction.sign)}
									>{direction.label}</Button
								>
							{/each}
						</div>
					{/if}
					<div class="buttons">
						<Button size="sm" variant="outline" onclick={() => addWaypoint(coupling.id)}
							>{m.showcase_3d_compose_waypoint_add()}</Button
						>
						<Button size="sm" variant="outline" onclick={() => dropWaypoint(coupling.id)}
							>{m.showcase_3d_compose_waypoint_remove()}</Button
						>
						<Button size="sm" variant="ghost" onclick={() => unlink(coupling)}
							>{m.showcase_3d_compose_disconnect()}</Button
						>
					</div>
				{/if}
			</section>

			<section aria-labelledby="compose-products-heading">
				<h2 id="compose-products-heading">{m.showcase_3d_compose_products_heading()}</h2>
				<ul class="list">
					{#each editor.composition.occurrences as occurrence (occurrence.id)}
						{@const current = selection?.kind === 'occurrence' && selection.id === occurrence.id}
						<li>
							<Button
								size="sm"
								variant={current ? 'secondary' : 'ghost'}
								aria-current={current ? 'true' : undefined}
								onclick={() => selectFromPanel({ kind: 'occurrence', id: occurrence.id })}
								>{occurrenceLabel(occurrence.id)} <span class="muted">({occurrence.id})</span></Button
							>
						</li>
					{/each}
				</ul>
			</section>

			<CompositionFindings composition={editor.composition} {registry} />
		</aside>
	</div>
</div>

<style>
	.compose-root {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}

	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--spacing-2);
	}

	.toolbar-label,
	.label {
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.notice {
		min-height: 1.5em;
		margin: 0;
		font-size: var(--text-fluid-sm);
	}

	.layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--spacing-4);
	}

	/* Small screens: a shorter stage, so a tap's result in the panel below is in reach. */
	.stage {
		height: min(50dvh, 28rem);
		background: var(--surface-1);
		border-radius: var(--radius-md);
		overflow: hidden;
	}

	@media (min-width: 64rem) {
		.layout {
			grid-template-columns: minmax(0, 1fr) 22rem;
		}

		.stage {
			height: min(70dvh, 44rem);
		}
	}

	.panel {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-5);
	}

	.panel h2 {
		margin: 0 0 var(--spacing-2);
		font-size: var(--text-fluid-base);
	}

	.panel h2:focus-visible {
		outline: 2px solid var(--color-primary);
		outline-offset: 2px;
	}

	.lead {
		margin: 0 0 var(--spacing-2);
	}

	.hint {
		margin: 0 0 var(--spacing-2);
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
	}

	.label {
		margin: var(--spacing-2) 0 var(--spacing-1);
	}

	.buttons {
		display: flex;
		flex-wrap: wrap;
		gap: var(--spacing-1);
		margin-bottom: var(--spacing-2);
	}

	/* Touch: the nudge and turn buttons are tapped repeatedly, so give them room. */
	@media (pointer: coarse) {
		.buttons {
			gap: var(--spacing-2);
		}

		.buttons :global(button) {
			min-height: 44px;
		}
	}

	.list {
		margin: 0 0 var(--spacing-2);
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: var(--spacing-1);
	}

	.list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-2);
		font-size: var(--text-fluid-sm);
	}

	.muted {
		margin-inline-start: var(--spacing-1);
		color: var(--color-muted);
	}
</style>
