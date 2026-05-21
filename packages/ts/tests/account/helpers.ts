import { AccountNamespace } from '../../src/account';
import type { Transport, TransportRequest } from '../../src/zyins/transport';
import { TEST_AUTH, FIXED_CLOCK } from '../zyins/fixtures';

export const TEST_BASE_URL = 'https://test.example';

/** A scripted transport that records requests and returns the given response. */
export function recordingTransport(
  status: number,
  body: string,
): { transport: Transport; requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    requests.push(req);
    return { status, body, headers: {} };
  };
  return { transport, requests };
}

/** Build an `AccountNamespace` wired to the supplied test transport. */
export function account(transport: Transport): AccountNamespace {
  return new AccountNamespace({
    auth: TEST_AUTH,
    baseUrl: TEST_BASE_URL,
    transport,
    clock: FIXED_CLOCK,
  });
}
