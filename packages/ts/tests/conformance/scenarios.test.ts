// Cross-language SDK parity test.
//
// Loads tests/conformance/scenarios.json and verifies that for each scenario
// the SDK (or raw HTTP, as a fallback) produces a response matching the
// declared assertion vector. Same JSON drives parametrized tests in every
// language SDK; drift between SDKs surfaces here.
//
// Set ISA_MOCK_URL to run against isa-mock. Without it, scenario replay tests
// are explicitly skipped so local `npm test` does not require the mock.

import { beforeAll, describe, expect, it } from "vitest";
import scenarioFixture from "../../../../tests/conformance/scenarios.json";

interface ScenarioRequest {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
    body_raw?: string;
}

interface ScenarioExpected {
    status: number;
    content_type?: string;
    envelope_fields?: string[];
    code?: string | null;
    idempotency_key_echoed?: boolean;
    problem_fields?: string[];
}

interface Scenario {
    name: string;
    request: ScenarioRequest;
    expected: ScenarioExpected;
}

interface ScenarioFile {
    scenarios: Scenario[];
}

const MOCK_URL = process.env.ISA_MOCK_URL ?? "http://127.0.0.1:4010";
const HAS_MOCK_URL = process.env.ISA_MOCK_URL !== undefined;
const MIN_SCENARIOS = 10;
const HEALTH_STATUS_NO_CONTENT = 204;

function assertScenarioFile(value: unknown): asserts value is ScenarioFile {
    if (typeof value !== "object" || value === null) {
        throw new Error("scenarios.json: root is not an object");
    }
    const scenarios = (value as { scenarios?: unknown }).scenarios;
    if (!Array.isArray(scenarios)) {
        throw new Error("scenarios.json: missing 'scenarios' array");
    }
}

function loadScenarios(): Scenario[] {
    const parsed: unknown = scenarioFixture;
    assertScenarioFile(parsed);
    return parsed.scenarios;
}

async function mockIsReachable(url: string): Promise<boolean> {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 500);
    try {
        const resp = await fetch(url + "/__healthz_probe__", { method: "GET", signal: ctrl.signal });
        void resp.body?.cancel();
        return resp.status === HEALTH_STATUS_NO_CONTENT;
    } catch {
        return false;
    } finally {
        clearTimeout(timeout);
    }
}

async function executeScenario(scenario: Scenario): Promise<Response> {
    const { method, path, headers = {}, body, body_raw } = scenario.request;
    const init: RequestInit = { method, headers };
    if (body_raw !== undefined) {
        init.body = body_raw;
    } else if (body !== undefined) {
        init.body = JSON.stringify(body);
    }
    return fetch(MOCK_URL + path, init);
}

describe("cross-language scenario parity", () => {
    const scenarios = loadScenarios();
    const scenarioTest = HAS_MOCK_URL ? it : it.skip;

    beforeAll(async () => {
        if (HAS_MOCK_URL && !(await mockIsReachable(MOCK_URL))) {
            throw new Error(`isa-mock is not reachable at ${MOCK_URL}`);
        }
    });

    it("loads at least the minimum number of scenarios from scenarios.json", () => {
        expect(scenarios.length).toBeGreaterThanOrEqual(MIN_SCENARIOS);
    });

    for (const scenario of scenarios) {
        scenarioTest(`scenario: ${scenario.name}`, async () => {
            const resp = await executeScenario(scenario);
            expect(resp.status).toBe(scenario.expected.status);

            if (scenario.expected.content_type) {
                const ct = resp.headers.get("content-type") ?? "";
                expect(ct).toContain(scenario.expected.content_type);
            }

            const ct = resp.headers.get("content-type") ?? "";
            if (!ct.includes("json")) return;

            const payload = (await resp.json()) as Record<string, unknown>;

            for (const field of scenario.expected.envelope_fields ?? []) {
                expect(payload).toHaveProperty(field);
            }
            for (const field of scenario.expected.problem_fields ?? []) {
                expect(payload).toHaveProperty(field);
            }
            if (scenario.expected.code !== undefined && scenario.expected.code !== null) {
                expect(payload.code).toBe(scenario.expected.code);
            }
            if (scenario.expected.idempotency_key_echoed === true) {
                const sentKey = scenario.request.headers?.["X-Isa-Idempotency-Key"];
                expect(sentKey).toBeDefined();
                expect(payload.idempotency_key).toBe(sentKey);
            }
        });
    }
});
