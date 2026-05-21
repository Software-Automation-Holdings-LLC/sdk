#!/usr/bin/env node
// @ts-check
//
// C# catalog code generator. Sibling of packages/ts/scripts/gen-catalog.mjs.
//
// Reads source data files (insurance/v2_products.json,
// insurance/v2_medications.json, isa-platform/shared/schemas/api/isa/v1/common.proto,
// isa-platform/shared/go/events/registry.go) and emits idiomatic C# files
// under packages/csharp/src/Catalog/.
//
// Output is deterministic: same input bytes produce byte-identical output.
// Regenerate with `node packages/csharp/scripts/gen-catalog.mjs`.

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO_CS = resolve(__dirname, '..');
const CATALOG_DIR = join(REPO_CS, 'src', 'Catalog');

const PLATFORM_REPO = process.env.SDK_PLATFORM_REPO
  ? resolve(process.env.SDK_PLATFORM_REPO)
  : resolve(REPO_CS, '..', '..');

const INSURANCE_REPO = process.env.SDK_INSURANCE_REPO
  ? resolve(process.env.SDK_INSURANCE_REPO)
  : resolve(PLATFORM_REPO, '..', 'insurance');

const HEADER = (sources) => `// CATALOG-GEN: do not hand-edit; rerun packages/csharp/scripts/gen-catalog.mjs.
//
// Source data:
${sources.map((s) => `//   - ${s}`).join('\n')}

