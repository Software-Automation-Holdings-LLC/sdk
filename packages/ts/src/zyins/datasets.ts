import type { OperationContext } from './client.js';
import { buildLicenseHMACHeaders } from '../core/index.js';
import { systemClock } from '../core/index.js';
import { fromHttpResponse } from './errors.js';
import { __internal as referenceInternal } from './reference.js';

export type DatasetName =
    | 'nicotineOptions'
    | 'products'
    | 'discontinuedProducts'
    | 'stateDerivatives'
    | 'typos'
    | 'conditions'
    | 'conditionNames'
    | 'medications'
    | 'medicationNames'
    | 'medicationsByCondition'
    | 'frequencyGraphs';

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

const DATASETS_PATH = '/v2/reference-data';

export async function getDatasets(
    options: DatasetsGetOptions | undefined,
    ctx: OperationContext,
): Promise<DatasetBundle> {
    const headers = await buildLicenseHMACHeaders(
        ctx.auth.licenseKey,
        ctx.auth.orderId,
        ctx.auth.email,
        'GET',
        DATASETS_PATH,
        '',
        ctx.auth.deviceId,
        ctx.clock ?? systemClock,
    );
    const response = await ctx.transport({
        url: `${ctx.baseUrl}${DATASETS_PATH}`,
        method: 'GET',
        headers: { ...headers },
        body: '',
    });
    if (response.status < 200 || response.status >= 300) {
        throw fromHttpResponse(response.status, response.body);
    }
    const bundle = normalize(response.body);
    return options?.include ? pick(bundle, options.include) : bundle;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);

