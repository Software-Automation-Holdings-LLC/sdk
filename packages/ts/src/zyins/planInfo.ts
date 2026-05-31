import { titleCaseLabel } from './planInfoLabel.js';
import type {
  OfferPlanInfo,
  OfferPlanInfoItem,
  OfferPlanInfoLegacy,
} from './prequalify-v2-types.js';

type PlanInfoCoercion = {
  array: OfferPlanInfo;
  legacy?: OfferPlanInfoLegacy;
};

const toStr = (v: unknown): string => (typeof v === 'string' ? v : '');

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Coerce either plan-info wire shape into the typed array surface plus a
 * legacy-map mirror.
 */
export function coercePlanInfo(raw: unknown): PlanInfoCoercion {
  if (Array.isArray(raw)) {
    const items: OfferPlanInfoItem[] = [];
    for (const entry of raw) {
      if (!isRecord(entry)) continue;
      const key = toStr(entry['key']);
      if (key === '') continue;
      const labelRaw = toStr(entry['label']);
      const label = labelRaw !== '' ? labelRaw : titleCaseLabel(key);
      const values = Array.isArray(entry['values'])
        ? (entry['values'] as unknown[]).map((x) => toStr(x))
        : [];
      items.push({ key, label, values });
    }
    return { array: items };
  }
  if (isRecord(raw)) {
    const items: OfferPlanInfoItem[] = [];
    const legacy = Object.create(null) as Record<string, readonly string[]>;
    for (const [key, value] of Object.entries(raw)) {
      const values = Array.isArray(value)
        ? (value as unknown[]).map((x) => toStr(x))
        : [];
      items.push({ key, label: titleCaseLabel(key), values });
      legacy[key] = values;
    }
    return { array: items, legacy };
  }
  return { array: [] };
}
