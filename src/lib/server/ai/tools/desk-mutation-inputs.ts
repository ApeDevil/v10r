/**
 * The argument contract of every desk mutation the bot can propose — ONE declaration
 * per tool, consumed three ways:
 *
 *   - the tool factory hands the model its JSON Schema (`toolInputSchema`),
 *   - `validateProposedPlan` parses each `desk_propose_plan` step before a PlanCard is
 *     shown, so the card never describes a step that cannot run,
 *   - `executeDeskToolCall` parses again at replay, so the door trusts no payload —
 *     not even one it persisted itself.
 *
 * Valibot is the source and `@valibot/to-json-schema` derives the wire schema: the
 * installed AI SDK converts a Standard Schema through `~standard.jsonSchema`, which
 * valibot 1.2 does not implement, so handing the schema over directly would throw.
 */
import { toJsonSchema } from '@valibot/to-json-schema';
import { type JSONSchema7, jsonSchema } from 'ai';
import * as v from 'valibot';
import type { DeskExecutableTool } from './desk-execute';

const FileId = (purpose: string) => v.pipe(v.string(), v.minLength(1), v.description(purpose));

const FileName = (purpose: string) => v.pipe(v.string(), v.minLength(1), v.maxLength(200), v.description(purpose));

const CellValue = v.pipe(
	v.union([v.string(), v.number(), v.null()]),
	v.description(
		'Cell value. String for text, number for numeric, null to clear; a string starting with "=" is a ' +
			'formula (SUM, AVERAGE, COUNT, MIN, MAX, IF over refs like B2 and ranges like B2:B9). ' +
			'Formulas that read the cell are recomputed on save.',
	),
);

const CellUpdate = v.object({
	cell: v.pipe(v.string(), v.minLength(2), v.description('Cell address like "A1", "B3", "C10".')),
	value: CellValue,
});

/** The most cells one call may touch — a runaway batch is a prompt-injection shape, not a task. */
const MAX_CELL_UPDATES = 500;

const MAX_MARKDOWN_CHARS = 50_000;

/** Edits per `desk_edit_markdown` call. */
const MAX_MARKDOWN_EDITS = 20;

export const DESK_MUTATION_INPUTS = {
	desk_update_cells: v.object({
		file_id: FileId('Spreadsheet file ID. Get from desk_list_files or desk_read_file.'),
		updates: v.pipe(
			v.array(CellUpdate),
			v.minLength(1),
			v.maxLength(MAX_CELL_UPDATES),
			v.description('Cell updates to apply. Only these cells change; every other cell is untouched.'),
		),
	}),
	desk_rename_file: v.object({
		file_id: FileId('The file ID to rename.'),
		name: FileName('New name for the file.'),
	}),
	desk_update_markdown: v.object({
		file_id: FileId('Markdown file ID. Get from desk_list_files or desk context.'),
		content: v.pipe(
			v.string(),
			v.maxLength(MAX_MARKDOWN_CHARS),
			v.description('Complete new markdown content to replace the document.'),
		),
	}),
	desk_edit_markdown: v.object({
		file_id: FileId('Markdown file ID. Get from desk_list_files or desk context.'),
		edits: v.pipe(
			v.array(
				v.object({
					find: v.pipe(
						v.string(),
						v.minLength(1),
						v.maxLength(MAX_MARKDOWN_CHARS),
						v.description(
							'Exact text to replace. Must occur exactly once in the document — include enough surrounding text to be unique.',
						),
					),
					replace: v.pipe(
						v.string(),
						v.maxLength(MAX_MARKDOWN_CHARS),
						v.description('The replacement text; empty to delete the passage.'),
					),
				}),
			),
			v.minLength(1),
			v.maxLength(MAX_MARKDOWN_EDITS),
			v.description('Targeted edits, applied in order to the current document.'),
		),
	}),
	desk_create_spreadsheet: v.object({
		name: FileName('Name for the new spreadsheet.'),
		cells: v.pipe(
			v.array(CellUpdate),
			v.maxLength(MAX_CELL_UPDATES),
			v.description('Initial cell data. Empty array for a blank spreadsheet.'),
		),
	}),
	desk_create_markdown: v.object({
		name: FileName('Document name (e.g. "Meeting Notes", "Blog Draft").'),
		content: v.pipe(v.string(), v.maxLength(MAX_MARKDOWN_CHARS), v.description('Initial markdown content.')),
	}),
	desk_delete_file: v.object({
		file_id: FileId('The file ID to delete.'),
	}),
} as const satisfies Record<DeskExecutableTool, v.GenericSchema>;

export type DeskMutationInput<T extends DeskExecutableTool> = v.InferOutput<(typeof DESK_MUTATION_INPUTS)[T]>;

/**
 * A valibot schema as the AI SDK's tool `inputSchema`: the derived JSON Schema for the
 * model, valibot itself as the validator of what the model sends back.
 */
export function toolInputSchema<T extends v.GenericSchema>(schema: T) {
	return jsonSchema<v.InferOutput<T>>(toJsonSchema(schema, { errorMode: 'throw' }) as JSONSchema7, {
		validate: (value) => {
			const result = v.safeParse(schema, value);
			return result.success
				? { success: true, value: result.output }
				: { success: false, error: new v.ValiError(result.issues) };
		},
	});
}

/** Parse a step's args against its tool's contract; `null` when the tool has no contract. */
export function parseMutationInput(toolName: string, args: unknown) {
	const schema = DESK_MUTATION_INPUTS[toolName as DeskExecutableTool];
	if (!schema) return null;
	return v.safeParse(schema, args);
}

/** The first issue as one line the model (or a receipt) can act on. */
export function describeIssues(issues: readonly v.BaseIssue<unknown>[]): string {
	return issues
		.slice(0, 3)
		.map((issue) => {
			const path = issue.path?.map((p) => String(p.key)).join('.') ?? '';
			return path ? `${path}: ${issue.message}` : issue.message;
		})
		.join('; ');
}
