<?php

declare(strict_types=1);

namespace Isa\Sdk\Tests\Zyins\Reference;

/**
 * Double Metaphone cross-language vector fixture — a verbatim PHP mirror of
 * the canonical TS source `packages/ts/src/zyins/reference/
 * doubleMetaphone.vectors.ts`.
 *
 * Each entry pins the primary + alternate code (6-symbol length) for a
 * medical / drug term. The PHP encoder ({@see
 * \Isa\Sdk\Zyins\Reference\Internal\DoubleMetaphone}) MUST reproduce every
 * entry identically; {@see FuzzyMatchVectorParityTest} asserts this. The
 * Go / TS / C# / Python ports validate against the same data, so any
 * divergence is a port bug, not a fixture update.
 *
 * Phonetically load-bearing cases:
 *   - `tylenol` and `tylonol` both encode `TLNL` (vowel swap, identical
 *     consonant skeleton) — the canonical phonetic-recall win.
 *   - `sertraline` and `sertralin` both encode `SRTRLN`.
 *   - `sertaline` encodes `SRTLN`, which DIFFERS from `sertraline`: the
 *     dropped `r` is a real consonant loss, recovered by the Damerau tier,
 *     not the phonetic tier.
 */
final class DoubleMetaphoneVectors
{
    /**
     * @return list<array{0: string, 1: string, 2: string}>
     *     Each tuple is [term, primary, alternate].
     */
    public static function all(): array
    {
        return [
            ['sertraline', 'SRTRLN', 'SRTRLN'],
            ['sertralin', 'SRTRLN', 'SRTRLN'],
            ['sertaline', 'SRTLN', 'SRTLN'],
            ['tylenol', 'TLNL', 'TLNL'],
            ['tylonol', 'TLNL', 'TLNL'],
            ['crohns', 'KRNS', 'KRNS'],
            ['chrons', 'XRNS', 'XRNS'],
            ['lisinopril', 'LSNPRL', 'LSNPRL'],
            ['metformin', 'MTFRMN', 'MTFRMN'],
            ['atorvastatin', 'ATRFST', 'ATRFST'],
            ['levothyroxine', 'LF0RKS', 'LFTRKS'],
            ['hydrochlorothiazide', 'HTRXLR', 'HTRKLR'],
            ['amlodipine', 'AMLTPN', 'AMLTPN'],
            ['omeprazole', 'AMPRSL', 'AMPRSL'],
            ['gabapentin', 'KPPNTN', 'KPPNTN'],
            ['losartan', 'LSRTN', 'LSRTN'],
            ['albuterol', 'ALPTRL', 'ALPTRL'],
            ['simvastatin', 'SMFSTT', 'SMFSTT'],
            ['montelukast', 'MNTLKS', 'MNTLKS'],
            ['furosemide', 'FRSMT', 'FRSMT'],
            ['prednisone', 'PRTNSN', 'PRTNSN'],
            ['citalopram', 'STLPRM', 'STLPRM'],
            ['tramadol', 'TRMTL', 'TRMTL'],
            ['trazodone', 'TRSTN', 'TRSTN'],
            ['escitalopram', 'ASTLPR', 'ASTLPR'],
            ['pantoprazole', 'PNTPRS', 'PNTPRS'],
            ['meloxicam', 'MLKSKM', 'MLKSKM'],
            ['rosuvastatin', 'RSFSTT', 'RSFSTT'],
            ['bupropion', 'PPRPN', 'PPRPN'],
            ['clopidogrel', 'KLPTKR', 'KLPTKR'],
            ['duloxetine', 'TLKSTN', 'TLKSTN'],
            ['venlafaxine', 'FNLFKS', 'FNLFKS'],
            ['carvedilol', 'KRFTLL', 'KRFTLL'],
            ['warfarin', 'ARFRN', 'FRFRN'],
            ['insulin', 'ANSLN', 'ANSLN'],
            ['aspirin', 'ASPRN', 'ASPRN'],
            ['ibuprofen', 'APPRFN', 'APPRFN'],
            ['acetaminophen', 'ASTMNF', 'ASTMNF'],
            ['amoxicillin', 'AMKSSL', 'AMKSSL'],
            ['azithromycin', 'AS0RMS', 'ASTRMS'],
            ['ciprofloxacin', 'SPRFLK', 'SPRFLK'],
            ['doxycycline', 'TKSSKL', 'TKSSKL'],
            ['fluoxetine', 'FLKSTN', 'FLKSTN'],
            ['hypertension', 'HPRTNS', 'HPRTNX'],
            ['diabetes', 'TPTS', 'TPTS'],
            ['asthma', 'AS0M', 'ASTM'],
            ['cholesterol', 'XLSTRL', 'XLSTRL'],
            ['arthritis', 'AR0RTS', 'ARTRTS'],
            ['depression', 'TPRSN', 'TPRSN'],
            ['anxiety', 'ANKST', 'ANKST'],
            ['migraine', 'MKRN', 'MKRN'],
            ['pneumonia', 'NMN', 'NMN'],
            ['bronchitis', 'PRNXTS', 'PRNKTS'],
            ['copd', 'KPT', 'KPT'],
            ['gerd', 'KRT', 'JRT'],
            ['glaucoma', 'KLKM', 'KLKM'],
            ['osteoporosis', 'ASTPRS', 'ASTPRS'],
            ['hypothyroidism', 'HP0RTS', 'HPTRTS'],
            ['psoriasis', 'SRSS', 'SRSS'],
            ['eczema', 'ASM', 'AXM'],
            ['dermatitis', 'TRMTTS', 'TRMTTS'],
            ['xanax', 'SNKS', 'SNKS'],
            ['prozac', 'PRSK', 'PRSK'],
            ['zoloft', 'SLFT', 'SLFT'],
            ['lipitor', 'LPTR', 'LPTR'],
            ['synthroid', 'SN0RT', 'SNTRT'],
            ['nexium', 'NKSM', 'NKSM'],
            ['plavix', 'PLFKS', 'PLFKS'],
            ['crestor', 'KRSTR', 'KRSTR'],
            ['ventolin', 'FNTLN', 'FNTLN'],
            ['singulair', 'SNKLR', 'SNKLR'],
            ['phenobarbital', 'FNPRPT', 'FNPRPT'],
            ['levofloxacin', 'LFFLKS', 'LFFLKS'],
            ['metronidazole', 'MTRNTS', 'MTRNTS'],
            ['cephalexin', 'SFLKSN', 'SFLKSN'],
            ['prednisolone', 'PRTNSL', 'PRTNSL'],
            ['naproxen', 'NPRKSN', 'NPRKSN'],
            ['cyclobenzaprine', 'SKLPNS', 'SKLPNS'],
            ['hydrocodone', 'HTRKTN', 'HTRKTN'],
            ['oxycodone', 'AKSKTN', 'AKSKTN'],
            ['morphine', 'MRFN', 'MRFN'],
            ['fentanyl', 'FNTNL', 'FNTNL'],
            ['lorazepam', 'LRSPM', 'LRSPM'],
            ['clonazepam', 'KLNSPM', 'KLNSPM'],
            ['diazepam', 'TSPM', 'TSPM'],
            ['alprazolam', 'ALPRSL', 'ALPRSL'],
            ['quetiapine', 'KXPN', 'KXPN'],
            ['risperidone', 'RSPRTN', 'RSPRTN'],
            ['aripiprazole', 'ARPPRS', 'ARPPRS'],
            ['lamotrigine', 'LMTRJN', 'LMTRKN'],
            ['topiramate', 'TPRMT', 'TPRMT'],
            ['pregabalin', 'PRKPLN', 'PRKPLN'],
            ['spironolactone', 'SPRNLK', 'SPRNLK'],
            ['enalapril', 'ANLPRL', 'ANLPRL'],
            ['ramipril', 'RMPRL', 'RMPRL'],
            ['valsartan', 'FLSRTN', 'FLSRTN'],
            ['candesartan', 'KNTSRT', 'KNTSRT'],
            ['tamsulosin', 'TMSLSN', 'TMSLSN'],
            ['finasteride', 'FNSTRT', 'FNSTRT'],
            ['allopurinol', 'ALPRNL', 'ALPRNL'],
            ['colchicine', 'KLXSN', 'KLKSN'],
            ['methotrexate', 'M0TRKS', 'MTTRKS'],
            ['seroquel', 'SRKL', 'SRKL'],        ];
    }

    private function __construct()
    {
    }
}
