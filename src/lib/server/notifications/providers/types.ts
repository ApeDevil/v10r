export interface DeliveryPayload {
	to: string;
	subject: string;
	body: string;
	htmlBody?: string;
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
