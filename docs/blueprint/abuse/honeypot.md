# Honeypot

Two-signal bot detection that requires no user interaction: a hidden field that bots fill and a minimum-fill-time check that bots fail.

---

## Constants (`$lib/server/abuse/honeypot.ts`)

| Constant | Value | Purpose |
|----------|-------|---------|
| `HONEYPOT_FIELD_NAME` | `'bookmark'` | Hidden field name in the form |
| `HONEYPOT_MIN_FILL_MS` | `2000` | Minimum elapsed time (ms) between render and submit |

The field name `bookmark` was chosen to avoid common bot blocklists (`website`, `url`, `homepage`). Rotate it if a form starts seeing zero honeypot blocks — a sign of a form-aware scraper.

---

## `checkHoneypot(input)`

```typescript
import { checkHoneypot } from '$lib/server/abuse';

const decision = checkHoneypot({
    honeypot: form.data.bookmark,   // value of the hidden field
    renderedAt: form.data.renderedAt, // server timestamp stamped at load time
});
if (!decision.allowed) return fail(400, { form });
```

Returns `{ allowed: true }` or `{ allowed: false, layer: 'honeypot', status: 400, reason: string }`.

Two denial conditions:

1. `honeypot` is non-empty — the hidden field was filled
2. `Date.now() - renderedAt < 2000` — submitted faster than a human can

Both are silent to the submitter: they receive a generic 400, not a "bot detected" message.

---

## Form Wiring

The hidden `bookmark` field must be present in the form markup and excluded from the Valibot schema's visible fields. The `renderedAt` timestamp is stamped server-side in the `load` function and injected as a hidden input.

Currently wired on: **feedback form** (`/feedback`).

---

## Related

- [captcha.md](./captcha.md) — proof-of-work layer for auth flows
- [Live showcase](/showcases/abuse/honeypot)
