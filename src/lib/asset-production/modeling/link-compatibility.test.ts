import { describe, expect, test } from 'vitest';
import { DEFAULT_ASSET_BUDGET } from '#lib/asset-production/index.ts';
import { EXAMPLE_MODELS } from '#lib/showcases/3d/mcp/example-models.ts';
import { runParametricModel } from './index.ts';

/**
 * The `m1` compatibility pin (docs/blueprint/3d/parametric-modeling.md § Model link → Link
 * versioning). A published `m1` link must keep building the same geometry. This pins what the
 * geometry MEANS for every example — triangle count, closed-manifold status, and per component
 * its size, volume and genus — so a kernel upgrade (manifold-3d), a tessellation change or an
 * engine refactor that changes any of it fails here instead of silently changing what old links
 * show.
 *
 * When this fails, decide explicitly:
 *  - the semantics are unchanged and only an incidental number moved (e.g. a tessellation
 *    detail the docs never promised): update the pin in the same commit and say why;
 *  - the geometry a link denotes changed: keep the old behaviour for `m1` (a versioned
 *    evaluation path) or introduce `m2` with a tested migration — never re-pin silently.
 *
 * The snapshot file is committed: a changed number shows in the diff next to the code that changed it.
 */
const round = (value: number) => Math.round(value * 1000) / 1000;

async function semantics(model: unknown) {
	const result = await runParametricModel(model, { budget: DEFAULT_ASSET_BUDGET });
	const summary = result.summary;
	if (!summary) throw new Error(`example failed to build: ${result.outcome}`);
	return {
		triangles: summary.triangles,
		closedManifold: summary.closedManifold,
		components: summary.components.map((c) => ({
			name: c.name,
			material: c.material,
			size: c.size.map(round),
			volume: round(c.volume),
			genus: c.genus,
		})),
	};
}

describe('m1 link compatibility', () => {
	for (const example of EXAMPLE_MODELS) {
		test(`${example.id} keeps its geometry`, async () => {
			expect(await semantics(example.model)).toMatchSnapshot();
		});
	}
});
