/**
 * The 3D Viewer View — the browser program inside the MCP Apps resource `ui://v10r/3d-viewer.html`.
 * Built into one self-contained HTML document by `scripts/mcp/build-app-views.ts`; never imported
 * by the app.
 *
 * It holds the model the conversation is about — from the `generate_model` call's input, or the
 * new model a `modify_model` result carries — and nothing else. Geometry comes from the app-only
 * `render_model` tool as a compact preview mesh (the host sandbox runs no WebAssembly, so the
 * kernel stays on the server); Three.js draws it with creased normals rebuilt here. Parameter
 * edits re-render through the same tool and are reported to the agent with
 * `ui/update-model-context`, so the conversation and the View never disagree about the model.
 * Downloads are the exact GLB / STL `render_model` returns, through `ui/download-file` where
 * the host offers it; otherwise the full viewer link does every export.
 */
import {
	App,
	applyDocumentTheme,
	applyHostStyleVariables,
	type McpUiHostContext,
	PostMessageTransport,
} from '@modelcontextprotocol/ext-apps';
import {
	AmbientLight,
	Box3,
	BufferAttribute,
	BufferGeometry,
	Color,
	DirectionalLight,
	GridHelper,
	Group,
	HemisphereLight,
	Mesh,
	MeshStandardMaterial,
	PerspectiveCamera,
	Scene,
	Sphere,
	SRGBColorSpace,
	Vector3,
	WebGLRenderer,
} from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MATERIAL_PBR } from '#lib/asset-production/glb.ts';
import { decodePreviewPrimitive, type PreviewMesh } from '#lib/asset-production/modeling/preview-mesh.ts';
import type { ParametricModelSummary } from '#lib/asset-production/modeling/run.ts';
import type { ParametricModel } from '#lib/schemas/parametric-model.ts';

const RENDER_TOOL = 'render_model';
/** Matches the kernel side's crease split (evaluate.ts), so the preview shades like the GLB. */
const CREASE_RADIANS = (40 * Math.PI) / 180;

interface Finding {
	severity: string;
	code: string;
	subject: string;
	message: string;
}

interface ToolAnswer {
	isError?: boolean;
	content?: Array<{ type: string; text?: string }>;
	structuredContent?: Record<string, unknown>;
}

interface ViewModel {
	model: ParametricModel | null;
	summary: ParametricModelSummary | null;
	findings: Finding[];
	/** Origin of the full viewer, read from the first answer's link. */
	viewerOrigin: string | null;
	notice: { tone: 'info' | 'error'; text: string } | null;
	busy: boolean;
	wireframe: boolean;
	/** Parameter values being edited, not yet applied. */
	draft: Record<string, number>;
	/** The model came from a `modify_model` call: wait for its result's model. */
	awaitingResult: boolean;
}

const view: ViewModel = {
	model: null,
	summary: null,
	findings: [],
	viewerOrigin: null,
	notice: { tone: 'info', text: 'Waiting for a model…' },
	busy: false,
	wireframe: false,
	draft: {},
	awaitingResult: false,
};

const app = new App({ name: 'v10r-3d-viewer', version: '1.0.0' }, {}, { autoResize: true });

// ---------------------------------------------------------------------------------------------
// DOM helpers — text only; nothing from an answer is ever parsed as HTML.

type Child = Node | string | null | false;

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	attrs: Record<string, string> = {},
	...children: Child[]
): HTMLElementTagNameMap[K] {
	const element = document.createElement(tag);
	for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
	for (const child of children) if (child !== null && child !== false) element.append(child);
	return element;
}

