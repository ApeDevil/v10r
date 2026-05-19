<script lang="ts">
import { Alert, Card } from '$lib/components/composites';
import CodeBlock from '$lib/components/composites/info-dialog/CodeBlock.svelte';
import { Stack } from '$lib/components/layout';
import { Badge, Body, Cell, Header, HeaderCell, Row, Table, ToggleGroup } from '$lib/components/primitives';
import * as m from '$lib/paraglide/messages';
import ModeChip from '$lib/showcase/auth/ModeChip.svelte';

type Role = 'guest' | 'user' | 'author' | 'admin';

// Pure client state. Never serialized, never sent anywhere, never beside a real principal.
// Typed as string for ToggleGroup's bindable contract; narrowed via RANK lookup.
let simulatedRole = $state('guest');

const ROLE_ITEMS = [
	{ value: 'guest', label: 'Guest' },
	{ value: 'user', label: 'User' },
	{ value: 'author', label: 'Author' },
	{ value: 'admin', label: 'Admin' },
];

const RANK: Record<string, number> = { guest: 0, user: 1, author: 2, admin: 3 };

// Placeholder route names — deliberately NOT real app paths (no enumeration oracle).
const ZONES: { route: string; min: Role; label: string }[] = [
	{ route: '/area/public', min: 'guest', label: 'Anyone' },
	{ route: '/area/dashboard', min: 'user', label: 'Signed-in' },
	{ route: '/area/studio', min: 'author', label: 'Author+' },
	{ route: '/area/console', min: 'admin', label: 'Admin only' },
];

// Outcome is only ever 200 or 404 — never 403. That asymmetry IS the lesson.
function outcome(min: Role): '200' | '404' {
	return RANK[simulatedRole] >= RANK[min] ? '200' : '404';
}

const GUARDS_SRC = `// src/lib/server/auth/guards.ts (excerpt)

export function requireAuth(locals: App.Locals) {
  if (!locals.user) throw redirect(303, '/auth/login');
  return locals.user;
}

export function requireAdmin(locals: App.Locals) {
  const user = requireAuth(locals);
  // 404, NOT 403 — an admin surface must not confirm it exists.
  if (!isAdmin(user)) throw error(404, 'Not Found');
  return user;
}

export function requireAuthor(locals: App.Locals) {
  const user = requireAuth(locals);
  if (!isAdmin(user) && user.role !== 'author') {
    throw error(403, 'Forbidden');
  }
  return user;
}

function isAdmin(user: { id: string; email: string }): boolean {
  /* admin identity check elided */
}`;
</script>

<Stack gap="6">
	<p class="intro">{m.showcase_auth_authz_intro()}</p>

	<!-- Role simulator -->
	<Card>
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
	<Card>
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
				Notice there is no <code>403</code> column. An unauthorized request to an admin surface
				returns the <strong>same 404</strong> as a route that doesn't exist — so an attacker can't
				tell admin routes apart from noise. Denied is indistinguishable from absent, by design.
			</p>
		{/snippet}
	</Alert>

	<!-- Recorded guard source -->
	<Card>
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
