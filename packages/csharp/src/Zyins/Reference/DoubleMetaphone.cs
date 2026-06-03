// `Isa.Sdk.Zyins.Reference.DoubleMetaphone` — Lawrence Philips' Double
// Metaphone phonetic encoder, ported branch-for-branch from the SDK's
// TypeScript reference (`packages/ts/src/zyins/reference/_doubleMetaphone.ts`),
// which itself mirrors the Apache Commons Codec implementation.
//
// Returns a primary + alternate phonetic code pair. Two strings that sound
// alike share a code (`sertaline` and `sertraline` both encode `SRTRLN`;
// `tylonol` and `tylenol` both `TLNL`), which lets the fuzzy matcher recover
// misspellings that edit distance alone misses.
//
// This file is a cross-language contract surface: it MUST reproduce the
// codes pinned in `doubleMetaphone.vectors.ts` for every fixture term. The
// vector parity test (`DoubleMetaphoneVectorTests`) enforces that contract.
//
// Determinism notes:
//   - Input is upper-cased with `ToUpperInvariant` before encoding.
//   - Only ASCII A–Z is processed; any other character is dropped, so the
//     caller is responsible for NFC-normalizing before calling.

using System.Text;

namespace Isa.Sdk.Zyins.Reference;

/// <summary>Phonetic code pair. <c>Primary</c> equals <c>Alternate</c> when
/// the word has no alternate reading.</summary>
internal readonly struct DoubleMetaphoneCode
{
    public DoubleMetaphoneCode(string primary, string alternate)
    {
        Primary = primary;
        Alternate = alternate;
    }

    public string Primary { get; }
    public string Alternate { get; }
}

/// <summary>Double Metaphone encoder. Branch-for-branch port of the TS
/// reference; the branch structure is the canonical contract.</summary>
internal static class DoubleMetaphone
{
    // Classic Double Metaphone truncates to 4, which is too lossy for the
    // long compound terms in the medical catalog. A 6-symbol code keeps
    // near-homophone drug names colliding while staying short enough to pool
    // genuine homophones. This is the value the cross-language vector fixture
    // pins; the ports MUST use the same length.
    private const int DefaultMaxCodeLen = 6;
    private const string Vowels = "AEIOUY";
    private const string LRNMBHFVWSpace = " BHFVW";
    private const string LTKSNMBZ = "LTKSNMBZ";

    private static readonly string[] SilentStart = { "GN", "KN", "PN", "WR", "PS" };
    private static readonly string[] EsEpEtc =
    {
        "ES", "EP", "EB", "EL", "EY", "IB", "IL", "IN", "IE", "EI", "ER",
    };

    /// <summary>Encode <paramref name="input"/> into its Double Metaphone
    /// primary + alternate codes. Non-letters are dropped before encoding;
    /// an empty or letter-free input yields empty codes.</summary>
    public static DoubleMetaphoneCode Encode(string input, int maxLength = DefaultMaxCodeLen)
    {
        var cleaned = Clean(input);
        if (cleaned.Length == 0) return new DoubleMetaphoneCode(string.Empty, string.Empty);

        var word = new Word(cleaned);
        var code = new CodeBuilder(maxLength);
        var index = SkipSilentStart(word);
        if (word.At(0) == 'X')
        {
            code.Append("S");
            index = 1;
        }

        while (index < word.Length && !code.Done())
        {
            index = Step(word, code, index);
        }
        return code.Build();
    }

    // Uppercase first so locale-specific casefolding does not change which
    // bytes survive the alphabetic strip; then keep only ASCII A–Z.
    private static string Clean(string input)
    {
        var upper = input.ToUpperInvariant();
        var buf = new StringBuilder(upper.Length);
        foreach (var ch in upper)
        {
            if (ch >= 'A' && ch <= 'Z') buf.Append(ch);
        }
        return buf.ToString();
    }

    /// <summary>Skip the silent leading clusters (GN, KN, PN, WR, PS).</summary>
    private static int SkipSilentStart(Word word)
    {
        var head = word.Slice(0, 2);
        foreach (var cluster in SilentStart)
        {
            if (cluster == head) return 1;
        }
        return 0;
    }

