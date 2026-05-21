import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';

const HEALTHY_BODY = JSON.stringify({
  ready: true,
  status: 'serving',
  db: { status: 'serving', latency_ms: 3, checked_at: '2026-05-14T14:32:01Z' },
  cache: { status: 'serving', latency_ms: 1, checked_at: '2026-05-14T14:32:01Z' },
  checked_at: '2026-05-14T14:32:01Z',
});

describe('ZyInsClient.health.getReadiness', () => {
  it('GETs /ready and parses the typed body', async () => {
    const { transport, requests } = recordingTransport(200, HEALTHY_BODY);
    const c = client(transport);
    const result = await c.health.getReadiness();
    expect(result.ready).toBe(true);
    expect(result.status).toBe('serving');
    expect(result.db.latencyMs).toBe(3);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://test.example/ready');
  });

  it('parses downstream_services map', async () => {
    const body = JSON.stringify({
      ready: false,
      status: 'not_serving',
      db: { status: 'serving', latency_ms: 2, checked_at: '2026-05-14T14:32:01Z' },
      cache: { status: 'not_serving', latency_ms: 0, message: 'connection refused', checked_at: '2026-05-14T14:32:01Z' },
      downstream_services: {
        accounts: { status: 'serving', latency_ms: 5, checked_at: '2026-05-14T14:32:01Z' },
      },
      checked_at: '2026-05-14T14:32:01Z',
    });
    const { transport } = recordingTransport(200, body);
    const c = client(transport);
    const result = await c.health.getReadiness();
    expect(result.ready).toBe(false);
    expect(result.cache.message).toBe('connection refused');
    expect(result.downstreamServices['accounts']!.latencyMs).toBe(5);
  });

  it('surfaces 503 as a typed error', async () => {
    const { transport } = recordingTransport(
      503,
      JSON.stringify({ type: 'about:blank', title: 'not ready', status: 503, code: 'service_unavailable' }),
    );
    const c = client(transport);
    await expect(c.health.getReadiness()).rejects.toBeInstanceOf(Error);
  });

  it('defaults invalid readiness fields to safe values', async () => {
    const { transport } = recordingTransport(
      200,
      JSON.stringify({
        ready: 'false',
        status: 'warming_up',
        db: { status: 'warming_up', latency_ms: 3, checked_at: '2026-05-14T14:32:01Z' },
        cache: { status: 'serving', latency_ms: 1, checked_at: '2026-05-14T14:32:01Z' },
        checked_at: '2026-05-14T14:32:01Z',
      }),
    );
    const c = client(transport);
    const result = await c.health.getReadiness();
    expect(result.ready).toBe(false);
    expect(result.status).toBe('unknown');
    expect(result.db.status).toBe('unknown');
  });
});
