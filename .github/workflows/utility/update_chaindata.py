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
            URL = current["updatelink"]
            chain_data_holder = requests.get("" + URL + "")
            response = json.loads(chain_data_holder.text)
            chaindata = response["codebase"]
            print(chaindata)
            print(current["codebase"])
            if sorted(chaindata) != sorted(current["codebase"]):
                return True
            else:
                print("No update needed for " + chainjson)