function button(label: string, onClick: () => void, attrs: Record<string, string> = {}): HTMLButtonElement {
	const b = el('button', { type: 'button', ...attrs }, label);
	b.addEventListener('click', onClick);
	return b;
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const dims = (size: readonly number[], units: string) => `${size.map(fmt).join(' × ')} ${units}`;

// ---------------------------------------------------------------------------------------------
// The 3D scene — created once, fed new meshes.

const scene = new Scene();
const camera = new PerspectiveCamera(40, 1, 0.0005, 500);
camera.up.set(0, 1, 0);
const canvasHost = el('div', { class: 'stage', role: 'img', 'aria-label': '3D view of the model' });
let renderer: WebGLRenderer | null = null;
let controls: OrbitControls | null = null;
const content = new Group();
scene.add(content);
scene.add(new HemisphereLight(undefined, undefined, 1.6));
scene.add(new AmbientLight(undefined, 0.35));
const key = new DirectionalLight(undefined, 2.2);
key.position.set(1, 2, 1.5);
scene.add(key);
let grid: GridHelper | null = null;
let framed: Sphere | null = null;

/**
 * A token as a three.js colour. Tokens are authored in `oklch()`, which `Color.setStyle` cannot
 * parse; painting one pixel and reading it back always yields sRGB bytes.
 */
function cssColor(name: string): Color {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	const context = canvas.getContext('2d', { willReadFrequently: true });
	if (!context || !value) return new Color(0.5, 0.5, 0.5);
	context.fillStyle = value;
	context.fillRect(0, 0, 1, 1);
	const [r, g, b] = context.getImageData(0, 0, 1, 1).data;
	return new Color().setRGB(r / 255, g / 255, b / 255, SRGBColorSpace);
}

function draw(): void {
	if (renderer) renderer.render(scene, camera);
}

function ensureRenderer(): boolean {
	if (renderer) return true;
	try {
		renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
	} catch {
		view.notice = { tone: 'error', text: 'This host gave the view no WebGL context; the facts below still apply.' };
		return false;
	}
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	canvasHost.append(renderer.domElement);
	controls = new OrbitControls(camera, renderer.domElement);
	controls.enableDamping = false;
	controls.addEventListener('change', draw);
	new ResizeObserver(resize).observe(canvasHost);
	resize();
	return true;
}

function resize(): void {
	if (!renderer) return;
	const width = canvasHost.clientWidth || 320;
	const height = canvasHost.clientHeight || 300;
	renderer.setSize(width, height, false);
	camera.aspect = width / height;
	camera.updateProjectionMatrix();
	draw();
}

function frame(): void {
	if (!framed || !controls) return;
	const { center, radius } = framed;
	const distance = (radius / Math.sin((camera.fov * Math.PI) / 360)) * 1.15;
	camera.position.copy(center).add(new Vector3(0.9, 0.65, 1).normalize().multiplyScalar(distance));
	camera.near = distance / 100;
	camera.far = distance * 100;
	camera.updateProjectionMatrix();
	controls.target.copy(center);
	controls.update();
	draw();
}

function showPreview(preview: PreviewMesh): void {
	if (!ensureRenderer()) return;
	for (const child of [...content.children]) {
		const mesh = child as Mesh;
		mesh.geometry.dispose();
		(mesh.material as MeshStandardMaterial).dispose();
		content.remove(child);
	}
	for (const primitive of preview.primitives) {
		const { positions, indices } = decodePreviewPrimitive(primitive);
		const indexed = new BufferGeometry();
		indexed.setAttribute('position', new BufferAttribute(positions, 3));
		indexed.setIndex(new BufferAttribute(indices, 1));
		const geometry = toCreasedNormals(indexed, CREASE_RADIANS);
		indexed.dispose();
		const pbr = MATERIAL_PBR[primitive.material as keyof typeof MATERIAL_PBR] ?? MATERIAL_PBR.plastic;
		const [r, g, b] = pbr.baseColorFactor;
		const material = new MeshStandardMaterial({
			color: new Color(r, g, b),
			metalness: pbr.metallicFactor,
			roughness: pbr.roughnessFactor,
			wireframe: view.wireframe,
			flatShading: false,
		});
		const mesh = new Mesh(geometry, material);
		mesh.name = primitive.name;
		content.add(mesh);
	}
	const box = new Box3().setFromObject(content);
	framed = box.getBoundingSphere(new Sphere());
	if (grid) {
		scene.remove(grid);
		grid.dispose();
	}
	const size = Math.max(box.max.x - box.min.x, box.max.z - box.min.z) * 1.6 || 0.1;
	grid = new GridHelper(size, 10, cssColor('--view-muted'), cssColor('--view-line'));
	grid.position.set((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2);
	scene.add(grid);
	frame();
}

function setWireframe(on: boolean): void {
	view.wireframe = on;
	for (const child of content.children) ((child as Mesh).material as MeshStandardMaterial).wireframe = on;
	draw();
	render();
}

// ---------------------------------------------------------------------------------------------
// Server calls

function textOf(answer: ToolAnswer): string {
	return (answer.content ?? [])
		.map((block) => (block.type === 'text' ? (block.text ?? '') : ''))
		.join('\n')
		.trim();
}

async function callRender(model: ParametricModel, format: 'preview' | 'glb' | 'stl'): Promise<ToolAnswer | null> {
	try {
		return (await app.callServerTool({ name: RENDER_TOOL, arguments: { model, format } })) as ToolAnswer;
	} catch {
		view.notice = { tone: 'error', text: 'The host did not complete the call.' };
		return null;
	}
}

async function refresh(model: ParametricModel): Promise<boolean> {
	view.busy = true;
	view.notice = { tone: 'info', text: 'Building…' };
	render();
	const answer = await callRender(model, 'preview');
	view.busy = false;
	if (!answer) {
		render();
		return false;
	}
	if (answer.isError) {
		view.notice = { tone: 'error', text: textOf(answer).split('\n## Next actions')[0] || 'The model did not build.' };
		render();
		return false;
	}
	const content = answer.structuredContent ?? {};
	view.model = model;
	view.summary = content.summary as unknown as ParametricModelSummary;
	view.findings = (content.findings as Finding[] | undefined) ?? [];
	view.draft = { ...(model.parameters ?? {}) } as Record<string, number>;
	view.notice = null;
	render();
	showPreview(content.preview as unknown as PreviewMesh);
	return true;
}

function viewerUrl(): string | null {
	const link = view.summary?.link;
	return link && view.viewerOrigin ? `${view.viewerOrigin}/3d/view#${link}` : null;
}

async function applyParameters(): Promise<void> {
	if (!view.model) return;
	const changed = Object.entries(view.draft).filter(([name, value]) => view.model?.parameters?.[name] !== value);
	if (changed.length === 0) return;
	const next: ParametricModel = { ...view.model, parameters: { ...(view.model.parameters ?? {}), ...view.draft } };
	if (!(await refresh(next))) return;
	if (!app.getHostCapabilities()?.updateModelContext) return;
	const url = viewerUrl();
	const lines = [
		`The person changed parameters in the 3D viewer: ${changed.map(([name, value]) => `${name} = ${value}`).join(', ')}.`,
		`Current parameters: ${JSON.stringify(next.parameters)}. Use these values in the next modify_model or generate_model call.`,
		url ? `Current viewer link: ${url}` : '',
	].filter(Boolean);
	void app.updateModelContext({ content: [{ type: 'text', text: lines.join('\n') }] }).catch(() => {});
}

function fileBase(): string {
	const name = (view.summary?.name ?? view.model?.name ?? 'model').toLowerCase();
	return name.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
}

async function download(format: 'glb' | 'stl' | 'json'): Promise<void> {
	if (!view.model) return;
	let blob: string;
	let mimeType: string;
	if (format === 'json') {
		const text = JSON.stringify(view.model, null, 2);
		blob = btoa(String.fromCharCode(...new TextEncoder().encode(text)));
		mimeType = 'application/json';
	} else {
		view.notice = { tone: 'info', text: `Preparing ${format.toUpperCase()}…` };
		render();
		const answer = await callRender(view.model, format);
		if (!answer || answer.isError) {
			view.notice = { tone: 'error', text: answer ? textOf(answer) : 'The export did not complete.' };
			render();
			return;
		}
		blob = String(answer.structuredContent?.base64 ?? '');
		mimeType = String(answer.structuredContent?.mediaType ?? 'application/octet-stream');
	}
	const result = await app
		.downloadFile({
			contents: [{ type: 'resource', resource: { uri: `file:///${fileBase()}.${format}`, mimeType, blob } }],
		})
		.catch(() => ({ isError: true }));
	view.notice = result.isError
		? { tone: 'error', text: 'The host did not save the file. The full viewer exports every format.' }
		: null;
	render();
}

function openViewer(): void {
	const url = viewerUrl();
	if (!url) return;
	void app.openLink({ url }).catch(() => {
		view.notice = { tone: 'info', text: url };
		render();
	});
}

// ---------------------------------------------------------------------------------------------
// Panels

function factsPanel(summary: ParametricModelSummary): HTMLElement {
	const u = summary.units;
	return el(
		'section',
		{ class: 'panel' },
		el('h2', {}, 'Dimensions'),
		el(
			'p',
			{ class: 'muted' },
			`${dims(summary.size, u)} · ${summary.triangles.toLocaleString()} triangles · `,
			el(
				'span',
				{ class: 'badge', 'data-tone': summary.closedManifold ? 'ok' : 'warn' },
				summary.closedManifold ? 'closed manifold' : 'not closed',
			),
		),
		el(
			'ul',
			{ class: 'components' },
			...summary.components.map((c) =>
				el(
					'li',
					{},
					el('code', {}, c.name),
					` ${c.material} · ${dims(c.size, u)} · ${fmt(c.volume)} ${u}³${c.genus > 0 ? ` · ${c.genus} through-hole${c.genus === 1 ? '' : 's'}` : ''}`,
				),
			),
		),
	);
}

function findingsPanel(findings: Finding[]): HTMLElement | null {
	if (findings.length === 0) return null;
	return el(
		'section',
		{ class: 'panel' },
		el('h2', {}, 'Findings'),
		el(
			'ul',
			{ class: 'findings' },
			...findings.map((f) =>
				el('li', { 'data-tone': f.severity }, el('code', {}, f.code), ` ${f.subject}: ${f.message}`),
			),
		),
	);
}

function parametersPanel(model: ParametricModel): HTMLElement | null {
	const names = Object.keys(model.parameters ?? {});
	if (names.length === 0) return null;
	const form = el('form', { class: 'parameters' });
	for (const name of names) {
		const input = el('input', {
			type: 'number',
			step: 'any',
			name,
			value: String(view.draft[name] ?? model.parameters?.[name]),
			'aria-label': name,
		});
		input.addEventListener('input', () => {
			const value = Number(input.value);
			if (Number.isFinite(value)) view.draft[name] = value;
		});
		form.append(el('label', {}, el('span', {}, name), input));
	}
	form.append(button('Apply', () => void applyParameters(), { class: 'primary', disabled: view.busy ? 'true' : '' }));
	if (!view.busy) form.querySelector('button')?.removeAttribute('disabled');
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		void applyParameters();
	});
	return el('section', { class: 'panel' }, el('h2', {}, 'Parameters'), form);
}

