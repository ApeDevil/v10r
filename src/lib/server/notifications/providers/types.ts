export interface DeliveryPayload {
	/** Channel-specific recipient: email address, telegram chat ID, discord user
	 * ID — or the v10r user ID for web push (that provider fans out per device). */
	to: string;
	subject: string;
	body: string;
	htmlBody?: string;
	/** Web push only: same-origin, path-only click target. */
	navigate?: string;
	/** Web push only: recipient locale for the OS notification. */
	lang?: string;
}

export interface DeliveryResult {
	success: boolean;
	providerMessageId?: string;
	errorCode?: string;
	errorMessage?: string;
	retryable?: boolean;
}

export interface NotificationProvider {
	send(payload: DeliveryPayload): Promise<DeliveryResult>;
	validateConnection(): Promise<boolean>;
	getProviderName(): string;
}
