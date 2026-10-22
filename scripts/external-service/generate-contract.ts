/**
 * openapi.json → TypeScript types, the second link of the contract chain.
 *
 *   services/order-rules/src/contract.rs  (authority)
 *     └─ cargo test pins → services/order-rules/openapi.json
 *          └─ this script → src/lib/showcases/external-service/contract.generated.ts
 *               └─ contract.ts valibot mirrors, held to these types by the compiler
 *
 *   bun run external-service:contract           write the types
 *   bun run external-service:contract --check   exit 1 when the committed file is stale
 *
 * Types only — openapi-typescript emits no runtime, so the browser bundle gains nothing.
 * `contract-freshness.test.ts` runs the same `renderContractTypes` inside `validate`.
 */
import { readFile, writeFile } from 'node:fs/promises';
import openapiTS, { astToString } from 'openapi-typescript';

export const SPEC_PATH = 'services/order-rules/openapi.json';
export const TYPES_PATH = 'src/lib/showcases/external-service/contract.generated.ts';

const HEADER = `/**
 * GENERATED — do not edit. Source: ${SPEC_PATH}
 * Regenerate: bun run external-service:contract
 */

`;

export async function renderContractTypes(specText: string): Promise<string> {
	const ast = await openapiTS(JSON.parse(specText));
	return HEADER + astToString(ast);
}

if (import.meta.main) {
	const rendered = await renderContractTypes(await readFile(SPEC_PATH, 'utf8'));
	if (process.argv.includes('--check')) {
		const committed = await readFile(TYPES_PATH, 'utf8').catch(() => '');
		if (committed !== rendered) {
			console.error(`${TYPES_PATH} is stale — run: bun run external-service:contract`);
			process.exit(1);
		}
		console.log(`${TYPES_PATH} is current`);
	} else {
		await writeFile(TYPES_PATH, rendered);
		console.log(`wrote ${TYPES_PATH}`);
	}
}