function toolbar(): HTMLElement {
	const canDownload = Boolean(app.getHostCapabilities()?.downloadFile);
	const url = viewerUrl();
	return el(
		'div',
		{ class: 'toolbar' },
		button(view.wireframe ? 'Shaded' : 'Wireframe', () => setWireframe(!view.wireframe), {
			'aria-pressed': String(view.wireframe),
		}),
		button('Reset view', frame),
		canDownload ? button('GLB', () => void download('glb')) : null,
		canDownload ? button('STL', () => void download('stl')) : null,
		canDownload ? button('JSON', () => void download('json')) : null,
		url ? button('Open full viewer', openViewer, { class: 'primary' }) : null,
	);
}

function render(): void {
	const root = document.getElementById('app');
	if (!root) return;
	const summary = view.summary;
	root.replaceChildren(
		el(
			'div',
			{ class: 'viewer', 'aria-busy': String(view.busy) },
			el(
				'header',
				{ class: 'bar' },
				el('h1', {}, summary?.name ?? view.model?.name ?? '3D model'),
				summary ? el('span', { class: 'version' }, summary.engine.kernel) : null,
			),
			canvasHost,
			summary ? toolbar() : null,
			view.notice ? el('p', { class: 'notice', 'data-tone': view.notice.tone }, view.notice.text) : null,
			summary ? factsPanel(summary) : null,
			findingsPanel(view.findings),
			view.model ? parametersPanel(view.model) : null,
		),
	);
	draw();
}

