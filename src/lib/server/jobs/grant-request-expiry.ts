import { expireOldRequests } from '#lib/server/auth/grant-requests.ts';

export async function grantRequestExpiry(): Promise<number> {
	return expireOldRequests();
}
