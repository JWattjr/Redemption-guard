import json

from conftest import CONTRACT, HOST, URL_OPERATIONAL, URL_SUSPENDED, URL_UNCLEAR, html_response, set_tx_time

OPERATIONAL_LLM = json.dumps({
    "status": "ELIGIBLE",
    "reasoning": "Issuer notice dated 18 Sep 2026 states NWUSD redemptions are fully operational.",
    "reason_codes": ["REDEMPTIONS_OPERATIONAL"],
    "supporting_urls": [URL_OPERATIONAL],
})
SUSPENDED_LLM = json.dumps({
    "status": "RESTRICTED",
    "reasoning": "Issuer notice states all HLUSD redemptions are suspended until further notice.",
    "reason_codes": ["REDEMPTIONS_SUSPENDED"],
    "supporting_urls": [URL_SUSPENDED],
})
UNCLEAR_LLM = json.dumps({
    "status": "INSUFFICIENT_EVIDENCE",
    "reasoning": "The update explicitly does not confirm whether HLUSD redemptions operate.",
    "reason_codes": ["SOURCE_AMBIGUOUS", "NO_REDEMPTION_INFORMATION"],
    "supporting_urls": [URL_UNCLEAR],
})

P_OPERATIONAL = r"are fully operational"
P_SUSPENDED = r"has suspended all redemptions"
P_UNCLEAR = r"not confirmed in this update"


def urls(*items):
    return json.dumps(list(items))


def mock_all_llm(vm):
    vm.mock_llm(P_OPERATIONAL, OPERATIONAL_LLM)
    vm.mock_llm(P_SUSPENDED, SUSPENDED_LLM)
    vm.mock_llm(P_UNCLEAR, UNCLEAR_LLM)


# --------------------------------------------------------------- registration

def test_owner_registers_two_assets(guard):
    assets = guard.get_assets()
    assert [a["asset_id"] for a in assets] == ["NWUSD", "HLUSD"]
    assert assets[0]["authoritative_domains"] == [HOST]
    assert assets[0]["latest_status"] == ""
    assert guard.get_summary()["asset_count"] == 2


def test_asset_limit_is_two(guard, direct_vm):
    with direct_vm.expect_revert("ASSET_LIMIT"):
        guard.register_asset("THIRD", "Third Dollar", "Nobody", f'["{HOST}"]')


def test_only_owner_can_register(direct_vm, direct_deploy, direct_owner, direct_alice):
    direct_vm.sender = direct_owner
    contract = direct_deploy(CONTRACT)
    direct_vm.sender = direct_alice
    with direct_vm.expect_revert("UNAUTHORIZED"):
        contract.register_asset("NWUSD", "Northwind Dollar", "Issuer", f'["{HOST}"]')


def test_duplicate_and_invalid_asset_ids(direct_vm, direct_deploy, direct_owner):
    direct_vm.sender = direct_owner
    contract = direct_deploy(CONTRACT)
    contract.register_asset("NWUSD", "Northwind Dollar", "Issuer", f'["{HOST}"]')
    with direct_vm.expect_revert("DUPLICATE_ASSET"):
        contract.register_asset("NWUSD", "Again", "Issuer", f'["{HOST}"]')
    with direct_vm.expect_revert("INVALID_ASSET_ID"):
        contract.register_asset("nw usd", "Bad", "Issuer", f'["{HOST}"]')
    with direct_vm.expect_revert("INVALID_DOMAINS"):
        contract.register_asset("HLUSD", "Halcyon", "Issuer", '["not a host"]')
    with direct_vm.expect_revert("INVALID_DOMAINS"):
        contract.register_asset("HLUSD", "Halcyon", "Issuer", "[]")


# ----------------------------------------------------------- URL validation

def test_rejects_invalid_url_inputs(guard, direct_vm):
    bad_inputs = [
        ("[]", "between 1 and 3"),
        (urls(URL_OPERATIONAL, URL_SUSPENDED, URL_UNCLEAR, URL_OPERATIONAL + "?x"), "between 1 and 3"),
        (urls("http://evidence.example.org/a"), "only https://"),
        (urls("ftp://evidence.example.org/a"), "only https://"),
        (urls("https://localhost/a"), "public DNS hostname"),
        (urls("https://127.0.0.1/a"), "public DNS hostname"),
        (urls("https://user@evidence.example.org/a"), "public DNS hostname"),
        (urls("https://evidence.example.org/" + "a" * 300), "longer than 300"),
        (urls(URL_OPERATIONAL, URL_OPERATIONAL), "duplicate URL"),
        ("not json", "JSON array"),
        ('[42]', "must be a string"),
    ]
    for payload, message in bad_inputs:
        with direct_vm.expect_revert(message):
            guard.assess_asset("NWUSD", payload)
    assert guard.get_summary()["assessment_count"] == 0


