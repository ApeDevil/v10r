# PRD

## What is Velociraptor

Documentation, test-sandbox, and reusable template in one. The project simultaneously:
- Documents the complete stack (features & patterns)
- Serves as a test environment to validate decisions
- Provides a skeleton for new projects

## Goals

| Goal | Description |
|------|-------------|
| Speed | Fast runtime, fast builds, fast user experience |
| Clean codebase | Maintainable, well-organized, minimal complexity |
| Flexible UI | Adaptable to different use cases and designs |
| Cross-platform | Optimized for mobile and desktop |
| Quick start | Fast project initialization from template |

## Requirements

| Requirement | Description |
|-------------|-------------|
| User management | Authentication, sessions, roles |
| Versatile data | Relational, graph, and file storage |
| API layer | Built-in API capabilities |
| i18n/l10n | UI and content localization |

## Responsive Strategy

**Mobile-First Fluid Responsive Design**

| Aspect | Approach |
|--------|----------|
| Base | Mobile-first (smallest viewport first) |
| Typography | Fluid scaling with `clamp()` |
| Spacing | Fluid scaling with `clamp()` |
| Page layout | Media query breakpoints |
| Components | CSS container queries |

**Why this approach:**
- Smooth scaling between breakpoints (no jarring jumps)
- Less CSS than pure breakpoint-based design
- Components adapt to their container, not just viewport
- 91%+ browser support for all techniques

See [stack/](../stack/) for specific technology choices that implement these goals.