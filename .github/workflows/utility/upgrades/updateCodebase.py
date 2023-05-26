import json
import os

rootdir = os.getcwd()
headers = {
    'accept': 'application/json',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/99.0.4844.51 Safari/537.36'
}

def addVersion(chain, newVersion):
    chainjson = os.path.join(chain, "chain.json")
    current = json.load(open(os.path.join(rootdir, chainjson), encoding='utf-8', errors='ignore'))
    current["codebase"]["versions"].append(newVersion)
    with open(os.path.join(rootdir, chainjson), "w") as file:
        json.dump(current, file, indent=2, ensure_ascii=False)

def updateCodebase(chain):
    chainjson = os.path.join(chain, "chain.json")
    current = json.load(open(os.path.join(rootdir, chainjson), encoding='utf-8', errors='ignore'))
    currentCodebase = current["codebase"]
    currentVersion = current["codebase"]["versions"][-1]
    for key, value in currentVersion.items():
        if key != "name" and key != "height" and key != "proposal" and key != "tag" and key != "next_version_name":
            currentCodebase[key] = value
    current["codebase"] = currentCodebase
    with open(os.path.join(rootdir, chainjson), "w") as file:
        json.dump(current, file, indent=2, ensure_ascii=False)

def updateCodebase1():
    chainsFolders = sorted(os.listdir(rootdir))
    for chainfolder in chainsFolders:
        if chainfolder == "ethos" or chainfolder == "logos" or chainfolder == "mythos" or chainfolder == "octa":
            continue
        print(chainfolder, flush=True)
        chainjson = os.path.join(chainfolder, "chain.json")
        if os.path.isfile(chainjson):
            current = json.load(open(os.path.join(rootdir, chainjson), encoding='utf-8', errors='ignore'))
            codebase = current["codebase"]
            latestVersion = current["codebase"]["versions"][-1]
            
            for key, value in latestVersion.items():
                if key != "name" and key != "height" and key != "proposal" and key != "tag" and key != "next_version_name":
                    codebase[key] = value
                    
            current["codebase"] = codebase
            
            with open(os.path.join(rootdir, chainjson), "w") as file:
                json.dump(current, file, indent=2, ensure_ascii=False)