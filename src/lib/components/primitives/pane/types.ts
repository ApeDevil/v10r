export interface PaneGroupHandle {
	getLayout: () => number[];
	setLayout: (layout: number[]) => void;
	getId: () => string;
}
