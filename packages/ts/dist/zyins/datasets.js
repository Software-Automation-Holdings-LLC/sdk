import { buildLicenseHMACHeaders } from '../core';
import { systemClock } from '../core';
import { fromHttpResponse } from './errors';
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
const readNumber = (v, key) => {
    if (!isObject(v))
        return undefined;
    const value = v[key];
    return typeof value === 'number' ? value : undefined;
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
        medicationsByCondition: medsByCondFrom(conditions),
        frequencyGraphs: frequencyFrom(conditions, medications),
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
const medsByCondFrom = (conditions) => {
    const map = {};
    for (const c of conditions) {
        const name = readString(c, 'name');
        if (!name)
            continue;
        const meds = isObject(c) ? toArray(c['medications']) : [];
        const medNames = meds
            .map((m) => readString(m, 'name'))
            .filter((n) => typeof n === 'string');
        if (medNames.length > 0)
            map[name] = medNames;
    }
    return map;
};
const frequencyFrom = (conditions, medications) => {
    const med_map = {};
    for (const m of medications) {
        const name = readString(m, 'name');
        if (!name)
            continue;
        const uses = isObject(m) ? toArray(m['uses']) : [];
        const usesByCond = {};
        for (const u of uses) {
            const cond = readString(u, 'condition');
            const freq = readNumber(u, 'frequency');
            if (cond && freq !== undefined)
                usesByCond[cond] = freq;
        }
        if (Object.keys(usesByCond).length > 0)
            med_map[name] = usesByCond;
    }
    const use_map = {};
    const cond_freq = {};
    for (const c of conditions) {
        const name = readString(c, 'name');
        if (!name)
            continue;
        const freq = readNumber(c, 'frequency');
        if (freq !== undefined)
            cond_freq[name] = freq;
        const meds = isObject(c) ? toArray(c['medications']) : [];
        const medsForCond = {};
        for (const m of meds) {
            const medName = readString(m, 'name');
            const medFreq = readNumber(m, 'frequency');
            if (medName && medFreq !== undefined)
                medsForCond[medName] = medFreq;
        }
        if (Object.keys(medsForCond).length > 0)
            use_map[name] = medsForCond;
    }
    return { med_map, use_map, cond_freq };
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