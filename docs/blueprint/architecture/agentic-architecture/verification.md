# Agentic architecture — local verification before shipping

The one procedure for verifying the release candidate on your machine: what to set up, the one
command that runs every automated check and gives the ship verdict, and the short list of checks
only a human can do, each with what you must see. The cloud ran everything that needs no
provider key, database, signed-in browser or live peer; this covers the rest.

Why local and no preview: Vercel deploys `main` only, and the deployment policy stays as it is.
A preview of this branch would need a second Vercel project or preview deployments switched on,
with their own database and secrets — a policy change, not a review step.

Keys and cookies stay on your machine. Nothing here asks you to paste a credential anywhere but
your own shell, and the verification record never contains one.

## 1. Environment

**The exact commit.** Check out the release-candidate commit named in the RC report and confirm
it, so the record is of that commit:

```bash
git fetch origin claude/cloud/agentic-architecture
git switch claude/cloud/agentic-architecture
git rev-parse HEAD                       # must equal the RC commit in the report
git status --porcelain                   # must be empty: a dirty tree blocks the strict verdict
```

**Container dependencies.** The lockfile is the RC's; install exactly it:

```bash
podman exec v10r bun install --frozen-lockfile
```

**Local database.** Adds `ai.agent_external_operation`, `ai.mcp_peer`, `ai.mcp_peer_tool` and the
enums `agent_external_protocol`, `agent_external_operation_status`, `agent_external_delivery`,
`mcp_peer_audience`, `external_reversibility` — all additive:

```bash
podman exec v10r bun run db:push         # your LOCAL database only — never production
```

Production is changed only by the explicit, separately authorized step in the RC report
(`docs/stack/ops/cloud-database-changes.md`), never by `db:push`.

**Dev server.** Restart it (new i18n keys 500 on a running Vite process):

```bash
podman exec v10r bun run dev             # http://localhost:5173
```

**Provider.** In the local app, Admin → AI → Models: save the provider connection and model you
ordinarily use. The key lives in your local database; the eval runner never sees it (it drives
the running server), and the record lists only the provider and model ids the turns used.

**Session cookie** (for the eval turns). Sign in, then DevTools → Application → Cookies → copy the
value of `better-auth.session_token`. Read it into the shell without echo or history:

```bash
read -rs V10R_COOKIE_VALUE && export V10R_COOKIE="better-auth.session_token=${V10R_COOKIE_VALUE}"
```

**Optional environment** (`.env`; unset turns the feature off):

| Variable | For | Value |
|---|---|---|
| `ADMIN_USER_ID` | `/admin/ai/peers` | your user id |
| `MCP_PEER_SECRET_<NAME>` | an MCP peer's bearer | the peer's token (referenced by name on the admin page) |
| `A2A_DELEGATION_PEERS` | assistant delegation | JSON list, see `.env.example` |
| `A2A_PEER_SECRET_<NAME>` | an A2A peer's bearer | the peer's token |
| `AG_UI_RESULT_TICKET_SECRET` | AG-UI tool-result tickets | any 32+ random chars (derived from `BETTER_AUTH_SECRET` otherwise) |

**Reference peers** (for the manual checks 4 and 5; disposable data only). The admin page stores
https endpoints only and the guard refuses private addresses, so each runs behind a tunnel with
a public https name:

```bash
uv run --with mcp==2.3.0 python scripts/mcp-client/peer/server.py 8765          # MCP notebook peer
cloudflared tunnel --url http://localhost:8765                                   # → https://<mcp-tunnel>
uv run --with a2a-sdk==1.3.1 python scripts/a2a/peer/performance_agent.py --port 9999   # A2A reviewer
cloudflared tunnel --url http://localhost:9999                                   # → https://<a2a-tunnel>
```

For the A2A peer set `A2A_DELEGATION_PEERS='[{"id":"perf","label":"Performance reviewer","origin":"https://<a2a-tunnel>","skills":["performance-review"],"auth":{"kind":"none"}}]'`
(the skill id its card lists) and restart the dev server.

## 2. The one command

