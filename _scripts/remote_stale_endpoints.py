import os, json, requests, time # pip install requests

current_dir = os.path.dirname(os.path.realpath(__file__))
parent_dir = os.path.dirname(current_dir)
folders = [folder for folder in os.listdir(parent_dir) if os.path.isdir(os.path.join(parent_dir, folder))]
IGNORE_FOLDERS = ["_IBC", "_non-cosmos", ".github", "testnets", '.git', "_scripts"]

epoch_time = int(time.time())*1000
thirty_days_ago = epoch_time - (60 * 60 * 24 * 10 * 1_000)

TIMEOUT_SECONDS = 10


def remove_endpoint(folder: str, endpoint_url, _type: str):
    # _type == 'rpc' or 'rest'
    # remove a stale endpoint from the files.
    print(f"[-] {endpoint_url} ,, {folder} (>30 days inactive) [{_type}]")
    chain_dir = os.path.join(parent_dir, folder, f"chain.json")
    with open(chain_dir, "r") as f:
        chain_data = json.load(f)
    
    apis = chain_data.get("apis", {})
    if len(apis) == 0:
        return # only 1 does this

    endpoints = apis.get(_type, []) # [{"address": "https://api.comdex.audit.one/rest","provider": "audit"},...]

    apis[_type] = [endpoint for endpoint in endpoints if endpoint.get("address", "") != endpoint_url]
    chain_data["apis"] = apis

    with open(chain_dir, "w") as f:        
        json.dump(chain_data, f, indent=2, ensure_ascii=False)    


def do_last_time(folder, _type, addr, last_time_endpoints):
    # check when the last time it was on. If it is >30 days, remove from chain.json
    last_online_time = last_time_endpoints[addr].get('lastSuccessAt', -1)

    if last_online_time < thirty_days_ago:                    
        try:
            if addr.endswith("/"): addr = addr[:-1]
            query = requests.get(f"{addr}/", timeout=TIMEOUT_SECONDS)
            if query.status_code not in [200, 501]: # 501 = default REST API                            
                remove_endpoint(folder, addr, _type)         
        except Exception as e:
            remove_endpoint(folder, addr, _type)


def main():
    for folder in folders:
        if folder in IGNORE_FOLDERS: continue

        # if folder != "juno": continue # debugging

        path = f"{parent_dir}/{folder}/chain.json"
        apis = json.loads(open(path).read()).get('apis', {}) # rpc, rest, grpc    
        # print(path)

        if len(apis) == 0: 
            # print(f"ERR: {current_dir}/{folder}/chain.json")
            continue

        res = requests.get(f"https://status.cosmos.directory/{folder}").json()

        for _type in ['rpc', 'rest']:
            last_time_endpoints = res[_type]['current']  
            for rpc1 in apis[_type]: # [{'address': 'https://tm-api.carbon.network', 'provider': 'switcheo-labs'}, {'address': 'https://rpc.carbon.bh.rocks', 'provider': 'BlockHunters'}]            
                for rpc2 in last_time_endpoints.keys():
                    addr = rpc1['address']
                    if addr == rpc2:
                        do_last_time(folder, _type, addr, last_time_endpoints)


if __name__ == "__main__":
    main()