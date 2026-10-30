/**
 * The generator registry: request `generator` id → implementation. A request naming any
 * other id is refused by the schema before it reaches here.
 */
import type { AssetGeneratorId, AssetRequest } from '#lib/schemas/asset-production.ts';
import type { AssetGenerator } from './generator.ts';
import { structuralRingGenerator } from './structural-ring.ts';

export type { AssetGenerator } from './generator.ts';
export { structuralRingGenerator } from './structural-ring.ts';

type ParametersOf<Id extends AssetGeneratorId> = Extract<AssetRequest, { generator: Id }>['parameters'];

export const ASSET_GENERATORS: { [Id in AssetGeneratorId]: AssetGenerator<ParametersOf<Id>> } = {
	'structural-ring': structuralRingGenerator,
};

/** The generator for a request, typed to its parameters. */
export function generatorFor(request: AssetRequest): AssetGenerator<AssetRequest['parameters']> {
	return ASSET_GENERATORS[request.generator];
}