// ---------------------------------------------------------------------------------------------
// Host wiring — handlers are registered before connect so no one-shot notification is missed.

function applyContext(context: McpUiHostContext | undefined): void {
	if (!context) return;
	if (context.theme) applyDocumentTheme(context.theme);
	if (context.styles?.variables) applyHostStyleVariables(context.styles.variables);
}

function isModel(value: unknown): value is ParametricModel {
	return typeof value === 'object' && value !== null && Array.isArray((value as { operations?: unknown }).operations);
}

app.ontoolinput = (params) => {
	const args = params.arguments ?? {};
	view.awaitingResult = 'patch' in args;
	if (isModel(args.model) && !view.awaitingResult) view.model = args.model;
	view.notice = { tone: 'info', text: view.awaitingResult ? 'Applying the change…' : 'Building the model…' };
	render();
};

app.ontoolresult = (result) => {
	const answer = result as ToolAnswer;
	if (answer.isError) {
		view.notice = { tone: 'error', text: textOf(answer).split('\n## Next actions')[0] || 'The model did not build.' };
		render();
		return;
	}
	const content = answer.structuredContent ?? {};
	const link = typeof content.viewerUrl === 'string' ? content.viewerUrl : null;
	if (link) {
		try {
			view.viewerOrigin = new URL(link).origin;
		} catch {
			view.viewerOrigin = null;
		}
	}
	const model = isModel(content.model) ? content.model : view.model;
	if (model) void refresh(model);
};

app.onhostcontextchanged = (context) => {
	applyContext(context as McpUiHostContext);
	draw();
};

render();
await app.connect(new PostMessageTransport(window.parent, window.parent));
applyContext(app.getHostContext());