`;

const gaps = [];

function tryReadJson(p) {
  try {
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch (e) {
    process.stderr.write(`gen-catalog: failed to read ${p}: ${e.message}\n`);
    return null;
  }
}

function tryReadText(p) {
  try {
    if (!existsSync(p)) return null;
    return readFileSync(p, 'utf8');
  } catch (e) {
    process.stderr.write(`gen-catalog: failed to read ${p}: ${e.message}\n`);
    return null;
  }
}

function pascal(s) {
  return s
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length === 0 ? '' : w[0].toUpperCase() + w.slice(1).toLowerCase()))
    .join('');
}

function slugify(s) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function csStr(s) {
  return '"' + String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function ensureDir(p) {
  mkdirSync(p, { recursive: true });
}

function writeFile(name, content) {
  const out = join(CATALOG_DIR, name);
  writeFileSync(out, content);
  process.stderr.write(`gen-catalog (cs): wrote ${out}\n`);
}

const STATES = [
  ['Alabama', 'AL', false], ['Alaska', 'AK', false], ['Arizona', 'AZ', false],
  ['Arkansas', 'AR', false], ['California', 'CA', false], ['Colorado', 'CO', false],
  ['Connecticut', 'CT', false], ['Delaware', 'DE', false], ['Florida', 'FL', false],
  ['Georgia', 'GA', false], ['Hawaii', 'HI', false], ['Idaho', 'ID', false],
  ['Illinois', 'IL', false], ['Indiana', 'IN', false], ['Iowa', 'IA', false],
  ['Kansas', 'KS', false], ['Kentucky', 'KY', false], ['Louisiana', 'LA', false],
  ['Maine', 'ME', false], ['Maryland', 'MD', false], ['Massachusetts', 'MA', false],
  ['Michigan', 'MI', false], ['Minnesota', 'MN', false], ['Mississippi', 'MS', false],
  ['Missouri', 'MO', false], ['Montana', 'MT', false], ['Nebraska', 'NE', false],
  ['Nevada', 'NV', false], ['New Hampshire', 'NH', false], ['New Jersey', 'NJ', false],
  ['New Mexico', 'NM', false], ['New York', 'NY', false], ['North Carolina', 'NC', false],
  ['North Dakota', 'ND', false], ['Ohio', 'OH', false], ['Oklahoma', 'OK', false],
  ['Oregon', 'OR', false], ['Pennsylvania', 'PA', false], ['Rhode Island', 'RI', false],
  ['South Carolina', 'SC', false], ['South Dakota', 'SD', false], ['Tennessee', 'TN', false],
  ['Texas', 'TX', false], ['Utah', 'UT', false], ['Vermont', 'VT', false],
  ['Virginia', 'VA', false], ['Washington', 'WA', false], ['West Virginia', 'WV', false],
  ['Wisconsin', 'WI', false], ['Wyoming', 'WY', false], ['District of Columbia', 'DC', false],
  ['American Samoa', 'AS', true], ['Guam', 'GU', true], ['Northern Mariana Islands', 'MP', true],
  ['Puerto Rico', 'PR', true], ['United States Virgin Islands', 'VI', true],
];

function genStates() {
  const sources = ['ISO 3166-2:US (50 states + DC + 5 inhabited territories)'];
  const members = STATES.map(([name, abbr]) =>
    `    /// <summary>${name} (${abbr}).</summary>\n    [WireValue("${abbr}")] ${pascal(name)},`
  ).join('\n');
  const metaInit = STATES.map(([name, abbr, isTerr]) =>
    `        ["${abbr}"] = new StateMetadata("${abbr}", ${csStr(name)}, ${isTerr ? 'true' : 'false'}),`
  ).join('\n');
  const byName = STATES.map(([name, abbr]) =>
    `        [${csStr(name.toLowerCase())}] = "${abbr}",`
  ).join('\n');
  const byAbbr = STATES.map(([name, abbr]) =>
    `        ["${abbr}"] = State.${pascal(name)},`
  ).join('\n');

  const content = `${HEADER(sources)}using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Reflection;

namespace Sah.Sdk.Catalog;

/// <summary>Attaches the canonical wire-form string to a catalog enum member.</summary>
[AttributeUsage(AttributeTargets.Field)]
public sealed class WireValueAttribute : Attribute
{
    /// <summary>Canonical wire-form value emitted by the engine.</summary>
    public string Value { get; }
    /// <summary>Construct with the canonical wire value.</summary>
    public WireValueAttribute(string value) => Value = value;
}

/// <summary>ISO 3166-2:US administrative subdivisions. Includes the 50 states,
/// DC, and the five inhabited US territories. Order is alphabetical by name.</summary>
public enum State
{
${members}
}

/// <summary>Public metadata for a single <see cref="State"/>.</summary>
public sealed record StateMetadata(string Abbreviation, string Name, bool IsTerritory);

/// <summary>Catalog API for <see cref="State"/>. Every accessor returns a
/// read-only view; the underlying tables are constructed once at startup.</summary>
public static class States
{
    private static readonly IReadOnlyDictionary<string, StateMetadata> METADATA = new ReadOnlyDictionary<string, StateMetadata>(new Dictionary<string, StateMetadata>
    {
${metaInit}
    });

    private static readonly IReadOnlyDictionary<string, string> BY_NAME = new ReadOnlyDictionary<string, string>(new Dictionary<string, string>
    {
${byName}
    });

    private static readonly IReadOnlyDictionary<string, State> BY_ABBR = new ReadOnlyDictionary<string, State>(new Dictionary<string, State>
    {
${byAbbr}
    });

    private static readonly State[] ALL = (State[])Enum.GetValues(typeof(State));

    /// <summary>Every state in catalog order.</summary>
    public static IReadOnlyList<State> Values() => ALL;

    /// <summary>Metadata lookup for a <see cref="State"/> enum value.</summary>
    public static StateMetadata Metadata(State s)
    {
        var abbr = WireValue(s);
        if (!METADATA.TryGetValue(abbr, out var m))
            throw new ArgumentException($"States.Metadata: unknown state '{s}'", nameof(s));
        return m;
    }

    /// <summary>Look up a state by ISO abbreviation (case-insensitive) or by
    /// full English name (case-insensitive). Returns null when not recognized.</summary>
    public static State? ByAbbreviation(string abbr)
    {
        if (string.IsNullOrEmpty(abbr)) return null;
        var upper = abbr.ToUpperInvariant();
        if (BY_ABBR.TryGetValue(upper, out var s1)) return s1;
        var lower = abbr.ToLowerInvariant();
        if (BY_NAME.TryGetValue(lower, out var key) && BY_ABBR.TryGetValue(key, out var s2)) return s2;
        return null;
    }

    /// <summary>Canonical wire-form value for a <see cref="State"/>.</summary>
    public static string WireValue(State s)
    {
        var member = typeof(State).GetField(s.ToString());
        if (member is null) return s.ToString();
        var attr = member.GetCustomAttribute<WireValueAttribute>();
        return attr is not null ? attr.Value : s.ToString();
    }
}
`;
  writeFile('States.cs', content);
}

