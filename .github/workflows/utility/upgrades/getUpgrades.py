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
            print(chainfolder)
            rpcs = [items["address"] for items in current["apis"]["rpc"]]
            apis = [items["address"] for items in current["apis"]["rest"]]
            for item in apis:
                try:
                    data = requests.get(f"{item}/cosmos/upgrade/v1beta1/current_plan", headers=headers)
                    data = data.json()['plan']
                    if data != None:
                        chainsUpgrade[chainfolder] = {
                            "height": int(data["height"]),
                            "version": data["name"],
                            "rpc": rpcs,
                            "api": apis
                        }
                        print(f"Found upgrades for {chainfolder}!")
                    else:
                        print(f"No upgrades for {chainfolder}!")
                    break
                except Exception as e:
                    print(f"Issue with request to {chainfolder}: {e}")
                    continue
            
    with open(".github/workflows/utility/upgrades/chainsUpgrade.json", "w") as file:
        json.dump(chainsUpgrade, file, indent=4)