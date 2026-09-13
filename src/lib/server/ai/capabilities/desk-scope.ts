/**
 * The one activation rule every scoped desk capability shares: the scope is granted and a
 * tool-capable provider serves the turn. `desk:read` is the base grant — the read tools
 * mount whenever ANY desk scope is granted, which is why the rule takes the granted set.
 */
import type { AssistantCapability } from '../profile/profile';
import type { DeskToolScope } from '../tools/_types';

export function deskScopeActivation(scope: DeskToolScope): AssistantCapability['activates'] {
	return (turn) => {
		const granted = scope === 'desk:read' ? turn.scopes.length > 0 : turn.scopes.includes(scope);
		if (!granted) return { active: false, reason: 'scope_off' };
		if (!turn.hasTools) return { active: false, reason: turn.toolsCooled ? 'providers_cooled' : 'no_tools' };
		return { active: true };
	};
}