function genProducts() {
  const path = join(INSURANCE_REPO, 'v2_products.json');
  const raw = tryReadJson(path);
  const sources = ['insurance/v2_products.json'];

  const products = [];
  if (raw) {
    for (const [cls, list] of Object.entries(raw)) {
      if (!Array.isArray(list)) continue;
      for (const p of list) {
        if (!p || typeof p !== 'object') continue;
        const identifier = String(p.identifier || '');
        if (!identifier) continue;
        products.push({
          slug: identifier,
          productClass: cls,
          carrierDisplay: String(p.carrier || ''),
          carrierSlug: slugify(String(p.carrier || '')),
          displayName: String(p.name || ''),
          stateVariations: Array.isArray(p.state_variations) ? p.state_variations.map((v) => String(v)) : [],
        });
      }
    }
  } else {
    gaps.push('Products: v2_products.json not found.');
  }
  products.sort((a, b) => a.slug.localeCompare(b.slug));

  const enumMembers = products.map((p) =>
    `    /// <summary>${p.displayName.replace(/</g,'&lt;').replace(/>/g,'&gt;')} (${p.slug}).</summary>\n    [WireValue("${p.slug}")] ${pascal(p.slug)},`
  ).join('\n');

  const metaInit = products.map((p) => {
    const stateVars = p.stateVariations.length === 0
      ? 'Array.Empty<string>()'
      : `new[] { ${p.stateVariations.map(csStr).join(', ')} }`;
    return `        ["${p.slug}"] = new ProductMetadata("${p.slug}", ${csStr(p.displayName)}, "${p.carrierSlug}", "${p.productClass}", ${stateVars}),`;
  }).join('\n');

  const productsContent = `${HEADER(sources)}using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;
using System.Reflection;

namespace Sah.Sdk.Catalog;

/// <summary>Product slug enum. Each member's wire value is the canonical product
/// identifier the platform uses in URLs and reference-data lookups.</summary>
public enum Product
{
${enumMembers}
}

/// <summary>Public metadata for a single <see cref="Product"/>.</summary>
public sealed record ProductMetadata(
    string Slug,
    string DisplayName,
    string Carrier,
    string ProductClass,
    IReadOnlyList<string> StateVariations);

/// <summary>Catalog API for <see cref="Product"/>. Methods return frozen,
/// sorted views; the underlying tables are constructed once at startup.</summary>
public static class Products
{
    private static readonly IReadOnlyDictionary<string, ProductMetadata> METADATA = new ReadOnlyDictionary<string, ProductMetadata>(new Dictionary<string, ProductMetadata>
    {
${metaInit}
    });

    private static readonly Product[] ALL = ((Product[])Enum.GetValues(typeof(Product)))
        .OrderBy(p => WireValue(p), StringComparer.Ordinal)
        .ToArray();

    /// <summary>Every product slug, sorted alphabetically.</summary>
    public static IReadOnlyList<Product> Values() => ALL;

    /// <summary>(<see cref="Product"/>, <see cref="ProductMetadata"/>) pairs in catalog order.</summary>
    public static IReadOnlyList<(Product Product, ProductMetadata Metadata)> Entries() =>
        ALL.Select(p => (p, METADATA[WireValue(p)])).ToList().AsReadOnly();

    /// <summary>Products filed by a given carrier slug. Case-insensitive match.</summary>
    public static IReadOnlyList<Product> ByCarrier(string carrier)
    {
        if (carrier is null) throw new ArgumentNullException(nameof(carrier));
        var target = carrier.ToLowerInvariant();
        return ALL.Where(p => METADATA[WireValue(p)].Carrier == target).ToList().AsReadOnly();
    }

    /// <summary>Substring search across slug + display name. Prefix matches come first.</summary>
    public static IReadOnlyList<Product> Search(string query)
    {
        if (query is null) return Array.Empty<Product>();
        var q = query.Trim().ToLowerInvariant();
        if (q.Length == 0) return Array.Empty<Product>();
        var prefix = new List<Product>();
        var substring = new List<Product>();
        foreach (var p in ALL)
        {
            var m = METADATA[WireValue(p)];
            var disp = m.DisplayName.ToLowerInvariant();
            var hay = m.Slug + " " + disp;
            if (hay.StartsWith(q, StringComparison.Ordinal) || disp.StartsWith(q, StringComparison.Ordinal))
                prefix.Add(p);
            else if (hay.Contains(q))
                substring.Add(p);
        }
        prefix.AddRange(substring);
        return prefix.AsReadOnly();
    }

    /// <summary>Metadata lookup for a <see cref="Product"/> enum value.</summary>
    public static ProductMetadata Metadata(Product p)
    {
        var slug = WireValue(p);
        if (!METADATA.TryGetValue(slug, out var m))
            throw new ArgumentException($"Products.Metadata: unknown product '{p}'", nameof(p));
        return m;
    }

    /// <summary>Canonical wire-form value for a <see cref="Product"/>.</summary>
    public static string WireValue(Product p)
    {
        var member = typeof(Product).GetField(p.ToString());
        if (member is null) return p.ToString();
        var attr = member.GetCustomAttribute<WireValueAttribute>();
        return attr is not null ? attr.Value : p.ToString();
    }
}
`;
  writeFile('Products.cs', productsContent);

  const byCarrier = new Map();
  for (const p of products) {
    if (!p.carrierSlug) continue;
    const entry = byCarrier.get(p.carrierSlug) || { slug: p.carrierSlug, displayName: p.carrierDisplay, products: [] };
    entry.products.push(p.slug);
    byCarrier.set(p.carrierSlug, entry);
  }
  const carriers = [...byCarrier.values()].sort((a, b) => a.slug.localeCompare(b.slug));

  const carrierEntries = carriers.map((c) => {
    const productExprs = c.products.map((p) => `Product.${pascal(p)}`).join(', ');
    const productList = c.products.length === 0 ? 'Array.Empty<Product>()' : `new[] { ${productExprs} }`;
    return `        ["${c.slug}"] = new ProductCarrierMetadata(${csStr(c.displayName)}, ${productList}),`;
  }).join('\n');

  const carriersContent = `${HEADER(sources)}using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>Public metadata for a single carrier. Today's catalog does not
/// expose per-carrier licensure data; <c>States</c> is intentionally omitted.</summary>
public sealed record ProductCarrierMetadata(
    string DisplayName,
    IReadOnlyList<Product> Products);

/// <summary>Catalog API for carriers.</summary>
public static class ProductCarriers
{
    private static readonly IReadOnlyDictionary<string, ProductCarrierMetadata> CARRIERS = new ReadOnlyDictionary<string, ProductCarrierMetadata>(new Dictionary<string, ProductCarrierMetadata>
    {
${carrierEntries}
    });

    /// <summary>Every carrier slug.</summary>
    public static IReadOnlyCollection<string> Values() => new List<string>(CARRIERS.Keys).AsReadOnly();

    /// <summary>Metadata lookup for a carrier slug. Case-insensitive.</summary>
    public static ProductCarrierMetadata Metadata(string carrier)
    {
        if (carrier is null) throw new ArgumentNullException(nameof(carrier));
        var key = carrier.ToLowerInvariant();
        if (!CARRIERS.TryGetValue(key, out var m))
            throw new ArgumentException($"ProductCarriers.Metadata: unknown carrier '{carrier}'", nameof(carrier));
        return m;
    }
}
`;
  writeFile('Carriers.cs', carriersContent);
}

