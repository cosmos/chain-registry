import requests, json
import os
from os import getcwd

rootdir = getcwd()

def checkUpdate():
    for chainfolder in os.listdir(rootdir):
        chainjson = os.path.join(chainfolder, "chain.json")
        # The following line is commented out: it will be used when everyone adopts the chainjson on their chain repo.
        # if os.path.isfile(chainjson):
        if chainjson == "osmosis/chain.json":
            current = json.load(open(os.path.join(rootdir, chainjson)))
        
        #Safeguard for updatelink being 0
            if current['updatelink'] == None:
                continue
        
            URL = current["updatelink"]
            chain_data_holder = requests.get("" + URL + "")
            response = json.loads(chain_data_holder.text)
            chaindata = response["codebase"]
        
        #If what's on the chain repo doesn't match what's here
            if sorted(chaindata) != sorted(current["codebase"]):
                #Add conditional checkers for if various fields that are non-modifiable have been modified.
                current["codebase"] = chaindata
                with open(os.path.join(rootdir, chainjson), 'w', encoding='utf-8') as f:
                    json.dump(current, f, ensure_ascii=False, indent=4)
                return True
            else:
                print("No update needed for " + chainjson)