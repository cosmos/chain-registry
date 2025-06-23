import json
import os
import random as rand
import time
from multiprocessing import Pool

import requests

current_dir = os.path.dirname(os.path.realpath(__file__))
parent_dir = os.path.dirname(current_dir)
folders = [
    folder
    for folder in os.listdir(parent_dir)
    if os.path.isdir(os.path.join(parent_dir, folder))
]

IGNORE_FOLDERS: list[str] = [
    "_IBC",
    "_memo_keys",
    "_non-cosmos",
    "_scripts",
    "_template",
    ".github",
    "testnets",
    ".git",
    ".mypy_cache",
]

IGNORE_CHAINS: list[str] = []

epoch_time = int(time.time()) * 1000
thirty_days_ago = epoch_time - (60 * 60 * 24 * 10 * 1_000)

TIMEOUT_SECONDS = 10
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 

# endpoint_type == 'rpc' or 'rest'
def remove_endpoint(folder: str, endpoint_url, endpoint_type: str, iter_num: int = 0):
    chain_dir = os.path.join(parent_dir, folder, f"chain.json")

    if iter_num > 25:
        print(f"ISSUE: {folder} {endpoint_type} {endpoint_url}")
        return

    with open(chain_dir, "r") as f:
        try:
            chain_data = json.load(f)
        except Exception as e:
            # multiprocessing 'patch'
            time.sleep(rand.uniform(0.1, 5.0))
            remove_endpoint(folder, endpoint_url, endpoint_type, iter_num + 1)
            return

    print(f"[-] {folder} {endpoint_type} {endpoint_url}")
    apis: dict = chain_data.get("apis", {})
    if len(apis) == 0:
        return

    # [{"address": "https://api.comdex.audit.one/rest","provider": "audit"},...]
    endpoints = apis.get(endpoint_type, [])

    apis[endpoint_type] = [
        endpoint
        for endpoint in endpoints
        if endpoint.get("address", "") != endpoint_url
    ]
    chain_data["apis"] = apis

    with open(chain_dir, "w") as f:
        json.dump(chain_data, f, indent=2, ensure_ascii=False)


def do_last_time(folder, _type, addr, last_time_endpoints):
    # check when the last time it was on. If it is >30 days, remove from chain.json
    last_online_time = last_time_endpoints[addr].get("lastSuccessAt", -1)

    if last_online_time < thirty_days_ago:
        try:
            if addr.endswith("/"):
                addr = addr[:-1]

            query = requests.get(f"{addr}/", timeout=TIMEOUT_SECONDS)
            if query.status_code not in [200, 501]:  # 501 = default REST API
                remove_endpoint(folder, addr, _type)

        except Exception:
            remove_endpoint(folder, addr, _type)


def api_check(folder: str, apis: dict) -> list[str]:
    tasks = []
    res = requests.get(f"https://status.cosmos.directory/{folder}").json()

    for _type in ["rpc", "rest"]:
        last_time_endpoints = res[_type]["current"]

        for rpc1 in apis[_type]:
            for rpc2 in last_time_endpoints.keys():
                addr = rpc1["address"]
                if addr == rpc2:
                    tasks.append([folder, _type, addr, last_time_endpoints])

    return tasks


def main():
    to_check: list[str, dict[str, str]] = []

    for idx, folder in enumerate(folders):
        if folder in IGNORE_FOLDERS + IGNORE_CHAINS:
            continue

        path = f"{parent_dir}/{folder}/chain.json"
        if not os.path.exists(path):
            continue

        try:
            apis: dict = json.loads(open(path).read())
        except Exception:
            print(f"[!] {folder} chain.json issue")
            continue

        apis = apis.get("apis", {})  # rpc, rest, grpc

        if len(apis) == 0:
            continue

        to_check.append([folder, apis])

    with Pool(os.cpu_count() * 2) as p:
        tasks = p.starmap(api_check, to_check)

    tasks = [task for sublist in tasks for task in sublist]

    with Pool(os.cpu_count() * 2) as p:
        p.starmap(do_last_time, tasks)


if __name__ == "__main__":
    main()