function genConditionsAndMedicationUses() {
  const medPath = join(INSURANCE_REPO, 'v2_medications.json');
  const meds = tryReadJson(medPath);
  const sources = ['insurance/v2_conditions.json', 'insurance/v2_medications.json'];

  const condContent = `${HEADER(sources)}using System;
using System.Collections.Generic;

namespace Sah.Sdk.Catalog;

/// <summary>Public metadata for a condition category.</summary>
public sealed record ConditionCategoryMetadata(
    string DisplayName,
    IReadOnlyList<string> Conditions);

/// <summary>Categories partition the canonical condition list into clinically
/// related groups. The engine's reference data does not currently expose a
/// stable category taxonomy; the catalog is intentionally empty today.</summary>
public static class ConditionCategories
{
    private static readonly IReadOnlyDictionary<string, ConditionCategoryMetadata> CATEGORIES =
        new Dictionary<string, ConditionCategoryMetadata>();

    /// <summary>Every category name. Empty today.</summary>
    public static IReadOnlyCollection<string> Values() => Array.Empty<string>();

    /// <summary>Metadata lookup; throws on unknown category.</summary>
    public static ConditionCategoryMetadata Metadata(string category)
    {
        if (category is null) throw new ArgumentNullException(nameof(category));
        if (!CATEGORIES.TryGetValue(category, out var m))
            throw new ArgumentException($"ConditionCategories.Metadata: unknown category '{category}'", nameof(category));
        return m;
    }
}
`;
  writeFile('Conditions.cs', condContent);

  const useToMeds = new Map();
  if (Array.isArray(meds)) {
    for (const m of meds) {
      if (!m || typeof m !== 'object') continue;
      const name = String(m.name || '');
      const uses = Array.isArray(m.uses) ? m.uses : [];
      for (const u of uses) {
        if (!u || typeof u !== 'object') continue;
        const cond = String(u.condition || '');
        if (!cond || !name) continue;
        let set = useToMeds.get(cond);
        if (!set) { set = new Set(); useToMeds.set(cond, set); }
        set.add(name);
      }
    }
  } else {
    gaps.push('MedicationUses: v2_medications.json missing or malformed.');
  }

  const useNames = [...useToMeds.keys()].sort();
  const initLines = useNames.map((u) => {
    const list = [...useToMeds.get(u)].sort();
    const arr = list.map(csStr).join(', ');
    return `        [${csStr(u)}] = new MedicationUseMetadata(${csStr(u)}, new[] { ${arr} }),`;
  }).join('\n');

  const medsContent = `${HEADER(sources)}using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.Linq;

namespace Sah.Sdk.Catalog;

/// <summary>Public metadata for a single medication use (indication).</summary>
public sealed record MedicationUseMetadata(
    string DisplayName,
    IReadOnlyList<string> Medications);

/// <summary>Catalog API for medication uses.</summary>
public static class MedicationUses
{
    private static readonly IReadOnlyDictionary<string, MedicationUseMetadata> USES = new ReadOnlyDictionary<string, MedicationUseMetadata>(new Dictionary<string, MedicationUseMetadata>
    {
${initLines}
    });

    private static readonly string[] ALL = USES.Keys.OrderBy(k => k, StringComparer.Ordinal).ToArray();

    /// <summary>Every use name, sorted alphabetically.</summary>
    public static IReadOnlyList<string> Values() => ALL;

    /// <summary>Metadata lookup; throws on unknown use.</summary>
    public static MedicationUseMetadata Metadata(string use)
    {
        if (use is null) throw new ArgumentNullException(nameof(use));
        if (!USES.TryGetValue(use, out var m))
            throw new ArgumentException($"MedicationUses.Metadata: unknown use '{use}'", nameof(use));
        return m;
    }
}
`;
  writeFile('Medications.cs', medsContent);
}