def test_unknown_asset_rejected(guard, direct_vm):
    with direct_vm.expect_revert("UNKNOWN_ASSET"):
        guard.assess_asset("USDX", urls(URL_OPERATIONAL))
    with direct_vm.expect_revert("UNKNOWN_ASSET"):
        guard.request_exposure("USDX", 100)


# ------------------------------------------------------ assessment outcomes

def test_eligible_assessment_then_exposure_succeeds(guard, fixtures_online, direct_alice):
    mock_all_llm(fixtures_online)
    fixtures_online.sender = direct_alice
    assert guard.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "ELIGIBLE"

    latest = guard.get_latest_assessment("NWUSD")
    assert latest["status"] == "ELIGIBLE"
    assert latest["reason_codes"] == ["REDEMPTIONS_OPERATIONAL"]
    assert latest["supporting_urls"] == [URL_OPERATIONAL]
    assert latest["sources"][0]["authoritative"] is True
    assert latest["sources"][0]["fetch"] == "OK"
    assert latest["policy_id"] == "RG-TREASURY-REDEMPTION-v1"

    assert guard.request_exposure("NWUSD", 250_000) == 1
    exposures = guard.get_exposure_requests(10)
    assert exposures[0]["amount_units"] == "250000"
    assert exposures[0]["assessment_id"] == latest["id"]
    assert guard.get_asset("NWUSD")["approved_exposure_units"] == "250000"
    summary = guard.get_summary()
    assert summary["eligible_assets"] == ["NWUSD"]
    assert summary["status_counts"]["ELIGIBLE"] == 1


def test_restricted_assessment_blocks_exposure(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    assert guard.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "RESTRICTED"
    assert guard.get_latest_assessment("HLUSD")["reason_codes"] == ["REDEMPTIONS_SUSPENDED"]
    with fixtures_online.expect_revert("EXPOSURE_BLOCKED: HLUSD latest assessment #1 is RESTRICTED"):
        guard.request_exposure("HLUSD", 1_000)
    assert guard.get_summary()["exposure_request_count"] == 0


def test_insufficient_assessment_blocks_exposure(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    assert guard.assess_asset("HLUSD", urls(URL_UNCLEAR)) == "INSUFFICIENT_EVIDENCE"
    with fixtures_online.expect_revert("is INSUFFICIENT_EVIDENCE"):
        guard.request_exposure("HLUSD", 1_000)


def test_missing_assessment_blocks_exposure(guard, direct_vm):
    with direct_vm.expect_revert("EXPOSURE_BLOCKED: NWUSD has no assessment"):
        guard.request_exposure("NWUSD", 1)


def test_latest_assessment_governs_exposure(guard, fixtures_online):
    """A restricted-to-eligible recovery stays closed through its cooldown."""
    set_tx_time(fixtures_online, "2026-09-18T12:00:00Z")
    mock_all_llm(fixtures_online)
    assert guard.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "RESTRICTED"
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", html_response("halcyon-redemptions-suspended.html"))
    fixtures_online.mock_llm(r".*", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Wrong asset evidence ok", "reason_codes": [],
        "supporting_urls": [URL_SUSPENDED],
    }))
    set_tx_time(fixtures_online, "2026-09-18T12:30:00Z")
    assert guard.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "ELIGIBLE"
    latest = guard.get_latest_assessment("HLUSD")
    assert latest["gate_open_at"] == "2026-09-18T13:30:00+00:00"
    assert guard.get_asset("HLUSD")["gate_open"] is False
    assert "HLUSD" not in guard.get_summary()["eligible_assets"]
    with fixtures_online.expect_revert("cooldown until 2026-09-18T13:30:00+00:00"):
        guard.request_exposure("HLUSD", 5)
    set_tx_time(fixtures_online, "2026-09-18T13:30:00Z")
    assert guard.request_exposure("HLUSD", 5) == 1
    assert guard.get_asset("HLUSD")["gate_open"] is True
    assert "HLUSD" in guard.get_summary()["eligible_assets"]
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", html_response("halcyon-status-unclear.html"))
    fixtures_online.mock_llm(r".*", UNCLEAR_LLM)
    assert guard.assess_asset("HLUSD", urls(URL_UNCLEAR)) == "INSUFFICIENT_EVIDENCE"
    with fixtures_online.expect_revert("EXPOSURE_BLOCKED"):
        guard.request_exposure("HLUSD", 5)
    assert [a["id"] for a in guard.get_recent_assessments(10)] == [3, 2, 1]


