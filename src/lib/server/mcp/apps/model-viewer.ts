/**
 * The 3D Viewer MCP App: the View a supporting host renders for MCP 3D's `generate_model` and
 * `modify_model` results (SEP-1865). See docs/blueprint/3d/parametric-modeling.md § Viewing.
 *
 * The View never runs the kernel: a host's sandbox admits no WebAssembly compile, and the View
 * should not carry one anyway. It reads the model from the tool call's input (or the modified
 * model from the result), asks the app-only `render_model` tool for a compact preview mesh, and
 * draws it with Three.js. Parameter edits go back through `render_model`; the agent learns about
 * them through `ui/update-model-context`. Downloads are the exact GLB / STL from `render_model`.
 *
 * Every CSP list is empty: the View fetches nothing. Opening the full viewer is a host
 * `ui/open-link`, which the host may confirm with the person.
 */
import type { AppView } from '#mcp/tool-server.ts';
import viewDocument from './model-viewer.view.html?raw';

export const MODEL_VIEWER_URI = 'ui://v10r/3d-viewer.html';

export const MODEL_VIEWER_VIEW: AppView = {
	uri: MODEL_VIEWER_URI,
	name: '3D model viewer',
	description:
		'Interactive view of a parametric model built by generate_model: orbit, wireframe, dimensions, findings, parameter edits, GLB/STL download and a link to the full viewer.',
	tool: 'generate_model',
	alsoRenders: ['modify_model'],
	appTools: ['render_model'],
	html: viewDocument,
	ui: {
		csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] },
		permissions: {},
		prefersBorder: true,
	},
};
