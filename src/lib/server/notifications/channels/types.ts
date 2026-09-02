export interface DeliveryPayload {
	/** Channel-specific recipient: email address, telegram chat ID, discord user
	 * ID — or the v10r user ID for web push (that channel fans out per device). */
	to: string;
	subject: string;
	body: string;
	/** Web push only: same-origin, path-only click target. */
	navigate?: string;
	/** Web push only: recipient locale for the OS notification. */
	lang?: string;
}

export interface DeliveryResult {
	success: boolean;
	/** Id the external service returned. Stored as `provider_message_id`; theirs, not ours. */
	providerMessageId?: string;
	errorCode?: string;
	errorMessage?: string;
	retryable?: boolean;
}

export interface DeliveryChannel {
	send(payload: DeliveryPayload): Promise<DeliveryResult>;
}
