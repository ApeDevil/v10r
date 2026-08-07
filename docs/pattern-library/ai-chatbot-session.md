---
title: "Persistent minimizable chatbot session"
description: "A client-side Svelte state machine keeps Vely's conversation alive across page navigation, minimizing the panel instead of closing it when the user follows a…"
category: "AI"
---

# Persistent minimizable chatbot session

> Generated from `mcp/patterns.registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

_Index card — the docs below are the canonical explanation; deep-tier pattern pages additionally carry invariants and emulation notes._

**Category:** AI · **Tier:** light · **Risk:** low — client-side state only, no external calls

A client-side Svelte state machine keeps Vely's conversation alive across page navigation, minimizing the panel instead of closing it when the user follows a link.

**When to use:** Use when a floating chat widget must survive route changes and reloads without losing the live thread.

## Docs

- [docs/blueprint/ai/persistent-chatbot.md](/docs/blueprint/ai/persistent-chatbot) ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/ai/persistent-chatbot.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/ai/persistent-chatbot.md))

## Code

- `src/lib/state/chatbot-session.svelte.ts` ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/chatbot-session.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/chatbot-session.svelte.ts))

---

_Machine-readable record: `ai-chatbot-session` in `mcp/patterns.registry.json`._
