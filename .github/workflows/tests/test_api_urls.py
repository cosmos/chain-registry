import importlib.util
import json
from pathlib import Path
from unittest.mock import patch
import warnings

import pytest


@pytest.fixture
def api_module():
    spec = importlib.util.spec_from_file_location(
        "api_url_tests", Path(__file__).with_name("apis.py")
    )
    module = importlib.util.module_from_spec(spec)
    # Import without collecting real endpoints or making network requests.
    with patch("glob.glob", return_value=[]), warnings.catch_warnings():
        warnings.simplefilter("ignore")
        spec.loader.exec_module(module)
    return module


@pytest.mark.parametrize("api_type,suffix", [
    ("rpc", "/status"),
    ("rest", "/cosmos/base/tendermint/v1beta1/syncing"),
])
@pytest.mark.parametrize("base,path,query", [
    ("https://example.com", "", ""),
    ("https://example.com/", "", ""),
    ("https://example.com/cosmos/rpc/", "/cosmos/rpc", ""),
    ("https://example.com/rpc?token=example", "/rpc", "?token=example"),
    ("https://example.com/rpc/?token=example/", "/rpc", "?token=example/"),
])
def test_health_check_path(api_module, tmp_path, monkeypatch, api_type, suffix, base, path, query):
    chain_dir = tmp_path / "example"
    chain_dir.mkdir()
    (chain_dir / "chain.json").write_text(json.dumps({
        "chain_name": "example",
        "apis": {"rpc": [], "rest": [], api_type: [
            {"address": base, "provider": "Example"},
        ]},
    }))
    monkeypatch.chdir(tmp_path)

    cases = api_module.generate_endpoint_tests()

    assert len(cases) == 1
    assert cases[0].address == "https://example.com" + path + suffix + query