```bash
mkdir -p test-results/agentic                                      # git-ignored
cp scripts/agentic/manual-checks.template test-results/agentic/manual.txt   # attest after section 3
podman exec -e V10R_COOKIE="$V10R_COOKIE" -e V10R_MANUAL=test-results/agentic/manual.txt v10r \
  scripts/agentic/verify.sh strict
scripts/agentic/verify.sh claude                                    # on the host: the B1 compat kit (optional)
```

`strict` runs every tier and gives the ship verdict; the development tiers stay for iterating
(`offline`, `server`, `providers`, `claude`, `all`). Each step is **Mandatory** (for shipping) or
**Optional**, and ends **Passed**, **Failed**, **Skipped** (an optional step whose prerequisite is
missing) or **Externally blocked** (a mandatory step whose prerequisite is missing).

| Step | Tier | Requirement | Needs | Expected |
|---|---|---|---|---|
| `validate` | offline | Mandatory | nothing | typecheck, lint, every test incl. the cross-protocol scenario, registry, skills, i18n |
| `validate:build` | offline | Mandatory | nothing | production build; perf ratchets within ceilings |
| `a2a:interop` | offline | Mandatory | `uv` | 24/24 against the Python `a2a-sdk` |
| `mcp:client:interop` | offline | Mandatory | `uv` | 20/20 against Python FastMCP and the v10r server |
| `genui:bench --check` | offline | Mandatory | nothing | bench report current |
| `mcp:apps:check` | offline | Mandatory | nothing | View document current |
| `skills:check` | offline | Mandatory | nothing | skills in sync and spec-valid |
| `mcp:conformance` | server | Mandatory | dev server | within its baseline |
| browser specs | server | Mandatory | dev server | all pass (`interop-lab.spec.ts`: 9 sections, scenario 8/8, a surface renders) |
| `ai:eval` generative UI cases | providers | Mandatory | provider + cookie | at or above the floor |
| `ai:eval` full golden set | providers | Mandatory | provider + cookie | at or above the floor |
| Claude Code compat kit | claude | Optional | Claude Code signed in | control connects and calls on both transports; record the B1 verdict |

**Ship-ready** only when every mandatory step passed, every mandatory manual check (section 3) is
attested `pass` in `V10R_MANUAL`, and the tree is clean. A mandatory step that could not run is
**never** a pass: the verdict is *not ship-ready* (exit 3). Any failure fails (exit 1).

Every run writes `test-results/agentic/verify-<tier>-<time>.json` (git-ignored): the commit, the
branch, whether the tree was clean, the platform, Bun, Node, `uv` and Claude Code versions,
container or not, the base URL origin, each step with its requirement, status and duration, the
provider/model ids the eval turns used (from their traces), and the manual attestations. It
holds no cookie, key or token. Send that file with your result.

## 3. By hand — what no script covers

Each step lists what to do and what you must see; attest each id in your copy of
`manual-checks.template`. Screenshots of the Lab are in the project files
(`agentic-architecture/previews/`).

| Id | Requirement |
|---|---|
| `vely-grounded`, `genui-form`, `deskbot-approve-revert`, `mcp-peer`, `a2a-delegation`, `ag-ui`, `mcp-apps-inspector` | Mandatory |
| `mcp-apps-hosts`, `webmcp`, `skills-production` | Optional |

1. **`vely-grounded` — AI SDK v7 chatbot turn.** Open the site's assistant (Vely), ask "Which
   pattern handles approvals for AI tool calls?". *Expect* a streamed answer with pattern chips;
   Admin → AI → turns shows the model calls and tool executions, with your provider and model.
2. **`genui-form` — generative UI in chat.** Ask Vely "Help me scope a new project, ask me the
   questions in a form". *Expect* a form surface in the reply. Fill it and press its button →
   one user row "Sent from the view: …" (not the wrapped prompt) and a follow-up answer.
   Reload → the same surface and the same bubble text are restored. Press the same button again
   with the same values → *refused as a repeat*, no second turn.
3. **`deskbot-approve-revert` — deskbot approval and revert.** In `/desk`, grant `desk:write`, ask
   the bot to change a cell in a spreadsheet. *Expect* a plan card; Approve → the cell changes
   and a receipt appears; Undo → the cell is back and the receipt says reverted.
