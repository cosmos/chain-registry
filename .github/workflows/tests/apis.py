# -*- coding: utf-8 -*-
import requests
import pytest
from collections import namedtuple
import glob
import os
import json
import logging
import re
import warnings

# Setup basic configuration for logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

EndpointTest = namedtuple('EndpointTest', ['chain', 'endpoint', 'provider', 'address'])

# Set this to False to ignore the whitelist and process all providers
use_whitelist = True

# Whitelist for specific chains and providers
whitelist = {
    # If chains whitelist empty, all chains will be evaluated.
    "chains": [
        # "axelar",
        # "celestia",
        # "composable",
        # "cosmoshub",
        # "dydx",
        # "dymension",
        # "evmos",
        # "injective",
        # "neutron",
        # "noble",
        # "osmosis",
        # "stargaze",
        # "stride"
    ],
    "providers": [
        # "Osmosis Foundation",
        # "Polkachu",
        # "CryptoCrew",
        # # "forbole",
        # "Imperator.co",
        # # "Lavender.Five Nodes 🐝",
        # # "WhisperNode 🤐",
        # "chainlayer",
        # "Numia",
        # # "Enigma",
        # # "kjnodes",
        # # "Stake&Relax 🦥",
        # "Allnodes ⚡️ Nodes & Staking",
        # "Lava",
        # "Golden Ratio Staking",
        # "Stargaze Foundation",
        # "Pocket Network",
    ]
} if use_whitelist else {'chains': [], 'providers': []}

def generate_endpoint_tests():
    test_cases = []
    files_found = glob.glob('*/chain.json', recursive=True)

    if not files_found:
        warnings.warn("No chain.json files found in the current directory or its subdirectories.")

    for filename in files_found:
        try:
            with open(filename) as f:
                data = json.load(f)
                chain_name = data.get('chain_name', 'unknown')
                if 'apis' in data:
                    if not isinstance(data['apis'], dict):
                        warnings.warn(f"Invalid 'apis' format in file '{filename}'. Expected a dictionary.")
                        continue
                    for api_type in ['rpc', 'rest']:
                        if api_type not in data['apis']:
                            warnings.warn(f"Missing '{api_type}' key in 'apis' of file '{filename}'.")
                            continue
                        if not isinstance(data['apis'][api_type], list):
                            warnings.warn(f"Invalid '{api_type}' format in 'apis' of file '{filename}'. Expected a list.")
                            continue
                        for api in data['apis'].get(api_type, []):
                            if 'provider' not in api:
                                warnings.warn(f"Missing 'provider' key in '{api_type}' of file '{filename}'.")
                                continue
                            if not isinstance(api['provider'], str):
                                warnings.warn(f"Invalid 'provider' format in '{api_type}' of file '{filename}'. Expected a string.")
                                continue
                            if (
                                not use_whitelist or
                                (not whitelist['chains'] or chain_name in whitelist['chains']) and
                                (not whitelist['providers'] or api['provider'] in whitelist['providers'])
                            ):
                                address = api.get('address')
                                if not address:
                                    warnings.warn(f"Missing 'address' key in '{api_type}' of file '{filename}'.")
                                    continue
                                if api_type == 'rpc':
                                    address += '/status'
                                elif api_type == 'rest':
                                    address += '/cosmos/base/tendermint/v1beta1/syncing'
                                test_cases.append(EndpointTest(chain=chain_name, endpoint=api_type, provider=api['provider'], address=address))
                else:
                    warnings.warn(f"Missing 'apis' key in file '{filename}'.")
        except json.JSONDecodeError as e:
            warnings.warn(f"Failed to decode JSON file '{filename}': {str(e)}")
        except Exception as e:
            warnings.warn(f"An error occurred while processing file '{filename}': {str(e)}")

    return test_cases

test_cases = generate_endpoint_tests()

def generate_test_function(test_case):
    def test(self):
        try:
            response = requests.get(test_case.address, timeout=2)
            assert response.status_code == 200, f"{test_case.chain.upper()}-{test_case.endpoint.upper()}-{test_case.provider} endpoint not reachable"
        except requests.exceptions.Timeout:
            logging.error(f"{test_case.chain.upper()}-{test_case.endpoint.upper()}-{test_case.provider} endpoint timed out after 2 seconds")
            pytest.fail(f"{test_case.chain.upper()}-{test_case.endpoint.upper()}-{test_case.provider} endpoint timed out after 2 seconds")
    return test

class Test:
    pass

for test_case in test_cases:
    test_name = f"chain: {test_case.chain.capitalize()[:15].ljust(15)} ▌ {test_case.endpoint.upper()[:4].ljust(4)} ▌ {re.sub(r'[^a-zA-Z0-9]+', ' ', test_case.provider)[:30].ljust(30)}"
    generate_tests = generate_test_function(test_case)
    setattr(Test, test_name, generate_tests)

