import requests
import json
import os
import traceback

rootdir = os.getcwd()
headers = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'
}

chainsData = {}
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
                # try:
                #     match chainfolder:
                #         case "gravitybridge":
                #             url = f"{item}/blocks/latest"
                #         case _:
                #             url = f"{item}/cosmos/base/tendermint/v1beta1/blocks/latest"
                #     block = requests.get(url, headers=headers)
                #     blockHeight = int(block.json()['block']['header']['height'])
                #     print(f"Current block height of {chainfolder}: {blockHeight}")
                #     match chainfolder:
                #         case "kyve" | "mars" | "quicksilver":
                #             url = f"{item}/cosmos/gov/v1/proposals?pagination.reverse=true"
                #         case _:
                #             url = f"{item}/cosmos/gov/v1beta1/proposals?pagination.reverse=true"
                #     data = requests.get(url, headers=headers)
                #     data = data.json()['proposals']
                #     for gov in data:
                #         if gov["status"] == "PROPOSAL_STATUS_PASSED" or gov["status"] == "PROPOSAL_STATUS_VOTING_PERIOD":
                #             if gov["content"]["@type"] == '/cosmos.upgrade.v1beta1.SoftwareUpgradeProposal':
                #                 if int(gov["content"]["plan"]["height"]) > blockHeight:
                #                     chainsUpgrade[chainfolder] = {
                #                         "height": int(gov["content"]["plan"]["height"]),
                #                         "version": gov["content"]["plan"]["name"]
                #                     }
                #                     break
                #     break
                # except Exception as e:
                #     print(f"Issue with request to {chainfolder}: {e}")
                #     traceback.print_exc()
                #     continue
            
                try:
                    data = requests.get(f"{item}/cosmos/upgrade/v1beta1/current_plan", headers=headers)
                    data = data.json()['plan']
                    if data != None:
                        chainsUpgrade[chainfolder] = {
                            "height": int(data["height"]),
                            "version": data["name"]
                        }
                    break
                except Exception as e:
                    print(f"Issue with request to {chainfolder}: {e}")
                    continue
                
            chainsData[chainfolder] = {
                "rpc": rpcs,
                "api": apis,
            }
    with open(".github/workflows/utility/upgrades/chainsEndpoint.json", "w") as file:
        json.dump(chainsData, file, indent=4)
        
    with open(".github/workflows/utility/upgrades/chainsUpgrade.json", "w") as file:
        json.dump(chainsUpgrade, file, indent=4)
    
    return chainsUpgrade
