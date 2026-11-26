---
title: "Authenticated MCP services (OAuth 2.1 protected resources on Better Auth)"
description: "A specialized MCP service that needs a user account becomes an OAuth protected resource with its own audience and scope, and the app becomes its own OAuth 2.1…"
category: "Architecture & Request Pipeline"
---

# Authenticated MCP services (OAuth 2.1 protected resources on Better Auth)

> Generated from `pattern-library/registry.json` — do not edit by hand; change the registry and run `bun run patterns:build`.

**Category:** Architecture & Request Pipeline · **Tier:** deep · **Maturity:** implemented · **Risk:** high — an authorization server; verified in-process against the real library, not yet against any real MCP host or a deployment

A specialized MCP service that needs a user account becomes an OAuth protected resource with its own audience and scope, and the app becomes its own OAuth 2.1 authorization server on the Better Auth it already runs — PKCE, RFC 9728/8414 discovery, resource-bound JWT access tokens with a per-request liveness check, Client ID Metadata Documents first and bounded Dynamic Client Registration, an authorization page that labels untrusted client metadata, and a connected-applications page whose revoke takes effect on the next request.

**When to use:** Use when an MCP host (Claude, ChatGPT, an IDE agent) should call one of your MCP endpoints on behalf of a signed-in user of your app, with per-user quotas, consent the user can review and revoke, and no static shared secret.

## Avoid when

- The surface is read-only and reveals nothing per user — keep it public and rate-limited
- Only the operator's own tools call it — a static bearer realm (the private Pattern MCP) is simpler
- The app has no user accounts — there is no one for the host to act on behalf of

## Alternatives

- **A static bearer token per deployment** — prefer when the only caller is the operator's own projects and per-user identity does not matter
- **An external identity provider as the authorization server (Auth0, Keycloak, Clerk)** — prefer when the app's own auth cannot issue OAuth tokens, or enterprise federation is the requirement
- **Public endpoint with IP rate limits** — prefer when the service reads and writes nothing per user and abuse is not observed

## Docs

- [docs/blueprint/architecture/mcp-authorization.md](/docs/blueprint/architecture/mcp-authorization) — Decision record: shape, adding a service, registration comparison, tokens and revocation window, authorization page, quotas and worst case, refusals, CSRF, privacy, account lifecycle ([GitHub](https://github.com/ApeDevil/v10r/blob/main/docs/blueprint/architecture/mcp-authorization.md) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/docs/blueprint/architecture/mcp-authorization.md))

## Code

- `src/lib/server/auth/protected-mcp-services.ts` — One entry per protected service: id, path, scope; audience and metadata URL derive from it ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/protected-mcp-services.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/protected-mcp-services.ts))
- `src/lib/server/auth/resource-access.ts` — verifyResourceAccess: challenge, upstream JWT verification, liveness; protected resource metadata ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/resource-access.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/resource-access.ts))
- `src/lib/server/auth/application-authorizations.ts` — Liveness query, one-transaction revocation, the list a user reviews ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/application-authorizations.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/application-authorizations.ts))
- `src/lib/server/auth/application-identity.ts` — Verified domain vs self-declared, recognized by domain never by name ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/application-identity.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/application-identity.ts))
- `src/lib/server/auth/index.ts` — jwt + oauthProvider + cimd configuration ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/index.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/index.ts))
- `src/routes/[[locale=locale]]/auth/authorize/+page.svelte` — The authorization page ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/auth/authorize/+page.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/auth/authorize/+page.svelte))
- `src/routes/[[locale=locale]]/account/connections/+page.svelte` — Connected applications with revoke ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/[[locale=locale]]/account/connections/+page.svelte) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/[[locale=locale]]/account/connections/+page.svelte))
- `src/routes/api/mcp/3d/+server.ts` — A protected service: entry limit, resource access, per-account limits, in-flight bound ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/routes/api/mcp/3d/+server.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/routes/api/mcp/3d/+server.ts))

## Tests

- `src/lib/server/auth/mcp-authorization.pglite.test.ts` — Full flow against the real Better Auth instance and Postgres: discovery, DCR and CIMD, PKCE + resource, audience and scope refusals, refresh rotation, revocation, ban, deletion, every method refused without a token ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/mcp-authorization.pglite.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/mcp-authorization.pglite.test.ts))
- `src/lib/server/auth/application-identity.test.ts` — Identity labelling and name sanitizing ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/application-identity.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/application-identity.test.ts))
- `src/lib/server/auth/authorization-request.test.ts` — The authorization request survives sign-in as returnTo ([GitHub](https://github.com/ApeDevil/v10r/blob/main/src/lib/server/auth/authorization-request.test.ts) · [GitLab](https://gitlab.com/ApeDevil/v10r/-/blob/main/src/lib/server/auth/authorization-request.test.ts))

## Invariants

- Every JSON-RPC request to a protected service, initialize and app-only tools included, is refused with a 401 bearer challenge before any body is parsed unless it carries a token for that service's audience and scope.
- A JSON-RPC client never receives an HTML redirect: refusals are JSON with WWW-Authenticate.
- Revocation and suspension take effect on the next request: the liveness check runs on every call, and revoking deletes the authorization and its tokens in one transaction.
- A client's self-declared name is never presented as verified; recognition keys on the verified metadata-document domain.
- Quotas key on the user, not the IP: all of one user's clients share one allowance.
- No token, code, secret or PKCE verifier is logged, and the MCP endpoint never reads the session cookie.

## Emulation notes

- Infer native for loopback DCR redirects (clientRegistrationDefaultApplicationType: 'infer'), or MCP Inspector and Claude Code fail with invalid_redirect_uri.
- Include offline_access in each resource's allowedScopes, or the first refresh returns no rotated refresh token.
- Link clients to the resources at registration (clientRegistrationDefaultResources), or authorize fails with invalid_target.
- Upstream delete-consent leaves refresh tokens alive; revoke tokens yourself.
- The PRM resource must equal the URL the user pastes, exactly (Claude compares them).

## Depends on

- [Hosted MCP (four trust surfaces: public · private · admin · admin page)](/docs/pattern-library/architecture-hosted-mcp)
- [Passwordless auth (magic link + OTP)](/docs/pattern-library/identity-passwordless-auth)
- [Rate limiting (sliding window, fail-closed)](/docs/pattern-library/anti-abuse-rate-limiting)

---

_Machine-readable record: `architecture-mcp-authorization` in `pattern-library/registry.json`._