    private static int Step(Word word, CodeBuilder code, int index)
    {
        var ch = word.At(index);
        switch (ch)
        {
            case 'A':
            case 'E':
            case 'I':
            case 'O':
            case 'U':
            case 'Y':
                if (index == 0) code.Append("A");
                return index + 1;
            case 'B':
                code.Append("P");
                return word.At(index + 1) == 'B' ? index + 2 : index + 1;
            case 'C':
                return StepC(word, code, index);
            case 'Ç':
                code.Append("S");
                return index + 1;
            case 'D':
                return StepD(word, code, index);
            case 'F':
                code.Append("F");
                return word.At(index + 1) == 'F' ? index + 2 : index + 1;
            case 'G':
                return StepG(word, code, index);
            case 'H':
                return StepH(word, code, index);
            case 'J':
                return StepJ(word, code, index);
            case 'K':
                code.Append("K");
                return word.At(index + 1) == 'K' ? index + 2 : index + 1;
            case 'L':
                return StepL(word, code, index);
            case 'M':
                code.Append("M");
                return IsMSilentDoubled(word, index) ? index + 2 : index + 1;
            case 'N':
                code.Append("N");
                return word.At(index + 1) == 'N' ? index + 2 : index + 1;
            case 'Ñ':
                code.Append("N");
                return index + 1;
            case 'P':
                return StepP(word, code, index);
            case 'Q':
                code.Append("K");
                return word.At(index + 1) == 'Q' ? index + 2 : index + 1;
            case 'R':
                return StepR(word, code, index);
            case 'S':
                return StepS(word, code, index);
            case 'T':
                return StepT(word, code, index);
            case 'V':
                code.Append("F");
                return word.At(index + 1) == 'V' ? index + 2 : index + 1;
            case 'W':
                return StepW(word, code, index);
            case 'X':
                return StepX(word, code, index);
            case 'Z':
                return StepZ(word, code, index);
            default:
                return index + 1;
        }
    }

    private static int StepC(Word word, CodeBuilder code, int index)
    {
        if (ConditionC0(word, index))
        {
            code.Append("K");
            return index + 2;
        }
        if (index == 0 && word.Contains(index, 6, "CAESAR"))
        {
            code.Append("S");
            return index + 2;
        }
        if (word.Contains(index, 2, "CH"))
        {
            return StepCH(word, code, index);
        }
        if (word.Contains(index, 2, "CZ") && !word.Contains(index - 2, 4, "WICZ"))
        {
            code.Append("S", "X");
            return index + 2;
        }
        if (word.Contains(index + 1, 3, "CIA"))
        {
            code.Append("X");
            return index + 3;
        }
        if (word.Contains(index, 2, "CC") && !(index == 1 && word.At(0) == 'M'))
        {
            return StepCC(word, code, index);
        }
        if (word.Contains(index, 2, "CK", "CG", "CQ"))
        {
            code.Append("K");
            return index + 2;
        }
        if (word.Contains(index, 2, "CI", "CE", "CY"))
        {
            if (word.Contains(index, 3, "CIO", "CIE", "CIA")) code.Append("S", "X");
            else code.Append("S");
            return index + 2;
        }
        code.Append("K");
        if (word.Contains(index + 1, 2, " C", " Q", " G")) return index + 3;
        if (word.Contains(index + 1, 1, "C", "K", "Q") && !word.Contains(index + 1, 2, "CE", "CI"))
        {
            return index + 2;
        }
        return index + 1;
    }

    private static bool ConditionC0(Word word, int index)
    {
        if (word.Contains(index, 4, "CHIA")) return true;
        if (index <= 1) return false;
        if (word.IsVowel(index - 2)) return false;
        if (!word.Contains(index - 1, 3, "ACH")) return false;
        var c = word.At(index + 2);
        return (c != 'I' && c != 'E') || word.Contains(index - 2, 6, "BACHER", "MACHER");
    }

