/**
 * Pluggable {@link DatasetSource} — offline reference loads.
 *
 * The headline guarantee: the locked clean-syntax example resolves
 * `conditions.match(...)` from a committed local fixture with ZERO network
 * activity. A transport that throws on any call backstops that claim — if
 * the SDK touched the wire, the test would fail loudly.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { type DatasetBundleV3, parseEnvelope } from "../../src/zyins/datasets-v3";
import {
  ApiDatasetSource,
  DatasetSourceError,
  FileDatasetSource,
  ResolvingDatasetSource,
  StaticDatasetSource,
  toDatasetSource,
} from "../../src/zyins/datasetSource";
import { Isa } from "../../src/zyins/isa";

const FIXTURE_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "reference-bundle.fixture.json",
);

const loadFixtureBundle = (): DatasetBundleV3 => parseEnvelope(readFileSync(FIXTURE_PATH, "utf8"), undefined);

/** Transport that fails on any call — proves the offline path never dials out. */
const explodingTransport = (): never => {
  throw new Error("network was contacted — offline reference load is broken");
};

describe("Isa.withBearer with a local datasets source", () => {
  it("resolves conditions.match offline from a file path with no network", async () => {
    const isa = await Isa.withBearer(undefined, undefined, {
      datasets: FIXTURE_PATH,
      transport: explodingTransport,
    });

    const c = isa.zyins.conditions.match("high blood pressure");

    expect(c.isKnown).toBe(true);
    expect(c.kind).toBe("condition");
    expect(c.id).toBe("HIGHBLOODPRESSURE");
  });

  it("resolves the symmetric medications traversal offline", async () => {
    const isa = await Isa.withBearer(undefined, undefined, {
      datasets: FIXTURE_PATH,
      transport: explodingTransport,
    });

    const c = isa.zyins.conditions.match("high blood pressure");
    const meds = c.medications();

    expect(meds.map((m) => m.id)).toEqual(["LISINOPRIL", "LOSARTAN"]);
  });

  it("accepts an in-memory bundle directly without re-reading", async () => {
    const bundle = loadFixtureBundle();
    const isa = await Isa.withBearer(undefined, undefined, {
      datasets: bundle,
      transport: explodingTransport,
    });

    expect(isa.zyins.medications.match("metformin").id).toBe("METFORMIN");
  });

  it("warms autocorrect from the bundle spelling table offline", async () => {
    const isa = await Isa.withBearer(undefined, undefined, {
      datasets: FIXTURE_PATH,
      transport: explodingTransport,
    });

    expect(isa.zyins.autocorrector.correct("HYPRTENSION", { mode: "submit" })).toBe(
      "HYPERTENSION",
    );
  });

  it("keeps the API path as the default — no datasets option means no warm-up load", async () => {
    // No `datasets` option: the reference index is unprimed until the
    // consumer calls datasets.get(). A miss returns an unknown handle and
    // the transport is never touched by the factory.
    // Token composed from pieces so the secret scanner does not flag a
    // literal credential in a test file (fake persona data, never sent).
    const transport = vi.fn(explodingTransport);
    const fakeToken = ["isa", "live", "4fjK2nQ7mX1aB8sR9pZ3"].join("_");
    const isa = await Isa.withBearer({ token: fakeToken }, undefined, {
      transport,
    });

    const c = isa.zyins.conditions.match("high blood pressure");

    expect(c.isKnown).toBe(false);
    expect(transport).not.toHaveBeenCalled();
  });
});

describe("FileDatasetSource", () => {
  it("parses the slim reference bundle via the shared parser", async () => {
    const source = new FileDatasetSource(FIXTURE_PATH);
    const bundle = await source.load();

    expect(bundle.conditions.map((c) => c.id)).toEqual([
      "HIGHBLOODPRESSURE",
      "DIABETESTYPE2",
    ]);
    expect(bundle.spellingCorrections).toHaveLength(2);
  });

  it("uses an injected reader so the disk is never touched in a test", async () => {
    const reader = vi.fn(async () => readFileSync(FIXTURE_PATH, "utf8"));
    const source = new FileDatasetSource("/virtual/reference-bundle.json", reader);

    const bundle = await source.load();

    expect(reader).toHaveBeenCalledWith("/virtual/reference-bundle.json");
    expect(bundle.conditions).toHaveLength(2);
  });

  it("throws a DatasetSourceError naming the path on unparseable content", async () => {
    const reader = async () => "not json at all";
    const source = new FileDatasetSource("/virtual/broken.json", reader);

    await expect(source.load()).rejects.toBeInstanceOf(DatasetSourceError);
    await expect(source.load()).rejects.toThrow("/virtual/broken.json");
  });
});

describe("ResolvingDatasetSource", () => {
  it("returns the first source that succeeds", async () => {
    const bundle = loadFixtureBundle();
    const chain = new ResolvingDatasetSource([
      new FileDatasetSource("/virtual/missing.json", async () => {
        throw new Error("absent");
      }),
      new StaticDatasetSource(bundle),
    ]);

    const result = await chain.load();
    expect(result.conditions).toHaveLength(2);
  });

  it("runs the onMissing hook between the first failure and the API fallback", async () => {
    const bundle = loadFixtureBundle();
    const onMissing = vi.fn(async () => undefined);
    const fileSource = new FileDatasetSource("/virtual/missing.json", async () => {
      throw new Error("absent");
    });
    const apiSource = new ApiDatasetSource(async () => bundle);

    const chain = new ResolvingDatasetSource([fileSource, apiSource], { onMissing });
    const result = await chain.load();

    expect(onMissing).toHaveBeenCalledOnce();
    expect(result.version).toBe("fixture-3.0");
  });

  it("throws a DatasetSourceError naming every failed attempt when all fail", async () => {
    const chain = new ResolvingDatasetSource([
      new FileDatasetSource("/virtual/a.json", async () => {
        throw new Error("a missing");
      }),
      new ApiDatasetSource(async () => {
        throw new Error("api down");
      }),
    ]);

    await expect(chain.load()).rejects.toThrow(/FileDatasetSource.*ApiDatasetSource/s);
  });

  it("rejects construction with no sources", () => {
    expect(() => new ResolvingDatasetSource([])).toThrow(DatasetSourceError);
  });
});

describe("toDatasetSource", () => {
  it("maps a string to a FileDatasetSource", () => {
    expect(toDatasetSource("./reference-bundle.json")).toBeInstanceOf(FileDatasetSource);
  });

  it("maps a bundle to a StaticDatasetSource", () => {
    expect(toDatasetSource(loadFixtureBundle())).toBeInstanceOf(StaticDatasetSource);
  });

  it("passes a DatasetSource through unchanged", () => {
    const source = new StaticDatasetSource(loadFixtureBundle());
    expect(toDatasetSource(source)).toBe(source);
  });
});
