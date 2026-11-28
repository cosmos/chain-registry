"""Offline regression tests for endpoint test generation."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace

import pytest


def load_endpoints(tmp_path, monkeypatch, chains):
    for name, apis in chains.items():
        directory = tmp_path / name
        directory.mkdir()
        (directory / "chain.json").write_text(json.dumps({
            "chain_name": name, "apis": {"rpc": apis, "rest": []}
        }))
    monkeypatch.chdir(tmp_path)
    spec = importlib.util.spec_from_file_location(
        "endpoint_fixture", Path(__file__).with_name("apis.py")
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("chains", [
    {"example": [
        {"provider": "Provider", "address": "https://first.example"},
        {"provider": "Provider", "address": "https://second.example"},
    ]},
    {"example": [
        {"provider": "Provider-A", "address": "https://first.example"},
        {"provider": "Provider A", "address": "https://second.example"},
    ]},
    {"example": [
        {"provider": "P" * 30 + "A", "address": "https://first.example"},
        {"provider": "P" * 30 + "B", "address": "https://second.example"},
    ]},
    {
        "a" * 15 + "1": [{"provider": "Provider", "address": "https://first.example"}],
        "a" * 15 + "2": [{"provider": "Provider", "address": "https://second.example"}],
    },
])
def test_every_endpoint_is_tested(tmp_path, monkeypatch, chains):
    module = load_endpoints(tmp_path, monkeypatch, chains)
    calls = []

    def get(address, timeout):
        calls.append(address)
        assert timeout == 2
        return SimpleNamespace(status_code=200)

    monkeypatch.setattr(module.requests, "get", get)
    tests = [method for name, method in vars(module.Test).items() if name.startswith("chain")]
    assert len(tests) == len(module.test_cases) == 2
    for test in tests:
        test(module.Test())
    assert sorted(calls) == sorted(case.address for case in module.test_cases)


def test_earlier_failed_endpoint_is_not_hidden(tmp_path, monkeypatch):
    module = load_endpoints(tmp_path, monkeypatch, {"example": [
        {"provider": "Provider", "address": "https://failed.example"},
        {"provider": "Provider", "address": "https://healthy.example"},
    ]})
    monkeypatch.setattr(module.requests, "get", lambda address, timeout:
                        SimpleNamespace(status_code=503 if "failed" in address else 200))
    failures = []
    for name, test in vars(module.Test).items():
        if name.startswith("chain"):
            try:
                test(module.Test())
            except AssertionError as error:
                failures.append(str(error))
    assert len(failures) == 1
    assert "endpoint not reachable" in failures[0]
