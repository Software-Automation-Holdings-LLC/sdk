import { describe, expect, it } from 'vitest';

import { evaluateClientVersion } from '../../src/zyins/clientVersion';

describe('evaluateClientVersion', () => {
  it('does not report a hard mismatch when the client matches current', () => {
    const status = evaluateClientVersion(
      {
        'x-client-current': 'current-hash',
        'x-client-minimum': 'minimum-hash',
      },
      'current-hash',
    );

    expect(status).toBeUndefined();
  });

  it('reports a soft mismatch when the client matches minimum but not current', () => {
    const status = evaluateClientVersion(
      {
        'x-client-current': 'current-hash',
        'x-client-minimum': 'minimum-hash',
      },
      'minimum-hash',
    );

    expect(status?.level).toBe('soft');
  });

  it('reports a soft mismatch for opaque versions that differ from minimum', () => {
    const status = evaluateClientVersion(
      {
        'x-client-minimum': 'minimum-hash',
      },
      'intermediate-hash',
    );

    expect(status?.level).toBe('soft');
  });
});
