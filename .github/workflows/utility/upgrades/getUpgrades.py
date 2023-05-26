import requests
import json
import os
from updateCodebase import addVersion, updateCodebase

rootdir = os.getcwd()
headers = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'
}

chainsUpdated = []

def getHeight(rpcs):
    for rpc in rpcs:
        try:
            data = requests.get(f"{rpc}/block", headers=headers, timeout=10)
            return int(data.json()['result']['block']['header']['height'])
        except Exception as e:
            continue
    return -1            

def getUpgrade(chain, apis):
    for item in apis:
        try:
            data = requests.get(f"{item}/cosmos/upgrade/v1beta1/current_plan", headers=headers, timeout=10)
            data = data.json()['plan']
            if data != None:
                print(f"Found upgrade of {chain}")
                return {
                    "height": int(data["height"]),
                    "name": data["name"],
                    "info": data["info"],
                }
            else:
                return None
        except Exception as e:
            print(f"Issue with request to {chain}: {e}", flush=True)
            continue
    
    return None

def run():
    chainsFolders = sorted(os.listdir(rootdir))
    for chainfolder in chainsFolders:
        if chainfolder == "microtick" or chainfolder == "ethos" or chainfolder == "logos" or chainfolder == "mythos" or chainfolder == "octa":  # Microtick doesn't have endpoints, the others dont have codebase
            continue
        chainjson = os.path.join(chainfolder, "chain.json")
        if os.path.isfile(chainjson):
            current = json.load(open(os.path.join(rootdir, chainjson)))
            print(chainfolder, flush=True)
            rpcs = [items["address"] for items in current["apis"]["rpc"]]
            apis = [items["address"] for items in current["apis"]["rest"]]
            currentVersion = current["codebase"]["versions"][-1]
            upgrade = getUpgrade(chainfolder, apis)
            
            if upgrade != None:
                if upgrade["name"] != currentVersion["name"]:
                    addVersion(chainfolder, upgrade)
                    chainsUpdated.append(chainfolder)
                else:
                   continue
            else:
                upgradeHeight = currentVersion["height"]
                currentHeight = getHeight(rpcs)
                if currentHeight != -1:
                    if currentHeight <= upgradeHeight:
                        continue
                    else:
                        updateCodebase(chainfolder)
                        chainsUpdated.append(chainfolder)
    with open(".github/workflows/utility/upgrades/chainsUpdated.json", "w") as file:
        json.dump(chainsUpdated, file, indent=4)