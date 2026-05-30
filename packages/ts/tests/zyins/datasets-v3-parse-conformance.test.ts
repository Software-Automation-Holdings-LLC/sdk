/**
 * Cross-language parse-parity conformance for the v3 datasets product-slice
 * fields. Drives the same corpus
 * (`shared/schemas/sdk/testdata/datasets_v3_parse_conformance.json`) the
 * Go / Python / PHP / C# SDKs assert against, so drift between languages on
 * empty-vs-absent, the non-empty-id keep predicate, the blank-name default,
 * the non-array-family skip, or the safe-integer epoch bound surfaces here.
 *
 * TypeScript is the reference implementation: when a field's canonical is
 * ambiguous the other SDKs match TS, so this test pins the contract the corpus
 * encodes.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { client, recordingTransport } from './client-test-helpers';
import { isNotModified } from '../../src/zyins/datasets-v3';

interface IExpectedEntity {
    readonly id: string;
    readonly name: string;
}

interface IScenarioExpected {
    readonly version: string;
    readonly products_by_family: Readonly<Record<string, readonly IExpectedEntity[]>>;
    readonly discontinued_products: Readonly<Record<string, number>>;
    readonly state_derivatives: readonly string[];
}

interface IScenario {
    readonly name: string;
    readonly response_body: unknown;
    readonly expected: IScenarioExpected;
}

const CORPUS_PATH = join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    '..',
    '..',
    'shared',
    'schemas',
    'sdk',
    'testdata',
    'datasets_v3_parse_conformance.json',
);

const scenarios = (JSON.parse(readFileSync(CORPUS_PATH, 'utf8')) as { scenarios: readonly IScenario[] }).scenarios;

describe('datasetsV3.get — cross-language parse-parity corpus', () => {
    it('exercises every corpus scenario', () => {
        expect(scenarios.length).toBeGreaterThan(0);
    });

    for (const scenario of scenarios) {
        it(scenario.name, async () => {
            const { transport } = recordingTransport(200, JSON.stringify(scenario.response_body));
            const result = await client(transport).datasetsV3.get();
            expect(isNotModified(result)).toBe(false);
            if (isNotModified(result)) return;

            expect(result.version).toBe(scenario.expected.version);
            // toEqual treats {} / [] structurally, so a present-empty collection
            // matches the corpus expectation while a missing key would not.
            expect(result.productsByFamily).toEqual(scenario.expected.products_by_family);
            expect(result.discontinuedProducts).toEqual(scenario.expected.discontinued_products);
            expect(result.stateDerivatives).toEqual(scenario.expected.state_derivatives);
        });
    }
});
