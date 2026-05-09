# Translation Glossary

A small file that anchors voice across locales. Read it before each translation pass; consult the term-lock table when a recurring noun could go either way. Update it when a decision is made; don't re-decide twice.

## Do not translate

- Velociraptor (product name; never localize)
- v10r (codename)
- Cony, Arty, Uxy, Ary, Sys, Svey, Daty, Apy, Resy, Scout, Tray, Tesy, Buny, Aiy, Archy, Clyn, Docy, Secy (agent names)
- SvelteKit, Svelte, Bun, Drizzle, Paraglide, Bits UI, UnoCSS, Valibot, Superforms, Postgres, Neon, Neo4j, R2 (technology names)

## Per-locale voice

- de: Sie register, formal but warm. Avoid rigid bureaucratic German; the tone is "well-organized friend who happens to know the system." Use Anglicisms only when the German equivalent is genuinely worse.
- ru: вы register, technical-precise. Russian translations should sound like a careful technical writer, not a marketer. Prefer the verb-noun pair that best matches the action's actual semantics over a literal calque.

## Term lock

| en | de | ru |
|----|----|----|
| post | Beitrag | пост |
| draft | Entwurf | черновик |
| published | veröffentlicht | опубликовано |
| archived | archiviert | в архиве |
| tag | Schlagwort | тег |
| author | Autor:in | автор |
| revision | Revision | ревизия |
| preview | Vorschau | предпросмотр |
| push | übertragen | отправка в БД |
| translation | Übersetzung | перевод |
| locale | Sprache | язык |
| content | Inhalt | контент |
| sign in | anmelden | войти |
| sign out | abmelden | выйти |
| settings | Einstellungen | настройки |

## Notes

- Empty cells in the term lock mean "not yet decided" — fix it the first time you encounter the term, then update this table so the next pass doesn't re-debate.
- If the term lock conflicts with what feels right in context, prefer context — but escalate to update this file so the conflict surfaces.