function genScopes() {
  const protoPath = join(PLATFORM_REPO, 'shared', 'schemas', 'api', 'isa', 'v1', 'common.proto');
  const text = tryReadText(protoPath);
  const sources = ['isa-platform/shared/schemas/api/isa/v1/common.proto'];

  const scopes = [];
  if (text) {
    const block = text.match(/enum Scope \{([\s\S]*?)\}\s*$/m);
    if (block) {
      const lines = block[1].split('\n');
      let pendingComment = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          pendingComment += ' ' + trimmed.replace(/^\/\/\s?/, '');
          continue;
        }
        const m = trimmed.match(/^(SCOPE_[A-Z0-9_]+)\s*=\s*\d+;/);
        if (m) {
          const symbol = m[1];
          if (symbol === 'SCOPE_UNSPECIFIED') { pendingComment = ''; continue; }
          const wireMatch = pendingComment.match(/`([^`]+)`/);
          if (!wireMatch) { pendingComment = ''; continue; }
          const wire = wireMatch[1];
          const doc = pendingComment.replace(/`[^`]+`\s*—?\s*/, '').trim();
          const enumName = wire.split(/[:\-]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
          scopes.push({ enumName, wire, doc });
          pendingComment = '';
        } else if (trimmed === '') {
          pendingComment = '';
        }
      }
    }
  }
  if (scopes.length === 0) gaps.push('Scope: failed to parse common.proto Scope enum.');
  scopes.sort((a, b) => a.wire.localeCompare(b.wire));

  const members = scopes.map((s) =>
    `    /// <summary>${s.doc}</summary>\n    [WireValue("${s.wire}")] ${s.enumName},`
  ).join('\n');
  const descLines = scopes.map((s) => `        [Scope.${s.enumName}] = ${csStr(s.doc)},`).join('\n');

  const content = `${HEADER(sources)}using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>Bearer-token scopes recognized across the ISA platform.</summary>
public enum Scope
{
${members}
}

/// <summary>Human-readable description per scope.</summary>
public static class ScopeDescriptions
{
    private static readonly IReadOnlyDictionary<Scope, string> MAP = new ReadOnlyDictionary<Scope, string>(new Dictionary<Scope, string>
    {
${descLines}
    });

    /// <summary>Get the description for a scope.</summary>
    public static string Get(Scope s) => MAP.TryGetValue(s, out var v) ? v : string.Empty;
}
`;
  writeFile('Scopes.cs', content);
}

