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

/** Viewer origin used by case share-link tests. */
export const TEST_CASE_VIEWER_BASE_URL = 'https://viewer.example';

/** Build an `AccountNamespace` with an explicit case viewer base URL. */
export function accountWithViewer(
  transport: Transport,
  caseViewerBaseUrl: string,
): AccountNamespace {
  return new AccountNamespace({
    auth: TEST_AUTH,
    baseUrl: TEST_BASE_URL,
    caseViewerBaseUrl,
    transport,
    clock: FIXED_CLOCK,
  });
}

/**
 * A transport whose response is chosen by a per-request handler. Records every
 * request for assertion. Lets one test script distinct create / open responses
 * (POST returns an id, the GET returns the stored envelope).
 */
export function scriptedTransport(
  handler: (req: TransportRequest) => { status: number; body: string },
): { transport: Transport; requests: TransportRequest[] } {
  const requests: TransportRequest[] = [];
  const transport: Transport = async (req) => {
    requests.push(req);
    const { status, body } = handler(req);
    return { status, body, headers: {} };
  };
  return { transport, requests };
}