    private static int StepCC(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index + 2, 1, "I", "E", "H") && !word.Contains(index + 2, 2, "HU"))
        {
            if ((index == 1 && word.At(index - 1) == 'A') ||
                word.Contains(index - 1, 5, "UCCEE", "UCCES"))
            {
                code.Append("KS");
            }
            else
            {
                code.Append("X");
            }
            return index + 3;
        }
        code.Append("K");
        return index + 2;
    }

    private static int StepCH(Word word, CodeBuilder code, int index)
    {
        if (index > 0 && word.Contains(index, 4, "CHAE"))
        {
            code.Append("K", "X");
            return index + 2;
        }
        if (ConditionCH0(word, index) || ConditionCH1(word, index))
        {
            code.Append("K");
            return index + 2;
        }
        if (index > 0)
        {
            code.Append(word.Contains(0, 2, "MC") ? "K" : "X", "K");
        }
        else
        {
            code.Append("X");
        }
        return index + 2;
    }

    private static bool ConditionCH0(Word word, int index)
    {
        if (index != 0) return false;
        if (!word.Contains(index + 1, 5, "HARAC", "HARIS") &&
            !word.Contains(index + 1, 3, "HOR", "HYM", "HIA", "HEM"))
        {
            return false;
        }
        return !word.Contains(0, 5, "CHORE");
    }

    private static bool ConditionCH1(Word word, int index)
    {
        return word.Contains(0, 4, "VAN ", "VON ") ||
            word.Contains(0, 3, "SCH") ||
            word.Contains(index - 2, 6, "ORCHES", "ARCHIT", "ORCHID") ||
            word.Contains(index + 2, 1, "T", "S") ||
            ((word.Contains(index - 1, 1, "A", "O", "U", "E") || index == 0) &&
                (word.ContainsAnyChar(index + 2, LRNMBHFVWSpace) ||
                    index + 1 == word.Length - 1));
    }

    private static int StepD(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index, 2, "DG"))
        {
            if (word.Contains(index + 2, 1, "I", "E", "Y"))
            {
                code.Append("J");
                return index + 3;
            }
            code.Append("TK");
            return index + 2;
        }
        code.Append("T");
        return word.Contains(index, 2, "DT", "DD") ? index + 2 : index + 1;
    }

    private static int StepG(Word word, CodeBuilder code, int index)
    {
        if (word.At(index + 1) == 'H') return StepGH(word, code, index);
        if (word.At(index + 1) == 'N') return StepGN(word, code, index);
        if (word.Contains(index + 1, 2, "LI") && !word.IsSlavoGermanic())
        {
            code.Append("KL", "L");
            return index + 2;
        }
        if (index == 0 &&
            (word.At(index + 1) == 'Y' || word.ContainsAny(index + 1, 2, EsEpEtc)))
        {
            code.Append("K", "J");
            return index + 2;
        }
        if ((word.Contains(index + 1, 2, "ER") || word.At(index + 1) == 'Y') &&
            !word.Contains(0, 6, "DANGER", "RANGER", "MANGER") &&
            !word.Contains(index - 1, 1, "E", "I") &&
            !word.Contains(index - 1, 3, "RGY", "OGY"))
        {
            code.Append("K", "J");
            return index + 2;
        }
        if (word.Contains(index + 1, 1, "E", "I", "Y") ||
            word.Contains(index - 1, 4, "AGGI", "OGGI"))
        {
            if (word.Contains(0, 4, "VAN ", "VON ") ||
                word.Contains(0, 3, "SCH") ||
                word.Contains(index + 1, 2, "ET"))
            {
                code.Append("K");
            }
            else if (word.Contains(index + 1, 3, "IER"))
            {
                code.Append("J");
            }
            else
            {
                code.Append("J", "K");
            }
            return index + 2;
        }
        code.Append("K");
        return word.At(index + 1) == 'G' ? index + 2 : index + 1;
    }

    private static int StepGH(Word word, CodeBuilder code, int index)
    {
        if (index > 0 && !word.IsVowel(index - 1))
        {
            code.Append("K");
            return index + 2;
        }
        if (index == 0)
        {
            code.Append(word.At(index + 2) == 'I' ? "J" : "K");
            return index + 2;
        }
        if ((index > 1 && word.Contains(index - 2, 1, "B", "H", "D")) ||
            (index > 2 && word.Contains(index - 3, 1, "B", "H", "D")) ||
            (index > 3 && word.Contains(index - 4, 1, "B", "H")))
        {
            return index + 2;
        }
        if (index > 2 && word.At(index - 1) == 'U' &&
            word.Contains(index - 3, 1, "C", "G", "L", "R", "T"))
        {
            code.Append("F");
        }
        else if (index > 0 && word.At(index - 1) != 'I')
        {
            code.Append("K");
        }
        return index + 2;
    }

    private static int StepGN(Word word, CodeBuilder code, int index)
    {
        if (index == 1 && word.IsVowel(0) && !word.IsSlavoGermanic())
        {
            code.Append("KN", "N");
        }
        else if (!word.Contains(index + 2, 2, "EY") && word.At(index + 1) != 'Y' &&
            !word.IsSlavoGermanic())
        {
            code.Append("N", "KN");
        }
        else
        {
            code.Append("KN");
        }
        return index + 2;
    }

    private static int StepH(Word word, CodeBuilder code, int index)
    {
        if ((index == 0 || word.IsVowel(index - 1)) && word.IsVowel(index + 1))
        {
            code.Append("H");
            return index + 2;
        }
        return index + 1;
    }

    private static int StepJ(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index, 4, "JOSE") || word.Contains(0, 4, "SAN "))
        {
            if ((index == 0 && word.At(index + 4) == ' ') || word.Contains(0, 4, "SAN "))
            {
                code.Append("H");
            }
            else
            {
                code.Append("J", "H");
            }
            return index + 1;
        }
        if (index == 0 && !word.Contains(index, 4, "JOSE"))
        {
            code.Append("J", "A");
        }
        else if (word.IsVowel(index - 1) &&
            !word.IsSlavoGermanic() &&
            (word.At(index + 1) == 'A' || word.At(index + 1) == 'O'))
        {
            code.Append("J", "H");
        }
        else if (index == word.Length - 1)
        {
            code.Append("J", "");
        }
        else if (!word.ContainsAnyChar(index + 1, LTKSNMBZ) &&
            !word.Contains(index - 1, 1, "S", "K", "L"))
        {
            code.Append("J");
        }
        return word.At(index + 1) == 'J' ? index + 2 : index + 1;
    }

    private static int StepL(Word word, CodeBuilder code, int index)
    {
        if (word.At(index + 1) == 'L')
        {
            if (ConditionL0(word, index)) code.Append("L", "");
            else code.Append("L");
            return index + 2;
        }
        code.Append("L");
        return index + 1;
    }

    private static bool ConditionL0(Word word, int index)
    {
        if (index == word.Length - 3 &&
            word.Contains(index - 1, 4, "ILLO", "ILLA", "ALLE"))
        {
            return true;
        }
        return (word.Contains(word.Length - 2, 2, "AS", "OS") ||
                word.Contains(word.Length - 1, 1, "A", "O")) &&
            word.Contains(index - 1, 4, "ALLE");
    }

    private static int StepP(Word word, CodeBuilder code, int index)
    {
        if (word.At(index + 1) == 'H')
        {
            code.Append("F");
            return index + 2;
        }
        code.Append("P");
        return word.Contains(index + 1, 1, "P", "B") ? index + 2 : index + 1;
    }

    private static int StepR(Word word, CodeBuilder code, int index)
    {
        if (index == word.Length - 1 &&
            !word.IsSlavoGermanic() &&
            word.Contains(index - 2, 2, "IE") &&
            !word.Contains(index - 4, 2, "ME", "MA"))
        {
            code.Append("", "R");
        }
        else
        {
            code.Append("R");
        }
        return word.At(index + 1) == 'R' ? index + 2 : index + 1;
    }

    private static int StepS(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index - 1, 3, "ISL", "YSL")) return index + 1;
        if (index == 0 && word.Contains(index, 5, "SUGAR"))
        {
            code.Append("X", "S");
            return index + 1;
        }
        if (word.Contains(index, 2, "SH"))
        {
            code.Append(word.Contains(index + 1, 4, "HEIM", "HOEK", "HOLM", "HOLZ") ? "S" : "X");
            return index + 2;
        }
        if (word.Contains(index, 3, "SIO", "SIA") || word.Contains(index, 4, "SIAN"))
        {
            code.Append("S", word.IsSlavoGermanic() ? "S" : "X");
            return index + 3;
        }
        if ((index == 0 && word.Contains(index + 1, 1, "M", "N", "L", "W")) ||
            word.Contains(index + 1, 1, "Z"))
        {
            code.Append("S", "X");
            return word.At(index + 1) == 'Z' ? index + 2 : index + 1;
        }
        if (word.Contains(index, 2, "SC"))
        {
            return StepSC(word, code, index);
        }
        if (index == word.Length - 1 && word.Contains(index - 2, 2, "AI", "OI"))
        {
            code.Append("", "S");
        }
        else
        {
            code.Append("S");
        }
        return word.Contains(index + 1, 1, "S", "Z") ? index + 2 : index + 1;
    }

    private static int StepSC(Word word, CodeBuilder code, int index)
    {
        if (word.At(index + 2) == 'H')
        {
            if (word.Contains(index + 3, 2, "OO", "ER", "EN", "UY", "ED", "EM"))
            {
                code.Append(word.Contains(index + 3, 2, "ER", "EN") ? "X" : "SK", "SK");
            }
            else if (index == 0 && !word.IsVowel(3) && word.At(3) != 'W')
            {
                code.Append("X", "S");
            }
            else
            {
                code.Append("X");
            }
            return index + 3;
        }
        if (word.Contains(index + 2, 1, "I", "E", "Y"))
        {
            code.Append("S");
            return index + 3;
        }
        code.Append("SK");
        return index + 3;
    }

    private static int StepT(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index, 4, "TION"))
        {
            code.Append("X");
            return index + 3;
        }
        if (word.Contains(index, 3, "TIA", "TCH"))
        {
            code.Append("X");
            return index + 3;
        }
        if (word.Contains(index, 2, "TH") || word.Contains(index, 3, "TTH"))
        {
            if (word.Contains(index + 2, 2, "OM", "AM") ||
                word.Contains(0, 4, "VAN ", "VON ") ||
                word.Contains(0, 3, "SCH"))
            {
                code.Append("T");
            }
            else
            {
                code.Append("0", "T");
            }
            return index + 2;
        }
        code.Append("T");
        return word.Contains(index + 1, 1, "T", "D") ? index + 2 : index + 1;
    }

    private static int StepW(Word word, CodeBuilder code, int index)
    {
        if (word.Contains(index, 2, "WR"))
        {
            code.Append("R");
            return index + 2;
        }
        if (index == 0 && (word.IsVowel(index + 1) || word.Contains(index, 2, "WH")))
        {
            if (word.IsVowel(index + 1)) code.Append("A", "F");
            else code.Append("A");
            return index + 1;
        }
        if ((index == word.Length - 1 && word.IsVowel(index - 1)) ||
            word.Contains(index - 1, 5, "EWSKI", "EWSKY", "OWSKI", "OWSKY") ||
            word.Contains(0, 3, "SCH"))
        {
            code.Append("", "F");
            return index + 1;
        }
        if (word.Contains(index, 4, "WICZ", "WITZ"))
        {
            code.Append("TS", "FX");
            return index + 4;
        }
        return index + 1;
    }

    private static int StepX(Word word, CodeBuilder code, int index)
    {
        if (!(index == word.Length - 1 &&
            (word.Contains(index - 3, 3, "IAU", "EAU") || word.Contains(index - 2, 2, "AU", "OU"))))
        {
            code.Append("KS");
        }
        return word.Contains(index + 1, 1, "C", "X") ? index + 2 : index + 1;
    }

    private static int StepZ(Word word, CodeBuilder code, int index)
    {
        if (word.At(index + 1) == 'H')
        {
            code.Append("J");
            return index + 2;
        }
        if (word.Contains(index + 1, 2, "ZO", "ZI", "ZA") ||
            (word.IsSlavoGermanic() && index > 0 && word.At(index - 1) != 'T'))
        {
            code.Append("S", "TS");
        }
        else
        {
            code.Append("S");
        }
        return word.At(index + 1) == 'Z' ? index + 2 : index + 1;
    }

    private static bool IsMSilentDoubled(Word word, int index)
    {
        return (word.Contains(index - 1, 3, "UMB") &&
                (index + 1 == word.Length - 1 || word.Contains(index + 2, 2, "ER"))) ||
            word.At(index + 1) == 'M';
    }

    /// <summary>Mutable accumulator for the primary + alternate codes.
    /// Encapsulates the "append the same to both / append divergent to each"
    /// pattern so the step functions stay declarative.</summary>
    private sealed class CodeBuilder
    {
        private readonly StringBuilder _primary = new();
        private readonly StringBuilder _alternate = new();
        private readonly int _maxLength;

        public CodeBuilder(int maxLength)
        {
            _maxLength = maxLength;
        }

        // Append `primary` to the primary code and `alternate` to the
        // alternate. A null alternate appends the same symbol to both —
        // mirrors the TS optional second argument.
        public void Append(string primary, string? alternate = null)
        {
            _primary.Append(primary);
            _alternate.Append(alternate ?? primary);
        }

        public bool Done() => _primary.Length >= _maxLength && _alternate.Length >= _maxLength;

        public DoubleMetaphoneCode Build() => new(
            Truncate(_primary, _maxLength),
            Truncate(_alternate, _maxLength));

        private static string Truncate(StringBuilder buf, int maxLength) =>
            buf.Length <= maxLength ? buf.ToString() : buf.ToString(0, maxLength);
    }

    /// <summary>Cursor over the upper-cased input with bounds-safe
    /// slice/char helpers mirroring the TS <c>Word</c> class.</summary>
    private readonly struct Word
    {
        private readonly string _value;

        public Word(string value)
        {
            _value = value;
        }

        public int Length => _value.Length;

        // Returns '\0' for out-of-range — the empty-string sentinel the TS
        // `at()` returns can never equal a real letter, so '\0' is the
        // faithful analogue for char comparisons.
        public char At(int index)
        {
            if (index < 0 || index >= _value.Length) return '\0';
            return _value[index];
        }

        public string Slice(int start, int end)
        {
            var lo = start < 0 ? 0 : start;
            var hi = end > _value.Length ? _value.Length : end;
            if (hi <= lo) return string.Empty;
            return _value.Substring(lo, hi - lo);
        }

        public bool IsVowel(int index)
        {
            var ch = At(index);
            return ch != '\0' && Vowels.IndexOf(ch) >= 0;
        }

        // Slavo-Germanic when the word contains W, K, "CZ", or "WITZ" — the
        // regex `/[WK]|CZ|WITZ/` from the TS reference.
        public bool IsSlavoGermanic() =>
            _value.IndexOf('W') >= 0 ||
            _value.IndexOf('K') >= 0 ||
            _value.IndexOf("CZ", System.StringComparison.Ordinal) >= 0 ||
            _value.IndexOf("WITZ", System.StringComparison.Ordinal) >= 0;

        // True when the `length`-char slice at `start` equals any candidate.
        public bool Contains(int start, int length, params string[] candidates)
        {
            var target = Slice(start, start + length);
            foreach (var candidate in candidates)
            {
                if (target == candidate) return true;
            }
            return false;
        }

        // True when the 2-char slice at `start` equals any candidate. Splits
        // out the array overload so the G-soft-start cluster table can be a
        // shared static array rather than spread varargs.
        public bool ContainsAny(int start, int length, string[] candidates)
        {
            var target = Slice(start, start + length);
            foreach (var candidate in candidates)
            {
                if (target == candidate) return true;
            }
            return false;
        }

        // True when the single char at `start` is any character of `chars`.
        // Mirrors the TS `contains(i, 1, ...someString.split(''))`.
        public bool ContainsAnyChar(int start, string chars)
        {
            var ch = At(start);
            return ch != '\0' && chars.IndexOf(ch) >= 0;
        }
    }
}
