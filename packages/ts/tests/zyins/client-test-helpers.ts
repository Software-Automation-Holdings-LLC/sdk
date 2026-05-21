import { ZyInsClient } from '../../src/zyins/client';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { FIXED_CLOCK, TEST_AUTH } from './fixtures';

export function recordingTransport(status: number, body: string): {
  transport: Transport;
  requests: TransportRequest[];
} {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    requests.push(req);
    return { status, body, headers: {} };
  };
  return { transport, requests };
}

export function client(transport: Transport): ZyInsClient {
  return new ZyInsClient({
    auth: TEST_AUTH,
    baseUrl: 'https://test.example',
    transport,
    clock: FIXED_CLOCK,
  });
}
