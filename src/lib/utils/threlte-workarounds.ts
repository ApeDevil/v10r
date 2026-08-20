/**
 * Threlte's `makeDefault` prop is declared through a conditional type that
 * TypeScript collapses to `undefined`, so the boolean every scene passes is a
 * type error even though the runtime accepts (and requires) `true`. Routing all
 * call sites through this one cast keeps the workaround in a single owned spot
 * instead of per-site suppressions — markup-level `@ts-expect-error` comments are not
 * honored by svelte-check. See docs/blueprint/3d/3d-integration.md.
 */
export const THRELTE_MAKE_DEFAULT = true as unknown as undefined;
