# -*- coding: utf-8 -*-
import requests
import pytest
from collections import namedtuple
import glob
import os
import json
import logging
import re

# Setup basic configuration for logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

EndpointTest = namedtuple('EndpointTest', ['chain', 'endpoint', 'provider', 'address'])

# Set this to False to ignore the whitelist and process all providers
use_whitelist = True

# Whitelist for specific chains and providers
whitelist = {
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
        "Osmosis Foundation",
        "Polkachu",
        "CryptoCrew",
        # "forbole",
        "Imperator.co",
        # "WhisperNode 🤐",
        "chainlayer",
        "Numia",
        # "Enigma",
        # "kjnodes",
        # "Stake&Relax 🦥",
        "Allnodes ⚡️ Nodes & Staking",
        "Lava",
        "Golden Ratio Staking",
        "Stargaze Foundation",
    ]
} if use_whitelist else {'chains': [], 'providers': []}

def generate_endpoint_tests():
    test_cases = []
    logging.info(f"Current working directory: {os.getcwd()}")
    files_found = glob.glob('*/chain.json', recursive=True)
    for filename in files_found:
        with open(filename) as f:
            data = json.load(f)
            chain_name = data.get('chain_name', 'unknown')
            if 'apis' in data:
                for api_type in ['rpc', 'rest']:
                    for api in data['apis'].get(api_type, []):
                        if 'provider' in api and (
                            not use_whitelist or
                            (not whitelist['chains'] or chain_name in whitelist['chains']) and
                            (not whitelist['providers'] or api['provider'] in whitelist['providers'])
                        ):
                            address = api['address']
                            if api_type == 'rpc':
                                address += '/status'
                            elif api_type == 'rest':
                                address += '/cosmos/base/tendermint/v1beta1/syncing'
                            test_cases.append(EndpointTest(chain=chain_name, endpoint=api_type, provider=api['provider'], address=address))
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

