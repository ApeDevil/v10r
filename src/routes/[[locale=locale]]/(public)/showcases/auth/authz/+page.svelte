<script lang="ts">
import { Alert, Card, NavSection } from '$lib/components/composites';
import CodeBlock from '$lib/components/composites/info-dialog/CodeBlock.svelte';
import { Stack } from '$lib/components/layout';
import { Badge, Body, Cell, Header, HeaderCell, ModeChip, Row, Table, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';

type Role = 'guest' | 'user' | 'blog-author' | 'admin';

// Pure client state. Never serialized, never sent anywhere, never beside a real principal.
// Typed as string for ToggleGroup's bindable contract; narrowed via RANK lookup.
let simulatedRole = $state('guest');

const ROLE_ITEMS = [
	{ value: 'guest', label: 'Guest' },
	{ value: 'user', label: 'User' },
	{ value: 'blog-author', label: 'Blog author' },
	{ value: 'admin', label: 'Admin' },
];

const RANK: Record<string, number> = { guest: 0, user: 1, 'blog-author': 2, admin: 3 };

// Placeholder route names — deliberately NOT real app paths (no enumeration oracle).
const ZONES: { route: string; min: Role; label: string }[] = [
	{ route: '/area/public', min: 'guest', label: 'Anyone' },
	{ route: '/area/dashboard', min: 'user', label: 'Signed-in' },
	{ route: '/area/studio', min: 'blog-author', label: 'Blog-author grant' },
	{ route: '/area/console', min: 'admin', label: 'Admin only' },
];

// Outcome is only ever 200 or 404 — never 403. That asymmetry IS the lesson.
function outcome(min: Role): '200' | '404' {
	return RANK[simulatedRole] >= RANK[min] ? '200' : '404';
}

const GUARDS_SRC = `// src/lib/server/http/guards.ts (excerpt)

// Page guards THROW Kit's own error/redirect objects.
export function requireAuth(locals: App.Locals, returnTo?: string) {
  if (!locals.user || !locals.session) {
    const target = returnTo ? \`/auth/login?returnTo=\${encodeURIComponent(returnTo)}\` : '/auth/login';
    redirect(303, localizeHref(target));
  }
  return { user: locals.user, session: locals.session };
}

export function requireAdmin(locals: App.Locals, returnTo?: string) {
  const { user, session } = requireAuth(locals, returnTo);
  // 404, NOT 403 — an admin surface must not confirm it exists.
  if (!isAdmin(user)) error(404, 'Not Found');
  return { user, session };
}

// API guards RETURN a Response instead. SvelteKit does not unwrap a thrown
// Response the way it unwraps HttpError/Redirect, so \`throw apiError(...)\`
// would answer 500 rather than 401/403 — invisibly, because a Response also
// has a .status. This split is enforced by guard-contract.gate.test.ts.
export function guardApiBlogAuthor(locals: App.Locals): ApiGuardResult {
  if (!locals.user || !locals.session) {
    return { error: apiError(401, 'unauthorized', 'Authentication required') };
  }
  // Grants are populated per-request by sessionPopulate from auth.grant
  // rows where revoked_at IS NULL.
  if (!isAdmin(locals.user) && !hasBlogAuthorGrant(locals)) {
    return { error: apiError(403, 'forbidden_no_grant', 'Insufficient permissions') };
  }
  return { user: locals.user, session: locals.session };
}`;

const sections = $derived([
	{ id: 'authz-sim', label: m.showcase_auth_authz_sim_card() },
	{ id: 'authz-matrix', label: m.showcase_auth_authz_matrix_card() },
	{ id: 'authz-guards', label: m.showcase_auth_authz_guards_card() },
]);
</script>

<NavSection {sections} />

<Stack gap="6">
	<p class="intro">{m.showcase_auth_authz_intro()}</p>

	<!-- Role simulator -->
	<Card id="authz-sim">
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authz_sim_card()}</h2>
				<ModeChip mode="sandbox" />
			</div>
		{/snippet}
		<div class="sim">
			<span id="sim-role-label" class="lbl">Simulated role</span>
			<ToggleGroup type="single" bind:value={simulatedRole} items={ROLE_ITEMS} />
			<p class="text-sm text-muted">
				Client-only — your real session is untouched and this value never leaves the browser.
			</p>
		</div>
	</Card>

	<!-- Decision matrix -->
	<Card id="authz-matrix">
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authz_matrix_card()}</h2>
				<ModeChip mode="sandbox" />
			</div>
		{/snippet}
		<Table>
			<Header>
				<Row>
					<HeaderCell>Route (placeholder)</HeaderCell>
					<HeaderCell>Requires</HeaderCell>
					<HeaderCell>As {simulatedRole}</HeaderCell>
				</Row>
			</Header>
			<Body>
				{#each ZONES as z (z.route)}
					{@const code = outcome(z.min)}
					<Row>
						<Cell><code>{z.route}</code></Cell>
						<Cell>{z.label}</Cell>
						<Cell>
							{#if code === '200'}
								<Badge variant="success">200 OK</Badge>
							{:else}
								<Badge variant="error">404 Not Found</Badge>
							{/if}
						</Cell>
					</Row>
				{/each}
			</Body>
		</Table>
	</Card>

	<!-- Always-visible invariant -->
	<Alert variant="info" title={m.showcase_auth_authz_callout()}>
		{#snippet children()}
			<p>
				Notice there is no <code>403</code> column — an unauthorized request to an admin surface
				returns the <strong>same 404</strong> as a route that doesn't exist.
			</p>
		{/snippet}
	</Alert>

	<!-- Recorded guard source -->
	<Card id="authz-guards">
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_authz_guards_card()}</h2>
				<ModeChip mode="recorded" />
			</div>
		{/snippet}
		<p class="text-sm text-muted mb-3">
			The real guard contract, verbatim except the <code>isAdmin</code> body (elided so this public
			page never prints the admin-gate mechanism).
		</p>
		<CodeBlock code={GUARDS_SRC} language="ts" filename="guards.ts (excerpt)" />
	</Card>
</Stack>

<style>
	.intro {
		margin: 0;
		color: var(--color-muted);
		font-size: var(--text-fluid-sm);
		line-height: 1.6;
	}
	.card-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--spacing-3);
	}
	.sim {
		display: flex;
		flex-direction: column;
		gap: var(--spacing-3);
	}
	.lbl {
		font-size: var(--text-fluid-sm);
		font-weight: 500;
		color: var(--color-fg);
	}
	.sim p,
	.intro {
		margin: 0;
	}
</style>
