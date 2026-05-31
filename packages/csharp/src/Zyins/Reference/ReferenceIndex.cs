// <c>Isa.Sdk.Zyins.Reference.ReferenceIndex</c> — read-only id-keyed
// view over an inline-row <see cref="DatasetBundleV3"/>. Built once per
// bundle instance and cached so repeated <c>Match()</c> calls on the
// same bundle do not re-pay the indexing cost.
//
// Cache keys on the bundle instance via
// <see cref="System.Runtime.CompilerServices.ConditionalWeakTable{TKey,TValue}"/>
// — when the consumer's bundle reference goes away the index is
// collected alongside it. A fresh <c>GET /v3/datasets</c> returns a new
// instance and triggers a rebuild (implicit dataset-version
// invalidation).
//
// Inline-row cutover (rc.1 → 1.0): previous revisions consumed
// <c>medications_by_condition</c> + <c>frequency_graphs.use_map</c>
// off the bundle root. Those are gone — every relation lives on the
// row. This index walks <see cref="ConditionRow.TreatedWith"/> and
// <see cref="MedicationRow.UsedFor"/> exactly once and projects the
// id→name + reverse-index + per-(cond,med) frequency views the
// matchers need.
using System;
using System.Collections.Generic;
using System.Runtime.CompilerServices;

namespace Isa.Sdk.Zyins.Reference;

internal sealed class ReferenceIndex
{
    private static readonly ConditionalWeakTable<DatasetBundleV3, ReferenceIndex> Cache = new();

    private readonly Dictionary<string, string> _conditionNames;
    private readonly Dictionary<string, string> _medicationNames;
    private readonly Dictionary<string, IReadOnlyList<string>> _medsByCondition;
    private readonly Dictionary<string, IReadOnlyList<string>> _condsByMedication;
    private readonly Dictionary<string, Dictionary<string, int>> _useMap;

    private ReferenceIndex(
        Dictionary<string, string> conditionNames,
        Dictionary<string, string> medicationNames,
        Dictionary<string, IReadOnlyList<string>> medsByCondition,
        Dictionary<string, IReadOnlyList<string>> condsByMedication,
        Dictionary<string, Dictionary<string, int>> useMap)
    {
        _conditionNames = conditionNames;
        _medicationNames = medicationNames;
        _medsByCondition = medsByCondition;
        _condsByMedication = condsByMedication;
        _useMap = useMap;
    }

    /// <summary>Return the cached index for <paramref name="bundle"/>;
    /// build one on first call. Bundle equality is by reference.</summary>
    public static ReferenceIndex ForBundle(DatasetBundleV3 bundle)
    {
        if (bundle is null) throw new ArgumentNullException(nameof(bundle));
        if (Cache.TryGetValue(bundle, out var cached)) return cached;
        var fresh = Build(bundle);
        return Cache.GetValue(bundle, _ => fresh);
    }

    private static ReferenceIndex Build(DatasetBundleV3 bundle)
    {
        var conditionNames = new Dictionary<string, string>(StringComparer.Ordinal);
        var medsByCondition = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        var useMap = new Dictionary<string, Dictionary<string, int>>(StringComparer.Ordinal);

        foreach (var cond in bundle.Conditions.Items)
        {
            conditionNames[cond.Id] = cond.Name;
            var medIds = new List<string>(cond.TreatedWith.Count);
            var freqRow = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (var rel in cond.TreatedWith)
            {
                medIds.Add(rel.Id);
                freqRow[rel.Id] = rel.PrescriptionCount;
            }
            medsByCondition[cond.Id] = medIds;
            useMap[cond.Id] = freqRow;
        }

        var medicationNames = new Dictionary<string, string>(StringComparer.Ordinal);
        var condsByMedication = new Dictionary<string, IReadOnlyList<string>>(StringComparer.Ordinal);
        foreach (var med in bundle.Medications.Items)
        {
            medicationNames[med.Id] = med.Name;
            var condIds = new List<string>(med.UsedFor.Count);
            foreach (var rel in med.UsedFor)
            {
                condIds.Add(rel.Id);
                // Mirror the forward observation if the condition row didn't
                // already publish it — preserves symmetry when the server
                // produces the two sides from a single underlying count.
                if (!useMap.TryGetValue(rel.Id, out var row))
                {
                    row = new Dictionary<string, int>(StringComparer.Ordinal);
                    useMap[rel.Id] = row;
                }
                if (!row.ContainsKey(med.Id)) row[med.Id] = rel.PrescriptionCount;
            }
            condsByMedication[med.Id] = condIds;
        }
        return new ReferenceIndex(conditionNames, medicationNames, medsByCondition, condsByMedication, useMap);
    }

    public string? ConditionName(string id) =>
        _conditionNames.TryGetValue(id, out var n) ? n : null;

    public string? MedicationName(string id) =>
        _medicationNames.TryGetValue(id, out var n) ? n : null;

    public bool HasCondition(string id) => _conditionNames.ContainsKey(id);

    public bool HasMedication(string id) => _medicationNames.ContainsKey(id);

    public IReadOnlyList<string> MedicationsForCondition(string conditionId) =>
        _medsByCondition.TryGetValue(conditionId, out var list) ? list : Array.Empty<string>();

    public IReadOnlyList<string> ConditionsForMedication(string medicationId) =>
        _condsByMedication.TryGetValue(medicationId, out var list) ? list : Array.Empty<string>();

    public int ConditionFrequencyForMedication(string medicationId, string conditionId)
    {
        if (!_useMap.TryGetValue(conditionId, out var row)) return 0;
        return row.TryGetValue(medicationId, out var freq) ? freq : 0;
    }

    public IEnumerable<KeyValuePair<string, string>> AllConditions() => _conditionNames;
    public IEnumerable<KeyValuePair<string, string>> AllMedications() => _medicationNames;
}
