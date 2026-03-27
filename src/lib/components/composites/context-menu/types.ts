export type ContextMenuItem =
	| {
			label: string;
			/** CSS icon class (e.g., 'i-lucide-home') */
			icon?: string;
			shortcut?: string;
			onclick?: () => void;
			separator?: false;
			disabled?: boolean;
	  }
	| {
			separator: true;
			label?: never;
			icon?: never;
			shortcut?: never;
			onclick?: never;
			disabled?: never;
	  };
