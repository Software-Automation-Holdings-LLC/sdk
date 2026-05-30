import { titleCaseLabel } from './planInfoLabel';
const toStr = (v) => (typeof v === 'string' ? v : '');
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
/**
 * Coerce either plan-info wire shape into the typed array surface plus a
 * legacy-map mirror.
 */
export function coercePlanInfo(raw) {
    if (Array.isArray(raw)) {
        const items = [];
        for (const entry of raw) {
            if (!isRecord(entry))
                continue;
            const key = toStr(entry['key']);
            if (key === '')
                continue;
            const labelRaw = toStr(entry['label']);
            const label = labelRaw !== '' ? labelRaw : titleCaseLabel(key);
            const values = Array.isArray(entry['values'])
                ? entry['values'].map((x) => toStr(x))
                : [];
            items.push({ key, label, values });
        }
        return { array: items };
    }
    if (isRecord(raw)) {
        const items = [];
        const legacy = Object.create(null);
        for (const [key, value] of Object.entries(raw)) {
            const values = Array.isArray(value)
                ? value.map((x) => toStr(x))
                : [];
            items.push({ key, label: titleCaseLabel(key), values });
            legacy[key] = values;
        }
        return { array: items, legacy };
    }
    return { array: [] };
}
//# sourceMappingURL=planInfo.js.map