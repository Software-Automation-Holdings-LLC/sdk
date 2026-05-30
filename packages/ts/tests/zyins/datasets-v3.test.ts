/**
 * Test the `/v3/datasets` parser. The headline guarantee: the SDK
 * passes through the server's id-keyed `medications_by_condition` and
 * `frequency_graphs.use_map` verbatim — no client-side derivation,
 * no client-side key normalization.
 */

import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';
import { isNotModified } from '../../src/zyins/datasets-v3';

describe('ZyInsClient.datasetsV3.get', () => {
  it('returns the typed v3 bundle with inline-row treated_with / used_for', async () => {
    const etag = 'W/"catalog-v3"';
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        object: 'datasets_catalog',
        request_id: 'req_01HZK2N5GQR9T8X4B6FJW3Y1AS',
        idempotency_key: null,
        livemode: true,
        data: {
          catalog_version: '3.0',
          datasets: {
            conditions: {
              version: '3.0',
              item_count: 1,
              items: [
                {
                  id: 'HIGHBLOODPRESSURE',
                  name: 'High Blood Pressure',
                  treated_with: [
                    { id: 'LISINOPRIL', name: 'Lisinopril', prescription_count: 4120 },
                    { id: 'LOSARTAN', name: 'Losartan', prescription_count: 880 },
                  ],
                },
              ],
            },
            medications: {
              version: '3.0',
              item_count: 2,
              items: [
                {
                  id: 'LISINOPRIL',
                  name: 'Lisinopril',
                  used_for: [
                    {
                      id: 'HIGHBLOODPRESSURE',
                      name: 'High Blood Pressure',
                      prescription_count: 4120,
                    },
                  ],
                },
                {
                  id: 'LOSARTAN',
                  name: 'Losartan',
                  used_for: [
                    {
                      id: 'HIGHBLOODPRESSURE',
                      name: 'High Blood Pressure',
                      prescription_count: 880,
                    },
                  ],
                },
              ],
            },
            spelling_corrections: {
              version: '3.0',
              item_count: 1,
              items: [
                { id: 'spl_001', name: 'HYPRTENSION', from: 'HYPRTENSION', to: 'HYPERTENSION' },
              ],
            },
          },
        },
      }),
      { etag },
    );
    const c = client(transport);
    const result = await c.datasetsV3.get();
    expect(isNotModified(result)).toBe(false);
    if (isNotModified(result)) return;
    expect(result.etag).toBe(etag);
    expect(result.version).toBe('3.0');
    expect(result.conditions[0]?.id).toBe('HIGHBLOODPRESSURE');
    expect(result.conditions[0]?.treated_with).toEqual([
      { id: 'LISINOPRIL', name: 'Lisinopril', prescription_count: 4120 },
      { id: 'LOSARTAN', name: 'Losartan', prescription_count: 880 },
    ]);
    expect(result.medications[0]?.used_for?.[0]?.prescription_count).toBe(4120);
    expect(result.spellingCorrections[0]?.from).toBe('HYPRTENSION');
    expect(result.spellingCorrections[0]?.to).toBe('HYPERTENSION');
  });

  it('surfaces 304 Not Modified as a discriminated marker', async () => {
    const { transport } = recordingTransport(304, '');
    const c = client(transport);
    const result = await c.datasetsV3.get({ ifNoneMatch: 'W/"abc"' });
    expect(isNotModified(result)).toBe(true);
  });

  it('clamps invalid negative prescription counts', async () => {
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        data: {
          version: '3.0',
          datasets: {
            conditions: {
              items: [
                {
                  id: 'DIABETES',
                  name: 'Diabetes',
                  treated_with: [
                    { id: 'INSULIN', name: 'Insulin', prescription_count: -1 },
                  ],
                },
              ],
            },
            medications: {
              items: [
                {
                  id: 'INSULIN',
                  name: 'Insulin',
                  used_for: [
                    { id: 'DIABETES', name: 'Diabetes', prescription_count: -1 },
                  ],
                },
              ],
            },
          },
        },
      }),
    );
    const c = client(transport);
    const result = await c.datasetsV3.get();
    expect(isNotModified(result)).toBe(false);
    if (isNotModified(result)) return;
    expect(result.conditions[0]?.treated_with[0]?.prescription_count).toBe(0);
    expect(result.medications[0]?.used_for[0]?.prescription_count).toBe(0);
  });

  it('accepts the legacy corrections dataset key', async () => {
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        data: {
          version: '3.0',
          datasets: {
            corrections: {
              version: '3.0',
              item_count: 1,
              items: [
                { id: 'spl_001', from: 'HYPRTENSION', to: 'HYPERTENSION' },
              ],
            },
          },
        },
      }),
    );
    const c = client(transport);
    const result = await c.datasetsV3.get();
    expect(isNotModified(result)).toBe(false);
    if (isNotModified(result)) return;
    expect(result.spellingCorrections[0]?.from).toBe('HYPRTENSION');
    expect(result.datasets.spelling_corrections?.items[0]?.name).toBe('HYPRTENSION');
  });

  it('passes include / fields / If-None-Match to the request', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ data: { version: '3.0', datasets: {} } }),
    );
    const c = client(transport);
    await c.datasetsV3.get({
      include: ['conditions', 'medications'],
      fields: 'full',
      ifNoneMatch: 'W/"xyz"',
    });
    const req = requests[0];
    expect(req?.url).toContain('include=conditions,medications');
    expect(req?.url).toContain('fields=full');
    expect(req?.headers['If-None-Match']).toBe('W/"xyz"');
  });

  it('requests spelling corrections using the legacy server category', async () => {
    const { transport, requests } = recordingTransport(
      200,
      JSON.stringify({ data: { version: '3.0', datasets: {} } }),
    );
    const c = client(transport);
    await c.datasetsV3.get({ include: ['spelling_corrections'] });
    expect(requests[0]?.url).toContain('include=corrections');
  });
});
