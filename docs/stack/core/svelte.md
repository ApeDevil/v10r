# Svelte 5

## What is it?

Compiler-based UI framework that transforms declarative components into optimized JavaScript at build time. No virtual DOM—generates lean code that directly manipulates the DOM. Svelte 5 introduces runes, a signal-based reactivity system replacing the older "magical" reactivity.

## What is it for?

- Building user interfaces for web applications
- Performance-critical applications (mobile, low-bandwidth environments)
- Projects requiring minimal JavaScript bundle size
- Fine-grained reactivity without virtual DOM overhead

Production users: The New York Times, Yelp, Square.

## Why was it chosen?

| Aspect | Svelte | React | Vue |
|--------|--------|-------|-----|
| Bundle size | ~2 KB | ~40 KB | ~30 KB |
| Compilation | Ahead-of-time | JIT | JIT |
| Reactivity | Signal-based (runes) | Hooks | Refs/Reactive |
| DOM | Direct | Virtual DOM | Virtual DOM |

**Key advantages:**
- Ships 1/10th the JavaScript of React for equivalent apps
- 40% faster load times than React builds
- No external state library needed—runes work in components AND modules
- Scoped CSS by default, built-in transitions and animations
- Simpler mental model than hooks-based frameworks

**Runes system:**
| Rune | Purpose |
|------|---------|
| `$state` | Reactive state |
| `$derived` | Computed values |
| `$effect` | Side effects |
| `$props` | Component props |
| `$bindable` | Two-way bindable props |

## Known limitations

**Ecosystem maturity:**
- Smallest of the four major frameworks (React, Vue, Angular, Svelte)
- Fewer third-party libraries than React/Vue
- Component libraries (Bits UI, Skeleton) less mature than Material UI/Vuetify

**Talent availability:**
- ~900 Svelte job listings vs ~110,000 React (122:1 ratio)
- Finding experienced Svelte developers is challenging
- Enterprise clients may hesitate due to smaller talent pool

**Migration considerations:**
- Svelte 4 → 5 runes represent a mental model change
- Existing components remain compatible, but new patterns required

## Related

- [sveltekit.md](./sveltekit.md) - Meta-framework
- [../ui/unocss.md](../ui/unocss.md) - Styling
- [../ui/bits-ui.md](../ui/bits-ui.md) - Component library
