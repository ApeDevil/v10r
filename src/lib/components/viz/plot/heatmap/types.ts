/** Data for a heat map visualization */
export interface HeatMapData {
	/** Column labels displayed on the x-axis */
	xLabels: string[];
	/** Row labels displayed on the y-axis */
	yLabels: string[];
	/** 2D matrix of values: values[row][col]. Each row must have length equal to xLabels.length */
	values: number[][];
}