const safeParse = (body: string): unknown => {
    try {
        return JSON.parse(body);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid JSON response from ${DATASETS_PATH}: ${message}`);
    }
};

const readSlice = (ds: Record<string, unknown>, key: string): unknown => {
    const raw = ds[key];
    return isObject(raw) && 'data' in raw ? raw['data'] : raw;
};

const toArray = (v: unknown): ReadonlyArray<unknown> => (Array.isArray(v) ? v : []);

const readString = (v: unknown, key: string): string | undefined => {
    if (!isObject(v)) return undefined;
    const value = v[key];
    return typeof value === 'string' ? value : undefined;
};

const readDatasets = (parsed: unknown): Record<string, unknown> => {
    if (!isObject(parsed)) return {};
    const payload = isObject(parsed['data']) ? parsed['data'] : parsed;
    return isObject(payload['datasets']) ? payload['datasets'] : {};
};

const normalize = (body: string): DatasetBundle => {
    const parsed = safeParse(body);
    const ds = readDatasets(parsed);

    const products = readSlice(ds, 'products');
    const conditions = toArray(readSlice(ds, 'conditions'));
    const medications = toArray(readSlice(ds, 'medications'));
    const relationships = relationshipMapsFromMedications(medications);

    return {
        nicotineOptions: toStringArray(readSlice(ds, 'nicotine_options')),
        products: extractProductNames(products),
        discontinuedProducts: toNumberRecord(readSlice(ds, 'discontinued_products')),
        stateDerivatives: toStringArray(readSlice(ds, 'states')),
        typos: typosFromCorrections(readSlice(ds, 'corrections')),
        conditions: conditions.map((c) => ({ name: readString(c, 'name'), details: [] })),
        conditionNames: conditions
            .map((c) => readString(c, 'name'))
            .filter((name): name is string => typeof name === 'string'),
        medications: medicationsToLegacy(medications),
        medicationNames: medications
            .map((m) => readString(m, 'name'))
            .filter((name): name is string => typeof name === 'string'),
        medicationsByCondition: relationships.medicationsByCondition,
        frequencyGraphs: relationships.frequencyGraphs,
    };
};

const toStringArray = (v: unknown): ReadonlyArray<string> =>
    toArray(v).filter((item): item is string => typeof item === 'string');

const toNumberRecord = (v: unknown): Record<string, number> => {
    if (!isObject(v)) return {};
    const result: Record<string, number> = {};
    for (const [key, value] of Object.entries(v)) {
        if (typeof value === 'number') result[key] = value;
    }
    return result;
};

const extractProductNames = (productPayload: unknown): Record<string, unknown> => {
    if (!isObject(productPayload)) return {};
    const result: Record<string, unknown> = {};
    for (const [type, entries] of Object.entries(productPayload)) {
        if (!Array.isArray(entries)) {
            result[type] = entries;
            continue;
        }
        const first = entries[0];
        result[type] =
            isObject(first) && typeof first['name'] === 'string'
                ? entries
                      .map((e) => readString(e, 'name'))
                      .filter((name): name is string => typeof name === 'string')
                : entries;
    }
    return result;
};

const typosFromCorrections = (corrections: unknown): Record<string, string> => {
    const map: Record<string, string> = {};
    for (const c of toArray(corrections)) {
        const input = readString(c, 'input');
        const corrected = readString(c, 'corrected_name');
        if (input && corrected) map[input] = corrected;
    }
    return map;
};

const medicationsToLegacy = (medications: ReadonlyArray<unknown>): Record<string, unknown> => {
    const result: Record<string, unknown> = {};
    for (const m of medications) {
        const name = readString(m, 'name');
        if (!name) continue;
        const uses = isObject(m) ? toArray(m['uses']) : [];
        const details = uses
            .map((u) => readString(u, 'condition'))
            .filter((cond): cond is string => typeof cond === 'string');
        result[name] = { details };
    }
    return result;
};

const conditionNameFromUse = (value: unknown): string | undefined => {
    if (typeof value === 'string') return value;
    return readString(value, 'condition');
};

const useFrequency = (value: unknown): number => {
    if (!isObject(value)) return 1;
    const frequency = value['frequency'];
    if (typeof frequency === 'number' && Number.isFinite(frequency)) return frequency;
    const count = value['count'];
    return typeof count === 'number' && Number.isFinite(count) ? count : 1;
};

const appendUnique = (target: Record<string, string[]>, key: string, value: string): void => {
    const existing = target[key] ?? [];
    if (!existing.includes(value)) {
        existing.push(value);
        target[key] = existing;
    }
};

const addFrequency = (
    useMap: Record<string, Record<string, number>>,
    conditionKey: string,
    medicationKey: string,
    frequency: number,
): void => {
    const row = useMap[conditionKey] ?? {};
    row[medicationKey] = (row[medicationKey] ?? 0) + frequency;
    useMap[conditionKey] = row;
};

const relationshipMapsFromMedications = (
    medications: ReadonlyArray<unknown>,
): {
    medicationsByCondition: Record<string, string[]>;
    frequencyGraphs: { use_map: Record<string, Record<string, number>> };
} => {
    const medicationsByCondition: Record<string, string[]> = {};
    const useMap: Record<string, Record<string, number>> = {};

    for (const medication of medications) {
        const name = readString(medication, 'name');
        if (!name || !isObject(medication)) continue;
        const medicationID = referenceInternal.makeKey(name);
        if (!medicationID) continue;

        for (const use of toArray(medication['uses'])) {
            const conditionName = conditionNameFromUse(use);
            if (!conditionName) continue;
            const conditionID = referenceInternal.makeKey(conditionName);
            if (!conditionID) continue;

            appendUnique(medicationsByCondition, conditionName, name);
            appendUnique(medicationsByCondition, conditionID, medicationID);

            const frequency = useFrequency(use);
            addFrequency(useMap, conditionName, name, frequency);
            addFrequency(useMap, conditionID, medicationID, frequency);
        }
    }

    return {
        medicationsByCondition,
        frequencyGraphs: { use_map: useMap },
    };
};

const pick = (bundle: DatasetBundle, include: ReadonlyArray<DatasetName>): DatasetBundle => {
    const empty: DatasetBundle = {
        nicotineOptions: [],
        products: {},
        discontinuedProducts: {},
        stateDerivatives: [],
        typos: {},
        conditions: [],
        conditionNames: [],
        medications: {},
        medicationNames: [],
        medicationsByCondition: {},
        frequencyGraphs: {},
    };
    const result: DatasetBundle = { ...empty };
    for (const key of include) {
        (result as Record<DatasetName, unknown>)[key] = bundle[key];
    }
    return result;
};

export class DatasetsSubClient {
    constructor(private readonly ctx: OperationContext) {}
    get(options?: DatasetsGetOptions): Promise<DatasetBundle> {
        return getDatasets(options, this.ctx);
    }
}
