# Cony memory — index

Stable, confirmed locale patterns for v10r. Session context and speculation do not belong here.

## Register (messages/*.json)

- `showcase_*` and desk/AI surfaces: German **du**; account/auth/errors/admin: German **Sie**. Match the neighbouring keys, never mix within a block.
- Russian: **вы** everywhere.
- German nouns stay capitalized even where the English chip is lowercase (`Identität`, `Fehler`); adjectives/participles follow the English case (`aktiv`, `enthalten`).
- Enum-literal chips that the code matches against stay untranslated in every locale: `ok`, `error`, `cancelled`, `quote`, `paraphrase`, `drifted`, `uncited`, `path`, `provider_source`, `unsurfaced`.

## Established terms — AI surfaces

See [ai-surface-terms.md](ai-surface-terms.md).

## Parity workflow

- No Bash: count keys with Grep `^\t"[A-Za-z0-9_]+": ` in count mode across `messages/*.json`; the three files are line-aligned, so identical line numbers for a key = identical order.
- Placeholder check: Grep `\{(name)\}` with `-o` across the three files; positions must match line for line.
