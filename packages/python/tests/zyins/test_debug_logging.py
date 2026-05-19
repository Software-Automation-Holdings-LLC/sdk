"""ISA_LOG=debug dumps to stderr with redaction; never to stdout."""

from __future__ import annotations

import io
import json
import os
import subprocess
import sys
import textwrap
from dataclasses import dataclass, field

from sah_sdk.core.debug import DebugLogger, redact_body_string, redact_headers


@dataclass
class FakeEnv:
    values: dict[str, str] = field(default_factory=dict)

    def get(self, key: str) -> str | None:
        v = self.values.get(key)
        return v if v else None


def test_debug_disabled_when_isa_log_unset() -> None:
    logger = DebugLogger(env=FakeEnv({}))
    assert logger.enabled is False


def test_debug_enabled_when_isa_log_debug() -> None:
    logger = DebugLogger(env=FakeEnv({"ISA_LOG": "debug"}))
    assert logger.enabled is True


def test_debug_case_insensitive() -> None:
    logger = DebugLogger(env=FakeEnv({"ISA_LOG": "DEBUG"}))
    assert logger.enabled is True


def test_disabled_logger_emits_nothing() -> None:
    stream = io.StringIO()
    logger = DebugLogger(env=FakeEnv({}), stream=stream)
    logger.log_request("POST", "https://x", {"Authorization": "Bearer x"}, "{}")
    logger.log_response("POST", "https://x", 200, {}, "{}")
    assert stream.getvalue() == ""


def test_enabled_logger_emits_to_stream() -> None:
    stream = io.StringIO()
    logger = DebugLogger(env=FakeEnv({"ISA_LOG": "debug"}), stream=stream)
    logger.log_request("POST", "https://x", {"Authorization": "Bearer s3kret"}, None)
    out = stream.getvalue()
    assert "isa-sdk debug" in out
    # Authorization header value redacted.
    assert "Bearer s3kret" not in out
    assert "<redacted>" in out


def test_redact_headers_masks_signature_headers() -> None:
    headers = {
        "Authorization": "Bearer abc",
        "X-Device-Signature": "abc==",
        "X-Session-Signature": "def==",
        "X-Isa-Request-Id": "req_01",
        "Content-Type": "application/json",
    }
    redacted = redact_headers(headers)
    assert redacted["Authorization"] == "<redacted>"
    assert redacted["X-Device-Signature"] == "<redacted>"
    assert redacted["X-Session-Signature"] == "<redacted>"
    assert redacted["X-Isa-Request-Id"] == "req_01"
    assert redacted["Content-Type"] == "application/json"


def test_redact_headers_case_insensitive() -> None:
    headers = {"authorization": "Bearer abc", "x-device-signature": "abc=="}
    redacted = redact_headers(headers)
    assert redacted["authorization"] == "<redacted>"
    assert redacted["x-device-signature"] == "<redacted>"


def test_redact_body_masks_pii_fields() -> None:
    body = json.dumps(
        {
            "applicant": {
                "email": "john.doe@acme-agency.com",
                "dob": "1962-04-18",
                "ssn": "111-22-3333",
                "phone": "+15551234567",
                "state": "NC",
            },
            "products": "colonial-penn.final-expense",
        }
    )
    redacted = redact_body_string(body)
    assert redacted is not None
    parsed = json.loads(redacted)
    assert parsed["applicant"]["email"] == "<redacted>"
    assert parsed["applicant"]["dob"] == "<redacted>"
    assert parsed["applicant"]["ssn"] == "<redacted>"
    assert parsed["applicant"]["phone"] == "<redacted>"
    # Non-PII fields preserved.
    assert parsed["applicant"]["state"] == "NC"
    assert parsed["products"] == "colonial-penn.final-expense"


def test_redact_body_handles_lists() -> None:
    body = json.dumps([{"email": "a@b.com"}, {"email": "c@d.com"}])
    redacted = redact_body_string(body)
    assert redacted is not None
    parsed = json.loads(redacted)
    assert all(item["email"] == "<redacted>" for item in parsed)


def test_redact_body_handles_empty_and_none() -> None:
    assert redact_body_string(None) is None
    assert redact_body_string("") == ""


def test_redact_body_passes_through_non_json() -> None:
    assert redact_body_string("not-json") == "not-json"


def test_debug_goes_to_stderr_in_subprocess() -> None:
    """Spawn a subprocess; verify debug lines land on stderr, not stdout.

    The subprocess-capture test is the only way to prove the stream
    binding is correct at the OS level — direct unit tests can replace
    sys.stderr with a StringIO and pass spuriously.
    """
    script = textwrap.dedent(
        """
        from sah_sdk.core.debug import DebugLogger
        from dataclasses import dataclass, field
        @dataclass
        class E:
            values: dict = field(default_factory=lambda: {"ISA_LOG": "debug"})
            def get(self, k): return self.values.get(k)
        logger = DebugLogger(env=E())
        logger.log_request("POST", "https://example/v1/prequalify",
                           {"Authorization": "Bearer xxxxx"}, '{"email":"a@b.com"}')
        print("STDOUT-DATA", flush=True)
        """
    )
    env = os.environ.copy()
    # Inherit PYTHONPATH so the src layout package resolves under the
    # subprocess interpreter without requiring an install.
    src_path = os.path.join(os.path.dirname(__file__), "..", "src")
    env["PYTHONPATH"] = src_path + os.pathsep + env.get("PYTHONPATH", "")
    proc = subprocess.run(
        [sys.executable, "-c", script],
        capture_output=True,
        text=True,
        env=env,
        check=True,
    )
    # stdout carries only the data line — debug log MUST NOT be there.
    assert "STDOUT-DATA" in proc.stdout
    assert "isa-sdk debug" not in proc.stdout
    assert "Bearer xxxxx" not in proc.stdout
    # stderr carries the debug log, with the credential redacted.
    assert "isa-sdk debug" in proc.stderr
    assert "Bearer xxxxx" not in proc.stderr
    assert "<redacted>" in proc.stderr
