"""``Autocorrector`` adapter — typo correction on free-text input.

Mirror of ``packages/ts/src/zyins/reference/Autocorrector.ts`` and a
line-for-line semantic port of the bpp2.0 reference algorithm at
``src/sah-ui/Input/TextField/useAutocorrect.js``.

The adapter exists so consumers can:

  * inject a custom :class:`Autocorrector` (wholesale replacement),
  * decorate :class:`DefaultAutocorrector` via ``.clone(...)`` (token
    overlay), or
  * compose multiple correctors in a wrapper that itself implements the
    Protocol (chain).

The same three-pattern surface ships in every SDK language.

Example
-------

    >>> from sah_sdk.zyins.reference.autocorrector import DefaultAutocorrector
    >>> typo_map = {"ASTHM": "ASTHMA", "CHOLESTEROL": "HIGH CHOLESTEROL"}
    >>> ac = DefaultAutocorrector(typo_map=typo_map)
    >>> ac.correct("astm", mode="submit")
    'ASTM'
    >>> ac.correct("cholesterol", mode="submit")
    'HIGH CHOLESTEROL'
    >>> ac.correct("ASTHM", mode="keyup")  # mid-typing guard
    'ASTHM'
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping
from dataclasses import dataclass, field, replace
from typing import Any, Literal, Protocol, runtime_checkable

# Whitespace-splitter mirrors the JS algorithm's ``/\s+/`` regex.
_WHITESPACE_RE = re.compile(r"\s+")


def _contains_phrase(words: list[str], phrase: str) -> bool:
    """Return True when ``phrase`` appears as a consecutive token run.

    Mirrors the locked TS ``containsPhrase``: the phrase is whitespace-tokenized
    and matched as a contiguous subsequence of ``words`` — never as a substring
    inside a single token.
    """
    phrase_words = [w for w in _WHITESPACE_RE.split(phrase) if w]
    if not phrase_words or len(phrase_words) > len(words):
        return False
    last_start = len(words) - len(phrase_words)
    for start in range(last_start + 1):
        if words[start : start + len(phrase_words)] == phrase_words:
            return True
    return False


AutocorrectMode = Literal["keyup", "submit"]


@dataclass(frozen=True, slots=True)
class AutocorrectAppliedEvent:
    """Emitted to ``on_applied`` when a correction is applied.

    ``original`` is the verbatim text passed to :meth:`Autocorrector.correct`.
    ``corrected`` is the post-correction output. ``mode`` is the call mode.
    ``window`` and ``correction`` identify the specific typo replacement
    that triggered this event.
    """

    original: str
    corrected: str
    mode: AutocorrectMode
    window: str = ""
    correction: str = ""


@runtime_checkable
class Autocorrector(Protocol):
    """Protocol — typo-correct free-text input.

    Implementations MUST be side-effect-free with respect to the
    input string; they MUST preserve trailing whitespace; they MUST
    return the input unchanged when no correction applies.

    ``mode``:
      * ``"keyup"`` — the user is mid-typing. Skip corrections whose
        replacement contains the input as a substring AND is longer
        than the input (prevents "ASTHM" → "ASTHMA" while still typing).
      * ``"submit"`` — the input is final. Skip corrections whose
        replacement is already present as a substring of the input
        (prevents "HIGH CHOLESTEROL" → "HIGH HIGH CHOLESTEROL").
    """

    def correct(self, text: str, *, mode: AutocorrectMode) -> str:
        """Return ``text`` with typo corrections applied per ``mode``."""
        ...


@dataclass(frozen=True, slots=True)
class _AutocorrectorConfig:
    """Frozen config bag for :class:`DefaultAutocorrector`.

    Kept private so callers reach for :meth:`DefaultAutocorrector.clone`
    instead of mutating a config object directly.
    """

    typo_map: Mapping[str, str]
    version_tag: str | None = None
    on_applied: Callable[[AutocorrectAppliedEvent], None] | None = field(
        default=None, compare=False, repr=False
    )


class DefaultAutocorrector:
    """Reference implementation — n-gram sliding-window over a typo map.

    Algorithm (line-for-line semantic port of bpp2.0
    ``useAutocorrect.js``):

      1. Trim trailing whitespace, remember whether one was present.
      2. Uppercase the input, split on whitespace.
      3. For ``num_words`` in ``0..len(words)`` and each starting index
         ``i``, consider the contiguous n-gram ``words[i:i+num_words+1]``
         joined by a single space.
      4. Look it up in ``typo_map`` (keys are pre-uppercased by the
         caller). On a hit, apply the mode-specific guard:
         - ``keyup``: skip if ``correction.upper().includes(window)`` AND
           ``len(correction) > len(window)``.
         - ``submit``: skip if ``upper_input.includes(correction)``.
      5. If the guard passes, replace the slot at ``i`` with the
         correction; mark every position in the n-gram as processed;
         skip ahead past the consumed words.
      6. Fill un-processed slots with their original (uppercased) words.
      7. Re-join with single spaces; re-append the saved trailing
         whitespace.

    The implementation is single-threaded and allocates an O(n) list
    per call; no shared mutable state outside the optional
    ``on_applied`` callback fires once per applied correction.
    """

    __slots__ = ("_config",)

    _config: _AutocorrectorConfig

    def __init__(
        self,
        *,
        typo_map: Mapping[str, str],
        version_tag: str | None = None,
        on_applied: Callable[[AutocorrectAppliedEvent], None] | None = None,
    ) -> None:
        """Construct from a pre-uppercased typo map.

        :param typo_map: ``{"HBP": "HIGH BLOOD PRESSURE"}`` — keys and
            values are uppercase, single-space separated. The map is
            captured by reference; callers MUST NOT mutate it after
            construction.
        :param version_tag: Optional opaque tag identifying the
            underlying dataset version. Surfaced as :attr:`version_tag`
            for telemetry; never inspected by the algorithm.
        :param on_applied: Optional callback fired once per correction
            applied. Exceptions raised by the callback propagate to the
            caller of :meth:`correct`.
        """
        self._config = _AutocorrectorConfig(
            typo_map=typo_map,
            version_tag=version_tag,
            on_applied=on_applied,
        )

    @property
    def version_tag(self) -> str | None:
        """Opaque dataset-version tag, or ``None`` when unspecified."""
        return self._config.version_tag

    def clone(self, **overrides: Any) -> DefaultAutocorrector:
        """Return a fresh instance with selected fields overridden.

        Accepts the same keyword set as :meth:`__init__`. Fields not
        present in ``overrides`` are carried over from the current
        instance.

        >>> ac = DefaultAutocorrector(typo_map={"HBP": "HIGH BLOOD PRESSURE"})
        >>> child = ac.clone(version_tag="2026.05.29")
        >>> child.version_tag
        '2026.05.29'
        """
        new_config = replace(self._config, **overrides)
        return DefaultAutocorrector(
            typo_map=new_config.typo_map,
            version_tag=new_config.version_tag,
            on_applied=new_config.on_applied,
        )

    def correct(self, text: str, *, mode: AutocorrectMode) -> str:
        """Apply typo corrections per the locked algorithm.

        Exceptions raised by ``on_applied`` callbacks propagate to the caller.
        """
        if not text:
            return text

        trailing = " " if text.endswith(" ") else ""
        upper_text = text.upper()
        words = _WHITESPACE_RE.split(upper_text.strip()) if upper_text.strip() else []
        if not words:
            return text
        # An empty typo map still normalizes: uppercase + whitespace-collapse +
        # trailing-space preservation, matching the locked TS adapter (which
        # returns ``words.join(' ') + trailing`` on a zero-size map rather than
        # the raw input).
        if not self._config.typo_map:
            return " ".join(words) + trailing

        slots: list[str | None] = [None] * len(words)
        consumed: set[int] = set()
        typo_map = self._config.typo_map
        applied: list[tuple[str, str]] = []

        # Mirror the JS double-loop. The reference processes larger phrases
        # first (descending window size) so a multi-word correction wins over
        # a competing single-word one, and considers only exact-size n-grams —
        # a clamped tail slice shorter than the window is skipped and handled
        # by a later, smaller pass. The windowSize=0 pass is the size-1 sweep
        # that reaches every single word, so descending order still covers the
        # tail. See the locked TS DefaultAutocorrector.
        for window_size in range(len(words) - 1, -1, -1):
            i = 0
            while i < len(words):
                window_words = words[i : i + window_size + 1]
                if len(window_words) != window_size + 1:
                    i += 1
                    continue
                window_len = len(window_words)
                window = " ".join(window_words)
                correction = typo_map.get(window)
                if correction is None:
                    i += 1
                    continue

                if mode == "keyup":
                    # Keyup-mode guard: skip if correction is a strict
                    # superstring of the window (mid-typing protection).
                    correction_upper = correction.upper()
                    if window in correction_upper and len(correction) > len(window):
                        i += 1
                        continue
                else:
                    # Submit-mode guard: anti-duplication — skip only when the
                    # correction already appears as a consecutive whitespace-
                    # token phrase in the input, NOT when it is merely a
                    # substring inside a single token. Mirrors the locked TS
                    # ``containsPhrase``.
                    if _contains_phrase(words, correction.upper()):
                        i += 1
                        continue

                if slots[i] is not None:
                    i += 1
                    continue
                if any((i + n) in consumed for n in range(window_len)):
                    i += 1
                    continue

                slots[i] = correction
                for n in range(window_len):
                    if i + n < len(words):
                        consumed.add(i + n)
                        if n > 0:
                            slots[i + n] = None
                applied.append((window, correction))
                i += 1

        out_words: list[str] = []
        for index, word in enumerate(words):
            if slots[index] is not None:
                out_words.append(slots[index] or "")
            elif index not in consumed:
                out_words.append(word)
        result = " ".join(out_words)
        # Collapse internal repeats the way the JS algorithm does via
        # ``.split(/\s+/).join(' ')`` after the replacement pass.
        result = " ".join(_WHITESPACE_RE.split(result)) + trailing

        if applied and self._config.on_applied is not None:
            for window, correction in applied:
                self._config.on_applied(
                    AutocorrectAppliedEvent(
                        original=text,
                        corrected=result,
                        mode=mode,
                        window=window,
                        correction=correction,
                    )
                )
        return result


def create(
    *,
    typo_map: Mapping[str, str],
    version_tag: str | None = None,
    on_applied: Callable[[AutocorrectAppliedEvent], None] | None = None,
) -> DefaultAutocorrector:
    """Factory mirroring ``isa.autocorrector.create({ typoMap })`` (TS).

    The kernel-style entry point. Equivalent to instantiating
    :class:`DefaultAutocorrector` directly; documented separately so the
    surface name matches the locked cross-language SDK syntax.
    """
    return DefaultAutocorrector(
        typo_map=typo_map, version_tag=version_tag, on_applied=on_applied
    )


__all__ = [
    "AutocorrectAppliedEvent",
    "AutocorrectMode",
    "Autocorrector",
    "DefaultAutocorrector",
    "create",
]
