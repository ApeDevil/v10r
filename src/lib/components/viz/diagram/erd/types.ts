export interface ErdColumn {
	name: string;
	type: string;
	pk?: boolean;
	fk?: boolean;
	secret?: boolean;
}

export interface ErdTable {
	name: string;
	schema?: string;
	columns: ErdColumn[];
}

export interface ErdEdge {
	from: string;
	to: string;
	fk: string;
	onDelete: 'cascade' | 'set null' | 'no action (no FK)';
	note?: string;
}