4. **`mcp-peer` — live MCP peer.** On `/admin/ai/peers`: save the peer
   (`https://<mcp-tunnel>/mcp`, audience `user`), Test → *connected*, Discover → six tools with
   fingerprints, activate `note_read` (mutates off) and `note_write` (mutates on, fields `key`,
   `value`). In `/desk` ask "Store a note called demo with the value hello in the external
   notebook". *Expect* an external-operation card with separate rows for the peer, the
   destination, the operation, the fields and size, credential none, "May change data on the
   peer", the reversibility and the one-time authorization; the **compact preview**; and the
   **complete outgoing arguments** section with every value whole, the argument digest, and
   nothing credential-shaped. Run → receipt `succeeded`, delivery `sent`. Ask to read it back:
   a second card, for the read. Revoke the peer and ask again → nothing is mounted. Call
   `rotate_contract` through the peer → the tool is withheld for drift until re-activated.
5. **`a2a-delegation` — live A2A delegation.** With the A2A peer configured (section 1), in
   `/desk` with `desk:read`, paste an Architecture Studio export and ask for an independent
   performance review. *Expect* a card for `delegate_architecture_review`: the complete outgoing
   arguments (the whole model) and, under "Added by v10r beside the arguments",
   `metadata.skill` and `metadata.v10r.delegationDepth = 1`. Run → a receipt with
   "Remote task: <id>" and the findings reported as the peer's claim. A second request in the
   same turn is refused by the budget.
6. **`ag-ui` — AG-UI.** `podman exec v10r bun run test -- src/routes/api/ai/ag-ui` covers the
   sequences with the official `HttpAgent`; for the live check point an AG-UI client at
   `POST /api/ai/ag-ui/deskbot` with your cookie. *Expect* `RUN_STARTED … RUN_FINISHED`, a
   `CUSTOM v10r.proposal` for a write, and a refusal for a forged tool result or a `state`.
7. **`mcp-apps-inspector` — MCP Apps.** `npx @modelcontextprotocol/inspector` → Streamable HTTP
   `http://localhost:5173/api/mcp/public` → call `explore_patterns` with
   `{"id":"ai-mcp-client"}`. *Expect* the explorer View rendered and clickable; a text-only
   client gets the same answer as text.
8. **`mcp-apps-hosts`** (optional). Claude, ChatGPT and VS Code are **untested hosts**: record a
   host only after a run there.
9. **`webmcp`** (optional, experimental). Needs a browser that ships `navigator.modelContext`. On
   `/showcases/interop`, switch on consent. *Expect* only `read`/`view` actions registered,
   unregistered on switching off; elsewhere the Lab shows "Not available here". The Desk
   refactor will move the action registration; nothing here depends on the current Desk.
10. **`skills-production`** (optional, after a deploy). `npx skills add https://v10r.dev --list`
    lists the skills from `/.well-known/agent-skills/index.json`; `-s <name>` installs one and
    its sha256 matches the index entry. Before a deploy, the same against
    `http://localhost:5173`.

## 4. B1: tool `title` and `readOnlyHint` (not enabled, not a ship blocker)

On the host, with your **ordinary** Claude Code configuration and default model (do not set
`V10R_COMPAT_MODEL`):

```bash
scripts/mcp/claude-code-compat/check.sh --call
```

It covers the field sets none (control), `title`, `readOnlyHint`, both and `_meta.ui`, over
stdio and the hosted HTTP transport, and prints per case the status, the tools kept, whether the
tool was called, the protocol era Claude Code spoke (`legacy(<version>)` or
`modern(2026-07-28)`) and the model the session ran on. Record the verdict as the runbook says
([claude-code-compat.md](../mcp-evolution/claude-code-compat.md)); enabling the fields is a
separate change after a pass. Annotations never decide authorization either way.

## 5. What stays unverified until you run it

Live provider turns (v7 chatbot, deskbot, the 8 genui cases and the golden set), the live MCP
and A2A peers through the UI including the complete-arguments inspection, AG-UI with a live
client, the MCP Apps View in the Inspector, any MCP App host other than the Inspector, B1 with
your configuration, the skills install from production, and WebMCP in a browser. The cloud runs
recorded these as not run; none is claimed.
