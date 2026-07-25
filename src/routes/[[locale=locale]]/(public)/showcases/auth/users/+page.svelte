<script lang="ts">
import { Card } from '$lib/components/composites';
import { Stack } from '$lib/components/layout';
import { Badge, Body, Button, Cell, Header, HeaderCell, Row, Select, Table } from '$lib/components/primitives';
import { ErdDiagram } from '$lib/components/viz';
import * as m from '$lib/paraglide/messages';
import { authFixture } from '$lib/showcase/auth/fixture';
import ModeChip from '$lib/showcase/auth/ModeChip.svelte';

// Working copy of fixture users — all mutations are local $state, reset on navigation.
let users = $state(
	authFixture.users.map((u) => ({ id: u.id, name: u.name, email: u.email, role: u.role, banned: u.banned })),
);
let confirmingBan = $state<string | null>(null);
let impersonating = $state<string | null>(null);

const ROLE_OPTIONS = [
	{ value: 'user', label: 'User' },
	{ value: 'author', label: 'Author' },
	{ value: 'admin', label: 'Admin' },
];

function toggleBan(id: string) {
	const u = users.find((x) => x.id === id);
	if (u) u.banned = !u.banned;
	confirmingBan = null;
}

const impersonatedUser = $derived(users.find((u) => u.id === impersonating));

// Schema-faithful ERD (structure is public DDL; rows stay fabricated).
const ERD_TABLES = [
	{
		name: 'user',
		schema: 'auth',
		columns: [
			{ name: 'id', type: 'text', pk: true },
			{ name: 'email', type: 'text' },
			{ name: 'role', type: 'text' },
			{ name: 'banned', type: 'boolean' },
		],
	},
	{
		name: 'session',
		schema: 'auth',
		columns: [
			{ name: 'id', type: 'text', pk: true },
			{ name: 'user_id', type: 'text', fk: true },
			{ name: 'token', type: 'text', secret: true },
			{ name: 'impersonated_by', type: 'text' },
		],
	},
	{
		name: 'account',
		schema: 'auth',
		columns: [
			{ name: 'id', type: 'text', pk: true },
			{ name: 'user_id', type: 'text', fk: true },
			{ name: 'access_token', type: 'text', secret: true },
			{ name: 'password', type: 'text', secret: true },
		],
	},
	{
		name: 'verification',
		schema: 'auth',
		columns: [
			{ name: 'id', type: 'text', pk: true },
			{ name: 'identifier', type: 'text' },
			{ name: 'value', type: 'text', secret: true },
			{ name: 'expires_at', type: 'timestamp' },
		],
	},
	{
		name: 'user_preferences',
		schema: 'app',
		columns: [
			{ name: 'user_id', type: 'text', pk: true, fk: true },
			{ name: 'theme', type: 'enum' },
			{ name: 'locale', type: 'text' },
		],
	},
];
</script>

