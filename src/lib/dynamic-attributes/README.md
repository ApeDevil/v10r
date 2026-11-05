# `#lib/dynamic-attributes`

The framework-free core of the Dynamic Attributes pattern: the self-describing record, the
kind registry, the codec, the operations, the three-way merge, the diagnostics and the store
contract. No Svelte, no SvelteKit, no database — the same code runs in the browser, on the
server (`db/desk/mutations.ts` parses every record with it) and in tests.

The why, the contracts and the security invariants: `docs/blueprint/dynamic-attributes/pattern.md`.
The editor over it: `#lib/components/attributes/`.
