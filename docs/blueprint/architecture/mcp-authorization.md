# MCP Authorization — authenticated specialized MCP services

**Status:** accepted 2026-11-26 for MCP 3D, on branch `claude/cloud/mcp-3d`; not shipped.
**Supersedes:** the 2026-11-26 decision that MCP 3D is public and unauthenticated (not approved).

Velociraptor runs specialized MCP services (first: MCP 3D at `/api/mcp/3d`) that require a
Velociraptor account. An MCP host (Claude, ChatGPT, Claude Code, MCP Inspector) acts **on
behalf of a signed-in user** through standard OAuth 2.1. Velociraptor is its own
authorization server, on the Better Auth it already runs. Each service is a protected resource
with its own audience and scope. The Pattern MCP surfaces (`public`, `private`, `admin`) are
unchanged ([hosted-mcp.md](./hosted-mcp.md)).

## Contents

- [Decision](#decision)
- [Shape](#shape)
- [Adding a service](#adding-a-service)
- [Client registration](#client-registration)
- [Tokens, revocation and suspension](#tokens-revocation-and-suspension)
- [The authorization page](#the-authorization-page)
- [Connected applications](#connected-applications)
- [Quotas and worst case](#quotas-and-worst-case)
- [Refusals](#refusals)
- [CSRF](#csrf)
- [Privacy and logging](#privacy-and-logging)
- [Account lifecycle](#account-lifecycle)
- [What stays public](#what-stays-public)
- [Verification](#verification)
- [Rejected](#rejected)

## Decision

- **Authorization server:** Better Auth's `@better-auth/oauth-provider` (1.7.28) with `jwt()`
  and `@better-auth/cimd`, mounted at `/api/auth`. It is not built from scratch, and no
  external identity provider is involved (Auth0, Clerk and Keycloak bring no capability here
  that is missing). The issuer is `<origin>/api/auth`. Its RFC 8414 metadata is served at the
  path-inserted well-known URL `/.well-known/oauth-authorization-server/api/auth`.
- **Protected resources:** one per service, its identifier being the service URL
  (`<origin>/api/mcp/3d`) and its scope `mcp:<id>:use`. RFC 9728 metadata is served at
  `/.well-known/oauth-protected-resource/api/mcp/3d`.
- **Flow:** authorization code with PKCE S256 (required for every client), RFC 8707
  `resource` on both requests, RFC 9207 `iss` in the response, refresh with rotation for
  public clients.
- **Scopes:** the service scopes plus `offline_access`. There is no `openid`, `profile` or
  `email`: the application learns nothing about the account beyond an opaque `sub`.

## Shape

| Piece | Where |
|---|---|
| The services, their scope, audience and token lifetimes | `src/lib/server/auth/protected-mcp-services.ts` |
| Authorization server configuration | `src/lib/server/auth/index.ts` (`jwt`, `oauthProvider`, `cimd`) |
| The check in front of a service (`verifyResourceAccess`) | `src/lib/server/auth/resource-access.ts` |
| Liveness, revocation, the list a user reviews | `src/lib/server/auth/application-authorizations.ts` |
| How far a client's identity is established | `src/lib/server/auth/application-identity.ts` |
| Sign-in that resumes the authorization request | `src/lib/server/auth/authorization-request.ts`, `src/lib/continue-after-sign-in.ts` |
| Authorization page | `src/routes/[[locale=locale]]/auth/authorize/` |
| Connected applications page | `src/routes/[[locale=locale]]/account/connections/` |
| Metadata endpoints | `src/routes/.well-known/oauth-{authorization-server/api/auth,protected-resource/api/mcp/3d}/` |
| Tables | `src/lib/server/db/schema/auth/oauth-provider.ts` (`auth.oauth_*`, `auth.jwks`) |

## Adding a service

1. Add a `ProtectedMcpService` entry: `{ id, name, path, scope }`. The authorization server
   seeds its resource on boot (`resourceSeedMode: 'overwrite'`), adds the scope to
   `scopes_supported`, and links every newly registered client to it.
2. Serve its protected resource metadata at `/.well-known/oauth-protected-resource<path>`
   (copy the 3D route).
3. In the endpoint, call `verifyResourceAccess(request, SERVICE)` before parsing anything,
   and key per-account limits by `caller.userId`.
4. Add a scope line to the authorization page (`auth_authorize_scope_*`).
5. Register the endpoint in `authz-coverage.gate.test.ts`, which classifies it through the
   `oauth-resource` scheme without needing an allowlist entry.

A token for one service is refused by another (audience). A user authorizes each application
per service, and each authorization appears and is revoked on one page.

## Client registration

| Mechanism | Who uses it (researched 2026-11) | Trust established | Abuse surface | Verdict |
|---|---|---|---|---|
| **Client ID Metadata Document** (CIMD) | MCP 2025-11-25+ preferred. Claude Code (`https://claude.ai/oauth/claude-code-client-metadata`), ChatGPT (`https://chatgpt.com/oauth/client.json`) | The client controls the HTTPS domain its `client_id` names | An outbound fetch per new client: SSRF-safe fetcher (`@better-auth/cimd/node`), no redirects, size and time bounded, cached | **Primary** |
| **Dynamic Client Registration** (RFC 7591) | Claude web/desktop and MCP Inspector still use it; most hosts fall back to it | None: name, URI and logo are self-declared | Unauthenticated writes of `oauth_client` rows | **Kept, bounded** |
| **Pre-registration** | Hosts that let a user paste a client id and secret | An operator vetted the client | None at runtime | Not used: every host would need a manual step, and Claude's custom-connector flow does not need it |

DCR is bounded as follows:
- It is unauthenticated by necessity, because a host has no account here.
- It is limited by the plugin's per-IP register limit (30/min) under the app's machine-endpoint bucket (`OAUTH_MACHINE_RATE_LIMIT_*`, 300/min per IP across token, register, revoke and jwks).
- Only `OAUTH_SCOPES` may be requested.
- Redirect URIs are matched exactly. Plain `http` is refused except on loopback.
- Loopback redirects are classified native (`clientRegistrationDefaultApplicationType: 'infer'`, RFC 8252). Without this, MCP Inspector and Claude Code's DCR path fail with `invalid_redirect_uri`, which the PGlite flow test found.
- A registration without a user's authorization reaches nothing.

The registered-client table can grow from abuse, but rows are small and inert. A retention job
for clients that were never authorized is deferred until it is observed.

## Tokens, revocation and suspension

- **Access token:** a JWT, because every MCP client sends `resource`, and a token with an
  audience is a JWT in Better Auth. It lives 15 minutes (`MCP_ACCESS_TOKEN_TTL`). It is verified
  in-process by upstream's `verifyAccessTokenRequest` against the instance's own JWKS
  (signature, `iss`, `aud`, `exp`, required scope).
- **Refresh token:** opaque, hashed at rest. It lives 30 days and is rotated on every use, so a
  spent token is refused. The resource's `allowedScopes` must include `offline_access`, because
  the plugin filters protocol scopes by it too; without it the first refresh returns no new
  refresh token. The PGlite test pins this.
- **Liveness:** a JWT stays valid until `exp`. So every protected request also runs one indexed
  query, which checks that the user exists and is not banned AND that this client's
  authorization still contains the scope (`checkApplicationAuthorization`).
- **Revocation window: the next request.** Revoking deletes the authorization, the access
  tokens and the refresh tokens of that (user, client) in one transaction. Upstream's
  `delete-consent` leaves refresh tokens alive, which is why the revocation is ours. The
  test asserts that the very next call is refused with 401 `invalid_token` and that the old
  refresh token is dead.
- **Suspension window: the next request.** A ban (`user.banned`) fails the same liveness query.

The cost is one database round trip per MCP call. That is the price of an immediate revocation
without introspection. A short-lived cache would reopen the window by its TTL, so there is none.

## The authorization page

`/auth/authorize`, reached by the plugin's redirect with a signed query:

- **Identity as far as it is known.** A CIMD client shows **Verified domain** plus the domain.
  A domain on the recognized list (`claude.ai` → Claude, `chatgpt.com` → ChatGPT) is
  recognized by the verified domain, never by the name. A DCR client shows **Self-declared,
  not verified** even when it calls itself "ChatGPT". The PGlite test registers exactly that.
- **Untrusted metadata:**
  - names are stripped of control and bidi characters and capped at 80 characters;
  - logos are never fetched or rendered;
  - `client_uri` is a hint only if it is HTTPS;
  - the page shows where the browser returns: the redirect host, or "a program on this device" for loopback.
- **Both directions of reach:** what the application may do (per scope), and what it does
  not get (password, email, profile, the rest of the account).
- **Signed out:** the plugin sends the user to `/auth/login` with the signed request. The login
  page turns that into `returnTo=/api/auth/oauth2/authorize?<original request>`. All five
  sign-in paths already honour `returnTo` (magic link, code, GitHub, Google, passkey). The
  endpoint revalidates everything once there is a session.
- A repeat authorization of the same client for the same scopes skips the page, which is
  standard. Revoking makes the page appear again.

## Connected applications

`/account/connections` (an account tab) lists every application authorization:
- identity badge;
- services;
- "stays connected" when a refresh token is held;
- authorized and last-renewed dates.

Each entry has **Revoke**. A confirm dialog states the consequence before anything happens.
No token, hash or secret reaches the page. The list is service-agnostic.

## Quotas and worst case

| Layer | Limit (`MCP_3D_QUOTA`) | Keyed by | Why |
|---|---|---|---|
| Entry | 300/min | IP (/64 for IPv6) | Cheap hygiene before the token check. Generous because hosts call from shared egress (Claude: `160.79.104.0/21`) |
| Resource access | — | token | 401/403 before any body is parsed |
| Account rate | 30/min | `user:<id>` | Several clients of one user share one allowance. A shared host IP is never the quota identity |
| Account allowance | 1 000/day | `user:<id>` | Bounds one account's daily compute |
| Surface | 600/min | all | Many accounts cannot add up to unbounded compute |
| In flight | 4 per instance, 2 per account | instance memory | Stops a burst stacking WASM heaps on one instance |
| Per call | schema, size estimate, 100 000 triangles, 2.5 MB GLB, 8 s deadline, `maxDuration` 30 s | — | `MCP_3D_BUDGET`, `MCP_3D_RUN_MS` |

Rate limits use Upstash and fail closed in production when Redis is unavailable
(`rate-limit.ts`). The in-flight bound is per instance by design.

**Worst case (estimated, not load-tested):**
- **Measured inputs:** the heaviest example runs in under 260 ms at p95 with about 220 MiB peak RSS ([parametric-modeling.md](../3d/parametric-modeling.md) § Performance).
- **One account at its ceiling:** 30 calls/min. Pathological models are stopped at the 8 s deadline, so that is 4 CPU-minutes per minute, capped by 2 in flight. That means at most 16 CPU-seconds per minute per instance pair, and 1 000 calls a day.
- **The surface ceiling:** 600 calls/min, which is about 2.6 CPU-minutes per minute at the measured p95. The pathological bound is 80 CPU-minutes per minute, where the in-flight bound forces about 20 instances. Reaching it needs at least 20 accounts each holding 30/min, and every account needs a verified email (sign-in is passwordless, with ALTCHA and the auth limiter in front).
- **Remaining exposure:** the cost of instances spun up by many sign-ups. The lever, if it is ever observed, is the surface ceiling or the daily allowance, not authentication.

## Refusals

| Situation | Answer |
|---|---|
| No `Authorization` header | 401, `WWW-Authenticate: Bearer resource_metadata="<PRM URL>", scope="mcp:3d:use"`, JSON body, never a redirect |
| Bad signature, wrong issuer or audience, expired, garbage | 401 `invalid_token` |
| Valid token without the service scope | 403 `insufficient_scope` |
| Authorization revoked, account banned or deleted | 401 `invalid_token` with a description (the host's refresh then fails, and it re-authorizes) |
| JWKS or database unavailable | 503 `temporarily_unavailable`, `Retry-After`. Never an unauthenticated fallback |
| Over a limit | 429 with `Retry-After`. The daily allowance says so |
| At capacity (in flight) | 503 `busy`, `Retry-After: 2` |

Every JSON-RPC method needs the token, including `initialize`, `tools/list` and the app-only
`render_model`. The flow test sends each without one and expects 401.

## CSRF

`/api/mcp/*` stays CSRF-exempt (`security/csrf.ts`). The exemption is sound because **no MCP
endpoint reads the session cookie**:
- admin and private take a static bearer;
- 3D takes an OAuth access token in the `Authorization` header;
- public is read-only and unauthenticated.

A cross-site request carries nothing to abuse. The comment on the exemption now says this and
forbids a `locals.user` fallback on any MCP route. The authorization page itself is a
SvelteKit form action (origin-checked by SvelteKit), and the consent endpoint is Better Auth's
(its own CSRF).

## Privacy and logging

- Nothing in the authorization path logs a token, code, secret, PKCE verifier or the
  `Authorization`/`Cookie` headers. Refusals carry fixed descriptions.
- MCP 3D mounts `noopMcpObserver`: no `mcp.call_log` row, no model argument in any log or
  trace. The authorization rows hold client id, scopes, resources and dates, never a model.
- Rate-limit keys are ids (`user:<id>`, `ip:<normalized>`).
- The Art. 15 export (`privacy/report.ts`, schema `2026-11-26`) gains
  `applicationAuthorizations`: client id, declared name, scopes, resources, dates.

## Account lifecycle

- **Suspension (ban):** refused on the next request (liveness). New sessions are already refused
  at creation, so the user cannot re-authorize.
- **Deletion:** every `oauth_*` table references `auth.user` with `ON DELETE CASCADE`.
  Authorizations and tokens go with the account (tested), and outstanding JWTs fail liveness.
- **GDPR erasure** is the deletion above. The registered client rows are not personal data
  (a DCR client has no owner here).

## What stays public

- Model links (`/3d/view#m1.…`) and the native viewer: the model travels in the fragment, so
  no token is ever in a URL.
- Browser-local generation and export.
- The docs, the showcase, and both metadata documents.

There is no unauthenticated route into the modeling tools.

## Verification

| Claim | Evidence |
|---|---|
| Full flow (DCR and CIMD), audience, scope, refresh rotation, revocation, ban, deletion, every method refused without a token | `src/lib/server/auth/mcp-authorization.pglite.test.ts`: 20 cases against the real Better Auth instance and Postgres (PGlite) |
| Identity labelling, the resume path, the in-flight bound | `application-identity.test.ts`, `authorization-request.test.ts`, `in-flight-limit.test.ts` |
| Every endpoint classified | `authz-coverage.gate.test.ts` (`oauth-resource` scheme, metadata endpoints allowlisted with reasons) |
| Hosts (Claude, ChatGPT, Claude Code, Inspector) against a deployment | **Not verified.** Needs a reachable deployment with this schema. See the report for the manual steps |

## Rejected

- **Public, unauthenticated MCP 3D:** not approved.
- **An authorization server built from scratch, or an external IdP:** Better Auth covers every
  requirement above with maintained code (the official-implementations default, [mcp-evolution/decision-record.md](./mcp-evolution/decision-record.md) D10).
- **Cookie auth on the MCP endpoint:** it would make the CSRF exemption unsound and bind the
  endpoint to a browser.
- **Opaque tokens with introspection per call:** an HTTP round trip to ourselves, for the same
  liveness property the indexed query gives.
- **Caching liveness:** it reopens the revocation window by the cache TTL.
- **Tokens in model links:** links are shareable by design and are not private.
