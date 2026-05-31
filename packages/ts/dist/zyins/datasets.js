import { buildLicenseHMACHeaders } from '../core/index.js';
import { systemClock } from '../core/index.js';
import { fromHttpResponse } from './errors.js';
import { __internal as referenceInternal } from './reference.js';
const DATASETS_PATH = '/v2/reference-data';
export async function getDatasets(options, ctx) {
    const headers = await buildLicenseHMACHeaders(ctx.auth.licenseKey, ctx.auth.orderId, ctx.auth.email, 'GET', DATASETS_PATH, '', ctx.auth.deviceId, ctx.clock ?? systemClock);
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
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const safeParse = (body) => {
    try {
        return JSON.parse(body);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        throw new Error(`Invalid JSON response from ${DATASETS_PATH}: ${message}`);
    }
};
const readSlice = (ds, key) => {
    const raw = ds[key];
    return isObject(raw) && 'data' in raw ? raw['data'] : raw;
};
const toArray = (v) => (Array.isArray(v) ? v : []);
const readString = (v, key) => {
    if (!isObject(v))
        return undefined;
    const value = v[key];
    return typeof value === 'string' ? value : undefined;
};
const readDatasets = (parsed) => {
    if (!isObject(parsed))
        return {};
    const payload = isObject(parsed['data']) ? parsed['data'] : parsed;
    return isObject(payload['datasets']) ? payload['datasets'] : {};
};
const normalize = (body) => {
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
            .filter((name) => typeof name === 'string'),
        medications: medicationsToLegacy(medications),
        medicationNames: medications
            .map((m) => readString(m, 'name'))
            .filter((name) => typeof name === 'string'),
        medicationsByCondition: relationships.medicationsByCondition,
        frequencyGraphs: relationships.frequencyGraphs,
    };
};
const toStringArray = (v) => toArray(v).filter((item) => typeof item === 'string');
const toNumberRecord = (v) => {
    if (!isObject(v))
        return {};
    const result = {};
    for (const [key, value] of Object.entries(v)) {
        if (typeof value === 'number')
            result[key] = value;
    }
    return result;
};
const extractProductNames = (productPayload) => {
    if (!isObject(productPayload))
        return {};
    const result = {};
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
                    .filter((name) => typeof name === 'string')
                : entries;
    }
    return result;
};
const typosFromCorrections = (corrections) => {
    const map = {};
    for (const c of toArray(corrections)) {
        const input = readString(c, 'input');
        const corrected = readString(c, 'corrected_name');
        if (input && corrected)
            map[input] = corrected;
    }
    return map;
};
const medicationsToLegacy = (medications) => {
    const result = {};
    for (const m of medications) {
        const name = readString(m, 'name');
        if (!name)
            continue;
        const uses = isObject(m) ? toArray(m['uses']) : [];
        const details = uses
            .map((u) => readString(u, 'condition'))
            .filter((cond) => typeof cond === 'string');
        result[name] = { details };
    }
    return result;
};
const conditionNameFromUse = (value) => {
    if (typeof value === 'string')
        return value;
    return readString(value, 'condition');
};
const useFrequency = (value) => {
    if (!isObject(value))
        return 1;
    const frequency = value['frequency'];
    if (typeof frequency === 'number' && Number.isFinite(frequency))
        return frequency;
    const count = value['count'];
    return typeof count === 'number' && Number.isFinite(count) ? count : 1;
};
const appendUnique = (target, key, value) => {
    const existing = target[key] ?? [];
    if (!existing.includes(value)) {
        existing.push(value);
        target[key] = existing;
    }
};
const addFrequency = (useMap, conditionKey, medicationKey, frequency) => {
    const row = useMap[conditionKey] ?? {};
    row[medicationKey] = (row[medicationKey] ?? 0) + frequency;
    useMap[conditionKey] = row;
};
const relationshipMapsFromMedications = (medications) => {
    const medicationsByCondition = {};
    const useMap = {};
    for (const medication of medications) {
        const name = readString(medication, 'name');
        if (!name || !isObject(medication))
            continue;
        const medicationID = referenceInternal.makeKey(name);
        if (!medicationID)
            continue;
        for (const use of toArray(medication['uses'])) {
            const conditionName = conditionNameFromUse(use);
            if (!conditionName)
                continue;
            const conditionID = referenceInternal.makeKey(conditionName);
            if (!conditionID)
                continue;
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
const pick = (bundle, include) => {
    const empty = {
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
    const result = { ...empty };
    for (const key of include) {
        result[key] = bundle[key];
    }
    return result;
};
export class DatasetsSubClient {
    ctx;
    constructor(ctx) {
        this.ctx = ctx;
    }
    get(options) {
        return getDatasets(options, this.ctx);
    }
}
//# sourceMappingURL=datasets.js.map