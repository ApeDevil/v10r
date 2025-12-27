# Bits UI

## What is it?

Headless component library for Svelte providing unstyled, accessible UI primitives. Built on Melt UI's internal architecture with a component-based API. Inspired by Radix UI (API design) and React Spectrum (date/time, accessibility).

## What is it for?

- Building accessible UI components without imposed styling
- Creating custom design systems for SvelteKit applications
- WAI-ARIA compliant primitives with keyboard navigation and focus management
- Foundation for higher-level libraries (powers shadcn-svelte)

## Why was it chosen?

| Aspect | Bits UI | Melt UI | shadcn-svelte |
|--------|---------|---------|---------------|
| API | Component-based | Builder pattern | Component-based |
| Styling | Unstyled | Unstyled | Tailwind CSS |
| Ownership | npm dependency | npm dependency | Copy/paste (you own) |
| Learning curve | Lower | Higher | Lowest |
| Components | 44 | 37 | Pre-styled Bits UI |

**Key advantages:**
- Melt UI's power with simpler component ergonomics
- Zero styling opinions (no CSS resets or assumptions)
- Full creative control via class props and data attributes
- TypeScript-first with comprehensive type coverage
- Well-maintained: 2.9k GitHub stars, 12.8k dependents

**Available components:**
| Category | Components |
|----------|------------|
| Overlay | Dialog, Popover, Tooltip, Dropdown, Command |
| Form | Select, Checkbox, Radio, Switch, Slider, PIN Input |
| Navigation | Tabs, Accordion, Menu |
| Date/Time | Calendar, Date Picker, Time Field |
| Feedback | Alert Dialog, Meter, Rating Group |

## Known limitations

**Svelte 5 compatibility:**
- Svelte 5 support in preview (next.bits-ui.com)
- Historical hydration mismatch errors in early Svelte 5 previews
- Migration guide available; requires bits-ui version update
- No stable release date announced for full Svelte 5 support

**Component gaps vs Melt UI:**
- Missing: Table of Contents, Tags Input, Toast
- Trade-off: slightly larger bundle due to wrapper layer

**Ecosystem:**
- Less granular control than raw Melt UI builders
- Requires comfort with headless component patterns
- Best for teams building consistent design systems

## Related

- [unocss.md](./unocss.md) - Styling
- [../forms/superforms.md](../forms/superforms.md) - Form handling
