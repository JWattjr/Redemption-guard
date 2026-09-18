import atexit
import json
import os
import sys
import types
from pathlib import Path

import pytest

# Pin the GenVM bundle that Studio Next (genlayer-studio v0.123.0-rc.7) runs,
# so direct tests load the same py-genlayer runner the contract header names.
os.environ.setdefault("GENVM_VERSION", "v0.6.0-rc5")

if sys.platform == "win32":
    # gltest 0.30.0rc2 unlinks its stdin temp file while fd 0 still holds it.
    # POSIX allows that; Windows raises WinError 32. Defer those deletions.
    from gltest.direct import loader as _loader

    _pending: list = []

    def _cleanup_pending():
        for path in _pending:
            try:
                os.unlink(path)
            except OSError:
                pass

    _original_inject = _loader._inject_message_to_fd0

    def _inject_windows_safe(vm):
        real_unlink = os.unlink
        os.unlink = _deferred_unlink_factory(real_unlink)
        try:
            _original_inject(vm)
        finally:
            os.unlink = real_unlink

    def _deferred_unlink_factory(real_unlink):
        def _unlink(path, *args, **kwargs):
            try:
                real_unlink(path, *args, **kwargs)
            except PermissionError:
                _pending.append(path)
        return _unlink

    _loader._inject_message_to_fd0 = _inject_windows_safe
    atexit.register(_cleanup_pending)

# gltest 0.30.0rc2 json.loads() mocked LLM responses before handing them to the
# SDK, but the v0.3 std library (runner 5jycge4q...) decodes JSON from *text*
# itself and rejects a pre-parsed object ("JSON result is not text"). Quote the
# mock once so the harness's json.loads yields the exact raw model text.
from gltest.direct.vm import VMContext as _VMContext  # noqa: E402

_original_mock_llm = _VMContext.mock_llm


def _mock_llm_as_text(self, prompt_pattern, response):
    return _original_mock_llm(self, prompt_pattern, json.dumps(response))


_VMContext.mock_llm = _mock_llm_as_text

ROOT = Path(__file__).resolve().parents[2]
CONTRACT = str(ROOT / "contracts" / "redemption_guard.py")
EVIDENCE = ROOT / "frontend" / "public" / "evidence"
HOST = "evidence.example.org"
BASE = f"https://{HOST}/evidence"

URL_OPERATIONAL = f"{BASE}/northwind-redemptions-operational.html"
URL_SUSPENDED = f"{BASE}/halcyon-redemptions-suspended.html"
URL_UNCLEAR = f"{BASE}/halcyon-status-unclear.html"


def fixture_html(name: str) -> str:
    return (EVIDENCE / name).read_text(encoding="utf-8")


def html_response(name: str) -> dict:
    return {
        "response": {
            "status": 200,
            "headers": {"content-type": b"text/html; charset=utf-8"},
            "body": fixture_html(name).encode("utf-8"),
        }
    }


@pytest.fixture
def guard(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    contract = direct_deploy(CONTRACT)
    contract.register_asset("NWUSD", "Northwind Dollar", "Northwind Reserve Trust (fictional)", f'["{HOST}"]')
    contract.register_asset("HLUSD", "Halcyon Dollar", "Halcyon Settlement Co. (fictional)", f'["{HOST}"]')
    return contract


@pytest.fixture
def fixtures_online(direct_vm):
    direct_vm.mock_web(r".*northwind-redemptions-operational\.html$", html_response("northwind-redemptions-operational.html"))
    direct_vm.mock_web(r".*halcyon-redemptions-suspended\.html$", html_response("halcyon-redemptions-suspended.html"))
    direct_vm.mock_web(r".*halcyon-status-unclear\.html$", html_response("halcyon-status-unclear.html"))
    return direct_vm
