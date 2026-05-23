import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

describe('ZyInsClient.datasets.get', () => {
  it('accepts the standard data.datasets envelope shape', async () => {
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        data: {
          datasets: {
            nicotine_options: { data: ['No', 'Yes'] },
            products: { data: { term: [{ name: 'Term 10' }] } },
          },
        },
      }),
    );
    const c = client(transport);
    const result = await c.datasets.get();
    expect(result.nicotineOptions).toEqual(['No', 'Yes']);
    expect(result.products).toEqual({ term: ['Term 10'] });
  });
});
