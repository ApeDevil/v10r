
# Intro

This project is a documentation, test-sandbox, and a template. It documents the complete 'Velociraptor' setup (features & functions), which is simultaneously a template for different projects (skeleton setup).

# Velociraptor

A tech stack. Main parts: Podman, Bun, SvelteKit.

# Goals

- Speed/performance
- clean designed codebase
- flexible UI
- optimized for Mobile & Desktop
- fast init of projects via the Velociraptor-Stack-Template

# Requirements:
- user management
- versatile DB setup (relational, graph, files)
- built-in API Gateway
- internationalization/localization: ui & content

# Responsive Strategy

**Mobile-First Fluid Responsive Design**

| Aspect | Approach |
|--------|----------|
| Base | Mobile-first (smallest viewport first) |
| Typography | Fluid with `clamp()` |
| Spacing | Fluid with `clamp()` |
| Page layout | Media query breakpoints |
| Components | CSS container queries |

Why this approach:
- Smooth scaling between breakpoints (no jarring jumps)
- Less CSS than pure breakpoint-based design
- Components adapt to their container, not just viewport
- 91%+ browser support for all techniques
- Works naturally with UnoCSS arbitrary values