function genSignEvents() {
  const path = join(PLATFORM_REPO, 'shared', 'go', 'events', 'registry.go');
  const text = tryReadText(path);
  const sources = ['isa-platform/shared/go/events/registry.go'];

  const events = [];
  if (text) {
    const re = /EventType[A-Za-z0-9]+\s+EventType\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const wire = m[1];
      if (!/^(document|signer)\./.test(wire)) continue;
      const enumName = wire.split('.').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
      events.push({ enumName, wire });
    }
  }
  if (events.length === 0) gaps.push('SignEvent: no rapidsign-domain events parsed.');
  events.sort((a, b) => a.wire.localeCompare(b.wire));

  const members = events.map((e) => `    [WireValue("${e.wire}")] ${e.enumName},`).join('\n');
  const labels = events.map((e) => `        [SignEvent.${e.enumName}] = "${e.enumName}",`).join('\n');

  const content = `${HEADER(sources)}using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>RapidSign webhook event types.</summary>
public enum SignEvent
{
${members}
}

/// <summary>Label per sign event.</summary>
public static class SignEventLabels
{
    private static readonly IReadOnlyDictionary<SignEvent, string> MAP = new ReadOnlyDictionary<SignEvent, string>(new Dictionary<SignEvent, string>
    {
${labels}
    });

    /// <summary>Get the label for an event.</summary>
    public static string Get(SignEvent e) => MAP.TryGetValue(e, out var v) ? v : string.Empty;
}
`;
  writeFile('SignEvents.cs', content);
}

