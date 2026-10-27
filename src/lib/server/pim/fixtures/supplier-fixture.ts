/**
 * The worked example the tests and the tutorial share: a German supplier export, the shop's
 * target schema, and the recipe that maps one onto the other.
 */
import { readFileSync } from 'node:fs';
import * as v from 'valibot';
import { parseCsv } from '../csv-table';
import { productSheetFromTable } from '../product-sheet';
import { targetSchemaSchema } from '../target-schema';
import { parseTransformRecipe } from '../transform-recipe';

const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

export function supplierSheet() {
	return productSheetFromTable(parseCsv(read('supplier-sheet.csv')));
}

export function shopTarget() {
	return v.parse(targetSchemaSchema, JSON.parse(read('shop-target.json')));
}

export function supplierRecipeJson(): unknown {
	return JSON.parse(read('supplier-recipe.json'));
}

export function supplierRecipe() {
	return parseTransformRecipe(supplierRecipeJson(), supplierSheet().columns);
}
