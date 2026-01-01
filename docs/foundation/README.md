# Foundation

Core project vision, principles, and architecture. Start here to understand what Velociraptor is and the constraints that drive every decision.

## Contents

| File | Main Topics |
|------|-------------|
| **[PRD.md](./PRD.md)** | • Project concept: documentation, test-sandbox, template<br>• Goals: speed, clean codebase, flexible UI, cross-platform, quick start<br>• Requirements: user management, versatile data, API layer, i18n<br>• Responsive strategy: mobile-first fluid responsive design |
| **[principles.md](./principles.md)** | • 7 decision constraints: libraries over services, lightweight over feature-rich, standard protocols, free tier friendly, Svelte-native first, no code generation, speed is a feature<br>• Evaluation checklist for new tools<br>• How to document exceptions |
| **[architecture.md](./architecture.md)** | • Server/client separation principle<br>• Route-based organization pattern<br>• Colocation: keep related code together<br>• Rendering strategies: SSR, SSG, SPA, No-JS concepts<br>• State layers: local, shared, server, URL<br>• Middleware pattern for cross-cutting concerns<br>• Scaling guidance: do's and don'ts |
| **[user-data.md](./user-data.md)** | • Account data: identity (private) vs profile (public)<br>• Configuration: preferences (UX) vs settings (features)<br>• User content, authorization, security data<br>• Consent & compliance, operational, derived data |
| **[progressive-revelation.md](./progressive-revelation.md)** | • Progressive Revelation (ProgRev): gradual UI unveiling<br>• FTUX → Sign-Up → Onboarding stages<br>• Guest accounts and progress persistence<br>• Achievement philosophy (every choice is valid)<br>• Accessibility requirements and anti-patterns |
| **[style.md](./style.md)** | • Style Randomization: controlled visual variation per visit<br>• Three-Axis Model: Theme × Typography × Palette<br>• What varies (decorative) vs what stays stable (critical UI)<br>• Palette and typography design principles<br>• FTUX "dice roll" concept<br>• Accessibility requirements and anti-patterns |
