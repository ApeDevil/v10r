# Dynamic Attributes

Records whose attributes the user defines at runtime — label, type and value, stored together
in one self-describing document — with safe renames and type changes, autosave, undo, and
conflicts that merge by attribute. Showcase: `/showcases/dynamic-attributes`; desk: the
**Record** file type.

| File | Main Topics |
|------|-------------|
| [pattern.md](./pattern.md) | The pattern: when to use and avoid it, the record model, contracts (codec, kinds, operations, merge, stores, editor, session), extension interfaces, security invariants, performance, integration, limitations, future work |
| [research.md](./research.md) | Research report: prior art (Notion, Airtable, Baserow, Directus, Contentful), form generators and why none is adopted, JSON Schema vs Valibot, JSONB vs EAV, binary formats, schema evolution, concurrency, the internal inventory of what v10r already had |
| [plan.md](./plan.md) | The phased plan, the progress record, the second-pass architecture audit and what it changed |
