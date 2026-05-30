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
              medications: {
                data: [
                  {
                    name: 'Lisinopril',
                    uses: [{ condition: 'High Blood Pressure', frequency: 12 }],
                  },
                  {
                    name: 'Losartan',
                    uses: [{ condition: 'High Blood Pressure', frequency: 4 }],
                  },
                ],
              },
          },
        },
      }),
    );
    const c = client(transport);
    const result = await c.datasets.get();
    expect(result.nicotineOptions).toEqual(['No', 'Yes']);
    expect(result.products).toEqual({ term: ['Term 10'] });
    expect(result.medicationsByCondition).toEqual({
      'High Blood Pressure': ['Lisinopril', 'Losartan'],
      HIGHBLOODPRESSURE: ['LISINOPRIL', 'LOSARTAN'],
    });
    expect(result.frequencyGraphs).toEqual({
      use_map: {
        'High Blood Pressure': { Lisinopril: 12, Losartan: 4 },
        HIGHBLOODPRESSURE: { LISINOPRIL: 12, LOSARTAN: 4 },
      },
    });
  });
});
