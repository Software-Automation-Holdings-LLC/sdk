import { describe, expect, it } from 'vitest';
import { account, recordingTransport } from './helpers';

function parseSent(body: string): Record<string, unknown> {
  const value: unknown = JSON.parse(body);
  if (value === null || typeof value !== 'object') {
    throw new Error('test: expected JSON object body');
  }
  return value as Record<string, unknown>;
}

describe('isa.account.referenceData.get', () => {
  it('routes scope=dataset to GET /dataset/{name}', async () => {
    const body = JSON.stringify({ datasets: { states: [{ code: 'NC' }] } });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).referenceData.get({
      scope: 'dataset',
      dataset: 'states',
    });
    expect(result).toEqual({ datasets: { states: [{ code: 'NC' }] } });
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/dataset/states');
  });

  it('rejects scope=dataset without a dataset name', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      account(transport).referenceData.get({ scope: 'dataset' }),
    ).rejects.toThrow(/dataset/);
  });

  it('routes compiled_data_v2 to POST /v1/reference-data', async () => {
    const body = JSON.stringify({ datasets: { conditions: ['HBP'] } });
    const { transport, requests } = recordingTransport(200, body);
    const result = await account(transport).referenceData.get({
      scope: 'compiled_data_v2',
      payload: { filter: 'all' },
    });
    expect(result).toEqual({ datasets: { conditions: ['HBP'] } });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v1/reference-data');
    expect(requests[0]!.headers['Idempotency-Key']).toBeTruthy();
    const sent = parseSent(requests[0]!.body);
    expect(sent['scope']).toBe('compiled_data_v2');
    expect(sent['filter']).toBe('all');
  });

  it('keeps request scope authoritative over payload scope', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ ok: true }));
    await account(transport).referenceData.get({
      scope: 'compiled_data_v2',
      payload: { scope: 'compiled_data_v3', filter: 'all' },
    });
    const sent = parseSent(requests[0]!.body);
    expect(sent['scope']).toBe('compiled_data_v2');
    expect(sent['filter']).toBe('all');
  });

  it('routes compiled_data_v3 to POST /v2/reference-data', async () => {
    const { transport, requests } = recordingTransport(200, JSON.stringify({ x: 1 }));
    await account(transport).referenceData.get({ scope: 'compiled_data_v3' });
    expect(requests[0]!.method).toBe('POST');
    expect(requests[0]!.url).toBe('https://test.example/v2/reference-data');
  });

  it('rejects an empty scope', async () => {
    const { transport } = recordingTransport(200, '{}');
    await expect(
      // @ts-expect-error — runtime guard
      account(transport).referenceData.get({ scope: '' }),
    ).rejects.toThrow(/scope/);
  });

  it('accepts the enveloped { data: {...} } shape', async () => {
    const body = JSON.stringify({ data: { datasets: { y: 2 } } });
    const { transport } = recordingTransport(200, body);
    const result = await account(transport).referenceData.get({
      scope: 'compiled_data_v2',
    });
    expect(result).toEqual({ datasets: { y: 2 } });
  });

  it('maps 401 to a typed error', async () => {
    const { transport } = recordingTransport(
      401,
      JSON.stringify({ type: 'about:blank', status: 401, code: 'unauthorized' }),
    );
    await expect(
      account(transport).referenceData.get({ scope: 'compiled_data_v2' }),
    ).rejects.toBeInstanceOf(Error);
  });

  it('maps 500 to a typed error', async () => {
    const { transport } = recordingTransport(
      500,
      JSON.stringify({ type: 'about:blank', status: 500, code: 'server_error' }),
    );
    await expect(
      account(transport).referenceData.get({ scope: 'dataset', dataset: 'states' }),
    ).rejects.toBeInstanceOf(Error);
  });
});
