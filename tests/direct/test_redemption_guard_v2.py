import json
from datetime import datetime, timezone
from pathlib import Path

import pytest

from conftest import (
    HOST,
    URL_OPERATIONAL,
    URL_SUSPENDED,
    URL_UNCLEAR,
    html_response,
    set_tx_time,
)

V2_CONTRACT = str(Path(__file__).resolve().parents[2] / "contracts" / "redemption_guard_v2.py")


def urls(*items):
    return json.dumps(list(items))


def mock_all_llm(vm):
    vm.mock_llm(r"are fully operational", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Issuer says redemptions are operational.",
        "reason_codes": ["REDEMPTIONS_OPERATIONAL"], "supporting_urls": [URL_OPERATIONAL],
    }))
    vm.mock_llm(r"has suspended all redemptions", json.dumps({
        "status": "RESTRICTED", "reasoning": "Issuer suspended redemptions.",
        "reason_codes": ["REDEMPTIONS_SUSPENDED"], "supporting_urls": [URL_SUSPENDED],
    }))
    vm.mock_llm(r"not confirmed in this update", json.dumps({
        "status": "INSUFFICIENT_EVIDENCE", "reasoning": "The update is ambiguous.",
        "reason_codes": ["SOURCE_AMBIGUOUS"], "supporting_urls": [URL_UNCLEAR],
    }))


def future_epoch(value="2026-09-18T12:00:00Z", seconds=3600):
    return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()) + seconds


@pytest.fixture
def guard_v2(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    contract = direct_deploy(V2_CONTRACT)
    contract.register_asset("NWUSD", "Northwind Dollar", "Northwind Reserve Trust (fictional)", f'["{HOST}"]')
    contract.register_asset("HLUSD", "Halcyon Dollar", "Halcyon Settlement Co. (fictional)", f'["{HOST}"]')
    return contract


def test_v2_role_gate_and_grant(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    contract = direct_deploy(V2_CONTRACT)
    contract.register_asset("NWUSD", "Northwind Dollar", "Issuer", f'["{HOST}"]')
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("requires ASSESSOR"):
        contract.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    direct_vm.sender = direct_owner
    contract.grant_role("ASSESSOR", direct_alice)
    assert contract.has_role("ASSESSOR", direct_alice) is True
    direct_vm.sender = direct_alice
    direct_vm.mock_web(r".*northwind-redemptions-operational\.html$", html_response("northwind-redemptions-operational.html"))
    direct_vm.mock_llm(r"are fully operational", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Issuer says redemptions are operational.",
        "reason_codes": ["REDEMPTIONS_OPERATIONAL"], "supporting_urls": [URL_OPERATIONAL],
    }))
    assert contract.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "ELIGIBLE"


def test_v2_required_source_omission_and_policy_version(guard_v2, direct_vm, direct_owner):
    direct_vm.sender = direct_owner
    required = URL_OPERATIONAL
    guard_v2.register_asset("RQUSD", "Required Dollar", "Issuer", f'["{HOST}"]', urls(required), 1, 10)
    assert guard_v2.get_source_policy("RQUSD")["source_policy_version"] == 1
    # The required canonical source must be present; omission is a safe insufficiency.
    assert guard_v2.assess_asset("RQUSD", urls(URL_UNCLEAR)) == "INSUFFICIENT_EVIDENCE"
    assert guard_v2.get_latest_assessment("RQUSD")["reason_codes"] == ["REQUIRED_SOURCE_MISSING"]
    guard_v2.set_source_policy("RQUSD", urls(required), 2)
    with direct_vm.expect_revert("version must increase"):
        guard_v2.set_source_policy("RQUSD", urls(required), 2)
    assert guard_v2.get_source_policy("RQUSD")["source_policy_version"] == 2


def test_v2_minimum_usable_sources(guard_v2, direct_vm, direct_owner, fixtures_online):
    direct_vm.sender = direct_owner
    guard_v2.register_asset("M2USD", "Multi-source Dollar", "Issuer", f'["{HOST}"]', "[]", 1, 10, 10, 2)
    assert guard_v2.assess_asset("M2USD", urls(URL_OPERATIONAL)) == "INSUFFICIENT_EVIDENCE"
    assert guard_v2.get_latest_assessment("M2USD")["reason_codes"] == ["MIN_SOURCES_MISSING"]


def test_v2_policy_change_invalidates_previous_assessment(guard_v2, direct_vm, direct_owner, fixtures_online):
    set_tx_time(direct_vm, "2026-09-18T12:00:00Z")
    mock_all_llm(direct_vm)
    assert guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "ELIGIBLE"
    guard_v2.set_source_policy("NWUSD", urls(URL_OPERATIONAL), 2)
    with direct_vm.expect_revert("SOURCE_POLICY_CHANGED"):
        guard_v2.request_exposure("NWUSD", 1, direct_owner, "policy-change", future_epoch())