def test_invalid_amounts_rejected(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    for amount in (0, -5, 10**31):
        with fixtures_online.expect_revert("INVALID_AMOUNT"):
            guard.request_exposure("NWUSD", amount)
    with fixtures_online.expect_revert("INVALID_AMOUNT"):
        guard.request_exposure("NWUSD", "100")


# ------------------------------------------------ deterministic policy guards

def test_non_authoritative_source_downgraded(guard, direct_vm):
    other = "https://news.example.net/nwusd-fine.html"
    direct_vm.mock_web(r"news\.example\.net", html_response("northwind-redemptions-operational.html"))
    direct_vm.mock_llm(r".*", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Operational per article.",
        "reason_codes": ["REDEMPTIONS_OPERATIONAL"], "supporting_urls": [other],
    }))
    assert guard.assess_asset("NWUSD", urls(other)) == "INSUFFICIENT_EVIDENCE"
    latest = guard.get_latest_assessment("NWUSD")
    assert latest["reason_codes"][0] == "NON_AUTHORITATIVE_SOURCE"
    assert latest["sources"][0]["authoritative"] is False


def test_unsupported_urls_in_llm_output_are_dropped(guard, fixtures_online):
    fixtures_online.mock_llm(r".*", json.dumps({
        "status": "ELIGIBLE", "reasoning": "ok",
        "reason_codes": ["MADE_UP_CODE"], "supporting_urls": ["https://attacker.example/x"],
    }))
    assert guard.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "INSUFFICIENT_EVIDENCE"
    latest = guard.get_latest_assessment("NWUSD")
    assert latest["supporting_urls"] == []
    assert "MADE_UP_CODE" not in latest["reason_codes"]


def test_status_aliases_normalized(guard, fixtures_online):
    fixtures_online.mock_llm(r".*", json.dumps({
        "status": " restricted ", "reasoning": "Suspended.",
        "reason_codes": "redemptions_suspended", "supporting_urls": [URL_SUSPENDED],
    }))
    assert guard.assess_asset("HLUSD", urls(URL_SUSPENDED)) == "RESTRICTED"
    assert guard.get_latest_assessment("HLUSD")["reason_codes"] == ["REDEMPTIONS_SUSPENDED"]


def test_unavailable_sources_yield_insufficient_without_llm(guard, direct_vm):
    direct_vm.mock_web(r".*", {"status": 404, "body": "not found"})
    assert guard.assess_asset("NWUSD", urls(URL_OPERATIONAL)) == "INSUFFICIENT_EVIDENCE"
    latest = guard.get_latest_assessment("NWUSD")
    assert latest["reason_codes"] == ["SOURCE_UNAVAILABLE"]
    assert latest["sources"][0]["fetch"] == "HTTP_404"


def test_oversized_and_binary_sources_unusable(guard, direct_vm):
    direct_vm.mock_web(r"big\.html", {"response": {"status": 200, "headers": {}, "body": b"x" * 1_000_001}})
    direct_vm.mock_web(r"img\.png", {"response": {"status": 200, "headers": {"Content-Type": b"image/png"}, "body": b"\x89PNG"}})
    base = f"https://{HOST}/evidence/"
    assert guard.assess_asset("NWUSD", urls(base + "big.html", base + "img.png")) == "INSUFFICIENT_EVIDENCE"
    fetches = [s["fetch"] for s in guard.get_latest_assessment("NWUSD")["sources"]]
    assert fetches == ["TOO_LARGE", "UNSUPPORTED_CONTENT"]


def test_transient_source_error_aborts_without_state_change(guard, direct_vm):
    direct_vm.mock_web(r".*", {"status": 503, "body": "busy"})
    with direct_vm.expect_revert("[TRANSIENT] SOURCE_HTTP_503"):
        guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    assert guard.get_summary()["assessment_count"] == 0


# ---------------------------------------------------------- malformed LLM output

