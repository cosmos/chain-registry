import requests
import json
import os

rootdir = os.getcwd()
headers = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'
}

chainsUpgrade = {}

def getUpgrades():
    chainsFolders = sorted(os.listdir(rootdir))
    for chainfolder in chainsFolders:
        if chainfolder == "microtick":  # Microtick doesn't have endpoints
            continue
        chainjson = os.path.join(chainfolder, "chain.json")
        if os.path.isfile(chainjson):
            current = json.load(open(os.path.join(rootdir, chainjson)))
            print(chainfolder, flush=True)
            rpcs = [items["address"] for items in current["apis"]["rpc"]]
            apis = [items["address"] for items in current["apis"]["rest"]]
            for item in apis:
                try:
                    data = requests.get(f"{item}/cosmos/upgrade/v1beta1/current_plan", headers=headers, timeout=10)
                    data = data.json()['plan']
                    if data != None:
                        chainsUpgrade[chainfolder] = {
                            "height": int(data["height"]),
                            "name": data["name"],
                            "info": data["info"],
                            "rpc": rpcs,
                            "api": apis
                        }
                        print(f"Found upgrades for {chainfolder}!", flush=True)
                    else:
                        print(f"No upgrades for {chainfolder}! Using the latest version ...", flush=True)
                        if chainfolder != "ethos" and chainfolder != "gitopia" and chainfolder != "logos" and chainfolder != "mythos":
                            latestVersion = current["codebase"]["versions"][-1]
                            chainsUpgrade[chainfolder] = {
                                "height": latestVersion.get("height"),
                                "name": latestVersion["name"],
                                "rpc": rpcs,
                                "api": apis
                            }
                            if latestVersion["name"] != current["codebase"]["name"]
                    break
                except Exception as e:
                    print(f"Issue with request to {chainfolder}: {e}", flush=True)
                    if chainfolder != "ethos" and chainfolder != "gitopia" and chainfolder != "logos" and chainfolder != "mythos":
                        latestVersion = current["codebase"]["versions"][-1]
                        chainsUpgrade[chainfolder] = {
                            "height": latestVersion.get("height"),
                            "name": latestVersion["name"],
                            "rpc": rpcs,
                            "api": apis
                        }
                    continue
            
    with open(".github/workflows/utility/upgrades/chainsUpgrade.json", "w") as file:
        json.dump(chainsUpgrade, file, indent=4)

getUpgrades()