def test_v2_consensus_paths_and_malformed_output(guard_v2, direct_vm, fixtures_online):
    mock_all_llm(direct_vm)
    assert guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "ELIGIBLE"
    assert guard_v2.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "RESTRICTED"
    assert guard_v2.assess_asset("HLUSD", urls(URL_UNCLEAR)) == "INSUFFICIENT_EVIDENCE"
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*northwind-redemptions-operational\.html$", html_response("northwind-redemptions-operational.html"))
    direct_vm.mock_llm(r"are fully operational", '"malformed"')
    with direct_vm.expect_revert("[LLM_ERROR] MALFORMED_OUTPUT"):
        guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL))


def test_v2_pause_and_roles(guard_v2, direct_vm, direct_alice, direct_owner):
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("requires PAUSER"):
        guard_v2.pause("incident")
    direct_vm.sender = direct_owner
    guard_v2.pause("incident")
    assert guard_v2.get_pause_state() == {"paused": True, "reason": "incident"}
    with direct_vm.expect_revert("PAUSED"):
        guard_v2.register_asset("PAUSD", "Paused Dollar", "Issuer", f'["{HOST}"]')
    guard_v2.unpause()
    assert guard_v2.get_pause_state()["paused"] is False


def test_v2_assessment_expiry_and_exposure_cap(guard_v2, direct_vm, direct_owner, fixtures_online):
    set_tx_time(direct_vm, "2026-09-18T12:00:00Z")
    mock_all_llm(direct_vm)
    guard_v2.set_assessment_validity("NWUSD", 60)
    guard_v2.set_exposure_cap("NWUSD", 5)
    assert guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "ELIGIBLE"
    with direct_vm.expect_revert("EXPOSURE_CAP"):
        guard_v2.request_exposure("NWUSD", 6, direct_owner, "cap-1", future_epoch(seconds=3600))
    assert guard_v2.request_exposure("NWUSD", 5, direct_owner, "cap-2", future_epoch(seconds=3600)) == 1
    set_tx_time(direct_vm, "2026-09-18T12:01:01Z")
    with direct_vm.expect_revert("ASSESSMENT_EXPIRED"):
        guard_v2.request_exposure("NWUSD", 1, direct_owner, "expired", future_epoch("2026-09-18T12:01:01Z"))


def test_v2_nonce_replay_and_beneficiary(guard_v2, direct_vm, direct_owner, direct_alice, fixtures_online):
    set_tx_time(direct_vm, "2026-09-18T12:00:00Z")
    mock_all_llm(direct_vm)
    guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    expiry = future_epoch()
    direct_vm.sender = direct_alice
    assert guard_v2.request_exposure("NWUSD", 1, direct_alice, "same", expiry) == 1
    with direct_vm.expect_revert("NONCE_REPLAY"):
        guard_v2.request_exposure("NWUSD", 1, direct_alice, "same", expiry)
    exposure = guard_v2.get_exposure_requests(5)[0]
    assert exposure["beneficiary"].startswith("0x")
    assert exposure["nonce"] == "same"


def test_v2_beneficiary_must_be_caller_and_has_cap(guard_v2, direct_vm, direct_owner, direct_alice, fixtures_online):
    set_tx_time(direct_vm, "2026-09-18T12:00:00Z")
    mock_all_llm(direct_vm)
    guard_v2.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    guard_v2.set_beneficiary_cap("NWUSD", 2)
    with direct_vm.expect_revert("BENEFICIARY_MISMATCH"):
        guard_v2.request_exposure("NWUSD", 1, direct_alice, "wrong-caller", future_epoch())
    with direct_vm.prank(direct_alice):
        guard_v2.request_exposure("NWUSD", 2, direct_alice, "beneficiary-cap", future_epoch())
        with direct_vm.expect_revert("BENEFICIARY_CAP"):
            guard_v2.request_exposure("NWUSD", 1, direct_alice, "beneficiary-cap-2", future_epoch())


def test_v2_restricted_to_eligible_cooldown(guard_v2, direct_vm, direct_owner, fixtures_online):
    set_tx_time(direct_vm, "2026-09-18T12:00:00Z")
    mock_all_llm(direct_vm)
    assert guard_v2.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "RESTRICTED"
    direct_vm.clear_mocks()
    direct_vm.mock_web(r".*halcyon-redemptions-suspended\.html$", html_response("halcyon-redemptions-suspended.html"))
    direct_vm.mock_llm(r".*", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Recovery notice.",
        "reason_codes": ["REDEMPTIONS_OPERATIONAL"], "supporting_urls": [URL_SUSPENDED],
    }))
    set_tx_time(direct_vm, "2026-09-18T12:30:00Z")
    assert guard_v2.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "ELIGIBLE"
    assert guard_v2.get_asset("HLUSD")["gate_open"] is False
    with direct_vm.expect_revert("cooldown"):
        guard_v2.request_exposure("HLUSD", 1, direct_owner, "cooldown", future_epoch("2026-09-18T12:30:00Z"))
