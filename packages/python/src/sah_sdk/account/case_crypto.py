"""Zero-knowledge case crypto envelope for ``isa.account.cases``.

Byte-compatible with the TypeScript SDK's ``account/caseCrypto.ts``. The
platform stores opaque ciphertext and never holds a key: the SDK generates a
fresh data key per case, encrypts the payload with AES-GCM (the cleartext
``product`` tag is bound as additional authenticated data), and carries the
key only in the share-link ``#k=`` fragment.

The wire envelope splits the GCM auth tag out of the ciphertext — the
``cryptography`` library appends it on encrypt (like WebCrypto), so this
module slices it off and rejoins on decrypt to mirror the TS ``ciphertext`` /
``iv`` / ``tag`` field split.

HARD RULE — never log the fragment key. Never embed it in a thrown error,
telemetry payload, or returned debug record. The key is the capability;
leakage defeats the zero-knowledge guarantee.
"""

from __future__ import annotations

import base64
import json
import secrets
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

#: AES-128 data-key length in bytes for fresh case keys. Decrypt is
#: length-agnostic (AES picks 128/192/256 by key length), so 256-bit keys
#: from earlier envelopes still open; this governs generation only.
_KEY_BYTES = 16
#: AES-GCM nonce length in bytes (96-bit, the GCM-recommended size).
_IV_BYTES = 12
#: AES-GCM authentication-tag length in bytes (128-bit).
_TAG_BYTES = 16

#: CSPRNG facade for case-key + nonce generation; tests inject a
#: deterministic source. ``int -> bytes``.
RandomBytes = Callable[[int], bytes]


def system_random_bytes(n: int) -> bytes:
    """Read ``n`` cryptographically random bytes. The only OS-RNG touch in
    the case-crypto path, so :func:`encrypt_case` stays testable."""
    return secrets.token_bytes(n)


@dataclass(frozen=True, slots=True)
class CaseEnvelope:
    """The opaque crypto fields the server stores, all std (padded) base64."""

    #: Std-base64 AES-GCM ciphertext with the auth tag stripped.
    ciphertext: str
    #: Std-base64 AES-GCM nonce.
    iv: str
    #: Std-base64 AES-GCM authentication tag.
    tag: str


@dataclass(frozen=True, slots=True)
class EncryptedCase:
    """Result of :func:`encrypt_case`: wire envelope + base64url fragment key."""

    #: The base64 fields posted to ``/v1/case``.
    envelope: CaseEnvelope
    #: The data key, base64url-encoded (no padding), for the ``#k=`` fragment.
    key_fragment: str


class CaseDecryptError(ValueError):
    """Raised when an envelope fails AES-GCM authentication: a tampered,
    corrupt, or ``product``-mismatched payload, or a wrong fragment key. The
    plaintext cannot be recovered; treat it as terminal."""


def encrypt_case(
    product: str, payload: Any, random_bytes: RandomBytes | None = None
) -> EncryptedCase:
    """Encrypt a JSON payload under a fresh 128-bit key, binding ``product``
    as AEAD additional data. Returns the base64 wire envelope and the
    base64url fragment key."""
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    rng = random_bytes or system_random_bytes
    raw_key = rng(_KEY_BYTES)
    iv = rng(_IV_BYTES)
    serialized = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    sealed = AESGCM(raw_key).encrypt(iv, serialized, product.encode("utf-8"))
    split_at = len(sealed) - _TAG_BYTES
    return EncryptedCase(
        envelope=CaseEnvelope(
            ciphertext=_bytes_to_b64(sealed[:split_at]),
            iv=_bytes_to_b64(iv),
            tag=_bytes_to_b64(sealed[split_at:]),
        ),
        key_fragment=_bytes_to_b64url(raw_key),
    )


def decrypt_case(product: str, envelope: CaseEnvelope, key_fragment: str) -> Any:
    """Decrypt a wire envelope with the fragment key, verifying the
    ``product`` AEAD binding, and return the parsed JSON payload. Raises
    :class:`CaseDecryptError` on any authentication failure."""
    from cryptography.exceptions import InvalidTag
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM

    raw_key = _decode_fragment_key(key_fragment)
    iv = _b64_to_bytes(envelope.iv)
    sealed = _b64_to_bytes(envelope.ciphertext) + _b64_to_bytes(envelope.tag)
    try:
        plaintext = AESGCM(raw_key).decrypt(iv, sealed, product.encode("utf-8"))
    except InvalidTag as exc:
        raise CaseDecryptError(
            f"case envelope failed authentication for product {product}: "
            "wrong key, wrong product, or tampered ciphertext"
        ) from exc
    return json.loads(plaintext.decode("utf-8"))


def _bytes_to_b64(b: bytes) -> str:
    return base64.b64encode(b).decode("ascii")


def _b64_to_bytes(s: str) -> bytes:
    return base64.b64decode(s)


def _bytes_to_b64url(b: bytes) -> str:
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode("ascii")


def _decode_fragment_key(fragment: str) -> bytes:
    """Decode a fragment key. Accepts the base64url share-link form (with or
    without padding) and standard base64, mirroring the TS decoder that
    normalizes the URL-safe alphabet before decoding."""
    normalized = fragment.replace("-", "+").replace("_", "/")
    pad = "=" * (-len(normalized) % 4)
    return base64.b64decode(normalized + pad)


__all__ = [
    "CaseDecryptError",
    "CaseEnvelope",
    "EncryptedCase",
    "RandomBytes",
    "decrypt_case",
    "encrypt_case",
    "system_random_bytes",
]
