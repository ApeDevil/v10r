# Foundation

Core project vision, principles, and architecture. Start here to understand what Velociraptor is and the constraints that drive every decision.

## Contents

| File | Main Topics |
|------|-------------|
| **[PRD.md](./PRD.md)** | • Project concept: documentation, test-sandbox, template<br>• Goals: speed, clean codebase, flexible UI, cross-platform, quick start<br>• Requirements: user management, versatile data, API layer, i18n<br>• Responsive strategy: mobile-first fluid responsive design |
| **[principles.md](./principles.md)** | • 7 decision constraints: libraries over services, lightweight over feature-rich, standard protocols, free tier friendly, Svelte-native first, no ungated code generation, speed is a feature<br>• Evaluation checklist for new tools<br>• How to document exceptions |
| **[architecture.md](./architecture.md)** | • Server/client separation principle<br>• Route-based organization pattern<br>• Colocation: keep related code together<br>• Rendering strategies: SSR, SSG, SPA, No-JS concepts<br>• State layers: local, shared, server, URL<br>• Middleware pattern for cross-cutting concerns<br>• Scaling guidance: do's and don'ts |
| **[user-data.md](./user-data.md)** | • Account data: identity (private) vs profile (public)<br>• Configuration: preferences (UX) vs settings (features)<br>• User content, authorization, security data<br>• Consent & compliance, operational, derived data |
| **[explosive-discovery.md](./explosive-discovery.md)** | • Explosive Discovery: capability nested by meaning, revealed as intent becomes specific<br>• Three names: progressive disclosure (intent) · Explosive Discovery (principle) · Nested Depth (structure)<br>• Depth axis (one page, one moment — built in the desk) and journey axis (first visit → sign-up → onboarding — a direction)<br>• Eight invariants to emulate; anti-goals<br>• Accessibility requirements |
| **[self-expressive-project.md](./self-expressive-project.md)** | • The project represents the system: names, structure, schema and constraints explain it; docs and comments explain the why<br>• Five facets — code, architecture, data model, comments, one source of truth — and the gate that enforces each<br>• Why prose drifts and gates do not<br>• Checklist per kind of change; anti-patterns (bucket files, god-config, unbound mirrors) |
| **[style.md](./style.md)** | • Style Randomization: controlled visual variation per visit<br>• Three-Axis Model: Theme × Typography × Palette<br>• What varies (decorative) vs what stays stable (critical UI)<br>• Palette and typography design principles<br>• FTUX "dice roll" concept<br>• Accessibility requirements and anti-patterns |
| **[development-environment.md](./development-environment.md)** | • Container-first workflow: Podman + Bun, no host installations<br>• Adding dependencies: edit `package.json` → restart container<br>• Container commands: start, stop, restart, shell access<br>• Volume mounts: project files + isolated node_modules<br>• Troubleshooting: fresh start, logs, rebuilding |
