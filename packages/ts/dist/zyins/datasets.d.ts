import type { OperationContext } from './client.js';
export type DatasetName = 'nicotineOptions' | 'products' | 'discontinuedProducts' | 'stateDerivatives' | 'typos' | 'conditions' | 'conditionNames' | 'medications' | 'medicationNames' | 'medicationsByCondition' | 'frequencyGraphs';
export interface DatasetBundle {
    nicotineOptions: ReadonlyArray<string>;
    products: Readonly<Record<string, unknown>>;
    discontinuedProducts: Readonly<Record<string, number>>;
    stateDerivatives: ReadonlyArray<string>;
    typos: Readonly<Record<string, string>>;
    conditions: ReadonlyArray<unknown>;
    conditionNames: ReadonlyArray<string>;
    medications: Readonly<Record<string, unknown>>;
    medicationNames: ReadonlyArray<string>;
    medicationsByCondition: Readonly<Record<string, ReadonlyArray<string>>>;
    frequencyGraphs: Readonly<Record<string, unknown>>;
}
export interface DatasetsGetOptions {
    include?: ReadonlyArray<DatasetName>;
}
export declare function getDatasets(options: DatasetsGetOptions | undefined, ctx: OperationContext): Promise<DatasetBundle>;
export declare class DatasetsSubClient {
    private readonly ctx;
    constructor(ctx: OperationContext);
    get(options?: DatasetsGetOptions): Promise<DatasetBundle>;
}
//# sourceMappingURL=datasets.d.ts.map