function genErrors() {
  const protoPath = join(PLATFORM_REPO, 'shared', 'schemas', 'api', 'isa', 'v1', 'common.proto');
  const text = tryReadText(protoPath);
  const sources = ['isa-platform/shared/schemas/api/isa/v1/common.proto'];

  const codes = [];
  if (text) {
    const block = text.match(/enum ErrorCode \{([\s\S]*?)\}/m);
    if (block) {
      const lines = block[1].split('\n');
      let pendingComment = '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('//')) {
          pendingComment += ' ' + trimmed.replace(/^\/\/\s?/, '');
          continue;
        }
        const m = trimmed.match(/^ERROR_CODE_([A-Z0-9_]+)\s*=\s*\d+;/);
        if (m) {
          const symbol = m[1];
          if (symbol === 'UNSPECIFIED') { pendingComment = ''; continue; }
          const wire = symbol.toLowerCase();
          const enumName = symbol.split('_').map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join('');
          codes.push({ enumName, wire, doc: pendingComment.trim() });
          pendingComment = '';
        } else if (trimmed === '') {
          pendingComment = '';
        }
      }
    }
  }
  if (codes.length === 0) gaps.push('ErrorCode: failed to parse common.proto ErrorCode enum.');
  codes.sort((a, b) => a.wire.localeCompare(b.wire));

  const ADVICE = new Map([
    ['validation_error', 'fix_request_body'],
    ['idempotency_conflict', 'retry_with_new_key'],
    ['rate_limit_exceeded', 'wait_and_retry'],
    ['token_expired', 'refresh_session'],
    ['invalid_token', 'reissue_session'],
    ['license_locked', 'contact_support'],
    ['forbidden', 'check_scopes'],
    ['not_found', 'verify_resource_id'],
    ['method_not_allowed', 'check_http_method'],
    ['conflict', 'reconcile_state'],
    ['unauthorized', 'authenticate_caller'],
    ['internal_error', 'retry_or_contact_support'],
    ['bad_gateway', 'retry_with_backoff'],
    ['gateway_timeout', 'retry_with_backoff'],
    ['service_unavailable', 'retry_with_backoff'],
    ['not_implemented', 'check_feature_availability'],
  ]);

  const members = codes.map((c) =>
    `    /// <summary>${(c.doc || c.wire).replace(/</g,'&lt;').replace(/>/g,'&gt;')}</summary>\n    [WireValue("${c.wire}")] ${c.enumName},`
  ).join('\n');
  const adviceLines = codes.map((c) => `        [CatalogErrorCode.${c.enumName}] = "${ADVICE.get(c.wire) || 'see_docs'}",`).join('\n');
  const docLines = codes.map((c) => `        [CatalogErrorCode.${c.enumName}] = "https://docs.isaapi.com/errors/${c.wire}",`).join('\n');

  const content = `${HEADER(sources)}using System.Collections.Generic;
using System.Collections.ObjectModel;

namespace Sah.Sdk.Catalog;

/// <summary>Stable wire-form error codes mirroring <c>api.isa.v1.ErrorCode</c>.
/// Named <c>CatalogErrorCode</c> to avoid clashing with the legacy
/// <see cref="Sah.Sdk.Core.ErrorCode"/> already shipped at v0.3.x.</summary>
public enum CatalogErrorCode
{
${members}
}

/// <summary>Machine-readable next-action identifiers per wire-form error code.</summary>
public static class ErrorAdviceCodes
{
    private static readonly IReadOnlyDictionary<CatalogErrorCode, string> MAP = new ReadOnlyDictionary<CatalogErrorCode, string>(new Dictionary<CatalogErrorCode, string>
    {
${adviceLines}
    });

    /// <summary>Get the advice identifier for an error code.</summary>
    public static string Get(CatalogErrorCode code) => MAP.TryGetValue(code, out var v) ? v : "see_docs";
}

/// <summary>Doc URL per error code.</summary>
public static class ErrorDocUrls
{
    private static readonly IReadOnlyDictionary<CatalogErrorCode, string> MAP = new ReadOnlyDictionary<CatalogErrorCode, string>(new Dictionary<CatalogErrorCode, string>
    {
${docLines}
    });

    /// <summary>Get the documentation URL for an error code.</summary>
    public static string Get(CatalogErrorCode code) => MAP.TryGetValue(code, out var v) ? v : "https://docs.isaapi.com/errors";
}
`;
  writeFile('Errors.cs', content);
}

ensureDir(CATALOG_DIR);
genStates();
genProducts();
genConditionsAndMedicationUses();
genScopes();
genSignEvents();
genErrors();

if (gaps.length > 0) {
  process.stderr.write('\ngen-catalog (cs): data-source gaps:\n');
  for (const g of gaps) process.stderr.write(`  - ${g}\n`);
}
process.stderr.write('\ngen-catalog (cs): done\n');
