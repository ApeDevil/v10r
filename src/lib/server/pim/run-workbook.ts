/**
 * The workbook a person reviews after a recipe ran: the output, and beside it everything
 * needed to trust it — what still fails (`issues`), every cell that changed (`changes`), and
 * the recipe as plain sentences with its per-op counts (`recipe`). Each row points back to a
 * source line, so a reviewer can filter, check a sample against the supplier file, and fix
 * the rows the recipe left for them — in Excel, where they already work.
 */
import { productSheetToTable } from './product-sheet';
import type { WorkbookSheet } from './sheet-workbook';
import type { SheetCheck } from './target-schema';
import type { RecipeRun, TransformRecipe } from './transform-recipe';

export interface RunWorkbookInput {
	recipe: TransformRecipe;
	run: RecipeRun;
	/** The output checked against the target; omitted when there is no target. */
	check?: SheetCheck;
}

export function runWorkbookSheets({ recipe, run, check }: RunWorkbookInput): WorkbookSheet[] {
	const sheets: WorkbookSheet[] = [{ name: 'products', table: productSheetToTable(run.sheet) }];
	if (check) {
		sheets.push({
			name: 'issues',
			table: [
				['line', 'column', 'rule', 'value'],
				...check.missingColumns.map((c) => ['', c, 'missing_column', '']),
				...check.issues.map((i) => [String(i.line), i.column, i.rule, i.value]),
			],
		});
	}
	sheets.push(
		{
			name: 'changes',
			table: [
				['line', 'column', 'before', 'after', 'op'],
				...run.changes.map((c) => [String(c.line), c.column, c.before, c.after, String(c.opIndex + 1)]),
			],
		},
		{
			name: 'recipe',
			table: [
				['op', 'description', 'changed', 'unresolved', 'removed lines'],
				...run.reports.map((r) => [
					String(r.opIndex + 1),
					r.description,
					String(r.changed),
					r.unresolved.map((u) => `${u.line}: ${u.value}`).join('\n') +
						(r.unresolvedCount > r.unresolved.length ? `\n… ${r.unresolvedCount - r.unresolved.length} more` : ''),
					r.removedLines.join(', '),
				]),
				...(recipe.note ? [['', `Note: ${recipe.note}`, '', '', '']] : []),
			],
		},
	);
	return sheets;
}
