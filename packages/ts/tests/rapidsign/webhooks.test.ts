import { describe, expect, it } from 'vitest';
import { RapidSignClient } from '../../src/rapidsign/client';
import { RapidSignError } from '../../src/rapidsign/errors';
import { TEST_TOKEN } from './fixtures';

describe('webhooks.verify (stub)', () => {
  it('throws NotImplemented pointing at the tracking issue', () => {
    const client = new RapidSignClient(TEST_TOKEN);
    expect(() => client.webhooks.verify('{}', {}, 'secret')).toThrowError(
      RapidSignError.NotImplemented,
    );
    try {
      client.webhooks.verify('{}', {}, 'secret');
    } catch (err) {
      expect((err as Error).message).toContain('issues/38');
    }
  });
});