def test_malformed_llm_output_rejected(guard, fixtures_online):
    for bad in ('"just a string"', json.dumps({"status": "MAYBE", "reasoning": "x"}),
                json.dumps({"status": "ELIGIBLE", "reasoning": ""}), json.dumps([1, 2])):
        fixtures_online.clear_mocks()
        fixtures_online.mock_web(r".*", html_response("northwind-redemptions-operational.html"))
        fixtures_online.mock_llm(r".*", bad)
        with fixtures_online.expect_revert("[LLM_ERROR] MALFORMED_OUTPUT"):
            guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    assert guard.get_summary()["assessment_count"] == 0
    assert guard.get_latest_assessment("NWUSD") == {}


# ------------------------------------------------------------- validator logic

def test_validator_agrees_on_same_status(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    assert fixtures_online.run_validator() is True


def test_validator_rejects_different_status(guard, fixtures_online):
    """Leader says ELIGIBLE; validator's own independent judgment says RESTRICTED."""
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", html_response("northwind-redemptions-operational.html"))
    fixtures_online.mock_llm(r".*", json.dumps({
        "status": "RESTRICTED", "reasoning": "Different view.",
        "reason_codes": ["REDEMPTIONS_DELAYED"], "supporting_urls": [URL_OPERATIONAL],
    }))
    assert fixtures_online.run_validator() is False


def test_validator_ignores_reasoning_prose_differences(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", html_response("northwind-redemptions-operational.html"))
    fixtures_online.mock_llm(r".*", json.dumps({
        "status": "ELIGIBLE", "reasoning": "Completely different wording, same conclusion.",
        "reason_codes": ["REDEMPTIONS_OPERATIONAL"], "supporting_urls": [URL_OPERATIONAL],
    }))
    assert fixtures_online.run_validator() is True


def test_validator_rejects_forged_leader_payload(guard, fixtures_online):
    """A well-formed but substantively wrong leader answer is not rubber-stamped."""
    mock_all_llm(fixtures_online)
    guard.assess_asset("HLUSD", urls(URL_SUSPENDED))
    forged = dict(guard.get_latest_assessment("HLUSD"))
    forged = {
        "status": "ELIGIBLE", "reasoning": "forged", "reason_codes": ["REDEMPTIONS_OPERATIONAL"],
        "supporting_urls": [URL_SUSPENDED], "sources": forged["sources"],
    }
    assert fixtures_online.run_validator(leader_result=forged) is False
    malformed = dict(forged, supporting_urls=["https://elsewhere.example/x"], status="RESTRICTED")
    assert fixtures_online.run_validator(leader_result=malformed) is False


def test_validator_error_paths(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    # Leader failed transiently but the validator fetched fine -> disagree.
    assert fixtures_online.run_validator(leader_error=Exception("[TRANSIENT] SOURCE_HTTP_503: x")) is False
    # Both transient -> agree (transaction fails without state change).
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", {"status": 502, "body": "bad gateway"})
    assert fixtures_online.run_validator(leader_error=Exception("[TRANSIENT] SOURCE_HTTP_503: x")) is True
    # LLM errors never agree -> forces leader rotation.
    fixtures_online.clear_mocks()
    fixtures_online.mock_web(r".*", html_response("northwind-redemptions-operational.html"))
    fixtures_online.mock_llm(r".*", '"garbage"')
    assert fixtures_online.run_validator(leader_error=Exception("[LLM_ERROR] MALFORMED_OUTPUT: x")) is False


def test_policy_view(guard):
    policy = guard.get_policy()
    assert policy["policy_id"] == "RG-TREASURY-REDEMPTION-v1"
    assert policy["text"].startswith("New exposure is eligible only when authoritative evidence")
    assert policy["statuses"] == ["ELIGIBLE", "RESTRICTED", "INSUFFICIENT_EVIDENCE"]
    assert policy["restricted_to_eligible_cooldown_seconds"] == 3600


def test_dashboard_aggregate_view(guard, fixtures_online):
    mock_all_llm(fixtures_online)
    guard.assess_asset("NWUSD", urls(URL_OPERATIONAL))
    guard.request_exposure("NWUSD", 10)
    dash = guard.get_dashboard(5)
    assert dash["latest"]["NWUSD"]["status"] == "ELIGIBLE"
    assert dash["latest"]["HLUSD"] == {}
    assert [a["asset_id"] for a in dash["assets"]] == ["NWUSD", "HLUSD"]
    assert len(dash["assessments"]) == 1 and len(dash["exposures"]) == 1
    assert dash["summary"]["exposure_request_count"] == 1
    assert dash["policy"]["policy_id"] == "RG-TREASURY-REDEMPTION-v1"
    with fixtures_online.expect_revert("INVALID_LIMIT"):
        guard.get_dashboard(0)
