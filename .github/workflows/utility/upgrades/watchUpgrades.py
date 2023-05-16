import requests
import json
import os
import time

rootdir = os.getcwd()
headers = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'
}

def getBlock(chain):
    with open(".github/workflows/utility/upgrades/chainsUpgrade.json", "r") as file:
        data = json.load(file)
        chainData = data[chain]
        rpcs = chainData["rpc"]
        upgradeHeight = chainData["height"]
        for item in rpcs:
            try:
                while True:
                    data = requests.get(f"{item}/block", headers=headers)
                    currentHeight = int(data.json()['result']['block']['header']['height'])
                    if currentHeight < upgradeHeight:
                        time.sleep(40 * 60)
                    else:
                        chainjson = os.path.join(chain, "chain.json")
                        current = json.load(open(os.path.join(rootdir, chainjson), encoding='utf-8', errors='ignore'))
                        codebase = current["codebase"]
                        latestVersion = current["codebase"]["versions"][-1]
                        
                        for key, value in latestVersion.iteritems():
                            if key != "name" and key != "height" and key != "proposal" and key != "tag" and key != "next_version_name":
                                codebase[key] = value
                                
                        current["codebase"] = codebase
                        
                        with open(os.path.join(rootdir, chainjson), "w") as file:
                            json.dump(current, file, indent=2, ensure_ascii=False)
                        return
            except Exception as e:
                print(f"Issue with request to {chain}: {e}")
                continue

def update_codebase():
    chainsFolders = sorted(os.listdir(rootdir))
    for chainfolder in chainsFolders:
        if chainfolder == "ethos" or chainfolder == "logos" or chainfolder == "mythos" or chainfolder == "octa":
            continue
        print(chainfolder)
        chainjson = os.path.join(chainfolder, "chain.json")
        if os.path.isfile(chainjson):
            current = json.load(open(os.path.join(rootdir, chainjson), encoding='utf-8', errors='ignore'))
            codebase = current["codebase"]
            latestVersion = current["codebase"]["versions"][-1]
            
            for key, value in latestVersion.items():
                if key != "name" and key != "height" and key != "proposal" and key != "tag" and ke:
                    codebase[key] = value
                    
            current["codebase"] = codebase
            
            with open(os.path.join(rootdir, chainjson), "w") as file:
                json.dump(current, file, indent=2, ensure_ascii=False)

update_codebase()