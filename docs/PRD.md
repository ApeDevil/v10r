
# Into
This project is a documentation, test-sandbox and a templale.
So we want to document the complete 'velociraptor' setup (features & functions), which is simultaniously a tempate for diferent projects (skelleton setup)

# Velociraptor
Is a tech stack, main parts: padman, bun, sveltekit

# Gaols:
- speed/perfomance
- clean designed codebase
- flexible UI
- optimized for Desktop & Mobile
- fast init of projects via the Velociraptor-Stack-Template

# Requirements:
- user management
- versatile DB setup (postgres, graph, files)
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