# Svelte 5

UI framework. Reactive, compiled, minimal runtime.

## Why Svelte

| Aspect | Svelte | React | Vue |
|--------|--------|-------|-----|
| Runtime Size | ~2 KB | ~40 KB | ~30 KB |
| Compilation | Ahead-of-time | JIT | JIT |
| Reactivity | Native (runes) | Hooks | Refs/Reactive |
| Learning Curve | Gentle | Moderate | Moderate |
| Performance | Excellent | Good | Good |

Svelte wins: smallest runtime, compiled reactivity, simple mental model.

## Svelte 5 Runes

Svelte 5 introduces runes for reactivity:

| Rune | Purpose |
|------|---------|
| `$state` | Reactive state |
| `$derived` | Computed values |
| `$effect` | Side effects |
| `$props` | Component props |
| `$bindable` | Two-way bindable props |

## State Patterns

| Location | Pattern | Size |
|----------|---------|------|
| Component | `$state` in `<script>` | 0 KB |
| Shared | `$state` in `.svelte.ts` | 0 KB |
| Server | `+page.server.ts` load | 0 KB |

No external state library needed. Runes work in components AND modules.

## Key Concepts

- **Compiled** (no virtual DOM, direct DOM updates)
- **Reactive** (fine-grained reactivity via runes)
- **Scoped CSS** (styles scoped to component by default)
- **Transitions** (built-in animation primitives)
- **Actions** (reusable element behaviors)

## File Types

| Extension | Purpose |
|-----------|---------|
| `.svelte` | Components |
| `.svelte.ts` | Reactive modules (runes work here) |
| `.ts` | Non-reactive TypeScript |

## Related

- [sveltekit.md](./sveltekit.md) - Meta-framework
- [../ui/unocss.md](../ui/unocss.md) - Styling
- [../ui/bits-ui.md](../ui/bits-ui.md) - Component library
- [../../blueprint/state.md](../../blueprint/state.md) - State patterns