{#if impersonatedUser}
	<div class="imp-banner" role="status">
		<span class="i-lucide-venetian-mask" aria-hidden="true"></span>
		<span>Impersonating <strong>{impersonatedUser.name}</strong> ({impersonatedUser.email}) — mock</span>
		<Button variant="outline" size="sm" onclick={() => (impersonating = null)}>Return to admin</Button>
	</div>
{/if}

<Stack gap="6">
	<p class="intro">{m.showcase_auth_users_intro()}</p>

	<!-- User table -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_users_table_card()}</h2>
				<ModeChip mode="sandbox" />
			</div>
		{/snippet}
		<Table>
			<Header>
				<Row>
					<HeaderCell>User</HeaderCell>
					<HeaderCell>Role</HeaderCell>
					<HeaderCell>Status</HeaderCell>
					<HeaderCell>Actions</HeaderCell>
				</Row>
			</Header>
			<Body>
				{#each users as u (u.id)}
					<Row>
						<Cell>
							<div class="u-name">{u.name}</div>
							<div class="u-mail">{u.email}</div>
						</Cell>
						<Cell>
							<Select options={ROLE_OPTIONS} value={u.role} onchange={(v) => (u.role = v)} />
						</Cell>
						<Cell>
							{#if u.banned}
								<Badge variant="error">Banned</Badge>
							{:else}
								<Badge variant="success">Active</Badge>
							{/if}
						</Cell>
						<Cell>
							{#if confirmingBan === u.id}
								<div class="confirm" role="group" aria-label="Confirm ban">
									<span class="text-sm">Ban {u.name}?</span>
									<Button variant="destructive" size="sm" onclick={() => toggleBan(u.id)}>
										Confirm
									</Button>
									<Button variant="ghost" size="sm" onclick={() => (confirmingBan = null)}>
										Cancel
									</Button>
								</div>
							{:else}
								<div class="actions">
									{#if u.banned}
										<Button variant="outline" size="sm" onclick={() => toggleBan(u.id)}>
											Unban
										</Button>
									{:else}
										<Button variant="outline" size="sm" onclick={() => (confirmingBan = u.id)}>
											Ban
										</Button>
									{/if}
									<Button variant="ghost" size="sm" onclick={() => (impersonating = u.id)}>
										Impersonate
									</Button>
								</div>
							{/if}
						</Cell>
					</Row>
				{/each}
			</Body>
		</Table>

		<details class="how">
			<summary>{m.showcase_auth_howto()}</summary>
			<p>{m.showcase_auth_users_reset_note()}</p>
		</details>
	</Card>

	<!-- Audit log -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_users_audit_card()}</h2>
				<ModeChip mode="recorded" />
			</div>
		{/snippet}
		<p class="text-sm text-muted mb-3">
			<code>admin.audit_log</code> has no FK on <code>actor_id</code>, plus a denormalized
			<code>actor_email</code>.
		</p>
		<Table>
			<Header>
				<Row>
					<HeaderCell>Action</HeaderCell>
					<HeaderCell>Actor</HeaderCell>
					<HeaderCell>Target</HeaderCell>
					<HeaderCell>When</HeaderCell>
				</Row>
			</Header>
			<Body>
				{#each authFixture.auditLog as a (a.id)}
					<Row>
						<Cell><code>{a.action}</code></Cell>
						<Cell>{a.actorEmail}</Cell>
						<Cell>{a.targetType}/{a.targetId}</Cell>
						<Cell><code>{a.occurredAt}</code></Cell>
					</Row>
				{/each}
			</Body>
		</Table>
	</Card>

	<!-- ERD + cascade -->
	<Card>
		{#snippet header()}
			<div class="card-head">
				<h2 class="text-fluid-lg font-semibold">{m.showcase_auth_users_erd_card()}</h2>
				<ModeChip mode="recorded" />
			</div>
		{/snippet}
		<p class="text-sm text-muted mb-3">
			Custom user data lives in <code>app.user_preferences</code> (PK <em>is</em> the FK → strict
			1:1, cascade) — never by editing the Better-Auth-generated <code>auth.user</code>.
		</p>
		<ErdDiagram tables={ERD_TABLES} edges={authFixture.edges} ariaLabel="Auth data model" />
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
	.imp-banner {
		position: sticky;
		top: 0;
		z-index: 20;
		display: flex;
		align-items: center;
		gap: var(--spacing-3);
		padding: var(--spacing-3) var(--spacing-4);
		margin-bottom: var(--spacing-4);
		background: color-mix(in srgb, var(--color-warning, orange) 18%, transparent);
		border: 1px solid var(--color-warning, orange);
		border-radius: var(--radius-md);
		color: var(--color-fg);
		font-size: var(--text-fluid-sm);
	}
	.imp-banner :global(button) {
		margin-left: auto;
		flex-shrink: 0;
	}
	.u-name {
		font-weight: 500;
	}
	.u-mail {
		font-size: var(--text-fluid-xs);
		color: var(--color-muted);
	}
	.actions,
	.confirm {
		display: flex;
		align-items: center;
		gap: var(--spacing-2);
	}
	.how {
		margin-top: var(--spacing-4);
		padding-top: var(--spacing-3);
		border-top: 1px solid var(--color-border);
		font-size: var(--text-fluid-sm);
	}
	.how summary {
		cursor: pointer;
		color: var(--color-muted);
		font-weight: 500;
	}
	.how p {
		margin: var(--spacing-3) 0 0;
		color: var(--color-muted);
		line-height: 1.6;
	}
</style>
