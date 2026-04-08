/** Valibot schemas for desk API endpoints. */
import * as v from 'valibot';

const WorkspaceColorsSchema = v.object({
	shellBg: v.optional(v.string()),
	panelBg: v.optional(v.string()),
	shellBorder: v.optional(v.string()),
	tabActiveIndicator: v.optional(v.string()),
});

const TypeStyleSchema = v.object({
	bg: v.optional(v.string()),
});

const TypeStylesSchema = v.record(v.string(), TypeStyleSchema);

const PresetSchema = v.object({
	name: v.string(),
	workspace: WorkspaceColorsSchema,
	typeStyles: TypeStylesSchema,
});

export const SaveThemeSchema = v.object({
	workspace: WorkspaceColorsSchema,
	typeStyles: v.optional(TypeStylesSchema, {}),
	activePresetId: v.optional(v.nullable(v.string())),
});

export const MigrateThemeSchema = v.object({
	action: v.literal('migrate'),
	workspace: v.optional(WorkspaceColorsSchema, {}),
	typeStyles: v.optional(TypeStylesSchema, {}),
	activePresetId: v.optional(v.nullable(v.string())),
	userPresets: v.optional(v.array(PresetSchema), []),
});

export const CreatePresetSchema = v.object({
	action: v.literal('create-preset'),
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(200)),
	workspace: v.optional(WorkspaceColorsSchema, {}),
	typeStyles: v.optional(TypeStylesSchema, {}),
});

// ── Workspace schemas ───────────────────────────────────────────

/**
 * DockLayoutState validation — structural only.
 * The recursive tree is validated at the top level; deep node validation
 * is the client's responsibility.
 */
const DockLayoutStateSchema = v.object({
	version: v.number(),
	root: v.record(v.string(), v.unknown()), // opaque recursive tree
	panels: v.record(v.string(), v.unknown()),
	activityBarPosition: v.optional(v.picklist(['left', 'right', 'top', 'bottom'])),
});

export const CreateWorkspaceSchema = v.object({
	name: v.pipe(v.string(), v.minLength(1), v.maxLength(100)),
	layout: DockLayoutStateSchema,
	sortOrder: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8))),
});

export const UpdateWorkspaceSchema = v.object({
	name: v.optional(v.pipe(v.string(), v.minLength(1), v.maxLength(100))),
	layout: v.optional(DockLayoutStateSchema),
	sortOrder: v.optional(v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(8))),
});

export const SyncWorkspaceSchema = v.object({
	save: v.optional(
		v.object({
			id: v.string(),
			layout: DockLayoutStateSchema,
		}),
	),
	activate: v.string(),
});
