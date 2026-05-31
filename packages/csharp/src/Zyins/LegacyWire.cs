// Legacy flat-body wire shape still accepted by the live engine.
namespace Isa.Sdk.Zyins;

/// <summary>Builds legacy engine request bodies when ZYINS_LEGACY_WIRE=1.</summary>
internal static class LegacyWire
{
    private const int DefaultFaceAmount = 25_000;

    public static bool Enabled =>
        string.Equals(Environment.GetEnvironmentVariable("ZYINS_LEGACY_WIRE"), "1", StringComparison.Ordinal);

    public static Dictionary<string, object?> PrequalifyBodyFromApplicant(Applicant applicant, int faceValue)
    {
        var body = EngineBodyFromApplicant(applicant);
        body["quote_options"] = new Dictionary<string, object?>
        {
            ["quote_type"] = "face_amounts",
            ["amounts"] = new[] { faceValue.ToString() },
        };
        return body;
    }

    public static Dictionary<string, object?> QuoteBodyFromApplicant(Applicant applicant, int faceValue)
    {
        var body = EngineBodyFromApplicant(applicant);
        body["quote_options"] = new Dictionary<string, object?>
        {
            ["face_amounts"] = new[] { faceValue },
            ["pricing_modes"] = new[] { "MONTHLY-EFT" },
        };
        return body;
    }

    private static Dictionary<string, object?> EngineBodyFromApplicant(Applicant applicant)
    {
        var body = new Dictionary<string, object?>
        {
            ["date_of_birth"] = applicant.Dob,
            ["gender"] = applicant.Sex == Sex.Female ? "female" : "male",
            ["state"] = applicant.State,
            ["height"] = applicant.HeightInches,
            ["weight"] = applicant.WeightPounds,
            ["nicotine_usage"] = new Dictionary<string, object?>
            {
                ["is_nicotine_user"] = IsCurrentNicotineUser(applicant),
            },
        };
        if (applicant.Conditions.Count > 0)
        {
            body["conditions"] = applicant.Conditions
                .Select(c => new Dictionary<string, object?>
                {
                    ["name"] = c.Name,
                    ["was_diagnosed"] = c.WasDiagnosed,
                    ["last_treatment"] = c.LastTreatment,
                })
                .ToList();
        }
        if (applicant.Medications.Count > 0)
        {
            body["medications"] = applicant.Medications
                .Select(m => new Dictionary<string, object?>
                {
                    ["name"] = m.Name,
                    ["use"] = m.Use,
                    ["first_fill"] = m.FirstFill,
                    ["last_fill"] = m.LastFill,
                })
                .ToList();
        }
        return body;
    }

    public static int FaceAmountFromCoverage(Coverage coverage) =>
        coverage.MonthlyBudget is null && coverage.FaceValue is > 0
            ? coverage.FaceValue.Value
            : DefaultFaceAmount;

    private static bool IsCurrentNicotineUser(Applicant applicant)
    {
        if (applicant.NicotineUse is { } input)
            return input.LastUsed == NicotineDuration.Within12Months;
#pragma warning disable CS0618
        return applicant.NicotineUseLegacy == NicotineUsage.Current;
#pragma warning restore CS0618
    }
}
