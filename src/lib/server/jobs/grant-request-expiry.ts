import { expireOldRequests } from '$lib/server/auth/grant-requests';

export async function grantRequestExpiry(): Promise<number> {
	return expireOldRequests();
}
