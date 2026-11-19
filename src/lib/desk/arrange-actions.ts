/**
 * The Desk's client actions — what the deskbot may ask the user's browser to do to the
 * workspace: open a file in a panel, bring a panel to the front, close a panel.
 *
 * One declaration per action, read by both sides (`#lib/client-actions/contract.ts`): the
 * server derives the model-facing input schema (`server/ai/tools/desk-arrange.ts`), the
 * Desk validates each call against the same schema before its handler runs
 * (`components/desk/arrange-action-handlers.ts`). They change what is SHOWN, never what
 * is stored — the `view` risk — so they run without an approval card; every change to a
 * file's contents or name stays a server tool behind the approval gate.
 *
 * The public contract speaks in files, panels and placements. Leaves, split trees and
 * runes are the Desk's own business and stay behind the handlers.
 */
import * as v from 'valibot';
import type { ClientActionContract } from '#lib/client-actions/contract.ts';

/** Where `desk_open_file` puts a file that is not open yet. An open file is brought forward where it is. */
export const DESK_OPEN_PLACEMENTS = ['auto', 'right'] as const;

export type DeskOpenPlacement = (typeof DESK_OPEN_PLACEMENTS)[number];

const PanelId = (purpose: string) => v.pipe(v.string(), v.minLength(1), v.maxLength(200), v.description(purpose));

export const DESK_OPEN_FILE = {
	name: 'desk_open_file',
	input: v.object({
		file_id: v.pipe(
			v.string(),
			v.regex(/^fil_[A-Za-z0-9]+$/, 'Not a desk file id'),
			v.description('The desk file to open. Get it from desk_list_files, desk_search_files or desk context.'),
		),
		placement: v.optional(
			v.pipe(
				v.picklist(DESK_OPEN_PLACEMENTS),
				v.description(
					'"auto" (default) opens beside the conversation; "right" opens in the right-hand pane, creating it when the workspace has only one.',
				),
			),
		),
	}),
	// Opening reads the file's name and type from the server first; the rest is synchronous.
	timeoutMs: 8_000,
} satisfies ClientActionContract;

export const DESK_FOCUS_PANEL = {
	name: 'desk_focus_panel',
	input: v.object({
		panel_id: PanelId('The open panel to bring to the front. Get it from desk_get_open_panels.'),
	}),
	timeoutMs: 2_000,
} satisfies ClientActionContract;

export const DESK_CLOSE_PANEL = {
	name: 'desk_close_panel',
	input: v.object({
		panel_id: PanelId('The open panel to close. Get it from desk_get_open_panels.'),
	}),
	timeoutMs: 2_000,
} satisfies ClientActionContract;

/** Every client action the Desk declares, in the order the model is offered them. */
export const DESK_ARRANGE_ACTIONS = [DESK_OPEN_FILE, DESK_FOCUS_PANEL, DESK_CLOSE_PANEL] as const;

export type DeskArrangeActionName = (typeof DESK_ARRANGE_ACTIONS)[number]['name'];

export const DESK_ARRANGE_ACTION_NAMES = DESK_ARRANGE_ACTIONS.map((action) => action.name) as [
	DeskArrangeActionName,
	...DeskArrangeActionName[],
];

export type DeskOpenFileInput = v.InferOutput<typeof DESK_OPEN_FILE.input>;
export type DeskFocusPanelInput = v.InferOutput<typeof DESK_FOCUS_PANEL.input>;
export type DeskClosePanelInput = v.InferOutput<typeof DESK_CLOSE_PANEL.input>;

/**
 * How many client actions one user turn may spend. Each result starts another model
 * request, so without a ceiling a model that keeps arranging would loop on the user's
 * token budget. Past it the server stops offering the actions and the model has to answer.
 */
export const DESK_ARRANGE_MAX_ACTIONS_PER_TURN = 6;
