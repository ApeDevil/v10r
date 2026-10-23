---
title: "Form draft recovery (kept in the browser, offered back, guarded only when lost)"
description: "What a person types into a form is kept in localStorage per account and form, stripped of credential-like fields, offered back after a closed tab or crash…"
category: "Forms & Validation"
---

# Form draft recovery (kept in the browser, offered back, guarded only when lost)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Forms & Validation · **Tier:** deep · **Maturity:** proven (verified 2026-10-23 @ a1f1074-dirty) · **Risk:** low — a failed write degrades to the old behaviour (a leave prompt), and a bad draft is discarded by type checks

What a person types into a form is kept in localStorage per account and form, stripped of credential-like fields, offered back after a closed tab or crash (never applied on its own), cleared on a valid submit; the leave prompt fires only when the draft could not be kept.

**When to use:** Use when a form takes long enough to fill that losing it to a closed tab, crash or expired session would hurt.

## Avoid when

- The form holds secrets or regulated data a shared browser must never retain, beyond what field exclusion covers
- The work must survive sign-out or move between devices — keep a server-side draft instead

## Alternatives

- **Server-side drafts with a save queue (versioned-document-session)** — prefer when the draft must survive sign-out, sync across devices or be shared
- **SvelteKit snapshots (export const snapshot)** — prefer when restoring on back/forward within one session is enough
- **Superforms taintedMessage alone** — prefer when the form is short and a leave prompt is all the protection it needs

## Docs

- [docs/blueprint/forms.md#draft-recovery](/docs/blueprint/forms) — The store, the binding, the offer, and why the guard fires only on a refused write ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/forms.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/forms.md))

## Code

- `src/lib/state/form-draft.ts` — createFormDraftStore: keying, sanitising, credential filter, injected storage ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/form-draft.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/form-draft.ts))
- `src/lib/state/form-draft.svelte.ts` — createFormDraft: Superforms binding, offer, clear on submit ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/form-draft.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/form-draft.svelte.ts))
- `src/lib/state/leave-guard.svelte.ts` — guardUnsavedChanges / leaveDecision: one beforeNavigate, native prompt on leave ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/leave-guard.svelte.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/leave-guard.svelte.ts))
- `src/lib/components/composites/draft-recovery-notice/DraftRecoveryNotice.svelte` — Restore or discard ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/components/composites/draft-recovery-notice/DraftRecoveryNotice.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/components/composites/draft-recovery-notice/DraftRecoveryNotice.svelte))

## Tests

- `src/lib/state/form-draft.test.ts` — Credential and exclusion filter, per-account keys, version and type checks, refused writes ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/form-draft.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/form-draft.test.ts))
- `src/lib/state/leave-guard.test.ts` — No prompt when clean; native prompt on leave; confirm in-app ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/state/leave-guard.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/state/leave-guard.test.ts))

## Proof

- [`/showcases/forms/advanced/draft`](/showcases/forms/advanced/draft) — Type, reload, restore; the password never comes back

## Invariants

- A draft is offered, never applied on its own, and never offered when it equals the form.
- No credential-like field and no field outside the form's shape is ever written to storage.
- Drafts are keyed per account and form; another account in the same browser sees none.
- The leave prompt fires only for work that could not be kept.

## Emulation notes

- Validate a stored draft against the form's own initial data, not a schema of its own — a form change then drops stale fields without a migration.
- Touch storage only after mount; reading it during initialisation makes the server and client renders disagree.
- Let the router own the unload prompt (cancel on type 'leave') instead of adding a beforeunload listener per form.

## Depends on

- [Superforms + Valibot foundation](/docs/pattern-library/forms-superforms-valibot)

---

_Machine-readable record: `form-draft-recovery` in `pattern-library/registry.json`._
